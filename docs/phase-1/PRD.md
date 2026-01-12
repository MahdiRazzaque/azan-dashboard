# Product Requirements Document: Phase 1 - Data Layer & Core Logic

## 1. Introduction
This document outlines the requirements for **Phase 1** of the Azan Dashboard project. This phase focuses exclusively on the "Brain" of the application: the backend data layer. The objective is to build a robust system capable of fetching, validating, calculating, and serving accurate Islamic prayer (Salah) and congregation (Iqamah) times.

## 2. Product Overview
The Azan Dashboard is a digital signage and automation system. Phase 1 establishes the foundation by creating an Express.js-based API that acts as the single source of truth for all downstream features (Frontend Display, Automation/Scheduler). It abstracts the complexity of external APIs (Aladhan/MyMasjid), timezones, and calculation rules into a unified, reliable internal API.

## 3. Goals and Objectives
*   **Reliability:** Ensure prayer times are available even if external internet connectivity fails temporarily (Caching).
*   **Accuracy:** Implement precise calculation logic for Iqamah times, including offsets, rounding, and fixed-time overrides.
*   **Flexibility:** Support multiple data sources (MyMasjid, Aladhan) with failover capabilities.
*   **Testability:** Establish a comprehensive testing environment to verify time-sensitive logic deterministically.
*   **Standardisation:** Serve all time data in a standardised format (ISO 8601 / UTC) to decouple the backend from the display logic.

## 4. Target Audience
*   **End Users:** Homeowners or Mosques setting up the dashboard who need reliable prayer times tailored to their local congregation rules.
*   **Developers:** Future contributors who need a clean, service-oriented architecture to build upon.

## 5. Features and Requirements

### 5.1 Configuration Management
*   **FR-01:** The system MUST load configuration from a `config/default.json` file.
*   **FR-02:** The configuration MUST support a user-defined Timezone (e.g., `Europe/London`) distinct from the system/server clock.
*   **FR-03:** The configuration MUST allow defining a **Primary** and an optional **Backup** data source.
*   **FR-04:** The configuration MUST support per-prayer settings for Fajr, Dhuhr, Asr, Maghrib, and Isha.
    *   Parameters: `iqamahOffset` (minutes), `roundTo` (minutes), `fixedTime` (HH:mm string).

### 5.2 Data Retrieval & Resilience
*   **FR-05:** The system MUST fetch prayer times using the Native Node.js `fetch` API.
*   **FR-06:** **Failover Logic:**
    1.  Attempt to fetch from the **Primary Source**.
    2.  If Primary fails AND Backup is configured, attempt the **Backup Source**.
    3.  If both fail (or no Backup), attempt to read the most recent successful data from `data/cache.json`.
    4.  If no cache exists, return a critical error (HTTP 500).
*   **FR-07:** The system MUST validate all external API responses using `zod` schemas before processing. Invalid data must trigger the failover logic.
*   **FR-08:** Successful fetches MUST be written to `data/cache.json` for future resilience.

### 5.3 Calculation Logic
*   **FR-09:** **Iqamah Calculation:**
    *   **Priority 1 (Fixed):** If `fixedTime` is set (e.g., "20:00"), the Iqamah time is strictly that value, ignoring offsets/rounding.
    *   **Priority 2 (Dynamic):** If `fixedTime` is null/empty:
        1.  Add `iqamahOffset` to the prayer start time.
        2.  Round the result **UP** to the next interval defined by `roundTo`.
        3.  *Edge Case:* If the calculated time lands exactly on the interval, it remains unchanged.
*   **FR-10:** All internal calculations MUST be performed using `luxon` to ensure correct Timezone handling, regardless of the server's local time.

### 5.4 API Endpoints
*   **FR-11:** `GET /api/prayers`
    *   Returns JSON containing:
        *   `meta`: Date, Location, Source used.
        *   `prayers`: Object keyed by prayer name, containing `start` (ISO), `iqamah` (ISO), and `nextChange` (logic for next day).

## 6. User Stories and Acceptance Criteria

### US-1: Configuration Setup
**As a** system administrator,
**I want** to define specific rules for Isha (e.g., fixed at 8 PM) and Maghrib (e.g., +10 mins),
**So that** the dashboard matches my local mosque's timetable.

*   **AC-1:** Modifying `config/default.json` changes the output of `/api/prayers`.
*   **AC-2:** Setting `fixedTime: "20:00"` for Isha results in an Iqamah time of exactly 20:00, regardless of the sun's position.

### US-2: Network Resilience
**As a** user with unstable internet,
**I want** the system to show yesterday's cached data if the internet is down,
**So that** I don't see a blank screen or error message.

*   **AC-1:** Simulate network failure (mock `fetch` reject); system reads from `data/cache.json`.
*   **AC-2:** If cache is missing and network fails, API returns 500.

### US-3: Data Accuracy
**As a** developer,
**I want** to ensure my time calculations are correct across timezones,
**So that** the system works correctly when deployed to a cloud server (UTC).

*   **AC-1:** Unit tests using `luxon` confirm that calculations respect the `config.timezone` setting, even if the test runner is in a different timezone.

## 7. Technical Requirements / Stack

*   **Runtime:** Node.js (v18+)
*   **Framework:** Express.js (v5.x as per current codebase)
*   **Core Libraries:**
    *   `luxon`: For date/time manipulation and timezone management.
    *   `zod`: For runtime schema validation of API responses and Config.
*   **Testing:**
    *   `jest`: Test runner and assertion library.
    *   `supertest`: For integration testing of API endpoints.
*   **Architecture:**
    *   `src/config/`: Configuration loader.
    *   `src/services/`: Business logic (Fetching, Caching).
    *   `src/utils/`: Pure functions (Calculations, Formatting).
    *   `src/routes/`: API route definitions.

## 8. Data & Configuration Structure

### 8.1 Default Configuration (`config/default.json`)
```json
{
  "location": {
    "timezone": "Europe/London",
    "coordinates": { "lat": 51.5074, "long": -0.1278 }
  },
  "calculation": {
    "method": "MoonsightingCommittee",
    "madhab": "Hanafi"
  },
  "prayers": {
    "fajr":    { "iqamahOffset": 20, "roundTo": 15, "fixedTime": null },
    "dhuhr":   { "iqamahOffset": 15, "roundTo": 15, "fixedTime": null },
    "asr":     { "iqamahOffset": 15, "roundTo": 15, "fixedTime": null },
    "maghrib": { "iqamahOffset": 10, "roundTo": 5,  "fixedTime": null },
    "isha":    { "iqamahOffset": 15, "roundTo": 15, "fixedTime": "20:00" }
  },
  "sources": {
    "primary": { "type": "aladhan" },
    "backup":  { "type": "mymasjid", "masjidId": "uuid-placeholder" }
  }
}
```

## 9. Testing Strategy
*   **Unit Tests:** Located in `src/**/*.test.js`. Must mock `fetch` responses and `Date` (via Jest timers or Luxon mocks) to ensure deterministic results.
*   **Integration Tests:** Located in `tests/integration/`. Use `supertest` to hit the `/api/prayers` endpoint and verify the JSON structure and status codes (200 vs 500).
*   **Command:** Tests shall be runnable via `npm test`.

## 10. Open Questions / Assumptions
*   **Assumption:** The user is responsible for obtaining valid API IDs (e.g., MyMasjid UUID) if they choose to use those sources.
*   **Assumption:** The server has write access to the `data/` directory for caching purposes.