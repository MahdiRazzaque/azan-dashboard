const express = require('express');
const router = express.Router();
const asyncHandler = require('@middleware/asyncHandler');
const systemController = require('@controllers/systemController');
const { operationsLimiter } = require('@middleware/rateLimiters');
const authenticateToken = require('@middleware/auth');

router.get('/health', asyncHandler(systemController.getHealth));
router.post('/health/refresh', operationsLimiter, authenticateToken, asyncHandler(systemController.refreshHealth));
router.get('/jobs', authenticateToken, asyncHandler(systemController.getJobs));
router.get('/audio-files', authenticateToken, asyncHandler(systemController.getAudioFiles));
router.get('/constants', authenticateToken, asyncHandler(systemController.getConstants));
router.get('/status/automation', authenticateToken, asyncHandler(systemController.getAutomationStatus));
router.get('/status/tts', authenticateToken, asyncHandler(systemController.getTTSStatus));
router.get('/storage', authenticateToken, asyncHandler(systemController.getStorageStatus));
router.get('/voices', authenticateToken, asyncHandler(systemController.getVoices));
router.post('/preview-tts', operationsLimiter, authenticateToken, asyncHandler(systemController.previewTTS));
router.post('/regenerate-tts', operationsLimiter, authenticateToken, asyncHandler(systemController.regenerateTTS));
router.post('/restart-scheduler', operationsLimiter, authenticateToken, asyncHandler(systemController.restartScheduler));
router.post('/test-audio', operationsLimiter, authenticateToken, asyncHandler(systemController.testAudio));
router.post('/validate-url', operationsLimiter, authenticateToken, asyncHandler(systemController.validateUrl));
router.post('/source/test', operationsLimiter, authenticateToken, asyncHandler(systemController.testSource));
router.post('/test-voicemonkey', authenticateToken, asyncHandler(systemController.testVoiceMonkey));
router.post('/cleanup-temp-tts', operationsLimiter, authenticateToken, asyncHandler(systemController.cleanupTempTTS));

module.exports = router;
