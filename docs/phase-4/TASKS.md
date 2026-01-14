# Project Tasks

## Task 1: Backend Auth Infrastructure
- **Status:** done
- **Priority:** high
- **Dependencies:** []
- **Description:** Implement the core authentication mechanisms using JWT and Cookies to secure the settings routes.
- **Details:**
  - Install `jsonwebtoken` and `cookie-parser`.
  - Configure `ADMIN_PASSWORD` validation from `.env`.
  - Create `authenticateToken` middleware to verify JWT from HttpOnly cookie.
  - Implement `POST /api/auth/login` (Issue JWT).
  - Implement `POST /api/auth/logout` (Clear Cookie).
  - Protect all `POST /api/settings/*` routes with the middleware.
- **Test Strategy:**
  - Unit test: Middleware rejects requests without cookie.
  - Unit test: Login returns 200 and Set-Cookie header on correct password.
  - Integration: Attempting to POST to settings without auth returns 401.
- **Subtasks:**
  - 1.1: Install Dependencies & Config - **Status:** done - **Dependencies:** []
  - 1.2: Implement Auth Middleware - **Status:** done - **Dependencies:** [1.1]
  - 1.3: Create Login/Logout Endpoints - **Status:** done - **Dependencies:** [1.2]
  - 1.4: Apply Middleware to Routes - **Status:** done - **Dependencies:** [1.3]

## Task 2: Config Schema & Logic Expansion
- **Status:** done
- **Priority:** high
- **Dependencies:** [1]
- **Description:** Update the Zod configuration schema and core services to support global automation switches and per-prayer overrides.
- **Details:**
  - Update `src/config/index.js` schema:
    - Add `automation.global` object (enabled, preAdhanEnabled, etc.).
    - Add `prayers.[id].iqamahOverride` (boolean).
  - Update `schedulerService.js`: Check global flags before scheduling jobs.
  - Update `prayerTimeService.js`: Use override logic for Iqamah calculation if flag is true.
  - Update `calculations.js`: Ensure logic handles forced override correctly.
- **Test Strategy:**
  - Unit test: Config loader validates new fields correctly.
  - Unit test: Scheduler skips jobs when `global.enabled` is false.
  - Integration: Setting `iqamahOverride: true` ignores API data.
- **Subtasks:**
  - 2.1: Update Zod Schema - **Status:** done - **Dependencies:** []
  - 2.2: Update Scheduler Logic (Global Switches) - **Status:** done - **Dependencies:** [2.1]
  - 2.3: Update Prayer/Calculation Logic (Overrides) - **Status:** done - **Dependencies:** [2.1]

## Task 3: Backend API System Tools
- **Status:** done
- **Priority:** medium
- **Dependencies:** [1]
- **Description:** Implement new endpoints for file management, system diagnostics, and audio testing.
- **Details:**
  - `GET /api/system/audio-files`: Scan `public/audio/{custom,cache}` and return list.
  - `GET /api/system/jobs`: Return mapped list of active `node-schedule` jobs.
  - `POST /api/system/regenerate-tts`: Trigger `audioAssetService` rebuild.
  - `POST /api/system/test-audio`: Trigger local playback of specific file.
  - `DELETE /api/settings/files`: Endpoint to delete custom files.
- **Test Strategy:**
  - Integration: `GET /audio-files` returns JSON list of existing MP3s.
  - Integration: `POST /test-audio` triggers `mpg123` on server (mocked).
- **Subtasks:**
  - 3.1: File Listing Endpoint - **Status:** done - **Dependencies:** []
  - 3.2: Jobs Inspection Endpoint - **Status:** done - **Dependencies:** []
  - 3.3: System Actions (Regen/Test/Delete) - **Status:** done - **Dependencies:** []

## Task 4: Frontend Auth & Layout Foundation
- **Status:** done
- **Priority:** high
- **Dependencies:** [1]
- **Description:** specific React components for Authentication and the main Sidebar layout structure.
- **Details:**
  - Create `AuthProvider` context (check auth status on mount).
  - Create `LoginView`: Form with password input, error handling.
  - Create `ProtectedRoute`: Wrapper to redirect unauthenticated users.
  - Create `SettingsLayout`: Sidebar navigation (Desktop) / Hamburger (Mobile), Logout button.
  - Update `App.jsx` routing to wrap `/settings/*` in layout and protection.
- **Test Strategy:**
  - Manual: Access `/settings` -> Redirects to `/login`.
  - Manual: Login -> Redirects to `/settings/general`.
  - Manual: Refresh page -> Session persists.
- **Subtasks:**
  - 4.1: Auth Context & Login View - **Status:** done - **Dependencies:** []
  - 4.2: Protected Route Wrapper - **Status:** done - **Dependencies:** [4.1]
  - 4.3: Sidebar Layout Component - **Status:** done - **Dependencies:** []

## Task 5: Frontend - General & Automation Settings
- **Status:** done
- **Priority:** medium
- **Dependencies:** [4, 2]
- **Description:** Implement the settings views for General config and Global Automation switches.
- **Details:**
  - Create `SettingsProvider`: Fetch config on mount, handle "dirty" state, provide `saveConfig` function.
  - `GeneralSettingsView`:
    - Source Selector (Aladhan/MyMasjid).
    - Location inputs.
  - `AutomationSettingsView`:
    - Global Master Switches (Toggle components).
    - VoiceMonkey Token inputs (Password fields).
- **Test Strategy:**
  - Manual: Change Source -> Save -> Verify config file updated on server.
  - Manual: Toggle Master Switch -> Verify Scheduler updates via Dev Tools.
- **Subtasks:**
  - 5.1: Settings Context Provider - **Status:** done - **Dependencies:** []
  - 5.2: General Settings View - **Status:** done - **Dependencies:** [5.1]
  - 5.3: Automation Settings View - **Status:** done - **Dependencies:** [5.1]

## Task 6: Frontend - Prayer Settings (Deep Dive)
- **Status:** done
- **Priority:** high
- **Dependencies:** [5]
- **Description:** Build the complex per-prayer configuration interface.
- **Details:**
  - Layout: Top Pill Navigation (Fajr, Dhuhr, etc.).
  - Logic: Show "Warning Banner" if overrides active on MyMasjid.
  - Triggers UI:
    - Reusable `TriggerCard` component.
    - Enable Toggle.
    - Audio Source Selector (File list from Task 3).
    - Target Checkboxes.
  - Iqamah Calculation UI: Offset/Fixed Time inputs.
- **Test Strategy:**
  - Manual: Select custom file for Fajr Adhan -> Save -> Verify playback.
  - Manual: Change Iqamah Fixed Time -> Verify Override Flag set to true.
- **Subtasks:**
  - 6.1: Prayer Navigation & State - **Status:** pending - **Dependencies:** []
  - 6.2: Trigger Configuration Component - **Status:** pending - **Dependencies:** [6.1]
  - 6.3: Iqamah Logic & Overrides UI - **Status:** pending - **Dependencies:** [6.1]

## Task 7: Frontend - File Manager
- **Status:** done
- **Priority:** medium
- **Dependencies:** [3, 4]
- **Description:** Build the interface for managing audio assets.
- **Details:**
  - `FileManagerView`.
  - Fetch list from `/api/system/audio-files`.
  - Drag-and-drop Upload Zone (POST to `/api/settings/upload`).
  - File List Item: Play Button (Browser), Test Server Button, Test VM Button, Delete Button.
- **Test Strategy:**
  - Manual: Upload file -> Appears in list.
  - Manual: Click "Test on Server" -> Audio plays on host.
- **Subtasks:**
  - 7.1: File List & Preview UI - **Status:** pending - **Dependencies:** []
  - 7.2: Upload Functionality - **Status:** pending - **Dependencies:** [7.1]

## Task 8: Frontend - Developer Tools
- **Status:** done
- **Priority:** low
- **Dependencies:** [3, 4]
- **Description:** Implement system diagnostics and maintenance tools.
- **Details:**
  - `DeveloperSettingsView`.
  - Jobs Table: Fetch and display active schedule.
  - Actions: Buttons for "Regenerate TTS" and "Restart Scheduler".
  - Logs: Embed the existing `LogConsole` component here.
- **Test Strategy:**
  - Manual: Click Regenerate TTS -> Watch Logs for activity.
  - Manual: Verify Jobs table matches expected schedule.
- **Subtasks:**
  - 8.1: Jobs Inspector UI - **Status:** pending - **Dependencies:** []
  - 8.2: System Actions & Logs - **Status:** pending - **Dependencies:** []

## Task 9: Final Integration & Cleanup
- **Status:** pending
- **Priority:** high
- **Dependencies:** [1, 2, 3, 4, 5, 6, 7, 8]
- **Description:** Perform full end-to-end testing and code cleanup.
- **Details:**
  - Verify "Safe Hot Reload" (Server doesn't crash on bad config).
  - Verify Auth Token expiry behavior.
  - Ensure all UI states sync with Backend.
- **Test Strategy:**
  - Full regression test of User Stories.
- **Subtasks:**
  - 9.1: E2E Verification - **Status:** pending - **Dependencies:** []
  - 9.2: Cleanup & Documentation - **Status:** pending - **Dependencies:** []