# Project Tasks

## Task 1: Environment & Dependency Setup
- **Status:** done
- **Priority:** high
- **Dependencies:** []
- **Description:** Install necessary Node.js packages, set up the Python environment for the microservice, and configure environment variables.
- **Details:**
  - Node.js: Install `node-schedule`, `axios`, `play-sound`, `multer`, `dotenv`, `number-to-words`.
  - Python: Install `fastapi`, `uvicorn`, `edge-tts`.
  - Create `.env` file for secrets (e.g., VoiceMonkey tokens, Base URL) and add `.env.example`.
  - Ensure `mpg123` (or equivalent) is installed on the host system.
- **Test Strategy:**
  - Verify `package.json` updates.
  - Verify Python environment can run a basic script.
  - Verify `process.env` loads variables correctly in a test script.
- **Subtasks:**
  - 1.1: Install Node.js dependencies - **Status:** done - **Dependencies:** []
  - 1.2: Setup Python environment & dependencies - **Status:** done - **Dependencies:** []
  - 1.3: Configure .env and secrets loader - **Status:** done - **Dependencies:** []

## Task 2: Configuration Schema Expansion
- **Status:** done
- **Priority:** high
- **Dependencies:** [1]
- **Description:** Expand the existing configuration system to support automation settings, triggers, and audio targets.
- **Details:**
  - Update `src/config/index.js` (Zod schema) to include the `automation` object as defined in PRD Section 8.
  - Update `config/default.json` with default automation settings (disabled by default).
  - Ensure sensitive data (like VoiceMonkey tokens) is pulled from `process.env` during config loading.
- **Test Strategy:**
  - Unit test: Validate a full config object against the new Zod schema.
  - Unit test: Ensure config loads defaults correctly when `.env` is missing optional values.
- **Subtasks:**
  - 2.1: Update default.json structure - **Status:** done - **Dependencies:** []
  - 2.2: Update Zod schema in config loader - **Status:** done - **Dependencies:** [2.1]

## Task 3: Python Microservice (Edge-TTS)
- **Status:** done
- **Priority:** high
- **Dependencies:** [1]
- **Description:** Create the lightweight FastAPI service to handle TTS generation requests.
- **Details:**
  - Create a directory `src/microservices/tts`.
  - Implement `server.py` using FastAPI.
  - Create endpoint `POST /generate-tts` accepting `{ text, voice, filename }`.
  - Implement logic to execute `edge-tts` CLI and save the output to a shared volume/folder (e.g., `public/audio/cache`).
- **Test Strategy:**
  - Run the python server. Send a curl POST request. Verify an MP3 file is created in the expected folder and contains the spoken text.
- **Subtasks:**
  - 3.1: Scaffold FastAPI server - **Status:** done - **Dependencies:** []
  - 3.2: Implement edge-tts wrapper logic - **Status:** done - **Dependencies:** [3.1]

## Task 4: Audio Asset Service (Node.js)
- **Status:** done
- **Priority:** high
- **Dependencies:** [2, 3]
- **Description:** Implement the service responsible for preparing, caching, and cleaning up audio files.
- **Details:**
  - Create `src/services/audioAssetService.js`.
  - Implement `prepareDailyAssets(prayers)`:
    - Iterate through prayer times.
    - Resolve templates (e.g., "{minutes} minutes till...").
    - Use `number-to-words` for English numbers.
    - Map English prayer names to Arabic (e.g., Fajr -> الفجر).
    - Call the Python Microservice to generate MP3s.
  - Implement `cleanupCache()`: Delete files in `public/audio/cache` older than 30 days.
- **Test Strategy:**
  - Unit test: Call `prepareDailyAssets` with mocked data. Verify calls to Python service.
  - Verify files are created in `public/audio/cache`.
- **Subtasks:**
  - 4.1: Implement text processing (Templates & Translation) - **Status:** done - **Dependencies:** []
  - 4.2: Implement Python service integration (Axios) - **Status:** done - **Dependencies:** [3]
  - 4.3: Implement Cache Cleanup logic - **Status:** done - **Dependencies:** []

## Task 5: Scheduler & Automation Logic
- **Status:** done
- **Priority:** high
- **Dependencies:** [4]
- **Description:** Implement the core scheduling logic and the orchestration of triggers.
- **Details:**
  - Create `src/services/schedulerService.js` using `node-schedule`.
  - Logic to schedule jobs for: Pre-Adhan, Adhan, Pre-Iqamah, Iqamah based on Config.
  - Create `src/services/automationService.js` to handle Event execution.
  - Implement "Hot Reload": Function to cancel all existing jobs and reschedule based on new config.
- **Test Strategy:**
  - Unit test: Mock time and verify jobs are scheduled for correct offsets.
  - Integration: Trigger a "Hot Reload" and verify old jobs are cancelled and new ones created.
- **Subtasks:**
  - 5.1: Implement Job Scheduler (Midnight refresh) - **Status:** done - **Dependencies:** []
  - 5.2: Implement Trigger Event Logic (Pre/Adhan/Iqamah) - **Status:** done - **Dependencies:** [5.1]
  - 5.3: Implement Hot Reload functionality - **Status:** done - **Dependencies:** [5.1]

## Task 6: Audio Target Implementations
- **Status:** done
- **Priority:** medium
- **Dependencies:** [5]
- **Description:** Implement the specific logic for playing audio on Local, Browser, and VoiceMonkey targets.
- **Details:**
  - **Local:** Use `play-sound` to execute the system player command (from config).
  - **VoiceMonkey:** Construct public URL (`baseUrl` + file path) and send request to VoiceMonkey API.
  - **Browser:** Emit event (mechanism to be built in Task 9) to frontend.
- **Test Strategy:**
  - Local: Verify audio plays on server.
  - VoiceMonkey: Mock Axios request and verify URL construction.
- **Subtasks:**
  - 6.1: Implement Local Player logic - **Status:** done - **Dependencies:** []
  - 6.2: Implement VoiceMonkey/Public URL logic - **Status:** done - **Dependencies:** []

## Task 7: API Endpoints (Settings, Upload, Logs)
- **Status:** done
- **Priority:** medium
- **Dependencies:** [2, 6]
- **Description:** Create APIs for file uploads, config updates, and SSE logs.
- **Details:**
  - `POST /api/settings/upload`: Use `multer` to save to `public/audio/custom`.
  - `POST /api/settings/update`: Validate JSON, update `config/local.json`, trigger Scheduler Hot Reload.
  - `GET /api/logs`: Implement Server-Sent Events (SSE) logic to stream internal logs.
- **Test Strategy:**
  - Upload a file via Postman, verify it exists in `custom` folder.
  - Update config via API, verify Scheduler re-runs.
  - Connect to `/api/logs` and verify stream receives data.
- **Subtasks:**
  - 7.1: Implement File Upload Endpoint - **Status:** done - **Dependencies:** []
  - 7.2: Implement Config Update & Hot Reload trigger - **Status:** done - **Dependencies:** [5.3]
  - 7.3: Implement SSE Logs Endpoint - **Status:** done - **Dependencies:** []

## Task 8: Frontend Updates (Audio & Logs)
- **Status:** done
- **Priority:** medium
- **Dependencies:** [7]
- **Description:** Update the dashboard to handle audio playback and display logs.
- **Details:**
  - Add "Click to Start" overlay in `index.html` / `style.css`.
  - Update `app.js` to handle Audio Context initialization.
  - Implement SSE listener in `app.js` to handle:
    1. Log messages (display in footer).
    2. Play events (trigger HTML5 Audio).
- **Test Strategy:**
  - Open dashboard. Verify overlay appears. Click it.
  - Trigger a test log event from server. Verify it appears on screen.
  - Trigger a browser audio event. Verify sound plays.
- **Subtasks:**
  - 8.1: Implement Audio Context & Overlay - **Status:** done - **Dependencies:** []
  - 8.2: Implement SSE Client (Logs & Audio) - **Status:** done - **Dependencies:** [7.3]

## Task 9: System Integration & Health Checks
- **Status:** done
- **Priority:** medium
- **Dependencies:** [3, 4, 5, 6, 7, 8]
- **Description:** Final integration, startup health checks, and end-to-end verification.
- **Details:**
  - Implement `checkSystemHealth()` on startup (Python service reachability, `mpg123` check).
  - Verify `scheduler` calls `automationService` which calls `targets`.
  - Execute User Stories (US-1, US-2, US-3).
- **Test Strategy:**
  - Full End-to-End run.
  - Simulate Python service failure (should log error but not crash UI).
- **Subtasks:**
  - 9.1: Implement Startup Health Check - **Status:** done - **Dependencies:** []
  - 9.2: Perform User Story Verification - **Status:** done - **Dependencies:** []