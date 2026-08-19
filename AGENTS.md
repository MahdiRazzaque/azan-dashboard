# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-10
**Commit:** e49f8fb
**Branch:** chore/update-azan-audio

## OVERVIEW

Mosque/smart-home digital signage: prayer times dashboard with automated audio announcements (Adhan/Iqamah) via TTS, local speakers, and Alexa. Monorepo: Express backend (`src/`), React frontend (`client/`), Python TTS microservice (`src/microservices/tts/`).

## STRUCTURE

```
├── src/                    # Express 5 backend (CommonJS) — see src/AGENTS.md
│   ├── server.js           # Entry point — startup orchestration, heavy init sequence
│   ├── config/             # ConfigService singleton, Zod schemas, JSON defaults — see src/config/AGENTS.md
│   ├── controllers/        # Request handlers — see src/controllers/AGENTS.md
│   ├── routes/             # Express routers → controllers
│   ├── services/           # See src/services/AGENTS.md
│   │   ├── core/           # Business logic: scheduler, prayer times, automation, validation
│   │   └── system/         # Infrastructure: voice, storage, health, SSE, audio assets, migration
│   ├── providers/          # Prayer time sources: BaseProvider → Aladhan, MyMasjid — see src/providers/AGENTS.md
│   ├── outputs/            # Audio targets: BaseOutput → Local, Browser, VoiceMonkey — see src/outputs/AGENTS.md
│   ├── middleware/         # Express middleware — see src/middleware/AGENTS.md
│   ├── utils/              # Shared utilities — see src/utils/AGENTS.md
│   └── microservices/tts/  # Python FastAPI + edge-tts — see src/microservices/tts/AGENTS.md
├── client/                 # React 18 + Vite + Tailwind (ES Modules)
│   ├── src/                # See client/src/AGENTS.md
│   └── tests/              # Vitest + Testing Library (mirrors src/ structure)
├── docker/                 # See docker/AGENTS.md
├── .config/                # All tool configs (eslint, jest, vitest, nodemon, supervisord)
├── docs/                   # 8-part documentation suite
├── data/                   # Persistent runtime data (config local.json copies, caches)
└── public/audio/           # Audio files: custom/, cache/, temp/
```

## WHERE TO LOOK

| Task                   | Location                                              | Notes                                                                          |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Prayer time logic      | `src/services/core/prayerTimeService.js`              | Fetch, cache, year-boundary refresh                                            |
| Scheduling/automation  | `src/services/core/schedulerService.js`               | node-schedule jobs                                                             |
| Audio trigger pipeline | `src/services/core/automationService.js`              | Target execution, audio validation                                             |
| Add prayer source      | `src/providers/`                                      | Extend `BaseProvider`, register in `ProviderFactory`                           |
| Add audio output       | `src/outputs/`                                        | Extend `BaseOutput`, register in `OutputFactory`                               |
| Config schema          | `src/config/schemas.js`                               | Zod schemas — change shape here, then add migration                            |
| Config loading         | `src/config/ConfigService.js`                         | Singleton, encryption, migration, atomic writes                                |
| Config save workflow   | `src/services/system/configurationWorkflowService.js` | 7-step update pipeline                                                         |
| TTS generation         | `src/services/system/audioAssetService.js`            | Template resolution, sidecar metadata                                          |
| TTS microservice       | `src/microservices/tts/server.py`                     | FastAPI, edge-tts, `/voices`, `/generate-tts`, `/preview-tts`                  |
| Frontend routing       | `client/src/App.jsx`                                  | React Router v7, protected routes                                              |
| API routes             | `src/routes/index.js`                                 | `/api/auth`, `/api/system`, `/api/settings`, `/api/prayers`, `/api/logs` (SSE) |
| Health checks          | `src/services/system/healthCheck.js`                  | Startup checks + runtime aggregation                                           |
| Real-time logs         | `src/services/system/sseService.js`                   | Server-Sent Events → `/api/logs`                                               |
| Storage management     | `src/services/system/storageService.js`               | Disk usage monitoring, quota checks                                            |
| Config migrations      | `src/services/system/migrationService.js`             | V1→V2→V3→V4→V5 schema upgrades                                                 |

## CONVENTIONS

- **JS only** — no TypeScript. Backend = CommonJS (`require`), frontend = ES Modules (`import`).
- **Path aliases** — Backend: `@services`, `@config`, `@utils`, `@controllers`, `@middleware`, `@routes`, `@providers`, `@outputs` (module-alias in `package.json`). Frontend: `@/` → `client/src/` (Vite).
- **JSDoc enforced** — Backend: all functions (ESLint rule). Frontend: hooks only (functions starting with `use`).
- **Zod validation** — Config schemas in `src/config/schemas.js`. No ad-hoc validation.
- **Factory + Strategy** — Providers and Outputs use abstract base class + factory registration. See `src/providers/AGENTS.md` and `src/outputs/AGENTS.md`.
- **Sidecar metadata** — Audio files in `public/audio/` paired with `.json` metadata files in parallel directory `src/public/audio/` (metadata not served by Express).
- **Config is environment-first** — Secrets stored in `.env`, stripped from `local.json` at save time. `ConfigService._stripSecrets()` enforces this.
- **CSS variables for theming** — Tailwind extended with `app-bg`, `app-card`, `app-text`, etc. mapped to CSS vars in `client/src/styles/`.
- **Private methods** — Prefixed with `_` in classes (e.g., `_stripSecrets`, `_loadSources`).
- **Bottleneck for concurrency** — `audioAssetService` and `systemController` use Bottleneck library for rate-limited parallel operations.

## ANTI-PATTERNS (THIS PROJECT)

- **No `as any` / `@ts-ignore`** — JS project, but avoid any type-unsafe hacks.
- **No secrets in local.json** — ConfigService strips them. Use `.env` only.
- **No direct `console.log` in backend** — Use `@utils/logger` (Winston-based).
- **`@adapters/` alias exists but dir doesn't** — Ghost alias in package.json. Don't create it without intent.
- **BaseOutput has duplicated methods** — `healthCheck`, `verifyCredentials`, `validateTrigger`, `validateAsset`, `augmentAudioMetadata` each appear twice. Don't add more duplicates.
- **No ad-hoc config reading** — Never read `default.json`/`local.json` directly. Use `configService.get()`.
- **No moment.js or raw Date** — Use `luxon` DateTime exclusively (both backend and frontend).
- **No prop-types in frontend** — Disabled via ESLint. Use JSDoc for hook type documentation.

## COMMANDS

```bash
# Development
npm run dev                    # Starts both backend (nodemon) + frontend (vite) concurrently
npm run server:dev             # Backend only (nodemon, watches src/)
npm run client:dev             # Frontend only (vite dev server on :5173, proxies /api to :3000)
npm run tts:start              # Python TTS microservice (manual, not needed in Docker)

# Testing
npm run test:src               # Backend: Jest 30 (--runInBand --forceExit)
npm run test:client            # Frontend: Vitest 4
npm run test:src:coverage      # Backend with coverage
npm run test:client:coverage   # Frontend with coverage

# Linting
npm run lint                   # ESLint (config in .config/eslint.config.mjs)

# Docker
npm run docker:up              # Standard deployment
npm run docker:build           # Build image
# Audio-enabled (Linux only):
docker compose -f docker/docker-compose.yml -f docker/docker-compose.audio.yml up -d
```

## ARCHITECTURE NOTES

- **Startup sequence matters** — `server.js` init order: env → config → health → voice → cache refresh → audio assets → migration → scheduler. Changing order may break assumptions.
- **Two deployment targets** — CI deploys to `azan.home.kg:3005` and `azan-dashboard.home.kg:3010` via SSH with hard `git reset` + env injection + Nginx reload.
- **Supervisord in Docker** — Runs Node.js backend (port 3000) + Python TTS (port 8000) as two processes in one container.
- **Config migration system** — `migrationService.js` auto-migrates config schema changes on startup (V1→V5).
- **Audio dual paths** — Served from `public/audio/` (Express static), metadata stored in `src/public/audio/` (not served).
- **Rate limiting** — Global read/write limiters + SSE-specific limiter. API responses set `no-cache` headers.
- **DNS rebinding protection** — `systemController.validateUrl` uses pinned DNS agents for URL validation.
- **13 CI workflows** — deploy, docker-build, lint, src-tests, client-tests, react-doctor, knip (unused deps), madge (circular deps), semgrep (security), hadolint (Dockerfile), bandit (Python security), pip-audit, npm-audit. All path-filtered.

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **azan-dashboard** (1968 symbols, 3796 relationships, 145 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/azan-dashboard/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool             | When to use                   | Command                                                                 |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------- |
| `query`          | Find code by concept          | `gitnexus_query({query: "auth validation"})`                            |
| `context`        | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})`                              |
| `impact`         | Blast radius before editing   | `gitnexus_impact({target: "X", direction: "upstream"})`                 |
| `detect_changes` | Pre-commit scope check        | `gitnexus_detect_changes({scope: "staged"})`                            |
| `rename`         | Safe multi-file rename        | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher`         | Custom graph queries          | `gitnexus_cypher({query: "MATCH ..."})`                                 |

## Impact Risk Levels

| Depth | Meaning                               | Action                |
| ----- | ------------------------------------- | --------------------- |
| d=1   | WILL BREAK — direct callers/importers | MUST update these     |
| d=2   | LIKELY AFFECTED — indirect deps       | Should test           |
| d=3   | MAY NEED TESTING — transitive         | Test if critical path |

## Resources

| Resource                                        | Use for                                  |
| ----------------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/azan-dashboard/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/azan-dashboard/clusters`       | All functional areas                     |
| `gitnexus://repo/azan-dashboard/processes`      | All execution flows                      |
| `gitnexus://repo/azan-dashboard/process/{name}` | Step-by-step execution trace             |

## Self-Check Before Finishing

Before completing any code modification task, verify:

1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
