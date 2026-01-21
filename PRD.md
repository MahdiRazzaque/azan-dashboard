Here is the Product Requirements Document (PRD) for the Voice Selection and TTS Enhancements feature.

```markdown
# Product Requirements Document: TTS Voice Selection & Management

## 1. Title
**Dynamic Text-to-Speech (TTS) Voice Selection and Management**

## 2. Introduction
This document outlines the requirements for adding granular voice selection capabilities to the Azan Dashboard. Currently, the system uses a hardcoded Arabic voice (`ar-DZ-IsmaelNeural`) for all generated audio. This feature will allow users to browse available `edge-tts` voices, preview them with custom text, and assign specific voices globally or per-automation trigger.

## 3. Product Overview
The enhancement consists of three main components:
1.  **Voice Discovery:** The Python microservice will expose available voices dynamically.
2.  **Voice Management UI:** A new "Voice Library" interface allowing users to filter voices by language/gender, preview audio, and set global defaults.
3.  **Configuration Logic:** Updates to the automation system to support cascading voice preferences (Trigger Specific > Global Default > System Fallback).

## 4. Goals and Objectives
*   **Flexibility:** Allow users to choose voices that match their aesthetic or language preference (e.g., using an English accent for English announcements).
*   **Usability:** Provide a rich browsing experience with filtering and zero-latency searching.
*   **Reliability:** Ensure Arabic prayer names (`{prayerArabic}`) are handled gracefully, warning users if an incompatible voice is selected.
*   **Maintainability:** Auto-generate voice lists rather than maintaining a static JSON file.

## 5. Target Audience
*   **Mosque Admins:** Customising announcements to sound professional and appropriate for their congregation.
*   **Home Users:** integrating the dashboard into smart homes where specific voices (e.g., matching Alexa) are preferred.

## 6. Features and Requirements

### 6.1. Backend (Python Microservice)
*   **FR-01: Voice List Endpoint**
    *   Endpoint: `GET /voices`
    *   Logic: Import `edge_tts` and invoke `list_voices()`. Return a JSON array containing `Name`, `Gender`, `Language`, `Region`, and `ShortName`.
*   **FR-02: Preview Generation**
    *   Endpoint: `POST /preview-tts`
    *   Input: `{ text: string, voice: string }`
    *   Logic: Generate an MP3 file in a temporary directory (`public/audio/temp`).
    *   Output: JSON containing the playback URL.

### 6.2. Backend (Node.js)
*   **FR-03: Voice Caching**
    *   On server startup, fetch the voice list from the Python service and cache it in memory (or a temporary JSON file) to serve frontend requests instantly.
*   **FR-04: Temp File Cleanup**
    *   Implement a maintenance job in `schedulerService.js` running hourly to delete files in `public/audio/temp` older than 1 hour.
*   **FR-05: Cascading Voice Logic**
    *   Update `audioAssetService.js` to resolve the voice in this order:
        1.  Trigger-specific voice (if set).
        2.  Global default voice (if set in config).
        3.  Fallback hardcoded voice (`ar-DZ-IsmaelNeural`).

### 6.3. Frontend (React)
*   **FR-06: Voice Library Component**
    *   **Table View:** Display voices with columns for Name, Gender, Region, and Language.
    *   **Filters:** Dropdowns to filter by Gender and Language.
    *   **Preview Player:** A "Play" button for each row. When clicked, send a request to `POST /preview-tts` and play the resulting URL.
    *   **Loading State:** Show a spinner while the preview is generating.
*   **FR-07: Preview Context**
    *   Provide a text input above the table with default text: `"Fifteen minutes till {prayerArabic}"`.
    *   Include selectors to dynamically swap `{prayerArabic}` with specific prayer names (e.g., "Fajr", "Maghrib") for testing pronunciation.
    *   **Warning System:** If the text contains Arabic characters and the selected voice is non-Arabic, display a warning: *"⚠️ This voice may not pronounce Arabic characters correctly."*
*   **FR-08: Trigger Card Integration**
    *   Add a `SearchableSelect` (Combobox) to every Trigger Card where `type === 'tts'`.
    *   Allow users to select a specific voice or "Use Global Default".

### 6.4. Configuration Data
*   **FR-09: Schema Updates**
    *   Update `automationSchema` (Global) to include `defaultVoice` (string, optional).
    *   Update `triggerEventSchema` to include `voice` (string, optional).

## 7. User Stories

| ID | As a... | I want to... | So that... |
| :--- | :--- | :--- | :--- |
| **US-1** | User | Filter voices by "English" and "Male" | I can quickly find a suitable voice without scrolling through hundreds of options. |
| **US-2** | User | Preview a voice saying "Time for Maghrib" | I can verify if it pronounces the Arabic prayer name correctly. |
| **US-3** | User | Set a global default voice | All my existing triggers update automatically without editing them one by one. |
| **US-4** | User | Assign a specific voice to the "Adhan" trigger | I can have a different (e.g., deeper/Arabic) voice for the call to prayer compared to English reminders. |
| **US-5** | Admin | Have the system clean up preview files | My server storage doesn't fill up with temporary test audio. |

## 8. Technical Requirements / Stack

### Data Structures
**Voice Object (JSON from Python):**
```json
{
  "Name": "Microsoft Server Speech Text to Speech Voice (en-GB, RyanNeural)",
  "ShortName": "en-GB-RyanNeural",
  "Gender": "Male",
  "Locale": "en-GB"
}
```

### API Endpoints
*   `GET /api/system/voices`: Proxies the cached list from Python.
*   `POST /api/system/preview-tts`: Proxies the generation request. Payload: `{ text, voice }`.

### Dependencies
*   **Backend:** `edge-tts` (Python package).
*   **Frontend:** No new packages, but requires creating a reusable `SearchableSelect` component.

## 9. Design and User Interface

### Voice Library Modal
*   **Header:** "Voice Library" title, Search Bar.
*   **Controls:**
    *   Input: `[ Text Field: "15 mins to {prayer}" ]`
    *   Dropdowns: `[ Prayer: Fajr ]`, `[ Gender: All ]`, `[ Language: English ]`
*   **Table:**
    *   Rows: Play Button | Name | Gender | Region | Action (Select/Set Default)
*   **Footer:** "Close" button.

### Trigger Card
*   **Field:** "TTS Voice"
*   **Input:** Combobox showing currently selected voice.
*   **Default State:** Displays "Default (Voice Name)" if no specific voice is set.

## 10. Open Questions / Assumptions
*   **Assumption:** The `edge-tts` library is installed and available in the Python environment (handled by `requirements.txt`).
*   **Assumption:** Docker permissions allow creating the `public/audio/temp` directory at runtime.
*   **Assumption:** Users understand that non-Arabic voices will likely silence Arabic script.

## 11. Test Plan
*   **Unit Tests:**
    *   `audioAssetService`: Verify correct voice string is passed to `generateTTS` (Trigger > Global > Default).
    *   `schedulerService`: Verify temp file cleanup job runs and deletes old files.
    *   `schemas`: Verify new configuration fields validate correctly.
*   **Integration Tests:**
    *   `POST /preview-tts`: Verify file is created in `temp` and URL is returned.
    *   `GET /voices`: Verify data structure matches expected JSON.
```