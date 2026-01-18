# Product Requirements Document: Phase 5.03 - Storage Quota & Management

## 1. Title
Phase 5.03 - Storage Quota & Management

## 2. Introduction
This document outlines the requirements for **Phase 5.03** of the Azan Dashboard. As the system allows users to upload custom audio files and generate Text-to-Speech (TTS) assets, uncontrolled storage usage can lead to disk exhaustion, potentially crashing the server or the host operating system. This phase introduces a **Virtual Storage Quota** system that limits the size of the audio library (`public/audio`), enforces these limits during uploads and generation, and provides visibility into disk usage via the Developer Tools.

## 3. Product Overview
A new "Storage Management" module will be integrated into the backend and the Developer Settings UI.
*   **Backend:** A dedicated service will monitor the size of the `public/audio` directory. It will enforce a user-defined quota (e.g., 1GB) by rejecting file uploads and blocking TTS generation if the limit would be exceeded. It will also interface with the host OS to report physical disk availability.
*   **Frontend:** The Developer Settings view will feature a new Storage Card displaying a visual breakdown of storage usage (Application Used vs. Quota vs. System Free). It will provide smart recommendations for the quota size based on the number of active automation triggers.

## 4. Goals and Objectives
*   **Stability:** Prevent the application from filling up the host disk partition.
*   **Control:** Give administrators the ability to set a hard limit (cap) on how much space the audio library consumes.
*   **Visibility:** Clearly show how much space is being used by custom files versus cached TTS assets.
*   **Prevention:** Stop large file uploads *before* they consume bandwidth or disk I/O using header validation.

## 5. Target Audience
*   **System Administrators:** Managing the resource usage of the dashboard, especially on constrained devices like Raspberry Pis.

## 6. Features and Requirements

### 6.1 Backend: Infrastructure & Config
*   **FR-01: New Dependency**
    *   Install `check-disk-space` to retrieve physical disk stats cross-platform (Windows/Linux/macOS).
*   **FR-02: Configuration Schema**
    *   Update `src/config/schemas.js`.
    *   Add `data.storageLimit` (number) representing the quota in **Gigabytes (GB)**.
    *   Default: `1.0` (1 GB). Minimum: `0.1` (100MB).

### 6.2 Backend: Storage Service
*   **FR-03: `StorageService` Module**
    *   Create `src/services/storageService.js`.
    *   **Method `getUsage()`**: Recursively calculate the size of `public/audio` (separating `custom` vs `cache` is optional but total size is mandatory).
    *   **Method `getSystemStats()`**: Use `check-disk-space` to get free space on the drive where `public/audio` resides. Handle Docker/Container failures gracefully (return 0 or null).
    *   **Method `checkQuota(bytesToAdd)`**:
        *   Calculate `currentUsage + bytesToAdd`.
        *   Compare against `config.data.storageLimit` (converted to bytes).
        *   Return `{ success: boolean, message: string }`.
    *   **Method `calculateRecommendedLimit()`**:
        *   Count enabled automation triggers in config.
        *   Estimate `0.5MB` per file-based trigger (conservative avg for Adhans).
        *   Estimate `0.1MB` per TTS trigger.
        *   Return recommended GB value.

### 6.3 Backend: Enforcement Logic
*   **FR-04: Upload Middleware**
    *   Create `src/middleware/storageCheck.js`.
    *   It MUST run **before** `multer` in the upload route.
    *   Check `req.headers['content-length']`.
    *   Call `StorageService.checkQuota(contentLength)`.
    *   If failed, return `413 Payload Too Large` immediately.
*   **FR-05: TTS Pre-Check**
    *   Update `src/services/audioAssetService.js`.
    *   Before calling Python generation, estimate size: `text.length * 1024` bytes (1KB per char is a safe upper bound estimate for short TTS).
    *   Call `StorageService.checkQuota(estimatedSize)`.
    *   If failed, throw Error ("Storage Limit Exceeded") and skip generation.

### 6.4 Backend: API Endpoints
*   **FR-06: Storage Status Endpoint**
    *   **Route:** `GET /api/system/storage`
    *   **Response:**
        ```json
        {
          "usedBytes": 123456,
          "limitBytes": 1073741824, // 1GB
          "systemFreeBytes": 50000000000,
          "recommendedLimitGB": 0.5,
          "breakdown": { "custom": 1000, "cache": 2000 } // Optional
        }
        ```

### 6.5 Frontend: Developer UI
*   **FR-07: Storage Management Card**
    *   Add card to `DeveloperSettingsView` (Position: Below TTS Status, Above Logs).
    *   **Visuals:**
        *   A multi-colored progress bar:
            *   [Green Segment]: Used Space.
            *   [Grey Segment]: Remaining Quota.
            *   [Dashed/Transparent]: System Free (Contextual).
    *   **Controls:**
        *   Input for "Storage Limit (GB)".
        *   "Save" functionality (reuses existing `saveSettings`).
    *   **Feedback:**
        *   Show "Recommended: X GB" helper text.
        *   Show "X% Used" badge.

## 7. User Stories and Acceptance Criteria

### US-1: Quota Enforcement (Upload)
**As an** admin,
**I want** the system to reject a 100MB file if my limit is 50MB,
**So that** I don't fill up the disk.

*   **AC-1:** Set limit to 0.05 GB (50MB).
*   **AC-2:** Attempt to upload a 60MB MP3.
*   **AC-3:** Upload is rejected immediately (Network tab shows 413 or 400).
*   **AC-4:** Error toast appears: "Storage Limit Exceeded".

### US-2: Quota Enforcement (TTS)
**As an** admin,
**I want** TTS generation to stop if the disk is full,
**So that** the system doesn't crash trying to write to a full drive.

*   **AC-1:** Quota is 99% full.
*   **AC-2:** Trigger "Regenerate TTS".
*   **AC-3:** Logs show "Skipping [Prayer] TTS: Storage Limit Exceeded".
*   **AC-4:** UI shows a warning or partial success.

### US-3: Monitoring
**As a** user,
**I want** to see how much space my Adhan files are taking,
**So that** I know if I need to buy a bigger SD card or increase the limit.

*   **AC-1:** Navigate to Developer Tools.
*   **AC-2:** "Storage Management" card shows "Used: 150MB / 1GB".
*   **AC-3:** System Free space is displayed (e.g., "Disk Free: 14GB").

## 8. Technical Requirements / Stack
*   **Backend:** Node.js.
*   **Libraries:** `check-disk-space` (New), `fast-folder-size` (or native `fs` recursion).
*   **Frontend:** React, standard HTML `<progress>` or `div` based bars.

## 9. Open Questions / Assumptions
*   **Assumption:** The `Content-Length` header is reliable for file uploads.
*   **Assumption:** The host OS allows reading disk stats for the current working directory.