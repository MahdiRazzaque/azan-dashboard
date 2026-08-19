# Code Formatting — Summary

**Branch:** `chore/code-formatting`
**Date:** 2026-04-14
**Prettier version:** 3.8.2

## What Was Done

Applied Prettier formatting across the entire codebase using default Prettier settings (no `.prettierrc` config file — intentional, uses Prettier defaults).

### Files Formatted

| Domain                           | Files                    |
| -------------------------------- | ------------------------ |
| Backend source (`src/`)          | 61                       |
| Backend tests (`src/tests/`)     | 78                       |
| Frontend source (`client/src/`)  | 63                       |
| Frontend tests (`client/tests/`) | 67                       |
| Docs / README                    | 10                       |
| Config / tooling                 | 17                       |
| CI workflows                     | 13 + 1 new               |
| **Total**                        | **310 modified + 1 new** |

### Infrastructure Changes

1. **`package.json` lint-staged** — Added `prettier --write` as first step before ESLint in all staged-file pipelines. Also:
   - Changed `package*.json` → `package.json` (exclude lock files — auto-generated, Prettier shouldn't touch them)
   - Changed `client/package*.json` → `client/package.json` (same reason)
   - Added `"*.{md,yml,css}": ["prettier --write"]` catch-all

2. **`.github/workflows/prettier.yml`** — New CI workflow. Runs `npx prettier --check .` on PRs/pushes when relevant files change. Separate from `lint.yml` which only runs ESLint.

### Verification

- ✅ `npx prettier --check .` — 0 violations on tracked files
- ✅ `npm run lint` — 0 errors (32 pre-existing JSDoc warnings, unchanged)
- ✅ Backend tests: **800 passed** (712 unit + 88 integration)
- ✅ Frontend tests: **572 passed** (64 test files)
- ✅ Zero regressions

### Commits

```
d312be8 ci(prettier): apply prettier formatting and add prettier CI workflow
38574c5 style(config): apply prettier formatting and update lint-staged config
3e1f805 style(docs): apply prettier formatting
64f8815 style(client/tests): apply prettier formatting
55f00cd style(client/src): apply prettier formatting
44dedff style(src/tests): apply prettier formatting
04e91b3 style(src): apply prettier formatting
```

### Excluded

- `checks/` — untracked (`.git/info/exclude`), contains non-JSON files with eslint error output
- `health-checks/` — untracked (`.git/info/exclude`), tooling artefacts
- `package-lock.json` / `client/package-lock.json` — auto-generated, not formatted
- Binary files (`.png`, `.ico`, `.svg`, `.mmd`) — not parseable by Prettier
