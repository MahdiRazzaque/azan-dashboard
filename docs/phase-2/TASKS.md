# Project Tasks

## Task 1: Backend Refactor - Multi-Day Caching
- **Status:** done
- **Priority:** high
- **Dependencies:** []
- **Description:** Refactor the caching service to support storing prayer times for multiple dates, preventing data loss when fetching "tomorrow's" times.
- **Details:**
  - Modify `src/services/prayerTimeService.js`.
  - Update `data/cache.json` schema to use Date ISO strings as keys (e.g., `{ "2023-10-01": {...}, "2023-10-02": {...} }`).
  - Update `getPrayerTimes` to read/write based on the specific requested date.
  - Ensure backward compatibility or handle cache migration if necessary (or just clear old cache).
- **Test Strategy:**
  - Verify `data/cache.json` contains multiple entries after simulating fetches for two different days.
- **Subtasks:**
  - 1.1: Redesign Cache JSON Schema - **Status:** pending - **Dependencies:** []
  - 1.2: Refactor prayerTimeService read/write logic - **Status:** pending - **Dependencies:** [1.1]

## Task 2: Backend API - Next Prayer Logic
- **Status:** done
- **Priority:** high
- **Dependencies:** [1]
- **Description:** Update the API to intelligently calculate the `nextPrayer` object, handling the midnight transition automatically.
- **Details:**
  - Modify `src/routes/api.js` (or move logic to a service).
  - Implement logic: If `Now < Isha`, find next prayer in today's array.
  - Implement logic: If `Now > Isha`, call `getPrayerTimes` for Tomorrow and set `nextPrayer` to Tomorrow's Fajr.
  - Return structure: `{ name: "Fajr", time: "ISO_STRING", isTomorrow: true }`.
  - Remove per-prayer `nextChange` fields if they exist from Phase 1.
- **Test Strategy:**
  - Call API at 23:00 (mocked time). Verify response contains "Fajr" for the next date.
- **Subtasks:**
  - 2.1: Implement Next Prayer calculation logic - **Status:** pending - **Dependencies:** [1.2]
  - 2.2: Implement "Fetch Tomorrow" trigger - **Status:** pending - **Dependencies:** [2.1]

## Task 3: Backend Unit Tests
- **Status:** done
- **Priority:** high
- **Dependencies:** [2]
- **Description:** Implement unit tests to verify the new Caching and Next Prayer logic (TC-01, TC-02, TC-03).
- **Details:**
  - Create `tests/unit/nextPrayer.test.js`.
  - Test TC-01: Standard Countdown (Before Asr).
  - Test TC-02: Midnight Transition (After Isha).
  - Test TC-03: Cache Structure persistence.
- **Test Strategy:**
  - Run `npm test` and ensure all new tests pass.

## Task 4: Frontend Scaffolding & Assets
- **Status:** done
- **Priority:** medium
- **Dependencies:** []
- **Description:** Set up the folder structure and download necessary vendor libraries for the Frontend.
- **Details:**
  - Create directory `public/css` and `public/js`.
  - Create directory `public/js/vendor`.
  - Download `luxon.min.js` (v3.x) and save it to `public/js/vendor/`.
  - Create empty `public/css/style.css` and `public/js/app.js`.
  - Update `public/index.html` to link these new resources.
- **Test Strategy:**
  - Load `index.html` in browser, check Network tab to ensure all files load successfully (Status 200).

## Task 5: Frontend UI - Layout & Styling
- **Status:** done
- **Priority:** medium
- **Dependencies:** [4]
- **Description:** Implement the high-contrast Dark Mode UI with Split-Screen layout.
- **Details:**
  - Define CSS Variables (`--bg-app`, `--accent`, etc.) in `style.css`.
  - Implement Grid layout: Left Panel (Schedule), Right Panel (Focus).
  - Implement Mobile/Portrait media queries (Stacking layout).
  - Create HTML structure for Table, Clock, and Countdown containers.
  - Add "Loading" skeleton/spinner.
- **Test Strategy:**
  - Visually verify layout on Desktop (Landscape) and Mobile (Portrait) emulation.

## Task 6: Frontend Logic - State & Fetching
- **Status:** done
- **Priority:** high
- **Dependencies:** [2, 5]
- **Description:** Implement the core JavaScript logic to fetch data, handle timezones, and manage application state.
- **Details:**
  - Initialize Luxon in `app.js`.
  - Implement `fetchData()` function to hit `/api/prayers`.
  - Implement Error Handling: Show Red Dot/Offline indicator on failure (TC-04).
  - Implement Polling: `setInterval` (e.g., every 15 mins).
  - Store `serverTimezone` from API meta.
- **Test Strategy:**
  - Block network request in DevTools. Verify Red Dot appears.
  - Verify `fetchData` parses JSON correctly.

## Task 7: Frontend Logic - Clock & Countdown
- **Status:** done
- **Priority:** high
- **Dependencies:** [6]
- **Description:** Implement the real-time clock and dynamic countdown timer.
- **Details:**
  - Implement `updateClock()` loop (runs every second).
  - Display Current Time using Server Timezone (TC-07).
  - Calculate `remainingTime` based on `nextPrayer.time` from API.
  - Format countdown as `HH:mm:ss`.
  - Trigger Audio Beep at `00:00:00` (TC-06).
- **Test Strategy:**
  - Manually adjust system time to match server time. Watch countdown hit zero and listen for beep.

## Task 8: Frontend Logic - Dynamic Table
- **Status:** done
- **Priority:** medium
- **Dependencies:** [6]
- **Description:** Render the prayer schedule table dynamically based on API data.
- **Details:**
  - Clear existing table rows on refresh.
  - Iterate through prayers and render rows (Icon, Name, Start, Iqamah).
  - Logic: Apply "dimmed" class to passed prayers.
  - Logic: Apply "highlight" class to the `nextPrayer`.
- **Test Strategy:**
  - Verify that past prayers are dimmed and the upcoming prayer is highlighted.

## Task 9: Advanced Features (Wake Lock & Audio)
- **Status:** done
- **Priority:** low
- **Dependencies:** [6]
- **Description:** Implement the Screen Wake Lock API and Audio context setup.
- **Details:**
  - Check URL params for `?alwaysOn=true`.
  - If true, request `navigator.wakeLock.request('screen')` (TC-05).
  - Initialize Audio object for the "Beep" sound (ensure user interaction handling if browser blocks autoplay).
- **Test Strategy:**
  - Open URL with parameter. check Console for "Wake Lock active".

## Task 10: Final Integration & E2E Testing
- **Status:** done
- **Priority:** medium
- **Dependencies:** [1, 2, 3, 4, 5, 6, 7, 8, 9]
- **Description:** Perform full end-to-end verification of the system.
- **Details:**
  - Execute Manual Test Cases TC-04 through TC-07.
  - Verify "Midnight Transition" by mocking server time to 23:59 and watching the dashboard.
- **Test Strategy:**
  - Complete full walkthrough of User Stories US-1, US-2, US-3.