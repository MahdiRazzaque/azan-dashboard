# Product Requirements Document: Phase 2 - Presentation Layer & Dashboard

## 1. Introduction
This document outlines the requirements for **Phase 2** of the Azan Dashboard project. While Phase 1 established the backend "Brain", Phase 2 focuses on the "Face"—the user-facing Digital Signage Dashboard. The objective is to create a responsive, aesthetically pleasing, and highly resilient web interface that displays prayer times and countdowns, heavily inspired by modern dark-mode UI designs.

## 2. Product Overview
The Phase 2 deliverable is a Single Page Application (SPA) served by the existing Express.js backend. It consumes the `/api/prayers` endpoint to render a "Split View" dashboard. The application is designed to run continuously on dedicated screens (Smart TVs, Tablets, Monitors) in Mosques or Homes. It features intelligent logic to handle midnight transitions, network instability, and screen sleep prevention.

## 3. Goals and Objectives
*   **Visual Clarity:** Present information in a high-contrast "Dark Mode" layout suitable for viewing from a distance.
*   **Resilience:** Ensure the dashboard remains functional and informative even if the internet connection drops (using cached data and offline indicators).
*   **Accuracy:** Guarantee that the displayed countdown matches the backend calculation exactly, regardless of the client device's time settings.
*   **Responsiveness:** Adapt the layout for both Landscape (Monitor) and Portrait/Mobile screens.
*   **Zero Maintenance:** The dashboard should handle the transition from "Today" to "Tomorrow" automatically without user intervention.

## 4. Target Audience
*   **End Users:** Individuals checking the time for the next prayer or verifying the Iqamah time for congregation.
*   **Administrators:** Users setting up the display who need a "set and forget" solution.

## 5. Features and Requirements

### 5.1 Backend Enhancements (API & Caching)
*   **FR-01: Multi-Day Caching Strategy**
    *   The `src/services/prayerTimeService.js` and caching logic MUST be refactored.
    *   Instead of overwriting `data/cache.json` with a single day, the cache MUST support storing multiple dates (e.g., keyed by ISO Date string).
    *   This allows the system to fetch "Tomorrow's" data for the countdown without losing "Today's" data for the schedule.
*   **FR-02: Smart `nextPrayer` Calculation**
    *   The `/api/prayers` endpoint MUST calculate and return a `nextPrayer` object.
    *   Logic:
        *   If `Now < Isha`, return the immediate next prayer for today.
        *   If `Now > Isha`, fetch/calculate **Tomorrow's Fajr** and return that as the next prayer.
    *   Structure: `{ name: "Fajr", time: "2023-10-02T05:00:00...", remainingSeconds: 12345 }`.

### 5.2 Frontend Architecture
*   **FR-03: Asset Separation**
    *   The frontend MUST be split into structured files:
        *   `public/css/style.css`
        *   `public/js/app.js`
        *   `public/js/vendor/luxon.min.js` (Local file, not CDN, to ensure intranet/offline capability).
*   **FR-04: Client-Side Time Management**
    *   The frontend MUST use `Luxon` to parse all times.
    *   The frontend clock MUST display the time relative to the **Server's Timezone** (provided in API `meta`), ignoring the browser's local system time to prevent drift.

### 5.3 User Interface & Design
*   **FR-05: Split-Screen Layout (Landscape)**
    *   **Left Panel (Schedule):** A vertical table listing all 5 prayers + Sunrise.
        *   Columns: Prayer Name (with icon), Start Time, Iqamah Time.
        *   Rows must have visual separators.
    *   **Right Panel (Focus):**
        *   **Digital Clock:** Large, prominent display of the current time (HH:mm:ss).
        *   **Countdown:** "Next Prayer" label, the name of the prayer, and a dynamic countdown timer (HH:mm:ss).
*   **FR-06: Mobile/Portrait Layout**
    *   On smaller screens (< 768px), the layout MUST stack: Clock/Countdown on top, Schedule table below.
*   **FR-07: Visual Logic (State)**
    *   **Passed Prayers:** Rows for prayers that have passed for the day MUST be visually dimmed (lower opacity).
    *   **Next Prayer:** The row for the upcoming prayer MUST be highlighted (e.g., brighter text or subtle background accent).
*   **FR-08: Loading & Error States**
    *   A "Loading" skeleton or spinner MUST appear on initial load.
    *   If the API polling fails, a visual **Red Dot** or "Offline" icon MUST appear in the footer or corner. The old data should remain visible.

### 5.4 Interactions & Automation
*   **FR-09: Audio Feedback**
    *   When the countdown reaches `00:00:00`, the dashboard MUST emit a single, simple "Beep" sound.
*   **FR-10: Screen Wake Lock**
    *   If the URL contains the query parameter `?alwaysOn=true`, the application MUST verify support for and engage the **Screen Wake Lock API** to prevent the display from sleeping.
*   **FR-11: Data Refresh**
    *   The frontend MUST poll `/api/prayers` periodically (e.g., every 15 minutes) and specifically check for a date change at midnight to refresh the table.

## 6. User Stories and Acceptance Criteria

### US-1: Dashboard Visibility
**As a** mosque attendee,
**I want** to see the prayer times clearly from the back of the room,
**So that** I know when the congregation (Iqamah) starts.

*   **AC-1:** The font size for "Iqamah" is large and legible.
*   **AC-2:** The design uses a high-contrast Dark Mode (Dark Grey background, White text).

### US-2: Next Prayer Awareness
**As a** user,
**I want** to know exactly how long is left until the Azan,
**So that** I can prepare for prayer.

*   **AC-1:** The "Next Prayer" section displays a countdown that ticks down every second.
*   **AC-2:** If the current time is after Isha, the countdown points to Fajr of the next day.

### US-3: Network Resilience
**As a** system administrator,
**I want** the screen to keep working even if the Wi-Fi drops,
**So that** the dashboard doesn't show a "404" or blank screen.

*   **AC-1:** If the periodic fetch fails, the last known times remain on screen.
*   **AC-2:** A red indicator appears to warn that data might be stale.

## 7. Technical Requirements / Stack

*   **Frontend:**
    *   **HTML5:** Semantic structure.
    *   **CSS3:** Flexbox/Grid for layout, CSS Variables for theming.
    *   **JavaScript (ES6+):** Vanilla JS, no build steps (Webpack/Vite) required yet.
    *   **Library:** `luxon` (v3.x) stored locally in `public/js/vendor/`.
*   **Backend:**
    *   Existing Express.js stack.
    *   Refactored `prayerTimeService.js` for multi-day caching.

## 8. Design and User Interface

### 8.1 Colour Palette (CSS Variables)
```css
:root {
    --bg-app: #1a1a1a;       /* Very dark grey for body */
    --bg-card: #2d2d2d;      /* Slightly lighter for panels */
    --text-primary: #ffffff; /* White */
    --text-dim: #ffffff80;   /* 50% Opacity white */
    --accent: #ffd700;       /* Gold/Yellow for Next Prayer highlight */
    --danger: #ff4444;       /* Red for Offline indicator */
}
```

### 8.2 Layout Wireframe Description
*   **Container:** `display: grid; grid-template-columns: 1fr 1fr;`
*   **Left (Schedule):** `<table>` with `<thead>` (Start, Iqamah) and `<tbody>` (Prayer rows).
*   **Right (Focus):** Flex container, vertically centred.
    *   `div.clock`: Huge font size.
    *   `div.countdown`: Medium font size, accent colour.
    *   `div.status`: Bottom right, small text/icon.

## 9. Open Questions / Assumptions
*   **Assumption:** The target device browser supports the Screen Wake Lock API (Chrome/Edge/Samsung Internet usually do; Safari/iOS is limited).
*   **Assumption:** The user will manually enable audio permissions (Auto-play policy) by interacting with the page at least once (e.g., clicking "Enter Fullscreen").

## 10. Testing Strategy

### 10.1 Backend Unit Tests
*   **Test Suite:** `tests/unit/nextPrayer.test.js`
*   **TC-01: Standard Countdown:**
    *   **Input:** Current Time = 13:00 (Before Asr).
    *   **Expected:** `nextPrayer` is Asr. `remainingSeconds` > 0.
*   **TC-02: Midnight Transition:**
    *   **Input:** Current Time = 23:00 (After Isha).
    *   **Expected:** `nextPrayer` is Fajr (Date = Tomorrow).
*   **TC-03: Cache Structure:**
    *   **Action:** Call `getPrayerTimes` for Day 1, then Day 2.
    *   **Expected:** `data/cache.json` contains keys for both dates (no overwrite).

### 10.2 Frontend Manual / E2E Checks
*   **TC-04: Offline Resilience:**
    *   **Action:** Load dashboard -> Stop Node Server -> Wait for poll interval.
    *   **Expected:** Red "Offline" dot appears. Times do not disappear.
*   **TC-05: Wake Lock Trigger:**
    *   **Action:** Open URL with `?alwaysOn=true`.
    *   **Expected:** Console logs "Wake Lock active". Screen does not dim (requires 5+ min observation).
*   **TC-06: Audio Beep:**
    *   **Action:** Manually set client clock to 5 seconds before prayer.
    *   **Expected:** At 00:00:00, a beep sound is audible.
*   **TC-07: Timezone Handling:**
    *   **Action:** Set Server config to "America/New_York". Set Client PC time to "Europe/London".
    *   **Expected:** Dashboard clock displays New York time, not London time.