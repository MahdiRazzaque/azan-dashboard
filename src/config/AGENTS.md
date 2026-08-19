# Configuration System

Singleton ConfigService + Zod schemas + JSON file storage with encrypted secrets.

## FILES

| File               | Role                                                   |
| ------------------ | ------------------------------------------------------ |
| `ConfigService.js` | Singleton class — load, validate, encrypt, merge, save |
| `schemas.js`       | All Zod schemas for config validation                  |
| `index.js`         | Creates singleton instance, exports it                 |
| `default.json`     | Factory defaults (committed)                           |
| `local.json`       | User overrides (secrets stripped, gitignored)          |

## ConfigService.js

### Public API

| Method            | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `init()`          | Load defaults + local + env overrides. Called once at startup.          |
| `reload()`        | Re-read from disk. Used after external changes.                         |
| `get(path?)`      | Read config value. Optional dot-path (e.g., `get('system.tts.voice')`). |
| `update(partial)` | Merge partial config, validate, save atomically.                        |
| `reset()`         | Restore defaults, keep env overrides.                                   |

### Private Methods

| Method                      | Purpose                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| `_saveLocal()`              | Atomic write via temp file rename. Strips secrets before saving. |
| `_validateConstraints()`    | Business rule validation beyond Zod schemas.                     |
| `_validateSources()`        | Validates provider source configurations.                        |
| `_cleanSourceData()`        | Removes unused source-specific fields.                           |
| `_mergeDeep()`              | Deep merge with array replacement (not concat).                  |
| `_applyEnvOverrides()`      | Reads `.env` values and overlays onto config.                    |
| `_stripSecrets()`           | Removes secret fields before writing to `local.json`.            |
| `_processSensitiveFields()` | Encrypts/decrypts sensitive values using AES.                    |
| `_getEncryptionKey()`       | Derives key from `ENCRYPTION_SALT` env var.                      |

### Custom Errors

- `ConfigNotInitializedError` — thrown if `.get()` called before `.init()`.
- `CriticalConfigurationError` — thrown if required env vars (`JWT_SECRET`, `ENCRYPTION_SALT`) missing.

## schemas.js

9 exported Zod schemas:

| Schema                  | Validates                               |
| ----------------------- | --------------------------------------- |
| `configSchema`          | Top-level config structure              |
| `automationSchema`      | Automation/trigger settings             |
| `systemSchema`          | System-wide settings (TTS, audio, etc.) |
| `prayerSettingSchema`   | Prayer display/calculation settings     |
| `prayerTriggersSchema`  | Per-prayer trigger configuration        |
| `sunriseTriggersSchema` | Sunrise-specific triggers               |
| `triggerEventSchema`    | Single trigger event payload            |
| `envUpdateSchema`       | Environment variable update payload     |
| `securitySchema`        | Password change payload                 |

Also exports: `TTS_TEMPLATE_MAX_LENGTH` constant.

## HOW CONFIG FLOWS

```
startup: default.json → merge local.json → apply .env overrides → validate → ready
update:  API request → configurationWorkflowService.executeUpdate() → ConfigService.update() → _stripSecrets → _saveLocal
```

## CONVENTIONS

- **Add schema first** — Any new config field: add Zod schema in `schemas.js`, default in `default.json`, migration in `migrationService.js`.
- **Secrets are env-only** — Fields like API keys, passwords are read from `.env`, never stored in `local.json`.
- **Atomic saves** — `_saveLocal()` writes to temp file then renames. Prevents corruption on crash.
- **Encryption** — Sensitive config values encrypted at rest using AES. Key derived from `ENCRYPTION_SALT`.

## COMPLEXITY NOTE

`ConfigService.js` is the largest backend file (692 lines). This is warranted. Config management inherently requires handling multiple sources (defaults, local, env), encryption, validation, migrations, and atomic saves. The private method pattern (`_mergeDeep`, `_stripSecrets`, etc.) encapsulates complex logic appropriately. Don't split without strong reason.
