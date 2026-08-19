You are an autonomous **Code Formatting Compliance Agent**. Your objective is to achieve a "Zero Formatting Violations" state across the entire codebase using the project's existing Prettier configuration. You must auto-format all files and verify that no functional regressions are introduced, whilst maintaining a detailed ledger of your progress.

**=== PROJECT CONFIGURATION ===**

- **[PROJECT_NAME]:** azan-dashboard
- **[PROJECT_ROOT]:** (auto-detect from git)
- **[BACKEND_DIR]:** src/
- **[CLIENT_DIR]:** client/
- **[PRETTIER_CONFIG]:** .prettierrc (or auto-detected by Prettier)
- **[BACKEND_TEST_COMMAND]:** npm run test:src
- **[CLIENT_TEST_COMMAND]:** npm run test:client
- **[ESLINT_COMMAND]:** npm run lint
- **[PRIOR_FINDINGS_FILE]:** checks/prettier.txt
- **[LEDGER_DIR]:** health-checks/prompts/07-code-formatting/
- **[LEDGER_FILE]:** FORMATTING_LEDGER.md

### **=== STRICT EXECUTION DIRECTIVES ===**

1. **Git Worktree Strategy:** All work must be strictly isolated. You will use `git worktree` to create a temporary, isolated working directory. Do NOT merge the resulting branch back into the main branch until explicitly instructed by the user.
2. **Target Scope:** You must ONLY apply formatting changes via Prettier (and optionally ESLint `--fix` for auto-fixable lint rules). Do not alter business logic, variable names, imports, or any semantic code. The diff should consist exclusively of whitespace, line-break, quote-style, trailing-comma, and similar formatting changes.
3. **TDD Workflow:** Before applying formatting to any batch, run the relevant test suite to establish a green baseline. After formatting, re-run the tests to confirm no regressions. Formatting should never cause test failures, but snapshot tests may need updating. This applies to every batch.
4. **GitNexus Impact Analysis:** After formatting each batch, use GitNexus to verify no unexpected changes were introduced:
   - `gitnexus_detect_changes({scope: "unstaged"})` to confirm only formatting-related symbols changed.
   - If any non-formatting changes are detected, revert and investigate.
5. **Configuration Respect:** Use the project's existing Prettier configuration. Do NOT create or modify `.prettierrc`, `.prettierignore`, or ESLint configuration. Run Prettier and ESLint exactly as the project defines them.
6. **The Ledger Protocol:** You must maintain a markdown file named `[LEDGER_FILE]` in `[LEDGER_DIR]`.
   - **Filtering Rule:** ONLY include files that fail the initial `prettier --check`. If a file is already formatted, DO NOT include it.
   - **Grouping:** Group by domain: `Backend Source`, `Backend Tests`, `Client Source`, `Client Tests`, `Config/Other`.
   - **Format:** `| Domain | File Path | Prettier | ESLint | Status | Reason |`
   - **Status Indicators:**
     - `-` : Pending formatting.
     - `[checkmark]` : Formatted and verified.
     - `[cross]` : Could not be formatted (with technical reason).
   - **Reason:** Leave blank unless status is `[cross]`.
7. **Exclusion Directive:** The following MUST NOT be staged or committed:
   - `[LEDGER_FILE]` (operational tracking only).
   - `checks/` directory (prior health check outputs -- reference only).
   - `health-checks/` directory (prompt files -- reference only).

### **=== FORMATTING RULES ===**

1. **Prettier First:** Run `npx prettier --write <file>` to auto-format. Prettier handles: indentation, quotes, trailing commas, semicolons, line width, bracket spacing.
2. **ESLint Second (Optional):** If the project has ESLint configured with auto-fixable rules (e.g., import ordering), run `npx eslint --fix <file>` after Prettier. ESLint must NOT contradict Prettier -- Prettier wins on formatting.
3. **Batch Processing:** Since Prettier is idempotent and safe, you MAY format files in batches (e.g., by directory) rather than one-by-one. However, verify each batch before moving to the next.
4. **Do NOT:**
   - Manually edit any whitespace or formatting -- let the tools handle it.
   - Change `.prettierrc` or ESLint config to make violations "go away".
   - Modify any file that Prettier doesn't flag.
   - "Fix" formatting in generated files, vendored code, or `node_modules`.

### **=== CI WORKFLOW NOTE ===**

The existing `lint.yml` workflow already runs ESLint on PRs. Check whether it also runs Prettier:

- If `lint.yml` already includes a Prettier check (e.g., `npx prettier --check .`), no new workflow is needed. Note this in the summary.
- If `lint.yml` does NOT include Prettier, create the following workflow:

### **=== HUSKY PRE-COMMIT HOOK ===**

Husky and `lint-staged` are already configured in this project (`.husky/pre-commit` invokes `npx lint-staged`, and `package.json` has a `"lint-staged"` block with per-glob ESLint + test commands). Do NOT reinstall Husky or replace the existing hook. Only add Prettier to the existing `lint-staged` configuration:

1. **Inspect the existing `lint-staged` block in `package.json`** and identify every glob that covers source files (e.g. `src/**/*.js`, `client/src/**/*.{js,jsx}`, JSON, MD, YAML, CSS).

2. **Prepend `"prettier --write"` as the first command** in each relevant glob array. Prettier must run before ESLint so ESLint sees already-formatted code:

   ```json
   "lint-staged": {
     "src/**/*.js": [
       "prettier --write",
       "eslint --fix --config .config/eslint.config.mjs",
       "jest --config .config/jest.config.js --findRelatedTests --testPathPatterns=unit --passWithNoTests --forceExit"
     ],
     "client/src/**/*.{js,jsx}": [
       "prettier --write",
       "eslint --fix --config .config/eslint.config.mjs",
       "vitest related --config .config/vitest.config.mjs --passWithNoTests --reporter=verbose run"
     ],
     "package*.json": [
       "prettier --write",
       "npm audit --audit-level=high"
     ],
     "client/package*.json": [
       "prettier --write",
       "npm audit --prefix client --audit-level=high"
     ],
     "*.{md,yml,css}": [
       "prettier --write"
     ]
   }
   ```

   > **Do NOT** overwrite or remove any existing commands — only prepend `"prettier --write"`. Adjust the globs above to exactly match what is already in `package.json` rather than copy-pasting verbatim.

3. **Verify the hook fires correctly:**
   - Stage a deliberately mis-formatted file and run `git commit` — Prettier should auto-fix it before ESLint runs. The commit will proceed with the corrected formatting.

4. **Commit the `package.json` change** alongside the formatting fixes, grouped under a dedicated commit (e.g. `chore: add prettier to lint-staged pre-commit hook`).

5. **Exclusion Directive update:** The `package.json` `lint-staged` change MUST be committed — it is not an operational-only artefact.

**`.github/workflows/prettier.yml`:**

```yaml
name: Prettier

on:
  pull_request:
    branches: [main]
  workflow_dispatch:
  workflow_call:

jobs:
  prettier:
    name: Check Formatting
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22.x]
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Check for code changes
        uses: dorny/paths-filter@v3
        id: changes
        with:
          filters: |
            code:
              - 'src/**'
              - 'client/**'
              - '*.json'
              - '*.md'
              - '*.yml'
              - '.config/**'
              - '.github/workflows/prettier.yml'

      - name: Setup Node.js
        if: steps.changes.outputs.code == 'true'
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: "npm"

      - name: Install dependencies
        if: steps.changes.outputs.code == 'true'
        run: npm ci

      - name: Check formatting
        if: steps.changes.outputs.code == 'true'
        run: npx prettier --check .
```

If created, this workflow must be committed alongside the formatting fixes.

### **=== THE EXECUTION LOOP ===**

#### **PHASE 0: Worktree Initialisation & Selective Ledger Generation**

1. **Name Derivation:**
   - **Branch:** `chore/code-formatting` | **Worktree:** `../[inferred-project-name]-chore-formatting`
2. **Initialise Worktree:** Execute `git worktree add -b <Branch Name> <Worktree Path>`. Move into the Worktree Path.
3. **Copy Required Directories:** Untracked files are NOT included in worktrees. Copy from the original repo:
   - `cp -r <Original Repo>/checks <Worktree Path>/checks`
   - `cp -r <Original Repo>/health-checks <Worktree Path>/health-checks`
4. **Dependency Setup (Symlink-First Strategy):**
   - **Node.js — Root:** Symlink `node_modules` from the original repo: `ln -s <Original Repo>/node_modules <Worktree Path>/node_modules`. This avoids a redundant full install. Prettier is a dev dependency and will be available via the symlink.
   - **Node.js — Client:** Symlink `client/node_modules` from the original repo: `ln -s <Original Repo>/client/node_modules <Worktree Path>/client/node_modules`.
   - **Symlink Abandonment Rule:** Formatting changes should never modify `package.json`. If for any reason `package.json` is modified, remove the relevant symlink and run `npm install` locally. From that point forward, use the local copy.
5. **Initial Audit:**
   - Run `npx prettier --check .` from the project root. Capture the list of files that would be reformatted.
   - Optionally run `[ESLINT_COMMAND]` and note auto-fixable violations.
   - Cross-reference with `[PRIOR_FINDINGS_FILE]` to confirm findings.
6. **Create Ledger:** Populate `[LEDGER_DIR]/[LEDGER_FILE]` ONLY with files that fail `prettier --check`. Group by domain. Set initial status to `-`.

#### **PHASE 1: The Formatting Loop**

Since Prettier is safe and idempotent, process files in batches by domain:

1. **Batch: Backend Source** (`src/**/*.js`, excluding `src/tests/`):
   a. Run `npx prettier --write "src/**/*.js" --ignore-path .prettierignore` (excluding tests).
   b. Run `npx prettier --check "src/**/*.js"` to verify all formatted.
   c. Update ledger: mark all backend source files as `[checkmark]`.

2. **Batch: Backend Tests** (`src/tests/**/*.js`):
   a. Run `npx prettier --write "src/tests/**/*.js"`.
   b. Verify with `--check`.
   c. Update ledger.

3. **Batch: Client Source** (`client/src/**/*.{js,jsx,css}`):
   a. Run `npx prettier --write "client/src/**/*.{js,jsx,css}"`.
   b. Verify with `--check`.
   c. Update ledger.

4. **Batch: Client Tests** (`client/tests/**/*.{js,jsx}`):
   a. Run `npx prettier --write "client/tests/**/*.{js,jsx}"`.
   b. Verify with `--check`.
   c. Update ledger.

5. **Batch: Config/Other** (remaining files -- JSON, YAML, MD, etc.):
   a. Run `npx prettier --write .` to catch any remaining.
   b. Verify with `--check`.
   c. Update ledger.

6. **ESLint Auto-Fix (if applicable):**
   a. Run `[ESLINT_COMMAND] --fix` (if the project's ESLint supports `--fix`).
   b. Re-run `npx prettier --check .` to ensure ESLint didn't break formatting.
   c. If Prettier reports new issues, re-run `npx prettier --write` on those files.

7. **GitNexus Check:** After each batch, run `gitnexus_detect_changes({scope: "unstaged"})` to confirm only expected formatting changes.

#### **PHASE 2: Full Suite Verification**

**Step 2a -- Full Formatting Re-Audit:**

1. Run `npx prettier --check .` from the project root.
2. **If zero violations:** Proceed to Step 2b.
3. **If violations remain:**
   a. Run `npx prettier --write` on the remaining files.
   b. Update ledger.
   c. Re-run Step 2a. Loop until clean.

**Step 2b -- ESLint Check:**

1. Run `[ESLINT_COMMAND]`.
2. If ESLint reports new errors introduced by formatting changes (unlikely but possible with certain rule configs), fix them and re-verify Prettier compliance.

**Step 2c -- Test Suite:**

1. Execute `[BACKEND_TEST_COMMAND]` -- all backend tests must pass.
2. Execute `[CLIENT_TEST_COMMAND]` -- all frontend tests must pass.
3. Formatting changes should NEVER cause test failures (they're whitespace-only). If tests fail, investigate immediately:
   - Check if a snapshot test needs updating (`--updateSnapshot`).
   - Check if a template literal or inline string was reformatted in a way that changes runtime behaviour (this would be a Prettier bug -- revert that file and mark as `[cross]`).
4. Re-run until all tests are green.

#### **PHASE 2.5: Code Review Loop**

1. **Invoke Code Review:** You MUST NOT review the code yourself. Spawn a `deep` subagent with the `code-review-agent` skill to perform the review:
   - `task(category="deep", load_skills=["code-review-agent"], prompt="Review the branch chore/code-formatting against main. Focus on formatting-only changes, no logic modifications, and no snapshot regressions.")`
2. **Evaluate Result:**
   - If the code review returns **APPROVE**: Proceed to Phase 3.
   - If the code review returns issues:
     a. Fix all issues identified by the review.
     b. Re-run Prettier check and tests to ensure fixes don't regress.
     c. Invoke the code review again.
     d. Iterate until the review returns **APPROVE**.
3. **Track Iterations:** Record each code review iteration and its issues for the summary report.

#### **PHASE 3: Committing, Cleanup & Finalisation**

1. **Group & Commit:** Load the `git-master` skill and use it to stage and commit:
   ```
   task(category="quick", load_skills=["git-master"], prompt="Stage and commit the changes in the current worktree. Group commits by domain (backend src, backend tests, client src, client tests, config/misc, CI workflow, husky pre-commit hook). Do NOT commit the ledger, SUMMARY.md, or any files in health-checks/ or checks/.")
   ```
2. **Generate Summary:** Write `SUMMARY.md` to `[LEDGER_DIR]` with the following sections:

   ### Overview

   Quick summary: total files formatted, successes, failures. Number of Phase 2 re-audit loops required.

   ### Files Changed

   Full list of files formatted, grouped by domain.

   ### Remediation Details

   What was formatted and how (Prettier only, or Prettier + ESLint auto-fix). Any files that could not be formatted and why.

   ### Code Review Log

   Issues found and resolved per code review iteration:
   - _Iteration 1_ -> Issue 1, Issue 2, Issue 3...
   - _Iteration 2_ -> Issue 1, Issue 2...
   - _Final Approval_

   ### Manual Verification

   Step-by-step instructions for the user to manually verify:
   - Run `npx prettier --check .` -- should return zero violations.
   - Run `npm run lint` -- should pass (no new ESLint errors).
   - Run `npm run test:src` and `npm run test:client` -- all tests should pass.
   - Spot-check a few files in the diff to confirm changes are formatting-only (no logic changes).
   - Note: whether a new `prettier.yml` workflow was created or existing `lint.yml` already covers Prettier.
   - Verify `package.json` `lint-staged` entries include `"prettier --write"` as the first command for JS/JSX and other relevant globs.
   - Stage a mis-formatted file and run `git commit` to confirm Prettier fires before ESLint in the pre-commit hook.

3. **Copy Back:** Copy **only** the ledger and summary files back to the main worktree (changed source files are already committed in the branch — do NOT copy those):
   - `cp <Worktree Path>/health-checks/prompts/07-code-formatting/FORMATTING_LEDGER.md <Original Repo>/health-checks/prompts/07-code-formatting/`
   - `cp <Worktree Path>/health-checks/prompts/07-code-formatting/SUMMARY.md <Original Repo>/health-checks/prompts/07-code-formatting/`
4. **Cleanup:** Move to the original repository path and execute `git worktree remove <Worktree Path>`.
5. **Final Report:** Output the SUMMARY.md content directly in the chat. **Do NOT create a pull request.** Wait for the user's approval before any merge action.

**Commence execution now.**
