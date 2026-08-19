# Dashboard Date Navigation & Localisation

## TL;DR

Implement the `PRD.md` dashboard feature set with a test-first flow across the existing React + Express app.

- Extend `/api/prayers` to return a backward-compatible `calendar` payload for an initial 15-day window and directional 7-day chunks.
- Refactor the client prayer data hook to own `referenceDate`, `viewedDate`, cached calendar data, dynamic chunk loading, and midnight/inactivity rules.
- Update `PrayerCard`, `FocusCard`, `ClientSettingsModal`, and `ClientPreferencesContext` for navigation, localisation, and the 12h/24h fix.
- Verify with Jest, Vitest, lint, targeted diagnostics, build, and `react-doctor`.

## Context

The current dashboard is single-day only.

- `client/src/components/dashboard/PrayerCard.jsx` is static and hardcodes `h:mm` formatting.
- `client/src/components/dashboard/FocusCard.jsx` already follows physical time and must stay independent from date navigation.
- `client/src/hooks/usePrayerTimes.js` fetches only a single-day response from `/api/prayers`.
- `src/services/core/prayerTimeService.js` already stores annual prayer data keyed by `YYYY-MM-DD`, so the backend should slice windows from existing cache data instead of introducing a new persistence model.
- The Arabic prayer-name mapping already exists in `src/services/system/audioAssetService.js` and must be reused exactly.

## Objectives

1. Add zero-latency day navigation inside `PrayerCard` for the initial 15-day window.
2. Keep `FocusCard` locked to real current time and next prayer logic.
3. Add appearance preferences for date navigation and English/Arabic prayer names.
4. Fix `PrayerCard` time formatting to respect the 12h/24h preference everywhere.
5. Implement timezone-aware midnight crossover and 120-second inactivity reset.
6. Keep `/api/prayers` backward compatible by preserving root `prayers` and `nextPrayer`.

## Guardrails

- Follow TDD: write/extend Jest and Vitest tests before implementation changes.
- Do not install new dependencies.
- Do not break the current `/api/prayers` contract.
- Use `config.location.timezone` for midnight calculations, not the browser timezone.
- Use native touch events for swipe handling.
- Use CSS transitions based on `transform` and `opacity`, not layout properties.
- Deep-merge stored client preferences with new defaults so existing users receive new keys.

## Affected Files

### Backend

- `src/controllers/prayerController.js`
- `src/services/core/prayerTimeService.js`
- `src/tests/unit/controllers/prayerController.test.js`
- `src/tests/unit/services/prayerTimeService.test.js`
- `src/tests/integration/routes/api.test.js`

### Frontend

- `client/src/hooks/usePrayerTimes.js`
- `client/src/hooks/useMidnightObserver.js` (new)
- `client/src/utils/prayerNames.js` (new)
- `client/src/components/dashboard/PrayerCard.jsx`
- `client/src/components/dashboard/FocusCard.jsx`
- `client/src/components/settings/ClientSettingsModal.jsx`
- `client/src/contexts/ClientPreferencesContext.jsx`
- `client/src/views/DashboardView.jsx`
- `client/tests/unit/hooks/usePrayerTimes.test.js`
- `client/tests/unit/hooks/useMidnightObserver.test.js` (new)
- `client/tests/unit/components/dashboard/PrayerCard.test.jsx`
- `client/tests/unit/components/dashboard/FocusCard.test.jsx`
- `client/tests/unit/components/settings/ClientSettingsModal.test.jsx`
- `client/tests/unit/contexts/ClientPreferencesContext.test.jsx`
- `client/tests/unit/views/DashboardView.test.jsx`

## Execution Plan

### Phase 1 - Backend Tests and API Shape

Write failing Jest tests first for:

- default `/api/prayers` returning `prayers`, `nextPrayer`, and a 15-day `calendar`
- `cursorDate` + `direction` query handling for future and past chunks
- invalid query handling with `400`
- boundary behavior where a directional chunk returns an empty `calendar`

Then implement:

- query validation in `src/controllers/prayerController.js`
- a backend helper in `src/services/core/prayerTimeService.js` that returns processed prayer data for a requested date window
- an initial window of `today - 7` through `today + 7`
- directional chunk windows of 7 days beyond the provided cursor
- a backward-compatible response shape keeping root `prayers` and `nextPrayer`

### Phase 2 - Client Preferences and Shared Utilities

Write failing Vitest tests first for:

- new appearance defaults: `enableDateNavigation: true` and `prayerNameLanguage: 'english'`
- deep merge of stored preferences with defaults
- settings modal controls for navigation and language preference

Then implement:

- deep-merge load logic in `client/src/contexts/ClientPreferencesContext.jsx`
- new appearance settings in the same context
- Arabic/English label support in `client/src/components/settings/ClientSettingsModal.jsx`
- shared frontend prayer-name mapping in `client/src/utils/prayerNames.js`

### Phase 3 - Time Hooks and Client Data Model

Write failing Vitest tests first for:

- `useMidnightObserver` midnight rollover behavior using a supplied timezone
- `usePrayerTimes` initial calendar hydration, directional chunk fetches, merge behavior, AbortController cancellation, and viewed-date updates

Then implement:

- `client/src/hooks/useMidnightObserver.js` to maintain a timezone-aware `referenceDate`
- `client/src/hooks/usePrayerTimes.js` to track:
  - `referenceDate`
  - `viewedDate`
  - calendar cache
  - navigation direction / fetch state / directional boundaries
  - inactivity timer reset to `referenceDate`
- chunk fetching with `AbortController`
- pruning cache entries older than 30 days on midnight tick

### Phase 4 - Dashboard Components

Write failing Vitest tests first for:

- `PrayerCard` 12h/24h rendering using preferences (`2:00 PM` vs `14:00`)
- interactive header rendering and Today pill visibility
- chevron buttons and boundary-disabled states
- keyboard arrow navigation when focus is not inside an input
- swipe threshold handling
- Arabic prayer names in both `PrayerCard` and `FocusCard`
- midnight crossover behavior for Conditions A, B, and C

Then implement:

- `PrayerCard` two-tier header
- chevrons with `aria-label`s
- Today pill
- directional slide animation using Tailwind classes tied to transform/opacity
- navigation gating via `enableDateNavigation`
- keyboard and touch interaction
- use of `clockFormat` from preferences
- Arabic/English names in `PrayerCard` and `FocusCard`
- `DashboardView` wiring for the new hook outputs while leaving `FocusCard` independent from the navigated date

## Risks and Decisions

- **Preference upgrades**: existing users will miss new preference keys unless the stored object is merged with defaults.
- **Time formatting bug**: 12h output must include AM/PM (`h:mm a`), not just `h:mm`.
- **Timezone correctness**: midnight logic must use the backend timezone.
- **Boundary handling**: an empty chunk response disables only the attempted direction.
- **Animation tearing**: disable navigation during the transition window.

## Verification

Run all of the following after implementation and fix any failures:

```bash
npm run test:src
npm run test:client
npm run lint
npx -y react-doctor@latest . --verbose --diff
```

If the project exposes a build command for the client, run it as well. Otherwise verify the modified files with `lsp_diagnostics` and the full test suites above.

## Done When

- `/api/prayers` returns the new `calendar` payload without breaking existing consumers.
- `PrayerCard` supports chevrons, swipe, keyboard navigation, Today reset, slide transitions, and correct time formatting.
- `FocusCard` remains anchored to real current time while respecting prayer-name language.
- Midnight crossover and inactivity timeout match PRD Conditions A, B, and C.
- New settings default correctly for fresh and existing localStorage state.
- Jest, Vitest, lint, and `react-doctor` all pass.
