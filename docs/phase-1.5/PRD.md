# Product Requirements Document: Phase 1.5 - Advanced Data Strategy

## 1. Introduction
This document outlines the requirements for **Phase 1.5** of the Azan Dashboard project. This phase involves a major refactoring of the Data Layer, moving from a "Just-in-Time" (Daily) fetching model to an **Annual/Bulk Fetching** strategy. This change aims to significantly improve system resilience, reduce dependency on external APIs, and support source-specific data nuances (specifically pre-defined Iqamah times from MyMasjid).

## 2. Product Overview
The enhanced system will attempt to fetch and cache the entire year's prayer schedule (or as much as is available) upon the first successful connection. It introduces a hybrid logic for determining Congregation (Iqamah) times: utilizing precise data provided by mosque-specific APIs (MyMasjid) where available, while retaining calculation capabilities for generic location-based APIs (Aladhan).

## 3. Goals and Objectives
*   **Offline Resilience:** The system MUST function for extended periods (months) without internet access after the initial sync.
*   **Performance:** Eliminate daily network latency by serving requests directly from the local cache.
*   **Accuracy:** Support explicit Iqamah times provided by data sources (MyMasjid), overriding local calculation rules when authoritative data exists.
*   **Self-Maintenance:** Automatically detect and refresh stale data to ensure the schedule remains up-to-date with mosque changes.
*   **Maintainability:** Eliminate "magic numbers" in the fetching logic by centralizing API constants.

## 4. Target Audience
*   **Mosque Administrators:** Who need the dashboard to reflect the *exact* Iqamah times published by their mosque (via MyMasjid) without manual configuration.
*   **Home Users:** Who want a "set and forget" system that doesn't break if their internet connection is spotty.

## 5. Features and Requirements

### 5.1 Bulk Data Retrieval
*   **FR-01: Aladhan Annual Fetch**
    *   The Aladhan fetcher MUST be updated to use the `/calendar/{year}` endpoint.
    *   It MUST parse the response and normalize it into a Map structure keyed by ISO Date (`YYYY-MM-DD`).
*   **FR-02: MyMasjid Bulk Fetch**
    *   The MyMasjid fetcher MUST retrieve the full schedule available from the API.
    *   It MUST accept partial datasets (e.g., if the API only returns 30 days, cache those 30 days).

### 5.2 Caching Strategy
*   **FR-03: Cache Structure**
    *   The `data/cache.json` schema MUST be refactored to store a map of dates.
    *   **Schema:**
        ```json
        {
          "meta": {
            "lastFetched": "ISO_TIMESTAMP",
            "source": "provider_name"
          },
          "data": {
            "2023-10-01": { "fajr": "...", "dhuhr": "...", "iqamah": { "fajr": "..." } },
            "2023-10-02": { ... }
          }
        }
        ```
*   **FR-04: Cache Logic**
    *   On a "Cache Miss" (requested date not in `data`), the system MUST trigger a Bulk Fetch for the current year.
    *   The system MUST overwrite existing keys in the cache with new data upon a successful fetch.

### 5.3 Hybrid Iqamah Logic
*   **FR-05: Source-Based Priority**
    *   **Scenario A (MyMasjid):** If the data source provides an Iqamah time, the API MUST serve this value in the response. The local `calculationUtils` MUST NOT apply offsets/rounding to these values.
    *   **Scenario B (Aladhan):** If the data source returns `null` for Iqamah (or does not provide it), the system MUST fall back to the existing Phase 1 logic (Start Time + Offset + Rounding).

### 5.4 Automation & Maintenance
*   **FR-06: Stale Data Check**
    *   The Scheduler MUST run a job (Default: Every 7 days) to check the cache age.
    *   Logic: `IF (Now - meta.lastFetched) > config.data.staleCheckDays THEN Trigger Refresh`.
*   **FR-07: Year Boundary Handling**
    *   The system MUST perform a "Lookahead Check". If the current date is within 7 days of the end of the year (e.g., Dec 25th), it MUST proactively fetch and cache the **Next Year's** calendar to ensure continuity on Jan 1st.
*   **FR-08: Force Refresh**
    *   **API:** `POST /api/settings/refresh-cache` MUST clear the cache and trigger an immediate fetch.
    *   **UI:** The Settings page MUST include a "Force Refresh Data" button.

### 5.5 Code Maintenance & Constants
*   **FR-09: Centralized Constants**
    *   The system MUST include a dedicated constants file (e.g., `src/utils/constants.js`) to store API mappings.
    *   It MUST map human-readable configuration strings (e.g., "ISNA", "Hanafi") to specific API IDs (e.g., `2`, `1`).
    *   Hardcoded "Magic Numbers" in `src/services/fetchers.js` MUST be replaced with imports from this file.

## 6. User Stories and Acceptance Criteria

### US-1: Offline Reliability
**As a** user in a remote area with unstable internet,
**I want** the system to download the whole year's schedule at once,
**So that** my prayer times work even if the internet is down for weeks.

*   **AC-1:** Disconnecting the internet after the initial setup does not stop the dashboard from showing tomorrow's times.
*   **AC-2:** The `cache.json` file contains entries for future months.

### US-2: Accurate Mosque Timing
**As a** mosque admin using MyMasjid,
**I want** the dashboard to show the exact 1:30 PM Dhuhr Iqamah set by the Imam,
**So that** it matches the printed timetable, regardless of generic rounding rules.

*   **AC-1:** Configuration is set to MyMasjid.
*   **AC-2:** The dashboard displays the exact Iqamah string returned by the MyMasjid API.
*   **AC-3:** Changing the "Offset" in the local config has **no effect** on the displayed time (since API data takes precedence).

### US-3: Automated Updates
**As a** user,
**I want** the system to check for schedule updates weekly,
**So that** if the mosque changes a time mid-year, my display updates automatically.

*   **AC-1:** The logs show a "Stale Check" event running every 7 days.
*   **AC-2:** If the cache is older than 7 days, a network request is made to refresh it.

## 7. Technical Requirements / Stack

*   **Backend:** Node.js, existing Express.js setup.
*   **Libraries:** `luxon` (Date manipulation), `node-schedule` (Cron jobs).
*   **New Files:**
    *   `src/utils/constants.js`: To store `CALCULATION_METHODS`, `MADHABS`, and `MIDNIGHT_MODES`.
*   **Refactor Targets:**
    *   `src/services/fetchers.js`: Implement `fetchAnnualAladhan` and `fetchBulkMyMasjid` using the new constants.
    *   `src/services/prayerTimeService.js`: Rewrite `getPrayerTimes` to handle Map caching and Bulk fetching.
    *   `src/routes/api.js`: Update logic to respect source-provided Iqamahs.

## 8. Data & Configuration Structure

### 8.1 New Config Entries (`config/default.json`)
```json
{
  "data": {
    "staleCheckDays": 7
  }
}
```

### 8.2 Cache Schema Update (`data/cache.json`)
See **FR-03** in Section 5.2.

## 9. Design and User Interface
*   **Settings Page:**
    *   Add a section "Data Management".
    *   Display: "Last Updated: [Date]".
    *   Action: Button "Refresh Data Now".

## 10. Open Questions / Assumptions
*   **Assumption:** MyMasjid API rate limits allow for fetching full schedules periodically.
*   **Assumption:** The server has write permissions to `data/` to store the potentially larger JSON file (~100KB).