# Docker Deployment

Multi-stage build, single container running Node.js backend + Python TTS via supervisord.

## FILES

| File                       | Role                                         |
| -------------------------- | -------------------------------------------- |
| `Dockerfile`               | Multi-stage build (frontend build → runtime) |
| `docker-compose.yml`       | Standard deployment config                   |
| `docker-compose.audio.yml` | Overlay for Linux ALSA audio passthrough     |

## DOCKERFILE STAGES

### Stage 1: Frontend Build

```
Node 22-slim → npm ci → npm run build → produces client/dist/
```

### Stage 2: Runtime

```
Node 22-slim + Python 3 + pip + mpg123 + alsa-utils + supervisor
→ npm ci --omit=dev (backend only)
→ pip3 install --break-system-packages (TTS deps)
→ Copy built frontend from stage 1
→ Copy source code
→ Create data dirs (data/, public/audio/cache, temp, custom)
→ ENV: NODE_ENV=production
→ EXPOSE: 3000 (Node), 8000 (TTS)
→ CMD: supervisord
```

## DOCKER COMPOSE

### Standard (`docker-compose.yml`)

```yaml
services:
  azan-dashboard:
    build: .
    ports: ["${APP_PORT}:3000"]
    volumes:
      - config:/app/src/config # Persists local.json
      - data:/app/data # Persists prayer cache
      - custom-audio:/app/public/audio/custom # User-uploaded audio
      - cache-audio:/app/public/audio/cache # Generated TTS audio
    environment:
      - TZ=UTC
```

### Audio Overlay (`docker-compose.audio.yml`)

Adds `/dev/snd:/dev/snd` device passthrough for Linux ALSA audio output. Usage:

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.audio.yml up -d
```

## SUPERVISORD

Config in `.config/supervisord.conf`. Manages two processes:

| Process | Command                                         | Port |
| ------- | ----------------------------------------------- | ---- |
| `node`  | `node src/server.js`                            | 3000 |
| `tts`   | `uvicorn server:app --host 0.0.0.0 --port 8000` | 8000 |

Both auto-restart on failure. Logs to stdout/stderr (Docker captures).

## CONVENTIONS

- **Single container, two processes** — Supervisord manages Node + Python. Not a multi-container setup.
- **4 named volumes** — Config, data, custom audio, cache audio. All persist across container restarts.
- **`--break-system-packages`** — Required for pip in Debian-based Node images (no venv in Docker).
- **Frontend is pre-built** — Stage 1 builds static files. Node serves them via Express static middleware.

## MODIFYING

- **Add system dependency** — Add `apt-get install` in Dockerfile stage 2.
- **Add Python dependency** — Add to `src/microservices/tts/requirements.txt`, rebuild image.
- **Add volume** — Update both `docker-compose.yml` and `Dockerfile` (create dir).
- **Change ports** — Update `EXPOSE` in Dockerfile, `ports` in compose, and `APP_PORT` env var.
