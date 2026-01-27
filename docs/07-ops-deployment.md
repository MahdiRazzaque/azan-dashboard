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
For the system to play audio on the host's speakers (e.g., a Raspberry Pi connected to a Mosque local audio system), the container needs access to the sound device.
*   **Flag:** `--device /dev/snd`
*   **Constraint:** This works natively on Linux hosts. On Windows/Mac (Docker Desktop), hardware pass-through is limited, so "Local" audio targets will likely fail (but Browser/Alexa targets will work).

## Reverse Proxy Configuration

If you are deploying the dashboard behind a reverse proxy (Nginx, Apache, Traefik, etc.), you **must** ensure two things:
1.  **Upload Limits:** Increase the body size limit to allow MP3 uploads (default is usually 1MB).
2.  **SSE Buffering:** Disable buffering for the `/api/logs` endpoint to allow real-time log streaming.

### Nginx Configuration
Add this configuration to your site block.

> [!IMPORTANT]
> You must set `client_max_body_size` to at least **20M** to allow MP3 file uploads. The application enforces a 10MB limit internally, but Nginx will reject files larger than 1MB by default with a `413 Request Entity Too Large` error.

```nginx
server {
    # ... your existing server_name and listen config ...

    # REQUIRED: Allow larger uploads for MP3 files
    client_max_body_size 20M;

    # Handle Server-Sent Events (SSE) for logs
    location /api/logs {
        # Match your upstream (e.g. http://localhost:3000 or http://azan-dashboard:3000)
        proxy_pass http://localhost:3000; 

        # CRITICAL: Disable buffering so data is sent immediately
        proxy_buffering off;
        proxy_cache off;
        
        # Connection settings required for SSE
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
        
        # Prevent Nginx from timing out the idle connection (24 hours)
        proxy_read_timeout 24h;
        
        # Standard headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Standard traffic
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Other Web Servers
*   **Apache:** Ensure `mod_proxy` is configured with `flushpackets=on` for the `/api/logs` path, or set environment variables `no-gzip` and `proxy-nokeepalive`.
*   **Caddy:** Generally handles streaming well, but ensure `flush_interval` is set to `-1` if issues arise.
*   **Cloudflare:** Cloudflare buffers responses by default. You must create a **Page Rule** for `yourdomain.com/api/logs*` setting **Cache Level** to **Bypass**.

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

### 4. Wake Lock API (HTTPS Requirement)
The Screen Wake Lock API **only functions over HTTPS** (or strictly `localhost`). If the dashboard is served over plain HTTP, the "Keep Screen On" feature will be unavailable. Ensure your deployment serves the application over a secure connection.

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