import crypto from 'crypto';
import { appConfig } from '../config/config-validator.js';

// Session management
const sessions = new Map();

// Hash function for password
function hashPassword(password) {
    return crypto.createHash('sha256')
        .update(password + process.env.SALT || '')
        .digest('hex');
}

// Generate session token
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Authentication middleware
function requireAuth(req, res, next) {
    const token = req.headers['x-auth-token'];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const session = sessions.get(token);
    if (!session) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    // Default session timeout to 1 hour if not configured
    const sessionTimeout = appConfig.auth?.sessionTimeout || 3600000;

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
        const sessionTimeout = appConfig.auth?.sessionTimeout || 3600000;
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
    app.post('/api/auth/login', (req, res) => {
        const { username, password } = req.body;
        const hashedPassword = hashPassword(password);

        if (username === process.env.ADMIN_USERNAME && 
            hashedPassword === process.env.ADMIN_PASSWORD_HASH) {
            const token = generateSessionToken();
            sessions.set(token, { 
                username,
                timestamp: Date.now()
            });
            res.json({ success: true, token });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
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