# Learnings — onboarding-tour

## [2026-02-24] Initial Codebase Analysis

### Project Structure

- Backend: Node.js/Express at `/src/`, tests via Jest (`npm run test:src`)
- Frontend: React/Vite at `/client/src/`, tests via Vitest (`npm run test:client`)
- Backend test dir: `src/tests/unit/`
- Frontend test dir: `client/tests/unit/`

### Schema Patterns

- `src/config/schemas.js` uses Zod. `systemSchema` at line 71-81 uses `z.object({}).default({})` pattern
- `systemSchema` currently has only `healthChecks` field
- `src/config/default.json` has `system.healthChecks` at lines 82-87
- New `tours` field must be added INSIDE `systemSchema` z.object AND in the `.default({})` at line 76

### Test Patterns

- Backend tests: `src/tests/unit/config/schemas.test.js` exists — follow its patterns
- Frontend tests: `client/tests/unit/` has subdirs: components, contexts, hooks, utils, views, config, controllers

### Component Locations

- Dashboard components: `client/src/components/dashboard/FocusCard.jsx`, `PrayerCard.jsx`
- Layout components: `client/src/components/layout/TopControls.jsx`, `SettingsLayout.jsx`
- Common components: `client/src/components/common/ConfirmModal.jsx` (WelcomeModal reference)
- Settings: `client/src/components/settings/ClientSettingsModal.jsx`

### API Patterns

- Routes: `src/routes/settings.js`
- Controller: `src/controllers/settingsController.js`
- Auth middleware: `authenticateToken` from `src/middleware/auth.js`
- ConfigService: `src/config/ConfigService.js` — use `configService.update()` directly (NOT workflowService)

### Key Constraints

- NO `useState`/`useMemo` for driver instance — use `useRef` only
- NO custom click interceptor — use `overlayClickBehavior: 'nextStep'`
- NO `destroy()` without `isActive()` guard + try/catch
- NO `workflowService.executeUpdate()` for tour state — use `configService.update()` directly
- driver.js: dynamic import only (not static), named export `{ driver }`

## Task 7: Tour Step Definitions

**Completed:** Created `client/src/config/tourSteps.js` with two named exports:

- `dashboardTourSteps`: 6 steps for Dashboard Tour (Focus Card → Admin Settings)
- `adminTourSteps`: 6 steps for Admin Tour (General → Developer)

**Key Pattern:**

- Pure data file (no logic)
- Format: `{ element: '#selector', popover: { title: string, description: string } }`
- All text copied verbatim from PRD §3.1
- Element selectors match IDs from Tasks 4 & 5

**Verification:**

- Syntax valid (Node.js check passed)
- 12 total elements (6 per tour)
- All titles and descriptions match PRD exactly
- Successfully implemented WelcomeModal using TDD, matching the existing ConfirmModal pattern for accessibility and styling.

## [2026-02-24] Task 3: Tour State API

### Controller Pattern

- `updateTourState` added to `settingsController.js` as the last method (with trailing comma — JS allows this)
- Uses `configService.update({ system: { tours: req.body } })` directly — NOT `workflowService.executeUpdate()`
- No JSDoc comments added (existing minimal style followed)

### getPublicSettings Extension

- Added `system: { tours: fullConfig.system?.tours }` to response object
- Only the `tours` sub-field is exposed — `healthChecks` and other system fields are NOT included
- Optional chaining (`?.`) handles case where `system` is undefined

### TDD Lessons

- When adding fields to an existing controller response, update existing exact-match tests to `expect.objectContaining()` to avoid brittleness
- Integration tests (supertest) used for auth/route-level tests; unit tests for controller logic
- `jest.mock('@config')` auto-mocks the singleton, creating `jest.fn()` for all methods including `update`
- `configService.update` mock needs `.mockResolvedValue()` for async controllers

### Route Pattern

- `router.patch('/tour-state', ...)` added BEFORE `module.exports` in `src/routes/settings.js`
- Pattern: `router.patch('/tour-state', authenticateToken, asyncHandler(settingsController.updateTourState))`

### Full Test Suite

- 711 tests passing across 72 suites after task 3 completion

## [2026-02-24] Task 6: useTour Hook

### Hook & Test Patterns

- Hook uses `useRef` for driver instance and `useState` for `isActive`/`currentTour`
- Dynamic import in `startTour`: `const { driver } = await import('driver.js')`
- Spacebar listener added with `document.addEventListener('keydown', handler, { capture: true })` and removed on stop
- Tests mock `driver.js` via `vi.mock('driver.js', ...)` and reset mock calls in `beforeEach`

### Verification

- `npm run test:client` passed (491 tests across 62 files)

## [2026-02-24] Task 10: Admin Tour Auto-start

### React Strict Mode & Tour Auto-start

- When auto-starting a tour on mount, `useRef(false)` is essential to prevent double-triggering in React Strict Mode.
- `useState` or `useMemo` are not suitable for this because they can be re-initialized or re-evaluated during Strict Mode's double-render cycle.
- The `useEffect` dependency array must include all variables used inside the effect (`config`, `isAuthenticated`, `startTour`) to avoid stale closures.

### DOM Readiness

- When starting a tour immediately on mount, wrapping the `startTour` call in `requestAnimationFrame` ensures that the DOM elements (like navigation links) have been painted and are available for the tour driver to find.

### API Calls in Cleanup/Callbacks

- When making an API call in a callback like `onComplete` (e.g., `fetch('/api/settings/tour-state', ...)`), it's important to handle potential promise rejections with `.catch()` to prevent unhandled promise rejections, even if the result isn't strictly needed by the UI.

## [2026-02-24] Task 8: Dashboard Tour Modal Handoff

### DashboardView Integration

- `useSettings()` exposes `config` (nullable on load) and `fetchSettings`; initialize modal visibility from `config?.system?.tours?.dashboardSeen === false` and update via `useEffect` once config resolves.
- Use `flushSync(() => setShowWelcomeModal(false))` before `requestAnimationFrame(() => startTour('dashboard', dashboardTourSteps, handleTourComplete))` to guarantee modal unmount before driver.js mounts.

### Testing Pattern

- Mock `WelcomeModal` to provide deterministic Start/Skip buttons and verify modal unmount + tour calls.
- Use `vi.stubGlobal('fetch', ...)` and `vi.stubGlobal('requestAnimationFrame', ...)` in `beforeEach` with `vi.unstubAllGlobals()` in `afterEach` to avoid leaking globals across suites.

---

## [F3] QA Findings (2026-02-24)

### Tour modal state management works correctly

- `GET /api/settings/public` returns `system.tours.{dashboardSeen,adminSeen}` correctly
- `PATCH /api/settings/tour-state` updates state correctly (requires auth cookie)
- WelcomeModal conditional rendering respects `dashboardSeen` flag perfectly
- ClientSettingsModal System tab "Restart Tour" button correctly sets `dashboardSeen=false` via API
- Skip Tour persists `dashboardSeen=true` correctly

### Browser auth is required for settings pages

- `/settings` route redirects to `/login` if no auth cookie
- Login fills password, submits, redirects to `/settings/general`
- The 401 errors from `auth/check` during tour startup are expected (auth check for different purpose)

### driver.js API — how steps are registered

- Steps MUST be passed via `driver({ steps: [...], ...options })` config object
- `drive()` method signature: `drive(startIndex = 0)` — integer index only
- `setSteps(steps)` is also available as alternative
- The `No steps to drive through` error = `s("steps")` is undefined in driver config

### Test environment note

- All 6 dashboard tour target IDs exist in DOM with proper dimensions
- All 6 admin tour nav IDs exist in DOM with proper dimensions
- The bug is purely in JS API usage, not DOM/rendering

---

## [2026-03-06] Plan Completion Reconciliation

### Status

All 96 tasks marked complete. The feature was fully implemented in a prior session (PR #24 merged as `d352c8f`) but plan checkboxes were never updated.

### Final State Verified

- **Backend**: 721 tests pass (72 suites) — includes schema, API, and controller tests
- **Frontend**: 532 tests pass (63 files) — includes hook, component, view, and integration tests
- **driver.js bug fixed**: `useTour.js` correctly passes `steps: filteredSteps` in constructor, calls `.drive()` without arguments
- **All deliverables confirmed present**:
  - `src/config/schemas.js` — `system.tours` schema ✓
  - `src/config/default.json` — `system.tours` defaults ✓
  - `src/routes/settings.js` + `src/controllers/settingsController.js` — `PATCH /tour-state` + public endpoint extended ✓
  - `client/src/hooks/useTour.js` ✓
  - `client/src/config/tourSteps.js` ✓
  - `client/src/styles/tour.css` ✓
  - `client/src/components/common/WelcomeModal.jsx` ✓
  - DOM IDs: FocusCard, PrayerCard, TopControls (×4), SettingsLayout nav (×6) ✓
  - Restart buttons: ClientSettingsModal + SettingsLayout sidebar ✓
  - DashboardView integration + Admin tour in SettingsLayout ✓
