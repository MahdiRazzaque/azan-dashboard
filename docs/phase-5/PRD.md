# Product Requirements Document: Phase 5 - File Manager Enhancements & Audio Testing

## 1. Title
Phase 5 - File Manager Enhancements & Audio Testing

## 2. Introduction
This document outlines a set of User Experience (UX) and functional enhancements for the File Manager module of the Azan Dashboard. The goal is to provide administrators with safer, more granular tools for testing audio assets across different output targets (Server Speaker, Connected Dashboards, Smart Home Devices) and to improve the organisation of generated Text-to-Speech (TTS) assets.

## 3. Product Overview
The File Manager will be upgraded with a new "Test on Speaker" workflow. Instead of immediately playing audio on the server, a modal will allow the user to select the target device (Server, Browser Network, or VoiceMonkey). A mandatory "Safety Checkbox" (Session-persistent) will ensure users acknowledge that playback cannot be stopped once started. Additionally, the TTS Cache list will be visually grouped by Prayer to improve readability.

## 4. Goals and Objectives
*   **Safety:** Prevent accidental high-volume playback on PA systems (Server/VoiceMonkey) by requiring explicit user consent.
*   **Flexibility:** Allow testing of audio files on specific targets (e.g., "Does this file work on Alexa?") without triggering a full prayer automation.
*   **Usability:** Reduce cognitive load by grouping the long list of TTS files into logical "Prayer" sections.
*   **Simulation:** Allow admins to simulate a "Browser Broadcast" to verify that connected dashboard clients are receiving audio events correctly via SSE.

## 5. Target Audience
*   **System Administrators:** Testing new audio files or troubleshooting specific output devices.

## 6. Features and Requirements

### 6.1 Backend: Enhanced Test API
*   **FR-01: API Update (`POST /api/system/test-audio`)**
    *   The endpoint MUST accept an additional parameter `target` in the request body.
    *   **Values:** `'local'`, `'browser'`, `'voiceMonkey'`.
    *   **Logic:**
        *   `local`: Execute `automationService.playTestAudio` (Existing behavior).
        *   `browser`: Emit an `AUDIO_PLAY` event via `sseService`. This broadcasts to all connected clients.
        *   `voiceMonkey`: Construct the public URL (`config.automation.baseUrl` + path) and send to VoiceMonkey API via `automationService.handleVoiceMonkey` logic.

### 6.2 Frontend: TTS Grouping
*   **FR-02: Grouping Logic**
    *   The File Manager MUST parse TTS filenames (`tts_{prayer}_{event}.mp3`).
    *   Files MUST be grouped into sections based on the `{prayer}` segment (Fajr, Dhuhr, Asr, Maghrib, Isha).
    *   Files that do not match the pattern or belong to other categories MUST appear in a "General / Other" section.
    *   Each section MUST have a collapsible or distinct header.

### 6.3 Frontend: Audio Test Modal
*   **FR-03: Modal UI**
    *   Clicking the "Test on Speaker" button (replacing "Test on Server") MUST open a modal `AudioTestModal`.
    *   **Content:**
        *   **Filename:** Display the name of the file being tested.
        *   **Warning:** A prominent warning: "Playback cannot be stopped once started. Ensure volume levels are safe."
        *   **Consent:** A checkbox: "I understand."
        *   **Targets:** Three distinct buttons:
            1.  **Server Speaker:** (Triggers `target: local`). Disabled if `systemHealth.local` is false.
            2.  **All Browsers:** (Triggers `target: browser`).
            3.  **VoiceMonkey:** (Triggers `target: voiceMonkey`). Disabled if `systemHealth.voiceMonkey` is false.

*   **FR-04: Session Consent Logic**
    *   The state of the "I understand" checkbox MUST be persisted in the `FileManagerView` state.
    *   Once checked, it remains checked for subsequent file tests while the user stays on the page.
    *   If the user navigates away and returns, the checkbox MUST reset to unchecked.
    *   The Target buttons MUST be disabled until the checkbox is checked.

*   **FR-05: Legacy Play Button**
    *   The existing "Play" icon (HTML5 Audio) in the file list MUST remain. It serves as a private preview for the admin's current browser tab only and does not trigger the modal.

## 7. User Stories and Acceptance Criteria

### US-1: Safe Testing
**As an** admin,
**I want** to acknowledge a warning before playing audio on the Mosque PA system,
**So that** I don't accidentally blast a test sound during a quiet time.

*   **AC-1:** I click "Test on Speaker" for `adhan.mp3`.
*   **AC-2:** A modal appears. The "Server Speaker" button is greyed out.
*   **AC-3:** I check "I understand". The buttons become active.
*   **AC-4:** I click "Server Speaker". The modal closes and audio plays on the server.
*   **AC-5:** I click "Test on Speaker" for a different file. The modal opens, and the checkbox is *already* checked.

### US-2: Alexa Verification
**As an** admin,
**I want** to test if a specific MP3 file works on Alexa,
**So that** I can verify the file format/URL is compatible before setting it up for Fajr.

*   **AC-1:** I click "Test on Speaker" -> "VoiceMonkey".
*   **AC-2:** The server constructs the URL and sends it to Alexa.
*   **AC-3:** Alexa plays the specific file.

### US-3: TTS Organization
**As a** user,
**I want** to see my TTS files grouped by Prayer,
**So that** I can quickly find the "Fajr Iqamah" file among 20 other files.

*   **AC-1:** The TTS Cache list shows headers: "Fajr", "Dhuhr", etc.
*   **AC-2:** `tts_fajr_adhan.mp3` appears under "Fajr".

## 8. Technical Requirements / Stack

*   **Backend:** Node.js (Controller update).
*   **Frontend:** React, `useState` for session consent.

## 9. API Specifications

### 9.1 Test Audio Endpoint Update
*   **Route:** `POST /api/system/test-audio`
*   **Body:**
    ```json
    {
      "filename": "string",
      "type": "custom" | "cache",
      "target": "local" | "browser" | "voiceMonkey" // [NEW]
    }
    ```