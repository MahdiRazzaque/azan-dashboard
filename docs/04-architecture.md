# 4. Project Architecture

This document describes the technology stack, design patterns, and structural organisation of the Azan Dashboard. It covers the backend, frontend, and TTS microservice, as well as the data persistence layer and extension points.

![System Architecture Diagram](./images/architecture-diagram.png)
_Figure 1: High-level system architecture showing the three components and their interactions._

## Technology Stack

### Backend

| Technology             | Purpose                                                |
| :--------------------- | :----------------------------------------------------- |
| **Node.js v22+**       | Runtime environment                                    |
| **Express 5**          | REST API framework and static file serving             |
| **node-schedule**      | Precision job scheduling for prayer events             |
| **Zod**                | Runtime schema validation for all configuration        |
| **Winston**            | Structured logging (`@utils/logger`)                   |
| **jsonwebtoken**       | JWT generation and verification for authentication     |
| **express-rate-limit** | Tiered rate limiting across all API endpoints          |
| **Helmet**             | HTTP security headers                                  |
| **Multer**             | Multipart file upload handling                         |
| **Bottleneck**         | Concurrency control for file system and TTS operations |
| **module-alias**       | Path aliases (`@services`, `@config`, `@utils`, etc.)  |
| **Luxon**              | Date and time manipulation (IANA timezone-aware)       |

- **Module System:** CommonJS (`require` / `module.exports`)
- **Entry Point:** `src/server.js`

### Frontend

| Technology                | Purpose                                           |
| :------------------------ | :------------------------------------------------ |
| **React 18**              | UI component framework                            |
| **Vite**                  | Build tool and development server with HMR        |
| **Tailwind CSS**          | Utility-first CSS framework                       |
| **React Router v7**       | Client-side routing with nested layouts           |
| **Luxon**                 | Date and time formatting                          |
| **lucide-react**          | Icon library (exclusive — no other icon packages) |
| **react-hot-toast**       | User notification toasts                          |
| **driver.js**             | Guided onboarding tours                           |
| **clsx + tailwind-merge** | Conditional CSS class merging (`cn()` utility)    |

- **Module System:** ES Modules (`import` / `export`)
- **Entry Point:** `client/src/main.jsx`
- **Path Alias:** `@/` maps to `client/src/` (configured in Vite)

### TTS Microservice

| Technology       | Purpose                             |
| :--------------- | :---------------------------------- |
| **Python 3.11+** | Runtime                             |
| **FastAPI**      | HTTP API framework                  |
| **Uvicorn**      | ASGI server                         |
| **edge-tts**     | Microsoft Neural TTS engine wrapper |

- **Entry Point:** `src/microservices/tts/server.py`
- **Endpoints:** `/voices`, `/generate-tts`, `/preview-tts`

### Storage

The system uses file-based persistence exclusively — no database is required.

| Store              | Location                  | Format | Purpose                                              |
| :----------------- | :------------------------ | :----- | :--------------------------------------------------- |
| **Configuration**  | `config/local.json`       | JSON   | User settings (validated against Zod schema)         |
| **Secrets**        | `config/.env`             | Dotenv | Passwords, JWT secret, encryption salt, API tokens   |
| **Defaults**       | `src/config/default.json` | JSON   | Hardcoded fallback values (committed to repository)  |
| **Prayer Cache**   | `data/cache.json`         | JSON   | Cached prayer times keyed by ISO date (`YYYY-MM-DD`) |
| **Custom Audio**   | `public/audio/custom/`    | MP3    | User-uploaded audio files                            |
| **TTS Cache**      | `public/audio/cache/`     | MP3    | Generated speech audio files                         |
| **Audio Metadata** | `src/public/audio/`       | JSON   | Sidecar metadata files (not publicly served)         |

---

## Backend Architecture

The backend follows a strict **Controller → Service → Route** layered architecture to separate concerns.

### Directory Structure

```
src/
├── server.js                        # Startup orchestration
├── config/
│   ├── ConfigService.js             # Singleton: load, validate, encrypt, save
│   ├── schemas.js                   # Zod schemas for all config sections
│   └── default.json                 # Default configuration values
├── routes/
│   ├── index.js                     # Mounts sub-routers, applies global middleware
│   ├── auth.js                      # /api/auth endpoints
│   ├── system.js                    # /api/system endpoints
│   ├── settings.js                  # /api/settings endpoints
│   └── prayers.js                   # /api/prayers endpoints
├── controllers/
│   ├── authController.js            # Authentication logic
│   ├── systemController.js          # System diagnostics, TTS, jobs, outputs
│   ├── settingsController.js        # Configuration CRUD, file uploads
│   ├── prayerController.js          # Prayer time retrieval
│   └── envController.js             # Environment variable updates
├── services/
│   ├── core/                        # Business logic
│   │   ├── prayerTimeService.js     # Fetch, cache, year-boundary refresh
│   │   ├── schedulerService.js      # node-schedule job management
│   │   ├── automationService.js     # Trigger execution pipeline
│   │   └── validationService.js     # Cross-service validation
│   └── system/                      # Infrastructure
│       ├── audioAssetService.js     # TTS generation, metadata, cache cleanup
│       ├── voiceService.js          # Voice list cache, TTS proxy
│       ├── storageService.js        # Disk usage monitoring
│       ├── healthCheck.js           # Multi-check health aggregation
│       ├── sseService.js            # Server-Sent Events for live logs
│       ├── migrationService.js      # Config schema version migrations
│       ├── assetMigrationService.js # Legacy audio file migrations
│       ├── diagnosticsService.js    # Runtime diagnostics aggregation
│       └── configurationWorkflowService.js # Settings update orchestration
├── providers/                       # Prayer time data sources (Factory pattern)
├── outputs/                         # Audio output targets (Strategy pattern)
├── middleware/                      # Express middleware
└── utils/                           # Shared utilities
```

### Layer Responsibilities

#### 1. Route Layer (`src/routes/`)

Defines HTTP endpoints, applies middleware, and delegates to controllers.

- **Global Middleware** (applied in `routes/index.js`):
  - No-cache headers on all API responses
  - Global read rate limiter (GET requests)
  - Global write rate limiter (POST/PUT/DELETE requests)
- **Per-Route Middleware:** Authentication (`verifyToken`), security rate limiter, operations rate limiter, file upload (`multer`), storage check
- **Responsibility:** Receives the HTTP request, applies middleware, delegates to the controller

#### 2. Controller Layer (`src/controllers/`)

Orchestrates the business logic flow for each endpoint.

- **Responsibility:** Calls the necessary services, formats the HTTP response, and handles high-level errors
- **Convention:** Controllers do **not** contain core business logic (e.g., calculation algorithms). They coordinate service calls.

#### 3. Service Layer (`src/services/`)

Contains the core business logic and reusable functions, organised into two sub-domains:

**Core Services** (`src/services/core/`):

| Service             | Responsibility                                                                                          |
| :------------------ | :------------------------------------------------------------------------------------------------------ |
| `prayerTimeService` | Fetches prayer data from providers, applies Iqamah offsets and rounding, manages the annual cache       |
| `schedulerService`  | Creates and manages `node-schedule` jobs for each prayer event; handles midnight refresh and hot-reload |
| `automationService` | Executes trigger events, resolves audio sources, dispatches to output targets                           |
| `validationService` | Cross-service validation logic                                                                          |

**System Services** (`src/services/system/`):

| Service                        | Responsibility                                                                                   |
| :----------------------------- | :----------------------------------------------------------------------------------------------- |
| `audioAssetService`            | TTS template resolution, audio generation requests, sidecar metadata management, cache cleanup   |
| `voiceService`                 | Caches available TTS voices from the Python microservice                                         |
| `storageService`               | Monitors disk usage against configured quota                                                     |
| `healthCheck`                  | Runs startup health checks and aggregates runtime status for Local Audio, TTS, and external APIs |
| `sseService`                   | Manages Server-Sent Events connections for real-time log streaming and audio triggers            |
| `migrationService`             | Automatically migrates configuration schema changes across versions on startup                   |
| `configurationWorkflowService` | Orchestrates the settings update flow: validate → save → sync audio → reinitialise scheduler     |

#### 4. Middleware Layer (`src/middleware/`)

| Middleware        | Purpose                                                                        |
| :---------------- | :----------------------------------------------------------------------------- |
| `auth.js`         | JWT verification via HttpOnly cookies; checks `tokenVersion` against config    |
| `errorHandler.js` | Centralised Express error handler (formats consistent error responses)         |
| `rateLimiters.js` | Five-tier rate limiting (Security, Operations, Global Read, Global Write, SSE) |
| `fileUpload.js`   | Multer configuration for MP3 uploads with magic byte validation                |
| `storageCheck.js` | Rejects write operations when disk quota is exceeded                           |
| `asyncHandler.js` | Wraps async route handlers to forward errors to the error middleware           |

---

## Frontend Architecture

The frontend is a Single Page Application (SPA) built with React 18 and served as static files by the Express backend in production.

### Directory Structure

```
client/src/
├── main.jsx                         # Entry point, context provider hierarchy
├── App.jsx                          # Route definitions, core hook orchestration
├── contexts/
│   ├── AuthContext.jsx              # Login state, setup detection
│   ├── SettingsContext.jsx          # Config fetching, draft state, validation
│   └── ClientPreferencesContext.jsx # Device-local UI preferences (localStorage)
├── views/
│   ├── DashboardView.jsx            # Main prayer timetable display
│   ├── LoginView.jsx                # Admin login form
│   ├── SetupView.jsx                # First-run password setup
│   ├── ConnectionErrorView.jsx      # Offline/error fallback
│   └── settings/                    # Admin panel sub-views
│       ├── GeneralSettings.jsx
│       ├── CredentialsSettings.jsx
│       ├── PrayerSettings.jsx
│       ├── AutomationSettings.jsx
│       ├── FileManagerSettings.jsx
│       └── DeveloperSettings.jsx
├── components/
│   ├── dashboard/                   # PrayerCard, FocusCard
│   ├── settings/                    # TriggerCard, OutputStrategyCard, SourceConfigurator, VoiceLibrary, DynamicField
│   ├── common/                      # ConfirmModal, SaveProcessModal, AudioTestModal, SearchableSelect, PasswordInput
│   └── layout/                      # SettingsLayout, ProtectedRoute
├── hooks/                           # Custom React hooks (see inventory below)
├── config/                          # tourSteps.js (onboarding tour definitions)
├── styles/                          # Tailwind extensions, CSS variable theming
└── utils/                           # Shared utilities (cn, formatters)
```

### Routing Structure

| Path                    | Component             | Access    | Description                              |
| :---------------------- | :-------------------- | :-------- | :--------------------------------------- |
| `/`                     | `DashboardView`       | Public    | Main prayer timetable and focus clock    |
| `/login`                | `LoginView`           | Public    | Admin authentication                     |
| `/setup`                | `SetupView`           | Public    | First-run password creation              |
| `/settings`             | `SettingsLayout`      | Protected | Admin panel wrapper (sidebar navigation) |
| `/settings/general`     | `GeneralSettings`     | Protected | Source selection, location, timezone     |
| `/settings/credentials` | `CredentialsSettings` | Protected | API tokens and env vars                  |
| `/settings/prayers`     | `PrayerSettings`      | Protected | Per-prayer Iqamah offsets and rounding   |
| `/settings/automation`  | `AutomationSettings`  | Protected | Trigger configuration, output targets    |
| `/settings/files`       | `FileManagerSettings` | Protected | Audio file uploads and management        |
| `/settings/developer`   | `DeveloperSettings`   | Protected | Live logs, jobs, storage, health checks  |

### Context Provider Hierarchy

Contexts are wrapped in `main.jsx` in a specific order — outer contexts are available to inner ones:

```
AuthContext          →  Login state, setup detection
  └─ SettingsContext     →  Config fetching, draft state tracking, save workflow
      └─ ClientPreferencesContext  →  Device-local UI prefs (theme, clock format, mute)
```

- **`AuthContext`**: Manages authentication status, detects whether the system requires initial setup, provides `login()` / `logout()` methods.
- **`SettingsContext`**: Fetches the full configuration from the API, maintains a "draft" copy for in-progress edits, tracks dirty state, and orchestrates the save workflow.
- **`ClientPreferencesContext`**: Persists per-device preferences (dark mode, 12/24-hour clock, Arabic prayer names, mute state) to `localStorage`. These preferences do not touch the server.

### Hook Inventory

| Hook                   | Purpose                                                                          |
| :--------------------- | :------------------------------------------------------------------------------- |
| `useSettings`          | Consumes `SettingsContext` — most widely used hook (27 importers)                |
| `useAuth`              | Consumes `AuthContext` (21 importers)                                            |
| `usePrayerTimes`       | Fetches prayer data, manages calendar navigation state, handles midnight refresh |
| `useClientPreferences` | Consumes `ClientPreferencesContext` for device-local UI prefs                    |
| `useSSE`               | Establishes Server-Sent Events connection for real-time logs and audio triggers  |
| `useAudio`             | Web Audio API playback for browser-based announcements                           |
| `useWakeLock`          | Screen Wake Lock API for kiosk/signage deployments (requires HTTPS)              |
| `useMidnightObserver`  | Fires a callback at local midnight for date transitions                          |
| `useProviders`         | Extracts provider metadata from settings context                                 |
| `useConstants`         | Fetches system constants from the `GET /api/system/constants` endpoint           |
| `useTour`              | Wraps `driver.js` for guided onboarding tours with consistent theming            |

### Data Flow Pattern

`App.jsx` acts as the orchestrator: it initialises core hooks (`usePrayerTimes`, `useSSE`, `useAudio`, `useWakeLock`, `useMidnightObserver`) and passes their results as **props** to view components. This "props over context" approach keeps data flow explicit and traceable.

```
App.jsx (hook orchestration)
  ├── DashboardView     ← receives prayerData, audioState as props
  ├── LoginView         ← receives auth actions as props
  └── SettingsLayout    ← settings context consumed internally
        ├── GeneralSettings
        ├── AutomationSettings
        └── ...
```

### Theming

Tailwind is extended with semantic colour tokens that map to CSS custom properties:

- `app-bg`, `app-card`, `app-text`, `app-border`, etc.
- Dark/light mode is toggled by `ClientPreferencesContext`, which adds/removes a CSS class on the document root.

---

## Data Layer and Persistence

### Configuration Hierarchy

The `ConfigService` singleton loads settings in the following priority order (highest wins):

1. **Environment Variables** — Secrets (`VOICEMONKEY_TOKEN`) and infrastructure settings (`PORT`). These are **never** written to `local.json`.
2. **Local Override** (`config/local.json`) — User-defined settings saved via the UI. Validated against the Zod schema before persistence.
3. **Default Config** (`src/config/default.json`) — Hardcoded fallbacks committed to the repository.

![Configuration Hierarchy Diagram](./images/config-hierarchy-diagram.png)
_Figure 2: Configuration loading priority — environment variables override local overrides, which override defaults._

### Configuration Lifecycle

1. **Load:** `ConfigService` merges `default.json` ← `local.json` ← environment variables.
2. **Validate:** The merged result is validated against the Zod `configSchema`.
3. **Decrypt:** Encrypted fields (e.g., `VOICEMONKEY_TOKEN`) are decrypted using AES-256-GCM with the `ENCRYPTION_SALT`.
4. **Serve:** The validated configuration is available via `configService.get()`.
5. **Update:** Changes from the UI are validated, sensitive fields are encrypted, system secrets are stripped, and the result is atomically written to `local.json`.

### Data Caching

Prayer times are fetched annually (Aladhan) or in bulk (MyMasjid) and stored in `data/cache.json`.

- **Structure:** A map keyed by ISO date string (`YYYY-MM-DD`).
- **Stale Check:** The system considers data stale if the cache is older than `data.staleCheckDays` (default: 7 days).
- **Offline Resilience:** Once hydrated, the cache enables the dashboard to function for months without internet connectivity.
- **Force Refresh:** The `POST /api/settings/refresh-cache` endpoint discards the cache and re-fetches from the configured provider.

---

## Extension Points

### Provider Factory Pattern

New prayer time data sources are integrated via the **Factory** pattern:

```
BaseProvider (abstract)
  ├── AladhanProvider    → Geolocation-based calculation
  └── MyMasjidProvider   → Mosque-published timetable
```

Each provider implements:

- `getAnnualTimes(year)` — Returns a map of date → prayer times
- `static getMetadata()` — Returns a JSON schema describing the provider's capabilities, parameters, and UI rendering hints

Providers are registered in `ProviderFactory.js`. The frontend automatically discovers registered providers and renders configuration fields based on their metadata — no frontend code changes are required.

_For step-by-step extension instructions, see the [Development Guide](./08-development-guide.md#extending-prayer-providers)._

### Output Strategy Pattern

Audio output targets use a polymorphic **Strategy** pattern:

```
BaseOutput (abstract)
  ├── LocalOutput        → mpg123 playback on server hardware
  ├── BrowserOutput      → SSE broadcast to connected clients
  └── VoiceMonkeyOutput  → HTTP request to Alexa via VoiceMonkey API
```

Each output strategy implements:

- `execute(payload, metadata)` — Performs the audio playback action
- `healthCheck(requestedParams)` — Verifies hardware/API connectivity
- `verifyCredentials(credentials)` — Validates API tokens or device IDs
- `validateAsset(filePath, metadata)` — Checks audio file compatibility
- `static getMetadata()` — Returns strategy metadata (ID, label, timeout, parameters with sensitivity flags)

Strategies self-register via `OutputFactory.register()`. The frontend automatically renders configuration cards based on `getMetadata()`.

_For step-by-step extension instructions, see the [Development Guide](./08-development-guide.md#adding-an-output-integration)._

---

## Startup Sequence

The server startup sequence in `server.js` is **load-bearing** — changing the order may break assumptions between services.

```
1. Environment       →  Load .env, set process variables
2. ConfigService     →  Merge defaults + local + env, validate, decrypt
3. Health Checks     →  Initialise health cache (API, TTS, Audio connectivity)
4. Voice Service     →  Fetch and cache available TTS voices from Python microservice
5. Prayer Cache      →  Force refresh prayer data from configured provider
6. Audio Assets      →  Sync TTS files, ensure test audio exists, generate metadata for existing files
7. Asset Migration   →  Migrate legacy audio files to current directory structure
8. Scheduler         →  Create node-schedule jobs for today's prayer events
```

![Startup Sequence Diagram](./images/startup-sequence-diagram.png)
_Figure 3: Server startup sequence showing the ordered initialisation of services._

> [!IMPORTANT]
> The startup order is critical. For example, the scheduler depends on the prayer cache being populated, which depends on the configuration being loaded and validated. The audio asset sync depends on the voice service being initialised to generate TTS files.
