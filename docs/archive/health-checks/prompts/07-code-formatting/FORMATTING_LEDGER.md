# Formatting Ledger — azan-dashboard

**Branch:** `chore/code-formatting`
**Date:** 2026-04-14
**Prettier Version:** 3.8.2
**Total Files Failing Initial Check:** 197 (+ 2 unparseable in `checks/` — excluded)

> **Legend:** `-` Pending | ✅ Formatted & verified | ❌ Could not be formatted

---

## Backend Source

| Domain         | File Path                                             | Prettier | ESLint | Status | Reason |
| -------------- | ----------------------------------------------------- | -------- | ------ | ------ | ------ |
| Backend Source | `__mocks__/axios.js`                                  | ❌→✅    | -      | -      |        |
| Backend Source | `src/config/__mocks__/index.js`                       | ❌→✅    | -      | -      |        |
| Backend Source | `src/config/ConfigService.js`                         | ❌→✅    | -      | -      |        |
| Backend Source | `src/config/index.js`                                 | ❌→✅    | -      | -      |        |
| Backend Source | `src/config/schemas.js`                               | ❌→✅    | -      | -      |        |
| Backend Source | `src/controllers/authController.js`                   | ❌→✅    | -      | -      |        |
| Backend Source | `src/controllers/envController.js`                    | ❌→✅    | -      | -      |        |
| Backend Source | `src/controllers/prayerController.js`                 | ❌→✅    | -      | -      |        |
| Backend Source | `src/controllers/settingsController.js`               | ❌→✅    | -      | -      |        |
| Backend Source | `src/controllers/systemController.js`                 | ❌→✅    | -      | -      |        |
| Backend Source | `src/middleware/asyncHandler.js`                      | ❌→✅    | -      | -      |        |
| Backend Source | `src/middleware/auth.js`                              | ❌→✅    | -      | -      |        |
| Backend Source | `src/middleware/errorHandler.js`                      | ❌→✅    | -      | -      |        |
| Backend Source | `src/middleware/fileUpload.js`                        | ❌→✅    | -      | -      |        |
| Backend Source | `src/middleware/rateLimiters.js`                      | ❌→✅    | -      | -      |        |
| Backend Source | `src/middleware/storageCheck.js`                      | ❌→✅    | -      | -      |        |
| Backend Source | `src/outputs/BaseOutput.js`                           | ❌→✅    | -      | -      |        |
| Backend Source | `src/outputs/BrowserOutput.js`                        | ❌→✅    | -      | -      |        |
| Backend Source | `src/outputs/index.js`                                | ❌→✅    | -      | -      |        |
| Backend Source | `src/outputs/LocalOutput.js`                          | ❌→✅    | -      | -      |        |
| Backend Source | `src/outputs/OutputFactory.js`                        | ❌→✅    | -      | -      |        |
| Backend Source | `src/outputs/VoiceMonkeyOutput.js`                    | ❌→✅    | -      | -      |        |
| Backend Source | `src/providers/AladhanProvider.js`                    | ❌→✅    | -      | -      |        |
| Backend Source | `src/providers/BaseProvider.js`                       | ❌→✅    | -      | -      |        |
| Backend Source | `src/providers/errors.js`                             | ❌→✅    | -      | -      |        |
| Backend Source | `src/providers/index.js`                              | ❌→✅    | -      | -      |        |
| Backend Source | `src/providers/MyMasjidProvider.js`                   | ❌→✅    | -      | -      |        |
| Backend Source | `src/providers/ProviderFactory.js`                    | ❌→✅    | -      | -      |        |
| Backend Source | `src/routes/auth.js`                                  | ❌→✅    | -      | -      |        |
| Backend Source | `src/routes/index.js`                                 | ❌→✅    | -      | -      |        |
| Backend Source | `src/routes/prayers.js`                               | ❌→✅    | -      | -      |        |
| Backend Source | `src/routes/settings.js`                              | ❌→✅    | -      | -      |        |
| Backend Source | `src/routes/system.js`                                | ❌→✅    | -      | -      |        |
| Backend Source | `src/server.js`                                       | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/core/automationService.js`              | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/core/prayerTimeService.js`              | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/core/schedulerService.js`               | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/core/validationService.js`              | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/system/assetMigrationService.js`        | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/system/audioAssetService.js`            | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/system/configurationWorkflowService.js` | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/system/diagnosticsService.js`           | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/system/healthCheck.js`                  | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/system/migrationService.js`             | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/system/sseService.js`                   | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/system/storageService.js`               | ❌→✅    | -      | -      |        |
| Backend Source | `src/services/system/voiceService.js`                 | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/asyncLock.js`                              | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/audioValidator.js`                         | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/calculations.js`                           | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/configUnmasker.js`                         | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/constants.js`                              | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/encryption.js`                             | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/envManager.js`                             | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/jobConstants.js`                           | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/logger.js`                                 | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/loggerInitializer.js`                      | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/networkUtils.js`                           | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/normalizeSource.js`                        | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/passwordUtils.js`                          | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/pathUtils.js`                              | ❌→✅    | -      | -      |        |
| Backend Source | `src/utils/requestQueue.js`                           | ❌→✅    | -      | -      |        |

---

## Backend Tests

| Domain        | File Path                                                      | Prettier | ESLint | Status | Reason |
| ------------- | -------------------------------------------------------------- | -------- | ------ | ------ | ------ |
| Backend Tests | `src/tests/helpers/authHelper.js`                              | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/helpers/fsHelper.js`                                | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/helpers/mockFactory.js`                             | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/integration/logging.test.js`                        | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/integration/routes/api.test.js`                     | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/integration/routes/auth_lifecycle.test.js`          | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/integration/routes/health.test.js`                  | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/integration/routes/settings_masking.test.js`        | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/integration/routes/settings_revalidate.test.js`     | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/integration/routes/settings_tourstate.test.js`      | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/integration/routes/upload_validation.test.js`       | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/integration/security_hardening.test.js`             | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/integration/securityHardening.test.js`              | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/setup.js`                                           | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/config/ConfigService_security.test.js`         | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/config/ConfigService.test.js`                  | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/config/ConfigServiceEncryption.test.js`        | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/config/schemas.test.js`                        | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/config/toursSchema.test.js`                    | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/controllers/authController.test.js`            | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/controllers/envController.test.js`             | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/controllers/prayerController.test.js`          | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/controllers/settingsController_limit.test.js`  | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/controllers/settingsController.test.js`        | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/controllers/systemController_cache.test.js`    | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/controllers/systemController.test.js`          | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/envUpdateSchema.test.js`                       | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/helpers.test.js`                               | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/middleware/asyncHandler.test.js`               | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/middleware/auth.test.js`                       | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/middleware/errorHandler.test.js`               | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/middleware/fileUpload_security.test.js`        | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/middleware/fileUpload.test.js`                 | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/middleware/rateLimiters.test.js`               | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/middleware/storageCheck.test.js`               | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/outputs/BaseOutput.test.js`                    | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/outputs/BrowserOutput.test.js`                 | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/outputs/LocalOutput.test.js`                   | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/outputs/OutputFactory.test.js`                 | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/outputs/VoiceMonkeyOutput.test.js`             | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/providers/AladhanProvider.test.js`             | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/providers/BaseProvider.test.js`                | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/providers/Discovery.test.js`                   | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/providers/errors.test.js`                      | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/providers/MyMasjidProvider.test.js`            | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/providers/ProviderFactory.test.js`             | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/routes/system.test.js`                         | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/server.test.js`                                | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/assetMigrationService.test.js`        | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/audioAssetService_parallel.test.js`   | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/audioAssetService.test.js`            | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/automationService.test.js`            | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/configurationWorkflowService.test.js` | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/diagnosticsService.test.js`           | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/healthCheck.test.js`                  | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/migrationService.test.js`             | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/migrationServiceEnv.test.js`          | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/prayerTimeService.test.js`            | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/schedulerCatchUp.test.js`             | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/schedulerService.test.js`             | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/sseService.test.js`                   | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/storageService.test.js`               | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/validationService.test.js`            | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/services/voiceService.test.js`                 | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/asyncLock.test.js`                       | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/audioValidator.test.js`                  | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/calculations.test.js`                    | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/configUnmasker.test.js`                  | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/constants.test.js`                       | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/encryption.test.js`                      | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/envManager.test.js`                      | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/jobConstants.test.js`                    | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/loggerInitializer.test.js`               | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/networkUtils.test.js`                    | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/normalizeSource.test.js`                 | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/passwordUtils.test.js`                   | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/pathUtils.test.js`                       | ❌→✅    | -      | -      |        |
| Backend Tests | `src/tests/unit/utils/requestQueue.test.js`                    | ❌→✅    | -      | -      |        |

---

## Client Source

| Domain        | File Path                                                            | Prettier | ESLint | Status | Reason |
| ------------- | -------------------------------------------------------------------- | -------- | ------ | ------ | ------ |
| Client Source | `client/src/App.jsx`                                                 | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/common/AudioTestModal.jsx`                    | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/common/ConfirmModal.jsx`                      | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/common/PasswordInput.jsx`                     | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/common/SaveProcessModal.jsx`                  | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/common/SearchableSelect.jsx`                  | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/common/WelcomeModal.jsx`                      | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/dashboard/FocusCard.jsx`                      | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/dashboard/PrayerCard.jsx`                     | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/layout/DashboardLayout.jsx`                   | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/layout/ProtectedRoute.jsx`                    | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/layout/SettingsLayout.jsx`                    | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/layout/TopControls.jsx`                       | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/AudioConsentModal.jsx`               | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/automation/AutomationGeneralTab.jsx` | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/automation/AutomationOutputsTab.jsx` | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/automation/AutomationVoiceTab.jsx`   | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/ClientSettingsModal.jsx`             | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/CredentialStrategyCard.jsx`          | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/developer/AutomationTTSTab.jsx`      | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/developer/DiagnosticsTab.jsx`        | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/developer/HealthTab.jsx`             | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/developer/NetworkConfigCard.jsx`     | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/developer/StatusCells.jsx`           | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/developer/StorageManagementCard.jsx` | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/developer/SystemLogsTab.jsx`         | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/DynamicField.jsx`                    | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/IqamahTimingCard.jsx`                | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/OutputStrategyCard.jsx`              | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/PrayerSourceStatusCard.jsx`          | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/SourceConfigurator.jsx`              | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/TriggerCard.jsx`                     | ❌→✅    | -      | -      |        |
| Client Source | `client/src/components/settings/VoiceLibrary.jsx`                    | ❌→✅    | -      | -      |        |
| Client Source | `client/src/config/tourSteps.js`                                     | ❌→✅    | -      | -      |        |
| Client Source | `client/src/contexts/AuthContext.jsx`                                | ❌→✅    | -      | -      |        |
| Client Source | `client/src/contexts/ClientPreferencesContext.jsx`                   | ❌→✅    | -      | -      |        |
| Client Source | `client/src/contexts/SettingsContext.jsx`                            | ❌→✅    | -      | -      |        |
| Client Source | `client/src/hooks/useAudio.js`                                       | ❌→✅    | -      | -      |        |
| Client Source | `client/src/hooks/useAuth.js`                                        | ❌→✅    | -      | -      |        |
| Client Source | `client/src/hooks/useClientPreferences.js`                           | ❌→✅    | -      | -      |        |
| Client Source | `client/src/hooks/useConstants.js`                                   | ❌→✅    | -      | -      |        |
| Client Source | `client/src/hooks/useMidnightObserver.js`                            | ❌→✅    | -      | -      |        |
| Client Source | `client/src/hooks/usePrayerTimes.js`                                 | ❌→✅    | -      | -      |        |
| Client Source | `client/src/hooks/useProviders.js`                                   | ❌→✅    | -      | -      |        |
| Client Source | `client/src/hooks/useSettings.js`                                    | ❌→✅    | -      | -      |        |
| Client Source | `client/src/hooks/useSSE.js`                                         | ❌→✅    | -      | -      |        |
| Client Source | `client/src/hooks/useTour.js`                                        | ❌→✅    | -      | -      |        |
| Client Source | `client/src/hooks/useWakeLock.js`                                    | ❌→✅    | -      | -      |        |
| Client Source | `client/src/index.css`                                               | ❌→✅    | -      | -      |        |
| Client Source | `client/src/main.jsx`                                                | ❌→✅    | -      | -      |        |
| Client Source | `client/src/styles/tour.css`                                         | ❌→✅    | -      | -      |        |
| Client Source | `client/src/utils/prayerNames.js`                                    | ❌→✅    | -      | -      |        |
| Client Source | `client/src/utils/validation.js`                                     | ❌→✅    | -      | -      |        |
| Client Source | `client/src/views/ConnectionErrorView.jsx`                           | ❌→✅    | -      | -      |        |
| Client Source | `client/src/views/DashboardView.jsx`                                 | ❌→✅    | -      | -      |        |
| Client Source | `client/src/views/LoginView.jsx`                                     | ❌→✅    | -      | -      |        |
| Client Source | `client/src/views/settings/AutomationSettingsView.jsx`               | ❌→✅    | -      | -      |        |
| Client Source | `client/src/views/settings/CredentialsSettingsView.jsx`              | ❌→✅    | -      | -      |        |
| Client Source | `client/src/views/settings/DeveloperSettingsView.jsx`                | ❌→✅    | -      | -      |        |
| Client Source | `client/src/views/settings/FileManagerView.jsx`                      | ❌→✅    | -      | -      |        |
| Client Source | `client/src/views/settings/GeneralSettingsView.jsx`                  | ❌→✅    | -      | -      |        |
| Client Source | `client/src/views/settings/PrayerSettingsView.jsx`                   | ❌→✅    | -      | -      |        |
| Client Source | `client/src/views/SetupView.jsx`                                     | ❌→✅    | -      | -      |        |

---

## Client Tests

| Domain       | File Path                                                                        | Prettier | ESLint | Status | Reason |
| ------------ | -------------------------------------------------------------------------------- | -------- | ------ | ------ | ------ |
| Client Tests | `client/tests/helpers/mockFactories.js`                                          | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/helpers/renderWithProviders.jsx`                                   | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/setup.js`                                                          | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/App.test.jsx`                                                 | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/common/AudioTestModal.test.jsx`                    | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/common/ConfirmModal.test.jsx`                      | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/common/PasswordInput.test.jsx`                     | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/common/SaveProcessModal.test.jsx`                  | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/common/SearchableSelect.test.jsx`                  | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/common/WelcomeModal.test.jsx`                      | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/dashboard/FocusCard.test.jsx`                      | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/dashboard/PrayerCard.test.jsx`                     | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/layout/DashboardLayout.test.jsx`                   | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/layout/ProtectedRoute.test.jsx`                    | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/layout/SettingsLayout_Extended.test.jsx`           | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/layout/SettingsLayout.test.jsx`                    | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/layout/TopControls.test.jsx`                       | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/AudioConsentModal.test.jsx`               | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/automation/AutomationGeneralTab.test.jsx` | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/automation/AutomationOutputsTab.test.jsx` | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/automation/AutomationVoiceTab.test.jsx`   | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/ClientSettingsModal.test.jsx`             | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/CredentialStrategyCard.test.jsx`          | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/developer/AutomationTTSTab.test.jsx`      | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/developer/DiagnosticsTab.test.jsx`        | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/developer/HealthTab.test.jsx`             | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/developer/NetworkConfigCard.test.jsx`     | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/developer/StatusCells.test.jsx`           | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/developer/StorageManagementCard.test.jsx` | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/developer/SystemLogsTab.test.jsx`         | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/DynamicField.test.jsx`                    | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/IqamahTimingCard.test.jsx`                | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/OutputStrategyCard.test.jsx`              | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/PrayerSourceStatusCard.test.jsx`          | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/SourceConfigurator.test.jsx`              | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/TriggerCard.test.jsx`                     | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/components/settings/VoiceLibrary.test.jsx`                    | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/contexts/AuthContext.test.jsx`                                | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/contexts/ClientPreferencesContext.test.jsx`                   | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/contexts/SettingsContext_Extended.test.jsx`                   | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/contexts/SettingsContext.test.jsx`                            | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/useAudio.test.js`                                       | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/useAuth.test.jsx`                                       | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/useClientPreferences.test.jsx`                          | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/useConstants.test.js`                                   | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/useMidnightObserver.test.js`                            | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/usePrayerTimes.test.js`                                 | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/useProviders.test.jsx`                                  | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/useSettings.test.jsx`                                   | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/useSSE.test.js`                                         | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/useTour.test.js`                                        | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/useWakeLock_Extended.test.js`                           | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/hooks/useWakeLock.test.js`                                    | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/utils/validation.test.js`                                     | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/ConnectionErrorView.test.jsx`                           | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/DashboardView.test.jsx`                                 | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/LoginView.test.jsx`                                     | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/settings/AutomationSettingsView_Extended.test.jsx`      | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/settings/AutomationSettingsView.test.jsx`               | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/settings/CredentialsSettingsView.test.jsx`              | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/settings/DeveloperSettingsView_Extended.test.jsx`       | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/settings/DeveloperSettingsView.test.jsx`                | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/settings/FileManagerView_Extended.test.jsx`             | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/settings/FileManagerView.test.jsx`                      | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/settings/GeneralSettingsView.test.jsx`                  | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/settings/PrayerSettingsView.test.jsx`                   | ❌→✅    | -      | -      |        |
| Client Tests | `client/tests/unit/views/SetupView.test.jsx`                                     | ❌→✅    | -      | -      |        |

---

## Config / Other

| Domain       | File Path                                | Prettier | ESLint | Status | Reason                                             |
| ------------ | ---------------------------------------- | -------- | ------ | ------ | -------------------------------------------------- |
| Config/Other | `.config/eslint.config.mjs`              | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.config/jest.config.js`                 | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.config/knip.json`                      | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.config/madge-aliases.js`               | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.config/nodemon.json`                   | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.config/vitest.config.mjs`              | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/bandit.yml`           | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/client-tests.yml`     | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/deploy.yml`           | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/docker-build.yml`     | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/hadolint.yml`         | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/knip.yml`             | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/lint.yml`             | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/madge.yml`            | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/npm-audit.yml`        | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/pip-audit.yml`        | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/react-doctor.yml`     | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/semgrep.yml`          | ❌→✅    | -      | -      |                                                    |
| Config/Other | `.github/workflows/src-tests.yml`        | ❌→✅    | -      | -      |                                                    |
| Config/Other | `checks/bandit.json`                     | ❌→✅    | -      | -      |                                                    |
| Config/Other | `checks/complexity.json`                 | -        | -      | ❌     | Malformed JSON (eslint error text, not valid JSON) |
| Config/Other | `checks/coverage-backend.json`           | ❌→✅    | -      | -      |                                                    |
| Config/Other | `checks/eslint-project.json`             | ❌→✅    | -      | -      |                                                    |
| Config/Other | `checks/eslint-security.json`            | -        | -      | ❌     | Malformed JSON (eslint error text, not valid JSON) |
| Config/Other | `checks/hadolint.json`                   | ❌→✅    | -      | -      |                                                    |
| Config/Other | `checks/jscpd-report.json`               | ❌→✅    | -      | -      |                                                    |
| Config/Other | `checks/knip.json`                       | ❌→✅    | -      | -      |                                                    |
| Config/Other | `checks/npm-audit-client.json`           | ❌→✅    | -      | -      |                                                    |
| Config/Other | `checks/npm-audit.json`                  | ❌→✅    | -      | -      |                                                    |
| Config/Other | `checks/pip-audit.json`                  | ❌→✅    | -      | -      |                                                    |
| Config/Other | `checks/semgrep.json`                    | ❌→✅    | -      | -      |                                                    |
| Config/Other | `client/.eslintrc.cjs`                   | ❌→✅    | -      | -      |                                                    |
| Config/Other | `client/index.html`                      | ❌→✅    | -      | -      |                                                    |
| Config/Other | `client/postcss.config.js`               | ❌→✅    | -      | -      |                                                    |
| Config/Other | `client/public/favicon/site.webmanifest` | ❌→✅    | -      | -      |                                                    |
| Config/Other | `client/tailwind.config.js`              | ❌→✅    | -      | -      |                                                    |
| Config/Other | `client/vite.config.js`                  | ❌→✅    | -      | -      |                                                    |
| Config/Other | `docker/docker-compose.audio.yml`        | ❌→✅    | -      | -      |                                                    |
| Config/Other | `docker/docker-compose.yml`              | ❌→✅    | -      | -      |                                                    |
| Config/Other | `docs/01-overview.md`                    | ❌→✅    | -      | -      |                                                    |
| Config/Other | `docs/02-features.md`                    | ❌→✅    | -      | -      |                                                    |
| Config/Other | `docs/03-setup-installation.md`          | ❌→✅    | -      | -      |                                                    |
| Config/Other | `docs/04-architecture.md`                | ❌→✅    | -      | -      |                                                    |
| Config/Other | `docs/05-automation-logic.md`            | ❌→✅    | -      | -      |                                                    |
| Config/Other | `docs/06-api-reference.md`               | ❌→✅    | -      | -      |                                                    |
| Config/Other | `docs/07-ops-deployment.md`              | ❌→✅    | -      | -      |                                                    |
| Config/Other | `docs/08-development-guide.md`           | ❌→✅    | -      | -      |                                                    |
| Config/Other | `docs/09-configuration-reference.md`     | ❌→✅    | -      | -      |                                                    |
| Config/Other | `jsconfig.json`                          | ❌→✅    | -      | -      |                                                    |
| Config/Other | `README.md`                              | ❌→✅    | -      | -      |                                                    |
| Config/Other | `src/config/default.json`                | ❌→✅    | -      | -      |                                                    |

---

## Excluded (Operational Only — NOT formatted)

| File                   | Reason                                              |
| ---------------------- | --------------------------------------------------- |
| `health-checks/` (all) | Operational prompt files — excluded per directive   |
| `checks/` (all)        | Prior health check outputs — excluded per directive |

---

## Summary Counts

| Domain         | Total   | ✅ Formatted | ❌ Failed |
| -------------- | ------- | ------------ | --------- |
| Backend Source | 61      | 0            | 0         |
| Backend Tests  | 76      | 0            | 0         |
| Client Source  | 63      | 0            | 0         |
| Client Tests   | 65      | 0            | 0         |
| Config/Other   | 51      | 0            | 2         |
| **Total**      | **316** | **0**        | **2**     |

> Note: 197 files identified by `prettier --check` from source/config files. Additional files from `checks/` and `health-checks/` directories were also flagged but are excluded per the exclusion directive.
