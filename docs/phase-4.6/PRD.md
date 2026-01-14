# Product Requirements Document: Phase 4.6 - Developer Diagnostics & Status

## 1. Introduction
This document outlines the requirements for an enhancement to the **Developer Settings** module. The goal is to provide administrators with granular visibility into the system's automation state. This includes a detailed breakdown of which automation triggers have executed (or are pending) for the day, and the generation status of Text-to-Speech (TTS) assets.

## 2. Product Overview
The enhancement introduces two new diagnostic tables to the Developer Tools view: **Automation Status** and **TTS Status**. Additionally, it refines the existing "Active Jobs" display to focus exclusively on system maintenance tasks, decluttering the view by separating user-configured automation triggers from system-level operations.

## 3. Goals and Objectives
*   **Observability:** Provide a clear "at-a-glance" view of whether specific prayer announcements have played or will play.
*   **Debugging:** Allow admins to quickly identify if a missing announcement was due to being disabled, the time passing, or a missing audio file.
*   **clarity:** Segregate system maintenance jobs (Midnight refresh, Stale check) from user-configured automation jobs in the UI.

## 4. Target Audience
*   **System Administrators:** Users debugging "Why didn't the Fajr Adhan play?" or verifying if their custom TTS templates have been generated.

## 5. Features and Requirements

### 5.1 Backend: Job Categorisation
*   **FR-01: Job Categorisation**
    *   The `schedulerService.getJobs()` method MUST categorise active jobs into two groups:
        1.  **Maintenance:** System jobs (e.g., "Midnight Refresh", "Stale Check").
        2.  **Automation:** Trigger jobs (e.g., "fajr - adhan").
    *   The API endpoint `GET /api/system/jobs` MUST be updated to return this structured data: `{ maintenance: [...], automation: [...] }`.

### 5.2 Backend: Diagnostics Service
*   **FR-02: Diagnostics Service**
    *   A new service `src/services/diagnosticsService.js` MUST be created.
    *   It MUST utilise `prayerTimeService` to retrieve *today's* schedule based on the configured timezone.
    *   It MUST utilise `configService` to read trigger settings.
*   **FR-03: Automation Status Endpoint**
    *   **Endpoint:** `GET /api/system/status/automation`
    *   **Logic:** For every prayer and every event type:
        1.  Check if `enabled` in config.
        2.  Calculate the exact trigger time (Start Time - Offset).
        3.  Compare trigger time with "Now" (Server Time).
        4.  Return state: `DISABLED`, `PASSED` (with time), or `UPCOMING` (with time).
*   **FR-04: TTS Status Endpoint**
    *   **Endpoint:** `GET /api/system/status/tts`
    *   **Logic:** For every prayer and every event type:
        1.  Check configuration `type`.
        2.  If `type != 'tts'`, return state `CUSTOM_FILE` or `URL`.
        3.  If `type == 'tts'`, calculate expected filename (`tts_{prayer}_{event}.mp3`).
        4.  Check `public/audio/cache` for file existence and modification time (`mtime`).
        5.  Return state: `DISABLED`, `MISSING`, or `GENERATED` (with timestamp).

### 5.3 Frontend: Developer View Enhancements
*   **FR-05: Active Jobs Filter**
    *   The "Active Jobs" card in `DeveloperSettingsView` MUST be updated to display **only** jobs from the `maintenance` category returned by FR-01.
*   **FR-06: Automation Status Card**
    *   A new full-width card MUST be added below "Active Jobs".
    *   It MUST render a table with Prayers as Rows and Events (Pre-Adhan, Adhan, Pre-Iqamah, Iqamah) as Columns.
    *   Cells MUST be colour-coded:
        *   **Grey:** Disabled.
        *   **Green:** Passed (Executed).
        *   **Blue:** Upcoming (Pending).
*   **FR-07: TTS Status Card**
    *   A new full-width card MUST be added below "Automation Status".
    *   It MUST render a similar table grid.
    *   Cells MUST indicate:
        *   **Grey:** Disabled.
        *   **Blue:** Custom File / URL.
        *   **Green:** Generated (Show time e.g., "10:00 AM").
        *   **Red:** Error/Missing (Enabled but file not found).

## 6. User Stories

### US-1: Verification of Schedule
**As an** admin,
**I want** to see exactly when the Maghrib Pre-Adhan is scheduled to fire today,
**So that** I can confirm my offset settings are correct without waiting for the event.

### US-2: Debugging Silent Audio
**As an** admin,
**I want** to see if the TTS file for "Iqamah" has actually been generated,
**So that** I know if the silence was caused by a missing file or a muted speaker.

## 7. Technical Requirements / Stack

*   **Backend:** Node.js (Express, FS).
*   **Frontend:** React, Tailwind CSS.
*   **Libraries:** `luxon` (Time comparison).

## 8. Data Structures

### 8.1 API Response: Automation Status
```json
{
  "fajr": {
    "preAdhan": { "status": "PASSED", "time": "2023-10-01T04:45:00+01:00" },
    "adhan": { "status": "UPCOMING", "time": "2023-10-01T05:00:00+01:00" }
  },
  "dhuhr": { ... }
}
```

### 8.2 API Response: TTS Status
```json
{
  "fajr": {
    "preAdhan": { "status": "GENERATED", "generatedAt": "2023-10-01T00:01:00Z" },
    "adhan": { "status": "CUSTOM_FILE", "detail": "custom/azan.mp3" }
  }
}
```

## 9. Implementation Order

1.  **Backend Refactor:** Update `schedulerService` job categorization and `GET /api/system/jobs`.
2.  **Backend Logic:** Create `diagnosticsService` and implement status calculation logic.
3.  **Backend API:** Expose the two new endpoints.
4.  **Frontend:** Update `DeveloperSettingsView` with new tables consuming these endpoints.

## 10. Open Questions / Assumptions
*   **Assumption:** The `prayerTimeService` cache is populated. If not, accessing these endpoints might trigger a fetch, causing a slight delay on the Developer page load.