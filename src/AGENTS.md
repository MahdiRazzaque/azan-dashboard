# Express Backend

Express 5 + CommonJS. Entry: `server.js`. All configs via `@config`, validated by Zod.

## WHERE TO LOOK

| Task                 | Location                                          | Notes                                                                           |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Change config shape  | `config/schemas.js`                               | Zod schema → then add migration in `services/system/migrationService.js`        |
| Add API endpoint     | `routes/` + `controllers/`                        | Router file → controller method                                                 |
| Add middleware       | `middleware/`                                     | Applied in `routes/index.js` or per-route                                       |
| Scheduler jobs       | `services/core/schedulerService.js`               | node-schedule, job constants in `utils/jobConstants.js`                         |
| TTS templates        | `services/system/audioAssetService.js`            | `resolveTemplate()` — placeholders: `{prayer}`, `{prayerArabic}`, `{minutes}`   |
| System diagnostics   | `services/system/diagnosticsService.js`           | Runtime diagnostics aggregation                                                 |
| Config save workflow | `services/system/configurationWorkflowService.js` | 7-step pipeline: unmask → validate → save → refresh → sync → restart → warnings |
| Voice management     | `services/system/voiceService.js`                 | TTS voice list cache, microservice proxy                                        |
| Storage monitoring   | `services/system/storageService.js`               | Disk usage, quota checking                                                      |

## STRUCTURE

```
├── server.js                    # Startup orchestration (init order matters)
├── config/                      # See config/AGENTS.md
│   ├── ConfigService.js         # Singleton: load, validate, encrypt, migrate, save
│   ├── schemas.js               # Zod schemas for all config sections
│   ├── default.json             # Defaults (merged with local.json)
│   └── local.json               # User overrides (secrets stripped)
├── controllers/                 # Express request handlers — see controllers/AGENTS.md
│   ├── prayerController.js      # Prayer times, calendar, override endpoints
│   ├── settingsController.js    # Config CRUD, source validation
│   ├── systemController.js      # Health, diagnostics, voices, URL validation, audio ops
│   ├── authController.js        # Login, password change, session validation
│   └── envController.js         # Environment variable management
├── routes/
│   └── index.js                 # Mounts sub-routers, applies rate limiters, no-cache
├── services/                    # See services/AGENTS.md
│   ├── core/                    # Business logic (scheduler, prayer times, automation, validation)
│   └── system/                  # Infrastructure (9 services — see services/AGENTS.md)
├── providers/                   # See providers/AGENTS.md
├── outputs/                     # See outputs/AGENTS.md
├── middleware/                   # See middleware/AGENTS.md
│   ├── auth.js                  # JWT verification (cookie-based)
│   ├── errorHandler.js          # Centralized Express error middleware
│   ├── rateLimiters.js          # Global read/write + SSE rate limiters (Bottleneck)
│   ├── fileUpload.js            # Multer MP3 upload with validation
│   ├── storageCheck.js          # Reject writes when disk full
│   └── asyncHandler.js          # Async error wrapper
├── utils/                       # See utils/AGENTS.md
│   ├── logger.js                # Winston logger (use this, not console.log)
│   ├── encryption.js            # AES encrypt/decrypt for config secrets
│   ├── constants.js             # Shared constants (TTS_TEMPLATE_MAX_LENGTH, etc.)
│   ├── jobConstants.js          # Scheduler job name constants
│   ├── asyncLock.js             # Async mutex for concurrent operations
│   ├── networkUtils.js          # DNS-pinned HTTP agents (rebinding protection)
│   ├── envManager.js            # .env file read/write, secret generation
│   └── passwordUtils.js         # Bcrypt password hashing
├── microservices/tts/           # See microservices/tts/AGENTS.md
│   └── server.py                # FastAPI: /voices, /generate-tts, /preview-tts (edge-tts)
├── data/                        # Runtime data (prayer time cache files)
└── tests/
    ├── setup.js                 # Jest setup: env vars, log suppression
    ├── helpers/                  # mockFactory.js, authHelper.js, fsHelper.js
    ├── unit/                    # Mirrors src/ structure
    └── integration/routes/      # Supertest API integration tests
```

## CONVENTIONS

- **Startup order is load-bearing** — `server.js` init: env → config → health → voice → cache → audio → migration → scheduler. Changing order breaks assumptions.
- **ConfigService owns all config** — Never read JSON files directly. Use `configService.get()`.
- **Bottleneck rate limiting** — `audioAssetService` and `systemController` use Bottleneck for concurrent FS/TTS ops.
- **Error hierarchy** — Custom errors: `ConfigNotInitializedError`, `CriticalConfigurationError` (config); `ProviderConnectionError`, `ProviderValidationError` (providers). Error handler in `middleware/errorHandler.js`.
- **Async safety** — `asyncLock.js` provides mutex for concurrent cache writes and config saves. `asyncHandler.js` wraps route handlers.

## TESTING

- **Framework**: Jest 30 (`npm run test:src`, runs with `--runInBand --forceExit`)
- **Naming**: `*.test.js`, extended: `*_Extended.test.js`, security: `*_security.test.js`, parallel: `*_parallel.test.js`, env: `*_env.test.js`
- **Mocks**: Use `mockFactory.js` — don't create ad-hoc mocks for core services.
- **Auth in tests**: `authHelper.getAuthToken(secret)` → set as cookie.
- **FS in tests**: `fsHelper.js` for filesystem operation helpers.
- **Integration tests**: Supertest against Express app in `tests/integration/routes/`.
- **Setup**: `tests/setup.js` suppresses console except errors, sets `JWT_SECRET` + `NODE_ENV=test`.
- **Global mocks**: `__mocks__/` at root — axios is globally mocked. ConfigService mocked via `@config` alias.
