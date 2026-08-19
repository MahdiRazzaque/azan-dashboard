# Decisions — onboarding-tour

## [2026-02-24] Architecture Decisions

### Tour State Storage

- Backend: `system.tours.dashboardSeen` + `system.tours.adminSeen` booleans in config
- Dedicated `PATCH /api/settings/tour-state` endpoint (bypasses workflow pipeline)
- Public endpoint extended to expose `system.tours` (not full system object)

### Modal Strategy

- WelcomeModal: Native React component (NOT driver.js) — REQ-010
- Admin tour: Auto-starts on first `/settings` visit (no modal)
- Dashboard tour: Triggered by WelcomeModal "Start Tour" button

### driver.js Integration

- Dynamic import to keep out of main bundle
- `useRef` for driver instance (React 18 Strict Mode compatibility)
- `overlayClickBehavior: 'nextStep'` for click advancement
- Custom `keydown` capture listener for Spacebar (driver.js doesn't handle natively)

### Modal→Tour Handoff

- `flushSync` + `requestAnimationFrame` for reliable sequencing
- Modal must fully unmount before driver.js positions overlays

## [2026-02-24] Task 8: Dashboard Welcome Modal

### State Source of Truth

- Modal visibility derives from `config.system.tours.dashboardSeen` and is re-evaluated after async config load.
- Dismissal path differs by action: start tour uses `flushSync` + rAF; skip tour patches state then hides modal and refreshes settings.
