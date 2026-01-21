# --- Stage 1: Build Frontend ---
# Updated to Node 22 (Bookworm) to match local environment
FROM node:22-bookworm-slim AS frontend-builder

WORKDIR /app
COPY client/package*.json ./client/
# Install dependencies for client
WORKDIR /app/client
RUN npm ci

# Copy client source and build
WORKDIR /app
COPY client/ ./client/
WORKDIR /app/client
RUN npm run build

# --- Stage 2: Runtime Environment ---
# Updated to Node 22 (Bookworm) which includes Python 3.11+
FROM node:22-bookworm-slim

# Install Python 3, pip, mpg123, alsa-utils, and supervisor
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    mpg123 \
    alsa-utils \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Backend Dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy Python Dependencies
COPY src/microservices/tts/requirements.txt ./src/microservices/tts/

# Install Python packages globally in the container
# Added --break-system-packages because Debian 12 implements PEP 668
RUN pip3 install --no-cache-dir --break-system-packages -r src/microservices/tts/requirements.txt

# Copy Built Frontend from Stage 1
COPY --from=frontend-builder /app/client/dist ./client/dist

# Copy Source Code
COPY src/ ./src/
COPY public/ ./public/
COPY .env.example ./.env

# Create data/config directories for volume mapping
RUN mkdir -p data config public/audio/custom public/audio/cache

# Copy Supervisor Configuration
COPY .config/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set Environment Variables
ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHON_SERVICE_URL=http://localhost:8000
ENV ENV_FILE_PATH=/app/config/.env
ENV LOCAL_CONFIG_PATH=/app/config/local.json

# Expose the Node.js port
EXPOSE 3000

# Start Supervisor (which starts Node and Python)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]