# Product Requirements Document: Phase 3.5 - React Frontend Rewrite

## 1. Introduction
This document outlines the requirements for **Phase 3.5**, which involves a complete architectural migration of the frontend from vanilla HTML/JS to a **React.js** Single Page Application (SPA). This phase aims to modernise the codebase, introduce a component-based UI, and prepare the system for complex administrative features (Phase 5).

## 2. Product Overview
The frontend will be rebuilt using **React**, **Vite**, and **Tailwind CSS**. It will consume the existing Express.js APIs (`/api/prayers`, `/api/logs`) but present them in a modern, "Card-based" split-screen layout. The application will handle audio policies gracefully, offering user controls without intrusive overlays.

## 3. Goals and Objectives
*   **Modernisation:** Adopt a standard React + Vite workflow for better maintainability and developer experience.
*   **UI/UX Improvement:** Implement a cleaner, rounded-card aesthetic using Tailwind CSS.
*   **Scalability:** Prepare the router and layout structure to easily add the "Settings" and "Device Management" screens later.
*   **User Control:** Replace the full-screen "Click to Start" overlay with a passive, top-right audio toggle.

## 4. Target Audience
*   **End Users:** Users viewing the dashboard on TVs or Monitors who want a clean, aesthetic display.
*   **Admins:** Users who need to access settings (future) without reloading or navigating away from the main app structure.

## 5. Technical Requirements / Stack

### 5.1 Frontend Stack
*   **Framework:** React 18
*   **Build Tool:** Vite (Fast HMR and optimized builds)
*   **Styling:** Tailwind CSS (Utility-first styling)
*   **Routing:** React Router DOM (v6)
*   **Icons:** `lucide-react`
*   **State Management:** React Context API (for Audio and Global Settings)
*   **HTTP Client:** Native `fetch` (or `axios` if complex headers required).

### 5.2 Build & Integration
*   **Directory:** All frontend code resides in `/client`.
*   **Output:** Vite builds to `/client/dist`.
*   **Serving:** The Express backend (`src/server.js`) MUST be updated to serve static files from `/client/dist` instead of `/public`.

## 6. Features and Requirements

### 6.1 Layout & Design
*   **FR-01: Split-Screen Card Layout**
    *   The dashboard MUST use a CSS Grid layout with two main "Cards".
    *   **Left Card (Schedule):** Occupies the left half, rounded corners (`rounded-3xl`), distinct background colour.
    *   **Right Card (Focus):** Occupies the right half, rounded corners, distinct background colour.
    *   Both cards MUST stretch to fill the available vertical height (minus padding).
*   **FR-02: Top Controls Area**
    *   A control bar MUST exist at the top-right of the screen (overlaying or above the Right Card).
    *   It MUST contain:
        1.  **Audio Toggle:** Speaker icon. Toggles `muted`/`unmuted` state. Shows a visual "slashed" state if muted.
        2.  **Settings Button:** Gear icon. Navigates to `/settings`.

### 6.2 Dashboard Components
*   **FR-03: Prayer Schedule (Left Card)**
    *   Table-like display of 5 prayers.
    *   Rows MUST expand to fill the available height of the card evenly.
    *   **Visual States:**
        *   *Passed:* Dimmed opacity.
        *   *Next:* Highlighted (Gold accent text/bg).
        *   *Future:* Standard brightness.
*   **FR-04: Focus Display (Right Card)**
    *   **Clock:** Large digital time display (HH:mm:ss).
    *   **Countdown:** "Next Prayer is [Name] in [-HH:mm:ss]".
    *   **Date:** "Monday, 13 January".

### 6.3 Audio System
*   **FR-05: Audio Context Hook**
    *   The system MUST initialize `AudioContext` in a suspended state.
    *   **Default State:** Muted (Context Suspended).
    *   **Activation:** Clicking the "Audio Toggle" (Speaker icon) attempts to resume the context.
*   **FR-06: Event Handling (SSE)**
    *   The app MUST subscribe to `/api/logs`.
    *   On `AUDIO_PLAY` event:
        *   If `!muted`: Play the audio URL.
        *   If `muted`: Display a visible "Toast" or "Alert" on screen: "Announcement blocked - Click to Unmute".

### 6.4 Navigation
*   **FR-07: Routing**
    *   `/` -> Renders `DashboardView`.
    *   `/settings` -> Renders `SettingsView`.
*   **FR-08: Settings Placeholder**
    *   The Settings view MUST exist but can be a placeholder for now (e.g., "Settings Coming Soon" + "Back to Dashboard" button).
    *   *Note:* The "Logs" console previously at the bottom of the screen MUST be moved here.

## 7. User Stories

### US-1: Dashboard Aesthetics
**As a** user,
**I want** the interface to look like a modern app with rounded cards,
**So that** it looks good on my living room TV.

### US-2: Audio Control
**As a** user,
**I want** to mute/unmute the Azan easily from the corner of the screen,
**So that** I don't have to reload the page or click a full-screen overlay.

### US-3: Missed Azan Awareness
**As a** user,
**I want** to be notified if the system tries to play an Azan while muted,
**So that** I know I need to enable audio for next time.

## 8. Migration Plan (Implementation Order)

1.  **Initialize Client:** Scaffold Vite + React in `/client`.
2.  **Install Dependencies:** Tailwind, Router, Lucide.
3.  **Port Logic:** Move `app.js` logic (Clock, Fetching, SSE) into React Hooks (`usePrayerTimes`, `useAudio`).
4.  **Implement Components:** Build `PrayerCard`, `FocusCard`, `Controls`.
5.  **Build Integration:** Update `src/server.js` to serve the Vite build.
6.  **Cleanup:** Remove old `/public` HTML/CSS files.

## 9. Open Questions / Assumptions
*   **Assumption:** The backend API remains unchanged (V2 API).
*   **Assumption:** We are using the standard Tailwind colour palette, extended with our custom "Gold" and "Dark Grey" variables.