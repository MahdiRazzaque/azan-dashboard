const rateLimit = require('express-rate-limit');
const sseService = require('../services/sseService');

/**
 * Helper to handle rate limit response and logging
 */
const limitHandler = (baseMessage) => (req, res) => {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const retryAfter = res.getHeader('Retry-After');
    
    // Create the enhanced message with wait time if available
    const waitMsg = retryAfter ? ` - Please try again in ${retryAfter} seconds.` : '';
    const fullMessage = `${baseMessage}${waitMsg}`;
    
    const logMsg = `Rate limit exceeded for ${clientIp} on ${req.originalUrl}: ${fullMessage}`;
    
    console.warn(`[RateLimit] ${logMsg}`);
    sseService.log(logMsg, 'WARN');
    
    res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: fullMessage,
        retryAfter: retryAfter
    });
};

// Common configuration to skip during tests unless forced (for unit tests)
const skipTest = () => process.env.NODE_ENV === 'test' && !process.env.FORCE_RATE_LIMIT;

// Tier 1: Security (Strict) - Login, Setup, Password change
// 5 requests per 15 minutes
const securityLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipTest,
    handler: limitHandler('Too many authentication attempts. Please try again in 15 minutes.')
});

// Tier 2: Operations (Medium) - Resource heavy or system critical actions
// 5 requests per minute
const operationsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipTest,
    handler: limitHandler('Too many operation requests. Please wait a minute.')
});

// Tier 3: Global Read (Generous) - General polling and data retrieval
// 100 requests per minute (approx 1.6 req/s sustained, handles page refresh bursts)
const globalReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipTest,
    handler: limitHandler('Too many read requests. Please wait a minute.')
});

// Tier 4: Global Write (General) - Settings updates and other POST/PUT/DELETE
// 20 requests per minute
const globalWriteLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipTest,
    handler: limitHandler('Too many update requests. Please wait a minute.')
});

// Tier 5: SSE Exception (Connection Rate) - Connection limiter for logs
// 30 new connections per minute (handles separate connections per refresh)
const sseLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipTest,
    handler: limitHandler('Too many log connection attempts.')
});

module.exports = {
    securityLimiter,
    operationsLimiter,
    globalReadLimiter,
    globalWriteLimiter,
    sseLimiter
};
