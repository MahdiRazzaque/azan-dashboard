# 5. Automation Logic

This section details the internal mechanisms that drive the Azan Dashboard's "Smart" features, specifically how it handles time, scheduling, and audio generation.

## The Scheduler "Brain"
The `schedulerService.js` is the heart of the automation system. It does not rely on simple intervals; instead, it uses precise execution times calculated from the prayer data.

### Lifecycle
1.  **Initialisation:** On server start, the scheduler fetches today's prayer times from the `prayerTimeService`.
2.  **Job Creation:** It iterates through every prayer (Fajr, Sunrise, Dhuhr, etc.) and every configured event (Pre-Adhan, Adhan, Pre-Iqamah, Iqamah).
3.  **Calculation:**
    *   *Adhan:* Exact start time from API.
    *   *Pre-Adhan:* Start time minus `offsetMinutes`.
    *   *Iqamah:* Calculated based on "Fixed Time" (e.g., 20:00) or "Offset" (Start + 15m + Rounding).
4.  **Scheduling:** A `node-schedule` job is created for each valid future event.
5.  **Midnight Refresh:** A dedicated maintenance job runs at `00:00` every day to clear yesterday's jobs and load the schedule for the new day.

### Hot Reloading
When a user updates the settings (e.g., changing an offset from 10m to 15m), the `settingsController` triggers a **Hot Reload**.
1.  All pending jobs are cancelled.
2.  The configuration is re-read from disk.
3.  The scheduler re-initialises, creating new jobs based on the updated logic immediately.

## Audio Pipeline
When a scheduled job fires, it calls `automationService.triggerEvent()`. The audio is routed based on the configured targets.

### 1. Source Resolution
The system determines *what* to play:
*   **File:** Resolves the path to a custom MP3 in `public/audio/custom`.
*   **TTS:** Resolves the filename for the cached speech asset (e.g., `tts_fajr_preAdhan.mp3`).
*   **URL:** Uses the provided external URL.

### 2. Target Routing (Output Strategy System)
The audio is dispatched using a polymorphic **Strategy Pattern**. The `automationService` delegates execution to the `OutputFactory`, which loads the appropriate handler for each configured target. This architecture allows for modular, plug-and-play output integrations.

**Built-in Strategies:**
*   **Local:** Executes audio on the server hardware (default: `mpg123`). Ideal for Mosque local audio systems connected via AUX/HDMI.
*   **Browser:** Broadcasts an SSE event (`AUDIO_PLAY`) to all connected clients. (Implicitly always enabled).
*   **VoiceMonkey:** Sends an HTTP request to the VoiceMonkey API for Alexa announcements. Supports custom credential management and lead-time offsets.

**Strategy Capabilities:**
Each output strategy is self-contained and defines its own:
*   **Health Checks:** Verifies hardware presence (e.g., `/dev/snd`) or API connectivity.
*   **Configuration:** Manages specific parameters (tokens, device IDs) securely.
*   **Safety Constraints:** Enforces execution timeouts and lead-time limits (e.g., VoiceMonkey has a 5s max lead time constraint).

    > [!IMPORTANT]
    > VoiceMonkey requires an **HTTPS Base URL** (`BASE_URL`) to fetch audio assets. If the server is offline or using an insecure URL, VoiceMonkey targets will be automatically skipped.

### VoiceMonkey Audio Constraints
Alexa (via VoiceMonkey) has strict requirements for audio playback. The system automatically validates all audio files (TTS and Uploads) and stores compatibility metadata.

| Constraint | Requirement |
| :--- | :--- |
| **Format** | MP3 |
| **Bitrate** | Maximum 48 kbps |
| **Sample Rate** | 16000 Hz, 22050 Hz, or 24000 Hz |
| **File Size** | Maximum 10 MB |
| **Duration** | Maximum 90 seconds |

If a file violates these constraints, the system will prevent the VoiceMonkey API call and log a warning: `[Automation] Skipped VoiceMonkey for {file}: Audio properties violate Alexa requirements.`

![Configuration Save Lifecycle Sequence](./images/save-lifecycle-sequence.png)

## TTS Microservice Integration
To generate natural-sounding speech (especially for Arabic prayer names), the system uses a Python microservice.

### Workflow
1.  **Trigger:** User saves configuration or "Regenerate TTS" is clicked.
2.  **Analysis:** `audioAssetService` scans the config for all enabled TTS triggers.
3.  **Template Resolution:** It parses strings like `"{minutes} minutes till {prayerEnglish}"` -> `"15 minutes till Dhuhr"`.
4.  **Generation:**
    *   Checks if a file with this text already exists in `public/audio/cache`.
    *   If not, sends a POST request to the Python service (`/generate-tts`).
    *   The Python service uses `edge-tts` to create the MP3.
5.  **Result:** The file is saved, ready for zero-latency playback when the automation fires.

## Iqamah Calculation Logic
The system supports complex rules for determining the congregation time.

*   **Fixed Time:** Hardcoded time (e.g., Isha at 20:00). Ignores the sun position.
*   **Dynamic Offset:** Prayer Start + Offset (e.g., Maghrib + 10 mins).
*   **Rounding:** The result of the dynamic offset is rounded **UP** to the next configured interval (e.g., next 5, 10, or 15 minutes) to tidy up the schedule (e.g., 18:03 + 10m = 18:13 -> Rounds to 18:15).