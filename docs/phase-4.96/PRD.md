# Product Requirements Document: Phase 4.96 - Prayer Source Diagnostics

## 1. Title
Phase 4.96 - Prayer Source Diagnostics & Connectivity Testing

## 2. Introduction
This document outlines the requirements for **Phase 4.96**, an enhancement to the Developer Tools suite. This phase introduces a dedicated diagnostics card for **Prayer Data Sources** (Aladhan / MyMasjid). It provides administrators with visibility into which source is currently powering the dashboard (Primary vs Backup) and offers tools to test the connectivity of these APIs independently without disrupting the live cache.

## 3. Product Overview
A new "Prayer Source Status" card will be added to the Developer Settings view. It will display the configuration and status of both the Primary and Backup sources. Users can perform a "Dry Run" test on each source to verify API availability. The card will also clearly indicate which source is currently active in the system cache, helping users understand if a failover event has occurred.

## 4. Goals and Objectives
*   **Observability:** Clearly show which data source is currently being used by the system (e.g., "System is currently running on Backup").
*   **Diagnostics:** Allow independent connectivity testing of Primary and Backup sources to troubleshoot API outages without overwriting valid cached data.
*   **Clarity:** Explain the failover logic to the user (i.e., that a Scheduler Restart/Config Reload is required to attempt a switch back to Primary).

## 5. Target Audience
*   **System Administrators:** Users troubleshooting missing prayer times or verifying if a specific API (e.g., MyMasjid) is back online after an outage.

## 6. Features and Requirements

### 6.1 Backend: Source Testing API
*   **FR-01: Test Endpoint**
    *   **Route:** `POST /api/system/source/test`
    *   **Auth:** Protected by `authenticateToken`.
    *   **Body:** `{ target: 'primary' | 'backup' }`.
    *   **Logic:**
        1.  Load the current server configuration.
        2.  Identify the target source configuration.
        3.  If target is Backup and it is disabled/null, return error.
        4.  Call the appropriate fetcher (`fetchAladhanAnnual` or `fetchMyMasjidBulk`) using the config parameters.
        5.  **Constraint:** Do NOT write the results to `data/cache.json`. This is a read-only test.
    *   **Response:**
        *   Success: `200 OK` `{ success: true, message: "Source responded with [N] days of data" }`.
        *   Failure: `500/400` `{ success: false, error: "API Error: ..." }`.

### 6.2 Frontend: Developer View (`DeveloperSettingsView`)
*   **FR-02: Prayer Source Status Card**
    *   A new card MUST be added below the "System Health" card.
    *   **Header:** "Prayer Source Status".
    *   **Content:**
        *   **Active Indicator:** A prominent banner or badge showing: "Currently Active Source: [Source Name]" (Derived from `GET /api/prayers` metadata).
        *   **Primary Row:** Label "Primary ([Type])", Config Summary (e.g., MasjidID), "Test Connectivity" button.
        *   **Backup Row:** Label "Backup ([Type])", Config Summary, "Test Connectivity" button. If Backup is disabled, show "Disabled" badge and disable the test button.
    *   **Footer:** Helper text: "To force the system to switch back to Primary, use 'Reload Config & Cache' in System Actions."

*   **FR-03: Active Source Logic**
    *   The view MUST fetch `/api/prayers` on mount to retrieve `meta.source`.
    *   It MUST compare `meta.source` (the one in cache) with `config.sources.primary.type`.
    *   **Visual State:**
        *   If `Active == Primary`: Green indicator.
        *   If `Active == Backup`: Amber indicator ("Running on Backup").
        *   If `Active == Unknown/None`: Red indicator.

### 6.3 Frontend: Interaction Details
*   **FR-04: Test Button Behavior**
    *   Clicking "Test Connectivity" MUST trigger `POST /api/system/source/test`.
    *   **Loading:** Show a spinner inside the button.
    *   **Success:** Show a temporary Green Checkmark and a Success Toast ("Connection Successful").
    *   **Failure:** Show a Red X and an Error Toast with the specific API error message.

## 7. User Stories and Acceptance Criteria

### US-1: Verifying Failover
**As an** admin,
**I want** to see if the system is currently using the Backup source,
**So that** I know if the Primary source has failed recently.

*   **AC-1:** I navigate to Developer Settings.
*   **AC-2:** The "Prayer Source Status" card shows "Currently Active: MyMasjid (Backup)" in Amber text.
*   **AC-3:** I see the Primary source is "Aladhan".

### US-2: Testing Repair
**As an** admin,
**I want** to check if the Primary source is back online without breaking my current valid cache,
**So that** I can decide whether to reload the system.

*   **AC-1:** System is on Backup.
*   **AC-2:** I click "Test Connectivity" on the Primary Source row.
*   **AC-3:** Spinner runs for 2 seconds.
*   **AC-4:** Toast appears: "Connection Successful".
*   **AC-5:** I now know it is safe to click "Reload Config & Cache" to switch back.

## 8. Technical Requirements / Stack
*   **Backend:** Node.js, Express.
*   **Frontend:** React, Lucide Icons (`Database`, `Globe`, `Activity`).

## 9. Design and User Interface
*   **Card Layout:**
    *   **Top Bar:** "Currently Using: **Aladhan**" (Green badge).
    *   **Table/Grid:**
        *   Col 1: Source Label (Primary/Backup).
        *   Col 2: Type (Icon + Name).
        *   Col 3: ID/Coords (Truncated).
        *   Col 4: Action (Button).

## 10. Open Questions / Assumptions
*   **Assumption:** The `fetchers.js` functions do not have side effects (writing files) embedded within them. (Verified: `prayerTimeService` handles the writing, fetchers just return data).