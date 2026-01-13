# Project Tasks

## Task 1: Foundation - Constants & Configuration
- **Status:** done
- **Priority:** high
- **Dependencies:** []
- **Description:** Establish the central constants file for API mappings and update the configuration schema to support the new data strategy.
- **Details:**
  - Create `src/utils/constants.js`.
  - Export `CALCULATION_METHODS`, `ASR_JURISTIC_METHODS` (Madhabs), and `MIDNIGHT_MODES` mappings (Human readable string -> API ID).
  - Update `src/config/default.json` to include `"data": { "staleCheckDays": 7 }`.
  - Update `src/config/index.js` Zod schema to validate the new `data` object.
- **Test Strategy:**
  - Unit test: Import constants and verify keys/values match Aladhan documentation.
  - Unit test: Load config and verify `staleCheckDays` defaults to 7.
- **Subtasks:**
  - 1.1: Create constants.js - **Status:** done - **Dependencies:** []
  - 1.2: Update Config Schema & Default JSON - **Status:** done - **Dependencies:** []

## Task 2: Fetcher Refactor - Bulk Retrieval
- **Status:** done
- **Priority:** high
- **Dependencies:** [1]
- **Description:** Rewrite the fetcher service to support Annual (Aladhan) and Bulk (MyMasjid) data retrieval.
- **Details:**
  - Modify `src/services/fetchers.js`.
  - Implement `fetchAladhanAnnual(config, year)`:
    - Use `src/utils/constants.js` to map config strings to IDs.
    - Hit `/v1/calendar/{year}` endpoint.
    - Normalize response into `Map<ISODate, TimingsObject>`.
  - Implement `fetchMyMasjidBulk(config)`:
    - Hit the `GetMasjidTimings` endpoint.
    - Normalize response into `Map<ISODate, TimingsObject>`.
    - Ensure it handles partial data (e.g., 30 days) gracefully.
- **Test Strategy:**
  - Unit test: Mock Aladhan API response (full year) and verify parsed object keys match `YYYY-MM-DD`.
  - Unit test: Mock MyMasjid response (partial) and verify data structure.
- **Subtasks:**
  - 2.1: Implement fetchAladhanAnnual - **Status:** done - **Dependencies:** [1.1]
  - 2.2: Implement fetchMyMasjidBulk - **Status:** done - **Dependencies:** []

## Task 3: Prayer Service Refactor - Caching Logic
- **Status:** done
- **Priority:** high
- **Dependencies:** [2]
- **Description:** Overhaul the core service to handle the new Map-based cache structure and "Fetch All" logic.
- **Details:**
  - Modify `src/services/prayerTimeService.js`.
  - Update `readCache` to parse the new JSON schema (Meta + Data Map).
  - Implement `getPrayerTimes(config, date)`:
    - Check cache for specific `date`.
    - If miss: Trigger bulk fetch for the current year (using Fetchers from Task 2).
    - Save bulk result to `data/cache.json`, merging/overwriting existing keys.
  - Ensure `meta` section in cache is updated with `lastFetched` timestamp.
- **Test Strategy:**
  - Unit test: Simulate cache miss, verify fetcher is called, and cache file is written with multiple dates.
  - Unit test: Simulate cache hit, verify no fetch occurs.
- **Subtasks:**
  - 3.1: Implement Cache Read/Write Logic (New Schema) - **Status:** done - **Dependencies:** []
  - 3.2: Implement Bulk Fetch Orchestration - **Status:** done - **Dependencies:** [2.1, 2.2, 3.1]

## Task 4: API & Hybrid Iqamah Logic
- **Status:** done
- **Priority:** high
- **Dependencies:** [3]
- **Description:** Update the API endpoint to respect source-provided Iqamah times (MyMasjid) while maintaining calculation fallbacks (Aladhan).
- **Details:**
  - Modify `src/routes/api.js` (GET /prayers).
  - Logic update:
    - Retrieve raw data from `prayerTimeService`.
    - Check if raw data contains an explicit `iqamah` (from MyMasjid).
    - If yes: Use it directly.
    - If no: Call `calculateIqamah` (existing utility) using `config.prayers` settings.
- **Test Strategy:**
  - Integration Test: Mock MyMasjid source data with specific Iqamah. Verify API returns that exact time (ignoring offsets).
  - Integration Test: Mock Aladhan source. Verify API returns calculated time based on offset.
- **Subtasks:**
  - 4.1: Update GET /prayers Logic - **Status:** done - **Dependencies:** [3.2]

## Task 5: Automation - Maintenance Jobs
- **Status:** done
- **Priority:** medium
- **Dependencies:** [3]
- **Description:** Implement background jobs to keep data fresh and continuous.
- **Details:**
  - Modify `src/services/schedulerService.js`.
  - **Stale Check:** Run weekly. Check if `now - meta.lastFetched > config.staleCheckDays`. If so, trigger `getPrayerTimes` (force refresh).
  - **Year Boundary:** Run daily. If `now` is within 7 days of Dec 31st, check if `Jan 1st Next Year` exists in cache. If not, trigger fetch for `Next Year`.
- **Test Strategy:**
  - Unit test: Mock `meta.lastFetched` to 8 days ago. Verify refresh function is called.
  - Unit test: Mock date to Dec 28th. Verify fetch for next year is triggered.
- **Subtasks:**
  - 5.1: Implement Stale Data Check Job - **Status:** done - **Dependencies:** [3.2]
  - 5.2: Implement Year Boundary Lookahead - **Status:** done - **Dependencies:** [3.2]

## Task 6: Force Refresh Endpoint
- **Status:** done
- **Priority:** medium
- **Dependencies:** [3]
- **Description:** Add backend capability to manually wipe and rebuild the cache.
- **Details:**
  - Add `POST /api/settings/refresh-cache` to `src/routes/api.js`.
  - Logic: Delete/Clear `data/cache.json`. Trigger `getPrayerTimes` for current date (which forces a bulk fetch).
  - Return success/failure status.
- **Test Strategy:**
  - Integration Test: Call endpoint, verify cache file timestamp updates.
- **Subtasks:**
  - 6.1: Create Refresh Endpoint - **Status:** done - **Dependencies:** [3.2]

## Task 7: Frontend - Data Management UI
- **Status:** done
- **Priority:** medium
- **Dependencies:** [6]
- **Description:** Update the React Settings view to allow manual data refreshing.
- **Details:**
  - Update `client/src/views/SettingsView.jsx`.
  - Add "Data Management" card.
  - Display "Last Updated" (fetched from API meta).
  - Add "Refresh Data" button calling `POST /api/settings/refresh-cache`.
  - Handle loading state (spinner/toast) during refresh.
- **Test Strategy:**
  - Manual: Click button, observe loading state, verify "Last Updated" changes.
- **Subtasks:**
  - 7.1: Add Data Management UI Section - **Status:** done - **Dependencies:** [6.1]

## Task 8: Verification & Cleanup
- **Status:** done
- **Priority:** high
- **Dependencies:** [4, 5, 6, 7]
- **Description:** Run full suite tests and clean up legacy logic.
- **Details:**
  - Ensure old single-day cache logic is completely removed.
  - Run `npm test` (Unit & Integration).
  - Verify "Offline Mode" by disconnecting network and restarting server.
- **Test Strategy:**
  - Full E2E regression test.
- **Subtasks:**
  - 8.1: Remove Legacy Code - **Status:** done - **Dependencies:** []
  - 8.2: Run Full Test Suite - **Status:** done - **Dependencies:** []