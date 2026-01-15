# Product Requirements Document: Phase 4.91 - VoiceMonkey Interactive Verification

## 1. Introduction
This document outlines the requirements for **Phase 4.91** of the Azan Dashboard project. This phase focuses on resolving a specific ambiguity in the VoiceMonkey (Alexa) integration: the API can return a "Success" status even if the Token is valid but the Device ID is incorrect. To ensure reliability, we are introducing a mandatory **Interactive Human Verification** step before these settings can be saved.

## 2. Product Overview
The Settings Interface for Automation will be enhanced with a "Test & Verify" workflow. Instead of relying solely on a backend connectivity check during save, the user must explicitly trigger a test announcement ("Test") and confirm they heard it on their physical device. This confirmation acts as a "Verified" flag, allowing the system to save the configuration with confidence and skip redundant backend checks.

## 3. Goals and Objectives
*   **Reliability:** Ensure that the configured Device ID actually corresponds to a physical speaker in the user's home.
*   **User Feedback:** Provide immediate feedback if credentials are invalid (400 Bad Request) versus valid-but-silent (Success but wrong device).
*   **Performance:** Skip the latency of backend validation during the "Save" process if the user has already manually verified the credentials.
*   **Safety:** Prevent users from saving a "broken" configuration where VoiceMonkey is enabled but the Device ID is wrong.

## 4. Target Audience
*   **System Administrators:** Who need to ensure their Alexa integration is working correctly before walking away from the dashboard.

## 5. Features and Requirements

### 5.1 Backend: Test Endpoint
*   **FR-01: Test Endpoint**
    *   **Route:** `POST /api/system/test-voicemonkey`
    *   **Auth:** Protected by `authenticateToken`.
    *   **Body:** `{ token: string, device: string }`
    *   **Logic:**
        *   Validate inputs are present.
        *   Call VoiceMonkey API: `GET https://api-v2.voicemonkey.io/announcement?token=...&device=...&text=Test`
    *   **Response:**
        *   **200 OK:** If VoiceMonkey returns `{"success": true}`.
        *   **400 Bad Request:** If VoiceMonkey returns an error (e.g., Invalid Token).
        *   **500 Internal Server Error:** If network fails.

### 5.2 Backend: Settings Update Logic
*   **FR-02: Bypass Validation**
    *   The `POST /api/settings/update` endpoint MUST accept a flag in the `automation.voiceMonkey` object (e.g., `_verified: true` or a separate `options` object).
    *   If this flag is `true`, the backend MUST **skip** the `automationService.verifyCredentials()` call for VoiceMonkey.
    *   This optimisation reduces save time and relies on the user's explicit manual verification.

### 5.3 Frontend: State Management
*   **FR-03: Verification State (`isVerified`)**
    *   The `AutomationSettingsView` MUST maintain a boolean state `isVerified`.
    *   **Initialization:** Defaults to `true` if VoiceMonkey is already enabled in the loaded config (assuming legacy trust), OR `false` if disabled/empty.
    *   **Reset:** If the user edits the `API Token` or `Device ID` input fields, `isVerified` MUST immediately be set to `false`.
    *   **Set:** `isVerified` is set to `true` ONLY when the user clicks "Yes" in the Confirmation Modal (FR-05).

### 5.4 Frontend: Test Workflow
*   **FR-04: Test Button**
    *   A "Test Credentials" button MUST be displayed next to the inputs if VoiceMonkey is enabled.
    *   **Action:** Calls `POST /api/system/test-voicemonkey`.
    *   **Loading:** Shows a spinner while waiting for API response.
    *   **Error Handling:** If API returns 400/500, show an Error Alert ("Invalid Token") and keep `isVerified = false`.

*   **FR-05: Confirmation Modal**
    *   If the Test API returns `success: true`, a modal MUST open.
    *   **Title:** "Did you hear the announcement?"
    *   **Body:** "We sent a test message saying 'Test' to your device. Did you hear it?"
    *   **Action 1 (Yes):** Closes modal, sets `isVerified = true`, shows Success Toast.
    *   **Action 2 (No):** Closes modal, keeps `isVerified = false`, shows Warning Toast ("Check your Device ID").
    *   **Action 3 (Retry):** Re-triggers the API call.

### 5.5 Frontend: Blocking Save
*   **FR-06: Save Guard**
    *   If `VoiceMonkey.enabled` is `true` AND `isVerified` is `false`:
    *   The "Save Changes" button functionality MUST be intercepted.
    *   Instead of saving, it MUST show an error/toast: "Please verify VoiceMonkey credentials before saving."
    *   The Save Process Modal MUST NOT open.

## 6. User Stories and Acceptance Criteria

### US-1: Incorrect Device ID
**As a** user,
**I want** the system to ask me if I heard the sound,
**So that** I don't accidentally save a settings where the Token is right but the Device ID is a typo.

*   **AC-1:** I enter a valid Token but a random Device ID ("KitchenInvalid").
*   **AC-2:** I click "Test". The API returns 200 OK (because Token is valid).
*   **AC-3:** The Modal asks "Did you hear it?".
*   **AC-4:** I click "No".
*   **AC-5:** I verify that I *cannot* click "Save Changes" (it is blocked or shows error).

### US-2: Valid Configuration
**As a** user,
**I want** to confirm my settings work,
**So that** I can enable automation with confidence.

*   **AC-1:** I enter valid Token and Device ID.
*   **AC-2:** I click "Test". My Echo Dot says "Test".
*   **AC-3:** I click "Yes" in the modal.
*   **AC-4:** I click "Save Changes". The save happens immediately (Process Modal shows "Saving...", skips "Verifying VoiceMonkey...").

## 7. Technical Requirements / Stack

*   **Frontend:** React, `useState`, `ConfirmModal`.
*   **Backend:** Express, Axios.

## 8. Open Questions / Assumptions
*   **Assumption:** The `test-voicemonkey` endpoint does not need to use the `edge-tts` service; sending the raw string "Test" to VoiceMonkey (which uses Alexa's default voice) is sufficient for connectivity testing.