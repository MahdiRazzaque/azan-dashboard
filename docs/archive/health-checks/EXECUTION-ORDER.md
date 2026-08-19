# Health Check Remediation — Execution Order

## Overview

7 remediation prompts, executed **sequentially** in a fixed order. Each prompt must be completed, reviewed, and merged to `main` before the next one begins. Each prompt creates its own git worktree and branch.

## Prerequisites

- All 7 prompts are in `health-checks/prompts/<NN-name>/`
- Health check outputs are in `checks/` (32 files)
- Base branch: `main` (or whatever you want the worktrees branched from)
- Each prompt creates its own worktree and branch

## Sequential Order

| #   | Prompt                     | Subfolder                        | Branch                           | Tools                | Rationale                                                                                           |
| --- | -------------------------- | -------------------------------- | -------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| 01  | Dependency Vulnerabilities | `01-dependency-vulnerabilities/` | `fix/dependency-vulnerabilities` | npm audit, pip-audit | Foundation — updating deps changes the baseline for all subsequent prompts                          |
| 02  | Dockerfile Linting         | `02-dockerfile-linting/`         | `fix/dockerfile-linting`         | Hadolint             | Isolated to `docker/Dockerfile` — zero overlap, quick win                                           |
| 03  | Security Vulnerabilities   | `03-security-vulnerabilities/`   | `fix/security-vulnerabilities`   | Semgrep, Bandit      | Runs on updated deps; touches controllers/utils/encryption — before structural refactoring          |
| 04  | Circular Dependencies      | `04-circular-dependencies/`      | `fix/circular-dependencies`      | Madge                | Restructures imports — must precede deduplication since clone detection depends on import structure |
| 05  | Code Duplication           | `05-code-duplication/`           | `refactor/code-deduplication`    | jscpd                | Extracts shared code — must happen after circular deps but before dead code removal                 |
| 06  | Dead Code                  | `06-dead-code/`                  | `chore/remove-dead-code`         | Knip                 | Runs after deduplication since extracting shared code may expose new unused exports                 |
| 07  | Code Formatting            | `07-code-formatting/`            | `chore/code-formatting`          | Prettier, ESLint     | Touches ALL ~197 files — MUST run last so all prior changes get formatted in one pass               |

## Per-Prompt Workflow

Each prompt follows this standardised workflow:

1. **Phase 0:** Create worktree, copy `checks/` and `health-checks/`, run initial audit, create ledger
2. **Phase 1:** Fix loop — TDD workflow, GitNexus impact analysis after each fix
3. **Phase 2:** Full verification — re-audit + test suite
4. **Phase 2.5:** Code review loop — invoke `/code-review`, iterate until APPROVE
5. **Phase 3:** Commit, generate summary, copy ledger/summary back, remove worktree
6. **No PR** — output summary, wait for user approval

### Artefacts Per Prompt

Each prompt generates these files in its subfolder:

- `<LEDGER_FILE>.md` — Detailed tracking ledger
- `SUMMARY.md` — Post-completion report with: overview, files changed, remediation details, code review log, manual verification steps

### CI Workflows Created

Each prompt (except 07) creates GitHub Actions workflow(s):

| Prompt | Workflow(s) Created                                        |
| ------ | ---------------------------------------------------------- |
| 01     | `npm-audit.yml`, `pip-audit.yml`                           |
| 02     | `hadolint.yml`                                             |
| 03     | `semgrep.yml`, `bandit.yml`                                |
| 04     | `madge.yml`                                                |
| 05     | `jscpd.yml`                                                |
| 06     | `knip.yml`                                                 |
| 07     | `prettier.yml` (only if not already covered by `lint.yml`) |

## Conflict Matrix (Reference)

```
                01-Deps  02-Docker  03-Security  04-Circular  05-Dedup  06-Dead  07-Format
01-Deps           —        ✅          ✅           ✅          ✅        ✅       ✅
02-Docker        ✅         —          ✅           ✅          ✅        ✅       ✅
03-Security      ✅        ✅           —           ✅          ⚠️        ⚠️       ✅
04-Circular      ✅        ✅          ✅            —          ⚠️        ⚠️       ✅
05-Dedup         ✅        ✅          ⚠️           ⚠️           —        ❌       ✅
06-Dead          ✅        ✅          ⚠️           ⚠️          ❌         —       ✅
07-Format        ✅        ✅          ✅           ✅          ✅        ✅        —
```

- ✅ = No overlap, safe to run in any order
- ⚠️ = Minor potential overlap, sequential ordering resolves
- ❌ = Significant file overlap, must run in this order

## Execution Checklist

```
[ ] 01 — Dependency Vulnerabilities
    [ ] Run prompt: health-checks/prompts/01-dependency-vulnerabilities/01-dependency-vulnerabilities.md
    [ ] Review summary and approve
    [ ] Merge fix/dependency-vulnerabilities to main

[ ] 02 — Dockerfile Linting
    [ ] Run prompt: health-checks/prompts/02-dockerfile-linting/02-dockerfile-linting.md
    [ ] Review summary and approve
    [ ] Merge fix/dockerfile-linting to main

[ ] 03 — Security Vulnerabilities
    [ ] Run prompt: health-checks/prompts/03-security-vulnerabilities/03-security-vulnerabilities.md
    [ ] Review summary and approve
    [ ] Merge fix/security-vulnerabilities to main

[ ] 04 — Circular Dependencies
    [ ] Run prompt: health-checks/prompts/04-circular-dependencies/04-circular-dependencies.md
    [ ] Review summary and approve
    [ ] Merge fix/circular-dependencies to main

[ ] 05 — Code Duplication
    [ ] Run prompt: health-checks/prompts/05-code-duplication/05-code-duplication.md
    [ ] Review summary and approve
    [ ] Merge refactor/code-deduplication to main

[ ] 06 — Dead Code
    [ ] Run prompt: health-checks/prompts/06-dead-code/06-dead-code.md
    [ ] Review summary and approve
    [ ] Merge chore/remove-dead-code to main

[ ] 07 — Code Formatting
    [ ] Run prompt: health-checks/prompts/07-code-formatting/07-code-formatting.md
    [ ] Review summary and approve
    [ ] Merge chore/code-formatting to main

[ ] Post-completion: Re-run full health check suite to measure improvement
```

## Untracked File Reminder

Each prompt instructs the agent to:

1. **Copy `checks/` AND `health-checks/` into the worktree** — untracked files are not included by `git worktree add`
2. **Never stage or commit** `checks/`, `health-checks/`, or ledger files
3. **Copy ledger and summary back** to the main repo before removing the worktree

If you want permanent protection, add to `.gitignore`:

```
checks/
health-checks/
*_LEDGER.md
```
