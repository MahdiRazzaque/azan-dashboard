# Circular Dependency Remediation — Summary

## Problem

Madge detected one backend circular dependency cycle:

```
src/config/ConfigService.js → src/outputs/index.js → src/outputs/LocalOutput.js → src/config/index.js
```

`ConfigService` lazily required the outputs barrel (`../outputs`) at runtime to resolve output strategy names and secret keys during config validation, env-override application, and secret stripping. The outputs barrel imported `LocalOutput`, which in turn imported the config singleton — completing the cycle.

## Solution: Dependency Injection

Instead of ConfigService reaching into the outputs module, the outputs module's data is **injected** into ConfigService and migrationService at startup via resolver callbacks.

### What Changed

| File                                      | Change                                                                                                                                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/ConfigService.js`             | Added `setOutputStrategyResolver()` and `setOutputSecretKeysResolver()` setters. Replaced 4 lazy `require('../outputs')` calls with resolver invocations. Fail-fast throws if resolvers not wired. Resolvers cleared on `reset()`. |
| `src/services/system/migrationService.js` | Added `setOutputSecretKeysResolver()` setter. `migrateEnvSecrets()` uses resolver instead of direct import. Fail-fast throw if not wired.                                                                                          |
| `src/server.js`                           | Wires both resolvers **before** `configService.init()` using lazy `require('@outputs')` inside callbacks to defer barrel evaluation.                                                                                               |
| `.github/workflows/madge.yml`             | New CI workflow running `madge --circular` on backend and frontend, gated by `dorny/paths-filter`.                                                                                                                                 |

### Test Changes (6 files)

- `ConfigService.test.js`, `ConfigServiceEncryption.test.js`, `helpers.test.js` — Wire resolvers in `beforeEach` after `createTempConfig()` (which calls `reset()` internally).
- `server.test.js` — New test verifying resolvers are wired before `configService.init()` via call-order spy.
- `migrationService.test.js`, `migrationServiceEnv.test.js` — Wire secret-keys resolver in `beforeEach`.

## Verification

| Check            | Result                       |
| ---------------- | ---------------------------- |
| Madge (backend)  | ✅ No circular dependencies  |
| Madge (frontend) | ✅ No circular dependencies  |
| Backend tests    | ✅ 74 suites, 800 tests pass |
| Frontend tests   | ✅ 64 suites, 572 tests pass |
| Code review      | ✅ Approved (3 rounds)       |

## Commits

1. `refactor(config): break circular dependency via dependency injection`
2. `refactor(server): wire output resolvers before config init`
3. `test(config): update tests for DI resolver contract`
4. `test(server,services): add startup wiring and migration resolver tests`
5. `ci(deps): add Madge circular dependency check workflow`

## Design Decisions

- **DI over shared extraction**: Each output strategy keeps its own inline metadata. Extracting metadata into a shared file would break the strategy pattern's encapsulation.
- **Fail-fast over fail-open**: Resolver-dependent code paths throw immediately if resolvers aren't wired, rather than silently returning empty data.
- **Lazy require in callbacks**: The resolver callbacks in `server.js` use `require('@outputs')` inside the function body (not at module top-level) to defer barrel evaluation until after the module graph is fully loaded.
- **Resolver clearing on reset()**: Ensures test isolation — `createTempConfig()` calls `reset()`, so tests must re-wire resolvers after setup.
