# 3. Setup and Installation

This guide covers all prerequisites, environment configuration, and deployment options for the Azan Dashboard.

## Prerequisites

| Requirement | Docker Deployment | Manual Deployment |
| :--- | :--- | :--- |
| **Docker Engine** | v20+ with Compose v2 | Not required |
| **Node.js** | Not required (bundled) | v22.0.0 or higher |
| **Python** | Not required (bundled) | v3.11+ (for TTS microservice) |
| **mpg123** | Not required (bundled) | Required for local audio playback (Linux/macOS) |
| **ALSA utilities** | Not required (bundled) | Required for local audio on Linux |
| **Operating System** | Any (Linux recommended for local audio) | Any (Linux recommended for local audio) |

## Environment Configuration

The application uses environment variables for sensitive configuration. Secrets are **never** stored in `local.json` — they reside exclusively in the `.env` file.

### Environment Variables

| Variable | Description | Default | Set By |
| :--- | :--- | :--- | :--- |
| `PORT` | HTTP port for the dashboard | `3000` | Manual |
| `BASE_URL` | External HTTPS URL for VoiceMonkey and remote access | *None* | UI / Manual |
| `ADMIN_PASSWORD` | Scrypt-hashed admin password | *None* | Setup Wizard |
| `JWT_SECRET` | 64-byte secret for signing session tokens | *Auto-generated* | Startup |
| `ENCRYPTION_SALT` | 32-byte salt for AES-256-GCM config encryption | *Auto-generated* | Startup |
| `PYTHON_SERVICE_URL` | URL of the TTS microservice | `http://localhost:8000` | Manual |
| `VOICEMONKEY_TOKEN` | API token for VoiceMonkey (Alexa integration) | *None* | UI |
| `VOICEMONKEY_DEVICE` | Device ID for VoiceMonkey | *None* | UI |
| `DOTENV_CONFIG_QUIET` | Suppresses dotenv warnings when `.env` is absent | `true` | Manual |
| `ENV_FILE_PATH` | Override path for the `.env` file | *None* (defaults to project root) | Docker |
| `LOCAL_CONFIG_PATH` | Override path for the `local.json` config file | *None* (defaults to `src/config/`) | Docker |
| `TZ` | Timezone for the container (does **not** affect prayer calculations) | `UTC` | Docker Compose |

> [!NOTE]
> `JWT_SECRET` and `ENCRYPTION_SALT` are auto-generated on first startup if not present. The Setup Wizard automatically hashes the admin password and writes it to `.env`. There is no need to set these manually.

### Environment Variable Update Restrictions

The API endpoint for updating environment variables (`POST /api/settings/env`) enforces a strict whitelist. Only variables matching the following patterns are permitted:

- Prefixed with `AZAN_`
- Suffixed with `_KEY`, `_TOKEN`, `_SECRET`, `_URL`, `_ID`, or `_DEVICE`
- Exact matches: `PORT`, `TZ`, `LOG_LEVEL`

System-critical variables (`PATH`, `NODE_OPTIONS`, `SHELL`, `USER`, `HOME`, `LD_PRELOAD`) are explicitly blocked.

---

## Installation Guide

### Option A: Docker Deployment (Recommended)

Docker bundles the Node.js backend, React frontend, and Python TTS microservice into a single container managed by Supervisord.

#### 1. Clone the Repository

```bash
git clone https://github.com/MahdiRazzaque/azan-dashboard.git
cd azan-dashboard
```

#### 2. Prepare Persistent Directories

Create the directories that Docker will map as volumes:

```bash
mkdir -p config data public/audio/custom public/audio/cache
```

Optionally, copy the example environment file:

```bash
cp .env.example config/.env
```

> [!IMPORTANT]
> In Docker, the `.env` file lives inside the `config/` directory (`/app/config/.env` in the container). This allows a single volume mapping for all configuration data.

#### 3. Configure the Application Port

Create a root-level `.env` file (separate from `config/.env`) to set the host port:

```bash
echo "APP_PORT=3000" > .env
```

The `docker-compose.yml` reads `APP_PORT` to map the container's internal port 3000 to your chosen host port.

#### 4. Start the Container

**Standard Setup** (Windows, macOS, Docker Desktop — no local audio):

```bash
docker compose -f docker/docker-compose.yml up -d
```

**Linux Setup with Local Audio** (Raspberry Pi, dedicated server):

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.audio.yml up -d
```

The audio overlay file passes `/dev/snd` into the container, enabling playback through the host's physical speakers via ALSA.

#### 5. Access the Dashboard

Open your browser at `http://localhost:3000` (or your configured `APP_PORT`). You will be redirected to the **Setup Wizard** to create an admin password. After completing setup, a guided tour will offer to walk you through the key features.

#### Volume Mapping Summary

| Host Path | Container Path | Purpose |
| :--- | :--- | :--- |
| `./config/` | `/app/config/` | `local.json` (settings) and `.env` (secrets) |
| `./data/` | `/app/data/` | Prayer time cache (`cache.json`) |
| `./public/audio/custom/` | `/app/public/audio/custom/` | User-uploaded MP3 files |
| `./public/audio/cache/` | `/app/public/audio/cache/` | Generated TTS audio files |

#### Docker Environment Variables

The following environment variables are set inside the container by the Dockerfile:

| Variable | Value | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimisations |
| `PORT` | `3000` | Internal application port |
| `PYTHON_SERVICE_URL` | `http://localhost:8000` | TTS microservice address (same container) |
| `ENV_FILE_PATH` | `/app/config/.env` | Redirects `.env` to the mapped volume |
| `LOCAL_CONFIG_PATH` | `/app/config/local.json` | Redirects config to the mapped volume |

---

### Option B: Manual Installation

Use this for development or if Docker is unavailable.

#### 1. Clone the Repository

```bash
git clone https://github.com/MahdiRazzaque/azan-dashboard.git
cd azan-dashboard
```

#### 2. Install Backend Dependencies

```bash
npm install
```

#### 3. Install and Build the Frontend

```bash
cd client
npm install
npm run build
cd ..
```

#### 4. Set Up the Python TTS Microservice

```bash
cd src/microservices/tts
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ../../..
```

#### 5. Install System Dependencies (Linux)

For local audio playback on Linux:

```bash
sudo apt-get install mpg123 alsa-utils
```

#### 6. Create the Environment File

```bash
cp .env.example .env
```

Edit `.env` to configure `PORT` and `BASE_URL` as needed.

#### 7. Start Services

You need to run the Node.js server and Python TTS service simultaneously.

*Terminal 1 — Python TTS:*

```bash
cd src/microservices/tts
source venv/bin/activate
python server.py
```

*Terminal 2 — Node.js Backend:*

```bash
npm start
```

#### 8. Access the Dashboard

Open `http://localhost:3000` in your browser. Complete the Setup Wizard to set the admin password.

---

## Running the Application

### Development Mode

To run with hot-reloading for both backend and frontend simultaneously:

```bash
npm run dev
```

| Component | Port | Tool | Details |
| :--- | :--- | :--- | :--- |
| **Backend** | `3000` | Nodemon | Watches `src/` for changes, auto-restarts |
| **Frontend** | `5173` | Vite dev server | Hot Module Replacement (HMR). Proxies `/api` requests to port 3000. |

The `npm run dev` command uses `concurrently` to launch both services. You can also run them independently:

```bash
npm run server:dev    # Backend only (Nodemon)
npm run client:dev    # Frontend only (Vite)
```

### Production Mode

1. Ensure the frontend is built:

    ```bash
    cd client && npm run build && cd ..
    ```

2. Start the server:

    ```bash
    npm start
    ```

3. Access the dashboard at `http://localhost:3000`.

In production mode, Express serves the pre-built React application as static files from `client/dist/`.

---

## First-Run Experience

1. **Setup Wizard** — On first access, you are redirected to `/setup` to create the admin password. The system automatically generates `JWT_SECRET` and `ENCRYPTION_SALT` at this point.
2. **Dashboard Tour** — After setup, a welcome modal offers a guided tour of the dashboard interface.
3. **Admin Tour** — On first visit to the Settings panel, a separate admin tour is offered.
4. **Configuration** — Navigate to Settings to configure your location, prayer time source, and automation preferences.

> [!TIP]
> Both tours can be restarted at any time. The dashboard tour is available via **Display Settings → System → Restart Tour**, and the admin tour via the **Restart Tour** button in the Admin Panel.
