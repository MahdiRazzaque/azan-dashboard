# Product Requirements Document: Phase 5.01 - Sunrise & User Experience Enhancements

## 1. Title
Phase 5.01 - Sunrise Integration & User Experience Enhancements

## 2. Introduction
This document outlines the requirements for **Phase 5.01** of the Azan Dashboard. This phase introduces "Sunrise" (Shuruq) as a first-class event within the system, sitting chronologically between Fajr and Dhuhr. Unlike standard prayers, Sunrise does not have an Iqamah (Congregation) time, requiring specialized handling in the Data, UI, and Automation layers. Additionally, this phase addresses UI gaps by exposing offset controls for pre-announcements and adding client-side preferences for countdown behavior.

## 3. Product Overview
The system will be updated to fetch, calculate, and display Sunrise times.
*   **Dashboard:** A new row for Sunrise will appear. The countdown timer will optionally target Sunrise based on user preference.
*   **Automation:** Users can configure "Pre-Sunrise" (reminder) and "Sunrise" (actual time) announcements.
*   **Settings:** A new "Sunrise" tab will be added to the Prayer Configuration screen. It will feature a simplified layout (no Iqamah settings) and allow precise control over pre-announcement offsets.
*   **Diagnostics:** Developer tools and File Manager will be updated to track Sunrise-related assets and jobs.

## 4. Goals and Objectives
*   **Completeness:** Provide a full Islamic timeline including Shuruq, which is critical for determining the end of Fajr time.
*   **Flexibility:** Allow users to choose whether the dashboard emphasizes Sunrise (counting down to it) or focuses on the next prayer (Dhuhr).
*   **Granularity:** enable specific audio triggers for Sunrise separate from Fajr.
*   **Usability:** Fix the missing UI control for setting pre-announcement offsets (minutes before event).

## 5. Target Audience
*   **Mosque Admins:** Displaying Shuruq time for the congregation.
*   **Home Users:** Who want a "15 minutes to Sunrise" warning to ensure they pray Fajr on time.

## 6. Features and Requirements

### 6.1 Data Layer & Schema
*   **FR-01: Schema Update**
    *   Update `automationSchema` in `src/config/schemas.js`.
    *   Add `sunrise` to the `triggers` object.
    *   Define a restricted schema for Sunrise that **only** contains `preAdhan` and `adhan`. It MUST NOT include `preIqamah` or `iqamah`.
*   **FR-02: Fetcher Mapping**
    *   Update `fetchAladhanAnnual`: Map `timings.Sunrise` to the internal key `sunrise`.
    *   Update `fetchMyMasjidBulk`: Map `salahTimings.shouruq` (or `sunrise`) to the internal key `sunrise`.
    *   Ensure validation schemas accept these new fields.

### 6.2 Backend Logic
*   **FR-03: Prayer Service**
    *   Update `prayerTimeService.getPrayersWithNext` to include `sunrise` in the returned `prayers` object.
    *   Ensure `sunrise` object has `start` time but `iqamah` is null/undefined.
*   **FR-04: Next Prayer Calculation**
    *   Update `calculateNextPrayer` in `src/utils/calculations.js`.
    *   Include 'sunrise' in the chronological check loop.
    *   If `now < sunrise`, return Sunrise as the `nextPrayer`.
*   **FR-05: Scheduler**
    *   Update `schedulerService.js` loop to process the `sunrise` key.
    *   Ensure it skips Iqamah logic for Sunrise.
    *   Map `sunrise` events to global switches:
        *   Sunrise `preAdhan` -> Global `preAdhanEnabled`.
        *   Sunrise `adhan` -> Global `adhanEnabled`.

### 6.3 Frontend: Settings UI
*   **FR-06: TriggerCard Enhancements**
    *   Add a numeric input field: "Trigger Minutes Before".
    *   **Logic:** Only render this input if `eventType` starts with `pre` (e.g., `preAdhan`, `preIqamah`).
    *   Bind this input to the `offsetMinutes` property of the trigger.
*   **FR-07: Prayer Settings View**
    *   Add "Sunrise" to the navigation pills (between Fajr and Dhuhr).
    *   **Tab Logic:**
        *   If Active Tab is "Sunrise":
            *   **Hide** the "Timing Logic" (Iqamah) card completely.
            *   **Render** only two `TriggerCard`s: "1. Pre-Sunrise" (mapped to `preAdhan`) and "2. Sunrise Time" (mapped to `adhan`).
    *   **Warnings:** Ensure System Health warnings (TTS/VoiceMonkey down) work for Sunrise cards.

### 6.4 Frontend: Dashboard & Preferences
*   **FR-08: Client Preferences**
    *   Update `ClientPreferencesContext`.
    *   Add setting: `countdownMode: 'sunrise' | 'dhuhr'` (Default: `sunrise`).
    *   Add `sunrise` to the audio exclusion list support.
*   **FR-09: Dashboard Logic**
    *   **PrayerCard:** Render a row for Sunrise. Apply "Next" highlighting if it is the current next event.
    *   **FocusCard:**
        *   If `nextPrayer.name === 'sunrise'` AND `preferences.countdownMode === 'dhuhr'`:
            *   Manually calculate time to `prayers.dhuhr.start`.
            *   Display "Upcoming: Dhuhr".
        *   Else: Display `nextPrayer` as returned by API.

### 6.5 Developer Tools & Files
*   **FR-10: Diagnostics**
    *   Update `getAutomationStatus` (Backend) and the status table (Frontend) to show a row for Sunrise.
    *   Update `getTTSStatus` (Backend) and table to show Sunrise.
*   **FR-11: File Manager**
    *   Update the grouping logic to recognize `tts_sunrise_...` files and group them under a "Sunrise" header.

## 7. User Stories and Acceptance Criteria

### US-1: Sunrise Warning
**As a** home user,
**I want** to hear a "15 minutes until Sunrise" announcement,
**So that** I rush to pray Fajr before the time ends.

*   **AC-1:** Go to Settings -> Prayers -> Sunrise.
*   **AC-2:** Enable "Pre-Sunrise".
*   **AC-3:** Set "Trigger Minutes Before" to `15`.
*   **AC-4:** Set Type to TTS ("15 minutes until Sunrise").
*   **AC-5:** At 15 mins before Shuruq, the announcement plays.

### US-2: Mosque Display
**As a** mosque admin,
**I want** the countdown to skip Sunrise and point to Dhuhr,
**So that** the congregation focuses on the next prayer, not the forbidden prayer time.

*   **AC-1:** Open Display Settings on the Mosque TV.
*   **AC-2:** Toggle "Countdown to Sunrise" to **OFF**.
*   **AC-3:** After Fajr, the main clock says "Upcoming: Dhuhr" (even though Sunrise hasn't happened yet).
*   **AC-4:** The Schedule Table still shows the Sunrise time row for reference.

### US-3: Configuration Safety
**As a** user,
**I want** to configure Sunrise without seeing confusing "Iqamah" settings,
**So that** I don't set a congregation time for a non-prayer.

*   **AC-1:** Click "Sunrise" tab in settings.
*   **AC-2:** The "Timing Logic / Iqamah" card is hidden.
*   **AC-3:** Only "Pre-Sunrise" and "Sunrise Time" triggers are visible.

## 8. Technical Requirements / Stack
*   **Backend:** Node.js, Zod.
*   **Frontend:** React, Context API.

## 9. Data Structures

### 9.1 Config Schema Update
```javascript
// New subset schema for Sunrise
const sunriseTriggersSchema = z.object({
  preAdhan: triggerEventSchema,
  adhan: triggerEventSchema
});

// Main Automation Schema
triggers: z.object({
  fajr: prayerTriggersSchema,
  sunrise: sunriseTriggersSchema, // New
  dhuhr: prayerTriggersSchema,
  // ...
})
```

## 10. Open Questions / Assumptions
*   **Assumption:** The internal key for the event remains `preAdhan` and `adhan` for simplicity in the backend `schedulerService` loop, but the UI will label them "Pre-Sunrise" and "Sunrise".