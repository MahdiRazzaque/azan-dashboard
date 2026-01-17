# Product Requirements Document: Phase 4.95 - Backup Data Source & Enhanced Validation

## 1. Title
Phase 4.95 - Backup Data Source & Enhanced Validation

## 2. Introduction
This document outlines the requirements for **Phase 4.95** of the Azan Dashboard. This phase addresses two key reliability and usability improvements: the implementation of a **Backup Prayer Data Source** to ensure system resilience during primary API outages, and the refinement of **Validation Error Messages** (specifically for MyMasjid) to provide user-friendly feedback instead of generic HTTP errors.

## 3. Product Overview
The General Settings interface will be restructured. A new "Backup Prayer Data Source" card will be introduced, allowing administrators to configure a secondary provider (e.g., Aladhan) that the system will fall back to if the Primary source (e.g., MyMasjid) fails. To support this, the source configuration UI will be modularised into a reusable component. Additionally, the backend validation logic will be enhanced to catch specific MyMasjid API errors (like invalid IDs) and pass readable messages to the frontend.

## 4. Goals and Objectives
*   **Resilience:** Ensure prayer times are always available by falling back to a secondary source if the primary source fails or returns empty data.
*   **Usability:** Simplify the configuration process by reusing a consistent UI for both Primary and Backup sources.
*   **Clarity:** Replace technical error messages (e.g., "Bad Request") with actionable feedback (e.g., "Invalid Masjid ID").
*   **Data Integrity:** Prevent invalid configurations by strictly enforcing mutual exclusion (Primary and Backup cannot be the same source) and blocking saves on validation failure.

## 5. Target Audience
*   **Mosque Administrators:** Who rely on MyMasjid but need a fallback calculation method if the MyMasjid API service experiences downtime.
*   **System Integrators:** Who need precise error messages during setup to troubleshoot incorrect IDs.

## 6. Features and Requirements

### 6.1 Frontend: Reusable Source Component
*   **FR-01: `SourceConfigurator` Component**
    *   A new React component `SourceConfigurator` MUST be created.
    *   **Props:**
        *   `source`: The current source object (`{ type: '...', ... }`).
        *   `onChange`: Callback for updates.
        *   `disabledTypes`: Array of strings (e.g., `['aladhan']`) to disable specific buttons.
        *   `showCoordinates`: Boolean (default true). If true, renders Lat/Long inputs when Aladhan is selected.
    *   **Functionality:**
        *   Renders Source Type buttons (MyMasjid / Aladhan).
        *   Conditionally renders inputs based on type (Masjid ID for MyMasjid; Method/Madhab/Coords for Aladhan).
        *   Fetches constants (Methods, Madhabs) from `useConstants` for the Aladhan dropdowns.

### 6.2 Frontend: General Settings View Refactor
*   **FR-02: Layout Restructuring**
    *   The view MUST be reorganised into three vertical sections:
        1.  **Primary Data Source:** Uses `SourceConfigurator`.
        2.  **Backup Data Source:** New Card (see FR-03).
        3.  **Localization:** Contains Timezone configuration only.
*   **FR-03: Backup Data Source Card**
    *   **Header:** Toggle Switch ("Enable Backup Source").
    *   **State:**
        *   **Off:** Card is collapsed or greyed out. `config.sources.backup` is treated as `null` or disabled.
        *   **On:** Card expands to show a `SourceConfigurator`.
    *   **Mutual Exclusion:**
        *   If Primary is "MyMasjid", the "MyMasjid" button in Backup MUST be disabled.
        *   If Primary is "Aladhan", the "Aladhan" button in Backup MUST be disabled.
    *   **Auto-Switching:** If the user changes Primary to the type currently selected in Backup, the Backup type MUST automatically switch to the alternative (or reset) to maintain valid state.

### 6.3 Backend: Enhanced Error Handling
*   **FR-04: MyMasjid Specific Errors**
    *   In `src/services/fetchers.js`, the `fetchMyMasjidBulk` function MUST inspect the `response.status`.
    *   **400 Bad Request:** Throw `new Error("Invalid Masjid ID: The ID provided is incorrect.")`.
    *   **404 Not Found:** Throw `new Error("Masjid ID not found.")`.
*   **FR-05: API Error Passthrough**
    *   In `src/routes/api.js` (Update Endpoint), the error handling logic MUST be updated.
    *   If an error message starts with "Invalid Masjid ID" or contains specific user-friendly keywords, it MUST be returned directly in the JSON error field, bypassing the generic "Validation Failed:" prefix.

### 6.4 Backend: Backup Persistence
*   **FR-06: Config Handling**
    *   The `ConfigService` and Zod schema MUST support saving `sources.backup`.
    *   If the Backup Toggle is **Off** in the frontend, the save payload MUST explicitly set `sources.backup` to `null` or an empty state to remove legacy backup settings.

## 7. User Stories and Acceptance Criteria

### US-1: Configuring Backup
**As an** admin using MyMasjid,
**I want** to set Aladhan as my backup source,
**So that** if the mosque's API goes down, the screen shows calculated times instead of an error.

*   **AC-1:** I toggle "Enable Backup Source" to ON.
*   **AC-2:** I see the Source Selector. "MyMasjid" is greyed out (since it is my Primary).
*   **AC-3:** I select "Aladhan".
*   **AC-4:** Latitude/Longitude inputs appear inside the Backup card.
*   **AC-5:** I enter coordinates and save. The config file updates with `sources.backup`.

### US-2: Invalid ID Feedback
**As an** admin,
**I want** to be told if I typed my Masjid ID wrong,
**So that** I don't scratch my head looking at "Bad Request".

*   **AC-1:** I enter an invalid GUID in the Primary Source field.
*   **AC-2:** I click Save.
*   **AC-3:** The Save Process Modal shows an Error state.
*   **AC-4:** The error text reads: "Invalid Masjid ID: The ID provided is incorrect." (Not "Validation Failed: Error...").

## 8. Technical Requirements / Stack
*   **Frontend:** React, Reusable Components.
*   **Backend:** Node.js, `fetch` error handling.

## 9. Design and User Interface
*   **Primary Card:** "Prayer Data Source".
*   **Backup Card:** "Backup Data Source".
    *   Header: Title + Toggle Switch.
    *   Body: `SourceConfigurator` (only visible if Toggle is ON).
*   **Localization Card:** "Localization" (Timezone input).

## 10. Open Questions / Assumptions
*   **Assumption:** Latitude/Longitude are stored globally in `location.coordinates`. Changing them in the Backup card (if Aladhan is selected) updates the global coordinates, which is acceptable behavior.