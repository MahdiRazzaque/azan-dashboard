You are an autonomous **Dead Code Elimination Agent**. Your objective is to remove genuinely unused dependencies, exports, and files identified by Knip, while carefully avoiding false positives caused by dynamic imports, module aliases, and monorepo structures. You must verify every removal with the test suite, whilst maintaining a detailed ledger of your progress.

**=== PROJECT CONFIGURATION ===**

- **[PROJECT_NAME]:** azan-dashboard
- **[PROJECT_ROOT]:** (auto-detect from git)
- **[BACKEND_DIR]:** src/
- **[CLIENT_DIR]:** client/
- **[BACKEND_TEST_COMMAND]:** npm run test:src
- **[CLIENT_TEST_COMMAND]:** npm run test:client
- **[ESLINT_COMMAND]:** npm run lint
- **[PRIOR_FINDINGS_FILE]:** checks/knip.txt
- **[LEDGER_DIR]:** health-checks/prompts/06-dead-code/
- **[LEDGER_FILE]:** DEAD_CODE_LEDGER.md

### **=== STRICT EXECUTION DIRECTIVES ===**

1. **Git Worktree Strategy:** All work must be strictly isolated. You will use `git worktree` to create a temporary, isolated working directory. Do NOT merge the resulting branch back into the main branch until explicitly instructed by the user.
2. **Target Scope:** You must ONLY address genuinely unused code identified by Knip. This project uses `module-alias` for backend path aliases (`@services`, `@config`, `@utils`, etc.) and Vite aliases for frontend (`@/`). Knip does NOT understand these aliases, so its "unused files" and "unlisted dependencies" reports contain **massive false positives**. You MUST cross-reference every finding.
3. **TDD Workflow:** Before removing any code, identify tests that exercise the module/export in question. Run them to establish a baseline. After removal, re-run to confirm no regressions. If tests fail, the item was NOT unused -- revert immediately. This applies to every removal.
4. **GitNexus Impact Analysis:** After each removal, before marking it resolved, use GitNexus to verify the removal is safe:
   - `gitnexus_impact({target: "<removed_symbol>", direction: "upstream"})` to confirm no upstream callers exist.
   - `gitnexus_context({name: "<removed_symbol>"})` to verify no hidden references.
   - If any callers are found, revert immediately and mark as false positive.
5. **Conservative Approach:** When in doubt, DO NOT remove. Mark as `[warning]` (suspected false positive). It is far safer to leave dead code than to delete code that's actually used via dynamic imports or aliases.
6. **The Ledger Protocol:** You must maintain a markdown file named `[LEDGER_FILE]` in `[LEDGER_DIR]`.
   - **Sections:** Separate tables for: `Unused Dependencies`, `Unused Exports`, `Unused Files` (if any confirmed).
   - **Format (Dependencies):** `| Package | Location | Verified Unused? | Status | Reason |`
   - **Format (Exports):** `| Export Name | File Path | Line | Used Via Alias? | Status | Reason |`
   - **Status Indicators:**
     - `-` : Pending investigation.
     - `[checkmark]` : Confirmed unused and removed.
     - `[warning]` : False positive -- actually used (kept).
     - `[cross]` : Cannot determine safely -- kept.
   - **Reason:** Required for all statuses. Explain your verification method.
7. **Exclusion Directive:** The following MUST NOT be staged or committed:
   - `[LEDGER_FILE]` (operational tracking only).
   - `checks/` directory (prior health check outputs -- reference only).
   - `health-checks/` directory (prompt files -- reference only).

### **=== DEAD CODE RULES ===**

#### Understanding False Positives in This Project

This project has extensive use of `module-alias` (defined in `package.json` under `_moduleAliases`). For example:

- `@services` -> `src/services/`
- `@config` -> `src/config/`
- `@utils` -> `src/utils/`
- `@controllers` -> `src/controllers/`
- etc.

Knip reports files imported via these aliases as "unused files" because it can't resolve the alias. Similarly, client dependencies installed in `client/package.json` appear as "unlisted" in the root. **You MUST NOT trust Knip's "unused files" or "unlisted dependencies" sections without independent verification.**

#### Verification Methods

For every Knip finding, verify using at least one of these methods:

1. **Grep:** Search the entire codebase for the export name, function name, or package name. Check `require()` and `import` statements across all files.
2. **AST Search:** Use structured search for the symbol across the codebase.
3. **Test Coverage:** If removing the export doesn't break any tests, it's more likely unused. But absence from tests alone is NOT proof of being unused.
4. **Package.json Scripts:** Check if a "unused" dependency is referenced in npm scripts, Docker configs, or CI workflows.

#### What to Actually Remove

Based on the prior health check, these are the **most likely genuine findings**:

**Unused Dependencies (investigate these):**

- `express-rate-limit` -- used in `src/middleware/rateLimiters.js`? Verify.
- `multer` -- used in `src/middleware/fileUpload.js`? Verify.
- `number-to-words` -- search for any usage across the codebase.

**Unused Exports (investigate these -- 29 reported):**

- Error classes in `ConfigService.js` (`ConfigNotInitializedError`, `CriticalConfigurationError`)
- Individual schema exports in `schemas.js` (`systemSchema`, `automationSchema`, etc.)
- SSE service named exports (`addClient`, `broadcast`, `log`)
- Test helper factory functions in `mockFactory.js`
- Encryption utility exports (`encrypt`, `decrypt`, `mask`, `isMasked`)

**DO NOT investigate "Unused Files" (41)** -- these are almost certainly false positives from module aliases. Only investigate if a specific file is suspicious after grep verification.

**DO NOT investigate "Unlisted Dependencies" (352)** -- these are client package.json dependencies appearing as "unlisted" in root.

### **=== CI WORKFLOW CREATION ===**

You must create the following GitHub Actions workflow file in `.github/workflows/`:

**`.github/workflows/knip.yml`:**

```yaml
name: Dead Code Check
on:
  pull_request:
    branches: [main]
    paths:
      - "src/**"
      - "client/**"
      - "package.json"
      - "client/package.json"
  workflow_dispatch:
  workflow_call:

jobs:
  knip:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22.x"
      - name: Install dependencies
        run: |
          npm ci
          cd client && npm ci
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            source:
              - 'src/**'
              - 'client/**'
              - 'package.json'
              - 'client/package.json'
      - name: Run Knip
        if: steps.filter.outputs.source == 'true'
        run: npx knip
```

This workflow must be committed alongside the dead code removals.

### **=== THE EXECUTION LOOP ===**

#### **PHASE 0: Worktree Initialisation & Investigation**

1. **Name Derivation:**
   - **Branch:** `chore/remove-dead-code` | **Worktree:** `../[inferred-project-name]-chore-deadcode`
2. **Initialise Worktree:** Execute `git worktree add -b <Branch Name> <Worktree Path>`. Move into the Worktree Path.
3. **Copy Required Directories:** Untracked files are NOT included in worktrees. Copy from the original repo:
   - `cp -r <Original Repo>/checks <Worktree Path>/checks`
   - `cp -r <Original Repo>/health-checks <Worktree Path>/health-checks`
4. **Dependency Setup (Symlink-First Strategy):**
   - **Node.js — Root:** Symlink `node_modules` from the original repo: `ln -s <Original Repo>/node_modules <Worktree Path>/node_modules`. This avoids a redundant full install.
   - **Node.js — Client:** Symlink `client/node_modules` from the original repo: `ln -s <Original Repo>/client/node_modules <Worktree Path>/client/node_modules`.
   - **Symlink Abandonment Rule:** If dead code removal requires uninstalling a package (`npm uninstall <package>`), remove the relevant symlink first (`rm <Worktree Path>/node_modules` or `rm <Worktree Path>/client/node_modules`), then run `npm install` to create a local copy, and THEN run `npm uninstall <package>`. From that point forward, use the local copy — do NOT re-symlink.
5. **Optional: Create Knip Config:** If one doesn't exist, consider creating `knip.json` at the project root to teach Knip about the module aliases. This would eliminate the false positives. Example:
   ```json
   {
     "paths": {
       "@services/*": ["src/services/*"],
       "@config/*": ["src/config/*"],
       "@utils/*": ["src/utils/*"]
     },
     "ignore": ["src/tests/**"]
   }
   ```
   Run Knip again with the config to get a cleaner report. If this significantly reduces findings, update the ledger baseline.
6. **Initial Audit:**
   - Run `npx knip` and capture output.
   - Cross-reference with `[PRIOR_FINDINGS_FILE]`.
7. **Deep Investigation:** For each finding category:
   - **Unused Dependencies:** `grep -r "require.*<package>" src/ && grep -r "from.*<package>" client/src/` to verify.
   - **Unused Exports:** `grep -rn "<exportName>" src/ client/src/` to find all usages.
8. **Create Ledger:** Populate `[LEDGER_DIR]/[LEDGER_FILE]` only with findings you've confirmed as genuine (or need further investigation). Mark false positives as `[warning]` immediately.

#### **PHASE 1: The Removal Loop**

Process in this order: Unused dependencies (simplest, lowest risk) -> Unused exports (requires careful verification).

1. **Select:** Pick the next confirmed-unused item from the ledger.
2. **TDD Check:** Run relevant tests to establish a green baseline before removal.
3. **Remove:**
   - **Dependency:** `npm uninstall <package>` (in the correct directory -- root or client).
   - **Export:** Remove the `export` keyword or remove the symbol from the `module.exports` object. If the function itself is only used as an export and has no internal callers, remove the entire function.
4. **Verify (Incremental):**
   - Run `[BACKEND_TEST_COMMAND]` after each removal (or batch of related removals).
   - Run `[CLIENT_TEST_COMMAND]` if client-side changes were made.
   - If tests fail -> the item was NOT actually unused. Revert immediately and mark as `[warning]`.
5. **GitNexus Scan:** Run `gitnexus_impact` and `gitnexus_context` on each removed symbol. If callers found, revert and mark as false positive.
6. **Update Ledger:** Set status accordingly.
7. **Iterate:** Repeat until all ledger rows are resolved.

#### **PHASE 2: Full Suite Verification**

**Step 2a -- Full Knip Re-Audit:**

1. Run `npx knip` again.
2. Compare with the initial findings. Confirm that removed items no longer appear.
3. If new findings surfaced (e.g., removing an export exposed another unused export), add them to the ledger and return to Phase 1.

**Step 2b -- Test Suite & Lint:**

1. Execute `[BACKEND_TEST_COMMAND]` -- all tests must pass.
2. Execute `[CLIENT_TEST_COMMAND]` -- all tests must pass.
3. Execute `[ESLINT_COMMAND]` -- no new lint errors from removals.
4. If any failures, revert the offending removal and mark as `[warning]`.

#### **PHASE 2.5: Code Review Loop**

1. **Invoke Code Review:** You MUST NOT review the code yourself. Spawn a `deep` subagent with the `code-review-agent` skill to perform the review:
   - `task(category="deep", load_skills=["code-review-agent"], prompt="Review the branch chore/remove-dead-code against main. Focus on safe removal verification, no false-positive deletions, and no broken imports.")`
2. **Evaluate Result:**
   - If the code review returns **APPROVE**: Proceed to Phase 3.
   - If the code review returns issues:
     a. Fix all issues identified by the review.
     b. Re-run Knip, tests, and lint to ensure fixes don't regress.
     c. Invoke the code review again.
     d. Iterate until the review returns **APPROVE**.
3. **Track Iterations:** Record each code review iteration and its issues for the summary report.

#### **PHASE 3: Committing, Cleanup & Finalisation**

1. **Group & Commit:** Load the `git-master` skill and use it to stage and commit:
   ```
   task(category="quick", load_skills=["git-master"], prompt="Stage and commit the changes in the current worktree. Group commits logically by removal category (unused deps, unused exports, unused files, CI workflow). Use conventional commit format. Do NOT commit the ledger, SUMMARY.md, or any files in health-checks/ or checks/.")
   ```
2. **Generate Summary:** Write `SUMMARY.md` to `[LEDGER_DIR]` with the following sections:

   ### Overview

   Quick summary: total findings investigated, removed, false positive, uncertain. List of packages removed. List of exports removed.

   ### Files Changed

   Full list of files modified.

   ### Remediation Details

   What was removed and how, grouped by category (dependencies, exports, files).

   ### Code Review Log

   Issues found and resolved per code review iteration:
   - _Iteration 1_ -> Issue 1, Issue 2, Issue 3...
   - _Iteration 2_ -> Issue 1, Issue 2...
   - _Final Approval_

   ### Manual Verification

   Step-by-step instructions for the user to manually verify:
   - Run `npx knip` -- should show reduced findings count.
   - Run `npm run test:src` and `npm run test:client` -- all tests should pass.
   - Run `npm run lint` -- no new lint errors.
   - Start the application and verify all features still work:
     - Prayer times display correctly.
     - Settings save and load.
     - Audio playback works (test sound button).
     - Rate limiting is still active (if express-rate-limit was kept).
     - File upload works (if multer was kept).
     - Encryption/decryption of config values works.

3. **Copy Back:** Copy **only** the ledger and summary files back to the main worktree (changed source files are already committed in the branch — do NOT copy those):
   - `cp <Worktree Path>/health-checks/prompts/06-dead-code/DEAD_CODE_LEDGER.md <Original Repo>/health-checks/prompts/06-dead-code/`
   - `cp <Worktree Path>/health-checks/prompts/06-dead-code/SUMMARY.md <Original Repo>/health-checks/prompts/06-dead-code/`
4. **Cleanup:** Move to the original repository path and execute `git worktree remove <Worktree Path>`.
5. **Final Report:** Output the SUMMARY.md content directly in the chat. **Do NOT create a pull request.** Wait for the user's approval before any merge action.

**Commence execution now.**
