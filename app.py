#!/usr/bin/env python3
"""
Aplicación web para crear videos a partir de imágenes y audio.
"""

import os
import sys
import subprocess
import shutil

# === CONFIGURAR FFMPEG ANTES DE IMPORTAR MOVIEPY ===
def check_nvenc_available() -> bool:
    """Verifica si el codificador NVENC está disponible y funcional en FFmpeg."""
    try:
        ffmpeg_path = shutil.which('ffmpeg')
        if not ffmpeg_path:
            return False

        # Primero verificar si el encoder está listado
        result = subprocess.run(
            [ffmpeg_path, '-encoders'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if 'h264_nvenc' not in result.stdout:
            return False

        # Hacer una prueba real de encoding para verificar que CUDA funciona
        # Genera un frame negro de 64x64 y lo codifica con nvenc
        test_result = subprocess.run(
            [
                ffmpeg_path,
                '-f', 'lavfi',
                '-i', 'color=black:s=64x64:d=0.1',
                '-c:v', 'h264_nvenc',
                '-f', 'null',
                '-'
            ],
            capture_output=True,
            text=True,
            timeout=10
        )
        return test_result.returncode == 0
    except Exception:
        return False

SYSTEM_FFMPEG = shutil.which('ffmpeg')
NVENC_AVAILABLE = check_nvenc_available()

# Forzar MoviePy/imageio a usar el FFmpeg del sistema ANTES de importar
if SYSTEM_FFMPEG:
    os.environ['IMAGEIO_FFMPEG_EXE'] = SYSTEM_FFMPEG

# Configurar LD_LIBRARY_PATH para que FFmpeg encuentre libcuda (necesario en WSL2)
WSL_LIB_PATH = '/usr/lib/wsl/lib'
if os.path.exists(WSL_LIB_PATH):
    current_ld_path = os.environ.get('LD_LIBRARY_PATH', '')
    if WSL_LIB_PATH not in current_ld_path:
        os.environ['LD_LIBRARY_PATH'] = f"{WSL_LIB_PATH}:{current_ld_path}" if current_ld_path else WSL_LIB_PATH
    print(f"LD_LIBRARY_PATH configurado para CUDA: {os.environ['LD_LIBRARY_PATH']}")

print(f"FFmpeg: {SYSTEM_FFMPEG}")
print(f"NVENC disponible: {NVENC_AVAILABLE}")
# === FIN CONFIGURACIÓN FFMPEG ===

import uuid
import json
import threading
import re
from pathlib import Path
from flask import Flask, request, jsonify, send_file, render_template, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename
from moviepy import (
    ImageClip,
    AudioFileClip,
    CompositeVideoClip,
    concatenate_videoclips,
    TextClip,
    ColorClip,
)
from moviepy.video.fx import CrossFadeIn, CrossFadeOut, FadeIn, FadeOut, SlideIn, SlideOut
from PIL import ImageFont
from functools import lru_cache
import multiprocessing
import time as time_module
from proglog import ProgressBarLogger

app = Flask(__name__, static_folder='static', template_folder='templates')


class JobCancelledException(Exception):
    """Excepción lanzada cuando un trabajo es cancelado."""
    pass


class JobProgressLogger(ProgressBarLogger):
    """Logger personalizado que actualiza el progreso del job con información detallada de moviepy."""

    def __init__(self, job_id: str, jobs_dict: dict, cancel_event: threading.Event = None,
                 base_progress: int = 80, max_progress: int = 95):
        super().__init__()
        self.job_id = job_id
        self.jobs_dict = jobs_dict
        self.cancel_event = cancel_event
        self.base_progress = base_progress
        self.max_progress = max_progress
        self.start_time = None
        self.current_bar_total = 0

    def bars_callback(self, bar, attr, value, old_value=None):
        """Callback llamado cuando hay cambios en las barras de progreso."""
        # Verificar cancelación
        if self.cancel_event and self.cancel_event.is_set():
            raise JobCancelledException("Trabajo cancelado por el usuario")

        super().bars_callback(bar, attr, value, old_value)

        # Solo procesar la barra de frames
        if bar != 'frame_index':
            return

        # Obtener información de la barra actual
        bar_state = self.state.get('bars', {}).get(bar, {})
        current = bar_state.get('index', 0)
        total = bar_state.get('total', 0)

        if attr == 'total' and value:
            self.current_bar_total = value
            self.start_time = time_module.time()
            return

        if attr == 'index' and self.current_bar_total > 0:
            current = value
            total = self.current_bar_total

            render_progress = current / total if total > 0 else 0
            actual_progress = self.base_progress + int(render_progress * (self.max_progress - self.base_progress))

            # Calcular velocidad (frames por segundo)
            elapsed = time_module.time() - self.start_time if self.start_time else 1
            fps_speed = current / elapsed if elapsed > 0 else 0

            # Calcular tiempo restante
            remaining_frames = total - current
            eta = remaining_frames / fps_speed if fps_speed > 0 else 0
            eta_min = int(eta // 60)
            eta_sec = int(eta % 60)

            # Crear barra de progreso visual
            bar_width = 20
            filled = int(bar_width * render_progress)
            progress_bar = '█' * filled + '░' * (bar_width - filled)

            # Actualizar mensaje con información detallada
            message = f"Renderizando: {current}/{total} [{progress_bar}] {render_progress*100:.0f}% | {fps_speed:.1f} fps | ETA: {eta_min}:{eta_sec:02d}"

            self.jobs_dict[self.job_id]['progress'] = actual_progress
            self.jobs_dict[self.job_id]['message'] = message
            self.jobs_dict[self.job_id]['render_info'] = {
                'current_frame': current,
                'total_frames': total,
                'fps_speed': round(fps_speed, 2),
                'eta_seconds': round(eta, 1),
                'percent': round(render_progress * 100, 1),
            }


# Cache de fuentes PIL para evitar cargarlas repetidamente
_font_cache = {}

def get_cached_font(font_path: str, font_size: int) -> ImageFont.FreeTypeFont:
    """Obtiene una fuente del cache o la carga si no existe."""
    key = (font_path, font_size)
    if key not in _font_cache:
        try:
            _font_cache[key] = ImageFont.truetype(font_path, font_size)
        except Exception:
            _font_cache[key] = None
    return _font_cache[key]

# Número óptimo de threads para FFmpeg
FFMPEG_THREADS = max(4, multiprocessing.cpu_count())
CORS(app)

# Configuración
UPLOAD_FOLDER = Path('/tmp/video_creator')
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
app.config['UPLOAD_FOLDER'] = str(UPLOAD_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB máximo

# Almacén de progreso de trabajos
jobs = {}

# Eventos de cancelación para cada trabajo
cancel_events = {}

# Mapeo de fuentes disponibles
FONTS = {
    # DejaVu (siempre disponibles desde apt)
    'DejaVuSans-Bold': '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    'DejaVuSans': '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    'DejaVuSerif-Bold': '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
    'DejaVuSerif': '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
    # Liberation (desde apt)
    'LiberationSans-Bold': '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    'LiberationSans': '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    'LiberationMono-Bold': '/usr/share/fonts/truetype/liberation/LiberationMono-Bold.ttf',
    # FreeFonts (desde apt)
    'FreeSans-Bold': '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    'FreeSans': '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
    'FreeSerif-Bold': '/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf',
    'FreeSerif': '/usr/share/fonts/truetype/freefont/FreeSerif.ttf',
    # Roboto (desde GitHub)
    'Roboto-Bold': '/usr/share/fonts/truetype/google/roboto/Roboto-Bold.ttf',
    'Roboto': '/usr/share/fonts/truetype/google/roboto/Roboto-Regular.ttf',
    'Roboto-Light': '/usr/share/fonts/truetype/google/roboto/Roboto-Light.ttf',
    'Roboto-Black': '/usr/share/fonts/truetype/google/roboto/Roboto-Black.ttf',
    # Open Sans (desde GitHub)
    'OpenSans-Bold': '/usr/share/fonts/truetype/google/opensans/OpenSans-Bold.ttf',
    'OpenSans': '/usr/share/fonts/truetype/google/opensans/OpenSans-Regular.ttf',
    'OpenSans-Light': '/usr/share/fonts/truetype/google/opensans/OpenSans-Light.ttf',
    # Lato (desde GitHub)
    'Lato-Bold': '/usr/share/fonts/truetype/google/lato/Lato-Bold.ttf',
    'Lato': '/usr/share/fonts/truetype/google/lato/Lato-Regular.ttf',
    'Lato-Light': '/usr/share/fonts/truetype/google/lato/Lato-Light.ttf',
    'Lato-Black': '/usr/share/fonts/truetype/google/lato/Lato-Black.ttf',
    # Montserrat (desde GitHub)
    'Montserrat-Bold': '/usr/share/fonts/truetype/google/montserrat/Montserrat-Bold.ttf',
    'Montserrat': '/usr/share/fonts/truetype/google/montserrat/Montserrat-Regular.ttf',
    'Montserrat-Black': '/usr/share/fonts/truetype/google/montserrat/Montserrat-Black.ttf',
    # Poppins (desde GitHub)
    'Poppins-Bold': '/usr/share/fonts/truetype/google/poppins/Poppins-Bold.ttf',
    'Poppins': '/usr/share/fonts/truetype/google/poppins/Poppins-Regular.ttf',
    'Poppins-Black': '/usr/share/fonts/truetype/google/poppins/Poppins-Black.ttf',
    # Oswald (desde GitHub)
    'Oswald-Bold': '/usr/share/fonts/truetype/google/oswald/Oswald-Bold.ttf',
    'Oswald': '/usr/share/fonts/truetype/google/oswald/Oswald-Regular.ttf',
    # Playfair Display (desde GitHub)
    'PlayfairDisplay-Bold': '/usr/share/fonts/truetype/google/playfair/PlayfairDisplay-Bold.ttf',
    'PlayfairDisplay': '/usr/share/fonts/truetype/google/playfair/PlayfairDisplay-Regular.ttf',
    # Bebas Neue (desde GitHub)
    'BebasNeue': '/usr/share/fonts/truetype/google/bebas/BebasNeue-Regular.ttf',
    # Fira Code (desde GitHub)
    'FiraCode-Bold': '/usr/share/fonts/truetype/google/firacode/FiraCode-Bold.ttf',
    'FiraCode': '/usr/share/fonts/truetype/google/firacode/FiraCode-Regular.ttf',
    # Ubuntu (desde Ubuntu assets)
    'Ubuntu-Bold': '/usr/share/fonts/truetype/google/ubuntu/Ubuntu-B.ttf',
    'Ubuntu': '/usr/share/fonts/truetype/google/ubuntu/Ubuntu-R.ttf',
    'Ubuntu-Light': '/usr/share/fonts/truetype/google/ubuntu/Ubuntu-L.ttf',
    # Noto Sans (desde GitHub)
    'NotoSans-Bold': '/usr/share/fonts/truetype/google/noto/NotoSans-Bold.ttf',
    'NotoSans': '/usr/share/fonts/truetype/google/noto/NotoSans-Regular.ttf',
}


def parse_srt(srt_path: str) -> list[dict]:
    """Parsea un archivo de subtítulos .srt"""
    subtitles = []

    with open(srt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    pattern = r'(\d+)\s*\n(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*\n(.*?)(?=\n\n|\n*$)'
    matches = re.findall(pattern, content, re.DOTALL)

    for match in matches:
        start_h, start_m, start_s, start_ms = int(match[1]), int(match[2]), int(match[3]), int(match[4])
        end_h, end_m, end_s, end_ms = int(match[5]), int(match[6]), int(match[7]), int(match[8])

        start_time = start_h * 3600 + start_m * 60 + start_s + start_ms / 1000
        end_time = end_h * 3600 + end_m * 60 + end_s + end_ms / 1000

        text = re.sub(r'<[^>]+>', '', match[9].strip())
        text = text.replace('\n', ' ')

        subtitles.append({
            'start': start_time,
            'end': end_time,
            'text': text
        })

    return subtitles



def wrap_text(text: str, font_size: int, width: int, font_path: str) -> str:
    """
    Envuelve el texto para que quepan palabras completas sin partir.
    Usa PIL para calcular el ancho real del texto con la fuente específica.

    Args:
        text: Texto a envolver
        font_size: Tamaño de fuente en píxeles
        width: Ancho disponible en píxeles
        font_path: Ruta a la fuente TTF

    Returns:
        Texto con saltos de línea (\n) para envolver adecuadamente
    """
    words = text.split()
    lines = []
    current_line = []

    # Usar fuente cacheada para evitar cargarla repetidamente
    font = get_cached_font(font_path, font_size)

    def get_text_width(txt: str) -> int:
        if font:
            bbox = font.getbbox(txt)
            return bbox[2] - bbox[0]  # right - left
        else:
            # Fallback conservador
            return len(txt) * font_size * 0.65

    for word in words:
        current_line.append(word)
        current_line_text = ' '.join(current_line)

        # Calcular el ancho real del texto
        text_width = get_text_width(current_line_text)

        # Si la línea es demasiado ancha, mover la palabra a la siguiente línea
        if text_width > width:
            current_line.pop()  # Remover la última palabra
            if current_line:
                lines.append(' '.join(current_line))
            current_line = [word]

    if current_line:
        lines.append(' '.join(current_line))

    return '\n'.join(lines)


def create_subtitle_clips(
    subtitles: list[dict],
    resolution: tuple[int, int],
    font_size: int = 75,
    font_color: str = 'white',
    stroke_color: str = 'black',
    stroke_width: int = 2,
    font_path: str = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    typewriter_ratio: float = 0.7,
    max_clips_per_subtitle: int = 30,
    typewriter_enabled: bool = True,
    position: str = 'center',
) -> list:
    """
    Crea clips de texto para cada subtítulo con efecto typewriter optimizado.

    Optimización: En lugar de crear un clip por cada caracter, agrupa caracteres
    para crear un máximo de max_clips_per_subtitle clips por subtítulo.
    Esto reduce dramáticamente el uso de memoria y tiempo de composición.

    Si typewriter_enabled=False, muestra el texto completo de una vez.
    """
    subtitle_clips = []

    for sub in subtitles:
        duration = sub['end'] - sub['start']
        text = sub['text']

        if not text:
            continue

        # Si el efecto typewriter está deshabilitado, crear un solo clip
        if not typewriter_enabled:
            wrapped_text = wrap_text(text, font_size, resolution[0] - 80, font_path)

            txt_clip = TextClip(
                text=wrapped_text,
                font_size=font_size,
                color=font_color,
                stroke_color=stroke_color,
                stroke_width=stroke_width,
                font=font_path,
                method='caption',
                size=(resolution[0] - 80, None),
                text_align='center',
                margin=(stroke_width + 10, stroke_width + int(font_size * 0.3)),
            )

            txt_clip = txt_clip.with_duration(duration)
            txt_clip = txt_clip.with_start(sub['start'])
            if position == 'bottom':
                txt_clip = txt_clip.with_position(('center', resolution[1] - txt_clip.h - 50))
            else:
                txt_clip = txt_clip.with_position('center')

            subtitle_clips.append(txt_clip)
            continue

        # Efecto typewriter habilitado
        typewriter_duration = duration * typewriter_ratio
        hold_duration = duration * (1 - typewriter_ratio)

        # Optimización: calcular el paso óptimo de caracteres
        # En lugar de crear un clip por caracter, agrupamos para limitar clips
        num_chars = len(text)
        char_step = max(1, num_chars // max_clips_per_subtitle)

        # Crear lista de posiciones donde crearemos clips
        # Siempre incluimos el último caracter para mostrar el texto completo
        positions = list(range(char_step, num_chars, char_step))
        if not positions or positions[-1] != num_chars:
            positions.append(num_chars)

        time_per_step = typewriter_duration / len(positions) if positions else typewriter_duration

        for idx, char_pos in enumerate(positions):
            partial_text = text[:char_pos]
            # Envolver el texto parcial para evitar que se corten palabras
            wrapped_partial = wrap_text(partial_text, font_size, resolution[0] - 80, font_path)

            is_last = (idx == len(positions) - 1)
            if is_last:
                clip_duration = time_per_step + hold_duration
            else:
                clip_duration = time_per_step

            txt_clip = TextClip(
                text=wrapped_partial,
                font_size=font_size,
                color=font_color,
                stroke_color=stroke_color,
                stroke_width=stroke_width,
                font=font_path,
                method='caption',
                size=(resolution[0] - 80, None),
                text_align='center',
                margin=(stroke_width + 10, stroke_width + int(font_size * 0.3)),
            )

            txt_clip = txt_clip.with_duration(clip_duration)
            start_time = sub['start'] + idx * time_per_step
            txt_clip = txt_clip.with_start(start_time)
            if position == 'bottom':
                txt_clip = txt_clip.with_position(('center', resolution[1] - txt_clip.h - 50))
            else:
                txt_clip = txt_clip.with_position('center')

            subtitle_clips.append(txt_clip)

    return subtitle_clips


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    """Convierte un color hexadecimal a RGB."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def create_title_clip(config: dict, resolution: tuple[int, int]) -> CompositeVideoClip:
    """Crea un clip de título (intro/outro) con fondo de color o imagen y animaciones."""
    duration = config['duration']
    animation_in = config.get('animation_in', 'none')
    animation_out = config.get('animation_out', 'none')
    animation_duration = min(1.0, duration / 3)  # Duracion de animacion: 1s o 1/3 del total

    # Crear fondo (imagen o color)
    if config.get('bg_image') and Path(config['bg_image']).exists():
        # Usar imagen de fondo
        bg_clip = ImageClip(config['bg_image'], duration=duration)

        # Redimensionar para cubrir la resolución
        img_ratio = bg_clip.w / bg_clip.h
        target_ratio = resolution[0] / resolution[1]

        if img_ratio > target_ratio:
            bg_clip = bg_clip.resized(height=resolution[1])
        else:
            bg_clip = bg_clip.resized(width=resolution[0])

        bg_clip = bg_clip.with_position(("center", "center"))

        # Crear clip de fondo negro para asegurar que cubra todo
        black_bg = ColorClip(size=resolution, color=(0, 0, 0), duration=duration)
        bg_clip = CompositeVideoClip([black_bg, bg_clip], size=resolution).with_duration(duration)
    else:
        # Usar color de fondo
        bg_color = hex_to_rgb(config['bg_color'])
        bg_clip = ColorClip(size=resolution, color=bg_color, duration=duration)

    # Manejar animacion typewriter
    if animation_in == 'typewriter':
        return create_typewriter_title_clip(config, resolution, bg_clip, animation_out, animation_duration)

    # Crear texto base
    txt_clip = TextClip(
        text=config['text'],
        font_size=config['font_size'],
        color=config['font_color'],
        font=config['font_path'],
        method='caption',
        size=(resolution[0] - 100, None),
        text_align='center',
        margin=(10, int(config['font_size'] * 0.3)),
    )
    txt_clip = txt_clip.with_duration(duration)
    txt_clip = txt_clip.with_position('center')

    # Aplicar animaciones de entrada
    txt_clip = apply_text_animation_in(txt_clip, animation_in, animation_duration, resolution)

    # Aplicar animaciones de salida
    txt_clip = apply_text_animation_out(txt_clip, animation_out, animation_duration, duration, resolution)

    # Componer
    return CompositeVideoClip([bg_clip, txt_clip], size=resolution).with_duration(duration)


def apply_text_animation_in(clip, animation_type: str, anim_duration: float, resolution: tuple[int, int]):
    """Aplica animacion de entrada al clip de texto."""
    if animation_type == 'none':
        return clip
    elif animation_type == 'fade':
        return clip.with_effects([FadeIn(anim_duration)])
    elif animation_type == 'slide_left':
        return clip.with_effects([SlideIn(anim_duration, 'left')])
    elif animation_type == 'slide_right':
        return clip.with_effects([SlideIn(anim_duration, 'right')])
    elif animation_type == 'slide_top':
        return clip.with_effects([SlideIn(anim_duration, 'top')])
    elif animation_type == 'slide_bottom':
        return clip.with_effects([SlideIn(anim_duration, 'bottom')])
    elif animation_type == 'zoom':
        # Zoom in: empezar pequeño y crecer
        def zoom_in_func(t):
            if t < anim_duration:
                scale = 0.3 + (0.7 * t / anim_duration)
            else:
                scale = 1.0
            return scale

        return clip.resized(zoom_in_func)
    return clip


def apply_text_animation_out(clip, animation_type: str, anim_duration: float, total_duration: float, resolution: tuple[int, int]):
    """Aplica animacion de salida al clip de texto."""
    if animation_type == 'none':
        return clip
    elif animation_type == 'fade':
        return clip.with_effects([FadeOut(anim_duration)])
    elif animation_type == 'slide_left':
        return clip.with_effects([SlideOut(anim_duration, 'left')])
    elif animation_type == 'slide_right':
        return clip.with_effects([SlideOut(anim_duration, 'right')])
    elif animation_type == 'slide_top':
        return clip.with_effects([SlideOut(anim_duration, 'top')])
    elif animation_type == 'slide_bottom':
        return clip.with_effects([SlideOut(anim_duration, 'bottom')])
    elif animation_type == 'zoom':
        # Zoom out: terminar pequeño
        start_out = total_duration - anim_duration

        def zoom_out_func(t):
            if t > start_out:
                progress = (t - start_out) / anim_duration
                scale = 1.0 - (0.7 * progress)
            else:
                scale = 1.0
            return scale

        return clip.resized(zoom_out_func)
    return clip


def create_typewriter_title_clip(config: dict, resolution: tuple[int, int], bg_clip, animation_out: str, anim_duration: float):
    """Crea un clip de titulo con efecto typewriter."""
    duration = config['duration']
    text = config['text']
    typewriter_ratio = 0.6  # 60% para escribir, 40% para mantener
    typewriter_duration = duration * typewriter_ratio
    hold_duration = duration * (1 - typewriter_ratio)
    time_per_char = typewriter_duration / len(text)

    text_clips = []
    for i in range(1, len(text) + 1):
        partial_text = text[:i]

        if i < len(text):
            clip_duration = time_per_char
        else:
            clip_duration = time_per_char + hold_duration

        txt_clip = TextClip(
            text=partial_text,
            font_size=config['font_size'],
            color=config['font_color'],
            font=config['font_path'],
            method='caption',
            size=(resolution[0] - 100, None),
            text_align='center',
            margin=(10, int(config['font_size'] * 0.3)),
        )
        txt_clip = txt_clip.with_duration(clip_duration)
        start_time = (i - 1) * time_per_char
        txt_clip = txt_clip.with_start(start_time)
        txt_clip = txt_clip.with_position('center')

        # Aplicar animacion de salida solo al ultimo clip
        if i == len(text) and animation_out != 'none':
            txt_clip = apply_text_animation_out(txt_clip, animation_out, anim_duration, clip_duration, resolution)

        text_clips.append(txt_clip)

    return CompositeVideoClip([bg_clip] + text_clips, size=resolution).with_duration(duration)


def get_transition_effects(transition_type: str, transition_duration: float, resolution: tuple[int, int]):
    """Retorna los efectos de transición según el tipo seleccionado."""
    effects = []
    needs_overlap = False

    if transition_type == 'crossfade':
        effects = [CrossFadeIn(transition_duration), CrossFadeOut(transition_duration)]
        needs_overlap = True
    elif transition_type == 'fade':
        effects = [FadeIn(transition_duration), FadeOut(transition_duration)]
        needs_overlap = True
    elif transition_type == 'fadein':
        effects = [FadeIn(transition_duration)]
        needs_overlap = False
    elif transition_type == 'fadeout':
        effects = [FadeOut(transition_duration)]
        needs_overlap = False
    elif transition_type == 'slide_left':
        effects = [SlideIn(transition_duration, 'right'), SlideOut(transition_duration, 'left')]
        needs_overlap = True
    elif transition_type == 'slide_right':
        effects = [SlideIn(transition_duration, 'left'), SlideOut(transition_duration, 'right')]
        needs_overlap = True
    elif transition_type == 'slide_up':
        effects = [SlideIn(transition_duration, 'bottom'), SlideOut(transition_duration, 'top')]
        needs_overlap = True
    elif transition_type == 'slide_down':
        effects = [SlideIn(transition_duration, 'top'), SlideOut(transition_duration, 'bottom')]
        needs_overlap = True
    # 'none' o cualquier otro valor no agrega efectos

    return effects, needs_overlap


def process_video(job_id: str, images: list[str], audio_path: str, srt_path: str = None,
                  resolution: tuple[int, int] = (1080, 1920), transition_type: str = 'crossfade',
                  transition_duration: float = 0.5, fps: int = 4, subtitle_config: dict = None,
                  intro_config: dict = None, outro_config: dict = None,
                  cancel_event: threading.Event = None):
    """Procesa el video en un hilo separado."""
    temp_video_path = None
    audio = None
    video = None
    clips = []

    def check_cancelled():
        """Verifica si el trabajo fue cancelado."""
        if cancel_event and cancel_event.is_set():
            raise JobCancelledException("Trabajo cancelado por el usuario")

    try:
        jobs[job_id]['status'] = 'processing'
        jobs[job_id]['progress'] = 0
        jobs[job_id]['message'] = 'Iniciando procesamiento...'

        output_path = str(UPLOAD_FOLDER / f'{job_id}_output.mp4')
        temp_video_path = output_path.replace('.mp4', '_temp_video.mp4')

        check_cancelled()

        # Cargar audio
        jobs[job_id]['message'] = 'Cargando audio...'
        jobs[job_id]['progress'] = 5
        audio = AudioFileClip(audio_path)
        total_duration = audio.duration

        duration_per_image = total_duration / len(images)

        # Obtener efectos de transición
        effects, needs_overlap = get_transition_effects(transition_type, transition_duration, resolution)

        check_cancelled()

        # Crear clips de imágenes
        for i, image_path in enumerate(images):
            check_cancelled()

            progress = 10 + int((i / len(images)) * 50)
            jobs[job_id]['progress'] = progress
            jobs[job_id]['message'] = f'Procesando imagen {i + 1}/{len(images)}...'

            clip = ImageClip(image_path, duration=duration_per_image)

            img_ratio = clip.w / clip.h
            target_ratio = resolution[0] / resolution[1]

            if img_ratio > target_ratio:
                clip = clip.resized(height=resolution[1])
            else:
                clip = clip.resized(width=resolution[0])

            clip = clip.with_position(("center", "center"))

            if effects and transition_duration > 0 and duration_per_image > transition_duration * 2:
                clip = clip.with_effects(effects)

            clips.append(clip)

        # Concatenar clips
        jobs[job_id]['message'] = 'Concatenando clips...'
        jobs[job_id]['progress'] = 65

        if needs_overlap and transition_duration > 0:
            final_clips = []
            current_time = 0

            for clip in clips:
                clip = clip.with_start(current_time)
                final_clips.append(clip)
                current_time += duration_per_image - transition_duration

            video = CompositeVideoClip(final_clips, size=resolution)
            video = video.with_duration(total_duration)
        else:
            video = concatenate_videoclips(clips, method="compose")

        # Agregar subtítulos si existen
        if srt_path and Path(srt_path).exists():
            jobs[job_id]['message'] = 'Agregando subtítulos...'
            jobs[job_id]['progress'] = 70
            subtitles = parse_srt(srt_path)

            if subtitles:
                # Configuración de subtítulos
                sub_cfg = subtitle_config or {}
                subtitle_clips = create_subtitle_clips(
                    subtitles,
                    resolution,
                    font_size=sub_cfg.get('font_size', 75),
                    font_color=sub_cfg.get('font_color', 'white'),
                    stroke_color=sub_cfg.get('stroke_color', 'black'),
                    stroke_width=sub_cfg.get('stroke_width', 2),
                    font_path=sub_cfg.get('font_path', FONTS['DejaVuSans-Bold']),
                    typewriter_enabled=sub_cfg.get('typewriter_enabled', True),
                    position=sub_cfg.get('position', 'center'),
                )
                video = CompositeVideoClip([video] + subtitle_clips, size=resolution)
                video = video.with_duration(total_duration)

        check_cancelled()

        # Crear clips de intro y outro si están configurados
        # El intro y outro son SILENCIOSOS (sin la canción)
        # Los subtítulos están sincronizados con la canción (que empieza después del intro)
        clips_to_concat = []
        intro_duration = 0

        check_cancelled()

        if intro_config:
            jobs[job_id]['message'] = 'Creando intro...'
            jobs[job_id]['progress'] = 77
            intro_clip = create_title_clip(intro_config, resolution)
            intro_duration = intro_config['duration']
            # Intro sin audio (silencioso)
            clips_to_concat.append(intro_clip)

        clips_to_concat.append(video)

        if outro_config:
            jobs[job_id]['message'] = 'Creando outro...'
            jobs[job_id]['progress'] = 78
            outro_clip = create_title_clip(outro_config, resolution)
            # Outro sin audio (silencioso)
            clips_to_concat.append(outro_clip)

        check_cancelled()

        # Concatenar intro (silencioso) + video (con audio) + outro (silencioso)
        if len(clips_to_concat) > 1:
            jobs[job_id]['message'] = 'Concatenando intro/outro...'
            jobs[job_id]['progress'] = 79
            video = concatenate_videoclips(clips_to_concat, method="compose")

        check_cancelled()

        # Exportar video sin audio (más rápido)
        jobs[job_id]['message'] = 'Iniciando renderizado...'
        jobs[job_id]['progress'] = 80

        # Crear logger personalizado para capturar el progreso real (con soporte de cancelación)
        progress_logger = JobProgressLogger(job_id, jobs, cancel_event, base_progress=80, max_progress=95)

        video.write_videofile(
            temp_video_path,
            fps=fps,
            codec="libx264",
            audio=False,  # Sin audio = mucho más rápido
            threads=FFMPEG_THREADS,
            preset="ultrafast",
            logger=progress_logger,
            ffmpeg_params=[
                "-crf", "32",
                "-tune", "zerolatency",
                "-pix_fmt", "yuv420p",
                "-bf", "0",
            ],
        )

        check_cancelled()

        # Combinar video + audio con ffmpeg
        # El audio empieza después del intro (con offset)
        jobs[job_id]['message'] = 'Combinando audio...'
        jobs[job_id]['progress'] = 95

        ffmpeg_cmd = [
            SYSTEM_FFMPEG,
            "-y",
            "-i", temp_video_path,
        ]

        # Si hay intro, agregar offset al audio para que empiece después del intro
        if intro_duration > 0:
            ffmpeg_cmd.extend(["-itsoffset", str(intro_duration)])

        ffmpeg_cmd.extend([
            "-i", audio_path,
            "-c:v", "copy",  # No re-codifica video
            "-c:a", "aac",
            "-movflags", "+faststart",
            output_path
        ])

        subprocess.run(ffmpeg_cmd, check=True, capture_output=True)

        # Eliminar video temporal
        if temp_video_path and os.path.exists(temp_video_path):
            os.remove(temp_video_path)

        # Limpiar
        if audio:
            audio.close()
        for clip in clips:
            clip.close()
        if video:
            video.close()

        jobs[job_id]['status'] = 'completed'
        jobs[job_id]['progress'] = 100
        jobs[job_id]['message'] = 'Video creado exitosamente!'
        jobs[job_id]['output_file'] = output_path

    except JobCancelledException:
        # Trabajo cancelado por el usuario
        jobs[job_id]['status'] = 'cancelled'
        jobs[job_id]['message'] = 'Proceso cancelado'
        jobs[job_id]['progress'] = 0

        # Limpiar archivos temporales
        if temp_video_path and os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except Exception:
                pass

        # Limpiar recursos
        try:
            if audio:
                audio.close()
            for clip in clips:
                clip.close()
            if video:
                video.close()
        except Exception:
            pass

    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['message'] = f'Error: {str(e)}'
        jobs[job_id]['progress'] = 0

        # Limpiar archivos temporales en caso de error
        if temp_video_path and os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except Exception:
                pass

        # Limpiar recursos
        try:
            if audio:
                audio.close()
            for clip in clips:
                clip.close()
            if video:
                video.close()
        except Exception:
            pass


@app.route('/')
def index():
    """Página principal."""
    return render_template('index.html')


@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Sube archivos y prepara el trabajo."""
    job_id = str(uuid.uuid4())
    job_folder = UPLOAD_FOLDER / job_id
    job_folder.mkdir(parents=True, exist_ok=True)

    # Guardar imágenes
    images = request.files.getlist('images')
    image_order = request.form.get('image_order', '').split(',')

    image_paths = []
    saved_images = {}

    for img in images:
        if img.filename:
            filename = secure_filename(img.filename)
            path = str(job_folder / filename)
            img.save(path)
            saved_images[img.filename] = path

    # Ordenar imágenes según el orden especificado
    for name in image_order:
        if name in saved_images:
            image_paths.append(saved_images[name])

    # Si no hay orden, usar el orden de carga
    if not image_paths:
        image_paths = list(saved_images.values())

    # Guardar audio
    audio = request.files.get('audio')
    audio_path = None
    if audio and audio.filename:
        filename = secure_filename(audio.filename)
        audio_path = str(job_folder / filename)
        audio.save(audio_path)

    # Guardar subtítulos
    srt = request.files.get('srt')
    srt_path = None
    if srt and srt.filename:
        filename = secure_filename(srt.filename)
        srt_path = str(job_folder / filename)
        srt.save(srt_path)

    # Obtener configuración de video
    resolution_str = request.form.get('resolution', '1080x1920')
    width, height = map(int, resolution_str.split('x'))
    transition_type = request.form.get('transition_type', 'crossfade')
    transition = float(request.form.get('transition', 0.5))
    fps = int(request.form.get('fps', 4))

    # Obtener configuración de subtítulos
    subtitle_font = request.form.get('subtitle_font', 'DejaVuSans-Bold')
    subtitle_size = int(request.form.get('subtitle_size', 75))
    subtitle_color = request.form.get('subtitle_color', '#ffffff')
    subtitle_stroke_color = request.form.get('subtitle_stroke_color', '#000000')
    subtitle_stroke_width = int(request.form.get('subtitle_stroke_width', 2))
    subtitle_typewriter = request.form.get('subtitle_typewriter', 'true').lower() == 'true'
    subtitle_position = request.form.get('subtitle_position', 'center')

    subtitle_config = {
        'font_path': FONTS.get(subtitle_font, FONTS['DejaVuSans-Bold']),
        'font_size': subtitle_size,
        'font_color': subtitle_color,
        'stroke_color': subtitle_stroke_color,
        'stroke_width': subtitle_stroke_width,
        'typewriter_enabled': subtitle_typewriter,
        'position': subtitle_position,
    }

    # Obtener configuración de intro
    intro_text = request.form.get('intro_text', '').strip()
    intro_config = None
    if intro_text:
        intro_font = request.form.get('intro_font', 'DejaVuSans-Bold')
        intro_config = {
            'text': intro_text,
            'duration': float(request.form.get('intro_duration', 5)),
            'font_path': FONTS.get(intro_font, FONTS['DejaVuSans-Bold']),
            'font_size': int(request.form.get('intro_size', 80)),
            'font_color': request.form.get('intro_color', '#ffffff'),
            'bg_color': request.form.get('intro_bg_color', '#000000'),
            'bg_image': None,
            'animation_in': request.form.get('intro_animation_in', 'none'),
            'animation_out': request.form.get('intro_animation_out', 'none'),
        }
        # Guardar imagen de fondo de intro si existe
        intro_bg_image = request.files.get('intro_bg_image')
        if intro_bg_image and intro_bg_image.filename:
            filename = secure_filename(intro_bg_image.filename)
            intro_bg_path = str(job_folder / f'intro_bg_{filename}')
            intro_bg_image.save(intro_bg_path)
            intro_config['bg_image'] = intro_bg_path

    # Obtener configuración de outro
    outro_text = request.form.get('outro_text', '').strip()
    outro_config = None
    if outro_text:
        outro_font = request.form.get('outro_font', 'DejaVuSans-Bold')
        outro_config = {
            'text': outro_text,
            'duration': float(request.form.get('outro_duration', 5)),
            'font_path': FONTS.get(outro_font, FONTS['DejaVuSans-Bold']),
            'font_size': int(request.form.get('outro_size', 80)),
            'font_color': request.form.get('outro_color', '#ffffff'),
            'bg_color': request.form.get('outro_bg_color', '#000000'),
            'bg_image': None,
            'animation_in': request.form.get('outro_animation_in', 'none'),
            'animation_out': request.form.get('outro_animation_out', 'none'),
        }
        # Guardar imagen de fondo de outro si existe
        outro_bg_image = request.files.get('outro_bg_image')
        if outro_bg_image and outro_bg_image.filename:
            filename = secure_filename(outro_bg_image.filename)
            outro_bg_path = str(job_folder / f'outro_bg_{filename}')
            outro_bg_image.save(outro_bg_path)
            outro_config['bg_image'] = outro_bg_path

    if not image_paths or not audio_path:
        return jsonify({'error': 'Se requieren imágenes y audio'}), 400

    # Crear evento de cancelación para este trabajo
    cancel_event = threading.Event()
    cancel_events[job_id] = cancel_event

    # Inicializar job
    jobs[job_id] = {
        'status': 'queued',
        'progress': 0,
        'message': 'En cola...',
        'output_file': None,
    }

    # Iniciar procesamiento en hilo separado
    thread = threading.Thread(
        target=process_video,
        args=(job_id, image_paths, audio_path, srt_path, (width, height), transition_type, transition, fps, subtitle_config, intro_config, outro_config, cancel_event)
    )
    thread.start()

    return jsonify({'job_id': job_id})


@app.route('/api/progress/<job_id>')
def get_progress(job_id):
    """Obtiene el progreso de un trabajo (SSE)."""
    def generate():
        while True:
            if job_id in jobs:
                job = jobs[job_id]
                data = {
                    'status': job['status'],
                    'progress': job['progress'],
                    'message': job['message'],
                }
                # Incluir información detallada de renderizado si está disponible
                if 'render_info' in job:
                    data['render_info'] = job['render_info']
                yield f"data: {json.dumps(data)}\n\n"

                if job['status'] in ['completed', 'error', 'cancelled']:
                    break
            else:
                yield f"data: {json.dumps({'status': 'not_found', 'progress': 0, 'message': 'Trabajo no encontrado'})}\n\n"
                break

            import time
            time.sleep(0.5)

    return Response(generate(), mimetype='text/event-stream')


@app.route('/api/status/<job_id>')
def get_status(job_id):
    """Obtiene el estado de un trabajo."""
    if job_id not in jobs:
        return jsonify({'error': 'Trabajo no encontrado'}), 404

    job = jobs[job_id]
    return jsonify({
        'status': job['status'],
        'progress': job['progress'],
        'message': job['message'],
    })


@app.route('/api/cancel/<job_id>', methods=['POST'])
def cancel_job(job_id):
    """Cancela un trabajo en proceso."""
    if job_id not in jobs:
        return jsonify({'error': 'Trabajo no encontrado'}), 404

    job = jobs[job_id]

    # Solo se puede cancelar si está en proceso o en cola
    if job['status'] not in ['processing', 'queued']:
        return jsonify({'error': 'El trabajo no se puede cancelar', 'status': job['status']}), 400

    # Activar el evento de cancelación
    if job_id in cancel_events:
        cancel_events[job_id].set()
        jobs[job_id]['message'] = 'Cancelando...'
        return jsonify({'success': True, 'message': 'Cancelación solicitada'})
    else:
        return jsonify({'error': 'No se encontró el evento de cancelación'}), 500


@app.route('/api/download/<job_id>')
def download_video(job_id):
    """Descarga el video generado."""
    if job_id not in jobs:
        return jsonify({'error': 'Trabajo no encontrado'}), 404

    job = jobs[job_id]
    if job['status'] != 'completed' or not job['output_file']:
        return jsonify({'error': 'Video no disponible'}), 400

    return send_file(
        job['output_file'],
        as_attachment=True,
        download_name='video_generado.mp4',
        mimetype='video/mp4'
    )


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80, debug=False, threaded=True)
