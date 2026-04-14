# 2. Features

This document provides a comprehensive catalogue of the Azan Dashboard's capabilities, organised by functional area.

## Core Functionality

### Multi-Source Data Retrieval

The system supports multiple prayer time data providers through a pluggable Factory pattern:

| Provider     | Source                                 | Key Capability                                                                                                                                            |
| :----------- | :------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aladhan**  | [aladhan.com](https://aladhan.com) API | Calculates prayer times based on geolocation (latitude/longitude). Supports all major calculation methods (ISNA, MWL, Karachi, etc.) and Madhab settings. |
| **MyMasjid** | [mymasjid.ca](https://mymasjid.ca) API | Fetches mosque-published timetables directly using a Masjid UUID. Provides pre-calculated Iqamah times.                                                   |

- **Backup Failover:** The system can be configured with a secondary source. If the primary API goes offline, it automatically switches to the backup.
- **Extensibility:** New providers can be added by extending the `BaseProvider` class — see the [Development Guide](./08-development-guide.md).

### Advanced Timing Logic

- **Iqamah Calculation:** Supports dynamic offsets (e.g., "+15 minutes after Adhan") and fixed time overrides (e.g., "20:00" for Isha).
- **Smart Rounding:** Automatically rounds calculated Iqamah times up to the nearest configured interval (5, 10, or 15 minutes) to match mosque conventions. For example: 18:03 + 10m = 18:13 → rounds to 18:15.
- **Sunrise Tracking:** Tracks Sunrise (Shuruq) as a distinct event for display and automation triggers.
- **Iqamah Override:** Per-prayer toggle to override calculated Iqamah with the provider's native Iqamah time (when available, e.g., MyMasjid).

### Date Navigation & Calendar

- **Multi-Day View:** Navigate forwards and backwards through the prayer timetable using on-screen chevrons, swipe gestures, or keyboard arrows.
- **15-Day Window:** Initial load fetches a 15-day window (Today ± 7 days) for zero-latency local navigation.
- **Dynamic Fetching:** Navigating beyond the cached window triggers seamless background fetches for additional 7-day chunks.
- **Inactivity Timeout:** Automatically reverts to "Today" after 120 seconds of inactivity on a non-current date.
- **Midnight Crossover:** Silently updates the reference date at midnight without disrupting the user's current view.

## User-Facing Features

### Responsive Dashboard

- **Split View:** Displays a clear prayer schedule on the left and a large "Focus Clock" with countdowns on the right.
- **Focus Card:** Shows the current time, today's date, the next upcoming prayer name, and a live countdown timer. This card is strictly anchored to physical time and is never affected by date navigation.
- **Client Customisation:** Each connected browser can independently configure:
  - Theme (Dark / Light mode)
  - Clock format (12-hour / 24-hour)
  - Prayer name language (English / Arabic script)
  - Date navigation toggle
  - Local audio mute state

### Administration Panel

The password-protected settings area provides granular control over every aspect of the system.

**General Settings** — Source selection, location coordinates, and timezone configuration.

![General Settings Interface](./images/settings-grid-general-settings.png)

**Automation Settings** — Global switches, per-prayer trigger configuration, and output target management.

![Automation Settings Interface](./images/settings-grid-automation-settings.png)

**File Manager** — Upload custom MP3 files, manage generated TTS assets, view audio metadata and compatibility.

![File Manager Interface](./images/settings-grid-file-manager.png)

Additional settings views include:

- **Credentials Settings** — Manage sensitive API tokens (e.g., VoiceMonkey) and environment variables.
- **Prayer Settings** — Per-prayer Iqamah offsets, rounding intervals, and fixed time overrides.
- **Developer Tools** — Live system logs (SSE), active scheduler jobs, storage diagnostics, TTS voice browser, and health check management.

### Guided Onboarding Tours

- On first visit to the **Dashboard**, a welcome modal prompts the user to start or skip a step-by-step guided tour.
- On first visit to the **Admin Panel**, a separate welcome modal offers the same for an admin-specific tour.
- Completing or skipping a tour marks it as "seen" in the backend configuration, preventing auto-triggers on subsequent visits.
- Both tours can be restarted at any time:
  - Dashboard tour: via **Display Settings → System → Restart Tour**.
  - Admin tour: via the **Admin Panel → Restart Tour** button.

## Audio Automation

### Trigger Events

Each prayer supports up to four configurable trigger events:

| Event          | Description                            | Timing                                              |
| :------------- | :------------------------------------- | :-------------------------------------------------- |
| **Pre-Adhan**  | Reminder announcement before the Adhan | Start time minus configurable offset (0–60 minutes) |
| **Adhan**      | The call to prayer                     | Exact prayer start time                             |
| **Pre-Iqamah** | Reminder before congregation begins    | Iqamah time minus configurable offset               |
| **Iqamah**     | Congregation announcement              | Calculated Iqamah time                              |

Sunrise supports only Pre-Adhan and Adhan events (no Iqamah).

### Audio Sources

Each trigger can be configured with one of three source types:

| Type     | Description                                                                                                      |
| :------- | :--------------------------------------------------------------------------------------------------------------- |
| **TTS**  | Text-to-Speech template (e.g., `"{minutes} minutes till {prayerArabic}"`). Generated by the Python microservice. |
| **File** | Path to a custom MP3 file uploaded via the File Manager.                                                         |
| **URL**  | An external URL pointing to an audio resource.                                                                   |

### Output Targets

Audio is dispatched to one or more targets simultaneously using a polymorphic Strategy pattern:

| Target          | Description                                                                         | Requirements                                               |
| :-------------- | :---------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| **Local**       | Plays audio on the server's physical output (3.5mm/HDMI) via `mpg123`.              | Linux host with ALSA. Docker requires `--device /dev/snd`. |
| **Browser**     | Broadcasts an SSE event to all connected dashboard clients for in-browser playback. | Always implicitly enabled.                                 |
| **VoiceMonkey** | Sends an HTTP request to the VoiceMonkey API for Amazon Alexa announcements.        | Requires HTTPS `BASE_URL`, valid API token, and device ID. |

### VoiceMonkey Audio Constraints

Alexa (via VoiceMonkey) enforces strict requirements on audio files. The system automatically validates all audio and stores compatibility metadata:

| Constraint      | Requirement                        |
| :-------------- | :--------------------------------- |
| **Format**      | MP3                                |
| **Bitrate**     | Maximum 48 kbps                    |
| **Sample Rate** | 16,000 Hz, 22,050 Hz, or 24,000 Hz |
| **File Size**   | Maximum 10 MB                      |
| **Duration**    | Maximum 90 seconds                 |

Non-compliant files are automatically skipped for VoiceMonkey targets with a logged warning.

## Non-Functional Features

### Resilience

- **Local Caching:** Fetches and stores the entire year's prayer schedule. The system continues to function for months without internet access.
- **Configuration Safety:** All settings changes are validated against a strict Zod schema before being persisted, preventing invalid configurations from crashing the system.
- **Atomic Writes:** Configuration is saved atomically to prevent corruption during power loss.

### Performance

- **Server-Sent Events (SSE):** Push-based real-time updates for clock synchronisation, system logs, and audio triggers — no polling lag.
- **Debouncing:** Prevents duplicate audio triggers and API spamming.
- **Rate Limiting:** Tiered rate limiting protects all endpoints from abuse.

### Security

- **Authentication:** HttpOnly cookies with JWT for secure session management.
- **Token Versioning:** Password changes immediately invalidate all existing sessions.
- **Secret Management:** Sensitive tokens are encrypted at rest using AES-256-GCM and stored in configuration. Critical secrets (JWT, encryption salt) reside exclusively in environment variables.
- **DNS Rebinding Protection:** URL validation uses pinned DNS agents to prevent SSRF attacks.
- **Helmet:** HTTP security headers enforced via the Helmet middleware.

### Accessibility

- **Screen Wake Lock:** Keeps the display active for kiosk/signage deployments (requires HTTPS).
- **Keyboard Navigation:** Arrow keys navigate between dates; all interactive elements are keyboard-accessible.
- **ARIA Labels:** Navigation controls include descriptive `aria-label` attributes.
