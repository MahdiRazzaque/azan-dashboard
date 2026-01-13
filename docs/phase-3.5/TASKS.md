# Project Tasks

## Task 1: Frontend Initialization & Scaffolding
- **Status:** done
- **Priority:** high
- **Dependencies:** []
- **Description:** Initialize the React application using Vite and configure the styling ecosystem.
- **Details:**
  - Create the `client` directory using Vite (React + JavaScript).
  - Install production dependencies: `react-router-dom`, `lucide-react`, `luxon`, `clsx`, `tailwind-merge`.
  - Install dev dependencies: `tailwindcss`, `postcss`, `autoprefixer`.
  - Initialize Tailwind CSS and configure `tailwind.config.js` to include the client files.
  - Define CSS variables for the colour palette (Dark Mode, Gold Accent) in `client/src/index.css`.
- **Test Strategy:**
  - Run `npm run dev` in the `client` folder.
  - Verify the default Vite splash screen appears on port 5173.
  - Verify Tailwind classes are working by adding a test class to `App.jsx`.
- **Subtasks:**
  - 1.1: Scaffold Vite Project - **Status:** done - **Dependencies:** []
  - 1.2: Install Dependencies (Router, Lucide, Luxon) - **Status:** done - **Dependencies:** [1.1]
  - 1.3: Configure Tailwind CSS & Variables - **Status:** done - **Dependencies:** [1.1]

## Task 2: Backend Integration
- **Priority:** high
- **Dependencies:** [1]
- **Description:** Update the Express server to serve the compiled React frontend.
- **Details:**
  - Update `src/server.js` to serve static files from `../client/dist` instead of `../public`.
  - Implement a catch-all route (`*`) in Express to serve `index.html` (supporting React Router).
  - Update the root `package.json` with a `build` script (`cd client && npm install && npm run build`).
  - Add a `heroku-postbuild` or equivalent script if deployment is planned, though `build` suffices for now.
- **Test Strategy:**
  - Run `npm run build` in root.
  - Run `npm start`.
  - Access `http://localhost:3000` and verify the React app loads (not the old HTML file).
- **Subtasks:**
  - 2.1: Update Server Static Middleware - **Status:** done - **Dependencies:** []
  - 2.2: Add Catch-All Route - **Status:** done - **Dependencies:** [2.1]
  - 2.3: Update Root Build Scripts - **Status:** done - **Dependencies:** []

## Task 3: Core Hooks Implementation
- **Priority:** high
- **Dependencies:** [1]
- **Description:** Port business logic (Time, Audio, Logs) from Phase 2/3 into React Custom Hooks.
- **Details:**
  - `usePrayerTimes`: Fetch `/api/prayers`, manage polling (15m) and `nextPrayer` state. Return `{ prayers, nextPrayer, meta, loading, error }`.
  - `useSSE`: Manage EventSource connection to `/api/logs`. Return `{ logs, isConnected }`. Pass `onAudioPlay` callback logic.
  - `useAudio`: Manage `AudioContext` ref and `isMuted` state. Handle "Resume Context" on user interaction. Expose `playUrl(url)` function.
- **Test Strategy:**
  - Create a temporary debug component to display `JSON.stringify(usePrayerTimes())`.
  - Verify data updates from the API.
  - Verify `useAudio` logs status changes when toggling mute.
- **Subtasks:**
  - 3.1: Implement usePrayerTimes - **Status:** done - **Dependencies:** []
  - 3.2: Implement useSSE - **Status:** done - **Dependencies:** []
  - 3.3: Implement useAudio - **Status:** done - **Dependencies:** []

## Task 4: UI Components - Dashboard Layout
- **Priority:** high
- **Dependencies:** [3]
- **Description:** Build the visual components for the main dashboard view using Tailwind.
- **Details:**
  - `DashboardLayout`: Full-height Grid container (`grid-cols-2`).
  - `PrayerCard`: Left panel. Rounded corners (`rounded-3xl`). Render table rows dynamically based on `usePrayerTimes`. Handle 'dimmed' and 'highlight' styles.
  - `FocusCard`: Right panel. Render `Clock` (HH:mm:ss) and `Countdown` components.
  - `TopControls`: Absolute positioned container top-right. Render `AudioToggle` (Speaker Icon) and `SettingsLink` (Gear Icon).
- **Test Strategy:**
  - Visual check: Ensure cards stretch to full height.
  - Visual check: Ensure "Next Prayer" row is highlighted gold.
  - Functional check: Click Speaker icon, verify `useAudio` state changes.
- **Subtasks:**
  - 4.1: Create DashboardLayout & TopControls - **Status:** done - **Dependencies:** []
  - 4.2: Create PrayerCard (Table) - **Status:** done - **Dependencies:** [4.1]
  - 4.3: Create FocusCard (Clock/Countdown) - **Status:** done - **Dependencies:** [4.1]

## Task 5: Routing & Settings View
- **Priority:** medium
- **Dependencies:** [4]
- **Description:** Implement React Router and the Settings/Logs view.
- **Details:**
  - Update `App.jsx` to use `BrowserRouter`.
  - Define routes: `/` (Dashboard) and `/settings` (Settings).
  - `SettingsView`: Simple layout with a "Back" button. Render the logs list from `useSSE` context here (moved from main dashboard).
- **Test Strategy:**
  - Click "Gear" icon -> verify navigation to `/settings`.
  - Click "Back" -> verify navigation to `/`.
  - Verify logs appear in Settings view when generated.
- **Subtasks:**
  - 5.1: Setup React Router - **Status:** done - **Dependencies:** []
  - 5.2: Create SettingsView Component - **Status:** done - **Dependencies:** [5.1]
  - 5.3: Integrate Logs list into Settings - **Status:** done - **Dependencies:** [5.2]

## Task 6: Audio Notification Logic
- **Priority:** medium
- **Dependencies:** [3, 4]
- **Description:** Implement the visual alert when audio is blocked.
- **Details:**
  - Update `useAudio`: If `playUrl` is called but context is suspended, set a temporary `blocked` state.
  - Update `TopControls`: Listen to `blocked` state. If true, show a Red visual indicator (e.g., flashing icon or tooltip "Click to Unmute").
- **Test Strategy:**
  - Set app to Muted.
  - Trigger a test audio event (mocking SSE).
  - Verify visual alert appears.
  - Click alert -> Audio unmuted -> Alert clears.
- **Subtasks:**
  - 6.1: Add Blocked State to useAudio - **Status:** done - **Dependencies:** []
  - 6.2: Implement Visual Alert in UI - **Status:** done - **Dependencies:** [6.1]

## Task 7: Cleanup
- **Priority:** low
- **Dependencies:** [2, 4, 5]
- **Description:** Remove legacy frontend files.
- **Details:**
  - Delete `public/index.html`, `public/css`, `public/js`.
  - Ensure `public/audio` remains (used for cache/custom uploads).
- **Test Strategy:**
  - Verify project folder structure is clean.
  - Verify `npm start` still works without the old files.
- **Subtasks:**
  - 7.1: Remove Legacy Assets - **Status:** done - **Dependencies:** []