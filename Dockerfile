# Dockerfile para Creador de Videos
FROM python:3.11-slim

# Instalar dependencias del sistema y fuentes basicas
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1 \
    fonts-dejavu-core \
    fonts-dejavu-extra \
    fonts-liberation \
    fonts-freefont-ttf \
    fontconfig \
    imagemagick \
    curl \
    unzip \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Descargar fuentes desde Google Fonts GitHub
RUN mkdir -p /usr/share/fonts/truetype/google/roboto \
             /usr/share/fonts/truetype/google/opensans \
             /usr/share/fonts/truetype/google/lato \
             /usr/share/fonts/truetype/google/montserrat \
             /usr/share/fonts/truetype/google/poppins \
             /usr/share/fonts/truetype/google/oswald \
             /usr/share/fonts/truetype/google/playfair \
             /usr/share/fonts/truetype/google/bebas \
             /usr/share/fonts/truetype/google/firacode \
             /usr/share/fonts/truetype/google/ubuntu \
             /usr/share/fonts/truetype/google/noto

# Roboto
RUN curl -L -o /tmp/roboto.zip "https://github.com/googlefonts/roboto/releases/download/v2.138/roboto-unhinted.zip" && \
    unzip -o /tmp/roboto.zip -d /tmp/roboto && \
    cp /tmp/roboto/*.ttf /usr/share/fonts/truetype/google/roboto/ 2>/dev/null || true && \
    rm -rf /tmp/roboto /tmp/roboto.zip

# Open Sans
RUN curl -L -o /tmp/opensans.zip "https://github.com/googlefonts/opensans/releases/download/v1.10/open-sans-v1.10.zip" && \
    unzip -o /tmp/opensans.zip -d /tmp/opensans && \
    find /tmp/opensans -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/google/opensans/ \; 2>/dev/null || true && \
    rm -rf /tmp/opensans /tmp/opensans.zip

# Lato
RUN curl -L -o /tmp/lato.zip "https://github.com/latofonts/lato-source/releases/download/v2.015/Lato2OFL.zip" && \
    unzip -o /tmp/lato.zip -d /tmp/lato && \
    find /tmp/lato -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/google/lato/ \; 2>/dev/null || true && \
    rm -rf /tmp/lato /tmp/lato.zip

# Montserrat
RUN curl -L -o /tmp/montserrat.zip "https://github.com/JulietaUla/Montserrat/archive/refs/heads/master.zip" && \
    unzip -o /tmp/montserrat.zip -d /tmp/montserrat && \
    find /tmp/montserrat -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/google/montserrat/ \; 2>/dev/null || true && \
    rm -rf /tmp/montserrat /tmp/montserrat.zip

# Poppins (static fonts from Google Fonts)
RUN curl -L -o /tmp/poppins.zip "https://fonts.google.com/download?family=Poppins" && \
    unzip -o /tmp/poppins.zip -d /tmp/poppins && \
    find /tmp/poppins -name "*.ttf" ! -name "*Italic*" -exec cp {} /usr/share/fonts/truetype/google/poppins/ \; 2>/dev/null || true && \
    rm -rf /tmp/poppins /tmp/poppins.zip

# Oswald
RUN curl -L -o /tmp/oswald.zip "https://github.com/googlefonts/OswaldFont/archive/refs/heads/main.zip" && \
    unzip -o /tmp/oswald.zip -d /tmp/oswald && \
    find /tmp/oswald -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/google/oswald/ \; 2>/dev/null || true && \
    rm -rf /tmp/oswald /tmp/oswald.zip

# Bebas Neue
RUN curl -L -o /tmp/bebas.zip "https://github.com/dharmatype/Bebas-Neue/archive/refs/heads/master.zip" && \
    unzip -o /tmp/bebas.zip -d /tmp/bebas && \
    find /tmp/bebas -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/google/bebas/ \; 2>/dev/null || true && \
    rm -rf /tmp/bebas /tmp/bebas.zip

# Fira Code
RUN curl -L -o /tmp/firacode.zip "https://github.com/tonsky/FiraCode/releases/download/6.2/Fira_Code_v6.2.zip" && \
    unzip -o /tmp/firacode.zip -d /tmp/firacode && \
    find /tmp/firacode -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/google/firacode/ \; 2>/dev/null || true && \
    rm -rf /tmp/firacode /tmp/firacode.zip

# Playfair Display
RUN curl -L -o /tmp/playfair.zip "https://github.com/clauseggers/Playfair-Display/archive/refs/heads/master.zip" && \
    unzip -o /tmp/playfair.zip -d /tmp/playfair && \
    find /tmp/playfair -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/google/playfair/ \; 2>/dev/null || true && \
    rm -rf /tmp/playfair /tmp/playfair.zip

# Ubuntu Font
RUN curl -L -o /tmp/ubuntu.zip "https://assets.ubuntu.com/v1/0cef8205-ubuntu-font-family-0.83.zip" && \
    unzip -o /tmp/ubuntu.zip -d /tmp/ubuntu && \
    find /tmp/ubuntu -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/google/ubuntu/ \; 2>/dev/null || true && \
    rm -rf /tmp/ubuntu /tmp/ubuntu.zip

# Noto Sans
RUN curl -L -o /tmp/noto.zip "https://github.com/notofonts/latin-greek-cyrillic/releases/download/NotoSans-v2.013/NotoSans-v2.013.zip" && \
    unzip -o /tmp/noto.zip -d /tmp/noto && \
    find /tmp/noto -name "*.ttf" -exec cp {} /usr/share/fonts/truetype/google/noto/ \; 2>/dev/null || true && \
    rm -rf /tmp/noto /tmp/noto.zip

# Actualizar cache de fuentes
RUN fc-cache -f -v

# Configurar ImageMagick policy para permitir operaciones de texto
RUN sed -i 's/rights="none" pattern="@\*"/rights="read|write" pattern="@*"/' /etc/ImageMagick-6/policy.xml || true

# Crear directorio de trabajo
WORKDIR /app

# Copiar requirements e instalar dependencias de Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el codigo de la aplicacion
COPY app.py .
COPY templates/ templates/
COPY static/ static/

# Crear directorio para archivos temporales
RUN mkdir -p /tmp/video_creator

# Exponer puerto
EXPOSE 80

# Variables de entorno
ENV FLASK_APP=app.py
ENV PYTHONUNBUFFERED=1

# Comando para ejecutar la aplicacion
CMD ["python", "app.py"]
