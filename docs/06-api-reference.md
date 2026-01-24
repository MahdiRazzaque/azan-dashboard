# 6. API Reference

This document outlines the primary REST API endpoints available in the Azan Dashboard.

## Authentication
The API uses **HttpOnly Cookies** storing a JWT (JSON Web Token) for authentication.
*   **Header:** No manual header required (handled by browser cookie).
*   **Unauthorised:** Returns `401 Unauthorised` if the cookie is missing or invalid.

## Status Codes
*   `200 OK`: Request succeeded.
*   `400 Bad Request`: Validation failure (e.g., invalid JSON, missing fields).
*   `401 Unauthorised`: Not logged in.
*   `403 Forbidden`: Logged in but insufficient permissions (rare, as Admin has full access).
*   `429 Too Many Requests`: Rate limit exceeded.
*   `500 Internal Server Error`: Server-side crash or unhandled exception.
*   `503 Service Unavailable`: Critical dependency (e.g., Database/TTS) is offline.

---

## Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/login` | Authenticates with the admin password. Sets the `auth_token` cookie. |
| `POST` | `/logout` | Clears the auth cookie. |
| `POST` | `/setup` | Initial setup to define the admin password (only works if not configured). |
| `GET` | `/status` | Checks if the system is configured (password set). |

### System & Diagnostics (`/api/system`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Returns status of Local Audio, TTS Service, and External APIs. |
| `POST` | `/health/refresh` | Forces a re-check of system health. |
| `GET` | `/jobs` | Lists active scheduled jobs (Maintenance and Automation). |
| `GET` | `/storage` | Returns disk usage stats for the audio library. |
| `POST` | `/test-audio` | Triggers playback of a specific file on a specific target. |
| `POST` | `/regenerate-tts`| Manually triggers the TTS generation pipeline. |

### Settings (`/api/settings`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Retrieves the full configuration object (excluding secrets). |
| `POST` | `/update` | Validates and saves new configuration. Triggers hot-reload. |
| `POST` | `/env` | Securely updates environment variables (e.g. `BASE_URL`). |
| `POST` | `/reset` | Resets configuration to factory defaults (`default.json`). |
| `POST` | `/upload` | Uploads a custom MP3 file to `public/audio/custom`. |
| `DELETE`| `/files` | Deletes a custom audio file. |

### Prayers (`/api/prayers`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Returns today's prayer times, Iqamah times, and the calculated "Next Prayer". |

### Real-time Logs (`/api/logs`)
*   **Method:** `GET`
*   **Format:** Server-Sent Events (text/event-stream)
*   **Events:**
    *   `LOG`: General system log messages.
    *   `AUDIO_PLAY`: Signal to browsers to play a specific audio URL.
    *   `PROCESS_UPDATE`: Progress updates during long-running tasks (e.g., "Generating TTS...").