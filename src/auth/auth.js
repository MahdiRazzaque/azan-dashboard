import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { promisify } from 'util';
import { getConfig } from '../config/config-service.js';
import * as dotenv from 'dotenv';
import { getTestMode } from '../utils/utils.js';

// Load environment variables
dotenv.config();

// Default session timeout (1 hour)
const DEFAULT_SESSION_TIMEOUT = 3600000;

// Session management
const sessions = new Map();

// Configure login rate limiter
const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 login attempts per window
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { 
        success: false, 
        message: 'Too many login attempts from this IP, please try again after 15 minutes' 
    }
});

// Secure password hashing functions using PBKDF2 (more secure than SHA-256)
const pbkdf2 = promisify(crypto.pbkdf2);

// Hash a password using PBKDF2
async function hashPassword(password) {
    const salt = process.env.SALT || crypto.randomBytes(16).toString('hex');
    const iterations = 10000; // Recommended minimum
    const keylen = 64;
    const digest = 'sha512';
    
    const derivedKey = await pbkdf2(password, salt, iterations, keylen, digest);
    return derivedKey.toString('hex');
}

// Verify password against stored hash
async function verifyPassword(password, storedHash) {
    const hashedInput = await hashPassword(password);
    return crypto.timingSafeEqual(
        Buffer.from(hashedInput, 'hex'),
        Buffer.from(storedHash, 'hex')
    );
}

// Generate session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Authentication middleware
function requireAuth(req, res, next) {
    // Skip authentication if TEST_MODE is enabled
    if (getTestMode()) {
        console.log("🧪 TEST MODE: Authentication bypassed");
        return next();
    }
    
    const token = req.headers['x-auth-token'];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const session = sessions.get(token);
    if (!session) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Try to get config from in-memory store first
    let sessionTimeout = DEFAULT_SESSION_TIMEOUT;
    try {
        const config = getConfig(true);
        sessionTimeout = config?.auth?.sessionTimeout || DEFAULT_SESSION_TIMEOUT;
    } catch (error) {
        console.warn('Error getting session timeout from config, using default:', error);
    }

    // Check if session has expired
    if (Date.now() - session.timestamp > sessionTimeout) {
        sessions.delete(token);
        return res.status(401).json({ success: false, message: 'Session expired' });
    }

    // Update session timestamp
    session.timestamp = Date.now();
    next();
}

// Clean up expired sessions periodically
function startSessionCleanup() {
    setInterval(() => {
        const now = Date.now();
        
        // Try to get config from in-memory store
        let sessionTimeout = DEFAULT_SESSION_TIMEOUT;
        try {
            const config = getConfig(true);
            sessionTimeout = config?.auth?.sessionTimeout || DEFAULT_SESSION_TIMEOUT;
        } catch (error) {
            console.warn('Error getting session timeout from config, using default:', error);
        }
        
        for (const [token, session] of sessions.entries()) {
            if (now - session.timestamp > sessionTimeout) {
                sessions.delete(token);
            }
        }
    }, 60000); // Clean up every minute
}

// Auth routes setup
function setupAuthRoutes(app) {
    // Login endpoint
    app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
        try {
            // If TEST_MODE is enabled, allow any login
            if (getTestMode()) {
                console.log("🧪 TEST MODE: Auto-login enabled");
                const token = generateSessionToken();
                sessions.set(token, { 
                    username: 'test-user',
                    timestamp: Date.now()
                });
                return res.json({ success: true, token });
            }
            
            const { username, password } = req.body;

            // Check username first
            if (username !== process.env.ADMIN_USERNAME) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
            
            // Verify password using the new secure verification
            const passwordMatches = await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
            
            if (passwordMatches) {
                // Generate a new session token
                const token = generateSessionToken();
                
                // Invalidate any existing sessions for this user (session regeneration)
                for (const [existingToken, session] of sessions.entries()) {
                    if (session.username === username) {
                        sessions.delete(existingToken);
                    }
                }
                
                // Create a new session
                sessions.set(token, { 
                    username,
                    timestamp: Date.now()
                });
                
                res.json({ success: true, token });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ success: false, message: 'An error occurred during authentication' });
        }
    });

    // Logout endpoint
    app.post('/api/auth/logout', requireAuth, (req, res) => {
        const token = req.headers['x-auth-token'];
        sessions.delete(token);
        res.json({ success: true });
    });

    // Check auth status endpoint
    app.get('/api/auth/status', (req, res) => {
        // If TEST_MODE is enabled, always return authenticated
        if (getTestMode()) {
            console.log("🧪 TEST MODE: Authentication status check bypassed");
            return res.json({ authenticated: true });
        }
        
        const token = req.headers['x-auth-token'];
        const isAuthenticated = token && sessions.has(token);
        res.json({ authenticated: isAuthenticated });
    });
}

export {
    requireAuth,
    setupAuthRoutes,
    startSessionCleanup
};