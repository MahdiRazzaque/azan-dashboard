# Product Requirements Document: Phase 4.96 - Advanced Aladhan Settings & Validation Refactor

## 1. Title
Phase 4.96 - Advanced Aladhan Settings & Validation Refactor

## 2. Introduction
This document outlines the requirements for **Phase 4.96** of the Azan Dashboard. This phase is focused on deepening the integration with the Aladhan API to support advanced calculation parameters, enhancing system robustness through strict data validation, and decluttering the user interface. It aims to give users precise control over how prayer times are calculated while preventing configuration errors that could lead to API failures.

## 3. Product Overview
The Settings interface for "General Settings" will be significantly upgraded. The hardcoded dropdown menus will be replaced by dynamic selectors populated by a new backend API, ensuring options are always up-to-date and sorted alphabetically. New controls for **Latitude Adjustment** and **Midnight Mode** will be exposed. Crucially, the system will now enforce strict validation on Geolocation (Latitude/Longitude ranges) and Timezone strings (IANA format) both on the frontend and backend, providing clear, user-friendly error messages.

## 4. Goals and Objectives
*   **Accuracy:** Expose advanced Aladhan parameters (Latitude Adjustment, Midnight Mode) to handle high-latitude and unique calculation scenarios.
*   **Data Integrity:** Enforce strict type safety and range checks on all configuration inputs.
*   **Legacy Compatibility:** Seamlessly migrate existing string-based configurations (e.g., "Hanafi") to the ID-based format required by the API.
*   **UX Consistency:** Remove redundant "Save" buttons and ensure all dropdowns are sorted alphabetically for easier scanning.

## 5. Target Audience
*   **System Administrators:** Users who need to fine-tune prayer times for locations with extreme latitudes or specific juristic requirements.

## 6. Features and Requirements

### 6.1 Backend: Constants & Schema
*   **FR-01: Constants API Endpoint**
    *   **Route:** `GET /api/system/constants`
    *   **Auth:** Protected by `authenticateToken`.
    *   **Response:** JSON object containing:
        *   `calculationMethods`: Array of `{ id: number, label: string }`.
        *   `madhabs`: Array of `{ id: number, label: string }`.
        *   `latitudeAdjustments`: Array of `{ id: number, label: string }` (Must include ID 0: "None").
        *   `midnightModes`: Array of `{ id: number, label: string }`.
    *   **Sorting:** The backend SHOULD return the raw maps; sorting can be handled by the frontend for display flexibility, or pre-sorted by the backend. (Frontend sorting preferred for locale support).

*   **FR-02: Enhanced Zod Schema (`src/config/schemas.js`)**
    *   **Coordinates:**
        *   Latitude: Number, Min -90, Max 90.
        *   Longitude: Number, Min -180, Max 180.
    *   **Timezone:**
        *   String.
        *   **Validation:** Must be a valid IANA timezone. Validated using `Intl.DateTimeFormat(undefined, { timeZone: val })`.
    *   **Calculation Object:**
        *   `method`: Number (ID).
        *   `madhab`: Number (ID).
        *   `latitudeAdjustmentMethod`: Number (ID). Default: `0` (None).
        *   `midnightMode`: Number (ID). Default: `0` (Standard).
    *   **Transformation:** The schema MUST accept legacy string values (e.g., "Hanafi") and auto-convert them to their corresponding Integer IDs during the parsing phase.

### 6.2 Frontend: General Settings View
*   **FR-03: Dynamic Selectors**
    *   The view MUST fetch options from `GET /api/system/constants` on mount.
    *   Dropdowns MUST be rendered dynamically.
    *   **Sorting:** All options within a dropdown MUST be sorted alphabetically by Label.
    *   **Labels:** Labels MUST NOT contain the text "(Default)".

*   **FR-04: UI Clean-up**
    *   **Remove:** The local "Save Changes" button in `GeneralSettingsView`. The view must rely solely on the Global Save button in the header.
    *   **Add:** Selectors for "Latitude Adjustment" and "Midnight Mode".

### 6.3 Frontend: Validation Logic
*   **FR-05: Pre-Save Validation**
    *   The `SettingsContext` save function MUST run a validation pass on the General settings section.
    *   **Checks:**
        *   Lat/Long ranges.
        *   Timezone validity.
        *   Constant ID existence (ensure selected ID exists in the fetched list).
    *   **Error Handling:** If validation fails, abort the save and show a user-friendly error (e.g., "Validation Error: Latitude must be between -90 and 90").

### 6.4 Backend: Fetcher Logic
*   **FR-06: Aladhan Fetcher Update**
    *   Update `fetchAladhanAnnual` in `src/services/fetchers.js`.
    *   It MUST read the numerical IDs (`method`, `school`, `latitudeAdjustmentMethod`, `midnightMode`) from the config.
    *   It MUST construct the API URL using these parameters.
    *   If `latitudeAdjustmentMethod` is `0`, it MUST send `0` explicitly (not omit it).

## 7. User Stories and Acceptance Criteria

### US-1: High Latitude Setup
**As a** user in Norway,
**I want** to set "One Seventh of the Night" rule,
**So that** my Isha time is calculated correctly in summer.

*   **AC-1:** General Settings shows "Latitude Adjustment" dropdown.
*   **AC-2:** Dropdown contains "One Seventh of the Night".
*   **AC-3:** Options are sorted Alphabetically (A-Z).
*   **AC-4:** Saving sends the correct ID to the backend.

### US-2: Validation Safety
**As an** admin,
**I want** the system to stop me if I make a typo in the Latitude,
**So that** the API doesn't crash silently.

*   **AC-1:** I enter `95` for Latitude.
*   **AC-2:** I click the Global Save button.
*   **AC-3:** The Save Process Modal does **not** open.
*   **AC-4:** A red notification toast appears: "Validation Error: Latitude must be between -90 and 90".

### US-3: Clean UI
**As a** user,
**I want** to see only one Save button,
**So that** I don't get confused about which one to click.

*   **AC-1:** Navigate to General Settings.
*   **AC-2:** There is no "Save Changes" button inside the main content area.
*   **AC-3:** The header "Save" button works as expected.

## 8. Technical Requirements / Stack
*   **Backend:** Node.js, Zod (Schema Transformation), Intl API.
*   **Frontend:** React, `useEffect` (Fetcher), Array `sort()`.

## 9. Data & Configuration Structure

### 9.1 Constants Data Source (`src/utils/constants.js`)
Ensure the following export structure:
```javascript
export const LATITUDE_ADJUSTMENT_METHODS = {
    0: "None",
    1: "Middle of the Night",
    2: "One Seventh of the Night",
    3: "Angle Based"
};
// ... + other existing constants
```

### 9.2 Defaults (`default.json`)
```json
{
  "calculation": {
    "method": 15, // Moonsighting Committee
    "madhab": 1,  // Hanafi
    "latitudeAdjustmentMethod": 0, // None
    "midnightMode": 0 // Standard
  }
}
```

## 10. Open Questions / Assumptions
*   **Assumption:** The frontend will perform a "best effort" mapping if the currently saved ID is somehow deprecated or missing from the constants list (it should show the ID or "Unknown" rather than crashing).