# Product Requirements Document: Phase 5.02 - Bulk Offset Adjustments & Validation

## 1. Title
Phase 5.02 - Bulk Offset Adjustments & Validation

## 2. Introduction
This document outlines the requirements for **Phase 5.02** of the Azan Dashboard. This phase introduces usability improvements for the Automation system by allowing administrators to apply offset timings (e.g., "15 minutes before Adhan") to all prayers simultaneously. Additionally, it implements strict validation to cap these offsets at 60 minutes to prevent configuration errors and ensure schedule reliability.

## 3. Product Overview
A new "Batch Adjustments" card will be added to the Automation Settings view. This interface allows users to enter a minute value and apply it to every "Pre-Adhan" or "Pre-Iqamah" trigger across all prayers in one click. The system will intelligently skip invalid targets (e.g., Pre-Iqamah for Sunrise). Furthermore, all offset input fields—both in the bulk tool and individual trigger cards—will enforce a strict maximum limit of 60 minutes.

## 4. Goals and Objectives
*   **Efficiency:** Reduce the time required to configure standard reminders (e.g., setting a 15-minute warning for all 5 prayers) from 10 clicks to 2 clicks.
*   **Consistency:** Ensure configuration values remain within safe bounds (0-60 minutes) to prevent scheduling conflicts or user error.
*   **Usability:** Provide immediate visual feedback when bulk changes are applied, without requiring a page reload.

## 5. Target Audience
*   **System Administrators:** Who need to quickly set up a standard notification policy (e.g., "10 minutes before every Iqamah") across the entire schedule.

## 6. Features and Requirements

### 6.1 Backend: Schema Validation
*   **FR-01: Zod Schema Update**
    *   Update `src/config/schemas.js`.
    *   Modify `triggerEventSchema` to enforce a maximum value of `60` for `offsetMinutes`.
    *   **Constraint:** `z.number().min(0).max(60).optional()`.

### 6.2 Frontend: Settings Logic
*   **FR-02: Bulk Update Action**
    *   Update `SettingsContext.jsx` to include a `bulkUpdateOffsets(eventType, minutes)` function.
    *   **Logic:**
        *   Iterate through all supported prayers (`fajr`, `sunrise`, `dhuhr`, `asr`, `maghrib`, `isha`).
        *   Check if the target object exists (e.g., `draftConfig.automation.triggers[prayer][eventType]`).
        *   **Safety:** Explicitly skip `preIqamah` for `sunrise`.
        *   Update the `offsetMinutes` value in the `draftConfig` state.
    *   **Validation:** Ensure the input `minutes` is clamped between 0 and 60 before applying.

### 6.3 Frontend: UI Components
*   **FR-03: TriggerCard Validation**
    *   Update `client/src/components/TriggerCard.jsx`.
    *   In the "Minutes Before" input `onChange` handler, strictly enforce the limit: `Math.min(60, Math.max(0, value))`.
    *   Prevent users from typing values larger than 60.

*   **FR-04: Batch Adjustments Card**
    *   Update `client/src/views/settings/AutomationSettingsView.jsx`.
    *   Add a new Card component titled **"Batch Adjustments"** located below the "Master Controls" card.
    *   **Row 1:** "Pre-Adhan Offset"
        *   Input: Number (0-60).
        *   Action: Button "Apply to All".
    *   **Row 2:** "Pre-Iqamah Offset"
        *   Input: Number (0-60).
        *   Action: Button "Apply to All".
    *   **Feedback:** Clicking Apply must trigger a Toast notification (e.g., "Updated 6 Pre-Adhan triggers").

## 7. User Stories and Acceptance Criteria

### US-1: Quick Setup
**As an** admin,
**I want** to set all my "Pre-Adhan" reminders to 15 minutes at once,
**So that** I don't have to manually edit every single prayer card.

*   **AC-1:** Navigate to Automation Settings.
*   **AC-2:** In "Batch Adjustments", enter `15` for Pre-Adhan.
*   **AC-3:** Click "Apply to All".
*   **AC-4:** Toast confirms update.
*   **AC-5:** Navigate to Prayer Settings -> Fajr. The Pre-Adhan offset is now `15`.

### US-2: Validation Safety
**As a** user,
**I want** the system to stop me if I try to set a 90-minute reminder,
**So that** I don't create overlapping or nonsensical schedules.

*   **AC-1:** In a Trigger Card, try to type `90` into the minutes box.
*   **AC-2:** The input automatically corrects to `60`.
*   **AC-3:** Try to save via API directly (bypassing UI). The backend returns a Validation Error.

### US-3: Sunrise Safety
**As an** admin,
**I want** to bulk update "Pre-Iqamah" settings without breaking the Sunrise configuration,
**So that** the system remains stable.

*   **AC-1:** Apply `10` minutes to "Pre-Iqamah" via Batch tools.
*   **AC-2:** Verify Dhuhr/Asr/etc are updated to `10`.
*   **AC-3:** Verify Sunrise is untouched (as it has no Iqamah).
*   **AC-4:** Save config. No errors occur.

## 8. Technical Requirements / Stack
*   **Frontend:** React Context, Toast Notifications.
*   **Backend:** Node.js, Zod.

## 9. Design and User Interface
*   **Batch Adjustments Card:**
    *   **Style:** Consistent with `bg-app-card` styling.
    *   **Layout:**
        ```
        [ Label: Pre-Adhan Offset ]  [ Input: 15 ] [ Button: Apply ]
        [ Label: Pre-Iqamah Offset ] [ Input: 10 ] [ Button: Apply ]
        ```