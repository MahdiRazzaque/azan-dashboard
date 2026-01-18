# Product Requirements Document: Docker Containerisation

## 1. Title
Docker Containerisation & Single-Command Deployment

## 2. Introduction
This document outlines the requirements for containerising the Azan Dashboard application. The goal is to package the Node.js Backend, React Frontend, and Python Microservice into a single, portable Docker image. This ensures consistent execution across different environments (specifically Linux hosts) and simplifies the deployment process to a single command.

## 3. Product Overview
The solution involves a **Monolithic Container Architecture**. Instead of orchestrating multiple containers (e.g., one for Node, one for Python), all services will run within a single container instance. This approach simplifies the architecture for the specific use case of a home automation dashboard, particularly regarding local audio hardware access (`/dev/snd`), which is significantly harder to share across multiple isolated containers.

## 4. Goals and Objectives
*   **Simplicity:** Enable users to start the entire stack (Frontend, Backend, TTS Service) with one command (`docker-compose up`).
*   **Portability:** Eliminate "it works on my machine" issues by bundling dependencies (Python, `mpg123`, Node modules) into the image.
*   **Persistence:** Ensure user configuration, cached prayer data, and uploaded audio files survive container updates or recreations.
*   **Hardware Access:** Enable the container to play audio directly on the host's speakers (Linux only).

## 5. Target Audience
*   **Home Lab Users:** Deploying on Raspberry Pi or Linux Home Servers.
*   **Mosque Administrators:** Deploying on dedicated digital signage hardware.

## 6. Features and Requirements

### 6.1 Container Architecture
*   **FR-01: Single Container Strategy**
    *   The Docker image MUST contain runtime environments for both **Node.js (v18+)** and **Python (v3+)**.
    *   It MUST install system-level dependencies required for audio playback (`mpg123`, `alsa-utils`) and process management (`supervisor`).
*   **FR-02: Multi-Stage Build**
    *   The Dockerfile MUST use a multi-stage build process.
    *   **Stage 1 (Builder):** Build the React Frontend assets (`npm run build`).
    *   **Stage 2 (Runtime):** Copy the built assets to the final image to keep the image size optimized.

### 6.2 Process Management
*   **FR-03: Process Orchestration (`supervisord`)**
    *   The container MUST use `supervisord` as the entry point.
    *   It MUST manage two concurrent processes:
        1.  **Node.js Server:** `node src/server.js` (Port 3000).
        2.  **Python Microservice:** `uvicorn ...` (Port 8000).
    *   If either process crashes, `supervisord` MUST attempt to restart it.
    *   Logs from both processes MUST be redirected to `stdout`/`stderr` for Docker logging visibility.

### 6.3 Data Persistence
*   **FR-04: Volume Mappings**
    *   The solution MUST define Docker Volumes for mutable data to ensure persistence:
        *   `/app/config/local.json`: User settings overrides.
        *   `/app/data`: Prayer time cache (`cache.json`).
        *   `/app/public/audio`: Uploaded MP3s and generated TTS files.
        *   `/app/.env`: Secrets file (Admin Password/JWT).

### 6.4 Hardware Integration
*   **FR-05: Audio Device Mapping**
    *   The `docker-compose.yml` MUST map the host audio device (`/dev/snd`) to the container to allow the "Local" audio target to function.

## 7. Technical Implementation

### 7.1 `supervisord.conf`
This configuration controls the internal processes.

```ini
[supervisord]
nodaemon=true
logfile=/dev/stdout
logfile_maxbytes=0

[program:node-backend]
command=node src/server.js
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:python-tts]
command=uvicorn src.microservices.tts.server:app --host 0.0.0.0 --port 8000
directory=/app
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

### 7.2 `Dockerfile`
Defines the environment construction.

```dockerfile
# --- Stage 1: Build Frontend ---
FROM node:18-bullseye-slim AS frontend-builder

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
FROM node:18-bullseye-slim

# Install Python 3, pip, mpg123 (for local audio), and supervisor
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
# --break-system-packages is required on newer Debian versions to install pip packages globally
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
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set Environment Variables
ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHON_SERVICE_URL=http://localhost:8000

# Expose the Node.js port
EXPOSE 3000

# Start Supervisor (which starts Node and Python)
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

### 7.3 `docker-compose.yml`
Orchestrates the run command and volumes.

```yaml
version: '3.8'

services:
  azan-dashboard:
    build: .
    container_name: azan-dashboard
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      # Persist configuration
      - ./config/local.json:/app/config/local.json
      # Persist application data/cache
      - ./data:/app/data
      # Persist uploaded and generated audio
      - ./public/audio/custom:/app/public/audio/custom
      - ./public/audio/cache:/app/public/audio/cache
      # Pass .env file (must be created on host first)
      - ./.env:/app/.env
    devices:
      # Required for 'Local' audio target (Linux Hosts Only)
      - /dev/snd:/dev/snd
    environment:
      - TZ=UTC # Default timezone, application handles offsets internally
```

## 8. Deployment Instructions

1.  **File Creation:** Save the three files above (`supervisord.conf`, `Dockerfile`, `docker-compose.yml`) in the project root.
2.  **Pre-requisite Files:** The host MUST prepare the persistent files before running the container to prevent Docker from creating them as directories owned by root.
    ```bash
    # Create empty config override
    touch config/local.json
    
    # Create .env from example and ensure it is writable
    cp .env.example .env
    chmod 666 .env
    ```
    *Note: Write permission on `.env` is critical because the application writes the Admin Password hash to this file during the Setup Wizard.*
3.  **Run Command:**
    ```bash
    docker-compose up --build -d
    ```

## 9. Open Questions / Assumptions
*   **Assumption:** The host system (Linux) uses ALSA for audio. If PulseAudio is in use (e.g., Desktop Linux), `mpg123` might fight for control of the device. Stopping PulseAudio or using `pasuspender` might be required on desktop environments.
*   **Assumption:** The base image `node:18-bullseye-slim` supports the target architecture (amd64/arm64) automatically.