# Product Requirements Document: Phase 4 - Administration & Control Panel

## 1. Introduction
This document outlines the requirements for **Phase 4** of the Azan Dashboard project. Following the successful implementation of the Data (Phase 1), Presentation (Phase 2), and Automation (Phase 3) layers, this phase focuses on the **Administration Layer**. It introduces a secure, comprehensive "Control Panel" allowing users to manage every aspect of the system—from prayer calculation sources to audio file management—without touching the codebase or configuration files manually.

## 2. Product Overview
The Phase 4 deliverable is a major expansion of the Frontend (`/client`) and Backend API (`src/routes/api.js`). It transforms the application from a read-only display into a fully interactive Content Management System (CMS). Key additions include a JWT-based authentication system, a modular Sidebar-based settings interface, advanced file management for audio assets, and developer tools for system maintenance.

## 3. Goals and Objectives
*   **Security:** Protect sensitive configuration routes using password authentication (JWT) to prevent unauthorised access.
*   **Usability:** Replace manual JSON editing with a user-friendly, form-based UI.
*   **Granularity:** Provide deep control over every trigger (Pre-Adhan, Adhan, Iqamah) including offsets, audio sources, and output targets.
*   **Reliability:** Ensure configuration changes are validated before saving to prevent system crashes ("Safe Hot Reload").
*   **Observability:** Give administrators visibility into active scheduler jobs and system logs.

## 4. Target Audience
*   **Mosque Administrators:** Non-technical users who need to upload new Adhan files or adjust Iqamah times quickly using a tablet or laptop.
*   **Home Lab Users:** Technical users who want to tweak automation rules and monitor system health.

## 5. Features and Requirements

### 5.1 Authentication & Security
*   **FR-01: Login System**
    *   The system MUST present a Login Screen when accessing `/settings` if not authenticated.
    *   The user MUST authenticate using a single **Admin Password** defined in the server environment variables (`ADMIN_PASSWORD`).
*   **FR-02: JWT Implementation**
    *   Upon successful login, the server MUST issue a **JSON Web Token (JWT)**.
    *   The token MUST be stored in an `HttpOnly`, `SameSite=Strict` cookie to prevent XSS attacks.
    *   The token MUST have a configurable expiry (default: 24 hours).
*   **FR-03: API Protection**
    *   All "Write" endpoints (POST/PUT/DELETE) under `/api/settings/*` MUST be protected by an authentication middleware.
    *   Unauthenticated requests MUST receive a `401 Unauthorized` response.

### 5.2 UI Architecture (Settings Panel)
*   **FR-04: Sidebar Navigation**
    *   The Settings view MUST utilise a responsive **Sidebar Layout** (Desktop) or Hamburger Menu (Mobile) with the following sections:
        1.  **General:** Location, Timezone, Data Source.
        2.  **Prayers:** Per-prayer detailed configuration.
        3.  **Automation:** Global switches, VoiceMonkey secrets.
        4.  **File Manager:** Audio library management.
        5.  **Developer:** Logs, System status.
*   **FR-05: Settings Context**
    *   The frontend MUST utilise a React Context (`SettingsProvider`) to manage the global configuration state, "Dirty" state (unsaved changes), and "Saving" states.

### 5.3 Configuration Management
*   **FR-06: General Settings**
    *   **Source Selection:** Dropdowns to toggle between `Aladhan` and `MyMasjid`.
    *   **Aladhan Params:** Inputs for Calculation Method, Madhab, and Latitude Adjustment.
    *   **MyMasjid Params:** Input for `MasjidID`.
*   **FR-07: Prayer Settings (Deep Dive)**
    *   **Pill Navigation:** Top-level tabs for `Fajr | Dhuhr | Asr | Maghrib | Isha`.
    *   **Trigger Controls:** For each event (PreAdhan, Adhan, PreIqamah, Iqamah):
        *   Enable/Disable Toggle.
        *   Offset (Minutes).
        *   Type (TTS / File / URL).
        *   Template/Path Input (Dropdown populated by File Manager).
        *   Targets (Checkboxes: Local, Browser, VoiceMonkey).
    *   **Iqamah Logic:**
        *   Inputs for `Fixed Time` and `Offset`.
        *   **Override Flag:** If a user edits these values while using `MyMasjid`, the system MUST set `iqamahOverride: true`.
        *   **Warning:** A visual warning MUST appear: "This overrides the mosque's official schedule."
*   **FR-08: Automation & Global Overrides**
    *   **Master Switches:** Global toggles in the config (`automation.global`) to disable:
        *   All Automation.
        *   All Pre-Adhans.
        *   All Adhans.
    *   The Scheduler MUST check these flags before executing any job.

### 5.4 File Manager
*   **FR-09: Audio Library API**
    *   Endpoint: `GET /api/system/audio-files`.
    *   Returns list of files from `public/audio/custom` and `public/audio/cache`.
*   **FR-10: Management UI**
    *   Display a list of available MP3 files.
    *   **Upload:** Drag-and-drop zone to POST to `/api/settings/upload`.
    *   **Delete:** Button to delete custom files (cached files cannot be manually deleted here, only via Developer Tools).
    *   **Preview:**
        *   "Play locally" (HTML5 Audio).
        *   "Test on Server" (Triggers `mpg123` on host).
        *   "Test on VoiceMonkey" (Triggers Alexa).

### 5.5 Developer Tools
*   **FR-11: Job Inspector**
    *   Endpoint: `GET /api/system/jobs`.
    *   UI: Display a table of currently scheduled `node-schedule` jobs (Next Invocation Time, Event Name).
*   **FR-12: System Actions**
    *   **Regenerate TTS:** Button to wipe `public/audio/cache` and trigger `prepareDailyAssets()`.
    *   **Restart Scheduler:** Button to force a `hotReload()`.
    *   **View Logs:** The SSE Log console (moved from Phase 2 Dashboard).

## 6. User Stories and Acceptance Criteria

### US-1: Secure Administration
**As a** system admin,
**I want** to log in before changing settings,
**So that** random people on my network cannot change the prayer times.

*   **AC-1:** Accessing `/settings` redirects to `/login`.
*   **AC-2:** Correct password grants access; incorrect shows error.
*   **AC-3:** Refreshing the page keeps me logged in (Cookie persistence).

### US-2: Audio Customisation
**As a** user,
**I want** to upload a custom MP3 for the Adhan and select it for Fajr only,
**So that** I can hear a specific reciter in the morning.

*   **AC-1:** File Manager allows uploading `fajr_custom.mp3`.
*   **AC-2:** Prayer Settings > Fajr > Adhan dropdown includes `fajr_custom.mp3`.
*   **AC-3:** Saving config updates the backend.
*   **AC-4:** "Test on Server" button plays the file on the connected speakers.

### US-3: Emergency Override
**As a** user,
**I want** a "Silence All" switch,
**So that** I can stop all announcements during a meeting without deleting my configuration.

*   **AC-1:** "Automation" tab has a "Master Enable" toggle.
*   **AC-2:** Turning it off and saving immediately cancels all active jobs (verified via Developer > Jobs tab).

## 7. Technical Requirements / Stack

*   **Frontend:**
    *   `react-router-dom`: Protected Routes layout.
    *   `lucide-react`: Icons for Sidebar.
    *   `clsx` / `tailwind-merge`: Dynamic class logic.
*   **Backend:**
    *   `jsonwebtoken`: JWT generation/verification.
    *   `cookie-parser`: Parsing HttpOnly cookies.
    *   `fs`: Enhanced file operations (Delete, List).
*   **Configuration:**
    *   Schema update to include `automation.global`, `prayers.[id].iqamahOverride`.

## 8. Data & Configuration Structure

### 8.1 Expanded Config (`default.json`)
```json
{
  "automation": {
    "global": {
      "enabled": true,
      "preAdhanEnabled": true,
      "adhanEnabled": true,
      "preIqamahEnabled": true,
      "iqamahEnabled": true
    }
  },
  "prayers": {
    "fajr": {
      "iqamahOverride": false,
      "iqamahOffset": 20,
      "fixedTime": null
    }
  }
}
```

## 9. Design and User Interface

### 9.1 Sidebar Layout
*   **Left Column (250px):**
    *   Logo / Title.
    *   Navigation Links (Highlight active).
    *   Logout Button (Bottom).
*   **Main Content (Flex Grow):**
    *   Top Bar: Breadcrumbs, "Save Changes" (Floating/Sticky).
    *   Scrollable Content Area.

### 9.2 Prayer Settings Tab
*   **Top:** Pill selector `[Fajr] [Dhuhr] ...`.
*   **Content:**
    *   **Iqamah Calculation Card:**
        *   Inputs: Offset, Fixed Time.
        *   *Condition:* If Source == MyMasjid, show Warning Banner: "Modifying these values will override the mosque's live schedule."
    *   **Triggers Card:**
        *   Accordion/List for "Pre-Adhan", "Adhan", etc.
        *   Inside each: Enable Toggle, Source Type (Radio), Path (Select), Targets (Checkbox Group).

## 10. Open Questions / Assumptions
*   **Assumption:** The server environment (`.env`) is secure and `ADMIN_PASSWORD` is set.
*   **Assumption:** The user understands that "Test on VoiceMonkey" requires the Alexa Skill to be active and configured correctly.