# UTILS DIRECTORY

Backend-only utility functions and singleton instances for shared logic, security, and infrastructure.

## FILES

| File                 | Role                         | Key Exports                             | Consumers                                   |
| :------------------- | :--------------------------- | :-------------------------------------- | :------------------------------------------ |
| logger.js            | Winston logger               | `logger` instance                       | ALL backend services/controllers            |
| encryption.js        | AES secret management        | `encrypt()`, `decrypt()`, `maskValue()` | ConfigService, configurationWorkflowService |
| constants.js         | Shared constants             | `CALCULATION_METHODS`, `AUDIO_PATHS`    | Prayer services, controllers, automation    |
| jobConstants.js      | Scheduler job names          | `JOB_NAMES`                             | schedulerService                            |
| asyncLock.js         | Concurrent op deduplication  | `AsyncLock` singleton                   | audioAssetService, ConfigService            |
| networkUtils.js      | DNS-pinned HTTP agents       | `pinnedAgent`, `validateUrl()`          | healthCheck, systemController               |
| envManager.js        | .env file management         | `readEnv()`, `writeEnv()`               | envController, server.js                    |
| passwordUtils.js     | Bcrypt hashing               | `hashPassword()`, `comparePassword()`   | authController, envController               |
| normalizeSource.js   | Audio source standardization | `normalizeSource()`                     | automationService, systemController         |
| pathUtils.js         | Path traversal validation    | `validatePath()`, `resolveSafePath()`   | normalizeSource, systemController           |
| calculations.js      | Prayer time math             | `calculateIqamah()`, `getNextPrayer()`  | prayerTimeService, prayerController         |
| configUnmasker.js    | Config unmasking             | `unmaskConfig()`                        | configurationWorkflowService                |
| loggerInitializer.js | SSE logger setup             | `initializeLogger()`                    | server.js                                   |
| audioValidator.js    | ffprobe file analysis        | `getAudioMetadata()`, `isValidAudio()`  | audioAssetService                           |

## CONVENTIONS

- All utils are pure functions or singleton instances — no classes.
- Use @utils/logger alias, never console.log.
- Security-sensitive utils (encryption, pathUtils, networkUtils) must not expose implementation details in error messages.
- asyncLock is a shared singleton — do NOT create additional lock instances.

## CONSUMER MAP

```
controllers → constants, normalizeSource, pathUtils, calculations, passwordUtils, networkUtils
services/core → constants, calculations, asyncLock, normalizeSource
services/system → encryption, asyncLock, audioValidator, configUnmasker, logger
config → encryption, asyncLock
middleware → (none directly, uses logger indirectly)
server.js → envManager, loggerInitializer
```

## ANTI-PATTERNS

- Never import logger in frontend code — it's backend-only (Winston).
- Never create additional AsyncLock instances — use the shared one from asyncLock.js.
- Never call encryption functions without checking ENCRYPTION_SALT env var exists.
- constants.js exports are READ-ONLY — never mutate them.
