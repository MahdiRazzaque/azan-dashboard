# Product Requirements Document: Phase 3 - Automation & Audio Architecture

## 1. Introduction
This document outlines the requirements for **Phase 3** of the Azan Dashboard project. Having established the Data Layer (Phase 1) and the Presentation Layer (Phase 2), Phase 3 focuses on the **Automation Layer**. This phase transforms the application from a passive display into an active home automation hub capable of announcing prayer times via local speakers, web browsers, and external smart devices (Alexa).

## 2. Product Overview
The system will now include a robust **Job Scheduler** and a dedicated **Audio Generation Microservice**.
*   **Node.js Backend:** Handles scheduling, logic, configuration management, and dispatches audio commands.
*   **Python Microservice:** A lightweight FastAPI server wrapping `edge-tts` to generate high-quality Arabic/English speech.
*   **Audio Targets:** The system orchestrates audio playback across three targets:
    1.  **Local:** Physical audio output (3.5mm jack/HDMI) on the server hardware.
    2.  **Browser:** Web Audio API playback on the dashboard client.
    3.  **VoiceMonkey:** Sending public URLs of generated audio to Alexa devices.

## 3. Goals and Objectives
*   **Precise Timing:** Trigger Azan and announcements exactly in sync with the dashboard clock.
*   **High-Quality TTS:** Generate natural-sounding Arabic audio (e.g., "الفجر") using Microsoft Edge TTS, avoiding the robotic quality of standard VoiceMonkey TTS.
*   **Multi-Target Flexibility:** Allow users to toggle audio targets (Local, Browser, Alexa) independently for every event.
*   **Granularity:** Support four distinct trigger events per prayer: *Pre-Adhan*, *Adhan*, *Pre-Iqamah*, and *Iqamah*.
*   **Observability:** Provide real-time logs (Server-Sent Events) to the frontend so users can see when automation triggers fire.

## 4. Target Audience
*   **Home Users:** Using the system on a Raspberry Pi/Home Server connected to speakers and Alexa.
*   **Mosque Admins:** Automating internal PA systems (Local) and visual displays (Browser).

## 5. Features and Requirements

### 5.1 Architecture & Services
*   **FR-01: Python Microservice (Edge-TTS)**
    *   A separate process (FastAPI) MUST listen on a local port (e.g., `8000`).
    *   Endpoint: `POST /generate-tts`. Body: `{ text: string, voice: string, filename: string }`.
    *   Action: Execute `edge-tts`, write the MP3 to a shared volume/folder, and return the path.
*   **FR-02: Node.js Scheduler Service**
    *   Library: `node-schedule`.
    *   The scheduler MUST recalculate jobs at midnight and upon any Configuration change.
    *   Jobs MUST be scheduled using the configured `location.timezone`.
*   **FR-03: Audio Asset Service**
    *   **Daily Prep:** At midnight (or startup), the service MUST identify all required TTS strings for the day (e.g., "Fifteen minutes till Fajr").
    *   **Generation:** It MUST call the Python Microservice to generate these files *ahead of time* and store them in `public/audio/cache/`.
    *   **Cleanup:** It MUST delete cached files unreferenced for > 30 days.

### 5.2 Automation Logic
*   **FR-04: Event Triggers**
    *   For each prayer (Fajr, Dhuhr, Asr, Maghrib, Isha), the system MUST support 4 events:
        1.  **Pre-Adhan:** `x` minutes before Start.
        2.  **Adhan:** At Start time.
        3.  **Pre-Iqamah:** `x` minutes before Iqamah.
        4.  **Iqamah:** At Iqamah time.
*   **FR-05: Trigger Actions**
    *   Each event MUST support three Action Types:
        1.  **TTS:** Generate speech from a template (e.g., "{minutes} minutes till {prayerArabic}").
        2.  **File:** Play a specific uploaded MP3 (e.g., `adhan_makkah.mp3`).
        3.  **URL:** Play from an external URL.
*   **FR-06: Target Routing**
    *   Each event MUST define active targets: `['local', 'browser', 'voiceMonkey']`.
    *   **Local:** Execute command (e.g., `mpg123 /path/to/file.mp3`).
    *   **Browser:** Send WebSocket/SSE event `{ type: 'play', url: '/audio/...' }` to the frontend.
    *   **VoiceMonkey:** Construct the **Public URL** of the file (e.g., `https://my-server.com/audio/cache/x.mp3`) and send it to the VoiceMonkey API.

### 5.3 Configuration & API
*   **FR-07: Configuration Schema**
    *   The `config/default.json` schema MUST be expanded to include `automation` settings (see Section 8).
    *   Secrets (VoiceMonkey Tokens) MUST be loaded from `process.env` (using `dotenv`).
*   **FR-08: File Upload API**
    *   Endpoint: `POST /api/settings/upload`.
    *   Middleware: `multer`.
    *   Storage: Save files to `public/audio/custom/`.
    *   Validation: Accept `.mp3` only, max size 10MB.
*   **FR-09: Config Update API**
    *   Endpoint: `POST /api/settings/update`.
    *   Action: Validate JSON, write to `config/local.json` (overlay), and trigger a **Hot Reload** of the Scheduler.

### 5.4 Logging & Health
*   **FR-10: Server-Sent Events (SSE)**
    *   Endpoint: `GET /api/logs`.
    *   The server MUST stream text logs to connected clients (e.g., "Generating TTS...", "Triggering Maghrib Adhan").
*   **FR-11: Startup Health Check**
    *   On boot, check connectivity to the Python Microservice.
    *   Check for existence of `mpg123` (or configured player).
    *   If failed, log critical error but DO NOT crash the visual dashboard.

## 6. User Stories and Acceptance Criteria

### US-1: Smart Announcements
**As a** user,
**I want** my system to say "Fifteen minutes till Al-Fajr" (in Arabic pronunciation) on my Alexa,
**So that** I am reminded to prepare for prayer with high-quality audio.

*   **AC-1:** The system uses `edge-tts` to generate an MP3 file containing the Arabic prayer name.
*   **AC-2:** The system constructs a valid public URL for this file.
*   **AC-3:** Alexa plays the specific file (not standard Alexa voice).

### US-2: Local & Browser Sync
**As a** mosque admin,
**I want** the Adhan to play from the TV speakers (Browser) and the PA system (Local) simultaneously,
**So that** everyone inside and outside the hall can hear it.

*   **AC-1:** Config `fajr.adhan.targets` includes `["local", "browser"]`.
*   **AC-2:** At 05:00:00, the server executes the local audio command.
*   **AC-3:** At 05:00:00, the dashboard receives a play signal and plays the audio via HTML5 Audio.

### US-3: Configuration Management
**As a** user,
**I want** to upload my own `iqamah_beep.mp3` and set it to play 5 minutes before every Iqamah,
**So that** the congregation knows the prayer is about to start.

*   **AC-1:** User can upload the file via API (UI deferred to Phase 4).
*   **AC-2:** User can update config to point `preIqamah` trigger to this filename.
*   **AC-3:** Scheduler updates immediately without server restart.

## 7. Technical Requirements / Stack

*   **Node.js Backend:**
    *   `node-schedule`: Job scheduling.
    *   `axios`: HTTP requests to Python service/VoiceMonkey.
    *   `play-sound`: Wrapper for local audio commands.
    *   `multer`: File uploads.
    *   `dotenv`: Environment variables.
    *   `number-to-words`: Text processing.
*   **Python Microservice:**
    *   `fastapi`: Web server.
    *   `uvicorn`: ASGI server.
    *   `edge-tts`: The core TTS engine.
*   **Infrastructure:**
    *   `public/audio/cache`: Auto-generated files.
    *   `public/audio/custom`: User-uploaded files.

## 8. Data & Configuration Structure

### 8.1 Expanded Config (`automation`)
```json
{
  "automation": {
    "enabled": true,
    "baseUrl": "https://my-dashboard.com", // For VoiceMonkey URLs
    "audioPlayer": "mpg123",
    "pythonServiceUrl": "http://localhost:8000",
    "triggers": {
      "fajr": {
        "preAdhan": {
          "enabled": true,
          "offsetMinutes": 15,
          "type": "tts",
          "template": "{minutes} minutes till {prayerArabic}",
          "targets": ["voiceMonkey"]
        },
        "adhan": {
          "enabled": true,
          "type": "file",
          "path": "custom/makkah_adhan.mp3",
          "targets": ["local", "browser", "voiceMonkey"]
        }
      }
      // ... repeated for dhuhr, asr, etc.
    }
  }
}
```

## 9. Design and User Interface (Frontend)
*   **Phase 3 Scope:**
    *   **Logs Console:** A simple scrolling `<div>` in the dashboard footer subscribing to `/api/logs`.
    *   **Audio Overlay:** A "Click to Start Audio" button covering the screen on load (required to unlock Web Audio API).
*   **Phase 4 Scope (Deferred):**
    *   Settings Form / Admin Panel UI.
    *   File Upload UI.

## 10. Open Questions / Assumptions
*   **Assumption:** The server has a Public IP/Domain (`baseUrl`) configured in the `.env` or config file. Without this, VoiceMonkey/Alexa features will fail.
*   **Assumption:** The host OS has `mpg123` or equivalent installed.
*   **Assumption:** Python 3.x is installed on the host machine.