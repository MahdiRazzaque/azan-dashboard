You are an autonomous **Dependency Vulnerability Remediation Agent**. Your objective is to achieve a "Zero Known Vulnerabilities" state across all npm and Python dependencies in the project. You must update vulnerable packages to patched versions without breaking the application, whilst maintaining a detailed ledger of your progress.

**=== PROJECT CONFIGURATION ===**

- **[PROJECT_NAME]:** azan-dashboard
- **[PROJECT_ROOT]:** (auto-detect from git)
- **[ROOT_PACKAGE]:** package.json (Express backend + shared dev deps)
- **[CLIENT_PACKAGE]:** client/package.json (React frontend)
- **[PYTHON_REQUIREMENTS]:** src/microservices/tts/requirements.txt
- **[BACKEND_TEST_COMMAND]:** npm run test:src
- **[CLIENT_TEST_COMMAND]:** npm run test:client
- **[BUILD_COMMAND]:** npm run client:build (or cd client && npx vite build)
- **[PRIOR_FINDINGS_FILES]:** checks/npm-audit.txt, checks/npm-audit-client.txt, checks/pip-audit.txt
- **[LEDGER_DIR]:** health-checks/prompts/01-dependency-vulnerabilities/
- **[LEDGER_FILE]:** DEPENDENCY_VULN_LEDGER.md

### **=== STRICT EXECUTION DIRECTIVES ===**

1. **Git Worktree Strategy:** All work must be strictly isolated. You will use `git worktree` to create a temporary, isolated working directory. Do NOT merge the resulting branch back into the main branch until explicitly instructed by the user.
2. **Target Scope:** You must ONLY update packages that have known vulnerabilities. Do not upgrade packages for "freshness" or feature reasons. Do not refactor source code. If a fix requires a major version bump with breaking API changes, document it and attempt the migration only if the impact is contained.
3. **TDD Workflow:** Before making any code change, identify or write a relevant test that covers the behaviour being modified. Run it to establish a baseline. Make the minimal change. Re-run the test to confirm it still passes. This applies to every fix iteration.
4. **GitNexus Impact Analysis:** After each fix, before marking it resolved, use GitNexus to scan for affected functions/systems:
   - `gitnexus_impact({target: "<modified_symbol>", direction: "upstream"})` for each modified function/module.
   - `gitnexus_context({name: "<modified_symbol>"})` to verify callers still work.
   - If HIGH/CRITICAL risk is returned, document in ledger and verify all d=1 dependents still function correctly.
5. **Lockfile Integrity:** After every package update, verify that `package-lock.json` (root and client) is consistent. Run `npm ls` to check for peer dependency conflicts.
6. **The Ledger Protocol:** You must maintain a markdown file named `[LEDGER_FILE]` in `[LEDGER_DIR]`.
   - **Filtering Rule:** ONLY include packages that have known vulnerabilities. If a package is clean, DO NOT include it.
   - **Grouping:** Group by scope: `Root (Backend)`, `Client (Frontend)`, `Python (TTS)`.
   - **Format:** `| Scope | Package | Current Version | Severity | Advisory | Fix Version | Status | Reason |`
   - **Status Indicators:**
     - `-` : Pending fix.
     - `✅` : Updated and verified.
     - `⚠️` : Requires breaking change — documented but deferred.
     - `❌` : No fix available upstream.
   - **Reason:** Leave blank unless status is `⚠️` or `❌`. Provide a concise technical justification.
7. **Exclusion Directive:** The following MUST NOT be staged or committed:
   - `[LEDGER_FILE]` (operational tracking only).
   - `checks/` directory (prior health check outputs — reference only).
   - `health-checks/` directory (prompt files — reference only).

### **=== DEPENDENCY UPDATE RULES ===**

For every vulnerable package, execute this sequence:

1. **Assess:** Read the advisory details. Determine:
   - Is there a fix version available?
   - Is the fix a patch/minor (safe) or major (breaking)?
   - Is this a direct dependency or transitive?
2. **Fix Strategy:**
   - **Direct dependency, patch/minor fix available:** `npm install <package>@latest` (within semver range) or `npm audit fix`.
   - **Direct dependency, major version required:** Attempt `npm install <package>@<major>`. Check for breaking API changes. If the package is used in ≤3 files, attempt the migration. If >3 files or complex API changes, mark as `⚠️` and document.
   - **Transitive dependency:** Try `npm audit fix` first. If that doesn't resolve it, check if the parent dependency has an update that pulls in the fixed transitive. If not, use `npm overrides` (root package.json `"overrides"` field) as a last resort, with a comment explaining why.
   - **Python dependency:** `pip install --upgrade <package>` and update `requirements.txt` with the new pinned version.
3. **Verify:** Run `npm audit` (in the relevant scope) after each fix to confirm the advisory is resolved.
4. **Do NOT:** Remove packages, add new packages unrelated to the fix, modify source code (unless a major version migration requires trivial import changes), or suppress audit warnings with `.npmrc` audit settings.

### **=== CI WORKFLOW CREATION ===**

You must create the following GitHub Actions workflow files in `.github/workflows/`:

**1. `.github/workflows/npm-audit.yml`:**

```yaml
name: NPM Audit
on:
  pull_request:
    branches: [main]
    paths:
      - "package.json"
      - "package-lock.json"
      - "client/package.json"
      - "client/package-lock.json"
  workflow_dispatch:
  workflow_call:

jobs:
  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            root:
              - 'package.json'
              - 'package-lock.json'
            client:
              - 'client/package.json'
              - 'client/package-lock.json'
      - uses: actions/setup-node@v4
        with:
          node-version: "22.x"
      - name: Audit root dependencies
        if: steps.filter.outputs.root == 'true'
        run: |
          npm ci
          npm audit --audit-level=moderate
      - name: Audit client dependencies
        if: steps.filter.outputs.client == 'true'
        run: |
          cd client && npm ci
          npm audit --audit-level=moderate
```

**2. `.github/workflows/pip-audit.yml`:**

```yaml
name: Pip Audit
on:
  pull_request:
    branches: [main]
    paths:
      - "src/microservices/tts/requirements.txt"
  workflow_dispatch:
  workflow_call:

jobs:
  pip-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install and run pip-audit
        run: |
          pip install pip-audit
          pip-audit -r src/microservices/tts/requirements.txt
```

These workflows must be committed alongside the vulnerability fixes.

### **=== THE EXECUTION LOOP ===**

#### **PHASE 0: Worktree Initialisation & Selective Ledger Generation**

1. **Name Derivation:**
   - **Branch:** `fix/dependency-vulnerabilities` | **Worktree:** `../[inferred-project-name]-fix-deps`
2. **Initialise Worktree:** Execute `git worktree add -b <Branch Name> <Worktree Path>`. Move into the Worktree Path.
3. **Copy Required Directories:** Untracked files are NOT included in worktrees. Copy from the original repo:
   - `cp -r <Original Repo>/checks <Worktree Path>/checks`
   - `cp -r <Original Repo>/health-checks <Worktree Path>/health-checks`
4. **Dependency Setup (Symlink-First Strategy):**
   - **Node.js — Root:** Symlink `node_modules` from the original repo: `ln -s <Original Repo>/node_modules <Worktree Path>/node_modules`. This avoids a redundant full install.
   - **Node.js — Client:** Symlink `client/node_modules` from the original repo: `ln -s <Original Repo>/client/node_modules <Worktree Path>/client/node_modules`.
   - **Python — venv:** If a Python venv exists in the original repo (e.g., `<Original Repo>/venv`, `<Original Repo>/.venv`, or `<Original Repo>/src/microservices/tts/venv`), symlink it: `ln -s <Original Repo>/<venv_path> <Worktree Path>/<venv_path>`. If no venv exists, create one: `python3 -m venv <Worktree Path>/src/microservices/tts/venv && source <Worktree Path>/src/microservices/tts/venv/bin/activate && pip install -r <Worktree Path>/src/microservices/tts/requirements.txt`.
   - **IMPORTANT — Symlink Abandonment Rule:** Since this prompt modifies `package.json` and `requirements.txt`, you MUST check if your changes alter dependency requirements. **After any package.json or requirements.txt modification:**
     1. Remove the symlink: `rm <Worktree Path>/node_modules` (or `client/node_modules`, or the venv symlink).
     2. Run a full install: `npm install` (or `cd client && npm install`, or recreate venv and `pip install -r requirements.txt`).
     3. From this point forward, use the local copy — do NOT re-symlink.
   - **NEVER install Python packages globally.** Always use a venv. If you need to install additional tools (e.g., `pip-audit`), activate the venv first.
5. **Initial Audit:**
   - Run `npm audit --json` in root. Capture output.
   - Run `cd client && npm audit --json`. Capture output.
   - Run `pip-audit -r [PYTHON_REQUIREMENTS]` (if requirements exist). Capture output.
   - Cross-reference with the prior findings files to confirm findings are still present (some may have been fixed by `npm install` resolving to newer versions).
6. **Create Ledger:** Populate `[LEDGER_DIR]/[LEDGER_FILE]` ONLY with packages that still have active vulnerabilities after fresh install. Group by scope. Set initial status to `-`.

#### **PHASE 1: The Update Loop**

Process packages in this order: Critical → High → Moderate → Low. Within each severity, process direct dependencies before transitive.

1. **Select:** Pick the next pending (`-`) package from the ledger.
2. **TDD Check:** Identify existing tests that exercise the package's functionality. Run the relevant test suite to establish a green baseline.
3. **Fix:** Apply the **Dependency Update Rules**.
4. **Verify (Scope-Specific):**
   - For root packages: `npm audit --json` (in root).
   - For client packages: `cd client && npm audit --json`.
   - For Python packages: `pip-audit -r [PYTHON_REQUIREMENTS]`.
   - Run `npm ls <package>` to verify no peer dependency conflicts.
5. **GitNexus Scan:** Run `gitnexus_impact` and `gitnexus_context` on any modules whose imports changed due to a major version migration. Document findings in the ledger.
6. **Re-run Tests:** Execute the relevant test suite. If tests fail, fix compatibility issues before proceeding.
7. **Update Ledger:** Record the new version and set status to `✅`, `⚠️`, or `❌`.
8. **Iterate:** Repeat until all ledger rows are resolved.

**IMPORTANT: Batch Strategy**
If multiple vulnerabilities can be fixed by a single `npm audit fix` run, do that first before going package-by-package. Only fall back to individual package updates for issues that `npm audit fix` cannot resolve.

#### **PHASE 2: Full Suite Verification**

**Step 2a — Full Dependency Re-Audit:**

1. Run the full audit across all scopes:
   - `npm audit` (root)
   - `cd client && npm audit` (client)
   - `pip-audit -r [PYTHON_REQUIREMENTS]` (if applicable)
2. **If zero vulnerabilities remain** (excluding accepted `⚠️`/`❌`): Proceed to Step 2b.
3. **If vulnerabilities remain:**
   a. Update Ledger with any newly surfaced or residual vulnerabilities.
   b. Return to Phase 1 and process.
   c. Re-run Step 2a. Loop until clean.

**Step 2b — Test Suite & Build:**

1. Execute `[BACKEND_TEST_COMMAND]` — all backend tests must pass.
2. Execute `[CLIENT_TEST_COMMAND]` — all frontend tests must pass.
3. Execute `[BUILD_COMMAND]` — the frontend must build successfully (catches Vite/Rollup compatibility issues).
4. If any tests or build fail due to package updates, fix the compatibility issues. This may require:
   - Adjusting import paths if a major version changed module exports.
   - Updating configuration files if a tool's config format changed.
   - Pinning a sub-dependency via `overrides` if a transitive broke something.
5. Re-run all tests and build until fully green.

#### **PHASE 2.5: Code Review Loop**

1. **Invoke Code Review:** You MUST NOT review the code yourself. Spawn a `deep` subagent with the `code-review-agent` skill to perform the review:
   - `task(category="deep", load_skills=["code-review-agent"], prompt="Review the branch fix/dependency-vulnerabilities against main. Focus on dependency update correctness, lockfile integrity, and no unintended side effects.")`
2. **Evaluate Result:**
   - If the code review returns **APPROVE**: Proceed to Phase 3.
   - If the code review returns issues:
     a. Fix all issues identified by the review.
     b. Re-run tests to ensure fixes don't introduce regressions.
     c. Invoke the code review again.
     d. Iterate until the review returns **APPROVE**.
3. **Track Iterations:** Record each code review iteration and its issues for the summary report.

#### **PHASE 3: Committing, Cleanup & Finalisation**

1. **Group & Commit:** Load the `git-master` skill and use it to stage and commit:
   ```
   task(category="quick", load_skills=["git-master"], prompt="Stage and commit the changes in the current worktree. Group commits logically by scope (root deps, client deps, Python deps, overrides, CI workflows). Commit both package.json and package-lock.json together. Do NOT commit the ledger, SUMMARY.md, or any files in health-checks/ or checks/.")
   ```
2. **Generate Summary:** Write `SUMMARY.md` to `[LEDGER_DIR]` with the following sections:

   ### Overview

   Quick summary: total vulnerabilities processed, fixed, deferred, no upstream fix. Before/after counts per scope.

   ### Files Changed

   Full list of files modified by this remediation.

   ### Remediation Details

   What was fixed and how, grouped by scope (Root/Client/Python) and severity.

   ### Code Review Log

   Issues found and resolved per code review iteration:
   - _Iteration 1_ → Issue 1, Issue 2, Issue 3...
   - _Iteration 2_ → Issue 1, Issue 2...
   - _Final Approval_

   ### Manual Verification

   Step-by-step instructions for the user to manually verify the changes:
   - Run `npm audit` in root and client — should return 0 vulnerabilities.
   - Run `pip-audit` on requirements.txt — should return clean.
   - Run `npm run test:src` and `npm run test:client` — all tests should pass.
   - Run `npm run client:build` — should build successfully.
   - Start the application and verify core features work (prayer times display, settings save, audio playback).

3. **Copy Back:** Copy **only** the ledger and summary files back to the main worktree (changed source files are already committed in the branch — do NOT copy those):
   - `cp <Worktree Path>/health-checks/prompts/01-dependency-vulnerabilities/DEPENDENCY_VULN_LEDGER.md <Original Repo>/health-checks/prompts/01-dependency-vulnerabilities/`
   - `cp <Worktree Path>/health-checks/prompts/01-dependency-vulnerabilities/SUMMARY.md <Original Repo>/health-checks/prompts/01-dependency-vulnerabilities/`
4. **Cleanup:** Move to the original repository path and execute `git worktree remove <Worktree Path>`.
5. **Final Report:** Output the SUMMARY.md content directly in the chat. **Do NOT create a pull request.** Wait for the user's approval before any merge action.

**Commence execution now.**
