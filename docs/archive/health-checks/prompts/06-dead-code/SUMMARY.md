## Dead code cleanup summary

- Worktree branch: `chore/remove-dead-code`
- Commit: `1beecc5f3b07f62225f1c14c5c326352074d7e10`

### Committed changes

1. Removed four confirmed-unused mock helper exports from `src/tests/helpers/mockFactory.js`:
   - `createMockProvider`
   - `createMockProviderFactory`
   - `createMockFs`
   - `createMockBottleneck`
2. Added `.github/workflows/knip.yml` using repo-standard `dorny/paths-filter` gating.
3. Made the Knip CI step non-blocking for now and pinned it to `knip@6.4.1` because current Knip output is still polluted by alias-related false positives.

### Verified keep decisions

- Dependencies kept: `express-rate-limit`, `multer`, `number-to-words`
- High-risk exports kept after GitNexus review: `ConfigNotInitializedError`, `CriticalConfigurationError`
- Runtime/test-used exports kept: SSE exports, encryption exports, and the remaining mock factory helpers

### Verification performed

- Backend tests: passed
- Frontend tests: passed
- Lint: passed with only pre-existing JSDoc warnings
- Knip rerun: still reports broad alias-driven false positives; no additional safe removals taken
- Workflow YAML parse: passed (`YAML OK`)
- Code review: approved after pinning Knip and making the step non-blocking

### Notes

- `DEAD_CODE_LEDGER.md` documents the evidence for each keep/remove decision.
- `health-checks/`, `checks/`, and the ledger were intentionally excluded from the git commit per instruction.
