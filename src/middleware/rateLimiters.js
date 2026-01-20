const rateLimit = require('express-rate-limit');
const sseService = require('@services/system/sseService');

/**
 * Helper to handle rate limit response and logging.
 * Returns a handler function that logs the violation and sends a 429 response.
 * 
 * @param {string} baseMessage - The base error message to display to the user.
 * @returns {Function} A rate limit handler function.
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
/**
 * Condition to skip rate limiting during tests.
 * Rate limiting is skipped in the test environment unless explicitly forced.
 * 
 * @returns {boolean} True if rate limiting should be skipped.
 */
const skipTest = () => process.env.NODE_ENV === 'test' && !process.env.FORCE_RATE_LIMIT;

// Tier 1: Security (Strict) - Login, Setup, Password change
// 20 requests per minute
const securityLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipTest,
    handler: limitHandler('Too many authentication attempts. Please try again in a minute.')
});

// Tier 2: Operations (Medium) - Resource heavy or system critical actions
// 10 requests per 10 seconds
const operationsLimiter = rateLimit({
    windowMs: 10 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipTest,
    handler: limitHandler('Too many operation requests. Please wait 10 seconds.')
});

// Tier 3: Global Read (Generous) - General polling and data retrieval
// 50 requests per 10 seconds
const globalReadLimiter = rateLimit({
    windowMs: 10 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipTest,
    handler: limitHandler('Too many read requests. Please wait 10 seconds.')
});

// Tier 4: Global Write (General) - Settings updates and other POST/PUT/DELETE
// 10 requests per 10 seconds
const globalWriteLimiter = rateLimit({
    windowMs: 10 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipTest,
    handler: limitHandler('Too many update requests. Please wait 10 seconds.')
});

// Tier 5: SSE Exception (Connection Rate) - Connection limiter for logs
// 50 new connections per minute (handles separate connections per refresh)
const sseLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 50,
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
