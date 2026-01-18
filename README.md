# Azan Dashboard v2

A prayer time management dashboard with automated Alexa announcements and local audio support.

## Docker Deployment (Recommended)

The easiest way to deploy the Azan Dashboard is using Docker. This packages the Node.js backend, React frontend, and Python TTS service into a single container.

### 1. Standard Setup (Windows, Mac, WSL)
Use this method if you are running on Windows, Docker Desktop, or a Linux server without speakers attached.

1.  **Start the container:**
    ```bash
    docker-compose up -d
    ```
2.  **Access the dashboard:**
    Open `http://localhost:3000`

### 2. Linux Setup with Local Audio
Use this method **only on Linux hosts** (e.g., Raspberry Pi) where you want the application to play the Adhan directly through the device's 3.5mm jack or HDMI audio.

1.  **Start with Audio Support:**
    We use a separate configuration file to map the hardware device (`/dev/snd`), preventing errors on non-Linux systems.
    ```bash
    docker-compose -f docker-compose.yml -f docker-compose.audio.yml up -d
    ```

    > **Tip:** To avoid typing this long command every time, you can rename `docker-compose.audio.yml` to `docker-compose.override.yml`. Docker will then automatically include it when you run `docker-compose up -d`.

### Persistence & Configuration

The application automatically creates the following folders in your project root to ensure your data survives container updates:

- `config/`: Stores `local.json` (settings) and `.env` (passwords/secrets).
- `data/`: Stores the prayer time cache.
- `public/audio/custom/`: Place your own MP3 files here.
- `public/audio/cache/`: Generated TTS announcements.

**Note:** You do not need to manually create these files. The container will initialize them on the first run.

---

## Manual Development Setup

If you prefer to run the services manually for development (without Docker):

### Prerequisites
- Node.js v18+
- Python 3.8+
- `mpg123` (Linux/Mac) or a command-line player for Windows

### 1. Backend
```bash
npm install
npm start
# Or for hot-reloading:
npm run server:dev
```

### 2. Frontend
```bash
cd client
npm install
npm run dev
```

### 3. TTS Microservice
```bash
cd src/microservices/tts
python -m venv venv
# Linux/Mac:
source venv/bin/activate
# Windows:
venv\Scripts\activate

pip install -r requirements.txt
python server.py
```