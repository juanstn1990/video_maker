#!/usr/bin/env python3
"""
Aplicación web para crear videos a partir de imágenes y audio.
"""

import os
import sys
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

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Configuración
UPLOAD_FOLDER = Path('/tmp/video_creator')
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
app.config['UPLOAD_FOLDER'] = str(UPLOAD_FOLDER)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB máximo

# Almacén de progreso de trabajos
jobs = {}

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

    # Cargar la fuente para calcular anchos reales
    try:
        font = ImageFont.truetype(font_path, font_size)
    except Exception:
        # Fallback a estimación si no se puede cargar la fuente
        font = None

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
) -> list:
    """Crea clips de texto para cada subtítulo con efecto typewriter."""
    subtitle_clips = []

    for sub in subtitles:
        duration = sub['end'] - sub['start']
        text = sub['text']

        if not text:
            continue

        typewriter_duration = duration * typewriter_ratio
        hold_duration = duration * (1 - typewriter_ratio)
        time_per_char = typewriter_duration / len(text)

        for i in range(1, len(text) + 1):
            partial_text = text[:i]
            # Envolver el texto parcial para evitar que se corten palabras
            wrapped_partial = wrap_text(partial_text, font_size, resolution[0] - 80, font_path)

            if i < len(text):
                clip_duration = time_per_char
            else:
                clip_duration = time_per_char + hold_duration

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
                margin=(stroke_width + 5, stroke_width + 5),
            )

            txt_clip = txt_clip.with_duration(clip_duration)
            start_time = sub['start'] + (i - 1) * time_per_char
            txt_clip = txt_clip.with_start(start_time)
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
        margin=(10, 10),
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
            margin=(10, 10),
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
                  transition_duration: float = 0.5, fps: int = 24, subtitle_config: dict = None,
                  intro_config: dict = None, outro_config: dict = None):
    """Procesa el video en un hilo separado."""
    try:
        jobs[job_id]['status'] = 'processing'
        jobs[job_id]['progress'] = 0
        jobs[job_id]['message'] = 'Iniciando procesamiento...'

        output_path = str(UPLOAD_FOLDER / f'{job_id}_output.mp4')

        # Cargar audio
        jobs[job_id]['message'] = 'Cargando audio...'
        jobs[job_id]['progress'] = 5
        audio = AudioFileClip(audio_path)
        total_duration = audio.duration

        duration_per_image = total_duration / len(images)

        # Obtener efectos de transición
        effects, needs_overlap = get_transition_effects(transition_type, transition_duration, resolution)

        # Crear clips de imágenes
        clips = []
        for i, image_path in enumerate(images):
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
                )
                video = CompositeVideoClip([video] + subtitle_clips, size=resolution)
                video = video.with_duration(total_duration)

        # Agregar audio al video principal
        jobs[job_id]['message'] = 'Agregando audio...'
        jobs[job_id]['progress'] = 75
        video = video.with_audio(audio)

        # Crear clips de intro y outro si están configurados
        clips_to_concat = []

        if intro_config:
            jobs[job_id]['message'] = 'Creando intro...'
            jobs[job_id]['progress'] = 77
            intro_clip = create_title_clip(intro_config, resolution)
            clips_to_concat.append(intro_clip)

        clips_to_concat.append(video)

        if outro_config:
            jobs[job_id]['message'] = 'Creando outro...'
            jobs[job_id]['progress'] = 78
            outro_clip = create_title_clip(outro_config, resolution)
            clips_to_concat.append(outro_clip)

        # Concatenar intro + video + outro si es necesario
        if len(clips_to_concat) > 1:
            jobs[job_id]['message'] = 'Concatenando intro/outro...'
            jobs[job_id]['progress'] = 79
            video = concatenate_videoclips(clips_to_concat, method="compose")

        # Exportar
        jobs[job_id]['message'] = 'Exportando video...'
        jobs[job_id]['progress'] = 80

        video.write_videofile(
            output_path,
            fps=fps,
            codec="libx264",
            audio_codec="aac",
            threads=4,
            preset="medium",
            logger=None,
        )

        # Limpiar
        audio.close()
        for clip in clips:
            clip.close()
        video.close()

        jobs[job_id]['status'] = 'completed'
        jobs[job_id]['progress'] = 100
        jobs[job_id]['message'] = 'Video creado exitosamente!'
        jobs[job_id]['output_file'] = output_path

    except Exception as e:
        jobs[job_id]['status'] = 'error'
        jobs[job_id]['message'] = f'Error: {str(e)}'
        jobs[job_id]['progress'] = 0


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
    fps = int(request.form.get('fps', 24))

    # Obtener configuración de subtítulos
    subtitle_font = request.form.get('subtitle_font', 'DejaVuSans-Bold')
    subtitle_size = int(request.form.get('subtitle_size', 75))
    subtitle_color = request.form.get('subtitle_color', '#ffffff')
    subtitle_stroke_color = request.form.get('subtitle_stroke_color', '#000000')
    subtitle_stroke_width = int(request.form.get('subtitle_stroke_width', 2))

    subtitle_config = {
        'font_path': FONTS.get(subtitle_font, FONTS['DejaVuSans-Bold']),
        'font_size': subtitle_size,
        'font_color': subtitle_color,
        'stroke_color': subtitle_stroke_color,
        'stroke_width': subtitle_stroke_width,
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
        args=(job_id, image_paths, audio_path, srt_path, (width, height), transition_type, transition, fps, subtitle_config, intro_config, outro_config)
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
                yield f"data: {json.dumps(data)}\n\n"

                if job['status'] in ['completed', 'error']:
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
