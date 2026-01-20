const express = require('express');
const router = express.Router();
const { globalReadLimiter, globalWriteLimiter, sseLimiter } = require('@middleware/rateLimiters');
const systemController = require('@controllers/systemController');

// Global Rate Limiting
router.use((req, res, next) => {
    if (req.method === 'GET') {
        // SSE endpoint /logs has its own stricter limiter applied specifically to its route
        if (req.path === '/logs') return next();
        return globalReadLimiter(req, res, next);
    }
    return globalWriteLimiter(req, res, next);
});

// Sub-routers
router.use('/auth', require('./auth'));
router.use('/system', require('./system'));
router.use('/settings', require('./settings'));
router.use('/prayers', require('./prayers'));

const errorHandler = require('@middleware/errorHandler');

// SSE Logs endpoint (kept at root of /api)
router.get('/logs', sseLimiter, systemController.getLogs);

// Global Error Handler
router.use(errorHandler);

module.exports = router;
