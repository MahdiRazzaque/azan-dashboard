# React Frontend

React 18 + Vite + Tailwind + React Router v7. ES Modules. Entry: `main.jsx`.

## WHERE TO LOOK

| Task              | Location                      | Notes                                                  |
| ----------------- | ----------------------------- | ------------------------------------------------------ |
| Add page/route    | `views/` + `App.jsx`          | Create view, add `<Route>` in App                      |
| Add settings tab  | `views/settings/` + `App.jsx` | Nested route under `/settings`                         |
| Shared UI widget  | `components/common/`          | ConfirmModal, SearchableSelect, SaveProcessModal, etc. |
| Component details | `components/AGENTS.md`        | Full hierarchy, patterns, categories                   |
| Add custom hook   | `hooks/`                      | JSDoc required on all `use*` exports                   |
| Global state      | `contexts/`                   | AuthContext, SettingsContext, ClientPreferencesContext |
| Theming/colors    | `styles/` + CSS vars          | Tailwind maps `app-bg`, `app-text`, etc. to CSS vars   |
| API integration   | `hooks/` + `contexts/`        | Hooks fetch from `/api/*`, proxied to :3000 in dev     |

## KEY COMPONENTS

- **Views**: DashboardView, LoginView, SetupView, ConnectionErrorView, 6 settings views
- **Dashboard**: PrayerCard (individual prayer), FocusCard (next prayer countdown)
- **Settings**: VoiceLibrary (TTS voice browser), TriggerCard (automation config), SourceConfigurator, OutputStrategyCard, DynamicField (form renderer from strategy metadata)
- **Layout**: SettingsLayout (sidebar nav), ProtectedRoute (auth guard)
- **Common**: ConfirmModal, SaveProcessModal, AudioTestModal, SearchableSelect, PasswordInput

## COMPONENT HIERARCHY

App.jsx (hook orchestrator)
├── DashboardView ← props: prayerTimes, audio, SSE, preferences
│ ├── FocusCard ← next prayer countdown
│ └── PrayerCard[] ← individual prayer times
├── SettingsLayout ← layout wrapper with sidebar nav
│ ├── GeneralSettingsView
│ ├── CredentialsSettingsView
│ ├── PrayerSettingsView
│ ├── AutomationSettingsView
│ │ ├── AutomationGeneralTab
│ │ ├── AutomationOutputsTab
│ │ └── AutomationTriggersTab
│ ├── FileManagerView
│ └── DeveloperSettingsView
│ ├── DiagnosticsTab, HealthTab, SystemLogTab, ...
└── LoginView, SetupView, ConnectionErrorView

Data flows top-down: App.jsx centralizes hook calls (usePrayerTimes, useAudio, useSSE, useClientPreferences) and passes results as props. Settings views access config via useSettings() context.

## CONTEXT NESTING

AuthContext (outermost)
└── SettingsContext
└── ClientPreferencesContext (innermost)

- `AuthContext`: JWT auth state, login/logout methods, session validation
- `SettingsContext`: Server config with draft state, section tracking, validation, bulk save via configurationWorkflowService
- `ClientPreferencesContext`: Client-only UI preferences (theme, clock format, excluded events) persisted to localStorage

## SETTINGS ORGANIZATION

6 nested routes under `/settings`, each a dedicated view:

| Route                   | View                    | Key Components                                |
| ----------------------- | ----------------------- | --------------------------------------------- |
| `/settings`             | GeneralSettingsView     | Basic config fields                           |
| `/settings/credentials` | CredentialsSettingsView | API keys, passwords                           |
| `/settings/prayers`     | PrayerSettingsView      | SourceConfigurator                            |
| `/settings/automation`  | AutomationSettingsView  | TriggerCard, OutputStrategyCard, DynamicField |
| `/settings/files`       | FileManagerView         | File upload, compatibility analysis           |
| `/settings/developer`   | DeveloperSettingsView   | DiagnosticsTab, HealthTab, SystemLogTab       |

Save workflow: Draft state in SettingsContext → SaveProcessModal → API call → SSE progress updates → result.

## HOOKS INVENTORY

| Hook                 | Purpose                                         | Consumers          |
| -------------------- | ----------------------------------------------- | ------------------ |
| useSettings          | Config context consumer                         | 27 (most used)     |
| useAuth              | Auth context consumer                           | 21                 |
| usePrayerTimes       | Prayer fetching, calendar nav, midnight refresh | DashboardView      |
| useClientPreferences | Client-side UI prefs (localStorage)             | App, DashboardView |
| useSSE               | Server-Sent Events for logs + audio triggers    | App                |
| useAudio             | Web Audio API playback                          | App                |
| useWakeLock          | Screen wake lock for kiosk mode                 | App                |
| useMidnightObserver  | Triggers callback at local midnight             | App                |
| useProviders         | Provider metadata from settings context         | Settings views     |
| useConstants         | Fetches system constants from API               | Settings views     |
| useTour              | Driver.js onboarding tour                       | DashboardView      |

## CONVENTIONS

- **Props over context for data flow** — App.jsx orchestrates core hooks, passes data as props to views.
- **Class merging** — Use `cn()` utility (clsx + tailwind-merge) for conditional classes.
- **Icons** — `lucide-react` exclusively. No other icon libraries.
- **Toasts** — `react-hot-toast` for user notifications.
- **Date/time** — `luxon` (DateTime). No moment.js, no raw Date.
- **Context hierarchy** — `AuthContext` → `SettingsContext` → `ClientPreferencesContext` (wrapping order in main.jsx).
- **Vite proxy** — Dev server on :5173 proxies `/api` and `/public` to backend on :3000.

## PATTERNS

- **Settings save workflow** — Draft state → `SaveProcessModal` → API call → SSE progress → result display.
- **Controlled/uncontrolled dual-mode** — VoiceLibrary accepts external state via props OR manages internally.
- **Three-tier audio test** — Browser preview → server test (AudioTestModal) → output strategy verification.

## TESTING

- **Framework**: Vitest 4 + Testing Library + happy-dom (`npm run test:client`)
- **Structure**: `client/tests/unit/` mirrors `client/src/` directories.
- **Naming**: `*.test.js` / `*.test.jsx`, extended: `*_Extended.test.jsx`.
- **Alias**: `@` → `client/src/` in vitest config.
- **Coverage**: v8 provider.

## ANTI-PATTERNS

- **No prop-types** — Disabled via ESLint. Use JSDoc for type documentation on hooks.
- **Don't bypass contexts** — Access config via `useSettings()`, auth via `useAuth()`. Never fetch `/api/settings` directly from components.
- **No moment.js or raw Date** — Use `luxon` DateTime exclusively.
