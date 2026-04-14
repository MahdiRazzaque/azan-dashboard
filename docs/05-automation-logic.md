# 5. Automation Logic

This document details the internal mechanisms that drive the Azan Dashboard's automation features: how it schedules events, resolves audio sources, dispatches to output targets, and generates speech audio.

## Overview

The automation pipeline follows a clear flow:

```
Scheduler → Trigger Event → Source Resolution → Output Dispatch
    ↑                              ↓
    └── Midnight Refresh ←── TTS Microservice (if source = TTS)
```

1. The **Scheduler** creates precise time-based jobs from today's prayer data.
2. When a job fires, it calls the **Automation Service** with the trigger event details.
3. The Automation Service **resolves the audio source** (TTS file, custom MP3, or URL).
4. The resolved audio is **dispatched to all configured output targets** simultaneously.

---

## The Scheduler

The `schedulerService.js` is the heart of the automation system. It uses `node-schedule` for precision job scheduling, not simple intervals.

### Lifecycle

#### 1. Initialisation

On server startup (after the prayer cache is populated), the scheduler:

1. Fetches today's prayer times from the `prayerTimeService`.
2. Reads the automation configuration from `ConfigService`.
3. Checks the global automation switch (`automation.global.enabled`).

#### 2. Job Creation

The scheduler iterates through every prayer (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha) and every configured trigger event (Pre-Adhan, Adhan, Pre-Iqamah, Iqamah):

| Event          | Time Calculation                                                        |
| :------------- | :---------------------------------------------------------------------- |
| **Adhan**      | Exact prayer start time from the provider                               |
| **Pre-Adhan**  | Prayer start time **minus** `offsetMinutes` (configurable 0–60 minutes) |
| **Iqamah**     | Calculated via offset + rounding, or a fixed time override              |
| **Pre-Iqamah** | Iqamah time **minus** `offsetMinutes`                                   |

> [!NOTE]
> Sunrise supports only **Pre-Adhan** and **Adhan** events. It has no Iqamah.

For each event, the scheduler:

1. Checks the global toggle for that event type (e.g., `automation.global.adhanEnabled`).
2. Checks the per-prayer toggle (e.g., `automation.triggers.fajr.adhan.enabled`).
3. Verifies the calculated time is in the **future** (past events are skipped).
4. Creates a `node-schedule` job set to fire at the exact calculated time.

#### 3. Execution

When a scheduled job fires:

1. The scheduler calls `automationService.triggerEvent()` with the prayer name, event type, and configuration.
2. The automation service resolves the audio source and dispatches to targets (see sections below).

#### 4. Midnight Refresh

A dedicated maintenance job runs at **00:00** every day:

1. Cancels all pending prayer-related jobs from the previous day.
2. Fetches the new day's prayer times from the cache.
3. Creates fresh jobs for the current day's schedule.

This ensures the system automatically transitions to the next day's timetable without manual intervention.

#### 5. Hot Reload

When a user updates settings via the Admin Panel:

1. All pending jobs are **cancelled** immediately.
2. The configuration is re-read from disk.
3. The scheduler **re-initialises**, creating new jobs based on the updated configuration.

This happens within the `configurationWorkflowService.executeUpdate()` flow, ensuring that changes (e.g., modifying an Iqamah offset from 10 to 15 minutes) take effect immediately without requiring a server restart.

---

## Iqamah Calculation Logic

The system supports complex rules for determining the congregation time for each prayer.

### Calculation Modes

| Mode                  | Description                            | Example                                 |
| :-------------------- | :------------------------------------- | :-------------------------------------- |
| **Dynamic Offset**    | Prayer start time + configured offset  | Maghrib at 18:03 + 10 minutes = 18:13   |
| **Fixed Time**        | Hardcoded time (ignores sun position)  | Isha fixed at 20:00                     |
| **Provider Override** | Uses the provider's native Iqamah time | MyMasjid provides its own Iqamah values |

### Rounding

When using **Dynamic Offset**, the calculated result is rounded **up** to the next configured interval:

| `roundTo`  | Calculation        | Result    |
| :--------- | :----------------- | :-------- |
| 5 minutes  | 18:03 + 10 = 18:13 | **18:15** |
| 10 minutes | 18:03 + 10 = 18:13 | **18:20** |
| 15 minutes | 18:03 + 10 = 18:13 | **18:15** |

Rounding always rounds **up** (ceiling), never down, to ensure the congregation never starts before the calculated time.

### Provider Override (`iqamahOverride`)

When the `iqamahOverride` flag is set to `true` for a prayer, the system bypasses all offset and rounding logic and uses the provider's native Iqamah time directly. This is primarily useful with the **MyMasjid** provider, which publishes mosque-specific Iqamah times.

---

## Audio Pipeline

When a scheduled job fires, the automation service executes the following pipeline:

### 1. Source Resolution

The system determines **what** to play based on the trigger's `type` configuration:

| Type       | Resolution                                       | Location               |
| :--------- | :----------------------------------------------- | :--------------------- |
| **`tts`**  | Resolves the TTS template to a cached audio file | `public/audio/cache/`  |
| **`file`** | Resolves the path to a user-uploaded MP3         | `public/audio/custom/` |
| **`url`**  | Uses the provided external URL directly          | Remote HTTP(S)         |

#### TTS Template Resolution

TTS templates contain placeholder variables that are resolved at generation time:

| Placeholder       | Resolved Value              | Example |
| :---------------- | :-------------------------- | :------ |
| `{prayer}`        | English prayer name         | `Fajr`  |
| `{prayerArabic}`  | Arabic prayer name          | `الفجر` |
| `{prayerEnglish}` | English prayer name (alias) | `Fajr`  |
| `{minutes}`       | Minutes until the event     | `15`    |

**Example:** The template `"{minutes} minutes till {prayerArabic}"` resolves to `"15 minutes till الفجر"` for a Pre-Adhan event with a 15-minute offset.

### 2. Target Routing (Output Strategy System)

Audio is dispatched to one or more targets simultaneously using the polymorphic **Strategy** pattern. The `automationService` delegates execution to the `OutputFactory`, which loads the appropriate handler for each target listed in the trigger's `targets` array.

#### Built-in Strategies

| Target          | Mechanism                                                                        | Requirements                                          |
| :-------------- | :------------------------------------------------------------------------------- | :---------------------------------------------------- |
| **Local**       | Executes `mpg123` to play audio on the server's physical speakers (3.5mm / HDMI) | Linux with ALSA. Docker: `--device /dev/snd`          |
| **Browser**     | Broadcasts an `AUDIO_PLAY` SSE event to all connected dashboard clients          | Always implicitly enabled (no configuration required) |
| **VoiceMonkey** | Sends an HTTP request to the VoiceMonkey API, which triggers Alexa announcements | HTTPS `BASE_URL`, valid API token, device ID          |

#### Execution Flow

```
automationService.triggerEvent()
  │
  ├── Resolve audio source (TTS / File / URL)
  │
  ├── For each target in trigger.targets:
  │     ├── OutputFactory.getStrategy(targetId)
  │     ├── Validate audio asset compatibility (strategy.validateAsset)
  │     ├── Apply lead time offset (if configured)
  │     └── strategy.execute(payload, metadata)
  │
  └── Browser (implicit) → sseService.broadcast('AUDIO_PLAY', audioUrl)
```

#### Lead Time

Each output strategy can have a configurable `leadTimeMs` (range: −30,000 to +30,000 milliseconds). This adjusts the trigger time relative to the scheduled event:

- **Positive value:** Triggers the output _earlier_ (e.g., +5000ms means the audio starts 5 seconds before the scheduled time).
- **Negative value:** Triggers the output _later_.
- **Use case:** VoiceMonkey has inherent cloud API latency. A positive lead time compensates for this delay so the announcement arrives on time.

#### Strategy Self-Containment

Each output strategy is fully self-contained and defines its own:

| Capability             | Description                                                                      |
| :--------------------- | :------------------------------------------------------------------------------- |
| **Health Checks**      | Verifies hardware presence (e.g., `/dev/snd`) or API connectivity                |
| **Configuration**      | Manages specific parameters (tokens, device IDs) with sensitivity flags          |
| **Asset Validation**   | Checks audio file compatibility (e.g., VoiceMonkey bitrate/duration constraints) |
| **Safety Constraints** | Enforces execution timeouts and lead-time limits                                 |

### 3. VoiceMonkey Audio Constraints

Alexa (via VoiceMonkey) enforces strict requirements on audio files. The system automatically validates all audio and stores compatibility metadata in sidecar JSON files:

| Constraint      | Requirement                        |
| :-------------- | :--------------------------------- |
| **Format**      | MP3                                |
| **Bitrate**     | Maximum 48 kbps                    |
| **Sample Rate** | 16,000 Hz, 22,050 Hz, or 24,000 Hz |
| **File Size**   | Maximum 10 MB                      |
| **Duration**    | Maximum 90 seconds                 |

If a file violates these constraints, the system skips the VoiceMonkey target for that trigger and logs a warning:

```
[Automation] Skipped VoiceMonkey for {file}: Audio properties violate Alexa requirements.
```

> [!IMPORTANT]
> VoiceMonkey requires an **HTTPS Base URL** (`BASE_URL` environment variable) to fetch audio assets. If the server is using an insecure URL or is offline, VoiceMonkey targets are automatically skipped.

---

## TTS Microservice Integration

The Python TTS microservice generates natural-sounding speech audio using Microsoft's Neural TTS engine (`edge-tts`). It runs as a sidecar process — in Docker, both processes are managed by Supervisord.

### Microservice Endpoints

| Method | Endpoint        | Purpose                                                          |
| :----- | :-------------- | :--------------------------------------------------------------- |
| `GET`  | `/voices`       | Returns the list of available TTS voices (cached by the backend) |
| `POST` | `/generate-tts` | Generates an MP3 file from text and voice parameters             |
| `POST` | `/preview-tts`  | Generates a temporary preview MP3 (cleaned up automatically)     |

### TTS Generation Workflow

![Configuration Save Lifecycle Sequence](./images/save-lifecycle-sequence.png)
_Figure 1: The settings save lifecycle, including TTS audio synchronisation._

#### Trigger Conditions

TTS generation is triggered when:

1. The user saves configuration changes (via the settings update workflow).
2. The user clicks **Regenerate TTS** in the Developer Settings.
3. The system starts up and detects missing TTS files during the audio asset sync.

#### Generation Pipeline

1. **Scan Configuration:** `audioAssetService.syncAudioAssets()` iterates through all prayers and trigger events in the configuration.
2. **Filter TTS Triggers:** Only triggers with `type: "tts"` and `enabled: true` are processed.
3. **Resolve Template:** The template string is parsed and placeholders are replaced with actual values (e.g., `{prayerArabic}` → `الفجر`).
4. **Check Cache:** The system checks if an audio file with identical text content already exists in `public/audio/cache/`. Filenames encode the prayer, event, and a hash of the resolved text.
5. **Generate Audio:** If no cached file exists, a `POST` request is sent to the Python microservice at `PYTHON_SERVICE_URL/generate-tts` with the resolved text and configured voice (default: `ar-SA-HamedNeural`).
6. **Store Result:** The generated MP3 is saved to `public/audio/cache/` with a sidecar metadata JSON file containing audio properties (duration, bitrate, sample rate, VoiceMonkey compatibility).
7. **Cleanup Orphans:** Audio files in the cache that no longer correspond to any active trigger configuration are deleted.

### Sidecar Metadata

Every audio file (both uploaded and generated) has a companion `.json` metadata file stored in `src/public/audio/` (a non-publicly-served directory). This metadata includes:

| Field                   | Description                               |
| :---------------------- | :---------------------------------------- |
| `duration`              | Audio length in seconds                   |
| `bitrate`               | Audio bitrate in kbps                     |
| `sampleRate`            | Sample rate in Hz                         |
| `mimeType`              | Detected MIME type                        |
| `voiceMonkeyCompatible` | Boolean indicating Alexa compatibility    |
| `issues`                | Array of compatibility issue descriptions |
| `lastChecked`           | ISO timestamp of the last validation      |

---

## Event Flow Summary

The complete flow from configuration to audio playback:

```
User saves settings
  └─ configurationWorkflowService.executeUpdate()
       ├─ Validate config against Zod schema
       ├─ Save to local.json (atomic write)
       ├─ audioAssetService.syncAudioAssets()
       │    ├─ Scan triggers for TTS sources
       │    ├─ Resolve templates
       │    ├─ Generate missing audio via Python TTS
       │    └─ Cleanup orphaned cache files
       └─ schedulerService.initScheduler()
            ├─ Cancel all existing jobs
            ├─ Fetch today's prayer times
            └─ Create jobs for each enabled trigger
                 │
                 └─ [At scheduled time]
                      └─ automationService.triggerEvent()
                           ├─ Resolve audio source
                           ├─ Dispatch to each output target
                           │    ├─ Local → mpg123 playback
                           │    ├─ VoiceMonkey → HTTP API call
                           │    └─ Browser → SSE broadcast
                           └─ Log result via SSE
```
