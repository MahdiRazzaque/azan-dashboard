# 8. Development Guide

This guide covers the conventions, tooling, and extension patterns required to contribute to the Azan Dashboard codebase. It is intended for developers of all experience levels.

---

## Development Environment

### Prerequisites

- **Node.js** ≥ 18 (LTS recommended)
- **Python** ≥ 3.9 (for the TTS microservice)
- **npm** ≥ 9
- **Git**

### Starting the Development Servers

```bash
# Full stack (backend + frontend concurrently)
npm run dev

# Backend only (nodemon, watches src/, restarts on changes)
npm run server:dev

# Frontend only (Vite dev server on :5173, proxies /api → :3000)
npm run client:dev

# TTS microservice (manual start — not needed under Docker)
npm run tts:start
```

The backend runs on port `3000` by default. The Vite dev server runs on port `5173` and proxies all `/api` requests to the backend.

---

## Coding Standards

### Language and Module System

| Layer            | Language             | Module System                           | Entry Point                       |
| ---------------- | -------------------- | --------------------------------------- | --------------------------------- |
| Backend          | JavaScript (ES2020+) | CommonJS (`require` / `module.exports`) | `src/server.js`                   |
| Frontend         | JavaScript + JSX     | ES Modules (`import` / `export`)        | `client/src/main.jsx`             |
| TTS Microservice | Python 3.9+          | Standard Python imports                 | `src/microservices/tts/server.py` |

There is **no TypeScript** in this project. Do not introduce TypeScript files, `as any` casts, `@ts-ignore`, or `@ts-expect-error` comments.

### Path Aliases

Both backend and frontend use path aliases for cleaner imports. Always prefer aliases over relative paths.

**Backend** (configured via `module-alias` in `package.json`, mirrored in Jest's `moduleNameMapper`):

| Alias                        | Resolves To                        |
| ---------------------------- | ---------------------------------- |
| `@services/`                 | `src/services/`                    |
| `@config` / `@config/`       | `src/config` / `src/config/`       |
| `@utils/`                    | `src/utils/`                       |
| `@controllers/`              | `src/controllers/`                 |
| `@middleware/`               | `src/middleware/`                  |
| `@providers` / `@providers/` | `src/providers` / `src/providers/` |
| `@outputs` / `@outputs/`     | `src/outputs` / `src/outputs/`     |
| `@routes/`                   | `src/routes/`                      |

> **Note:** An `@adapters/` alias is registered in `package.json` but the directory does not exist. Do not create it without intentional design.

**Frontend** (configured via Vite's `resolve.alias`):

| Alias | Resolves To   |
| ----- | ------------- |
| `@/`  | `client/src/` |

```javascript
// Backend example
const configService = require("@config/ConfigService");
const logger = require("@utils/logger");

// Frontend example
import { useAuth } from "@/hooks/useAuth";
import StatusBadge from "@/components/common/StatusBadge";
```

### JSDoc Requirements

JSDoc is enforced by ESLint with differing strictness per layer:

**Backend** — JSDoc is required on **all functions** (declarations, methods, arrow functions, function expressions). Each block must include `@param` (with type and description) and `@returns` (with type and description):

```javascript
/**
 * Calculates the Iqamah time for a given prayer.
 * @param {string} prayer - The prayer name (e.g., 'fajr').
 * @param {string} adhanTime - The Adhan time in HH:mm format.
 * @param {Object} settings - Prayer-specific settings.
 * @returns {string} The calculated Iqamah time in HH:mm format.
 */
function calculateIqamah(prayer, adhanTime, settings) {
  // ...
}
```

**Frontend** — JSDoc is required only on **hooks** (functions whose names begin with `use`). Components and utility functions do not require JSDoc, though it is encouraged:

```javascript
/**
 * Manages prayer time data fetching and state.
 * @param {Object} settings - The application settings object.
 * @param {boolean} isConnected - Whether the backend is reachable.
 * @returns {{ prayers: Array, nextPrayer: Object|null, loading: boolean }} Prayer state.
 */
const usePrayerTimes = (settings, isConnected) => {
  // ...
};
```

### Logging

**Backend**: Always use the Winston-based logger from `@utils/logger`. Never use `console.log`, `console.info`, or `console.warn` directly:

```javascript
const logger = require("@utils/logger");

logger.info("Prayer times refreshed", { source: "aladhan", year: 2026 });
logger.error("TTS generation failed", { error: err.message });
```

**Frontend**: Standard `console` methods are acceptable during development.

### Private Methods

Class methods intended for internal use are prefixed with an underscore (`_`):

```javascript
class ConfigService {
  _stripSecrets(config) {
    /* ... */
  }
  _loadSources() {
    /* ... */
  }
}
```

### Linting

ESLint is configured at `.config/eslint.config.mjs` with separate rule sets for backend and frontend. Run linting before every commit:

```bash
npm run lint
```

The configuration uses:

- **Backend**: `eslint-plugin-jsdoc` with strict rules for all function types
- **Frontend**: `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, and `eslint-plugin-jsdoc` (hooks only)

Test directories (`src/tests/`, `client/tests/`) are excluded from linting.

---

## Branching Strategy

| Branch        | Purpose                                                                |
| ------------- | ---------------------------------------------------------------------- |
| `main`        | Stable, production-ready code. Deployed automatically via CI.          |
| `develop`     | Integration branch for features awaiting release.                      |
| `feature/xyz` | Individual feature branches. Branch from `develop`, merge back via PR. |

### Workflow

1. Create a feature branch from `develop`: `git checkout -b feature/my-feature develop`
2. Make changes, ensuring linting and tests pass locally
3. Push and open a Pull Request targeting `develop`
4. After review and CI passage, merge into `develop`
5. Periodically, `develop` is merged into `main` for release

---

## Testing Strategy

The project maintains separate test suites for backend and frontend, each with its own framework and configuration.

### Backend Tests (Jest)

- **Framework**: Jest 30
- **Config**: `.config/jest.config.js`
- **Environment**: Node.js
- **Setup file**: `src/tests/setup.js` — registers path aliases, suppresses `console.log` (unless `DEBUG=true`), sets `JWT_SECRET` and `NODE_ENV=test`

```bash
# Run all backend tests
npm run test:src

# Run with coverage report
npm run test:src:coverage
```

#### Directory Structure

```
src/tests/
├── setup.js                          # Global setup (env vars, log suppression)
├── helpers/
│   ├── mockFactory.js                # Centralised mock generators
│   ├── authHelper.js                 # JWT token generation for tests
│   └── fsHelper.js                   # Filesystem test utilities
├── unit/
│   ├── config/                       # ConfigService, schemas, encryption
│   ├── controllers/                  # Controller unit tests
│   ├── middleware/                    # Auth, rate limiters, file upload, error handler
│   ├── outputs/                      # BaseOutput, OutputFactory, each strategy
│   ├── providers/                    # BaseProvider, ProviderFactory, each provider
│   ├── services/                     # Core and system services
│   ├── utils/                        # Utility functions
│   └── routes/                       # Route-level unit tests
└── integration/
    ├── routes/                       # Supertest API integration tests
    ├── securityHardening.test.js      # Security-specific integration tests
    └── logging.test.js               # Log pipeline tests
```

#### Test Naming Conventions

| Pattern              | Purpose                               | Example                                                         |
| -------------------- | ------------------------------------- | --------------------------------------------------------------- |
| `*.test.js`          | Standard test file                    | `prayerTimeService.test.js`                                     |
| `*_Extended.test.js` | Extended coverage for complex modules | `FileManagerView_Extended.test.jsx`                             |
| `*_security.test.js` | Security-focused tests                | `fileUpload_security.test.js`, `ConfigService_security.test.js` |

#### Using the Mock Factory

Always use `mockFactory.js` for core service mocks. Never create ad-hoc mocks for services that the factory already covers:

```javascript
const {
  createMockConfigService,
  createMockPrayerTimeService,
  createMockSchedulerService,
  createMockAutomationService,
  createMockSSEService,
  createMockAudioAssetService,
  createMockHealthCheck,
  createMockConfig,
  createMockProvider,
  createMockProviderFactory,
  createMockEnvManager,
  createMockAuthUtils,
  createMockDiagnosticsService,
} = require("../helpers/mockFactory");

// Use with custom overrides
const mockConfig = createMockConfig({
  location: { timezone: "Asia/Riyadh", coordinates: { lat: 24.7, long: 46.7 } },
});
const mockConfigService = createMockConfigService(mockConfig);
```

#### Authenticated Test Requests

For integration tests that require authentication, use `authHelper.js`:

```javascript
const authHelper = require("../helpers/authHelper");
const request = require("supertest");

it("should return settings for authenticated user", async () => {
  const response = await request(app)
    .get("/api/settings")
    .set("Cookie", authHelper.getAuthToken());

  expect(response.status).toBe(200);
});
```

#### Key Testing Rules

1. **Mock all externals** — file system, network requests, and system time must be mocked in unit tests
2. **Use the factory** — `mockFactory.js` provides standardised mocks for all core services
3. **Temporary directories** — integration tests use temporary directories for config/data files to avoid corrupting local state
4. **Path aliases work in tests** — Jest is configured with `moduleNameMapper` to resolve `@services/`, `@config`, etc.
5. **Debug output** — set `DEBUG=true` environment variable to un-suppress console output during test runs

### Frontend Tests (Vitest)

- **Framework**: Vitest
- **Config**: `.config/vitest.config.mjs`
- **Environment**: jsdom
- **Setup file**: `client/tests/setup.js` — imports `@testing-library/jest-dom` for DOM matchers

```bash
# Run all frontend tests
npm run test:client

# Run with coverage report
npm run test:client:coverage
```

#### Directory Structure

```
client/tests/
├── setup.js                          # Imports @testing-library/jest-dom
└── unit/
    ├── hooks/                        # Hook tests (usePrayerTimes, useAuth, useSSE, etc.)
    ├── views/                        # View component tests
    │   ├── DashboardView.test.jsx
    │   ├── LoginView.test.jsx
    │   ├── SetupView.test.jsx
    │   ├── ConnectionErrorView.test.jsx
    │   └── settings/                 # Settings view tests
    └── components/
        └── settings/                 # Settings component tests
```

#### Frontend Test Patterns

- Use `@testing-library/react` for rendering and interaction
- Use `vi.fn()` and `vi.mock()` for mocking (Vitest equivalents of Jest's `jest.fn()` and `jest.mock()`)
- Global test utilities (`describe`, `it`, `expect`, `vi`) are available without imports (Vitest `globals: true`)
- The `@/` path alias resolves correctly in tests via Vitest's `resolve.alias` configuration

### Coverage Reports

```bash
# Backend coverage — generates coverage/ directory
npm run test:src:coverage

# Frontend coverage — uses V8 provider
npm run test:client:coverage
```

Open `coverage/lcov-report/index.html` (backend) or the Vitest coverage output (frontend) to view the detailed breakdown.

---

## Extending Prayer Providers

The dashboard uses a **Factory Pattern** for prayer time sources. New providers are automatically discovered by the frontend — no UI code changes are required.

### Step 1: Create the Provider Class

Create a new file in `src/providers/` extending `BaseProvider`:

```javascript
// src/providers/IslamicFinderProvider.js

const BaseProvider = require("./BaseProvider");

class IslamicFinderProvider extends BaseProvider {
  /**
   * Returns metadata describing this provider for UI discovery.
   * @returns {Object} Provider metadata.
   */
  static getMetadata() {
    return {
      id: "islamicfinder",
      label: "IslamicFinder",
      description: "Prayer times from IslamicFinder.org API",
      requiresCoordinates: true,
      parameters: [
        {
          key: "apiKey",
          type: "password", // text | number | select | password
          label: "API Key",
          sensitive: true, // Stripped from local.json, stored in .env
          constraints: { required: true },
        },
        {
          key: "juristic",
          type: "select",
          label: "Juristic Method",
          sensitive: false,
          constraints: {
            options: [
              { value: 0, label: "Shafi / Hanbali / Maliki" },
              { value: 1, label: "Hanafi" },
            ],
          },
        },
      ],
    };
  }

  /**
   * Fetches annual prayer times for the given year.
   * Uses deduplicateRequest to prevent concurrent fetches for the same year.
   * @param {number} year - The year to fetch.
   * @returns {Promise<Object>} Prayer times keyed by date (YYYY-MM-DD).
   */
  async getAnnualTimes(year) {
    const key = `islamicfinder-${year}`;
    return this.deduplicateRequest(key, async () => {
      const { lat, long } = this.globalConfig.location.coordinates;
      const apiKey = this.sourceConfig.apiKey;

      // Fetch from external API...
      // Return normalised format: { '2026-01-01': { Fajr: '06:15', ... }, ... }
    });
  }

  /**
   * Verifies API connectivity and credentials.
   * @returns {Promise<{healthy: boolean, message: string}>} Health status.
   */
  async healthCheck() {
    try {
      // Test API reachability...
      return { healthy: true, message: "IslamicFinder API reachable" };
    } catch (err) {
      return { healthy: false, message: err.message };
    }
  }
}

module.exports = IslamicFinderProvider;
```

### Step 2: Register in the Factory

Open `src/providers/ProviderFactory.js` and add the registration:

```javascript
const IslamicFinderProvider = require("./IslamicFinderProvider");

// Add alongside existing registrations
ProviderFactory.register("islamicfinder", IslamicFinderProvider);
```

### Step 3: Verify

1. Restart the backend
2. Navigate to Settings → General → Prayer Source
3. The new provider appears in the source dropdown with its configured parameters
4. The `SourceConfigurator` and `DynamicField` frontend components render the appropriate input fields automatically based on `getMetadata()`

### Provider API Contract

| Method                        | Required  | Description                                                                  |
| ----------------------------- | --------- | ---------------------------------------------------------------------------- |
| `static getMetadata()`        | **Yes**   | Returns `{ id, label, description, requiresCoordinates, parameters: [...] }` |
| `async getAnnualTimes(year)`  | **Yes**   | Returns prayer times object keyed by date string                             |
| `async healthCheck()`         | **Yes**   | Returns `{ healthy: boolean, message: string }`                              |
| `deduplicateRequest(key, fn)` | Inherited | Prevents concurrent identical requests (use in `getAnnualTimes`)             |

### Parameter Types

| `type` Value | Rendered As    | Notes                                                  |
| ------------ | -------------- | ------------------------------------------------------ |
| `text`       | Text input     | General string values                                  |
| `number`     | Numeric input  | Respects `constraints.min`, `constraints.max`          |
| `select`     | Dropdown       | Requires `constraints.options: [{ value, label }]`     |
| `password`   | Password input | Value masked in UI, `sensitive: true` stores in `.env` |

---

## Adding an Output Integration

The audio output system uses a **Strategy Pattern** via `OutputFactory`. Like providers, new outputs are automatically discovered by the frontend.

### Step 1: Create the Output Strategy

Create a new file in `src/outputs/` extending `BaseOutput`:

```javascript
// src/outputs/MqttOutput.js

const BaseOutput = require("./BaseOutput");

class MqttOutput extends BaseOutput {
  /**
   * Returns metadata for UI discovery and configuration rendering.
   * @returns {Object} Strategy metadata.
   */
  static getMetadata() {
    return {
      id: "mqtt", // Unique identifier
      label: "MQTT Broker", // Display name in UI
      timeoutMs: 5000, // Execution timeout
      defaultLeadTimeMs: 0, // Default lead time offset
      params: [
        {
          key: "brokerUrl",
          type: "string",
          label: "Broker URL",
          sensitive: false,
        },
        {
          key: "topic",
          type: "string",
          label: "Topic Prefix",
          sensitive: false,
        },
        { key: "username", type: "string", label: "Username", sensitive: true },
        { key: "password", type: "string", label: "Password", sensitive: true },
      ],
    };
  }

  /**
   * Executes the MQTT publish for a prayer event.
   * @param {Object} payload - Event payload { prayer, event, source: { url, filePath } }.
   * @param {Object} metadata - Execution metadata { isTest, ... }.
   * @param {AbortSignal} [signal] - Optional abort signal.
   * @returns {Promise<void>}
   */
  async execute(payload, metadata, signal) {
    // Publish to MQTT broker...
  }

  /**
   * Checks MQTT broker connectivity.
   * @param {Object} requestedParams - Configuration parameters to test with.
   * @returns {Promise<Object>} Health status.
   */
  async healthCheck(requestedParams) {
    try {
      // Test broker connection...
      return { healthy: true, message: "MQTT broker reachable" };
    } catch (err) {
      return { healthy: false, message: err.message };
    }
  }

  /**
   * Verifies MQTT credentials.
   * @param {Object} credentials - The credentials to verify.
   * @returns {Promise<Object>} Verification result.
   */
  async verifyCredentials(credentials) {
    // Verify authentication against broker...
    return { success: true };
  }
}

module.exports = MqttOutput;
```

### Step 2: Register in the Index

Open `src/outputs/index.js` and add the require statement:

```javascript
const MqttOutput = require("./MqttOutput");

// Registration happens automatically via OutputFactory.register()
OutputFactory.register(MqttOutput);
```

> **Note:** Unlike providers, output registration passes the **class itself** (not a string ID). The factory reads the `id` from `getMetadata()`.

### Step 3: Verify

1. Restart the backend
2. Navigate to Settings → Automation → Outputs
3. The new output appears as a configuration card with fields from `getMetadata().params`
4. No frontend code changes are required

### Output API Contract

| Method                                     | Required  | Description                                                          |
| ------------------------------------------ | --------- | -------------------------------------------------------------------- |
| `static getMetadata()`                     | **Yes**   | Returns `{ id, label, timeoutMs, defaultLeadTimeMs, params: [...] }` |
| `async execute(payload, metadata, signal)` | **Yes**   | Performs the output action (play audio, send request, etc.)          |
| `async healthCheck(requestedParams)`       | **Yes**   | Tests connectivity with given parameters                             |
| `async verifyCredentials(credentials)`     | **Yes**   | Validates credentials independently                                  |
| `validateTrigger(trigger, context)`        | Optional  | Returns `string[]` of warnings for a trigger configuration           |
| `async validateAsset(filePath, metadata)`  | Optional  | Validates audio file compatibility; defaults to `{ valid: true }`    |
| `augmentAudioMetadata(metadata)`           | Optional  | Returns additional metadata properties for audio files               |
| `getSecretRequirementKeys()`               | Inherited | Auto-extracts `sensitive: true` param keys from metadata             |

### Provider vs Output Registration Comparison

| Aspect       | Provider                                | Output                              |
| ------------ | --------------------------------------- | ----------------------------------- |
| Base class   | `BaseProvider`                          | `BaseOutput`                        |
| Factory      | `ProviderFactory`                       | `OutputFactory`                     |
| Registration | `ProviderFactory.register('id', Class)` | `OutputFactory.register(Class)`     |
| ID source    | Passed as first argument                | Read from `Class.getMetadata().id`  |
| Discovery    | `GET /api/system/providers`             | `GET /api/system/outputs`           |
| Frontend     | `SourceConfigurator` renders fields     | Output cards rendered automatically |

---

## Configuration System

### How Configuration Works

All configuration flows through `ConfigService` (a singleton). Never read `local.json` or `default.json` directly:

```javascript
const configService = require("@config/ConfigService");

// Read current configuration
const config = configService.get();

// Update configuration (validates via Zod, encrypts secrets, saves atomically)
await configService.update({ prayers: { fajr: { iqamahOffset: 25 } } });
```

### Schema Validation

Configuration is validated against Zod schemas defined in `src/config/schemas.js`. Any change to the configuration shape requires:

1. Updating the schema in `schemas.js`
2. Adding a migration in `migrationService.js` (if the change is not backwards-compatible)
3. Updating defaults in `default.json` (if new fields need default values)

See [09-configuration-reference.md](./09-configuration-reference.md) for the complete schema documentation.

### Config Migration System

The migration system in `src/services/system/migrationService.js` automatically upgrades configuration files from older schema versions. Migrations are sequential and additive:

```
V1 → V2 → V3 → V4 → V5 (current)
```

| Migration | Description                                                       |
| --------- | ----------------------------------------------------------------- |
| V1 → V2   | Legacy VoiceMonkey settings → Output Strategy format              |
| V2 → V3   | Global calculation settings → primary source parameters (Aladhan) |
| V3 → V4   | Added `system.healthChecks` block                                 |
| V4 → V5   | Added `security.tokenVersion` block                               |

#### Writing a New Migration

To add a V5 → V6 migration:

1. Add the migration method to `MigrationService`:

```javascript
migrateV5toV6(config) {
    const v6Config = { ...config, version: 6 };

    // Add new fields with sensible defaults
    if (!v6Config.myNewSection) {
        v6Config.myNewSection = { enabled: false };
    }

    return v6Config;
}
```

2. Add the migration step to `migrateConfig()`:

```javascript
if (newConfig.version === 5) {
  newConfig = this.migrateV5toV6(newConfig);
}
```

3. Update the Zod schema to include the new fields
4. Update `default.json` with defaults for the new section

---

## Known Issues and Limitations

- **Audio Hardware on Docker Desktop** — Mapping `/dev/snd` for the Local output relies on Linux ALSA. Windows and macOS users cannot use the Local target effectively under Docker.
- **VoiceMonkey Latency** — Alexa announcements depend on VoiceMonkey's cloud API, which introduces 1–3 seconds of latency.
- **Storage Quota Scanning** — The virtual quota system uses recursive directory scanning in `src/public/audio/`, which may be slow if thousands of files are uploaded (unlikely in typical use).
- **MyMasjid Year Boundary** — Unlike the Aladhan source (which supports querying specific years), MyMasjid data is fetched relative to the current system year. On **31 December after Isha**, the system cannot look ahead to 1 January until the server clock crosses midnight. The "Next Prayer" countdown temporarily disappears during this window and reappears at 00:00.
- **BaseOutput Duplicated Methods** — `healthCheck`, `verifyCredentials`, `validateTrigger`, `validateAsset`, and `augmentAudioMetadata` each appear twice in `BaseOutput.js`. Do not add further duplicates; a cleanup is planned.
- **Ghost Alias** — The `@adapters/` path alias is registered in `package.json` but the directory does not exist. Do not create it without intentional design.

---

## Future Improvements

- **Multi-User Support** — Currently limited to a single admin account. Future work could introduce read-only viewer roles.
- **MQTT Integration** — Support for publishing to MQTT topics for broader smart home integration (Home Assistant, Node-RED).
- **PWA Support** — Converting the frontend into a Progressive Web App for improved offline resilience on kiosk tablets.
- **Provider-Specific Caching** — Per-provider cache TTL policies rather than the current global `staleCheckDays` setting.

---

## Contributing

1. Fork the repository
2. Create a feature branch from `develop`
3. Ensure all code passes linting: `npm run lint`
4. Ensure all tests pass: `npm run test:src && npm run test:client`
5. Write tests for new functionality — use `mockFactory.js` for backend mocks
6. Follow the JSDoc requirements for your layer (backend: all functions; frontend: hooks only)
7. Submit a Pull Request with a clear description of the change and its motivation

### Pull Request Checklist

- [ ] Code follows existing patterns and conventions
- [ ] JSDoc is present on all new functions (backend) or hooks (frontend)
- [ ] New provider/output includes `getMetadata()` for frontend auto-discovery
- [ ] Tests cover the happy path and at least one error case
- [ ] No `console.log` in backend code (use `@utils/logger`)
- [ ] Linting passes (`npm run lint`)
- [ ] Backend tests pass (`npm run test:src`)
- [ ] Frontend tests pass (`npm run test:client`)
