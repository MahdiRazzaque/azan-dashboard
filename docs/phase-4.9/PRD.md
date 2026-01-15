# Product Requirements Document: Phase 4.8 - UX Enhancements & Interactive Save Process

## 1. Introduction
This document outlines the requirements for **Phase 4.8** of the Azan Dashboard. This phase is a critical User Experience (UX) refactor aimed at making the system configuration more transparent, forgiving, and user-friendly. It replaces opaque "auto-disable" logic with an interactive **Process Modal** that provides real-time feedback during save operations, handles validation errors explicitly, and treats system service outages as "warnings" rather than hard blockers.

## 2. Product Overview
The current system silently disables invalid configurations or options dependent on offline services (like TTS). Phase 4.8 introduces a **Soft Warning** architecture. Users can now pre-configure settings even if dependencies (Python TTS, VoiceMonkey) are currently offline. When saving, a new full-screen **Process Modal** takes center stage, guiding the user through the backend operations (Saving, Data Fetching, Asset Generation) with real-time status updates via Server-Sent Events (SSE), culminating in a clear Success, Warning, or Error outcome.

## 3. Goals and Objectives
*   **Transparency:** Eliminate "black box" delays when saving settings. Users must see exactly what the server is doing (e.g., "Generating TTS Assets...").
*   **User Control:** Stop the system from mutating user input. If a setting is invalid, block the save and ask the user to fix it, rather than silently disabling it.
*   **Flexibility:** Allow "Offline Configuration." Admins should be able to enable TTS automations even if the TTS service is temporarily down, receiving a warning instead of a hard block.
*   **Clarity:** Use a focused, minimal UI design (Central Icon + Text) to communicate success or failure without clutter.

## 4. Target Audience
*   **System Administrators:** Who need to troubleshoot why an automation isn't working or configure the system in an offline environment (e.g., prepping a config file on a laptop).

## 5. Features and Requirements

### 5.1 "Soft Warning" UI Logic
*   **FR-01: Removal of Hard Blocks**
    *   Inputs in `TriggerCard` (checkboxes, selects) MUST NOT be `disabled` based on `systemHealth` status.
    *   Users MUST be allowed to select "TTS", "Local", or "VoiceMonkey" even if the respective service is reported as offline.
*   **FR-02: Visual Warning Indicators**
    *   If a selected option relies on an offline service, the UI MUST display a visible "Warning" state (e.g., amber border on the card, alert icon next to the option).
    *   A tooltip or helper text MUST explain the issue (e.g., "Service Offline - Audio will not play").

### 5.2 Frontend Validation (Pre-Save)
*   **FR-03: Blocking Validation**
    *   The "Save" action MUST trigger a validation pass using the existing `validateTrigger` utility.
    *   If **any** validation error occurs (empty URL, missing file, missing template), the Save process MUST be aborted immediately.
    *   The "Process Modal" MUST open in an **Error State**, listing the specific issues.
    *   The system MUST NOT silently disable invalid triggers to force a save.

### 5.3 Interactive Process Modal
*   **FR-04: Modal Component**
    *   A new component `SaveProcessModal` MUST be created.
    *   **Layout:**
        *   **Overlay:** Full screen, semi-transparent black backdrop (`z-50`).
        *   **Card:** Centered, fixed width (e.g., `max-w-md`), dark theme.
        *   **Visual Hierarchy:**
            1.  **Icon:** Large (approx 64px), Centered. Animated transitions between states.
            2.  **Status Text:** Large, Bold, Centered text below the icon.
            3.  **Detail Area:** A scrollable container for lists (Warnings/Errors), only visible if needed.
            4.  **Action Area:** Buttons at the bottom.
    *   **Behavior:**
        *   The modal MUST be non-dismissible (no "Close" button, click-outside ignored) while in the **Processing** state.

*   **FR-05: Real-Time Progress (SSE)**
    *   The Modal MUST subscribe to the `useSSE` context.
    *   It MUST listen for `PROCESS_UPDATE` events.
    *   **State Mapping:**
        *   **Icon:** Displays a spinning loader (`Loader2`).
        *   **Text:** Updates dynamically based on the event payload (e.g., "Saving Configuration...", "Refreshing Cache...", "Generating Assets...").

### 5.4 Backend Enhancements
*   **FR-06: Progress Broadcasting**
    *   The `POST /api/settings/update` handler MUST emit `PROCESS_UPDATE` events via SSE at each stage of execution (Start, Save Complete, Fetch Complete, Asset Gen Complete).
*   **FR-07: Warning Response**
    *   The API response for a successful save MUST include a `warnings` array.
    *   The backend MUST calculate these warnings by checking enabled triggers against the current `healthCheck` status.
    *   *Example:* `warnings: ["Fajr Adhan enabled but TTS service is offline", "Maghrib Pre-Adhan enabled but Local Audio is missing"]`.

### 5.5 Post-Save Interaction (Outcome States)
The Modal transitions to one of these states based on the API response or Validation result.

*   **FR-08: Success State**
    *   **Condition:** API returns 200 OK and `warnings` array is empty.
    *   **Icon:** Green Checkmark (`CheckCircle`).
    *   **Text:** "Configuration Saved".
    *   **Action:** "Close" button (visible).
*   **FR-09: Warning State (Saved with Issues)**
    *   **Condition:** API returns 200 OK but `warnings` array has items.
    *   **Icon:** Amber Shield or Triangle (`AlertTriangle`).
    *   **Text:** "Saved with Warnings".
    *   **Details:** A scrollable amber box listing the warnings.
    *   **Actions:**
        *   "Go to System Health" (Navigates to Developer View).
        *   "Close" (Dismisses modal).
*   **FR-10: Error State (Save Failed/Validation)**
    *   **Condition:** Frontend Validation fails OR API returns 4xx/5xx.
    *   **Icon:** Red Cross (`XCircle`).
    *   **Text:** "Configuration Not Saved".
    *   **Details:** A scrollable red box listing every specific error (e.g., "Fajr Adhan: URL is required").
    *   **Action:** "Close" button (returns user to form to fix errors).

## 6. User Stories and Acceptance Criteria

### US-1: Save with Progress
**As a** user,
**I want** to see exactly what the system is doing when I click save,
**So that** I know the system hasn't frozen during the long data fetch process.

*   **AC-1:** I click Save. The Modal opens immediately.
*   **AC-2:** Large Spinner appears. Text reads "Validating...".
*   **AC-3:** Text changes to "Saving to Disk..." then "Regenerating Assets..." as the backend works.
*   **AC-4:** Spinner transforms into a Green Tick. Text reads "Configuration Saved".
*   **AC-5:** I click "Close" to return to the settings page.

### US-2: Validation Feedback
**As a** user,
**I want** to know exactly which fields are missing before saving,
**So that** I can fix them without the system automatically disabling my settings.

*   **AC-1:** I enable a "URL" trigger but leave the input empty.
*   **AC-2:** I click Save.
*   **AC-3:** The Modal opens instantly in the **Error** state (Red Cross).
*   **AC-4:** Text reads "Configuration Not Saved".
*   **AC-5:** The detail list shows: "Fajr Adhan: URL is required".
*   **AC-6:** The "Close" button is the only option.

### US-3: Offline Configuration
**As an** admin configuring the system on a laptop without speakers,
**I want** to enable "Local Audio" output for the mosque server,
**So that** I can deploy the config file later without being blocked by the UI.

*   **AC-1:** The "Local" checkbox is clickable even if `mpg123` is missing on the laptop.
*   **AC-2:** Selecting it adds an amber border/icon to the card (Soft Warning).
*   **AC-3:** Saving results in the **Warning** state modal (Amber Triangle).
*   **AC-4:** The modal lists: "Local Audio output enabled but service is offline".

## 7. Technical Requirements / Stack

*   **Frontend:**
    *   React Context (`SettingsContext` refactor).
    *   Tailwind CSS (Overlay, z-index, animations, scrollbars).
    *   `lucide-react` (Icons).
*   **Backend:**
    *   Node.js SSE (`sseService.js`).
    *   Express (`api.js` refactor).

## 8. Data Structures

### 8.1 SSE Event: `PROCESS_UPDATE`
```json
{
  "type": "PROCESS_UPDATE",
  "payload": {
    "label": "Regenerating Audio Assets..." // Human readable status
  }
}
```

### 8.2 API Response: Update
```json
{
  "success": true,
  "message": "Configuration saved.",
  "warnings": [
    "Fajr Adhan: TTS Service is offline",
    "Maghrib Adhan: Local Audio is missing"
  ]
}
```

## 9. Design and User Interface

### 9.1 Modal Visual Style
*   **Container:** `bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8 max-w-md w-full flex flex-col items-center text-center`.
*   **Processing:**
    *   Icon: `text-blue-500 animate-spin w-16 h-16 mb-4`.
    *   Text: `text-xl font-medium text-zinc-200`.
*   **Success:**
    *   Icon: `text-emerald-500 w-16 h-16 mb-4`.
    *   Text: `text-xl font-bold text-white`.
*   **Warning:**
    *   Icon: `text-amber-500 w-16 h-16 mb-4`.
    *   Text: `text-xl font-bold text-amber-500`.
    *   List Box: `mt-6 w-full text-left bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm text-amber-200 max-h-40 overflow-y-auto`.
*   **Error:**
    *   Icon: `text-red-500 w-16 h-16 mb-4`.
    *   Text: `text-xl font-bold text-red-500`.
    *   List Box: `mt-6 w-full text-left bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-200 max-h-40 overflow-y-auto`.

## 10. Open Questions / Assumptions
*   **Assumption:** The backend `forceRefresh` and `prepareDailyAssets` functions execute sequentially, allowing distinct progress events to be fired between them for a smooth UI experience.