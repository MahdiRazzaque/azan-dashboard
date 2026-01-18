const jwt = require('jsonwebtoken');
const envManager = require('../utils/envManager');
const { hashPassword, verifyPassword } = require('../utils/auth');

/**
 * Controller for Authentication related operations.
 */
const authController = {
    /**
     * Get the current authentication and configuration status.
     */
    checkStatus: (req, res) => {
        res.json({ 
            configured: envManager.isConfigured(),
            requiresSetup: !process.env.ADMIN_PASSWORD
        });
    },

    /**
     * Initial system setup: set admin password and generate JWT secret.
     */
    setup: (req, res) => {
        // Only allow if NOT configured
        if (process.env.ADMIN_PASSWORD) {
            return res.status(403).json({ error: 'System already configured. Login to change settings.' });
        }

        const { password } = req.body;
        if (!password || password.length < 5) {
            return res.status(400).json({ error: 'Password too short' });
        }

        try {
            const hashed = hashPassword(password);
            envManager.setEnvValue('ADMIN_PASSWORD', hashed);
            
            // Auto-generate JWT Secret if missing
            let jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                jwtSecret = envManager.generateSecret();
                envManager.setEnvValue('JWT_SECRET', jwtSecret);
            }

            // Auto-login logic
            const token = jwt.sign({ role: 'admin' }, jwtSecret, { expiresIn: '24h' });
            res.cookie('auth_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000
            });

            res.json({ success: true, message: 'Structure secured and logged in.' });
        } catch (e) {
            console.error("Setup Error:", e);
            res.status(500).json({ error: 'Failed to write configuration' });
        }
    },

    /**
     * Change the admin password.
     */
    changePassword: (req, res) => {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Missing password' });

        try {
            const hashed = hashPassword(password);
            envManager.setEnvValue('ADMIN_PASSWORD', hashed);
            res.json({ success: true, message: 'Password updated' });
        } catch (e) {
            res.status(500).json({ error: 'Failed to update password' });
        }
    },

    /**
     * Login with admin password and receive a JWT cookie.
     */
    login: (req, res) => {
        const { password } = req.body;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            return res.status(500).json({ 
                error: 'Server authentication not configured', 
                code: 'SETUP_REQUIRED' 
            });
        }

        if (verifyPassword(password, adminPassword)) {
            const secret = process.env.JWT_SECRET || adminPassword;
            const token = jwt.sign({ role: 'admin' }, secret, { expiresIn: '24h' });

            res.cookie('auth_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 24 * 60 * 60 * 1000
            });
            
            return res.json({ success: true });
        }
        
        res.status(401).json({ error: 'Invalid password' });
    },

    /**
     * Logout by clearing the auth cookie.
     */
    logout: (req, res) => {
        res.clearCookie('auth_token');
        res.json({ success: true });
    },

    /**
     * Simple check to see if the current token is valid.
     */
    checkAuth: (req, res) => {
        res.json({ authenticated: true });
    }
};

module.exports = authController;
