# Product Requirements Document: Phase 4.5 - Configuration Architecture Refactor

## 1. Introduction
This document outlines the requirements for **Phase 4.5** of the Azan Dashboard project. This is a technical refactoring phase aimed at replacing the fragile `require` cache invalidation pattern with a robust **Singleton Configuration Service**. This change is critical for ensuring system stability, atomic updates, and reliable hot-reloading of settings without memory leaks or race conditions.

## 2. Product Overview
The current configuration system relies on loading JSON files synchronously via `require` and manually deleting the module cache to "refresh" settings. Phase 4.5 introduces a stateful `ConfigService` class. This service acts as the single source of truth for the application's configuration, managing the loading of default settings, user overrides (`local.json`), and sensitive environment variables (`.env`) in a layered, deterministic manner.

## 3. Goals and Objectives
*   **Stability:** Eliminate the use of `delete require.cache`, removing the risk of memory leaks and inconsistent state.
*   **Atomicity:** Ensure that configuration updates are "all-or-nothing". Invalid configurations should never be applied or written to disk.
*   **Security:** Enforce strict separation of concerns. Secrets (Tokens, Passwords) must remain in memory/env and never be written to `local.json`.
*   **Concurrency:** Prevent race conditions where multiple API requests try to write to the configuration file simultaneously.
*   **Testability:** Allow the configuration to be mocked easily in test suites without relying on file system hacks.

## 4. Target Audience
*   **Developers:** Improved code quality, type safety, and debugging experience.
*   **End Users:** More reliable "Save" operations in the settings panel, with fewer server crashes during updates.

## 5. Features and Requirements

### 5.1 The ConfigService Singleton
*   **FR-01: Service Interface**
    *   The `src/config/index.js` module MUST export a singleton instance of `ConfigService` (not a static object).
    *   It MUST expose the following public methods:
        *   `init()`: Async method to load initial configuration.
        *   `get()`: Synchronous method returning the current, validated configuration object.
        *   `update(partialConfig)`: Async method to validate, merge, and save user settings.
        *   `reload()`: Async method to re-read files and environment variables from disk.
*   **FR-02: Layered Loading Strategy**
    *   The configuration MUST be constructed in the following order (lowest to highest priority):
        1.  `config/default.json` (Read-Only Base).
        2.  `config/local.json` (User Overrides - Read/Write).
        3.  `process.env` (Secrets & Infrastructure - Read-Only).
*   **FR-03: Initialization Guard**
    *   Accessing `get()` before `init()` has completed MUST throw a specific error (`ConfigNotInitializedError`).

### 5.2 Atomic Updates & Validation
*   **FR-04: Deep Merging**
    *   The service MUST implement deep merging logic to ensure partial updates (e.g., changing one trigger) do not wipe out other nested settings.
*   **FR-05: Logic Validation Integration**
    *   Before saving, the service MUST execute:
        1.  **Schema Validation:** Zod schema checks (Structure & Types).
        2.  **Logic Validation:** External connectivity checks (Aladhan/MyMasjid) if critical source settings have changed.
    *   If validation fails, the service MUST rollback the in-memory state and throw an error. `local.json` MUST NOT be modified.
*   **FR-06: Concurrency Locking (Mutex)**
    *   The `update()` method MUST implement a lock (`isSaving` flag).
    *   If a save is already in progress, subsequent calls MUST be rejected immediately (HTTP 409) or queued.

### 5.3 Secrets Management
*   **FR-07: Environment Refresh**
    *   The `reload()` method MUST explicitly reload environment variables (e.g., using `dotenv.config({ override: true })`).
    *   This allows the system to pick up changes to `.env` without a full process restart.
*   **FR-08: Write Protection**
    *   The `update()` method MUST strip out any keys that belong to the `process.env` layer (e.g., `ADMIN_PASSWORD`, `VOICEMONKEY_*`) before writing to `local.json`.

## 6. Migration Plan

1.  **Service Implementation:** Create the class logic.
2.  **Server Lifecycle Update:** Update `server.js` to initialize the config before starting Express.
3.  **Consumer Refactoring:** Update all files using `require('../config')` to use `require('../config').get()`.
4.  **API Migration:** Move the logic from `POST /api/settings/update` into `ConfigService.update()`.

## 7. Technical Requirements / Stack

*   **Node.js:** ES6 Classes.
*   **Libraries:**
    *   `dotenv`: For environment management.
    *   `zod`: For schema validation (reuse existing).
    *   `fs/promises`: For asynchronous file I/O.
    *   `lodash.merge` (or generic equivalent): For deep merging.

## 8. Data & Configuration Structure

### 8.1 File Responsibility
*   `src/config/default.json`: Static defaults committed to git.
*   `src/config/local.json`: Runtime overrides (gitignored).
*   `.env`: Secrets (gitignored).

## 9. Open Questions / Assumptions
*   **Assumption:** The existing Zod schema in `src/config/index.js` is robust enough to be reused within the class.
*   **Assumption:** We do not need to support "hot reloading" of the `default.json` file (it changes only on deployment).

## 10. Testing Strategy
*   **Unit Tests:**
    *   Mock `fs` and `dotenv`.
    *   Verify `init()` loads correctly.
    *   Verify `update()` writes only the delta to `local.json`.
    *   Verify `get()` returns the merged result.
    *   Verify Mutex prevents concurrent writes.
*   **Integration Tests:**
    *   Update `api_v2.test.js` to use the new service pattern.
    *   Verify that `POST /api/settings/update` still works end-to-end.