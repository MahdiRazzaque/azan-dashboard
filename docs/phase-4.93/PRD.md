# Product Requirements Document: Phase 4.93 - Advanced VoiceMonkey Health Checks

## 1. Title
Phase 4.93 - Advanced VoiceMonkey Health Checks (Silent vs. Loud)

## 2. Introduction
This document outlines an enhancement to the System Health monitoring logic, specifically for the VoiceMonkey (Smart Home) integration. Currently, checking the health of the VoiceMonkey service triggers an audio announcement, which causes disturbances during automated system startups or maintenance schedules. This phase introduces a "Silent" check mode for automated monitoring and a "Loud" check mode for user-initiated verification.

## 3. Product Overview
The VoiceMonkey health check mechanism will be refactored to support two distinct modes of operation. The **Silent Mode** (default for automated tasks) will verify API connectivity and Token validity by sending a request with a randomized Device ID; this confirms the API is reachable without generating sound. The **Loud Mode** (manual only) will use the actual configured Device ID to play a sound, requiring the user to explicitly confirm they heard it via a modal dialog.

## 4. Goals and Objectives
*   **Eliminate Noise Pollution:** Ensure that server restarts, cron jobs, and background maintenance tasks do not trigger Alexa announcements.
*   **Maintain Observability:** Continue to monitor the availability of the VoiceMonkey API and the validity of the API Token in the background.
*   **Enhanced Verification:** Provide administrators with specific tools to differentiate between "API is down" (Silent Check) and "Device is misconfigured" (Loud Check).

## 5. Target Audience
*   **System Administrators:** Who need to monitor system health without being disturbed by constant test sounds, but still need the ability to verify the full audio chain when troubleshooting.

## 6. Features and Requirements

### 6.1 Backend: Health Check Logic
*   **FR-01: Health Service Refactor**
    *   The `checkVoiceMonkey` function in `src/services/healthCheck.js` MUST accept a `mode` parameter (`'silent'` or `'loud'`).
    *   **Silent Mode (Default):**
        *   Generate a random device string (e.g., `azan_check_${timestamp}`).
        *   Call VoiceMonkey API with this random device.
        *   **Success Condition:** API returns `200 OK` and `{ success: true }`. (Note: VoiceMonkey returns success for unknown devices if the token is valid).
        *   **Result:** Mark service as `Healthy`.
    *   **Loud Mode:**
        *   Use the actual `device` from `config.automation.voiceMonkey`.
        *   Call VoiceMonkey API.
        *   **Success Condition:** API returns `200 OK` and `{ success: true }`.
        *   **Result:** Mark service as `Healthy`.

*   **FR-02: Scheduler Integration**
    *   The `schedulerService.js` MUST be updated to explicitly call `healthCheck.refresh('silent')` (or pass the mode to the VoiceMonkey target) during the hourly maintenance job.

### 6.2 Backend: API Updates
*   **FR-03: Refresh Endpoint Update**
    *   The `POST /api/system/health/refresh` endpoint MUST accept an optional `mode` property in the request body.
    *   It MUST pass this `mode` to the underlying service.

### 6.3 Frontend: Developer UI
*   **FR-04: Split Actions**
    *   In `DeveloperSettingsView`, the VoiceMonkey status row MUST display two distinct action buttons:
        1.  **Refresh (Icon):** Triggers a **Silent** check. Updates the status indicator based on API reachability.
        2.  **Test Sound (Speaker Icon):** Triggers a **Loud** check.
*   **FR-05: Loud Check Workflow**
    *   Clicking "Test Sound" calls the refresh endpoint with `mode: 'loud'`.
    *   **If API fails:** Show error toast immediately.
    *   **If API succeeds:** Open a `ConfirmModal`: "Did you hear the test sound?".
        *   **Yes:** Close modal. (Service remains Healthy).
        *   **No:** Close modal. The UI MUST visually flag the service as **Unhealthy** (e.g., set local state to error) to reflect that while the API is up, the configuration is invalid.

## 7. User Stories and Acceptance Criteria

### US-1: Silent Startup
**As a** user,
**I want** the system to check its health silently when it reboots at 3 AM,
**So that** my family is not woken up by Alexa saying "Test".

*   **AC-1:** Server is restarted.
*   **AC-2:** Logs show "Health Check: VoiceMonkey (Silent)".
*   **AC-3:** Developer panel shows VoiceMonkey as "Online" (Green).
*   **AC-4:** No audio is played on physical devices.

### US-2: Manual Verification
**As an** admin,
**I want** to force a sound test from the Developer panel,
**So that** I can prove to myself the speaker is actually working.

*   **AC-1:** User navigates to Developer Settings.
*   **AC-2:** User clicks the Speaker icon next to VoiceMonkey.
*   **AC-3:** Alexa plays "Test".
*   **AC-4:** Modal appears: "Did you hear it?".
*   **AC-5:** User clicks "Yes". Modal closes.

### US-3: Failed Verification
**As an** admin,
**I want** to mark the service as "Issue Detected" if I don't hear the sound,
**So that** I know I need to fix the Device ID.

*   **AC-1:** User clicks Speaker icon.
*   **AC-2:** API returns Success (Token valid), but Device ID is wrong so no sound plays.
*   **AC-3:** Modal appears. User clicks "No".
*   **AC-4:** The VoiceMonkey status indicator turns Red or shows a warning state.

## 8. Technical Requirements / Stack
*   **Backend:** Node.js, `axios`.
*   **Frontend:** React, `useState` for modal control.

## 9. Design and User Interface
*   **Developer Settings - System Health Card:**
    *   **VoiceMonkey Row:**
        *   Label: "VoiceMonkey"
        *   Status: Icon (Check/X).
        *   Actions:
            *   `<button title="Silent Connectivity Check"><RefreshCw /></button>`
            *   `<button title="Test Speaker Output"><Volume2 /></button>`

## 10. Open Questions / Assumptions
*   **Assumption:** The VoiceMonkey API behavior regarding unknown devices (returning `success: true`) remains consistent.
*   **Assumption:** The `healthCheck.js` service is a singleton or behaves like one, maintaining state across API calls.