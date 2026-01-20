const express = require('express');
const router = express.Router();
const asyncHandler = require('@middleware/asyncHandler');
const settingsController = require('@controllers/settingsController');
const { operationsLimiter } = require('@middleware/rateLimiters');
const authenticateToken = require('@middleware/auth');
const upload = require('@middleware/fileUpload');
const storageCheck = require('@middleware/storageCheck');

router.get('/', authenticateToken, asyncHandler(settingsController.getSettings));
router.post('/update', authenticateToken, asyncHandler(settingsController.updateSettings));
router.post('/reset', authenticateToken, asyncHandler(settingsController.resetSettings));
router.post('/refresh-cache', operationsLimiter, authenticateToken, asyncHandler(settingsController.refreshCache));
router.post('/upload', operationsLimiter, authenticateToken, storageCheck, upload.single('file'), asyncHandler(settingsController.uploadFile));
router.delete('/files', authenticateToken, asyncHandler(settingsController.deleteFile));
router.post('/credentials/voicemonkey', authenticateToken, asyncHandler(settingsController.saveVoiceMonkey));
router.delete('/credentials/voicemonkey', authenticateToken, asyncHandler(settingsController.deleteVoiceMonkey));

module.exports = router;
