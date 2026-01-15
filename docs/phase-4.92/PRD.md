# Product Requirements Document: Phase 4.95 - Credentials & Navigation Refactor

## 1. Title
Phase 4.95 - Credentials Management & Navigation Refactor

## 2. Introduction
This document outlines a structural refactor of the Azan Dashboard settings interface. The primary goal is to decouple the VoiceMonkey (Smart Home) credential management from the general Automation logic, moving it to a dedicated "Credentials" section alongside password management. This phase also introduces a "Verify-to-Save" workflow for these credentials and refines the global navigation UI to prevent user confusion regarding "Unsaved Changes."

## 3. Product Overview
The Settings interface will be reorganized. The "Account" tab will be renamed to "Credentials." VoiceMonkey API integration settings will be moved here. To ensure system stability, VoiceMonkey credentials will no longer be part of the global configuration JSON file's "dirty state." Instead, they will use a dedicated "Test & Save" workflow where successful verification immediately commits the keys to the server's environment variables. Consequently, the global "Save/Discard" controls will be hidden on administrative pages (Credentials, Files, Developer) where they are not relevant.

## 4. Goals and Objectives
*   **Logical Grouping:** Centralise all security and access tokens (Admin Password, VoiceMonkey Tokens) in one "Credentials" view.
*   **Safety:** Prevent users from saving invalid VoiceMonkey credentials by enforcing a "Test -> Confirm -> Save" loop.
*   **UX Clarity:** Remove the global "Save Changes" button from pages that perform immediate actions (File Uploads, Credential Updates), reducing ambiguity about what needs to be saved.
*   **Separation of Concerns:** Decouple environment-level secrets from the application-level JSON configuration.

## 5. Target Audience
*   **System Administrators:** Who need a clear, secure way to manage API keys without navigating complex automation menus.

## 6. Features and Requirements

### 6.1 Backend: Credentials API
*   **FR-01: Save Credentials Endpoint**
    *   **Route:** `POST /api/settings/credentials/voicemonkey`
    *   **Auth:** Protected by `authenticateToken`.
    *   **Body:** `{ token: string, device: string }`
    *   **Logic:**
        *   Validate inputs (must not be empty).
        *   Write keys to `.env` using `envManager.setEnvValue`: `VOICEMONKEY_TOKEN`, `VOICEMONKEY_DEVICE`.
        *   Trigger `configService.reload()` to refresh the active configuration.
    *   **Response:** `200 OK` `{ success: true }`.
    *   **Note:** This endpoint MUST NOT perform verification (audio testing); it assumes verification was done by the frontend prior to calling.

*   **FR-02: Legacy Logic Removal**
    *   The `POST /api/settings/update` endpoint MUST be refactored to **remove** the logic that intercepts and moves VoiceMonkey tokens to `.env`. This responsibility is now exclusive to FR-01.

### 6.2 Frontend: Credentials View (`CredentialsSettingsView`)
*   **FR-03: View Structure**
    *   Rename `AccountSettingsView` to `CredentialsSettingsView`.
    *   **Section 1 (Top):** VoiceMonkey Integration.
    *   **Section 2 (Bottom):** Admin Password Change.
*   **FR-04: VoiceMonkey Local State**
    *   The Token and Device inputs MUST use local React state (`useState`), initialized from the loaded config.
    *   Editing these fields MUST NOT trigger the global `SettingsContext` "dirty" state.
*   **FR-05: Verify-to-Save Workflow**
    *   **Action:** User enters credentials and clicks "Test Credentials".
    *   **System:** Calls `/api/system/test-voicemonkey` (Audio test).
    *   **Modal:** If successful, prompt "Did you hear the announcement?".
    *   **Confirmation:** If User clicks "Yes":
        1.  Call `POST /api/settings/credentials/voicemonkey` immediately.
        2.  On success, trigger `refresh()` from `SettingsContext` to update the global app state.
        3.  Show Success Toast: "Credentials verified and saved."

### 6.3 Frontend: Navigation & Layout
*   **FR-06: Route Renaming**
    *   Change route path `/settings/account` to `/settings/credentials`.
    *   Update Sidebar label to "Credentials" with appropriate icon (`Shield` or `Key`).
*   **FR-07: Context-Aware Header**
    *   The "Save Changes", "Discard", and "Reset" buttons in the top header MUST ONLY be visible on the following routes:
        *   `/settings/general`
        *   `/settings/prayers`
        *   `/settings/automation`
    *   They MUST be hidden on:
        *   `/settings/credentials`
        *   `/settings/files`
        *   `/settings/developer`

### 6.4 Cleanup
*   **FR-08: Automation View Cleanup**
    *   Remove the VoiceMonkey section entirely from `AutomationSettingsView.jsx`.
*   **FR-09: Validation Context**
    *   Remove `validateBeforeSave` checks related to VoiceMonkey in `SettingsContext.jsx`, as this data is no longer part of the bulk save operation.

## 7. User Stories and Acceptance Criteria

### US-1: Setting up Alexa
**As an** admin,
**I want** to set up my VoiceMonkey keys in the Credentials section,
**So that** I don't accidentally mess up my prayer times while pasting API tokens.

*   **AC-1:** I navigate to "Credentials".
*   **AC-2:** I enter my Token and Device ID.
*   **AC-3:** I click "Test". My device plays a sound.
*   **AC-4:** I click "Yes, I heard it".
*   **AC-5:** The page shows a success message.
*   **AC-6:** I navigate to "General" and back. The keys are still there (persisted).

### US-2: Confusion Reduction
**As a** user,
**I want** the "Save Changes" button to disappear when I'm on the File Manager,
**So that** I don't think I need to press it after uploading a file.

*   **AC-1:** Navigate to "General". "Save Changes" button is visible.
*   **AC-2:** Navigate to "Files". "Save Changes" button is hidden.
*   **AC-3:** Navigate to "Credentials". "Save Changes" button is hidden.

## 8. Technical Requirements / Stack
*   **Frontend:** React, React Router, Context API.
*   **Backend:** Node.js, Express, `envManager`.

## 9. Design and User Interface
*   **Credentials View:**
    *   **Card 1 (VoiceMonkey):** "VoiceMonkey Integration". Status badge (Online/Offline). Inputs for Token/Device. "Test" button.
    *   **Card 2 (Security):** "Change Password". Inputs for New/Confirm. "Update" button.
*   **Header:** Dynamic visibility based on `useLocation()`.

## 10. Open Questions / Assumptions
*   **Assumption:** The existing `envManager` correctly handles writing to `.env` without corrupting other keys.
*   **Assumption:** The user is aware that changing the Admin Password (also on this page) logs them out immediately.