# 9. Configuration Reference

This document provides an exhaustive reference for the Azan Dashboard configuration schema. All configuration is validated at load time by [Zod](https://zod.dev/) schemas defined in `src/config/schemas.js`.

---

## How Configuration Works

Configuration is managed by the `ConfigService` singleton (`src/config/ConfigService.js`). It merges three layers in order of precedence:

```
Environment variables (.env)  →  highest priority (secrets only)
User overrides (local.json)   →  user-configured values
Defaults (default.json)       →  shipped defaults
```

### Key Behaviours

- **Secrets are environment-first** — Sensitive values (API keys, tokens) are stored exclusively in `.env` and stripped from `local.json` on every save.
- **Encryption at rest** — If `AZAN_ENCRYPTION_KEY` is set, sensitive fields in `local.json` are AES-256-CBC encrypted.
- **Atomic writes** — `ConfigService` writes to a temporary file first, then renames, preventing corruption on crash.
- **Validation on every load** — The full configuration object is parsed through `configSchema` on every startup and update. Invalid configuration is rejected with descriptive Zod error messages.
- **Automatic migration** — On startup, `migrationService.js` upgrades older config versions sequentially to the latest schema version (currently V5).

---

## Schema Version

```json
{
  "version": 5
}
```

| Field     | Type     | Default | Description                                                                            |
| --------- | -------- | ------- | -------------------------------------------------------------------------------------- |
| `version` | `number` | `1`     | Schema version number. Automatically set by migration service. Do not modify manually. |

The current schema version is **5**. See [Migration History](#migration-history) for the full changelog.

---

## `location`

Defines the geographical position and timezone for prayer time calculations.

```json
{
  "location": {
    "timezone": "Europe/London",
    "coordinates": {
      "lat": 51.5074,
      "long": -0.1278
    }
  }
}
```

| Field              | Type     | Constraints                                                                                                                         | Default           | Description                                                     |
| ------------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------- |
| `timezone`         | `string` | Must be a valid [IANA timezone](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones). Validated via `Intl.DateTimeFormat`. | `"Europe/London"` | The timezone used for all prayer time calculations and display. |
| `coordinates.lat`  | `number` | `-90` to `90`                                                                                                                       | `51.5074`         | Latitude of the mosque or home.                                 |
| `coordinates.long` | `number` | `-180` to `180`                                                                                                                     | `-0.1278`         | Longitude of the mosque or home.                                |

---

## `prayers`

Per-prayer Iqamah calculation settings. Each of the five daily prayers has identical configuration options.

```json
{
  "prayers": {
    "fajr": {
      "iqamahOffset": 20,
      "roundTo": 15,
      "fixedTime": null,
      "iqamahOverride": false
    },
    "dhuhr": {
      "iqamahOffset": 15,
      "roundTo": 15,
      "fixedTime": null,
      "iqamahOverride": false
    },
    "asr": {
      "iqamahOffset": 15,
      "roundTo": 15,
      "fixedTime": null,
      "iqamahOverride": false
    },
    "maghrib": {
      "iqamahOffset": 10,
      "roundTo": 5,
      "fixedTime": null,
      "iqamahOverride": false
    },
    "isha": {
      "iqamahOffset": 15,
      "roundTo": 15,
      "fixedTime": null,
      "iqamahOverride": false
    }
  }
}
```

### Prayer Setting Schema

Each prayer key (`fajr`, `dhuhr`, `asr`, `maghrib`, `isha`) uses the `prayerSettingSchema`:

| Field            | Type             | Default                 | Description                                                                                     |
| ---------------- | ---------------- | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `iqamahOffset`   | `number`         | See per-prayer defaults | Minutes after the Adhan time to schedule Iqamah.                                                |
| `roundTo`        | `number`         | See per-prayer defaults | Round the calculated Iqamah time to the nearest N minutes (e.g., `15` rounds to quarter-hours). |
| `fixedTime`      | `string \| null` | `null`                  | If set (e.g., `"13:30"`), overrides the calculated Iqamah with a fixed time.                    |
| `iqamahOverride` | `boolean`        | `false`                 | When `true`, the fixed time takes precedence over the calculated offset.                        |

### Default Values Per Prayer

| Prayer  | `iqamahOffset` | `roundTo` |
| ------- | -------------- | --------- |
| Fajr    | 20             | 15        |
| Dhuhr   | 15             | 15        |
| Asr     | 15             | 15        |
| Maghrib | 10             | 5         |
| Isha    | 15             | 15        |

---

## `sources`

Configures where prayer times are fetched from. Supports a primary source and an optional backup.

```json
{
  "sources": {
    "primary": {
      "type": "aladhan",
      "method": 15,
      "madhab": 1,
      "latitudeAdjustmentMethod": 0,
      "midnightMode": 0
    },
    "backup": null
  }
}
```

| Field          | Type             | Constraints                                                 | Default     | Description                                                                                                                              |
| -------------- | ---------------- | ----------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `primary.type` | `string`         | Must match a registered provider ID                         | `"aladhan"` | The prayer time provider to use.                                                                                                         |
| `primary.*`    | varies           | Provider-specific                                           | —           | Additional fields depend on the provider's `getMetadata().parameters`. The schema uses `.passthrough()` to allow provider-specific keys. |
| `backup`       | `object \| null` | Same structure as primary, plus optional `enabled: boolean` | `null`      | Optional fallback provider. Set to `null` to disable.                                                                                    |

### Built-in Provider Parameters

#### Aladhan

| Field                      | Type     | Default | Description                                                                                                                                                                                             |
| -------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `method`                   | `number` | `15`    | Calculation method (see [Aladhan API docs](https://aladhan.com/prayer-times-api#tag/Monthly-Annual-Prayer-Times-Calendar/paths/~1v1~1calendar~1%7Byear%7D/get)). `15` = Muslim World League (adjusted). |
| `madhab`                   | `number` | `1`     | Juristic school. `1` = Shafi, Maliki, Hanbali. `2` = Hanafi.                                                                                                                                            |
| `latitudeAdjustmentMethod` | `number` | `0`     | High latitude adjustment. `0` = None, `1` = Middle of Night, `2` = One-Seventh, `3` = Angle-Based.                                                                                                      |
| `midnightMode`             | `number` | `0`     | `0` = Standard (mid Sunset-to-Sunrise), `1` = Jafari (mid Sunset-to-Fajr).                                                                                                                              |

#### MyMasjid

| Field      | Type     | Default | Description                                      |
| ---------- | -------- | ------- | ------------------------------------------------ |
| `masjidId` | `string` | —       | The UUID of the mosque on the MyMasjid platform. |

---

## `data`

Controls data freshness and storage limits.

```json
{
  "data": {
    "staleCheckDays": 7,
    "storageLimit": 1.0
  }
}
```

| Field            | Type     | Constraints   | Default | Description                                                                                                    |
| ---------------- | -------- | ------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `staleCheckDays` | `number` | —             | `7`     | Number of days after which cached prayer data is considered stale and re-fetched.                              |
| `storageLimit`   | `number` | Minimum `0.1` | `1.0`   | Maximum disk usage (in GB) for audio files (`public/audio/`). Uploads are rejected when this limit is reached. |

---

## `automation`

The largest configuration section. Controls the scheduling engine, audio output targets, TTS settings, and per-prayer trigger events.

```json
{
  "automation": {
    "global": { ... },
    "baseUrl": "http://localhost:3000",
    "pythonServiceUrl": "http://localhost:8000",
    "defaultVoice": "ar-SA-HamedNeural",
    "outputs": { ... },
    "triggers": { ... }
  }
}
```

### `automation.global`

Master switches for the automation engine.

| Field              | Type      | Default | Description                                            |
| ------------------ | --------- | ------- | ------------------------------------------------------ |
| `enabled`          | `boolean` | `true`  | Master toggle. When `false`, no automated events fire. |
| `preAdhanEnabled`  | `boolean` | `true`  | Global toggle for all pre-Adhan announcements.         |
| `adhanEnabled`     | `boolean` | `true`  | Global toggle for all Adhan announcements.             |
| `preIqamahEnabled` | `boolean` | `true`  | Global toggle for all pre-Iqamah announcements.        |
| `iqamahEnabled`    | `boolean` | `true`  | Global toggle for all Iqamah announcements.            |

### `automation.baseUrl`

| Type                | Default                   | Description                                                                                                            |
| ------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `string` (optional) | `"http://localhost:3000"` | The base URL of this application, used for constructing audio file URLs sent to external services (e.g., VoiceMonkey). |

### `automation.pythonServiceUrl`

| Type                | Default                   | Description                                   |
| ------------------- | ------------------------- | --------------------------------------------- |
| `string` (optional) | `"http://localhost:8000"` | URL of the Python TTS microservice (FastAPI). |

### `automation.defaultVoice`

| Type                | Default               | Description                                                                   |
| ------------------- | --------------------- | ----------------------------------------------------------------------------- |
| `string` (optional) | `"ar-SA-HamedNeural"` | The default edge-tts voice for TTS generation. Can be overridden per trigger. |

### `automation.outputs`

A dynamic record of output strategy configurations, keyed by output ID (e.g., `"local"`, `"voicemonkey"`).

```json
{
  "outputs": {
    "local": {
      "enabled": false,
      "verified": false,
      "leadTimeMs": 0,
      "params": {
        "audioPlayer": "mpg123"
      }
    },
    "voicemonkey": {
      "enabled": false,
      "verified": false,
      "leadTimeMs": 0,
      "params": {}
    }
  }
}
```

#### Per-Output Schema

| Field        | Type                  | Constraints         | Default | Description                                                                                                          |
| ------------ | --------------------- | ------------------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| `enabled`    | `boolean`             | —                   | `false` | Whether this output is active.                                                                                       |
| `verified`   | `boolean`             | —                   | `false` | Whether credentials have been verified via health check.                                                             |
| `leadTimeMs` | `number`              | `-30000` to `30000` | `0`     | Timing offset in milliseconds. Positive = fire early, negative = fire late. Useful for compensating network latency. |
| `params`     | `Record<string, any>` | —                   | `{}`    | Strategy-specific parameters (broker URLs, API keys, device names, etc.). Sensitive values are stored in `.env`.     |

### `automation.triggers`

Per-prayer trigger event configuration. Each prayer has up to four trigger events; sunrise has two.

#### Standard Prayer Triggers (Fajr, Dhuhr, Asr, Maghrib, Isha)

Each prayer contains four trigger events:

| Event       | When it Fires                    |
| ----------- | -------------------------------- |
| `preAdhan`  | N minutes before the Adhan time  |
| `adhan`     | At the Adhan time                |
| `preIqamah` | N minutes before the Iqamah time |
| `iqamah`    | At the Iqamah time               |

#### Sunrise Triggers

Sunrise has only two events:

| Event      | When it Fires            |
| ---------- | ------------------------ |
| `preAdhan` | N minutes before sunrise |
| `adhan`    | At sunrise               |

#### Trigger Event Schema (`triggerEventSchema`)

Each trigger event is configured with the following fields:

| Field           | Type       | Constraints                                                  | Default                                                 | Description                                                                                                              |
| --------------- | ---------- | ------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `enabled`       | `boolean`  | —                                                            | `false`                                                 | Whether this specific trigger fires.                                                                                     |
| `offsetMinutes` | `number`   | `0` to `60`                                                  | Varies (typically `15` for preAdhan, `5` for preIqamah) | Minutes before the event to fire the trigger. Only meaningful for `preAdhan` and `preIqamah`.                            |
| `type`          | `enum`     | `"tts"`, `"file"`, or `"url"`                                | `"tts"`                                                 | The audio source type.                                                                                                   |
| `template`      | `string`   | Max length: `TTS_TEMPLATE_MAX_LENGTH` (defined in constants) | Varies                                                  | TTS template string. Only used when `type` is `"tts"`. Supports placeholders: `{prayer}`, `{prayerArabic}`, `{minutes}`. |
| `path`          | `string`   | —                                                            | `""`                                                    | Path to a local audio file. Only used when `type` is `"file"`.                                                           |
| `url`           | `string`   | —                                                            | —                                                       | URL of a remote audio file. Only used when `type` is `"url"`.                                                            |
| `voice`         | `string`   | —                                                            | —                                                       | Override the default TTS voice for this specific trigger.                                                                |
| `targets`       | `string[]` | `"browser"` is automatically filtered out                    | `["local"]`                                             | Output strategy IDs to route this trigger to (e.g., `["local", "voicemonkey"]`).                                         |

> **Note:** The `targets` array is automatically transformed to remove the `"browser"` target, as browser audio is handled separately via SSE.

#### Example Trigger Configuration

```json
{
  "fajr": {
    "preAdhan": {
      "enabled": true,
      "offsetMinutes": 15,
      "type": "tts",
      "template": "{minutes} minutes till {prayerArabic}",
      "targets": ["local", "voicemonkey"]
    },
    "adhan": {
      "enabled": true,
      "type": "file",
      "path": "/audio/custom/fajr-adhan.mp3",
      "targets": ["local"]
    },
    "preIqamah": {
      "enabled": false,
      "offsetMinutes": 5,
      "type": "tts",
      "template": "إِقَامَة for {prayerArabic} in {minutes} minutes",
      "targets": ["local"]
    },
    "iqamah": {
      "enabled": true,
      "type": "tts",
      "template": "Time for {prayerArabic} إِقَامَة",
      "targets": ["local"]
    }
  }
}
```

#### TTS Template Placeholders

| Placeholder      | Replaced With           | Example                   |
| ---------------- | ----------------------- | ------------------------- |
| `{prayer}`       | English prayer name     | `Fajr`, `Dhuhr`, `Asr`    |
| `{prayerArabic}` | Arabic prayer name      | `الفجر`, `الظهر`, `العصر` |
| `{minutes}`      | Minutes until the event | `15`, `5`                 |

---

## `system`

System-level settings for health monitoring and UI state.

```json
{
  "system": {
    "healthChecks": {
      "api": true,
      "tts": true
    },
    "tours": {
      "dashboardSeen": false,
      "adminSeen": false
    }
  }
}
```

### `system.healthChecks`

A dynamic record of health check toggles. Each key corresponds to a service that can be independently enabled or disabled for monitoring.

| Field | Type      | Default | Description                                             |
| ----- | --------- | ------- | ------------------------------------------------------- |
| `api` | `boolean` | `true`  | Enable health checking for the backend API.             |
| `tts` | `boolean` | `true`  | Enable health checking for the Python TTS microservice. |

### `system.tours`

Tracks whether the user has seen onboarding tours. Managed by the frontend `useTour` hook.

| Field           | Type      | Default | Description                                                    |
| --------------- | --------- | ------- | -------------------------------------------------------------- |
| `dashboardSeen` | `boolean` | `false` | Whether the dashboard onboarding tour has been completed.      |
| `adminSeen`     | `boolean` | `false` | Whether the admin/settings onboarding tour has been completed. |

---

## `security`

Security-related configuration.

```json
{
  "security": {
    "tokenVersion": 1
  }
}
```

| Field          | Type      | Constraints        | Default | Description                                                                                                                                                |
| -------------- | --------- | ------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokenVersion` | `integer` | Must be an integer | `1`     | JWT token version. Incrementing this value invalidates all existing JWT tokens, effectively logging out all sessions. Used for emergency token revocation. |

---

## Environment Variable Schema (`envUpdateSchema`)

The `PATCH /api/system/env` endpoint validates environment variable updates against this schema:

| Field   | Type     | Constraints                                          | Description                    |
| ------- | -------- | ---------------------------------------------------- | ------------------------------ |
| `key`   | `string` | Must pass whitelist/blacklist validation (see below) | The environment variable name. |
| `value` | `string` | —                                                    | The value to set.              |

### Key Validation Rules

**Blacklisted** (always rejected):

```
PATH, NODE_OPTIONS, SHELL, USER, HOME, LD_PRELOAD
```

**Whitelisted patterns** (at least one must match):

| Pattern                   | Examples                                     |
| ------------------------- | -------------------------------------------- |
| `^AZAN_`                  | `AZAN_ENCRYPTION_KEY`, `AZAN_ADMIN_PASSWORD` |
| `_KEY$`                   | `VOICEMONKEY_KEY`, `API_KEY`                 |
| `_TOKEN$`                 | `VOICEMONKEY_TOKEN`, `ACCESS_TOKEN`          |
| `_SECRET$`                | `JWT_SECRET`, `APP_SECRET`                   |
| `_URL$`                   | `WEBHOOK_URL`, `CALLBACK_URL`                |
| `_ID$`                    | `DEVICE_ID`, `MASJID_ID`                     |
| `_DEVICE$`                | `VOICEMONKEY_DEVICE`                         |
| `^(PORT\|TZ\|LOG_LEVEL)$` | `PORT`, `TZ`, `LOG_LEVEL`                    |

---

## Migration History

The configuration schema has evolved through five versions. Each migration is applied automatically and sequentially on startup.

| Version | Migration       | Description                                                                                                                                                                |
| ------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1 → V2 | `migrateV1toV2` | Converted legacy `automation.voiceMonkey` block into the generic `automation.outputs.voicemonkey` strategy format. Removed the `voiceMonkey` key.                          |
| V2 → V3 | `migrateV2toV3` | Moved global `calculation` object (method, madhab, latitudeAdjustmentMethod, midnightMode) into `sources.primary` for the Aladhan provider. Removed the `calculation` key. |
| V3 → V4 | `migrateV3toV4` | Added `system.healthChecks` block with `api: true` and `tts: true` defaults.                                                                                               |
| V4 → V5 | `migrateV4toV5` | Added `security.tokenVersion` block with default value `1`.                                                                                                                |

### Environment Secret Migration

On first boot after upgrading to V2.1+, `migrateEnvSecrets()` runs once to move secrets from environment variables into configuration:

1. **Output secrets** — For each registered output strategy, checks for environment variables matching `{STRATEGY_ID}_{PARAM_KEY}` (e.g., `VOICEMONKEY_TOKEN`) and migrates them into `automation.outputs.{id}.params.{key}`.
2. **Provider secrets** — For each registered provider, checks for environment variables matching sensitive parameter keys (e.g., `APIKEY`) and migrates them into the appropriate source configuration.

Migrated environment variables are then removed from `.env` to avoid duplication.

---

## Complete Default Configuration

The following is the full default configuration shipped with the application (`src/config/default.json`):

```json
{
  "location": {
    "timezone": "Europe/London",
    "coordinates": { "lat": 51.5074, "long": -0.1278 }
  },
  "prayers": {
    "fajr":    { "iqamahOffset": 20, "roundTo": 15, "fixedTime": null },
    "dhuhr":   { "iqamahOffset": 15, "roundTo": 15, "fixedTime": null },
    "asr":     { "iqamahOffset": 15, "roundTo": 15, "fixedTime": null },
    "maghrib": { "iqamahOffset": 10, "roundTo": 5,  "fixedTime": null },
    "isha":    { "iqamahOffset": 15, "roundTo": 15, "fixedTime": null }
  },
  "sources": {
    "primary": {
      "type": "aladhan",
      "method": 15,
      "madhab": 1,
      "latitudeAdjustmentMethod": 0,
      "midnightMode": 0
    },
    "backup": null
  },
  "data": {
    "staleCheckDays": 7,
    "storageLimit": 1.0
  },
  "automation": {
    "baseUrl": "http://localhost:3000",
    "pythonServiceUrl": "http://localhost:8000",
    "defaultVoice": "ar-SA-HamedNeural",
    "outputs": {
      "local": {
        "enabled": false,
        "params": { "audioPlayer": "mpg123" }
      },
      "voicemonkey": {
        "enabled": false,
        "verified": false,
        "leadTimeMs": 0,
        "params": {}
      }
    },
    "triggers": {
      "fajr": {
        "preAdhan":  { "enabled": false, "offsetMinutes": 15, "type": "tts", "template": "{minutes} minutes till {prayerArabic}", "targets": ["local"] },
        "adhan":     { "enabled": false, "type": "file", "path": "", "targets": ["local"] },
        "preIqamah": { "enabled": false, "offsetMinutes": 5, "type": "tts", "template": "إِقَامَة for {prayerArabic} in {minutes} minutes", "targets": ["local"] },
        "iqamah":    { "enabled": false, "type": "tts", "template": "Time for {prayerArabic} إِقَامَة", "targets": ["local"] }
      },
      "sunrise": {
        "preAdhan": { "enabled": false, "offsetMinutes": 15, "type": "tts", "template": "{minutes} minutes until Sunrise", "targets": ["local"] },
        "adhan":    { "enabled": false, "type": "tts", "template": "The sun is rising. Fajr time is ending.", "targets": ["local"] }
      },
      "dhuhr":   { "...same structure as fajr..." },
      "asr":     { "...same structure as fajr..." },
      "maghrib": { "...same structure as fajr..." },
      "isha":    { "...same structure as fajr..." }
    }
  },
  "system": {
    "healthChecks": { "api": true, "tts": true },
    "tours": { "dashboardSeen": false, "adminSeen": false }
  }
}
```

> **Note:** The `security` section (with `tokenVersion: 1`) is added by the V4 → V5 migration and does not appear in `default.json`.
