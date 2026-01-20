const jwt = require('jsonwebtoken');
const envManager = require('@utils/envManager');
const { hashPassword, verifyPassword } = require('@utils/passwordUtils');

/**
 * Controller for authentication-related operations, managing login sessions,
 * password resets, and system initialisation.
 */
const authController = {
    /**
     * Retrieves the current authentication and configuration status of the system.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    checkStatus: (req, res) => {
        res.json({ 
            configured: envManager.isConfigured(),
            requiresSetup: !process.env.ADMIN_PASSWORD
        });
    },

    /**
     * Performs initial system setup by setting the admin password and generating a JWT secret.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {void}
     */
    setup: (req, res) => {
        // Prevent setup if an admin password is already configured
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
            
            // Automatically generate a secret for JWT signing if one is not already present
            let jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                jwtSecret = envManager.generateSecret();
                envManager.setEnvValue('JWT_SECRET', jwtSecret);
            }

            // Generate an initial token for immediate login after setup
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
     * Updates the administrative password for the system.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {void}
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
     * Authenticates a user with the admin password and issues a JWT as a cookie.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {void}
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
            // Revert to password as fallback secret if JWT_SECRET is unexpectedly missing
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
     * Terminates the current session by clearing the authentication cookie.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    logout: (req, res) => {
        res.clearCookie('auth_token');
        res.json({ success: true });
    },

    /**
     * Validates the current session token to confirm authentication status.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    checkAuth: (req, res) => {
        res.json({ authenticated: true });
    }
};

module.exports = authController;
