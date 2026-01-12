# Project Tasks

## Task 1: Project Initialization & Architecture Setup
- **Status:** done
- **Priority:** high
- **Dependencies:** []
- **Description:** Initialize the project dependencies and folder structure to support the Service-Oriented Architecture defined in the PRD.
- **Details:**
  - Install production dependencies: `luxon`, `zod`.
  - Install dev dependencies: `jest`, `supertest`.
  - Create directory structure: `src/config`, `src/services`, `src/utils`, `src/routes`, `tests/integration`, `tests/unit`.
  - Ensure `data/` directory exists for caching.
- **Test Strategy:**
  - Verify `package.json` contains new dependencies.
  - Verify folder structure exists.
- **Subtasks:**
  - 1.1: Install NPM packages - **Status:** done - **Dependencies:** []
  - 1.2: Create folder hierarchy - **Status:** done - **Dependencies:** []

## Task 2: Configuration Implementation
- **Status:** done
- **Priority:** high
- **Dependencies:** [1]
- **Description:** Implement the configuration loader and the default JSON file structure (FR-01, FR-02, FR-03, FR-04).
- **Details:**
  - Create `config/default.json` matching the structure in PRD Section 8.1.
  - Implement a configuration loader (e.g., `src/config/index.js`) to read and parse the file.
  - Define a Zod schema to validate the config structure at startup (ensure latitude/longitude and prayer settings exist).
- **Test Strategy:**
  - Unit test: Load config and assert that specific keys (e.g., `prayers.fajr.iqamahOffset`) are accessible.
  - Unit test: Validate that missing keys throw a Zod error.
- **Subtasks:**
  - 2.1: Create default.json - **Status:** done - **Dependencies:** []
  - 2.2: Implement config loader with Zod validation - **Status:** done - **Dependencies:** [2.1]

## Task 3: Test Environment Configuration
- **Status:** done
- **Priority:** high
- **Dependencies:** [1]
- **Description:** Set up Jest and Supertest to support deterministic time testing (FR-10, US-3).
- **Details:**
  - Configure `jest.config.js`.
  - precise time mocking (either via Jest's fake timers or a Luxon wrapper).
  - Ensure tests can force a specific Timezone (e.g., `Europe/London`) regardless of the machine running them.
- **Test Strategy:**
  - Run a dummy test that asserts `new Date()` matches a mocked timestamp.
- **Subtasks:**
  - 3.1: Configure Jest - **Status:** done - **Dependencies:** []
  - 3.2: Verify Timezone mocking - **Status:** done - **Dependencies:** [3.1]

## Task 4: Calculation Utilities (The "Math" Layer)
- **Status:** done
- **Priority:** high
- **Dependencies:** [1, 3]
- **Description:** Implement the pure functions for Iqamah calculation and rounding (FR-09, FR-10).
- **Details:**
  - Create `src/utils/calculations.js`.
  - Implement `calculateIqamah(prayerStart, settings, date)` function.
  - Logic:
    1. Check `settings.fixedTime`. If set, return it.
    2. Else, add `settings.iqamahOffset`.
    3. Round up to nearest `settings.roundTo`.
  - Use `luxon` for all date operations.
- **Test Strategy:**
  - Unit Tests (`src/utils/calculations.test.js`):
    - Test Fixed Time override.
    - Test Dynamic Rounding (e.g., 18:03 + 10m -> 18:13 -> rounds to 18:15).
    - Test Edge Case: Time landing exactly on interval.
- **Subtasks:**
  - 4.1: Implement core math functions - **Status:** done - **Dependencies:** []
  - 4.2: Write unit tests for rounding and offsets - **Status:** done - **Dependencies:** [4.1]

## Task 5: Data Fetching Services (The "Source" Layer)
- **Status:** done
- **Priority:** medium
- **Dependencies:** [1, 2]
- **Description:** Implement logic to fetch from Aladhan and MyMasjid APIs with Zod validation (FR-05, FR-07).
- **Details:**
  - Create `src/services/fetchers.js`.
  - Define Zod schemas for Aladhan and MyMasjid API responses.
  - Implement functions using native `fetch`.
  - Ensure data is normalized into a standard internal format (ISO strings).
- **Test Strategy:**
  - Mock `fetch` and verify that valid JSON returns parsed data.
  - Mock `fetch` with invalid structure and verify Zod throws an error.
- **Subtasks:**
  - 5.1: Define Zod schemas for external APIs - **Status:** done - **Dependencies:** []
  - 5.2: Implement Aladhan fetcher - **Status:** done - **Dependencies:** [5.1]
  - 5.3: Implement MyMasjid fetcher - **Status:** done - **Dependencies:** [5.1]

## Task 6: Resilience & Caching Service
- **Status:** done
- **Priority:** high
- **Dependencies:** [5, 2]
- **Description:** Orchestrate the "Primary -> Backup -> Cache" failover logic (FR-06, FR-08, US-2).
- **Details:**
  - Create `src/services/prayerTimeService.js`.
  - Implement `getPrayerTimes()`:
    1. Try Primary Source (from Config).
    2. Catch Error -> Try Backup Source (if configured).
    3. Catch Error -> Try reading `data/cache.json`.
    4. Save successful fetch to cache.
- **Test Strategy:**
  - Unit Test: Mock fetch failures and verify fallback to Backup.
  - Unit Test: Mock all network failures and verify fallback to Cache.
- **Subtasks:**
  - 6.1: Implement File I/O for Caching - **Status:** done - **Dependencies:** []
  - 6.2: Implement Failover Logic - **Status:** done - **Dependencies:** [6.1, 5.2, 5.3]

## Task 7: API Endpoint Integration
- **Status:** done
- **Priority:** medium
- **Dependencies:** [6, 4]
- **Description:** Expose the calculated data via Express (FR-11).
- **Details:**
  - Create `src/routes/api.js`.
  - Define `GET /prayers`.
  - Call `prayerTimeService` to get raw times.
  - Apply `calculationUtils` to generate Iqamah times.
  - Return JSON response.
- **Test Strategy:**
  - Integration Test (`supertest`): Hit `/api/prayers`, check 200 OK and JSON structure.
- **Subtasks:**
  - 7.1: Create Express Route - **Status:** done - **Dependencies:** []
  - 7.2: Connect Service and Utils to Route - **Status:** done - **Dependencies:** [7.1]

## Task 8: Integration Testing & Verification
- **Status:** done
- **Priority:** medium
- **Dependencies:** [7]
- **Description:** Final verification of the entire Phase 1 flow (US-1, US-2, US-3).
- **Details:**
  - Create `tests/integration/api.test.js`.
  - Verify Config changes reflect in API output.
  - Verify Timezones are handled correctly.
- **Test Strategy:**
  - Run full test suite: `npm test`.
- **Subtasks:**
  - 8.1: Write integration tests - **Status:** done - **Dependencies:** []
  - 8.2: Perform manual verification (optional) - **Status:** done - **Dependencies:** [8.1]