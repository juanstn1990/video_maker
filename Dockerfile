FROM node:20-bookworm-slim

# Install Chromium (used by Remotion renderer) and basic fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ffmpeg \
    fonts-freefont-ttf \
    fonts-dejavu-core \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Tell Remotion/puppeteer to use system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app

# ── Frontend: install deps and build static assets ──────────────────────────
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# ── Backend: install deps ────────────────────────────────────────────────────
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

COPY backend/ ./backend/

EXPOSE 3001

WORKDIR /app/backend
CMD ["node_modules/.bin/tsx", "src/index.ts"]
