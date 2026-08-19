# Services Layer

Two sub-layers: `core/` (business logic) and `system/` (infrastructure). All services are singletons — imported once, used everywhere.

## CORE SERVICES (`core/`)

Business logic that implements the application's primary functions.

| Service                | Role                               | Key Exports                                                                                              |
| ---------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `prayerTimeService.js` | Prayer data: fetch, cache, refresh | `getPrayersWithNext`, `getPrayerTimes`, `getPrayerCalendarWindow`, `forceRefresh`, `readCache`           |
| `schedulerService.js`  | Job scheduling for prayer events   | `initScheduler`, `scheduleEvent`, `scheduleMaintenanceJobs`, `hotReload`, `getJobs`, `runJob`, `stopAll` |
| `automationService.js` | Audio trigger execution pipeline   | `triggerEvent`, `getAudioSource`                                                                         |
| `validationService.js` | Cross-service config validation    | `validateConfigSource`                                                                                   |

### prayerTimeService.js

- **Caching**: In-memory + filesystem (`data/` dir). `asyncLock` prevents concurrent writes.
- **Year boundary**: Auto-refreshes when crossing year boundary.
- **Overrides**: `applyOverrides()` patches individual prayer times from user config.
- **Constants**: `PRAYER_NAMES` = `['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']`.

### schedulerService.js

- **Library**: `node-schedule` for cron-like scheduling.
- **Hot reload**: `hotReload()` clears and re-schedules all jobs (called after config save).
- **Maintenance**: `scheduleMaintenanceJobs()` registers health checks, cache refresh, audio cleanup.
- **Lead time**: `getMaxLeadTime()` determines earliest pre-event job needed.

### automationService.js

- **Pipeline**: `triggerEvent()` → `_getActiveTargets()` → `_validateAndPrepareAudio()` → `_executeTarget()`.
- **Timeout**: Each target execution has a configurable timeout via `withTimeout()`.
- **Audio dir**: `AUDIO_DIR` = `public/audio/`.

## SYSTEM SERVICES (`system/`)

Infrastructure and operational services.

| Service                           | Role                                      | Key Exports                                                                                                                             |
| --------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `audioAssetService.js`            | TTS generation, sidecar metadata, cleanup | `syncAudioAssets`, `ensureTTSFile`, `ensureTestAudio`, `cleanupCache`, `resolveTemplate`, `previewTTS`, `analyzeFile`, `enrichMetadata` |
| `voiceService.js`                 | TTS voice list cache                      | `init`, `refreshVoices`, `getVoices`                                                                                                    |
| `healthCheck.js`                  | Multi-check health aggregation            | `init`, `refresh`, `getHealth`, `checkSource`, `toggle`, `runStartupChecks`                                                             |
| `sseService.js`                   | Server-Sent Events for logs               | `addClient`, `broadcast`, `log`                                                                                                         |
| `storageService.js`               | Disk usage monitoring                     | `getDirSize`, `getUsage`, `getSystemStats`, `checkQuota`                                                                                |
| `migrationService.js`             | Config schema migrations                  | `migrateConfig`, `migrateEnvSecrets`, `migrateV1toV2` ... `migrateV4toV5`                                                               |
| `configurationWorkflowService.js` | Config update pipeline                    | `executeUpdate` (7-step workflow)                                                                                                       |
| `diagnosticsService.js`           | Runtime diagnostics                       | `getAutomationStatus`, `getTTSStatus`                                                                                                   |
| `assetMigrationService.js`        | Legacy audio file migration               | `migrateAll`                                                                                                                            |

### audioAssetService.js (largest service, ~555 lines)

- **TTS flow**: `resolveTemplate()` → `generateTTS()` (calls Python microservice) → writes file + sidecar `.json` metadata.
- **Concurrency**: Uses `Bottleneck` limiter for parallel TTS generation.
- **Sidecar metadata**: Every audio file in `public/audio/cache/` has a paired `.json` in `src/public/audio/cache/`.
- **Template placeholders**: `{prayer}`, `{prayerArabic}`, `{minutes}`, `{time}`.
- **Constants**: `AUDIO_PATHS`, `META_ROOT`, `TTS_FILENAME_PATTERN`.

### configurationWorkflowService.js

7-step pipeline: unmask secrets → validate via Zod → save to ConfigService → refresh prayer cache → sync audio assets → restart scheduler → collect warnings.

### migrationService.js

Sequential version migrations (V1→V2→V3→V4→V5). Each migration handles specific schema changes. Uses OutputFactory and ProviderFactory for strategy-aware migrations.

## DEPENDENCY FLOW

```
schedulerService → prayerTimeService → providers (via ProviderFactory)
schedulerService → automationService → outputs (via OutputFactory)
automationService → audioAssetService → TTS microservice (HTTP)
configurationWorkflowService → configService, prayerTimeService, audioAssetService, schedulerService
healthCheck → providers, outputs, TTS microservice
```

## CONVENTIONS

- **No circular imports** — Services reference each other via lazy requires or injected at call time.
- **Logging** — All services use `@utils/logger`. SSE broadcast for user-visible operations.
- **Error propagation** — Services throw typed errors. Controllers catch and format HTTP responses.

## COMPLEXITY NOTES

- `audioAssetService.js` (555 lines): Multi-step TTS workflow with metadata, concurrency, and cleanup. Size warranted.
- `schedulerService.js` (484 lines): Job scheduling with hot reload, maintenance jobs, and lead time calculations. Size appropriate for domain.
- `configurationWorkflowService.js`: 7-step pipeline is inherently sequential. Each step has distinct error handling. Don't attempt to simplify the step chain.
