# Product Requirements Document: Phase 4.8 - System Health & UI State Logic

## 1. Introduction
This document outlines the requirements for **Phase 4.8** of the Azan Dashboard. This phase focuses on **User Experience (UX) and System Stability**. It introduces "Smart UI" logic that proactively disables features that cannot function due to missing dependencies (e.g., offline TTS service, missing audio drivers) or configuration overrides (Master Switches). It also provides a transparent Health Status dashboard for administrators.

## 2. Product Overview
The system will now actively monitor its own health (TTS Service connectivity, `mpg123` presence, VoiceMonkey authentication). This health state will be broadcast to the frontend. The Settings UI will consume this state to grey out unavailable options, preventing users from configuring broken automations. A new "System Health" card in the Developer tools will allow granular diagnosis and refreshing of these checks.

## 3. Goals and Objectives
*   **Prevent Errors:** Stop users from selecting "TTS" if the generator is offline, or "VoiceMonkey" if credentials are bad.
*   **Clarity:** Visually indicate *why* a setting is disabled (e.g., "Disabled by Global Master Switch").
*   **Observability:** Provide a clear Traffic Light (Red/Green) status for all external dependencies.
*   **Interactivity:** Allow admins to retry connections (e.g., after starting the Python server) without restarting the whole Node.js application.

## 4. Target Audience
*   **Admins:** Who need to know why their Adhan didn't play (e.g., "Oh, the Python server crashed").
*   **End Users:** Who need a foolproof interface that doesn't let them select invalid options.

## 5. Features and Requirements

### 5.1 Backend: Enhanced Health Service
*   **FR-01: Modular Health Checks**
    *   Refactor `src/services/healthCheck.js` to export a stateful object or individual async functions:
        *   `checkLocalAudio()`: Checks `mpg123`.
        *   `checkPythonService()`: Checks `http://localhost:8000`.
        *   `checkVoiceMonkey()`: Validates tokens against `api.voicemonkey.io` (Dry run/Devices check).
*   **FR-02: Health Cache**
    *   The service MUST maintain the last known status in memory to serve `GET` requests instantly without re-running shell commands every time.
*   **FR-03: API Endpoints**
    *   `GET /api/system/health`: Returns JSON `{ local: bool, tts: bool, voiceMonkey: bool, timestamp: string }`.
    *   `POST /api/system/health/refresh`: Accepts `{ target: string }`.
        *   Target can be `'local'`, `'tts'`, `'voicemonkey'`, or `'all'`.
        *   Re-runs the specific check, updates cache, and returns new status.

### 5.2 Frontend: Settings Context & Hooks
*   **FR-04: Health State Management**
    *   `SettingsContext` MUST fetch system health on mount and expose it via `systemHealth` object.
    *   It MUST provide a `refreshHealth(target)` function.
*   **FR-05: Cascading Config Logic**
    *   The UI MUST respect the following hierarchy:
        1.  **Global Automation Switch** (Off = All triggers disabled).
        2.  **Event Type Switch** (e.g., Pre-Adhan Off = All Pre-Adhan triggers disabled).
        3.  **Individual Trigger Toggle**.

### 5.3 Frontend: UI Component Updates
*   **FR-06: TriggerCard Enhancements**
    *   **Disable Logic:**
        *   **Type: TTS:** Disabled if `!systemHealth.tts`. Tooltip: "TTS Service Offline".
        *   **Target: Local:** Disabled if `!systemHealth.local`. Tooltip: "Server Audio (mpg123) not found".
        *   **Target: VoiceMonkey:** Disabled if `!systemHealth.voiceMonkey`. Tooltip: "VoiceMonkey credentials invalid".
    *   **Visual Feedback:** If a selected option becomes invalid (e.g., TTS was selected, then service died), display a **Warning Icon** in the card header.
    *   **Master Override:** If the parent Master Switch is off, the entire card MUST be dimmed (`opacity-50`) and non-interactive (`pointer-events-none` on inputs), with a "Disabled by Master Settings" banner/tooltip.
*   **FR-07: Developer View - Health Card**
    *   Add a new card "System Health" in `DeveloperSettingsView`.
    *   Display 3 interactive buttons/indicators (TTS, Local, VoiceMonkey).
    *   **State:** Green (Online), Red (Offline), Spinning (Checking).
    *   **Action:** Clicking a button triggers `refreshHealth(target)` for that specific service.

### 5.4 Settings Views Updates
*   **FR-08: Regenerate TTS Button**
    *   In `DeveloperSettingsView`, the "Regenerate TTS Assets" button MUST be disabled if `!systemHealth.tts`.
*   **FR-09: VoiceMonkey Status**
    *   In `AutomationSettingsView`, display a small status indicator (Valid/Invalid) next to the Token inputs. This status updates when the user saves settings (triggering a health refresh).

## 6. User Stories and Acceptance Criteria

### US-1: Debugging Offline TTS
**As an** admin,
**I want** to see a red indicator if my Python TTS server is down,
**So that** I don't waste time trying to generate audio files that will fail.

*   **AC-1:** Developer Tools > System Health shows "TTS Service" as Red.
*   **AC-2:** Trigger Card > "TTS" option is greyed out.
*   **AC-3:** Clicking the Red button after starting the python script turns it Green.

### US-2: Master Switch Safety
**As a** user,
**I want** my Pre-Adhan settings to be greyed out if I turned off "Pre-Adhan Events" globally,
**So that** I don't mistakenly think they are active.

*   **AC-1:** Go to Automation > Turn off "Pre-Adhan Events".
*   **AC-2:** Go to Prayers > Fajr.
*   **AC-3:** The "Pre-Adhan" card is dimmed and I cannot toggle the switch inside it.

## 7. Technical Requirements

*   **Backend:** Node.js, Axios.
*   **Frontend:** React, Lucide Icons.
*   **Styling:** Tailwind CSS (`group-disabled`, `peer-checked`, opacity utilities).

## 8. Data Structures

### 8.1 API Response: Health
```json
{
  "local": true,
  "tts": false,
  "voiceMonkey": true,
  "lastChecked": "2024-01-01T12:00:00Z"
}
```

## 9. Implementation Order

1.  **Backend Logic:** Refactor `healthCheck.js` and add `validateVoiceMonkey`.
2.  **Backend API:** Implement `GET /health` and `POST /health/refresh`.
3.  **Frontend Context:** Update `SettingsContext` to load health data.
4.  **Developer UI:** Build the System Health card to test the backend logic.
5.  **Settings UI:** Update `TriggerCard` and `AutomationSettingsView` to consume health state and Master Config state.

## 10. Open Questions / Assumptions
*   **Assumption:** VoiceMonkey validation involves sending a request to a benign endpoint (like getting device list) or a dry-run trigger. We will use a lightweight check.