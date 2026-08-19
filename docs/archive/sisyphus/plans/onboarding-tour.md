# Onboarding Tour Feature (driver.js)

## TL;DR

> **Quick Summary**: Implement a two-part onboarding tour (Dashboard + Admin) using driver.js, with a custom Welcome Modal, global event interception, backend state tracking, and manual restart capability.
>
> **Deliverables**:
>
> - Custom Welcome Modal component (native React)
> - Dashboard Tour (6 steps covering main UI elements)
> - Admin Tour (6 steps covering settings sidebar navigation)
> - Lightweight backend endpoint for tour state (`PATCH /api/settings/tour-state`)
> - Extended public API to expose tour state
> - DOM IDs on 12 target elements across 4 components
> - Restart buttons in ClientSettingsModal and SettingsLayout sidebar
> - Global Spacebar interceptor during active tours
> - TDD test suites (backend Vitest, frontend Vitest)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 (schema) → Task 3 (API) → Task 6 (tour hook) → Task 8 (Dashboard tour) → Task 10 (Admin tour) → Task 12 (E2E QA)

---

## Context

### Original Request

Implement the complete onboarding/tour feature as specified in `PRD.md` — a two-segment contextual onboarding experience using `driver.js` to orient new users through the Dashboard UI and Admin settings panel.

### Interview Summary

**Key Discussions**:

- **Test Strategy**: User chose TDD (RED-GREEN-REFACTOR) — tests written before implementation
- **driver.js**: Confirmed as the tour rendering library (v1.x, modern API)
- **No existing DOM IDs**: Clean slate for all `#tour-*` IDs
- **Modal pattern**: Follow existing `ConfirmModal.jsx` pattern (fixed inset-0, z-50, backdrop, card)

**Research Findings**:

- **driver.js v1.x API**: Uses `driver()` factory, `.drive(steps)` to start, `.destroy()` to cleanup. `overlayClickBehavior: 'nextStep'` handles click-to-advance natively.
- **driver.js limitations**: Does NOT handle Spacebar natively (needs custom `keydown` listener). Does NOT skip missing elements — renders dummy div at screen center (must pre-filter steps). `destroy()` can throw DOMException on route change (GitHub #572 — guard with `isActive()` + try/catch).
- **React 18 Strict Mode**: Double-mount requires `useRef` for driver instance (not `useState` or `useMemo`).
- **Workflow side-effects**: `POST /api/settings/update` triggers prayer refresh, audio sync, scheduler restart — overkill for a boolean flag.
- **Public API gap**: `GET /api/settings/public` returns only `location`, `prayers`, `sources`, `automation` — does NOT include `system.tours`.

### Metis Review

**Identified Gaps** (addressed):

- **Public API doesn't expose tour state**: RESOLVED — extend `getPublicSettings` to include `system.tours` in response
- **Workflow side-effects on tour save**: RESOLVED — create lightweight `PATCH /api/settings/tour-state` endpoint that directly updates config without triggering workflow pipeline
- **driver.js Spacebar gap**: RESOLVED — custom `keydown` capture listener for Space key only
- **Click interceptor conflict**: RESOLVED — use `overlayClickBehavior: 'nextStep'` (driver.js native), do NOT add custom click interceptor from PRD §5.3
- **Missing element handling**: RESOLVED — pre-filter steps array to remove elements not found in DOM
- **React 18 double-mount**: RESOLVED — use `useRef<Driver | null>(null)` for driver instance
- **Modal→driver handoff**: RESOLVED — use `flushSync` + `requestAnimationFrame` for reliable sequencing
- **JWT on restart failure**: RESOLVED — existing AuthContext handles 401 with redirect; show toast on other errors

---

## Work Objectives

### Core Objective

Add a structured, contextual onboarding experience to the Azan Dashboard that educates new users about the Dashboard UI and Admin settings through guided tours, with backend state tracking to ensure tours are shown only once per installation.

### Concrete Deliverables

- `client/src/components/common/WelcomeModal.jsx` — Custom welcome modal
- `client/src/hooks/useTour.js` — Tour hook with driver.js integration
- `client/src/config/tourSteps.js` — Tour step definitions (Dashboard + Admin)
- `client/src/styles/tour.css` — driver.js theme overrides (Zinc/Emerald dark mode)
- Updated `src/config/schemas.js` — `system.tours` schema field
- Updated `src/config/default.json` — `system.tours` defaults
- New `PATCH /api/settings/tour-state` endpoint
- Extended `GET /api/settings/public` response with `system.tours`
- DOM IDs on: FocusCard, PrayerCard, TopControls (4 buttons), SettingsLayout (6 nav items)
- "Restart Dashboard Tour" button in ClientSettingsModal
- "Restart Admin Tour" button at bottom of SettingsLayout sidebar
- Test files for all new code (TDD)

### Definition of Done

- [x] `bun test` / `npm run test:client` — all tests pass (0 failures)
- [x] `npm run test:src` — all backend tests pass
- [x] Fresh install shows Welcome Modal → Dashboard Tour → marks `dashboardSeen: true`
- [x] First `/settings` visit shows Admin Tour → marks `adminSeen: true`
- [x] Spacebar advances tour without scrolling
- [x] Clicking during tour advances step without triggering underlying UI
- [x] Restart buttons reset tour state and re-trigger tours
- [x] Existing installations upgrading get tours (defaults to `false`)

### Must Have

- Two distinct tours (Dashboard and Admin) per REQ-001
- driver.js library for rendering per REQ-002
- Spacebar + click-anywhere advancement per REQ-003
- Click interception blocking highlighted elements per REQ-004
- Backend state tracking (`system.tours.dashboardSeen`, `system.tours.adminSeen`) per REQ-005
- Manual restart from ClientSettingsModal and Settings sidebar per REQ-006
- Admin Tour highlights top-level sidebar sections only per REQ-007
- Spacebar scroll prevention per REQ-008
- Stable DOM IDs on target elements per REQ-009
- Custom Welcome Modal (native React, not driver.js) per REQ-010

### Must NOT Have (Guardrails)

- **NO custom click interceptor** — driver.js `overlayClickBehavior: 'nextStep'` handles this natively. Adding a capture-phase click listener CONFLICTS with driver.js overlay. PRD §5.3 click interceptor guidance is superseded by driver.js built-in behavior.
- **NO `useState`/`useMemo` for driver instance** — React 18 Strict Mode double-mount causes stale references. Use `useRef` only.
- **NO calling `destroy()` without guard** — Always check `isActive()` first, wrap in try/catch (GitHub #572).
- **NO using existing `POST /api/settings/update` for tour state** — Triggers full workflow pipeline (prayer refresh, audio sync, scheduler restart). Use dedicated lightweight endpoint.
- **NO excessive comments or JSDoc on every function** — Follow existing codebase style (minimal comments, self-documenting code).
- **NO abstracting tour logic into generic "walkthrough framework"** — Keep it simple and specific to this feature.
- **NO mobile-specific tour variants** — Out of scope per PRD scope.
- **NO analytics/telemetry for tour completion** — Out of scope.
- **NO shadcn/ui components** — Project uses custom components only.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES
- **Automated tests**: TDD (RED-GREEN-REFACTOR)
- **Backend framework**: Jest (`npm run test:src`)
- **Frontend framework**: Vitest (`npm run test:client`)
- **TDD workflow**: Each task writes failing tests FIRST, then implements to make them pass, then refactors

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **Backend/API**: Use Bash (curl) — Send requests, assert status + response fields
- **Schema/Config**: Use Bash (node REPL or test runner) — Import, validate, compare output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation, zero dependencies):
├── Task 1: Backend schema + defaults (system.tours) [quick]
├── Task 2: Install driver.js + CSS theme file [quick]
├── Task 4: DOM IDs on Dashboard components [quick]
├── Task 5: DOM IDs on Settings components [quick]
└── Task 7: Tour step definitions file [quick]

Wave 2 (After Wave 1 — API + core hook):
├── Task 3: Backend API endpoints (tour-state + extend public) [unspecified-high]
├── Task 6: useTour hook (driver.js integration) [deep]
└── Task 9: WelcomeModal component [visual-engineering]

Wave 3 (After Wave 2 — tour integration + restart):
├── Task 8: Dashboard Tour integration (App.jsx + WelcomeModal flow) [deep]
├── Task 10: Admin Tour integration (SettingsLayout) [deep]
└── Task 11: Restart tour buttons (ClientSettingsModal + SettingsLayout) [quick]

Wave 4 (After Wave 3 — verification):
└── Task 12: E2E integration QA [unspecified-high]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 3 → Task 6 → Task 8 → Task 10 → Task 12 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 5 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks       | Wave |
| ---- | ---------- | ------------ | ---- |
| 1    | —          | 3, 6         | 1    |
| 2    | —          | 6, 7         | 1    |
| 4    | —          | 8            | 1    |
| 5    | —          | 10           | 1    |
| 7    | 2          | 6, 8, 10     | 1    |
| 3    | 1          | 6, 8, 10, 11 | 2    |
| 6    | 1, 2, 3, 7 | 8, 9, 10     | 2    |
| 9    | 6          | 8            | 2    |
| 8    | 4, 6, 7, 9 | 12           | 3    |
| 10   | 5, 6, 7, 3 | 12           | 3    |
| 11   | 3, 8, 10   | 12           | 3    |
| 12   | 8, 10, 11  | F1-F4        | 4    |

### Agent Dispatch Summary

| Wave  | Count | Tasks                                                                        |
| ----- | ----- | ---------------------------------------------------------------------------- |
| 1     | 5     | T1 → `quick`, T2 → `quick`, T4 → `quick`, T5 → `quick`, T7 → `quick`         |
| 2     | 3     | T3 → `unspecified-high`, T6 → `deep`, T9 → `visual-engineering`              |
| 3     | 3     | T8 → `deep`, T10 → `deep`, T11 → `quick`                                     |
| 4     | 1     | T12 → `unspecified-high`                                                     |
| FINAL | 4     | F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep` |

---

## TODOs

- [x] 1. Backend Schema + Defaults for `system.tours`

  **What to do**:
  - RED: Write failing tests FIRST in `src/tests/unit/config/` that assert:
    - `systemSchema` parses `{ tours: { dashboardSeen: false, adminSeen: false } }` successfully
    - `systemSchema` defaults `tours` to `{ dashboardSeen: false, adminSeen: false }` when field is missing (upgrade path)
    - `systemSchema` rejects invalid types (e.g., `tours: "string"`, `tours: { dashboardSeen: 42 }`)
    - Full `configSchema` integration: verify `system.tours` accessible from root config parse
  - GREEN: Add `tours` field to `systemSchema` in `src/config/schemas.js`:
    ```javascript
    tours: z.object({
      dashboardSeen: z.boolean().default(false),
      adminSeen: z.boolean().default(false),
    }).default({ dashboardSeen: false, adminSeen: false });
    ```
  - GREEN: Add `system.tours` defaults to `src/config/default.json`:
    ```json
    "system": {
      "healthChecks": { "api": true, "tts": true },
      "tours": { "dashboardSeen": false, "adminSeen": false }
    }
    ```
  - REFACTOR: Ensure schema `.default()` chain matches the explicit defaults in `default.json`

  **Must NOT do**:
  - Do NOT modify `configurationWorkflowService.js` or any workflow pipeline code
  - Do NOT add tour-related API endpoints (that's Task 3)
  - Do NOT touch frontend code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file schema addition + config update. Straightforward Zod pattern matching existing code.
  - **Skills**: `[]`
    - No special skills needed — standard file editing and test running
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser interaction needed for backend schema work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 4, 5, 7)
  - **Blocks**: Task 3 (API endpoints need schema), Task 6 (hook needs tour state shape)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/config/schemas.js:71-81` — Current `systemSchema` definition. Add `tours` field inside the `z.object({})` at line 71, after the `healthChecks` field (line 75). Note the `.default({})` at line 76 — the new `tours` field must also appear in the default object.
  - `src/config/schemas.js:66-69` — `dataSchema` pattern showing how simple `z.object` with `.default()` works.

  **API/Type References**:
  - `src/config/default.json:82-87` — Current `system` block. Add `tours` key as sibling to `healthChecks`.

  **Test References**:
  - `src/tests/unit/config/` — Existing backend config test directory. Follow file naming and describe/it patterns from existing tests here.

  **External References**:
  - Zod docs: `z.object().default()` — nested defaults with `.default({})` are required at both field and object level to handle missing data on upgrade.

  **Acceptance Criteria**:
  - [x] Test file created: `src/tests/unit/config/toursSchema.test.js`
  - [x] `npm run test:src` → PASS (all existing + new schema tests, 0 failures)
  - [x] `systemSchema.parse({})` returns `{ healthChecks: { api: true, tts: true }, tours: { dashboardSeen: false, adminSeen: false } }`

  **QA Scenarios:**

  ```
  Scenario: Schema validates and defaults tour state on fresh install
    Tool: Bash (node REPL)
    Preconditions: Schema file updated with tours field
    Steps:
      1. Run: node -e "const {systemSchema} = require('./src/config/schemas'); console.log(JSON.stringify(systemSchema.parse({})))"
      2. Assert output contains: {"healthChecks":{"api":true,"tts":true},"tours":{"dashboardSeen":false,"adminSeen":false}}
      3. Run: node -e "const {systemSchema} = require('./src/config/schemas'); console.log(JSON.stringify(systemSchema.parse({tours:{dashboardSeen:true}})))"
      4. Assert output contains: "dashboardSeen":true,"adminSeen":false
    Expected Result: Both commands produce correct JSON output with defaults applied
    Failure Indicators: Parse error, missing tours field, wrong default values
    Evidence: .sisyphus/evidence/task-1-schema-defaults.txt

  Scenario: Schema rejects invalid tour state types
    Tool: Bash (node REPL)
    Preconditions: Schema file updated
    Steps:
      1. Run: node -e "const {systemSchema} = require('./src/config/schemas'); try { systemSchema.parse({tours:'invalid'}); console.log('FAIL: no error') } catch(e) { console.log('PASS: ' + e.message) }"
      2. Assert output starts with "PASS:"
    Expected Result: Zod throws validation error for non-object tours value
    Failure Indicators: Output starts with "FAIL:" or parse succeeds silently
    Evidence: .sisyphus/evidence/task-1-schema-validation-error.txt
  ```

  **Commit**: YES
  - Message: `feat(config): add system.tours schema and defaults`
  - Files: `src/config/schemas.js`, `src/config/default.json`, `src/tests/unit/config/toursSchema.test.js`
  - Pre-commit: `npm run test:src`

- [x] 2. Install driver.js + Create Tour CSS Theme

  **What to do**:
  - Install `driver.js` as a dependency in the client package:
    ```bash
    cd client && npm install driver.js
    ```
  - Create `client/src/styles/tour.css` with driver.js theme overrides matching the app's Zinc/Emerald dark mode palette:
    - Override `.driver-popover` background to Zinc-800 (`#27272a`), border to Zinc-700 (`#3f3f46`)
    - Override `.driver-popover-title` color to Emerald-400 (`#34d399`)
    - Override `.driver-popover-description` color to Zinc-200 (`#e4e4e7`)
    - Override `.driver-popover-progress-text` color to Zinc-400 (`#a1a1aa`)
    - Override `.driver-popover-navigation-btns .driver-popover-next-btn` to Emerald-600 bg (`#059669`)
    - Override `.driver-overlay` opacity to match app's existing overlay style
    - Import the base driver.js CSS: `@import 'driver.js/dist/driver.css';`
  - No tests needed for CSS-only task, but verify the import resolves

  **Must NOT do**:
  - Do NOT import the CSS file into any component yet (that's Task 6)
  - Do NOT configure driver.js instances (that's Task 6)
  - Do NOT add driver.js to the backend package.json (client-only dependency)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single npm install + CSS file creation. No logic.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: CSS overrides are prescribed by PRD color palette, no design decisions needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 4, 5, 7)
  - **Blocks**: Task 6 (hook imports driver.js), Task 7 (step definitions reference driver.js types)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `client/src/main.jsx` — Shows how CSS imports are done in the app (top-level imports)
  - `client/src/styles/` — Check if this directory exists; if not, create it. Look at existing CSS import patterns.

  **External References**:
  - driver.js CSS customization: The library exposes `.driver-popover`, `.driver-popover-title`, `.driver-popover-description`, `.driver-popover-footer`, `.driver-overlay` CSS classes. Base CSS must be imported from `driver.js/dist/driver.css`.
  - PRD §7 (line 146): "The tooltips must possess sufficient contrast (matching the existing Zinc/Emerald dark mode palette)."

  **Acceptance Criteria**:
  - [x] `driver.js` listed in `client/package.json` dependencies
  - [x] `client/src/styles/tour.css` exists with theme overrides
  - [x] `@import 'driver.js/dist/driver.css'` resolves without error during Vite build

  **QA Scenarios:**

  ```
  Scenario: driver.js package installed and CSS file created
    Tool: Bash
    Preconditions: Client package.json updated
    Steps:
      1. Run: cat client/package.json | grep 'driver.js'
      2. Assert output contains a version string (e.g., "^1.")
      3. Run: test -f client/src/styles/tour.css && echo 'EXISTS' || echo 'MISSING'
      4. Assert output is 'EXISTS'
      5. Run: grep '@import' client/src/styles/tour.css
      6. Assert output contains "driver.js/dist/driver.css"
    Expected Result: Package installed, CSS file exists with driver.js base import
    Failure Indicators: Package not in dependencies, CSS file missing, import missing
    Evidence: .sisyphus/evidence/task-2-driver-install.txt

  Scenario: Vite resolves driver.js CSS import
    Tool: Bash
    Preconditions: driver.js installed, tour.css created
    Steps:
      1. Run: cd client && npx vite build --mode development 2>&1 | tail -20
      2. Assert exit code 0 (no CSS resolution errors)
    Expected Result: Build completes without CSS import errors
    Failure Indicators: "Could not resolve" or "Module not found" errors referencing driver.js
    Evidence: .sisyphus/evidence/task-2-vite-build.txt
  ```

  **Commit**: YES (groups with T4, T5)
  - Message: `chore(deps): install driver.js and add tour CSS theme`
  - Files: `client/package.json`, `client/package-lock.json`, `client/src/styles/tour.css`
  - Pre-commit: `npm run test:client`

- [x] 3. Backend API: Tour State Endpoint + Extend Public Settings

  **What to do**:
  - RED: Write failing tests FIRST:
    - Test `PATCH /api/settings/tour-state` with body `{ dashboardSeen: true }` → 200, config updated
    - Test `PATCH /api/settings/tour-state` with body `{ adminSeen: true }` → 200, config updated
    - Test `PATCH /api/settings/tour-state` rejects invalid body (e.g., `{ dashboardSeen: "yes" }`) → 400
    - Test `PATCH /api/settings/tour-state` without auth token → 401
    - Test `GET /api/settings/public` response includes `system.tours` object
    - Test `GET /api/settings/public` does NOT include sensitive system fields (only `tours`)
  - GREEN: Implement `PATCH /api/settings/tour-state` controller method:
    - Validate request body: accept only `{ dashboardSeen?: boolean, adminSeen?: boolean }`
    - Use `configService.update()` to directly merge `{ system: { tours: body } }` — bypass `workflowService.executeUpdate()`
    - This avoids triggering prayer refresh, audio sync, and scheduler restart
    - Protected by `authenticateToken` middleware (same as other settings routes)
  - GREEN: Extend `getPublicSettings` to include tour state:
    - Add `system: { tours: fullConfig.system?.tours }` to the response object in `settingsController.js:110-115`
    - Only expose `tours` sub-field, NOT the full `system` object (don't leak healthChecks to public)
  - GREEN: Add route in `src/routes/settings.js`:
    - `router.patch('/tour-state', authenticateToken, asyncHandler(settingsController.updateTourState));`
  - REFACTOR: Ensure error responses match existing API patterns

  **Must NOT do**:
  - Do NOT use `workflowService.executeUpdate()` — it triggers unnecessary side-effects (prayer refresh, audio sync, scheduler restart)
  - Do NOT expose full `system` object in public settings — only `system.tours`
  - Do NOT modify the existing `updateSettings` controller or workflow service
  - Do NOT add rate limiting beyond what already exists

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple file changes (controller + routes + tests), API design decisions, needs careful integration with existing config service.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser needed for backend API work

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1)
  - **Parallel Group**: Wave 2 (with Tasks 6, 9)
  - **Blocks**: Tasks 6, 8, 10, 11 (all need API to read/write tour state)
  - **Blocked By**: Task 1 (schema must exist before API can validate)

  **References**:

  **Pattern References**:
  - `src/controllers/settingsController.js:90-116` — `getPublicSettings` method. The response object at lines 110-115 needs `system: { tours: fullConfig.system?.tours }` added. Follow the exact pattern of how `automation` is deep-cloned and sanitized.
  - `src/controllers/settingsController.js:125-134` — `updateSettings` method. Do NOT follow this pattern — it delegates to `workflowService` which triggers side-effects. Instead, call `configService.update()` directly (see ConfigService reference below).
  - `src/routes/settings.js:12-21` — Existing route definitions. Add new `router.patch('/tour-state', ...)` line. Note all mutation routes use `authenticateToken` middleware.

  **API/Type References**:
  - `src/config/ConfigService.js` — `configService.update(newConfig)` method. This is the low-level config merge + save that `workflowService` wraps. Calling it directly saves config without triggering prayer/audio/scheduler side-effects. Find the `update` method and understand its merge strategy (deep merge vs replace).
  - `src/middleware/auth.js` — `authenticateToken` middleware. Used to protect the new endpoint. Already imported in `settings.js`.

  **Test References**:
  - `src/tests/unit/` — Find existing controller or route tests to match test patterns (describe structure, supertest usage, mock patterns).

  **External References**:
  - Express PATCH semantics: PATCH applies partial modifications. Body contains only the fields to update (`{ dashboardSeen: true }`).

  **Acceptance Criteria**:
  - [x] Test file created for tour-state endpoint
  - [x] `npm run test:src` → PASS (all existing + new API tests, 0 failures)
  - [x] `PATCH /api/settings/tour-state` with `{ dashboardSeen: true }` → 200, persisted
  - [x] `GET /api/settings/public` → response includes `system.tours`
  - [x] `PATCH /api/settings/tour-state` does NOT trigger scheduler restart or audio sync

  **QA Scenarios:**

  ```
  Scenario: Tour state endpoint updates config without side-effects
    Tool: Bash (curl)
    Preconditions: Server running on localhost:3000, valid JWT token available
    Steps:
      1. Get JWT: curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"password":"test"}' -c cookies.txt
      2. Read initial state: curl -s http://localhost:3000/api/settings/public | jq '.system.tours'
      3. Assert: dashboardSeen is false, adminSeen is false
      4. Update: curl -s -X PATCH http://localhost:3000/api/settings/tour-state -H 'Content-Type: application/json' -b cookies.txt -d '{"dashboardSeen": true}'
      5. Assert: HTTP 200
      6. Verify: curl -s http://localhost:3000/api/settings/public | jq '.system.tours.dashboardSeen'
      7. Assert: true
    Expected Result: Tour state updated to dashboardSeen:true, no scheduler/audio logs in server output
    Failure Indicators: 401/500 error, state not persisted, server logs show "Refreshing Prayer Data" or "Generating Audio Assets"
    Evidence: .sisyphus/evidence/task-3-api-tour-state.txt

  Scenario: Tour state endpoint rejects unauthenticated requests
    Tool: Bash (curl)
    Preconditions: Server running
    Steps:
      1. Run: curl -s -o /dev/null -w '%{http_code}' -X PATCH http://localhost:3000/api/settings/tour-state -H 'Content-Type: application/json' -d '{"dashboardSeen": true}'
      2. Assert: HTTP 401
    Expected Result: Unauthenticated request rejected with 401
    Failure Indicators: Returns 200 or 500
    Evidence: .sisyphus/evidence/task-3-api-tour-state-unauth.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add tour-state endpoint and extend public settings`
  - Files: `src/routes/settings.js`, `src/controllers/settingsController.js`, test files
  - Pre-commit: `npm run test:src`

- [x] 4. DOM IDs on Dashboard Components (FocusCard, PrayerCard, TopControls)

  **What to do**:
  - RED: Write failing tests FIRST:
    - Test `FocusCard` renders with `id="tour-focus-card"` on its root element
    - Test `PrayerCard` renders with `id="tour-prayer-card"` on its root element
    - Test `TopControls` renders elements with IDs: `tour-wake-lock`, `tour-mute-btn`, `tour-display-settings`, `tour-admin-settings`
  - GREEN: Add `id` prop to root element of each component:
    - `FocusCard.jsx`: Add `id="tour-focus-card"` to the outermost `<div>` (or `<section>`) element
    - `PrayerCard.jsx`: Add `id="tour-prayer-card"` to the outermost element
    - `TopControls.jsx`: Add `id="tour-wake-lock"` to the Wake Lock `<button>`, `id="tour-mute-btn"` to the Mute `<button>`, `id="tour-display-settings"` to the Display Settings `<button>`, `id="tour-admin-settings"` to the Admin Settings `<button>` (or wrapping `<Link>` element)
  - REFACTOR: Verify IDs don't conflict with any existing CSS selectors or test selectors

  **Must NOT do**:
  - Do NOT add IDs to conditionally rendered desktop-only elements — put IDs on parent containers (PRD §12.1)
  - Do NOT change any component behavior, styling, or structure — only add `id` attributes
  - Do NOT add IDs to Settings components (that's Task 5)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding `id` attributes to existing elements. Minimal change per file.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `react-doctor`: Overkill for adding id attributes — no logic changes

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 5, 7)
  - **Blocks**: Task 8 (Dashboard tour targets these IDs)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `client/src/components/dashboard/FocusCard.jsx` — Find the outermost JSX element (likely a `<div>` or `<section>` with Tailwind classes). Add `id="tour-focus-card"` as the first attribute.
  - `client/src/components/dashboard/PrayerCard.jsx` — Same pattern. Find outermost element, add `id="tour-prayer-card"`.
  - `client/src/components/layout/TopControls.jsx` — Contains 4 icon buttons. Each button needs its own `id`. Look for the wake lock button (likely references `wakeLock` state), mute button (references `muted` state), display settings (opens `ClientSettingsModal`), and admin settings (navigates to `/settings` or opens admin login).

  **Test References**:
  - `client/tests/unit/` — Check for existing component tests to follow patterns. If no FocusCard/PrayerCard tests exist, create minimal render tests.

  **Acceptance Criteria**:
  - [x] Test files created or updated for FocusCard, PrayerCard, TopControls
  - [x] `npm run test:client` → PASS
  - [x] `document.getElementById('tour-focus-card')` resolves in rendered DOM
  - [x] `document.getElementById('tour-prayer-card')` resolves in rendered DOM
  - [x] `document.getElementById('tour-wake-lock')` resolves in rendered DOM
  - [x] `document.getElementById('tour-mute-btn')` resolves in rendered DOM
  - [x] `document.getElementById('tour-display-settings')` resolves in rendered DOM
  - [x] `document.getElementById('tour-admin-settings')` resolves in rendered DOM

  **QA Scenarios:**

  ```
  Scenario: All 6 Dashboard tour target IDs present in DOM
    Tool: Playwright (playwright skill)
    Preconditions: App running on localhost:3000, dashboard loaded
    Steps:
      1. Navigate to http://localhost:3000
      2. Wait for page to fully load (wait for selector '#tour-focus-card', timeout: 10s)
      3. Assert: document.querySelector('#tour-focus-card') !== null
      4. Assert: document.querySelector('#tour-prayer-card') !== null
      5. Assert: document.querySelector('#tour-wake-lock') !== null
      6. Assert: document.querySelector('#tour-mute-btn') !== null
      7. Assert: document.querySelector('#tour-display-settings') !== null
      8. Assert: document.querySelector('#tour-admin-settings') !== null
      9. Take screenshot
    Expected Result: All 6 elements found in DOM with correct IDs
    Failure Indicators: Any querySelector returns null, page doesn't load
    Evidence: .sisyphus/evidence/task-4-dashboard-ids.png

  Scenario: IDs don't break existing component rendering
    Tool: Bash
    Preconditions: Tests updated
    Steps:
      1. Run: npm run test:client
      2. Assert: All tests pass (0 failures)
    Expected Result: No regressions from adding id attributes
    Failure Indicators: Any test fails that passed before
    Evidence: .sisyphus/evidence/task-4-test-results.txt
  ```

  **Commit**: YES (groups with T2, T5)
  - Message: `feat(ui): add stable DOM IDs for tour targets`
  - Files: `client/src/components/dashboard/FocusCard.jsx`, `client/src/components/dashboard/PrayerCard.jsx`, `client/src/components/layout/TopControls.jsx`, test files
  - Pre-commit: `npm run test:client`

- [x] 5. DOM IDs on Settings Components (SettingsLayout nav items)

  **What to do**:
  - RED: Write failing tests FIRST:
    - Test `SettingsLayout` renders nav items with IDs: `tour-nav-general`, `tour-nav-prayers`, `tour-nav-automation`, `tour-nav-files`, `tour-nav-credentials`, `tour-nav-developer`
  - GREEN: Add `id` attributes to each `NavLink` element in the `navItems` array rendering in `SettingsLayout.jsx`:
    - The `navItems` array is defined around line ~105. Each item is rendered as a `NavLink` (React Router). Add `id={`tour-nav-${item.slug}`}` or hardcode each ID.
    - IDs: `tour-nav-general`, `tour-nav-prayers`, `tour-nav-automation`, `tour-nav-files`, `tour-nav-credentials`, `tour-nav-developer`
  - REFACTOR: Verify IDs match exactly what PRD §3.1 Tour 2 step definitions expect

  **Must NOT do**:
  - Do NOT add the "Restart Admin Tour" button yet (that's Task 11)
  - Do NOT modify nav item behavior or routing
  - Do NOT add IDs to sub-tab elements inside settings pages

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding `id` attributes to existing nav items. Minimal change.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4, 7)
  - **Blocks**: Task 10 (Admin tour targets these IDs)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `client/src/components/layout/SettingsLayout.jsx:~105` — `navItems` array definition. Find where each nav item is rendered as a `<NavLink>` element. Add `id` attribute to the `<NavLink>` or its wrapping `<li>`/`<div>` — whichever is the clickable/visible element.
  - PRD §3.1 Tour 2 (lines 58-75) — Exact target IDs: `#tour-nav-general`, `#tour-nav-prayers`, `#tour-nav-automation`, `#tour-nav-files`, `#tour-nav-credentials`, `#tour-nav-developer`.

  **Test References**:
  - `client/tests/unit/` — Follow existing component test patterns.

  **Acceptance Criteria**:
  - [x] Test file created or updated for SettingsLayout
  - [x] `npm run test:client` → PASS
  - [x] All 6 nav item IDs present in rendered SettingsLayout DOM

  **QA Scenarios:**

  ```
  Scenario: All 6 Admin tour target IDs present in Settings sidebar
    Tool: Playwright (playwright skill)
    Preconditions: App running, user authenticated, navigated to /settings
    Steps:
      1. Navigate to http://localhost:3000/settings (with valid auth cookie)
      2. Wait for settings layout to load (wait for selector '#tour-nav-general', timeout: 10s)
      3. Assert: document.querySelector('#tour-nav-general') !== null
      4. Assert: document.querySelector('#tour-nav-prayers') !== null
      5. Assert: document.querySelector('#tour-nav-automation') !== null
      6. Assert: document.querySelector('#tour-nav-files') !== null
      7. Assert: document.querySelector('#tour-nav-credentials') !== null
      8. Assert: document.querySelector('#tour-nav-developer') !== null
      9. Take screenshot of settings sidebar
    Expected Result: All 6 nav elements found with correct IDs
    Failure Indicators: Any querySelector returns null, authentication redirect
    Evidence: .sisyphus/evidence/task-5-settings-ids.png

  Scenario: Nav items still function correctly with IDs added
    Tool: Playwright (playwright skill)
    Preconditions: Settings page loaded
    Steps:
      1. Click on element '#tour-nav-prayers'
      2. Assert: URL changes to /settings/prayers or prayers tab content loads
      3. Click on element '#tour-nav-general'
      4. Assert: URL changes to /settings/general or general tab content loads
    Expected Result: Navigation still works correctly after adding IDs
    Failure Indicators: Clicks don't navigate, console errors
    Evidence: .sisyphus/evidence/task-5-nav-still-works.png
  ```

  **Commit**: YES (groups with T2, T4)
  - Message: `feat(ui): add stable DOM IDs for tour targets`
  - Files: `client/src/components/layout/SettingsLayout.jsx`, test files
  - Pre-commit: `npm run test:client`

- [x] 6. `useTour` Hook — Core driver.js Integration

  **What to do**:
  - RED: Write failing tests FIRST in `client/tests/unit/hooks/useTour.test.js`:
    - Test hook initializes with `isActive: false`, `currentTour: null`
    - Test `startTour('dashboard', steps)` creates driver instance via `useRef`, calls `driver.drive(steps)`
    - Test `startTour` pre-filters steps array to remove entries whose `element` selector doesn't exist in DOM
    - Test `stopTour()` calls `driver.destroy()` only when `driver.isActive()` returns true
    - Test `stopTour()` does NOT throw when driver is null or already destroyed
    - Test Spacebar keydown listener is mounted when tour starts, unmounted when tour stops
    - Test Spacebar handler calls `e.preventDefault()` + `e.stopPropagation()` + `driver.moveNext()`
    - Test `onDestroyStarted` callback fires when tour completes (triggers state save)
    - Test hook cleans up driver instance and event listeners on unmount
  - GREEN: Create `client/src/hooks/useTour.js`:
    - Import driver.js dynamically: `const { driver } = await import('driver.js')`
    - Import tour CSS: `import '@/styles/tour.css'`
    - Create driver instance with `useRef(null)`
    - Configuration:
      ```javascript
      const driverInstance = driver({
        showProgress: true,
        animate: true,
        allowClose: false,
        overlayClickBehavior: "nextStep",
        stagePadding: 4,
        stageRadius: 8,
        onDestroyStarted: () => {
          /* callback for completion/skip */
        },
        popoverClass: "azan-tour-popover",
      });
      ```
    - `startTour(tourName, steps)` function:
      1. Pre-filter steps: `steps.filter(s => document.querySelector(s.element))`
      2. If no steps remain, call `onComplete` immediately
      3. Store filtered steps and `tourName` in state
      4. Call `driverRef.current.drive(filteredSteps)`
      5. Mount global `keydown` capture listener for `' '` (Space):
         ```javascript
         const handleKeyDown = (e) => {
           if (e.code === "Space" && driverRef.current?.isActive()) {
             e.preventDefault();
             e.stopPropagation();
             driverRef.current.moveNext();
           }
         };
         document.addEventListener("keydown", handleKeyDown, { capture: true });
         ```
    - `stopTour()` function:
      1. Check `driverRef.current?.isActive()` before calling `destroy()`
      2. Wrap `destroy()` in try/catch (GitHub #572 DOMException)
      3. Remove keydown listener
      4. Reset state
    - Cleanup on unmount: call `stopTour()` in `useEffect` return
    - Return: `{ startTour, stopTour, isActive, currentTour }`
  - REFACTOR: Ensure dynamic import is cached (only import once)

  **Must NOT do**:
  - Do NOT use `useState` or `useMemo` for the driver instance — React 18 Strict Mode causes double-mount issues. Use `useRef` only.
  - Do NOT add a custom click interceptor — `overlayClickBehavior: 'nextStep'` handles click advancement natively
  - Do NOT import driver.js statically — use dynamic `import()` to keep it out of the main bundle
  - Do NOT call `destroy()` without checking `isActive()` first
  - Do NOT save tour state from this hook — the hook fires a callback; the consuming component handles API calls

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex hook with dynamic imports, event listener lifecycle, React 18 ref management, error handling, and cleanup edge cases. Requires careful attention to driver.js API nuances.
  - **Skills**: `['react-doctor']`
    - `react-doctor`: Hook lifecycle management with useRef + useEffect cleanup is tricky; react-doctor catches stale ref and cleanup bugs.
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed for hook implementation (QA scenarios are separate)
    - `frontend-ui-ux`: No visual design work in a hook

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 1, 2, 3, 7)
  - **Parallel Group**: Wave 2 (with Tasks 3, 9)
  - **Blocks**: Tasks 8, 9, 10 (all tour integrations use this hook)
  - **Blocked By**: Task 1 (tour state shape), Task 2 (driver.js installed + CSS), Task 3 (API for state), Task 7 (step definitions)

  **References**:

  **Pattern References**:
  - `client/src/hooks/useSettings.js` — Existing custom hook pattern. Follow the same export style and naming convention.
  - `client/src/contexts/SettingsContext.jsx:41-61` — `fetchSettings` pattern showing how API calls are structured with `fetch()`, error handling, and credential inclusion.
  - `client/src/contexts/SettingsContext.jsx:173-282` — `saveSettings` pattern showing how config is sent to backend. The tour hook should NOT replicate this — it should use a simpler callback pattern.

  **API/Type References**:
  - `PATCH /api/settings/tour-state` (from Task 3) — Endpoint the consuming component will call when `onComplete` fires.
  - driver.js API: `driver({config})` creates instance, `.drive(steps)` starts tour, `.moveNext()` advances, `.isActive()` checks state, `.destroy()` cleans up.

  **External References**:
  - driver.js v1.x API: `import { driver } from 'driver.js'` — named export, not default.
  - driver.js GitHub #572 — `destroy()` can throw DOMException if DOM has changed. Always wrap in try/catch.
  - driver.js GitHub #504 — `destroy()` may not fully clean up in some edge cases. Check `isActive()` before calling.
  - React 18 Strict Mode: Components mount/unmount/remount in dev mode. `useRef` persists across this cycle; `useState`/`useMemo` can cause stale references.

  **Acceptance Criteria**:
  - [x] Test file created: `client/tests/unit/hooks/useTour.test.js`
  - [x] `npm run test:client` → PASS (all existing + new hook tests, 0 failures)
  - [x] Hook exports: `{ startTour, stopTour, isActive, currentTour }`
  - [x] driver.js is dynamically imported (not in main bundle)
  - [x] Spacebar advances tour and prevents scroll
  - [x] `destroy()` is guarded with `isActive()` + try/catch

  **QA Scenarios:**

  ```
  Scenario: Hook mounts and starts dashboard tour successfully
    Tool: Bash
    Preconditions: Tests written and hook implemented
    Steps:
      1. Run: npm run test:client -- --grep 'useTour'
      2. Assert: All useTour tests pass (0 failures)
      3. Check: grep -r 'import.*driver' client/src/hooks/useTour.js | grep 'import('
      4. Assert: Dynamic import pattern found (not static import)
    Expected Result: All tests pass, dynamic import confirmed
    Failure Indicators: Test failures, static import of driver.js found
    Evidence: .sisyphus/evidence/task-6-hook-tests.txt

  Scenario: Hook cleanup doesn't throw on unmount
    Tool: Bash
    Preconditions: Hook tests include unmount scenario
    Steps:
      1. Run: npm run test:client -- --grep 'cleanup\|unmount\|destroy'
      2. Assert: No unhandled errors or warnings about destroy
    Expected Result: Clean unmount without DOMException
    Failure Indicators: DOMException in test output, unhandled rejection
    Evidence: .sisyphus/evidence/task-6-hook-cleanup.txt
  ```

  **Commit**: YES (groups with T7)
  - Message: `feat(tour): add useTour hook and step definitions`
  - Files: `client/src/hooks/useTour.js`, `client/tests/unit/hooks/useTour.test.js`
  - Pre-commit: `npm run test:client`

- [x] 7. Tour Step Definitions File

  **What to do**:
  - Create `client/src/config/tourSteps.js` with two exported arrays:
  - `dashboardTourSteps` — 6 steps from PRD §3.1 Tour 1:
    ```javascript
    export const dashboardTourSteps = [
      {
        element: "#tour-focus-card",
        popover: {
          title: "Stay Focused",
          description:
            "View the current time and a clear, distraction-free countdown to the next upcoming prayer.",
        },
      },
      {
        element: "#tour-prayer-card",
        popover: {
          title: "Daily Schedule",
          description:
            "See today's complete schedule at a glance. Past prayers fade out, whilst the next prayer is clearly highlighted.",
        },
      },
      {
        element: "#tour-wake-lock",
        popover: {
          title: "Screen Wake Lock",
          description:
            "Prevent your device from going to sleep. This is perfect if you are using a tablet or TV as a dedicated wall display.",
        },
      },
      {
        element: "#tour-mute-btn",
        popover: {
          title: "Local Audio Control",
          description:
            "Mute or unmute the automated audio specifically for this device. This does not affect other screens or external speakers.",
        },
      },
      {
        element: "#tour-display-settings",
        popover: {
          title: "Client Settings",
          description:
            "Customise the visual theme, clock format, and set granular audio exclusion rules for this specific screen.",
        },
      },
      {
        element: "#tour-admin-settings",
        popover: {
          title: "System Administration",
          description:
            "Access the master configuration panel to manage schedules, integrations, and server-wide settings. (Requires the Admin password).",
        },
      },
    ];
    ```
  - `adminTourSteps` — 6 steps from PRD §3.1 Tour 2:
    ```javascript
    export const adminTourSteps = [
      {
        element: "#tour-nav-general",
        popover: {
          title: "General Configuration",
          description:
            "Set your geographic location and choose your primary and backup prayer time data sources (e.g., Aladhan or MyMasjid).",
        },
      },
      // ... (5 more steps as defined in PRD lines 61-75)
    ];
    ```
  - No tests needed for static data (pure constants), but a simple snapshot test is acceptable

  **Must NOT do**:
  - Do NOT add logic or conditions to step definitions — they are pure data
  - Do NOT add custom driver.js configuration in this file — that's in `useTour.js`
  - Do NOT deviate from PRD copy text — use exact titles and descriptions from PRD §3.1

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure data file creation. Copy-paste from PRD with correct structure.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4, 5)
  - **Blocks**: Task 6 (hook uses step definitions), Task 8, Task 10
  - **Blocked By**: Task 2 (driver.js must be installed to verify step shape matches API)

  **References**:

  **Pattern References**:
  - PRD §3.1 lines 36-53 (Tour 1 steps) — **USE EXACT COPY**. Titles and descriptions verbatim.
  - PRD §3.1 lines 58-75 (Tour 2 steps) — **USE EXACT COPY**. Titles and descriptions verbatim.

  **External References**:
  - driver.js step format: `{ element: '#selector', popover: { title: string, description: string } }`. The `element` key accepts any CSS selector.

  **Acceptance Criteria**:
  - [x] `client/src/config/tourSteps.js` exists
  - [x] `dashboardTourSteps` has exactly 6 entries matching PRD §3.1 Tour 1
  - [x] `adminTourSteps` has exactly 6 entries matching PRD §3.1 Tour 2
  - [x] All `element` selectors match the IDs defined in Tasks 4 and 5
  - [x] All title/description text matches PRD verbatim

  **QA Scenarios:**

  ```
  Scenario: Step definitions match PRD exactly
    Tool: Bash
    Preconditions: tourSteps.js created
    Steps:
      1. Run: grep -c 'element:' client/src/config/tourSteps.js
      2. Assert: output is 12 (6 dashboard + 6 admin steps)
      3. Run: grep 'Stay Focused' client/src/config/tourSteps.js
      4. Assert: Found (matches PRD Tour 1, Step 1 title)
      5. Run: grep 'General Configuration' client/src/config/tourSteps.js
      6. Assert: Found (matches PRD Tour 2, Step 1 title)
      7. Run: grep '#tour-focus-card' client/src/config/tourSteps.js
      8. Assert: Found (selector matches Task 4 ID)
    Expected Result: All 12 steps present with correct titles and selectors
    Failure Indicators: Wrong count, missing titles, mismatched selectors
    Evidence: .sisyphus/evidence/task-7-step-definitions.txt

  Scenario: Step selectors reference valid DOM IDs
    Tool: Bash
    Preconditions: tourSteps.js created
    Steps:
      1. Run: grep -oP "element: '#([^']+)'" client/src/config/tourSteps.js | sort
      2. Assert: Output lists exactly 12 selectors matching IDs from Tasks 4 and 5
    Expected Result: All selectors correspond to real DOM IDs
    Failure Indicators: Selector typo or mismatch with component IDs
    Evidence: .sisyphus/evidence/task-7-selector-validation.txt
  ```

  **Commit**: YES (groups with T6)
  - Message: `feat(tour): add useTour hook and step definitions`
  - Files: `client/src/config/tourSteps.js`
  - Pre-commit: `npm run test:client`

- [x] 8. Dashboard Tour Integration (App.jsx + WelcomeModal Flow)

  **What to do**:
  - RED: Write failing tests FIRST:
    - Test: When `config.system.tours.dashboardSeen === false` and user is on dashboard, WelcomeModal renders
    - Test: When `config.system.tours.dashboardSeen === true`, WelcomeModal does NOT render
    - Test: Clicking "Start Tour" in WelcomeModal dismisses modal and starts dashboard tour via `useTour.startTour`
    - Test: Clicking "Skip Tour" in WelcomeModal dismisses modal and calls `PATCH /api/settings/tour-state` with `{ dashboardSeen: true }`
    - Test: On tour completion (`onDestroyStarted`), `PATCH /api/settings/tour-state` is called with `{ dashboardSeen: true }`
    - Test: Tour state is reflected immediately in UI (no second WelcomeModal on page refresh simulation)
  - GREEN: Wire the Dashboard Tour flow in `DashboardView.jsx` (or `App.jsx` at the dashboard route level):
    1. Read `config.system?.tours?.dashboardSeen` from `SettingsContext`
    2. If `dashboardSeen === false` (and config is loaded), render `<WelcomeModal>`
    3. WelcomeModal "Start Tour" handler:
       - Dismiss WelcomeModal (set local state)
       - Use `flushSync` to ensure modal unmount is committed to DOM
       - Use `requestAnimationFrame` to wait for DOM update
       - Call `startTour('dashboard', dashboardTourSteps)` from `useTour` hook
       - Pass `onComplete` callback that calls `PATCH /api/settings/tour-state` with `{ dashboardSeen: true }`
    4. WelcomeModal "Skip Tour" handler:
       - Call `PATCH /api/settings/tour-state` with `{ dashboardSeen: true }` directly
       - Dismiss WelcomeModal
    5. After successful API call, update local config state to reflect `dashboardSeen: true` (call `refresh()` from SettingsContext, or optimistically set state)
  - REFACTOR: Ensure no race conditions between modal dismiss and tour start

  **Must NOT do**:
  - Do NOT mount global click interceptor — driver.js `overlayClickBehavior: 'nextStep'` handles this
  - Do NOT render WelcomeModal AND driver.js tour simultaneously — modal must unmount BEFORE tour starts
  - Do NOT use `useState` for driver instance (use hook which uses `useRef` internally)
  - Do NOT hardcode tour steps inline — import from `tourSteps.js`
  - Do NOT block the entire app with the tour — only the dashboard view

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex orchestration of modal→tour handoff with `flushSync` + `requestAnimationFrame`. State management across SettingsContext + local state + API calls. Race condition avoidance.
  - **Skills**: `['react-doctor']`
    - `react-doctor`: Critical for catching stale state, missing deps in useEffect, and flushSync misuse.
  - **Skills Evaluated but Omitted**:
    - `playwright`: QA scenarios run separately; implementation focus is React integration
    - `frontend-ui-ux`: Visual design is handled by WelcomeModal (Task 9)

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 4, 6, 7, 9)
  - **Parallel Group**: Wave 3 (with Tasks 10, 11)
  - **Blocks**: Task 12 (E2E QA)
  - **Blocked By**: Task 4 (DOM IDs), Task 6 (useTour hook), Task 7 (step definitions), Task 9 (WelcomeModal component)

  **References**:

  **Pattern References**:
  - `client/src/views/DashboardView.jsx` — This is where the tour integration lives. Read the full component to understand its current structure and where to add the WelcomeModal rendering logic.
  - `client/src/contexts/SettingsContext.jsx:41-61` — `fetchSettings` and how `config` is populated. The dashboard reads from the unauthenticated `/api/settings/public` endpoint. After Task 3, this will include `system.tours`.
  - `client/src/contexts/SettingsContext.jsx:45` — `const endpoint = isAuthenticated ? '/api/settings' : '/api/settings/public'` — Critical: dashboard users may or may not be authenticated. The public endpoint (extended in Task 3) now includes `system.tours`.

  **API/Type References**:
  - `PATCH /api/settings/tour-state` (Task 3) — Call with `{ dashboardSeen: true }` on tour completion or skip.
  - `client/src/hooks/useTour.js` (Task 6) — `{ startTour, stopTour, isActive, currentTour }` hook API.
  - `client/src/config/tourSteps.js` (Task 7) — `import { dashboardTourSteps } from '@/config/tourSteps'`.
  - `client/src/components/common/WelcomeModal.jsx` (Task 9) — `<WelcomeModal onStartTour={fn} onSkip={fn} />` component API.

  **External References**:
  - React `flushSync`: `import { flushSync } from 'react-dom'` — Forces synchronous DOM update before tour starts. Without this, modal may still be in DOM when driver.js tries to position overlays.
  - `requestAnimationFrame`: Ensures browser has painted the DOM update before driver.js measures element positions.

  **Acceptance Criteria**:
  - [x] Test file created/updated for DashboardView tour integration
  - [x] `npm run test:client` → PASS
  - [x] WelcomeModal shows when `dashboardSeen === false`
  - [x] WelcomeModal does NOT show when `dashboardSeen === true`
  - [x] "Start Tour" triggers dashboard tour (6 steps)
  - [x] "Skip Tour" saves `dashboardSeen: true` and dismisses modal
  - [x] Tour completion saves `dashboardSeen: true`

  **QA Scenarios:**

  ```
  Scenario: Fresh install shows WelcomeModal and completes Dashboard Tour
    Tool: Playwright (playwright skill)
    Preconditions: Server running, config has system.tours.dashboardSeen = false
    Steps:
      1. Navigate to http://localhost:3000
      2. Wait for WelcomeModal to appear (wait for text 'Welcome to your Azan Dashboard' or similar, timeout: 10s)
      3. Assert: WelcomeModal is visible with 'Start Tour' and 'Skip Tour' buttons
      4. Click 'Start Tour' button
      5. Wait for driver.js overlay to appear (wait for selector '.driver-overlay', timeout: 5s)
      6. Assert: First tooltip visible with title 'Stay Focused'
      7. Press Spacebar key
      8. Assert: Tooltip advances to 'Daily Schedule'
      9. Press Spacebar 4 more times to complete tour
      10. Assert: Tour overlay disappears after final step
      11. Reload page
      12. Assert: WelcomeModal does NOT appear (dashboardSeen is now true)
      13. Take screenshot
    Expected Result: Full tour cycle completes, state persists across reload
    Failure Indicators: WelcomeModal doesn't show, tour doesn't start after modal, Spacebar scrolls instead of advancing, tour reappears after reload
    Evidence: .sisyphus/evidence/task-8-dashboard-tour-complete.png

  Scenario: Skip Tour saves state and doesn't show tour
    Tool: Playwright (playwright skill)
    Preconditions: Server running, config has system.tours.dashboardSeen = false (reset first)
    Steps:
      1. Reset tour state: curl -X PATCH http://localhost:3000/api/settings/tour-state -H 'Content-Type: application/json' -b cookies.txt -d '{"dashboardSeen": false}'
      2. Navigate to http://localhost:3000
      3. Wait for WelcomeModal
      4. Click 'Skip Tour' button
      5. Assert: WelcomeModal disappears
      6. Assert: No driver.js overlay appears (.driver-overlay should NOT exist)
      7. Reload page
      8. Assert: WelcomeModal does NOT appear
    Expected Result: Skip saves state, no tour shown, persists on reload
    Failure Indicators: Tour starts despite skip, modal reappears after reload
    Evidence: .sisyphus/evidence/task-8-dashboard-tour-skip.png
  ```

  **Commit**: YES (groups with T9)
  - Message: `feat(tour): integrate dashboard tour with welcome modal`
  - Files: `client/src/views/DashboardView.jsx`, test files
  - Pre-commit: `npm run test:client`

- [x] 9. WelcomeModal Component

  **What to do**:
  - RED: Write failing tests FIRST:
    - Test: WelcomeModal renders with title "Welcome to your Azan Dashboard"
    - Test: WelcomeModal has "Start Tour" and "Skip Tour" buttons
    - Test: Clicking "Start Tour" calls `onStartTour` prop
    - Test: Clicking "Skip Tour" calls `onSkip` prop
    - Test: Modal has focus trap (Tab key cycles within modal)
    - Test: Modal renders with fixed overlay, centered card (matches ConfirmModal pattern)
    - Test: Modal is keyboard accessible (Enter activates focused button)
  - GREEN: Create `client/src/components/common/WelcomeModal.jsx`:
    - Follow `ConfirmModal.jsx` pattern: fixed inset-0 z-50, backdrop blur, centered card
    - Content:
      - Title: "Welcome to your Azan Dashboard" (or similar welcoming text)
      - Brief description: "Take a quick tour to learn about the dashboard controls and features."
      - Two buttons: "Start Tour" (primary, Emerald) and "Skip Tour" (secondary, Zinc)
    - Props: `{ onStartTour: () => void, onSkip: () => void }`
    - Accessibility:
      - `role="dialog"` and `aria-modal="true"` on the modal container
      - Auto-focus on "Start Tour" button when modal opens
      - Focus trap: Tab/Shift+Tab cycles between the two buttons
      - `aria-labelledby` pointing to the title element
    - Styling: Match existing dark mode palette (Zinc-800 bg, Zinc-700 border, Emerald-500 primary button)
  - REFACTOR: Ensure modal unmounts cleanly without leftover DOM nodes

  **Must NOT do**:
  - Do NOT use driver.js for the welcome modal — must be native React (REQ-010)
  - Do NOT use any UI library (shadcn, radix, etc.) — project uses custom components only
  - Do NOT add tour logic to this component — it just fires callbacks
  - Do NOT add backdrop click-to-dismiss — user must explicitly choose Start or Skip

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Modal component with specific visual design requirements (dark mode palette, Zinc/Emerald colors, blur backdrop). Accessibility features (focus trap, ARIA).
  - **Skills**: `['react-doctor']`
    - `react-doctor`: Catches focus trap issues, ARIA attribute correctness, and portal/unmount bugs.
  - **Skills Evaluated but Omitted**:
    - `playwright`: Not needed for component creation (QA scenarios are in Task 8)
    - `frontend-ui-ux`: Prescribed design from PRD, no design decisions needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (only depends on Task 6 for interface contract)
  - **Parallel Group**: Wave 2 (with Tasks 3, 6)
  - **Blocks**: Task 8 (Dashboard tour uses WelcomeModal)
  - **Blocked By**: Task 6 (needs to know the useTour hook API for callback contract)

  **References**:

  **Pattern References**:
  - `client/src/components/common/ConfirmModal.jsx` — **PRIMARY REFERENCE**. Copy the exact modal structure: fixed inset-0, z-50, backdrop, card layout. Adapt content and buttons.
  - `client/src/components/common/SaveProcessModal.jsx` — Secondary reference for modal overlay patterns.
  - `client/src/components/settings/ClientSettingsModal.jsx` — Shows how larger modals are structured with multiple sections.

  **External References**:
  - WAI-ARIA Modal pattern: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
  - PRD REQ-010: "The initial Welcome prompt must be a native React component to match the application’s existing aesthetic"
  - PRD §7 line 146: "The custom Welcome Modal must be focus-trapped and usable via keyboard."

  **Acceptance Criteria**:
  - [x] `client/src/components/common/WelcomeModal.jsx` exists
  - [x] Test file created: `client/tests/unit/components/WelcomeModal.test.jsx`
  - [x] `npm run test:client` → PASS
  - [x] Modal has `role="dialog"` and `aria-modal="true"`
  - [x] Two buttons: "Start Tour" (primary) and "Skip Tour" (secondary)
  - [x] Focus trap works (Tab cycles between buttons)
  - [x] Visual style matches Zinc/Emerald dark mode palette

  **QA Scenarios:**

  ```
  Scenario: WelcomeModal renders with correct structure and accessibility
    Tool: Playwright (playwright skill)
    Preconditions: WelcomeModal rendered in test harness or in app (dashboardSeen = false)
    Steps:
      1. Navigate to http://localhost:3000 (with dashboardSeen = false)
      2. Wait for modal to appear (wait for selector '[role="dialog"]', timeout: 10s)
      3. Assert: Modal has `aria-modal="true"` attribute
      4. Assert: Text 'Welcome' appears in modal
      5. Assert: Button with text 'Start Tour' is visible and focusable
      6. Assert: Button with text 'Skip Tour' is visible
      7. Press Tab key
      8. Assert: Focus moves to the other button (focus trap)
      9. Take screenshot of modal
    Expected Result: Modal renders with correct ARIA attributes, both buttons, and focus trap
    Failure Indicators: Missing ARIA attributes, buttons not found, focus escapes modal
    Evidence: .sisyphus/evidence/task-9-welcome-modal.png

  Scenario: WelcomeModal buttons fire correct callbacks
    Tool: Bash
    Preconditions: Component tests written
    Steps:
      1. Run: npm run test:client -- --grep 'WelcomeModal'
      2. Assert: All WelcomeModal tests pass (0 failures)
    Expected Result: onStartTour and onSkip callbacks verified
    Failure Indicators: Callback tests fail
    Evidence: .sisyphus/evidence/task-9-welcome-modal-tests.txt
  ```

  **Commit**: YES (groups with T8)
  - Message: `feat(tour): integrate dashboard tour with welcome modal`
  - Files: `client/src/components/common/WelcomeModal.jsx`, `client/tests/unit/components/WelcomeModal.test.jsx`
  - Pre-commit: `npm run test:client`

- [x] 10. Admin Tour Integration (SettingsLayout)

  **What to do**:
  - RED: Write failing tests FIRST:
    - Test: When `config.system.tours.adminSeen === false` and user navigates to `/settings`, admin tour starts automatically
    - Test: When `config.system.tours.adminSeen === true`, no tour starts
    - Test: On admin tour completion, `PATCH /api/settings/tour-state` is called with `{ adminSeen: true }`
    - Test: Admin tour only starts ONCE per settings page visit (not on every re-render)
    - Test: Admin tour does NOT start if user is not authenticated
  - GREEN: Wire the Admin Tour flow in `SettingsLayout.jsx`:
    1. Import `useTour` hook and `adminTourSteps` from `tourSteps.js`
    2. Read `config.system?.tours?.adminSeen` from `SettingsContext`
    3. Use a `useRef(hasStartedTour)` to prevent re-triggering on re-renders
    4. In a `useEffect`, when `adminSeen === false` and `hasStartedTour.current === false`:
       - Set `hasStartedTour.current = true`
       - Use `requestAnimationFrame` to ensure nav items are rendered in DOM
       - Call `startTour('admin', adminTourSteps)` with `onComplete` callback
    5. `onComplete` callback: call `PATCH /api/settings/tour-state` with `{ adminSeen: true }` and refresh config
  - REFACTOR: Ensure tour doesn't interfere with settings navigation

  **Must NOT do**:
  - Do NOT force navigation between settings tabs during the tour — REQ-007 says highlight sidebar sections only
  - Do NOT show a welcome modal for the admin tour — it starts automatically (PRD §3.1 Tour 2)
  - Do NOT start admin tour if nav items aren't in DOM yet (pre-filter via useTour)
  - Do NOT trigger admin tour on every route change within `/settings/*` — only on first visit

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Integration with existing SettingsLayout, careful useEffect/useRef lifecycle management, avoiding re-trigger bugs.
  - **Skills**: `['react-doctor']`
    - `react-doctor`: useEffect dependency management and ref lifecycle are critical here.
  - **Skills Evaluated but Omitted**:
    - `playwright`: QA scenarios are E2E (Task 12), not part of this implementation task

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 8, 11 in Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 8, 11)
  - **Blocks**: Task 12 (E2E QA)
  - **Blocked By**: Task 5 (DOM IDs on nav items), Task 6 (useTour hook), Task 7 (step definitions), Task 3 (API endpoint)

  **References**:

  **Pattern References**:
  - `client/src/components/layout/SettingsLayout.jsx` — **PRIMARY**. Read the full component. Understand where navItems are rendered, how the sidebar is structured, and where to add the tour trigger useEffect.
  - `client/src/views/DashboardView.jsx` (as modified by Task 8) — Follow the same pattern for reading tour state and triggering the tour. But NOTE: no WelcomeModal for admin tour.

  **API/Type References**:
  - `client/src/hooks/useTour.js` (Task 6) — `{ startTour, stopTour, isActive }` hook API.
  - `client/src/config/tourSteps.js` (Task 7) — `import { adminTourSteps } from '@/config/tourSteps'`.
  - `PATCH /api/settings/tour-state` (Task 3) — Call with `{ adminSeen: true }` on completion.
  - `client/src/contexts/SettingsContext.jsx:26` — `isAuthenticated` from `useAuth()` — admin tour only triggers when authenticated.

  **Acceptance Criteria**:
  - [x] Test file created/updated for SettingsLayout tour integration
  - [x] `npm run test:client` → PASS
  - [x] First visit to `/settings` (with `adminSeen: false`) triggers admin tour
  - [x] Admin tour highlights 6 sidebar nav items in sequence
  - [x] Tour completion saves `adminSeen: true`
  - [x] Subsequent visits to `/settings` do NOT show tour

  **QA Scenarios:**

  ```
  Scenario: Admin tour triggers on first settings visit
    Tool: Playwright (playwright skill)
    Preconditions: Server running, user authenticated, config has system.tours.adminSeen = false
    Steps:
      1. Reset admin tour state: curl -X PATCH http://localhost:3000/api/settings/tour-state -H 'Content-Type: application/json' -b cookies.txt -d '{"adminSeen": false}'
      2. Navigate to http://localhost:3000/settings
      3. Wait for driver.js overlay (wait for selector '.driver-overlay', timeout: 10s)
      4. Assert: First tooltip visible with title 'General Configuration'
      5. Press Spacebar 5 times to complete all 6 steps
      6. Assert: Tour overlay disappears after final step
      7. Reload /settings page
      8. Assert: No driver.js overlay appears (.driver-overlay should NOT exist)
    Expected Result: Tour runs once, state persists
    Failure Indicators: Tour doesn't start, Spacebar doesn't advance, tour reappears on reload
    Evidence: .sisyphus/evidence/task-10-admin-tour.png

  Scenario: Admin tour doesn't re-trigger on internal settings navigation
    Tool: Playwright (playwright skill)
    Preconditions: adminSeen = false, user on /settings
    Steps:
      1. Navigate to /settings (tour starts)
      2. Complete the tour (6 Spacebar presses)
      3. Click on '#tour-nav-prayers' to navigate to prayers settings
      4. Click on '#tour-nav-general' to navigate back to general
      5. Assert: No driver.js overlay appears on any navigation
    Expected Result: Tour only fires once per visit, not on every sub-navigation
    Failure Indicators: Tour restarts when navigating between settings tabs
    Evidence: .sisyphus/evidence/task-10-admin-no-retrigger.png
  ```

  **Commit**: YES (groups with T11)
  - Message: `feat(tour): integrate admin tour and restart buttons`
  - Files: `client/src/components/layout/SettingsLayout.jsx`, test files
  - Pre-commit: `npm run test:client`

- [x] 11. Restart Tour Buttons (ClientSettingsModal + SettingsLayout)

  **What to do**:
  - RED: Write failing tests FIRST:
    - Test: ClientSettingsModal renders a "Restart Dashboard Tour" button
    - Test: Clicking "Restart Dashboard Tour" calls `PATCH /api/settings/tour-state` with `{ dashboardSeen: false }`
    - Test: After restart API call, navigating to dashboard triggers WelcomeModal
    - Test: SettingsLayout sidebar bottom renders a "Restart Admin Tour" button
    - Test: Clicking "Restart Admin Tour" calls `PATCH /api/settings/tour-state` with `{ adminSeen: false }`
    - Test: After restart API call, admin tour triggers on next settings page visit
    - Test: Buttons show loading state during API call
    - Test: Buttons show error toast on API failure
  - GREEN: Add restart buttons:
    1. **ClientSettingsModal** — Add "Restart Dashboard Tour" button:
       - Place in an appropriate tab or section (e.g., at the bottom of the first tab)
       - On click: `fetch('PATCH /api/settings/tour-state', { dashboardSeen: false })`
       - Show brief success indicator (text change or toast)
       - User will see WelcomeModal on next dashboard visit
    2. **SettingsLayout** — Add "Restart Admin Tour" button:
       - Place at the bottom of the sidebar, below the nav items (per PRD REQ-006)
       - On click: `fetch('PATCH /api/settings/tour-state', { adminSeen: false })`
       - Show brief success indicator
       - Navigate away and back to `/settings` to see tour again
  - REFACTOR: Ensure buttons are styled consistently with existing UI

  **Must NOT do**:
  - Do NOT immediately start the tour after clicking restart — just reset the flag. Tour triggers on next visit.
  - Do NOT add restart buttons anywhere other than ClientSettingsModal and SettingsLayout sidebar
  - Do NOT create a new API endpoint — use `PATCH /api/settings/tour-state` from Task 3

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding buttons to existing components with simple API calls. Follow existing patterns.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `react-doctor`: Simple button click handlers, no complex lifecycle
    - `frontend-ui-ux`: Button placement prescribed by PRD, no design decisions

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 8, 10 in Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 8, 10)
  - **Blocks**: Task 12 (E2E QA)
  - **Blocked By**: Task 3 (API endpoint), Task 8 (dashboard tour must exist to restart), Task 10 (admin tour must exist to restart)

  **References**:

  **Pattern References**:
  - `client/src/components/settings/ClientSettingsModal.jsx` — Read the full component to find the right place for the restart button. Look for existing button patterns and tab structure.
  - `client/src/components/layout/SettingsLayout.jsx` — Find the sidebar rendering code. The restart button goes at the bottom, after the nav items.
  - `client/src/contexts/SettingsContext.jsx:173-282` — `saveSettings` shows the fetch pattern for API calls with error handling. Use a simpler version for the restart call.

  **API/Type References**:
  - `PATCH /api/settings/tour-state` (Task 3) — Call with `{ dashboardSeen: false }` or `{ adminSeen: false }` to reset.

  **Acceptance Criteria**:
  - [x] "Restart Dashboard Tour" button exists in ClientSettingsModal
  - [x] "Restart Admin Tour" button exists at bottom of SettingsLayout sidebar
  - [x] Both buttons call correct API endpoint with correct payload
  - [x] `npm run test:client` → PASS

  **QA Scenarios:**

  ```
  Scenario: Restart Dashboard Tour resets state
    Tool: Playwright (playwright skill)
    Preconditions: Server running, user authenticated, dashboardSeen = true (tour already completed)
    Steps:
      1. Navigate to dashboard — confirm no WelcomeModal appears
      2. Open ClientSettingsModal (click '#tour-display-settings' button)
      3. Find and click 'Restart Dashboard Tour' button
      4. Close ClientSettingsModal
      5. Reload page
      6. Assert: WelcomeModal appears (dashboardSeen was reset to false)
    Expected Result: Tour state reset, WelcomeModal shows on next visit
    Failure Indicators: Button not found, API error, WelcomeModal doesn't reappear
    Evidence: .sisyphus/evidence/task-11-restart-dashboard.png

  Scenario: Restart Admin Tour resets state
    Tool: Playwright (playwright skill)
    Preconditions: User authenticated, adminSeen = true, on /settings page
    Steps:
      1. Navigate to /settings — confirm no tour starts
      2. Scroll sidebar down to find 'Restart Admin Tour' button
      3. Click 'Restart Admin Tour' button
      4. Navigate away to dashboard
      5. Navigate back to /settings
      6. Assert: Admin tour starts (driver.js overlay appears with 'General Configuration')
    Expected Result: Tour state reset, admin tour triggers on next settings visit
    Failure Indicators: Button not found, tour doesn't restart, API error
    Evidence: .sisyphus/evidence/task-11-restart-admin.png
  ```

  **Commit**: YES (groups with T10)
  - Message: `feat(tour): integrate admin tour and restart buttons`
  - Files: `client/src/components/settings/ClientSettingsModal.jsx`, `client/src/components/layout/SettingsLayout.jsx`, test files
  - Pre-commit: `npm run test:client`

- [x] 12. E2E Integration QA

  **What to do**:
  - Run comprehensive end-to-end QA covering all cross-task integration points:
    1. **Full fresh install flow**: Setup wizard → JWT issued → redirect to dashboard → WelcomeModal → Dashboard Tour → navigate to settings → Admin Tour
    2. **State persistence**: Verify `dashboardSeen` and `adminSeen` persist across page reloads, browser restarts
    3. **Spacebar behavior**: Verify Spacebar advances tour without scrolling page
    4. **Click interception**: Verify clicking on highlighted elements during tour does NOT trigger their actions (e.g., clicking Wake Lock during tour doesn't toggle it)
    5. **Restart flow**: Reset both tours via restart buttons, verify they re-trigger correctly
    6. **Edge cases**:
       - Resize window during tour (driver.js should reposition)
       - Navigate away mid-tour (driver.js should clean up without errors)
       - Rapidly click/press Spacebar (should not crash or skip multiple steps)
    7. **Backward compatibility**: Start with a config that has NO `system.tours` field (simulating upgrade), verify defaults apply and tours trigger
  - Capture evidence for each scenario

  **Must NOT do**:
  - Do NOT fix bugs found during QA in this task — report them and create fix tasks
  - Do NOT modify any source code — this is a QA-only task

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive QA requiring Playwright browser automation, curl API testing, and careful scenario execution.
  - **Skills**: `['playwright']`
    - `playwright`: Required for browser-based E2E testing of the full tour flow.
  - **Skills Evaluated but Omitted**:
    - `react-doctor`: No code changes in this task

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on all previous tasks)
  - **Parallel Group**: Wave 4 (sequential)
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Tasks 8, 10, 11

  **References**:

  **Pattern References**:
  - All QA scenarios from Tasks 4, 5, 8, 9, 10, 11 — Re-run these but in an integrated context
  - PRD §4 User Stories (lines 78-81) — Test each user story end-to-end:
    - Happy Path: Full tour completion
    - Alternative Path: Skip tour
    - Negative Path: Click interception
    - Edge Case: Subsequent devices

  **Acceptance Criteria**:
  - [x] All E2E scenarios executed and evidence captured
  - [x] Zero console errors during any tour execution
  - [x] State persistence verified across page reloads
  - [x] Click interception verified (no side-effects on highlighted elements)
  - [x] Spacebar advances without scrolling
  - [x] Restart buttons work correctly
  - [x] Backward compatibility verified (upgrade from config without tours field)

  **QA Scenarios:**

  ```
  Scenario: Full fresh install tour lifecycle
    Tool: Playwright (playwright skill)
    Preconditions: Server running with fresh config (no local.json, simulating first setup)
    Steps:
      1. Navigate to http://localhost:3000 — should redirect to setup
      2. Complete setup wizard (set password)
      3. After redirect to dashboard, wait for WelcomeModal (timeout: 10s)
      4. Click 'Start Tour'
      5. Complete Dashboard Tour (6 Spacebar presses)
      6. Assert: Tour completes, no overlay
      7. Click admin settings button ('#tour-admin-settings')
      8. Authenticate with admin password
      9. Wait for Admin Tour to start on /settings (timeout: 10s)
      10. Complete Admin Tour (6 Spacebar presses)
      11. Assert: Both tours complete
      12. Verify: curl http://localhost:3000/api/settings/public | jq '.system.tours'
      13. Assert: { dashboardSeen: true, adminSeen: true }
    Expected Result: Complete lifecycle from setup to both tours completed
    Failure Indicators: Any step fails, console errors, state not persisted
    Evidence: .sisyphus/evidence/task-12-full-lifecycle.png

  Scenario: Click interception during tour
    Tool: Playwright (playwright skill)
    Preconditions: Dashboard tour active, currently on Wake Lock step
    Steps:
      1. Start dashboard tour (reset state, navigate to dashboard, click Start Tour)
      2. Advance to step 3 (Wake Lock)
      3. Note current wake lock state (text/icon)
      4. Click on the highlighted Wake Lock button area
      5. Assert: Tour advances to step 4 (next step)
      6. Assert: Wake lock state has NOT changed (same text/icon as before click)
    Expected Result: Click advances tour without triggering wake lock toggle
    Failure Indicators: Wake lock toggles, tour doesn't advance, console error
    Evidence: .sisyphus/evidence/task-12-click-interception.png

  Scenario: Spacebar doesn't scroll during tour
    Tool: Playwright (playwright skill)
    Preconditions: Dashboard tour active on a page that can scroll
    Steps:
      1. Start dashboard tour
      2. Record current scrollY position: window.scrollY
      3. Press Spacebar
      4. Assert: window.scrollY is unchanged
      5. Assert: Tour advanced to next step
    Expected Result: Spacebar advances tour without scrolling viewport
    Failure Indicators: Page scrolls down, tour doesn't advance
    Evidence: .sisyphus/evidence/task-12-spacebar-no-scroll.png

  Scenario: Navigate away mid-tour doesn't cause errors
    Tool: Playwright (playwright skill)
    Preconditions: Dashboard tour active (mid-step)
    Steps:
      1. Start dashboard tour, advance to step 3
      2. Navigate to /settings via URL bar (bypassing tour)
      3. Assert: No console errors (especially no DOMException)
      4. Assert: No driver.js overlay lingering on /settings page
      5. Navigate back to dashboard
      6. Assert: WelcomeModal does NOT reappear (dashboardSeen state depends on whether onComplete fired — this is expected behavior documentation)
    Expected Result: Clean navigation without errors or zombie overlays
    Failure Indicators: DOMException in console, overlay stuck, page crash
    Evidence: .sisyphus/evidence/task-12-mid-tour-navigate.png

  Scenario: Backward compatibility — upgrade from config without tours
    Tool: Bash (curl) + Playwright
    Preconditions: Manually edit config to remove system.tours field
    Steps:
      1. Remove tours field from config: (edit local.json to remove system.tours)
      2. Restart server
      3. curl http://localhost:3000/api/settings/public | jq '.system.tours'
      4. Assert: { "dashboardSeen": false, "adminSeen": false } (Zod defaults applied)
      5. Navigate to dashboard in Playwright
      6. Assert: WelcomeModal appears
    Expected Result: Schema defaults kick in, tour triggers for upgraded installations
    Failure Indicators: Tours field missing from response, error on config load, no WelcomeModal
    Evidence: .sisyphus/evidence/task-12-backward-compat.txt
  ```

  **Commit**: NO (QA task, no code changes)

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [x] F1. **Plan Compliance Audit** — `oracle`
      Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
      Run `npx tsc --noEmit` (if applicable) + linter + `npm run test:client && npm run test:src`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
      Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
      Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
      For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
      Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Group   | Message                                                         | Files                                                                         | Pre-commit Check      |
| ------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------- |
| T1      | `feat(config): add system.tours schema and defaults`            | `src/config/schemas.js`, `src/config/default.json`, test files                | `npm run test:src`    |
| T2      | `chore(deps): install driver.js and add tour CSS theme`         | `client/package.json`, `client/src/styles/tour.css`                           | `npm run test:client` |
| T3      | `feat(api): add tour-state endpoint and extend public settings` | `src/routes/settings.js`, `src/controllers/settingsController.js`, test files | `npm run test:src`    |
| T4+T5   | `feat(ui): add stable DOM IDs for tour targets`                 | `FocusCard.jsx`, `PrayerCard.jsx`, `TopControls.jsx`, `SettingsLayout.jsx`    | `npm run test:client` |
| T6+T7   | `feat(tour): add useTour hook and step definitions`             | `client/src/hooks/useTour.js`, `client/src/config/tourSteps.js`, test files   | `npm run test:client` |
| T8+T9   | `feat(tour): integrate dashboard tour with welcome modal`       | `WelcomeModal.jsx`, `App.jsx` or `DashboardView.jsx`, test files              | `npm run test:client` |
| T10+T11 | `feat(tour): integrate admin tour and restart buttons`          | `SettingsLayout.jsx`, `ClientSettingsModal.jsx`, test files                   | `npm run test:client` |
| T12     | `test(tour): add E2E integration QA scenarios`                  | evidence files                                                                | all tests pass        |

---

## Success Criteria

### Verification Commands

```bash
npm run test:src          # Expected: all tests pass including new schema tests
npm run test:client       # Expected: all tests pass including new component/hook tests
curl -s http://localhost:3000/api/settings/public | jq '.system.tours'
                          # Expected: { "dashboardSeen": false, "adminSeen": false }
```

### Final Checklist

- [x] All 10 "Must Have" requirements (REQ-001 through REQ-010) implemented
- [x] All "Must NOT Have" guardrails verified absent
- [x] All backend tests pass (`npm run test:src`)
- [x] All frontend tests pass (`npm run test:client`)
- [x] Evidence files present in `.sisyphus/evidence/`
- [x] No console errors during tour execution
- [x] Tour state persists across page refreshes (backend-stored)
- [x] Existing installations get tours on upgrade (schema defaults to `false`)
