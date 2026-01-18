# Test Coverage Summary

## Global Coverage Metrics

| Metric | Coverage | Target | Status |
|--------|----------|--------|--------|
| **Statements** | 94.85% | 90% | ✅ **Passed** (+4.85%) |
| **Branches** | 83.63% | 90% | ❌ **Partial** (-6.37%) |
| **Functions** | 98.14% | 90% | ✅ **Passed** (+8.14%) |
| **Lines** | 96.92% | 90% | ✅ **Passed** (+6.92%) |

**Overall Status:** 3 out of 4 metrics exceed the 90% target. ✅

---

## Per-File Coverage Details

### Source Files (src/)

| File | % Stmts | % Branch | % Funcs | % Lines | Status |
|------|---------|----------|---------|---------|--------|
| **server.js** | 98.21% | 75.00% | 100.00% | 98.21% | Partial |

### Configuration (src/config/)

| File | % Stmts | % Branch | % Funcs | % Lines | Status |
|------|---------|----------|---------|---------|--------|
| **ConfigService.js** | 88.23% | 78.26% | 100.00% | 96.05% | Partial |
| **index.js** | 100.00% | 100.00% | 100.00% | 100.00% | Passed |
| **schemas.js** | 100.00% | 100.00% | 100.00% | 100.00% | Passed |

### Middleware (src/middleware/)

| File | % Stmts | % Branch | % Funcs | % Lines | Status |
|------|---------|----------|---------|---------|--------|
| **auth.js** | 100.00% | 100.00% | 100.00% | 100.00% | Passed |

### Routes (src/routes/)

| File | % Stmts | % Branch | % Funcs | % Lines | Status |
|------|---------|----------|---------|---------|--------|
| **api.js** | 88.20% | 78.65% | 92.30% | 90.53% | Partial |
| **system.js** | 93.61% | 81.81% | 100.00% | 95.65% | Partial |

### Services (src/services/)

| File | % Stmts | % Branch | % Funcs | % Lines | Status |
|------|---------|----------|---------|---------|--------|
| **audioAssetService.js** | 93.25% | 80.55% | 100.00% | 95.40% | Partial |
| **automationService.js** | 95.29% | 86.20% | 100.00% | 98.70% | Partial |
| **diagnosticsService.js** | 97.84% | 82.53% | 100.00% | 100.00% | Partial |
| **fetchers.js** | 96.87% | 89.58% | 100.00% | 100.00% | Partial |
| **healthCheck.js** | 100.00% | 90.14% | 100.00% | 100.00% | Passed |
| **prayerTimeService.js** | 96.15% | 87.23% | 100.00% | 100.00% | Partial |
| **schedulerService.js** | 98.91% | 75.86% | 100.00% | 100.00% | Partial |
| **sseService.js** | 100.00% | 100.00% | 100.00% | 100.00% | Passed |

### Utilities (src/utils/)

| File | % Stmts | % Branch | % Funcs | % Lines | Status |
|------|---------|----------|---------|---------|--------|
| **auth.js** | 100.00% | 100.00% | 100.00% | 100.00% | Passed |
| **calculations.js** | 100.00% | 100.00% | 100.00% | 100.00% | Passed |
| **constants.js** | 100.00% | 100.00% | 100.00% | 100.00% | Passed |
| **envManager.js** | 100.00% | 94.44% | 100.00% | 100.00% | Passed |
| **loggerInitializer.js** | 100.00% | 100.00% | 100.00% | 100.00% | Passed |

### Test Helpers (tests/helpers/)

| File | % Stmts | % Branch | % Funcs | % Lines | Status |
|------|---------|----------|---------|---------|--------|
| **authHelper.js** | 100.00% | 66.66% | 100.00% | 100.00% | Partial |
| **fsHelper.js** | 100.00% | 50.00% | 100.00% | 100.00% | Partial |

---

## Files That Failed to Reach 90% in Specific Categories

### Branch Coverage Below 90%

1. **tests/helpers/fsHelper.js** - Branch: 50.00%
   - **Reason:** Test helper file with conditional logic used only in specific test scenarios. Low priority as it's not production code.

2. **tests/helpers/authHelper.js** - Branch: 66.66%
   - **Reason:** Test helper file with conditional logic for token generation. Low priority as it's not production code.

3. **src/server.js** - Branch: 75.00%
   - **Reason:** Server initialisation logic with error handling paths that are difficult to trigger in tests. Includes conditional logic for source type logging and startup error scenarios.

4. **src/services/schedulerService.js** - Branch: 75.86%
   - **Reason:** Complex scheduling logic with multiple conditional branches for different event types, global switches, and maintenance jobs. Many branches involve time-based conditions and cron schedule execution.

5. **src/config/ConfigService.js** - Branch: 78.26%
   - **Reason:** Configuration management with complex validation, merging, and file system operations. Some error paths involve file locking and concurrent access scenarios that are challenging to test.

6. **src/routes/api.js** - Branch: 78.65%
   - **Reason:** Large route file with 650+ lines handling multiple API endpoints. Contains numerous error handling branches, validation paths, and edge cases across different routes.

7. **src/services/audioAssetService.js** - Branch: 80.55%
   - **Reason:** Audio file management with conditional logic for TTS generation, cache handling, and file system operations. Some branches involve external service failures.

8. **src/routes/system.js** - Branch: 81.81%
   - **Reason:** System route handlers with various source type checks and error handling paths.

9. **src/services/diagnosticsService.js** - Branch: 82.53%
   - **Reason:** Diagnostic status checks with multiple conditional branches for different audio types and event configurations. Achieved high statement coverage (97.84%) but some tertiary conditions remain uncovered.

10. **src/services/automationService.js** - Branch: 86.20%
    - **Reason:** Automation trigger logic with error handling for VoiceMonkey API, local playback, and browser targets. One unreachable catch block (line 114) that cannot be triggered as all handlers catch their own errors.

11. **src/services/prayerTimeService.js** - Branch: 87.23%
    - **Reason:** Prayer time caching and fetching logic with fallback mechanisms. Some branches involve specific error scenarios from external API calls.

12. **src/services/fetchers.js** - Branch: 89.58%
    - **Reason:** API fetching service close to target. Remaining uncovered branches involve data transformation loops and edge cases in date parsing.

### Statements Below 90%

1. **src/config/ConfigService.js** - Statements: 88.23%
   - **Reason:** Configuration service with complex state management. Most uncovered statements are in error handling paths and concurrent access scenarios.

2. **src/routes/api.js** - Statements: 88.20%
   - **Reason:** Large API route handler with many endpoints. Uncovered statements are primarily error handling and validation branches.

---

## Analysis and Recommendations

### Achievements
- **✅ Strong Overall Coverage:** 94.85% statement coverage and 96.92% line coverage exceed targets significantly.
- **✅ Function Coverage:** 98.14% indicates nearly all functions are tested.
- **✅ Core Utilities:** All utility functions have 100% coverage.
- **✅ Critical Services:** Health check and SSE services have perfect coverage.

### Challenges
- **Branch Coverage Gap:** 83.63% vs 90% target - primarily due to:
  - Complex error handling paths in large files (api.js, ConfigService.js)
  - Time-based conditional logic in schedulerService.js
  - Multiple source/target type branches in automation services
  - Edge cases that require specific external conditions

### Uncoverable/Difficult Scenarios
1. **Unreachable Code:** Line 114 in automationService.js - catch block that cannot be triggered due to internal error handling
2. **File System Race Conditions:** ConfigService file locking scenarios
3. **Concurrent Access:** Configuration service lock contention
4. **External Service Failures:** Specific API error responses that are hard to simulate
5. **Time-Based Logic:** Scheduler midnight refresh and cron execution edge cases

### Recommendations for Future Improvement
1. **Refactor Large Files:** Consider splitting api.js into smaller, more testable route modules
2. **Simplify Branch Logic:** Reduce cyclomatic complexity in schedulerService and ConfigService
3. **Remove Unreachable Code:** Clean up the catch block in automationService.js that cannot be triggered
4. **Mock Time-Based Logic:** Use more sophisticated time mocking for scheduler tests
5. **Integration Tests:** Some branches are better covered by integration tests rather than unit tests

---

## Conclusion

The test coverage improvement effort has successfully achieved:
- **3 out of 4 metrics above 90%** ✅
- **240 passing tests** with no failures
- **Comprehensive coverage** of critical services and utilities
- **Robust error handling** tests for most scenarios

The branch coverage gap of 6.37% is primarily in complex conditional logic within large files and edge case error handling. These remaining uncovered branches represent scenarios that are either:
- Difficult to test in isolation (external service failures, race conditions)
- Low-risk edge cases (logging conditional formats, default error messages)
- Unreachable code that should be cleaned up

The codebase now has strong test coverage that provides confidence in code quality and catches regressions effectively.

---

**Report Generated:** 2026-01-18  
**Total Test Suites:** 21 passed  
**Total Tests:** 240 passed  
**Test Execution Time:** ~6 seconds
