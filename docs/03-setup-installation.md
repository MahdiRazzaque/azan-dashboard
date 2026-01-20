# 3. Setup and Installation

## Prerequisites
To run the Azan Dashboard, you need a system capable of running containers or Node.js applications.

*   **Preferred:** Docker & Docker Compose (Platform agnostic).
*   **Manual:**
    *   **Node.js:** v18.0.0 or higher.
    *   **Python:** v3.8+ (for TTS microservice).
    *   **System Tools:** `mpg123` (for local audio playback on Linux/Mac).

## Environment Configuration
The application uses environment variables for sensitive configuration. When running for the first time, the system will generate a secure random `JWT_SECRET`.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | The HTTP port for the dashboard | `3000` |
| `ADMIN_PASSWORD` | Hashed password for the admin panel (Set via Setup Wizard) | *None* |
| `JWT_SECRET` | Secret key for signing session tokens | *Auto-generated* |
| `PYTHON_SERVICE_URL` | URL of the TTS microservice | `http://localhost:8000` |
| `VOICEMONKEY_TOKEN` | API Token for VoiceMonkey (Alexa) | *Managed via UI* |
| `VOICEMONKEY_DEVICE`| Device ID for VoiceMonkey | *Managed via UI* |

## Installation Guide

### Option A: Docker Deployment (Recommended)
This is the easiest way to get started. It bundles the Backend, Frontend, and Python TTS service into a single container.

1.  **Prepare Directory:**
    Ensure you have the `docker` directory containing `docker-compose.yml` and `Dockerfile`.
    
2.  **Create Placeholder Configs:**
    Run the following to ensure permissions are correct for mapped volumes:
    ```bash
    mkdir config
    touch config/local.json
    cp .env.example config/.env
    ```
    *Note: Docker volume maps the `config` directory, so `.env` must reside inside it.*

3.  **Start the Container:**
    ```bash
    docker compose -f docker/docker-compose.yml up -d
    ```

    **For Linux Users needing Local Audio:**
    If you want the container to play sound on the host's speakers (e.g., Raspberry Pi), use the audio override file:
    ```bash
    docker compose -f docker/docker-compose.yml -f docker/docker-compose.audio.yml up -d
    ```

4.  **Access:**
    Open your browser at `http://localhost:3000`. You will be redirected to the Setup Wizard to create an admin password.

### Option B: Manual Installation
Use this for development or if you cannot use Docker.

1.  **Clone Repository:**
    ```bash
    git clone https://github.com/MahdiRazzaque/azan-dashboard.git
    cd azan-dashboard
    ```

2.  **Install Backend Dependencies:**
    ```bash
    npm install
    ```

3.  **Install Frontend Dependencies & Build:**
    ```bash
    cd client
    npm install
    npm run build
    cd ..
    ```

4.  **Setup Python Microservice:**
    ```bash
    cd src/microservices/tts
    python3 -m venv venv
    source venv/bin/activate  # or venv\Scripts\activate on Windows
    pip install -r requirements.txt
    ```

5.  **Start Services:**
    You need to run the Node server and Python server simultaneously.
    
    *Terminal 1 (Python):*
    ```bash
    # Inside src/microservices/tts
    python server.py
    ```
    
    *Terminal 2 (Node):*
    ```bash
    # Root directory
    npm start
    ```

## Running the Application

### Development Mode
To run with hot-reloading for both backend and frontend:
```bash
npm run dev
```
*   **Backend:** Runs on port 3000 (via Nodemon).
*   **Frontend:** Runs on port 5173 (via Vite). Requests to `/api` are proxied to 3000.

### Production Mode
1.  Ensure the frontend is built: `cd client && npm run build`.
2.  Start the server: `npm start`.
3.  Access at `http://localhost:3000`.