# Product Requirements Document: Phase 4.99 - Client Personalisation & Device Settings

## 1. Title
Phase 4.99 - Client Personalisation & Device-Specific Settings

## 2. Introduction
This document outlines the requirements for **Phase 4.99** of the Azan Dashboard. This phase marks a paradigm shift in how "Browser" audio targeting is handled. Previously, the server administrator decided whether *all* connected browsers played audio. Now, this control is moved to the client side. The server will broadcast all active automation events, and each individual browser (TV, Tablet, Mobile) can decide whether to play the audio based on local preferences. Additionally, this phase introduces appearance customisation, allowing users to tailor the clock format and theme to their specific display hardware.

## 3. Product Overview
The "Browser" target option will be removed from the Admin Control Panel. Instead, a new "Display Settings" menu will be added to the main Dashboard view. This menu allows users to configure **Appearance** (Clock format, Dark mode, Countdown style) and **Prayer Audio** (Muting specific prayers/events locally) for that specific device. These settings will be persisted in the browser's `localStorage`.

## 4. Goals and Objectives
*   **User Autonomy:** Allow each screen to have its own audio configuration (e.g., Main Hall TV plays everything, Office Monitor is muted).
*   **Simplification:** Remove the confusing "Browser" checkbox from the Admin Panel; the server simply announces "Event X is happening", and clients react.
*   **Customisation:** Support different time formats (12h/24h) and visual styles to suit different screen sizes and user preferences.
*   **Performance:** Implement this logic entirely on the client side to avoid increasing server load or database complexity.

## 5. Target Audience
*   **Mosque Admins:** Who want the main hall TV to look different from the lobby display.
*   **Home Users:** Who want their kitchen tablet to be silent for Fajr but the hallway speaker (Local) to play it.

## 6. Features and Requirements

### 6.1 Backend: Target Refactoring
*   **FR-01: Schema Update**
    *   The `targetSchema` in `src/config/schemas.js` MUST remove `'browser'` as a valid enum option.
    *   The schema transform logic MUST silently filter out `'browser'` from existing configurations to prevent crash loops on startup with legacy data.
*   **FR-02: Unconditional Broadcasting**
    *   The `automationService.triggerEvent` method MUST be refactored.
    *   It MUST always broadcast the `AUDIO_PLAY` event via `sseService`, provided the trigger itself is enabled and has a valid audio source (URL/File).
    *   It MUST NO LONGER check if `targets` includes `'browser'`.

### 6.2 Frontend: Client Preferences Engine
*   **FR-03: Preferences Context**
    *   Create `ClientPreferencesContext`.
    *   **Persistence:** Store state in `localStorage` under key `azan-client-prefs`.
    *   **State Structure:**
        ```javascript
        {
          appearance: {
            theme: 'dark',          // 'dark' | 'light'
            clockFormat: '24h',     // '12h' | '24h'
            showSeconds: true,      // boolean
            countdownMode: 'normal' // 'normal' | 'digital' | 'minimal'
          },
          // Map of enabled audio events. Key: "{prayer}-{event}" (e.g. "fajr-preAdhan")
          // Default: true (all enabled)
          audioExclusions: [] 
        }
        ```
*   **FR-04: Audio Filtering**
    *   The `useSSE` hook (or the component consuming it) MUST verify the incoming `AUDIO_PLAY` payload against the `audioExclusions` list.
    *   If the event key (e.g., `fajr-adhan`) is found in the exclusion list, the audio MUST NOT play.

### 6.3 Frontend: Display Settings UI
*   **FR-05: Settings Modal**
    *   A new modal component `ClientSettingsModal` MUST be created.
    *   **Trigger:** A new button in `TopControls` (e.g., `Monitor` or `Sliders` icon).
    *   **Layout:** Sidebar or Tabs for "Appearance" and "Prayers".
*   **FR-06: Appearance Tab**
    *   **Clock Format:** Toggle/Radio for 12h / 24h.
    *   **Seconds:** Toggle for "Show Seconds".
    *   **Countdown:** Select for "Full Text" (1hr 30min), "Digital" (01:30:00), or "Minimal" (Hide seconds > 1min).
    *   **Theme:** Toggle for Light/Dark (Updates CSS variables on `html` root).
*   **FR-07: Prayers Tab**
    *   A grid layout (Rows: Prayers, Cols: Events).
    *   Checkboxes to Enable/Disable audio for that specific cell.
    *   "Mute All" / "Unmute All" helper buttons.

### 6.4 Frontend: Component Updates
*   **FR-08: Admin Cleanup**
    *   Update `TriggerCard.jsx` to remove the "Browser" checkbox option.
*   **FR-09: Dashboard Reactivity**
    *   Update `FocusCard.jsx` to consume `ClientPreferencesContext`.
    *   Apply logic for `clockFormat` (using Luxon `toFormat`), `showSeconds`, and `countdownMode`.

## 7. User Stories

### US-1: Per-Device Muting
**As a** mosque admin,
**I want** to mute the office dashboard while keeping the main hall TV audio on,
**So that** I don't get disturbed while working, but the congregation still hears the Azan.

*   **AC-1:** Open Dashboard on Office PC.
*   **AC-2:** Click Display Settings -> Prayers.
*   **AC-3:** Click "Mute All".
*   **AC-4:** Main Hall TV remains untouched.
*   **AC-5:** When prayer time comes, Office PC is silent; Main Hall TV plays audio.

### US-2: Clock Customisation
**As a** home user,
**I want** to see a 12-hour clock without seconds,
**So that** it looks more like a traditional wall clock.

*   **AC-1:** Open Display Settings -> Appearance.
*   **AC-2:** Select "12h" and toggle off "Seconds".
*   **AC-3:** The main clock updates immediately to "01:30 PM".

## 8. Technical Requirements / Stack
*   **Frontend:** React Context API, `localStorage`.
*   **Backend:** Node.js (Zod Schema update).

## 9. Design and User Interface
*   **Display Settings Icon:** Placed in `TopControls` next to Mute/Settings.
*   **Modal:** Dark themed (default), consistent with `SaveProcessModal`.
*   **Prayers Grid:**
    *   Headers: Pre-Adhan, Adhan, Pre-Iqamah, Iqamah.
    *   Rows: Fajr, Dhuhr...
    *   Cells: Toggle switches.

## 10. Open Questions / Assumptions
*   **Assumption:** The backend `automationService` logic for `handleVoiceMonkey` and `handleLocal` remains unchanged (they still respect the `targets` array from the config). Only `handleBrowser` is decoupled.