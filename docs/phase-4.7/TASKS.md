# Project Tasks

## Task 1: Preparation & Directory Structure
- **Status:** done
- **Priority:** high
- **Dependencies:** []
- **Description:** Clean up the existing test environment and establish the mirrored directory structure required for the new suite.
- **Details:**
  - Delete the existing `tests/` directory to start fresh.
  - Create the new directory structure:
    - `tests/unit/config/`
    - `tests/unit/services/`
    - `tests/unit/utils/`
    - `tests/integration/routes/`
    - `tests/helpers/`
- **Test Strategy:**
  - Verify the folder structure exists using `ls -R tests/`.
- **Subtasks:**
  - 1.1: Remove legacy tests - **Status:** done - **Dependencies:** []
  - 1.2: Create new folder hierarchy - **Status:** done - **Dependencies:** [1.1]

## Task 2: Infrastructure & Configuration
- **Status:** done
- **Priority:** high
- **Dependencies:** [1]
- **Description:** Configure Jest, global setup scripts, and modify the ConfigService to support test isolation.
- **Details:**
  - Update `package.json` to include `"test:coverage": "jest --coverage --runInBand"`.
  - Update `jest.config.js` to ignore `client/` and `public/`.
  - Create `tests/setup.js` to suppress console logs globally (unless test fails).
  - Modify `src/config/ConfigService.js`: Add a `reset()` method to clear `_config`, `_isInitialized`, and `_isSaving` state.
- **Test Strategy:**
  - Run `npm run test:coverage` (should pass with 0 tests).
  - Verify `ConfigService` has a `reset` method via inspection.
- **Subtasks:**
  - 2.1: Update package.json & jest.config.js - **Status:** done - **Dependencies:** []
  - 2.2: Create Global Setup - **Status:** done - **Dependencies:** [2.1]
  - 2.3: Implement ConfigService.reset() - **Status:** done - **Dependencies:** []

## Task 3: Test Helpers Implementation
- **Status:** done
- **Priority:** high
- **Dependencies:** [2]
- **Description:** Implement shared utilities for FileSystem mocking and Authentication.
- **Details:**
  - Create `tests/helpers/fsHelper.js`:
    - Implement `createTempConfig()`: Create temp dir, write default.json, inject paths into ConfigService singleton.
    - Implement `cleanupTempConfig()`: Remove temp dir.
  - Create `tests/helpers/authHelper.js`:
    - Implement `getAuthToken()`: specific JWT generation signed with test secret.
- **Test Strategy:**
  - Create a dummy test that uses `fsHelper` to write a config, reads it, and cleans up.
- **Subtasks:**
  - 3.1: Implement fsHelper.js - **Status:** done - **Dependencies:** []
  - 3.2: Implement authHelper.js - **Status:** done - **Dependencies:** []

## Task 4: Unit Tests - Base (Utils & Config)
- **Status:** done
- **Priority:** medium
- **Dependencies:** [3]
- **Description:** Implement unit tests for the Configuration logic and Utility functions.
- **Details:**
  - `tests/unit/config/ConfigService.test.js`: Test init, get, update (merging), atomic writes, and concurrency locking.
  - `tests/unit/utils/auth.test.js`: Verify hashing and password verification.
  - `tests/unit/utils/calculations.test.js`: Verify `calculateIqamah` (offsets/rounding) and `calculateNextPrayer`.
- **Test Strategy:**
  - Run `npm run test:coverage`. Verify coverage for `src/config` and `src/utils` is >90%.
- **Subtasks:**
  - 4.1: ConfigService Tests - **Status:** done - **Dependencies:** []
  - 4.2: Auth Utils Tests - **Status:** done - **Dependencies:** []
  - 4.3: Calculation Utils Tests - **Status:** done - **Dependencies:** []

## Task 5: Unit Tests - Core Services
- **Status:** done
- **Priority:** medium
- **Dependencies:** [4]
- **Description:** Implement unit tests for Prayer Time fetching and Audio Asset management.
- **Details:**
  - `tests/unit/services/prayerTimeService.test.js`: Test Cache Hit, Cache Miss, Bulk Fetching, and Override logic.
  - `tests/unit/services/audioAssetService.test.js`: Test template resolution, Python microservice interaction (Axios mock), and cache cleanup.
  - Mock all external dependencies (Fetchers, Axios, FS).
- **Test Strategy:**
  - Run `npm run test:coverage`. Verify coverage for target services is >90%.
- **Subtasks:**
  - 5.1: PrayerTimeService Tests - **Status:** done - **Dependencies:** []
  - 5.2: AudioAssetService Tests - **Status:** done - **Dependencies:** []

## Task 6: Unit Tests - Complex Services (Scheduler & Automation)
- **Status:** pending
- **Priority:** medium
- **Dependencies:** [5]
- **Description:** Implement unit tests for the Job Scheduler and Automation triggers.
- **Details:**
  - `tests/unit/services/schedulerService.test.js`: Spy on `node-schedule`. Verify job creation for Midnight, Stale Check, and Prayers. Test Hot Reload.
  - `tests/unit/services/automationService.test.js`: Verify `triggerEvent` routing (Local vs Browser vs VoiceMonkey).
- **Test Strategy:**
  - Run `npm run test:coverage`. Verify coverage for Scheduler and Automation services is >90%.
- **Subtasks:**
  - 6.1: SchedulerService Tests - **Status:** pending - **Dependencies:** []
  - 6.2: AutomationService Tests - **Status:** pending - **Dependencies:** []

## Task 7: Integration Tests - Auth & System
- **Status:** pending
- **Priority:** medium
- **Dependencies:** [4]
- **Description:** Implement integration tests for Authentication and System Diagnostics endpoints.
- **Details:**
  - `tests/integration/routes/auth.test.js`: Test `/api/auth/login`, `/setup`, `/logout`. Verify Cookie setting.
  - `tests/integration/routes/system.test.js`: Test `/api/system/jobs`, `/api/system/status/*`.
  - Use `supertest` and `fsHelper` to run against a real express instance with temp config.
- **Test Strategy:**
  - Run `npm run test:coverage`. Verify route coverage.
- **Subtasks:**
  - 7.1: Auth Route Tests - **Status:** pending - **Dependencies:** []
  - 7.2: System/Diagnostics Route Tests - **Status:** pending - **Dependencies:** []

## Task 8: Integration Tests - Settings API
- **Status:** pending
- **Priority:** medium
- **Dependencies:** [7]
- **Description:** Implement integration tests for the Settings Management API.
- **Details:**
  - `tests/integration/routes/settings.test.js`:
    - Test `POST /api/settings/update` (Validation & Persistence).
    - Test `POST /api/settings/reset`.
    - Test `POST /api/settings/upload` (Multer file handling).
- **Test Strategy:**
  - Run `npm run test:coverage`. Verify Settings route coverage.
- **Subtasks:**
  - 8.1: Settings Update/Reset Tests - **Status:** pending - **Dependencies:** []
  - 8.2: File Upload Tests - **Status:** pending - **Dependencies:** []

## Task 9: Verification & Coverage Refinement
- **Status:** pending
- **Priority:** high
- **Dependencies:** [6, 8]
- **Description:** Final run of the test suite and refinement to reach the 90% target.
- **Details:**
  - Execute full test suite.
  - Analyze coverage report (`coverage/lcov-report/index.html`).
  - Identify missing branches or lines.
  - Add supplementary tests if necessary to hit >90%.
- **Test Strategy:**
  - `npm run test:coverage` output must show >90% in all categories.
- **Subtasks:**
  - 9.1: Full Execution - **Status:** pending - **Dependencies:** []
  - 9.2: Gap Analysis & Patching - **Status:** pending - **Dependencies:** [9.1]