# Issues — onboarding-tour

## [2026-02-24] Known Issues / Gotchas

### driver.js Known Bugs

- GitHub #572: `destroy()` can throw DOMException on route change — ALWAYS guard with `isActive()` + try/catch
- GitHub #504: `destroy()` may not fully clean up — check `isActive()` before calling
- Missing elements: driver.js renders dummy div at screen center for missing elements — MUST pre-filter steps

### React 18 Strict Mode

- Double-mount in dev mode causes stale references with `useState`/`useMemo`
- Solution: `useRef(null)` for driver instance

### Public API Gap

- `GET /api/settings/public` does NOT include `system.tours` by default
- Task 3 must extend `getPublicSettings` to include `system.tours`
- Dashboard users may be unauthenticated — they use public endpoint

### Workflow Side-Effects

- `POST /api/settings/update` triggers prayer refresh, audio sync, scheduler restart
- MUST use `configService.update()` directly for tour state updates

## [2026-02-24] Task 8 Notes

- `fetch('/api/settings/tour-state', ...)` should be followed by `.then(fetchSettings)` and `.catch(...)` to avoid unhandled rejections in callbacks.

---

## [F3] Manual QA — Onboarding Tour — Results (2026-02-24)

### BUG CONFIRMED: driver.js receives no steps — `useTour.js` API usage error

**Root Cause:**  
In `client/src/hooks/useTour.js` line 59:

```js
driverInstance.drive(filteredSteps);
```

`drive()` accepts an **integer index** (default 0), NOT a steps array. Steps must be passed via the `driver({steps: filteredSteps, ...})` constructor or `driverInstance.setSteps(filteredSteps)`. Since no steps are ever registered in the driver config, `s("steps")` returns `undefined`, triggering the `console.error("No steps to drive through")` in driver.js and immediately ending the tour.

**Impact:** All actual tour overlay steps fail to display. driver.js body activation (`body.driver-active`) does fire, but the popover/steps never render. The `onComplete` callback fires immediately (via `filteredSteps.length === 0` branch in `useTour.js` line 34-39), prematurely marking the tour as seen.

**Affected:** All dashboard tour and admin tour flows.

**Console Error observed:** `[error] No steps to drive through` — fires on every tour trigger.

**Fix needed in:** `client/src/hooks/useTour.js` — Pass `steps: filteredSteps` to the `driver({})` constructor config, then call `driverInstance.drive(0)` (or just `driverInstance.drive()`).
