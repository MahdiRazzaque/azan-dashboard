const express = require('express');
const router = express.Router();
const asyncHandler = require('@middleware/asyncHandler');
const systemController = require('@controllers/systemController');
const { operationsLimiter } = require('@middleware/rateLimiters');
const authenticateToken = require('@middleware/auth');

router.get('/health', asyncHandler(systemController.getHealth));
router.post('/health/toggle', authenticateToken, asyncHandler(systemController.toggleHealthCheck));
router.post('/health/refresh', operationsLimiter, authenticateToken, asyncHandler(systemController.forceRefreshHealth));
router.get('/jobs', authenticateToken, asyncHandler(systemController.getJobs));
router.get('/audio-files', authenticateToken, asyncHandler(systemController.getAudioFiles));
router.get('/constants', authenticateToken, asyncHandler(systemController.getConstants));
router.get('/status/automation', authenticateToken, asyncHandler(systemController.getAutomationStatus));
router.get('/status/tts', authenticateToken, asyncHandler(systemController.getTTSStatus));
router.get('/storage', authenticateToken, asyncHandler(systemController.getStorageStatus));
router.get('/voices', authenticateToken, asyncHandler(systemController.getVoices));
router.post('/preview-tts', operationsLimiter, authenticateToken, asyncHandler(systemController.previewTTS));
router.post('/regenerate-tts', operationsLimiter, authenticateToken, asyncHandler(systemController.regenerateTTS));
router.post('/run-job', operationsLimiter, authenticateToken, asyncHandler(systemController.runJob));
router.post('/restart-scheduler', operationsLimiter, authenticateToken, asyncHandler(systemController.restartScheduler));
router.post('/validate-url', operationsLimiter, authenticateToken, asyncHandler(systemController.validateUrl));
router.post('/source/test', operationsLimiter, authenticateToken, asyncHandler(systemController.testSource));
router.post('/cleanup-temp-tts', operationsLimiter, authenticateToken, asyncHandler(systemController.cleanupTempTTS));
router.get('/providers', authenticateToken, asyncHandler(systemController.getProviders));
router.get('/services/registry', authenticateToken, asyncHandler(systemController.getServiceRegistry));

// Output Strategy Endpoints
router.get('/outputs/registry', authenticateToken, asyncHandler(systemController.getOutputRegistry));
router.post('/outputs/:strategyId/verify', operationsLimiter, authenticateToken, asyncHandler(systemController.verifyOutput));
router.post('/outputs/:strategyId/test', operationsLimiter, authenticateToken, asyncHandler(systemController.testOutput));

module.exports = router;