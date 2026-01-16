#!/usr/bin/env python3
"""
Script para crear videos a partir de imágenes y música.
Las imágenes se distribuyen equitativamente a lo largo de la duración de la canción.
"""

import os
import sys
from pathlib import Path
import re
from moviepy import (
    ImageClip,
    AudioFileClip,
    CompositeVideoClip,
    concatenate_videoclips,
    TextClip,
)
from moviepy.video.fx import CrossFadeIn, CrossFadeOut


def get_images(folder: str) -> list[str]:
    """Obtiene todas las imágenes de una carpeta ordenadas alfabéticamente."""
    extensions = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"}
    images = []

    for file in sorted(Path(folder).iterdir()):
        if file.suffix.lower() in extensions:
            images.append(str(file))

    return images


def get_subtitle_file(folder: str) -> str | None:
    """Busca el primer archivo .srt en una carpeta."""
    extensions = {".srt"}

    folder_path = Path(folder)
    if not folder_path.exists():
        return None

    for file in sorted(folder_path.iterdir()):
        if file.suffix.lower() in extensions:
            return str(file)

    return None


def parse_srt(srt_path: str) -> list[dict]:
    """
    Parsea un archivo de subtítulos .srt

    Retorna una lista de diccionarios con:
    - start: tiempo de inicio en segundos
    - end: tiempo de fin en segundos
    - text: texto del subtítulo
    """
    subtitles = []

    with open(srt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Patrón para parsear bloques de subtítulos
    pattern = r'(\d+)\s*\n(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*\n(.*?)(?=\n\n|\n*$)'

    matches = re.findall(pattern, content, re.DOTALL)

    for match in matches:
        # Convertir tiempos a segundos
        start_h, start_m, start_s, start_ms = int(match[1]), int(match[2]), int(match[3]), int(match[4])
        end_h, end_m, end_s, end_ms = int(match[5]), int(match[6]), int(match[7]), int(match[8])

        start_time = start_h * 3600 + start_m * 60 + start_s + start_ms / 1000
        end_time = end_h * 3600 + end_m * 60 + end_s + end_ms / 1000

        # Limpiar texto (remover tags HTML si existen)
        text = re.sub(r'<[^>]+>', '', match[9].strip())
        text = text.replace('\n', ' ')

        subtitles.append({
            'start': start_time,
            'end': end_time,
            'text': text
        })

    return subtitles


def wrap_text(text: str, font_size: int, width: int) -> str:
    """
    Envuelve el texto para que quepan palabras completas sin partir.
    Esto previene que las palabras se corten a mitad.
    
    Args:
        text: Texto a envolver
        font_size: Tamaño de fuente en píxeles
        width: Ancho disponible en píxeles
    
    Returns:
        Texto con saltos de línea (\n) para envolver adecuadamente
    """
    words = text.split()
    lines = []
    current_line = []
    
    # Estimación aproximada: cada carácter ocupa ~0.6 * font_size píxeles
    # Esto es una aproximación, pero funciona bien para la mayoría de fuentes
    chars_per_line = max(1, int(width / (font_size * 0.55)))
    
    for word in words:
        current_line.append(word)
        current_line_text = ' '.join(current_line)
        
        # Si la línea es demasiado larga, mover la palabra a la siguiente línea
        if len(current_line_text) > chars_per_line:
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
    typewriter_ratio: float = 0.7,
) -> list:
    """
    Crea clips de texto para cada subtítulo con efecto typewriter.

    Args:
        typewriter_ratio: Proporción del tiempo usado para el efecto typewriter (0.7 = 70%)
    """
    subtitle_clips = []

    for sub in subtitles:
        duration = sub['end'] - sub['start']
        text = sub['text']

        if not text:
            continue

        # Pre-envolver el texto para evitar que se corten las palabras
        wrapped_text = wrap_text(text, font_size, resolution[0] - 80)

        # Tiempo para el efecto typewriter y tiempo que el texto permanece completo
        typewriter_duration = duration * typewriter_ratio
        hold_duration = duration * (1 - typewriter_ratio)

        # Tiempo por cada letra (usando el texto envuelto para contabilizar saltos)
        time_per_char = typewriter_duration / len(text)

        # Crear un clip para cada etapa del texto (letra por letra)
        for i in range(1, len(text) + 1):
            partial_text = text[:i]
            # Envolver el texto parcial también para mantener consistencia
            wrapped_partial = wrap_text(partial_text, font_size, resolution[0] - 80)

            # Calcular duración de este clip
            if i < len(text):
                clip_duration = time_per_char
            else:
                # El último clip (texto completo) dura más tiempo
                clip_duration = time_per_char + hold_duration

            txt_clip = TextClip(
                text=wrapped_partial,
                font_size=font_size,
                color=font_color,
                stroke_color=stroke_color,
                stroke_width=stroke_width,
                font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
                method='caption',
                size=(resolution[0] - 80, None),
                text_align='center',
            )

            txt_clip = txt_clip.with_duration(clip_duration)
            start_time = sub['start'] + (i - 1) * time_per_char
            txt_clip = txt_clip.with_start(start_time)
            # Posicionar en la parte inferior con margen (más arriba)
            txt_clip = txt_clip.with_position(('center', resolution[1] - 250))

            subtitle_clips.append(txt_clip)

    return subtitle_clips


def create_video(
    images_folder: str,
    audio_path: str,
    output_path: str = "output.mp4",
    transition_duration: float = 0.5,
    resolution: tuple[int, int] = (1080, 1920),
    fps: int = 24,
    subtitles_path: str = None,
):
    """
    Crea un video a partir de imágenes y audio.

    Args:
        images_folder: Carpeta con las imágenes
        audio_path: Ruta al archivo de audio
        output_path: Ruta del video de salida
        transition_duration: Duración de las transiciones en segundos
        resolution: Resolución del video (ancho, alto)
        fps: Frames por segundo
        subtitles_path: Ruta al archivo de subtítulos .srt (opcional)
    """
    # Obtener imágenes
    images = get_images(images_folder)

    if not images:
        print(f"No se encontraron imágenes en: {images_folder}")
        sys.exit(1)

    print(f"Encontradas {len(images)} imágenes")

    # Cargar audio y obtener duración
    audio = AudioFileClip(audio_path)
    total_duration = audio.duration
    print(f"Duración del audio: {total_duration:.2f} segundos")

    # Calcular duración por imagen
    duration_per_image = total_duration / len(images)
    print(f"Duración por imagen: {duration_per_image:.2f} segundos")

    # Crear clips de imágenes
    clips = []

    for i, image_path in enumerate(images):
        print(f"Procesando imagen {i + 1}/{len(images)}: {Path(image_path).name}")

        # Crear clip de imagen
        clip = ImageClip(image_path, duration=duration_per_image)

        # Calcular escalado para cubrir toda la pantalla (modo "cover")
        # La imagen se escala para llenar completamente el área, recortando si es necesario
        img_ratio = clip.w / clip.h
        target_ratio = resolution[0] / resolution[1]

        if img_ratio > target_ratio:
            # Imagen más ancha: escalar por altura, recortar lados
            clip = clip.resized(height=resolution[1])
        else:
            # Imagen más alta: escalar por ancho, recortar arriba/abajo
            clip = clip.resized(width=resolution[0])

        # Centrar la imagen (el exceso se recortará automáticamente por el CompositeVideoClip)
        clip = clip.with_position(("center", "center"))

        # Aplicar transiciones de fade
        if transition_duration > 0 and duration_per_image > transition_duration * 2:
            clip = clip.with_effects([
                CrossFadeIn(transition_duration),
                CrossFadeOut(transition_duration),
            ])

        clips.append(clip)

    # Concatenar clips con crossfade
    print("Concatenando clips...")
    if transition_duration > 0:
        # Usar composición para transiciones suaves
        final_clips = []
        current_time = 0

        for i, clip in enumerate(clips):
            clip = clip.with_start(current_time)
            final_clips.append(clip)
            # Siguiente clip empieza antes para overlap de transición
            current_time += duration_per_image - transition_duration

        # Crear video compuesto
        video = CompositeVideoClip(final_clips, size=resolution)
        video = video.with_duration(total_duration)
    else:
        video = concatenate_videoclips(clips, method="compose")

    # Agregar subtítulos si se proporcionan
    if subtitles_path:
        # Si es una carpeta, buscar archivo .srt dentro
        if Path(subtitles_path).is_dir():
            srt_file = get_subtitle_file(subtitles_path)
            if not srt_file:
                print(f"No se encontraron archivos .srt en: {subtitles_path}")
            else:
                subtitles_path = srt_file

        if subtitles_path and Path(subtitles_path).is_file():
            print(f"Cargando subtítulos desde: {subtitles_path}")
            subtitles = parse_srt(subtitles_path)
            print(f"Encontrados {len(subtitles)} subtítulos")

            if subtitles:
                subtitle_clips = create_subtitle_clips(subtitles, resolution)
                video = CompositeVideoClip([video] + subtitle_clips, size=resolution)
                video = video.with_duration(total_duration)

    # Agregar audio
    video = video.with_audio(audio)

    # Exportar
    print(f"Exportando video a: {output_path}")
    video.write_videofile(
        output_path,
        fps=fps,
        codec="libx264",
        audio_codec="aac",
        threads=4,
        preset="medium",
    )

    # Limpiar
    audio.close()
    for clip in clips:
        clip.close()
    video.close()

    print(f"Video creado exitosamente: {output_path}")


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Crea un video a partir de imágenes y música"
    )
    parser.add_argument(
        "-i", "--images",
        required=True,
        help="Carpeta con las imágenes"
    )
    parser.add_argument(
        "-a", "--audio",
        required=True,
        help="Archivo de audio (mp3, wav, etc.)"
    )
    parser.add_argument(
        "-o", "--output",
        default="output.mp4",
        help="Archivo de salida (default: output.mp4)"
    )
    parser.add_argument(
        "-t", "--transition",
        type=float,
        default=0.5,
        help="Duración de transiciones en segundos (default: 0.5)"
    )
    parser.add_argument(
        "-r", "--resolution",
        default="1080x1920",
        help="Resolución del video (default: 1080x1920 vertical)"
    )
    parser.add_argument(
        "-f", "--fps",
        type=int,
        default=24,
        help="Frames por segundo (default: 24)"
    )
    parser.add_argument(
        "-s", "--subtitles",
        default=None,
        help="Carpeta o archivo de subtítulos .srt (opcional)"
    )

    args = parser.parse_args()

    # Parsear resolución
    width, height = map(int, args.resolution.split("x"))

    create_video(
        images_folder=args.images,
        audio_path=args.audio,
        output_path=args.output,
        transition_duration=args.transition,
        resolution=(width, height),
        fps=args.fps,
        subtitles_path=args.subtitles,
    )


if __name__ == "__main__":
    main()
