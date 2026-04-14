# 6. API Reference

This document provides an exhaustive reference for every REST API endpoint exposed by the Azan Dashboard backend. All endpoints are mounted under the `/api` prefix.

---

## Authentication Model

The API uses **HttpOnly cookie-based JWT authentication**. Upon successful login or setup, the server issues a signed JWT stored in an `auth_token` cookie with the following attributes:

| Attribute    | Value                                       |
| ------------ | ------------------------------------------- |
| `httpOnly`   | `true`                                      |
| `secure`     | `true` (production only)                    |
| `sameSite`   | `strict`                                    |
| `maxAge`     | 24 hours                                    |
| Token Claims | `{ role: "admin", tokenVersion: <number> }` |

No manual `Authorization` header is required — the browser sends the cookie automatically. Endpoints marked **Auth: Required** will return `401 Unauthorised` if the cookie is missing, expired, or its `tokenVersion` does not match the server's current version.

---

## Global Behaviours

### No-Cache Headers

All `/api/*` responses include the following headers to prevent stale data on kiosk displays:

```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
Surrogate-Control: no-store
```

### Rate Limiting

Every request passes through a global rate limiter before reaching its sub-router. Individual endpoints may apply additional, stricter limiters on top.

| Tier             | Scope                                   | Window     | Max Requests | Applies To                                                                                                                                                                 |
| ---------------- | --------------------------------------- | ---------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security**     | Login, setup, password change           | 1 minute   | 20           | `/api/auth/login`, `/api/auth/setup`, `/api/auth/change-password`                                                                                                          |
| **Operations**   | Resource-heavy actions                  | 10 seconds | 10           | TTS preview/regenerate, uploads, scheduler restart, source test, URL validation, health refresh, job run, file revalidate, cache refresh, temp cleanup, output verify/test |
| **Global Read**  | All `GET` requests (except SSE)         | 10 seconds | 50           | Automatic for all GET endpoints                                                                                                                                            |
| **Global Write** | All `POST` / `PUT` / `DELETE` / `PATCH` | 10 seconds | 10           | Automatic for all write endpoints                                                                                                                                          |
| **SSE**          | Log stream connections                  | 1 minute   | 50           | `/api/logs`                                                                                                                                                                |

When a limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": "Too many requests",
  "message": "Too many authentication attempts. Please try again in a minute. - Please try again in 42 seconds.",
  "retryAfter": "42"
}
```

### Error Handler

Unhandled errors are caught by centralised error-handling middleware and returned as:

```json
{
  "error": "<Error Type>",
  "message": "<Human-readable description>"
}
```

### Standard Status Codes

| Code  | Meaning                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------- |
| `200` | Request succeeded.                                                                                 |
| `400` | Validation failure (missing fields, invalid format, Zod schema error).                             |
| `401` | Not authenticated (missing or invalid JWT cookie).                                                 |
| `403` | Authenticated but action forbidden (e.g., setup when already configured, deleting protected file). |
| `404` | Resource not found.                                                                                |
| `429` | Rate limit exceeded.                                                                               |
| `500` | Internal server error.                                                                             |
| `503` | Critical dependency offline (source APIs, TTS service).                                            |

---

## Authentication — `/api/auth`

### `GET /api/auth/status`

Checks whether the system has been configured (admin password set).

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | None        |
| **Rate Limit** | Global Read |

**Response `200`:**

```json
{
  "configured": true,
  "requiresSetup": false
}
```

| Field           | Type      | Description                                               |
| --------------- | --------- | --------------------------------------------------------- |
| `configured`    | `boolean` | Whether the `.env` file contains required secrets.        |
| `requiresSetup` | `boolean` | Whether `ADMIN_PASSWORD` is missing from the environment. |

---

### `POST /api/auth/setup`

Performs initial system setup: hashes and stores the admin password, generates `JWT_SECRET` and `ENCRYPTION_SALT` if absent, and immediately logs the user in.

| Property       | Value                            |
| -------------- | -------------------------------- |
| **Auth**       | None                             |
| **Rate Limit** | Security (20/min) + Global Write |

**Request Body:**

```json
{
  "password": "mySecurePassword"
}
```

| Field      | Type     | Required | Constraints          |
| ---------- | -------- | -------- | -------------------- |
| `password` | `string` | Yes      | Minimum 5 characters |

**Response `200`:**

```json
{
  "success": true,
  "message": "Structure secured and logged in."
}
```

Sets the `auth_token` cookie on success.

**Error Responses:**

| Code  | Condition                          | Body                                                                  |
| ----- | ---------------------------------- | --------------------------------------------------------------------- |
| `400` | Password shorter than 5 characters | `{ "error": "Password too short" }`                                   |
| `403` | System already configured          | `{ "error": "System already configured. Login to change settings." }` |
| `500` | Failed to write `.env`             | `{ "error": "Failed to write configuration" }`                        |

---

### `POST /api/auth/login`

Authenticates with the admin password and issues a JWT cookie.

| Property       | Value                            |
| -------------- | -------------------------------- |
| **Auth**       | None                             |
| **Rate Limit** | Security (20/min) + Global Write |

**Request Body:**

```json
{
  "password": "mySecurePassword"
}
```

**Response `200`:**

```json
{
  "success": true
}
```

Sets the `auth_token` cookie on success.

**Error Responses:**

| Code  | Condition                       | Body                                                                            |
| ----- | ------------------------------- | ------------------------------------------------------------------------------- |
| `401` | Invalid password                | `{ "error": "Invalid password" }`                                               |
| `500` | `ADMIN_PASSWORD` not configured | `{ "error": "Server authentication not configured", "code": "SETUP_REQUIRED" }` |
| `500` | `JWT_SECRET` missing            | `{ "error": "System security not fully configured (Missing JWT Secret)" }`      |

---

### `POST /api/auth/logout`

Clears the authentication cookie, ending the session.

| Property       | Value        |
| -------------- | ------------ |
| **Auth**       | None         |
| **Rate Limit** | Global Write |

**Response `200`:**

```json
{
  "success": true
}
```

---

### `GET /api/auth/check`

Validates the current session token. Used by the frontend to verify authentication state on page load.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Response `200`:**

```json
{
  "authenticated": true
}
```

**Error Response:** `401` if the token is invalid or expired.

---

### `POST /api/auth/change-password`

Updates the admin password and increments `tokenVersion`, invalidating all existing sessions across all devices.

| Property       | Value                            |
| -------------- | -------------------------------- |
| **Auth**       | Required                         |
| **Rate Limit** | Security (20/min) + Global Write |

**Request Body:**

```json
{
  "password": "newSecurePassword"
}
```

| Field      | Type     | Required | Constraints |
| ---------- | -------- | -------- | ----------- |
| `password` | `string` | Yes      | Non-empty   |

**Response `200`:**

```json
{
  "success": true,
  "message": "Password updated"
}
```

**Error Responses:**

| Code  | Condition        | Body                                       |
| ----- | ---------------- | ------------------------------------------ |
| `400` | Missing password | `{ "error": "Missing password" }`          |
| `500` | Write failure    | `{ "error": "Failed to update password" }` |

---

## Prayers — `/api/prayers`

### `GET /api/prayers`

Retrieves prayer times for the current date, the calculated "next prayer" countdown, and an optional calendar window for navigation.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | None        |
| **Rate Limit** | Global Read |

**Query Parameters:**

| Param        | Type     | Required | Constraints                               | Description                                |
| ------------ | -------- | -------- | ----------------------------------------- | ------------------------------------------ |
| `cursorDate` | `string` | No\*     | `YYYY-MM-DD` format, must be a valid date | Centre date for calendar window pagination |
| `direction`  | `string` | No\*     | `"future"` or `"past"`                    | Direction to paginate from `cursorDate`    |

\*Both `cursorDate` and `direction` must be provided together or both omitted. Providing only one returns a `400` error.

**Response `200`:**

```json
{
  "date": "2026-03-06",
  "hijriDate": "...",
  "prayers": {
    "fajr": { "adhan": "05:32", "iqamah": "05:55" },
    "sunrise": { "adhan": "07:01" },
    "dhuhr": { "adhan": "12:15", "iqamah": "12:30" },
    "asr": { "adhan": "15:15", "iqamah": "15:30" },
    "maghrib": { "adhan": "17:52", "iqamah": "18:00" },
    "isha": { "adhan": "19:15", "iqamah": "19:30" }
  },
  "next": {
    "prayer": "dhuhr",
    "type": "adhan",
    "time": "12:15",
    "countdown": "02:43:12"
  },
  "calendar": [{ "date": "2026-03-07", "prayers": { "...": "..." } }]
}
```

**Error Responses:**

| Code  | Condition                                    | Body                                                                                 |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `400` | Invalid query (only one of cursor/direction) | `{ "error": "Bad Request", "message": "Invalid prayer calendar query parameters." }` |
| `500` | Internal error                               | `{ "error": "Internal Server Error", "message": "..." }`                             |

---

## Settings — `/api/settings`

### `GET /api/settings/public`

Retrieves a sanitised subset of configuration for unauthenticated dashboard display. All output strategy secrets are stripped.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | None        |
| **Rate Limit** | Global Read |

**Response `200`:**

```json
{
  "location": { "timezone": "Europe/London", "coordinates": { "lat": 51.5074, "long": -0.1278 } },
  "prayers": { "fajr": { "iqamahOffset": 20, "roundTo": 15, "fixedTime": null }, "..." },
  "sources": { "primary": { "type": "aladhan", "..." }, "backup": null },
  "automation": { "global": { "enabled": true, "..." }, "outputs": { "..." }, "triggers": { "..." } },
  "system": { "tours": { "dashboardSeen": false, "adminSeen": false } }
}
```

---

### `GET /api/settings`

Retrieves the full configuration object. Sensitive fields (provider credentials, output API keys) are masked with `"********"`.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Response `200`:** The complete `configSchema` object with sensitive values replaced by the mask string.

---

### `POST /api/settings/update`

Validates and saves new configuration. Triggers a cascading workflow: Zod validation → config save → source refresh → audio asset synchronisation → scheduler reload.

| Property       | Value        |
| -------------- | ------------ |
| **Auth**       | Required     |
| **Rate Limit** | Global Write |

**Request Body:** A partial or full configuration object conforming to `configSchema`. Only the fields provided are merged.

**Response `200`:** Result object from the configuration workflow, including metadata about what changed.

**Error Responses:**

| Code  | Condition             | Body                                                                |
| ----- | --------------------- | ------------------------------------------------------------------- |
| `400` | Zod validation failed | `{ "error": "Update Failed", "message": "Validation Failed: ..." }` |
| `500` | Internal error        | `{ "error": "Update Failed", "message": "..." }`                    |

---

### `POST /api/settings/env`

Securely updates an environment variable in the `.env` file. Only keys matching a strict whitelist pattern are permitted.

| Property       | Value        |
| -------------- | ------------ |
| **Auth**       | Required     |
| **Rate Limit** | Global Write |

**Request Body:**

```json
{
  "key": "BASE_URL",
  "value": "https://azan.example.com"
}
```

| Field   | Type     | Required | Constraints                                                                                                                                                                                      |
| ------- | -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `key`   | `string` | Yes      | Must match one of: `AZAN_*`, `*_KEY`, `*_TOKEN`, `*_SECRET`, `*_URL`, `*_ID`, `*_DEVICE`, `PORT`, `TZ`, `LOG_LEVEL`. Blacklisted: `PATH`, `NODE_OPTIONS`, `SHELL`, `USER`, `HOME`, `LD_PRELOAD`. |
| `value` | `string` | Yes      | Any string value.                                                                                                                                                                                |

**Response `200`:**

```json
{
  "success": true,
  "message": "BASE_URL updated successfully",
  "data": { "BASE_URL": "https://azan.example.com" }
}
```

**Error Responses:**

| Code  | Condition             | Body                                                                    |
| ----- | --------------------- | ----------------------------------------------------------------------- |
| `400` | Zod validation failed | `{ "success": false, "message": "Validation failed", "errors": [...] }` |
| `500` | Write failure         | `{ "success": false, "message": "Internal server error" }`              |

---

### `POST /api/settings/reset`

Resets all configuration to factory defaults by deleting `local.json`. Triggers a full refresh: config reload → prayer cache refresh → audio asset sync → scheduler reinitialisation.

| Property       | Value        |
| -------------- | ------------ |
| **Auth**       | Required     |
| **Rate Limit** | Global Write |

**Response `200`:**

```json
{
  "message": "Settings reset to defaults.",
  "meta": { "...": "..." },
  "warnings": []
}
```

**Error Responses:**

| Code  | Condition                    | Body                                                                                             |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| `400` | Audio synchronisation failed | `{ "error": "Sync Failed", "message": "Settings reset, but audio synchronisation failed: ..." }` |

---

### `POST /api/settings/refresh-cache`

Forces a refresh of prayer time data from online sources. Verifies at least one source is reachable before discarding the cache.

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Response `200`:**

```json
{
  "message": "Cache refreshed and scheduler reloaded",
  "meta": { "...": "..." },
  "warnings": []
}
```

**Error Responses:**

| Code  | Condition                             | Body                                                                                                      |
| ----- | ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `400` | Audio sync failed after cache refresh | `{ "error": "Sync Failed", "message": "Cache refreshed, but audio synchronisation failed: ..." }`         |
| `503` | No sources online                     | `{ "error": "System is relying on cache. Cannot reload cache until at least one Prayer API is online." }` |

---

### `POST /api/settings/upload`

Uploads a custom audio file. The file is validated via magic bytes, moved from temporary to permanent storage, and a metadata sidecar JSON is generated.

| Property       | Value                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- |
| **Auth**       | Required                                                                                 |
| **Rate Limit** | Operations (10/10s) + Global Write                                                       |
| **Middleware** | `storageCheck` (rejects if disk quota exceeded), Multer (single file, field name `file`) |

**Request:** `multipart/form-data` with a single file field named `file`.

| Constraint            | Value                                                      |
| --------------------- | ---------------------------------------------------------- |
| Max file size         | 10 MB                                                      |
| Accepted extensions   | `.mp3`, `.wav`, `.aac`, `.ogg`, `.opus`, `.flac`, `.m4a`   |
| Accepted MIME types   | Any `audio/*`                                              |
| Max file count        | 500 custom files total                                     |
| Filename sanitisation | Non-alphanumeric characters (except `.`) replaced with `_` |

**Response `200`:**

```json
{
  "message": "File uploaded and analysed successfully",
  "filename": "adhan_makkah.mp3",
  "path": "custom/adhan_makkah.mp3",
  "duration": 245.3,
  "mimeType": "audio/mpeg",
  "sampleRate": 44100
}
```

**Error Responses:**

| Code  | Condition                         | Body                                                                                        |
| ----- | --------------------------------- | ------------------------------------------------------------------------------------------- |
| `400` | No file provided                  | `{ "error": "No file uploaded" }`                                                           |
| `400` | Invalid audio (magic bytes check) | `{ "error": "Invalid File", "message": "..." }`                                             |
| `400` | 500-file limit reached            | `{ "error": "Limit Reached", "message": "Maximum of 500 custom audio files allowed. ..." }` |
| `500` | Processing failure                | `{ "error": "Upload Failed", "message": "..." }`                                            |

---

### `DELETE /api/settings/files`

Deletes a custom audio file and its metadata sidecar.

| Property       | Value        |
| -------------- | ------------ |
| **Auth**       | Required     |
| **Rate Limit** | Global Write |

**Request Body:**

```json
{
  "filename": "adhan_makkah.mp3"
}
```

| Field      | Type     | Required | Constraints                                          |
| ---------- | -------- | -------- | ---------------------------------------------------- |
| `filename` | `string` | Yes      | Must not contain `..` or path separators (`/`, `\`). |

**Response `200`:**

```json
{
  "success": true,
  "message": "File and metadata deleted"
}
```

**Error Responses:**

| Code  | Condition                | Body                                                                |
| ----- | ------------------------ | ------------------------------------------------------------------- |
| `400` | Missing filename         | `{ "error": "Missing filename" }`                                   |
| `400` | Path traversal attempt   | `{ "error": "Invalid filename" }`                                   |
| `403` | File marked as protected | `{ "error": "Forbidden: File is protected and cannot be deleted" }` |
| `404` | File not found           | `{ "error": "File not found" }`                                     |
| `500` | Deletion failure         | `{ "error": "Internal Server Error: Failed to delete file" }`       |

---

### `POST /api/settings/files/revalidate`

Re-analyses an existing audio file and regenerates its metadata sidecar.

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Request Body:**

```json
{
  "filename": "adhan_makkah.mp3",
  "type": "custom"
}
```

| Field      | Type     | Required | Constraints                               |
| ---------- | -------- | -------- | ----------------------------------------- |
| `filename` | `string` | Yes      | Must not contain `..` or path separators. |
| `type`     | `string` | Yes      | `"custom"` or `"cache"`.                  |

**Response `200`:** The regenerated metadata object.

**Error Responses:**

| Code  | Condition        | Body                                                   |
| ----- | ---------------- | ------------------------------------------------------ |
| `400` | Missing fields   | `{ "error": "Filename and type are required" }`        |
| `400` | Path traversal   | `{ "error": "Invalid filename" }`                      |
| `404` | File not found   | `{ "error": "Revalidation Failed", "message": "..." }` |
| `500` | Analysis failure | `{ "error": "Revalidation Failed", "message": "..." }` |

---

### `PATCH /api/settings/tour-state`

Updates the onboarding tour completion state.

| Property       | Value        |
| -------------- | ------------ |
| **Auth**       | Required     |
| **Rate Limit** | Global Write |

**Request Body:**

```json
{
  "dashboardSeen": true,
  "adminSeen": true
}
```

| Field           | Type      | Required | Description                                 |
| --------------- | --------- | -------- | ------------------------------------------- |
| `dashboardSeen` | `boolean` | No       | Whether the dashboard tour has been seen.   |
| `adminSeen`     | `boolean` | No       | Whether the admin panel tour has been seen. |

**Response `200`:**

```json
{
  "success": true
}
```

**Error Response:** `400` if values are present but not boolean.

---

## System — `/api/system`

### `GET /api/system/health`

Returns the aggregated health status of all system components. Returns `503` if any critical component is offline.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | None        |
| **Rate Limit** | Global Read |

**Response `200` / `503`:**

```json
{
  "local": { "healthy": true, "message": "mpg123 available" },
  "tts": { "healthy": true, "message": "TTS service responding" },
  "primarySource": { "healthy": true, "message": "Aladhan API online" },
  "backupSource": { "healthy": false, "message": "Not configured" }
}
```

A `503` status is returned when `local`, `tts`, or all configured sources are unhealthy.

---

### `POST /api/system/health/toggle`

Enables or disables automated health monitoring for a specific service.

| Property       | Value        |
| -------------- | ------------ |
| **Auth**       | Required     |
| **Rate Limit** | Global Write |

**Request Body:**

```json
{
  "serviceId": "tts",
  "enabled": false
}
```

| Field       | Type      | Required | Description                              |
| ----------- | --------- | -------- | ---------------------------------------- |
| `serviceId` | `string`  | Yes      | Service identifier (e.g., `api`, `tts`). |
| `enabled`   | `boolean` | Yes      | Whether to enable monitoring.            |

**Response `200`:**

```json
{
  "success": true
}
```

**Error Response:** `400` if `serviceId` is missing or `enabled` is not a boolean.

---

### `POST /api/system/health/refresh`

Forces an immediate health check, bypassing the "Monitoring Disabled" configuration.

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Request Body:**

```json
{
  "target": "tts",
  "params": {}
}
```

| Field    | Type     | Required | Description                                       |
| -------- | -------- | -------- | ------------------------------------------------- |
| `target` | `string` | No       | Specific component to check. Defaults to `"all"`. |
| `params` | `object` | No       | Additional parameters for the health check.       |

**Response `200`:** The health check result object for the targeted component(s).

---

### `GET /api/system/jobs`

Lists all currently scheduled background jobs, split into maintenance and automation categories.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Response `200`:**

```json
{
  "maintenance": [
    { "name": "daily-cache-check", "nextRun": "2026-03-07T00:00:00.000Z" }
  ],
  "automation": [
    { "name": "fajr-adhan", "nextRun": "2026-03-07T05:32:00.000Z" }
  ]
}
```

---

### `GET /api/system/audio-files`

Returns a paginated list of custom and cached audio files with their metadata.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Query Parameters:**

| Param   | Type     | Default | Description              |
| ------- | -------- | ------- | ------------------------ |
| `page`  | `number` | `1`     | Page number (1-indexed). |
| `limit` | `number` | `50`    | Items per page.          |

**Response `200`:**

```json
{
  "files": [
    {
      "name": "adhan_makkah.mp3",
      "type": "custom",
      "path": "custom/adhan_makkah.mp3",
      "url": "/public/audio/custom/adhan_makkah.mp3",
      "metadata": { "duration": 245.3, "mimeType": "audio/mpeg" }
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

Files with `metadata.hidden === true` are excluded from results. Results are cached in-memory for 60 seconds.

---

### `GET /api/system/constants`

Returns static reference data used by the settings UI: calculation methods, juristic schools, latitude adjustments, and midnight modes.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Response `200`:**

```json
{
  "calculationMethods": [
    { "id": 1, "label": "University of Islamic Sciences, Karachi" },
    "..."
  ],
  "madhabs": [{ "id": 1, "label": "Shafi'i, Maliki, Hanbali" }, "..."],
  "latitudeAdjustments": [{ "id": 0, "label": "None" }, "..."],
  "midnightModes": [
    { "id": 0, "label": "Standard (Mid Sunset to Sunrise)" },
    "..."
  ]
}
```

---

### `GET /api/system/status/automation`

Performs a diagnostic check on the automation pipeline and returns its current status.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Response `200`:** A diagnostic status object from `diagnosticsService.getAutomationStatus()`.

---

### `GET /api/system/status/tts`

Performs a diagnostic check on the TTS engine's health and configuration.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Response `200`:** A diagnostic status object from `diagnosticsService.getTTSStatus()`.

---

### `GET /api/system/storage`

Returns disk usage statistics, quota information, and a recommended storage limit.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Response `200`:**

```json
{
  "usedBytes": 52428800,
  "limitBytes": 1073741824,
  "systemFreeBytes": 10737418240,
  "recommendedLimitGB": 2.5,
  "breakdown": {
    "custom": 31457280,
    "cache": 20971520
  }
}
```

---

### `GET /api/system/voices`

Returns the list of available TTS voices from the Python microservice cache.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Response `200`:** An array of voice objects (locale, name, gender).

---

### `POST /api/system/preview-tts`

Generates a TTS audio preview by resolving template placeholders and invoking the TTS microservice.

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Request Body:**

```json
{
  "template": "{minutes} minutes till {prayerArabic}",
  "prayerKey": "fajr",
  "offsetMinutes": 15,
  "voice": "ar-SA-HamedNeural"
}
```

| Field           | Type     | Required | Constraints                                |
| --------------- | -------- | -------- | ------------------------------------------ |
| `template`      | `string` | Yes      | Maximum 50 characters.                     |
| `prayerKey`     | `string` | Yes      | Prayer name (e.g., `fajr`).                |
| `offsetMinutes` | `number` | No       | Minutes value for `{minutes}` placeholder. |
| `voice`         | `string` | Yes      | TTS voice identifier.                      |

**Response `200`:** Audio metadata object with preview file information.

**Error Responses:**

| Code  | Condition                 | Body                                                         |
| ----- | ------------------------- | ------------------------------------------------------------ |
| `400` | Missing required fields   | `{ "error": "Template, prayerKey, and voice are required" }` |
| `400` | Template exceeds 50 chars | `{ "error": "TTS template must be 50 characters or less" }`  |
| `500` | Generation failure        | `{ "error": "..." }`                                         |

---

### `POST /api/system/regenerate-tts`

Clears all cached TTS files and regenerates them from current trigger configurations.

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Response `200`:**

```json
{
  "success": true,
  "message": "Audio assets cleared and synchronised."
}
```

**Error Response:** `400` with `{ "success": false, "message": "Regeneration failed: ..." }`.

---

### `POST /api/system/run-job`

Manually triggers a named scheduled job.

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Request Body:**

```json
{
  "jobName": "daily-cache-check"
}
```

| Field     | Type     | Required | Description                 |
| --------- | -------- | -------- | --------------------------- |
| `jobName` | `string` | Yes      | Name of the job to trigger. |

**Response `200`:**

```json
{
  "success": true,
  "message": "Job completed successfully"
}
```

**Error Responses:**

| Code  | Condition            | Body                                                     |
| ----- | -------------------- | -------------------------------------------------------- |
| `400` | Missing `jobName`    | `{ "success": false, "message": "jobName is required" }` |
| `400` | Job execution failed | `{ "success": false, "message": "..." }`                 |
| `500` | Internal error       | `{ "success": false, "message": "..." }`                 |

---

### `POST /api/system/restart-scheduler`

Performs a hot reload of the prayer scheduler without terminating the server process.

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Response `200`:**

```json
{
  "success": true,
  "message": "Scheduler restarted."
}
```

---

### `POST /api/system/validate-url`

Validates that an external URL is reachable. Uses DNS-pinned HTTP agents to prevent DNS rebinding attacks. Attempts `HEAD` first, then falls back to `GET` (streamed).

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Request Body:**

```json
{
  "url": "https://cdn.example.com/adhan.mp3"
}
```

| Field | Type     | Required | Constraints                            |
| ----- | -------- | -------- | -------------------------------------- |
| `url` | `string` | Yes      | Must use `http:` or `https:` protocol. |

**Response `200`:**

```json
{
  "valid": true
}
```

Or on failure:

```json
{
  "valid": false,
  "error": "Status 404"
}
```

**Error Response:** `400` if URL is missing.

---

### `POST /api/system/source/test`

Tests connectivity and data retrieval for a configured prayer time source by forcing a health check.

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Request Body:**

```json
{
  "target": "primary"
}
```

| Field    | Type     | Required | Constraints                |
| -------- | -------- | -------- | -------------------------- |
| `target` | `string` | Yes      | `"primary"` or `"backup"`. |

**Response `200`:**

```json
{
  "success": true,
  "message": "Source is online and responding."
}
```

**Error Responses:**

| Code  | Condition              | Body                                                                                   |
| ----- | ---------------------- | -------------------------------------------------------------------------------------- |
| `400` | Invalid target value   | `{ "success": false, "error": "Invalid target. Expected \"primary\" or \"backup\"." }` |
| `400` | Source not configured  | `{ "success": false, "error": "Source \"backup\" is not configured." }`                |
| `400` | Backup source disabled | `{ "success": false, "error": "Backup source is currently disabled." }`                |
| `400` | Source test failed     | `{ "success": false, "error": "Source test failed." }`                                 |

---

### `POST /api/system/cleanup-temp-tts`

Manually triggers cleanup of temporary TTS preview files from the `temp/` directory.

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Response `200`:**

```json
{
  "success": true,
  "message": "Temporary TTS files cleaned up successfully."
}
```

**Error Response:** `500` with `{ "error": "Failed to clean up temporary files" }`.

---

### `GET /api/system/providers`

Returns the registry of all available prayer data providers and their configuration schemas.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Response `200`:** An array of provider metadata objects, each containing `id`, `label`, `description`, `requiresCoordinates`, and `parameters`.

---

### `GET /api/system/services/registry`

Returns the list of system services that report health status, used by the frontend to render health monitoring rows dynamically.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Response `200`:**

```json
[
  { "id": "api", "label": "API Server" },
  { "id": "tts", "label": "TTS Service" }
]
```

---

### `GET /api/system/outputs/registry`

Returns all registered output strategies and their configuration schemas. Used by the frontend to dynamically render output configuration cards.

| Property       | Value       |
| -------------- | ----------- |
| **Auth**       | Required    |
| **Rate Limit** | Global Read |

**Response `200`:** An array of strategy metadata objects, each containing `id`, `label`, `timeoutMs`, and `params` (an array of parameter schemas with `key`, `type`, `label`, `sensitive`).

---

### `POST /api/system/outputs/:strategyId/verify`

Verifies credentials for a specific output strategy (e.g., tests VoiceMonkey API key validity).

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Path Parameters:**

| Param        | Type     | Description                               |
| ------------ | -------- | ----------------------------------------- |
| `strategyId` | `string` | Output strategy ID (e.g., `voicemonkey`). |

**Request Body:** Strategy-specific parameters. Masked values (from `GET /api/settings`) are automatically unmasked using stored configuration before verification.

**Response `200`:** Strategy-specific verification result object.

**Error Response:** `400` with `{ "error": "..." }`.

---

### `POST /api/system/outputs/:strategyId/test`

Executes a test playback through a specific output strategy using a provided audio source.

| Property       | Value                              |
| -------------- | ---------------------------------- |
| **Auth**       | Required                           |
| **Rate Limit** | Operations (10/10s) + Global Write |

**Path Parameters:**

| Param        | Type     | Description                         |
| ------------ | -------- | ----------------------------------- |
| `strategyId` | `string` | Output strategy ID (e.g., `local`). |

**Request Body:**

```json
{
  "source": {
    "path": "custom/adhan_makkah.mp3"
  },
  "params": { "...strategy-specific..." }
}
```

| Field         | Type     | Required | Description                                   |
| ------------- | -------- | -------- | --------------------------------------------- |
| `source.path` | `string` | Yes      | Path to the audio file to play.               |
| `params`      | `object` | No       | Strategy-specific parameters (auto-unmasked). |

**Response `200`:**

```json
{
  "success": true
}
```

**Error Response:** `400` if `source.path` is missing or strategy execution fails.

---

## Real-Time Logs — `/api/logs`

### `GET /api/logs`

Establishes a Server-Sent Events (SSE) connection for streaming system logs in real-time.

| Property       | Value                    |
| -------------- | ------------------------ |
| **Auth**       | None                     |
| **Rate Limit** | SSE (50 connections/min) |

**Response:** `text/event-stream`

The stream emits the following event types:

| Event            | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| `LOG`            | General system log messages (info, warn, error).                                 |
| `AUDIO_PLAY`     | Signal to browser clients to play a specific audio URL via the Web Audio API.    |
| `PROCESS_UPDATE` | Progress updates during long-running operations (e.g., "Generating TTS 3/6..."). |

**Example SSE Frame:**

```
event: LOG
data: {"level":"info","message":"Scheduler loaded 12 automation jobs.","timestamp":"2026-03-06T10:30:00.000Z"}
```

The connection remains open indefinitely. Clients should implement automatic reconnection (the `EventSource` API handles this by default).

---

## Health Check — `/api/health`

### `GET /api/health`

A lightweight health probe mounted directly on the Express app (outside the API router). Intended for Docker `HEALTHCHECK` and load balancer probes.

| Property       | Value |
| -------------- | ----- |
| **Auth**       | None  |
| **Rate Limit** | None  |

**Response `200`:**

```json
{
  "status": "ok"
}
```

---

## Endpoint Summary

| Method   | Endpoint                                 | Auth     | Rate Limit Tier |
| -------- | ---------------------------------------- | -------- | --------------- |
| `GET`    | `/api/auth/status`                       | None     | Global Read     |
| `POST`   | `/api/auth/setup`                        | None     | Security        |
| `POST`   | `/api/auth/login`                        | None     | Security        |
| `POST`   | `/api/auth/logout`                       | None     | Global Write    |
| `GET`    | `/api/auth/check`                        | Required | Global Read     |
| `POST`   | `/api/auth/change-password`              | Required | Security        |
| `GET`    | `/api/prayers`                           | None     | Global Read     |
| `GET`    | `/api/settings/public`                   | None     | Global Read     |
| `GET`    | `/api/settings`                          | Required | Global Read     |
| `POST`   | `/api/settings/update`                   | Required | Global Write    |
| `POST`   | `/api/settings/env`                      | Required | Global Write    |
| `POST`   | `/api/settings/reset`                    | Required | Global Write    |
| `POST`   | `/api/settings/refresh-cache`            | Required | Operations      |
| `POST`   | `/api/settings/upload`                   | Required | Operations      |
| `DELETE` | `/api/settings/files`                    | Required | Global Write    |
| `POST`   | `/api/settings/files/revalidate`         | Required | Operations      |
| `PATCH`  | `/api/settings/tour-state`               | Required | Global Write    |
| `GET`    | `/api/system/health`                     | None     | Global Read     |
| `POST`   | `/api/system/health/toggle`              | Required | Global Write    |
| `POST`   | `/api/system/health/refresh`             | Required | Operations      |
| `GET`    | `/api/system/jobs`                       | Required | Global Read     |
| `GET`    | `/api/system/audio-files`                | Required | Global Read     |
| `GET`    | `/api/system/constants`                  | Required | Global Read     |
| `GET`    | `/api/system/status/automation`          | Required | Global Read     |
| `GET`    | `/api/system/status/tts`                 | Required | Global Read     |
| `GET`    | `/api/system/storage`                    | Required | Global Read     |
| `GET`    | `/api/system/voices`                     | Required | Global Read     |
| `POST`   | `/api/system/preview-tts`                | Required | Operations      |
| `POST`   | `/api/system/regenerate-tts`             | Required | Operations      |
| `POST`   | `/api/system/run-job`                    | Required | Operations      |
| `POST`   | `/api/system/restart-scheduler`          | Required | Operations      |
| `POST`   | `/api/system/validate-url`               | Required | Operations      |
| `POST`   | `/api/system/source/test`                | Required | Operations      |
| `POST`   | `/api/system/cleanup-temp-tts`           | Required | Operations      |
| `GET`    | `/api/system/providers`                  | Required | Global Read     |
| `GET`    | `/api/system/services/registry`          | Required | Global Read     |
| `GET`    | `/api/system/outputs/registry`           | Required | Global Read     |
| `POST`   | `/api/system/outputs/:strategyId/verify` | Required | Operations      |
| `POST`   | `/api/system/outputs/:strategyId/test`   | Required | Operations      |
| `GET`    | `/api/logs`                              | None     | SSE             |
| `GET`    | `/api/health`                            | None     | None            |
