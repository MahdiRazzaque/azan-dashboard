# Product Requirements Document: Phase 4.98 - API Refactor & Modularisation

## 1. Title
Phase 4.98 - Backend API Refactor (Controller Pattern)

## 2. Introduction
This document outlines the requirements for a comprehensive architectural refactor of the backend API. Currently, `src/routes/api.js` acts as a monolithic file containing routing definitions, business logic, validation, and file handling. This phase aims to decouple these concerns by implementing a **Controller-Service-Route** pattern, improving code readability, testability, and maintainability.

## 3. Product Overview
The single `api.js` file will be decomposed into a modular directory structure. Business logic will move to **Controllers**. Reusable logic (File Uploads, Validation) will move to **Utilities/Services**. A central **Router** will wire these components together, maintaining the existing `/api/*` URL structure to ensure frontend compatibility.

## 4. Goals and Objectives
*   **Separation of Concerns:** Distinct layers for Routing (URL definition) and Controllers (Request handling).
*   **Maintainability:** Smaller, focused files (e.g., `authController.js`) are easier to debug than one 700-line file.
*   **Code Reuse:** Extract inline logic (Multer config, Validation rules) into reusable modules.
*   **Error Handling:** Standardise error responses using a global Async Handler middleware.
*   **Observability:** strict HTTP status codes (503) for health checks to aid external monitoring.

## 5. Technical Architecture

### 5.1 Directory Structure
The `src/` directory will be reorganised as follows:
```text
src/
├── controllers/          # [NEW] Business logic
│   ├── authController.js
│   ├── systemController.js
│   ├── settingsController.js
│   └── prayerController.js
├── routes/               # [MODIFIED] Route definitions
│   ├── index.js          # Main entry point
│   ├── auth.js
│   ├── system.js         # Merges diagnostics + existing system.js + logs
│   ├── settings.js
│   └── prayers.js
├── middleware/
│   ├── asyncHandler.js   # [NEW] Error wrapper
│   └── ... (existing)
├── services/
│   ├── validationService.js # [NEW] Logic validation
│   └── ... (existing)
└── utils/
    ├── fileUpload.js     # [NEW] Multer config
    └── ... (existing)
```

## 6. Features and Requirements

### 6.1 Middleware & Utilities
*   **FR-01: Async Handler**
    *   Create `src/middleware/asyncHandler.js`.
    *   It MUST wrap async route handlers to automatically catch errors and pass them to Express `next()`.
*   **FR-02: File Upload Utility**
    *   Extract the Multer configuration (DiskStorage, FileFilter, Limits) from `api.js` to `src/utils/fileUpload.js`.
    *   Export the configured `upload` instance.
*   **FR-03: Validation Service**
    *   Create `src/services/validationService.js`.
    *   Move the complex "Source Validation" logic (checking Aladhan/MyMasjid connectivity) from the Settings Update route into this service.
    *   Method: `validateConfigSource(config)`.

### 6.2 Service Enhancements
*   **FR-04: Prayer Service Logic**
    *   Update `src/services/prayerTimeService.js`.
    *   Add a method `getPrayersWithNext(config, timezone)`.
    *   This method MUST encapsulate the logic for:
        1.  Fetching today's prayers.
        2.  Calculating `nextPrayer`.
        3.  Fetching "Tomorrow's" data if `nextPrayer` is missing (after Isha).
    *   This removes business logic from the Route/Controller layer.

### 6.3 Controllers (Logic Layer)
*   **FR-05: Auth Controller** (`authController.js`)
    *   Methods: `login`, `logout`, `setup`, `changePassword`, `checkStatus`.
*   **FR-06: System Controller** (`systemController.js`)
    *   Methods:
        *   `getHealth`: Return strict 503 status if critical services are unhealthy.
        *   `refreshHealth`: Trigger health check refresh.
        *   `getJobs`: Return scheduler jobs.
        *   `getLogs`: Handle SSE connection.
        *   `getAudioFiles`: List custom/cache files.
        *   `getConstants`: Return API constants (moved from old `system.js`).
        *   `testAudio`, `regenerateTTS`, `restartScheduler`, `validateUrl`.
        *   `testSource`, `testVoiceMonkey`.
*   **FR-07: Settings Controller** (`settingsController.js`)
    *   Methods:
        *   `getSettings`: Return config.
        *   `updateSettings`: Call `validationService`, then `configService.update`.
        *   `resetSettings`: Reset to defaults.
        *   `refreshCache`: Force refresh data.
        *   `uploadFile`: Handle file upload response.
        *   `deleteFile`: Delete custom audio file.
        *   `saveVoiceMonkey`, `deleteVoiceMonkey`.
*   **FR-08: Prayer Controller** (`prayerController.js`)
    *   Methods: `getPrayers` (Simple call to `prayerTimeService.getPrayersWithNext`).

### 6.4 Routes (Definition Layer)
*   **FR-09: Route Modules**
    *   Create `src/routes/auth.js`, `system.js`, `settings.js`, `prayers.js`.
    *   Apply existing `rateLimiters` and `authenticateToken` middleware to the appropriate routes.
    *   Map routes to Controller methods using `asyncHandler`.
*   **FR-10: Main Router**
    *   Create `src/routes/index.js`.
    *   Mount the sub-routers:
        *   `/auth` -> `authRoutes`
        *   `/system` -> `systemRoutes`
        *   `/settings` -> `settingsRoutes`
        *   `/prayers` -> `prayerRoutes`
        *   (Note: `systemRoutes` must consolidate endpoints previously in `system.js` and `api.js`).

## 7. Migration & Testing
*   **FR-11: Server Entry Point**
    *   Update `src/server.js` to import `src/routes/index.js` instead of `src/routes/api.js`.
*   **FR-12: Test Suite Adjustment**
    *   Update `tests/integration/routes/api.test.js`.
    *   Since the routes are physically moving, the test file imports/setup might need adjustment to point to the new `app` structure.
    *   Verify all tests pass with the new architecture.

## 8. Implementation Order
1.  **Utilities:** Create `asyncHandler`, `fileUpload`, `validationService`.
2.  **Service Refactor:** Update `prayerTimeService`.
3.  **Controllers:** Create the 4 controller files, copy-pasting logic from `api.js`.
4.  **Routes:** Create the 4 route files + `index.js`.
5.  **Integration:** Update `server.js`.
6.  **Cleanup:** Delete `src/routes/api.js` and old `src/routes/system.js`.
7.  **Testing:** Run suite and fix imports.