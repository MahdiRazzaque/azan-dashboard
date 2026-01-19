# 7. Operations and Deployment

This section covers the operational aspects of running the Azan Dashboard in a production environment, including security hardening, performance tuning, and monitoring.

## Deployment Architecture

The recommended deployment is a single Docker container hosting all three components (Node.js, React Static, Python). This simplifies network configuration and file sharing.

### Volume Strategy
To ensure data persistence, the following paths inside the container MUST be mapped to the host:
*   `/app/config/`: Stores configuration files.
    *   `local.json`: User settings overrides.
    *   `.env`: Stores the Admin Password hash and JWT Secret.
*   `/app/data`: Stores the prayer time cache (`cache.json`).
*   `/app/public/audio/custom`: Stores user-uploaded MP3s.
*   `/app/public/audio/cache`: Stores generated TTS files.

**Note:** The `.env` file is located inside the `config` directory in the container (`/app/config/.env`) to allow for a single volume mapping for all configuration data.

### Hardware Access (Local Audio)
For the system to play audio on the host's speakers (e.g., a Raspberry Pi connected to a Mosque PA system), the container needs access to the sound device.
*   **Flag:** `--device /dev/snd`
*   **Constraint:** This works natively on Linux hosts. On Windows/Mac (Docker Desktop), hardware pass-through is limited, so "Local" audio targets will likely fail (but Browser/Alexa targets will work).

## Security Considerations

### 1. Authentication
*   **JWT:** Tokens are signed with a persistent secret stored in `.env`.
*   **Cookies:** `HttpOnly` and `SameSite=Strict` flags are enforced to prevent Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF).
*   **Password Hashing:** The admin password is hashed using `scrypt` with a random salt before storage.

### 2. Rate Limiting
To prevent abuse, the API implements tiered rate limiting:
*   **Security Tier:** 20 login attempts per minute (blocks brute force).
*   **Operations Tier:** Limits resource-heavy actions (TTS generation, Uploads) to prevent Denial of Service (DoS).
*   **Global Read Tier:** Higher limits for general polling to support multiple dashboard screens.

### 3. Input Validation
All configuration updates are validated against a strict `Zod` schema.
*   **Sanitisation:** Prevents injection of invalid data types.
*   **Logic Checks:** Ensures start times are valid ISO strings and offsets are within safe bounds (0-60 mins).

## Monitoring & Logging

### Real-time Logs
The system broadcasts internal logs to the frontend via Server-Sent Events (`/api/logs`). This allows admins to see:
*   Scheduler trigger events ("Triggering Fajr Adhan...").
*   Error messages (e.g., "VoiceMonkey API unreachable").
*   Rate limit warnings.

### Health Checks
The `/api/system/health` endpoint provides a JSON status of critical subsystems:
*   **Local Audio:** Checks if `mpg123` is installed and `/dev/snd` is accessible.
*   **TTS Service:** Pings the Python microservice.
*   **External APIs:** Verifies connectivity to Aladhan/MyMasjid and VoiceMonkey.

## Performance Considerations

### Caching Strategy
*   **Prayer Data:** Fetched once per year (Aladhan) or in bulk (MyMasjid) and cached on disk. This eliminates daily API latency.
*   **Audio Assets:** TTS files are generated once and reused until the template text changes. The system uses file metadata (`mtime`) to manage the cache.

### Debouncing
*   **Audio Triggers:** The automation service ensures a specific event (e.g., Fajr Adhan) triggers only once per day, preventing accidental double-playback if the scheduler re-evaluates.
*   **Frontend Polling:** The dashboard polls for status updates every 10 seconds, but immediately backs off if it receives a `429 Too Many Requests` response.