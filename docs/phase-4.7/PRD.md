# Product Requirements Document: Phase 4.7 - Comprehensive Test Suite Rewrite

## 1. Introduction
This document outlines the requirements for **Phase 4.7** of the Azan Dashboard project. This phase focuses purely on Quality Assurance (QA). The objective is to delete the existing, fragmented test suite and replace it with a robust, structured testing architecture that achieves a minimum of **90% code coverage** for the backend codebase.

## 2. Product Overview
The new test suite will ensure the stability of the core logic (Prayer Calculations, Scheduler, Configuration) and the reliability of the API endpoints. It will utilise **Jest** as the test runner, **Supertest** for API integration testing, and a temporary file strategy to test persistence without polluting the production environment.

## 3. Goals and Objectives
*   **Coverage:** Achieve >90% Statement, Branch, Function, and Line coverage on the Backend.
*   **Structure:** Mirror the `src/` directory structure within `tests/` for maintainability.
*   **Isolation:** Ensure unit tests mock all external dependencies (Network, FS, System Time).
*   **Integration:** Ensure API tests run against a real Express instance using temporary configuration files.
*   **Performance:** Run tests in band or parallel efficiently, with automatic cleanup of temporary artifacts on success.

## 4. Target Audience
*   **Developers:** To prevent regressions during future refactoring (e.g., Phase 4.5 Config changes).
*   **AI Coders:** To verify generated code works as expected without manual intervention.

## 5. Features and Requirements

### 5.1 Test Architecture & Configuration
*   **FR-01: Directory Structure**
    *   The `tests/` directory MUST mirror the source:
        *   `tests/unit/config/`
        *   `tests/unit/services/`
        *   `tests/unit/utils/`
        *   `tests/integration/routes/`
    *   A `tests/helpers/` directory MUST be created for shared utilities.
*   **FR-02: Jest Configuration**
    *   Update `package.json` with a `test:coverage` script: `jest --coverage --runInBand`.
    *   Configure Jest to ignore `client/` and `public/` directories.
    *   Configure a global setup file `tests/setup.js` to suppress console logs during test execution (unless an error occurs).

### 5.2 Test Helpers
*   **FR-03: FileSystem Helper**
    *   Create `tests/helpers/fsHelper.js`.
    *   Method `createTempConfig()`: Creates a unique temporary directory, writes a valid `default.json`, and updates the `ConfigService` singleton's internal paths (`_configPath`, `_localPath`) to point here.
    *   Method `cleanupTempConfig()`: Deletes the directory if the test passed.
*   **FR-04: Auth Helper**
    *   Create `tests/helpers/authHelper.js`.
    *   Method `getAuthToken()`: Generates a valid JWT signed with the test environment's secret, returning the cookie string for Supertest.
*   **FR-05: Service Resets**
    *   Modify `src/config/ConfigService.js` to include a `reset()` method (used only by tests) to clear internal state variables (`_config`, `_isInitialized`, `_isSaving`).

### 5.3 Unit Test Coverage (>90%)
*   **FR-06: Configuration Logic**
    *   Test loading defaults, merging `local.json`, environment variable overrides, and secret stripping.
    *   Test concurrency locking (preventing double writes).
*   **FR-07: Prayer Time Service**
    *   Test Cache Hit vs Cache Miss.
    *   Test Annual/Bulk fetching logic.
    *   Test Iqamah overrides and fallback calculations.
*   **FR-08: Scheduler Service**
    *   Test Job creation (Midnight, Stale Check, Trigger Events).
    *   Test "Hot Reload" (cancelling old jobs, creating new ones).
    *   **Mocking:** Verify `node-schedule` interactions without actually waiting for time to pass.
*   **FR-09: Audio Asset Service**
    *   Test Template resolution (English to Arabic names, Number to Words).
    *   Test interaction with the Python Microservice (Axios mocks).
    *   Test Cache Cleanup logic (deleting old files).
*   **FR-10: Utils**
    *   `auth.js`: Verify hashing and salt validation.
    *   `calculations.js`: Verify iqamah rounding logic and "Next Prayer" midnight transition.

### 5.4 Integration Test Coverage (>90%)
*   **FR-11: Authentication Flow**
    *   Test Login (Success/Failure), Logout, and Protected Route blocking.
*   **FR-12: Settings API**
    *   Test `POST /api/settings/update`: Verify validation logic (Aladhan/MyMasjid connectivity checks mocked) and file writing.
    *   Test `POST /api/settings/reset`: Verify revert to defaults.
    *   Test `POST /api/settings/upload`: Verify file handling via Multer (using dummy buffers).
*   **FR-13: System Diagnostics**
    *   Test `GET /api/system/status/*`: Verify status calculation logic.
    *   Test `POST /api/system/test-audio`: Verify local player execution (mocked `play-sound`).

## 6. Implementation Order

1.  **Preparation:** Delete existing `tests/` folder. Create new folder structure.
2.  **Infrastructure:** Update `ConfigService` (add reset), create `tests/setup.js` and `tests/helpers`.
3.  **Unit Tests (Base):** Write tests for `utils/` and `config/`.
4.  **Unit Tests (Core):** Write tests for `prayerTimeService` and `audioAssetService`.
5.  **Unit Tests (Complex):** Write tests for `schedulerService` and `automationService`.
6.  **Integration Tests:** Write tests for API Routes (`api.js`, `server.js`).
7.  **Verification:** Run coverage report and refine until >90%.

## 7. Technical Requirements / Stack

*   **Framework:** Jest (Runner, Assertions, Mocks).
*   **HTTP Testing:** Supertest.
*   **Mocking:**
    *   `fs`: Real temporary files for Config integration; Mocks for specific unit tests.
    *   `axios`: `jest.mock('axios')`.
    *   `node-schedule`: Spy on `scheduleJob`.
    *   `play-sound`: Manual mock factory.

## 8. Open Questions / Assumptions
*   **Assumption:** The AI coder has permission to modify `package.json` to add the test scripts.
*   **Assumption:** We do not need to test the Python Microservice (`server.py`) as it is outside the Node.js runtime scope.