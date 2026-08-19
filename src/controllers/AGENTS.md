# CONTROLLER KNOWLEDGE BASE

## FILES

| Controller            | Lines | Endpoints                                                                           | Key Dependencies                                                                 |
| :-------------------- | :---- | :---------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| prayerController.js   | ~200  | GET prayer times, calendar window, manual refresh, overrides                        | prayerTimeService, calculations utils                                            |
| settingsController.js | ~483  | GET/PUT config, POST source validation, POST/DELETE file uploads                    | configurationWorkflowService, audioAssetService, voiceService                    |
| systemController.js   | ~671  | GET health, diagnostics, voices, audio files. POST URL validation, audio operations | healthCheck, voiceService, audioAssetService, storageService, diagnosticsService |
| authController.js     | ~150  | POST login, POST password change, GET session check, POST setup                     | passwordUtils, configService                                                     |
| envController.js      | ~150  | GET/PUT environment variables                                                       | envManager, passwordUtils                                                        |

## COMPLEXITY NOTES

- systemController.js (671 lines) is the largest — acts as catch-all for system operations. Functions are cohesive around system management.
- settingsController.js (483 lines) handles both config CRUD and file management — file operations share validation logic.

## CONVENTIONS

- All handler methods wrapped in asyncHandler.
- Controllers format HTTP responses — services throw errors, controllers catch and respond.
- File upload routes: storageCheck → fileUpload → handler (order matters).
- Response format: `{ success: true, data: ... }` or `{ success: false, error: ... }`.

## ANTI-PATTERNS

- Controllers should NOT contain business logic — delegate to services.
- Never call configService.update() directly from controllers — use configurationWorkflowService.executeUpdate().
- Don't add new endpoints to systemController without considering if they belong in a dedicated controller.
