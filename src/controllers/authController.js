const jwt = require('jsonwebtoken');
const envManager = require('@utils/envManager');
const { hashPassword, verifyPassword } = require('@utils/passwordUtils');
const configService = require('@config');

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
     * @returns {Promise<void>}
     */
    setup: async (req, res) => {
        // Prevent setup if an admin password is already configured
        if (process.env.ADMIN_PASSWORD) {
            return res.status(403).json({ error: 'System already configured. Login to change settings.' });
        }

        const { password } = req.body;
        if (!password || password.length < 5) {
            return res.status(400).json({ error: 'Password too short' });
        }

        try {
            const hashed = await hashPassword(password);
            await envManager.setEnvValue('ADMIN_PASSWORD', hashed);
            
            // Automatically generate secrets for JWT and Encryption if not already present
            let jwtSecret = process.env.JWT_SECRET;
            if (!jwtSecret) {
                jwtSecret = envManager.generateSecret(64);
                await envManager.setEnvValue('JWT_SECRET', jwtSecret);
            }

            let encryptionSalt = process.env.ENCRYPTION_SALT;
            if (!encryptionSalt) {
                encryptionSalt = envManager.generateSecret(32);
                await envManager.setEnvValue('ENCRYPTION_SALT', encryptionSalt);
            }

            // Generate an initial token for immediate login after setup
            const tokenVersion = configService.get().security.tokenVersion;
            const token = jwt.sign({ role: 'admin', tokenVersion }, jwtSecret, { expiresIn: '24h' });
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
     * @returns {Promise<void>}
     */
    changePassword: async (req, res) => {
        const { password } = req.body;
        if (!password) return res.status(400).json({ error: 'Missing password' });

        try {
            const hashed = await hashPassword(password);
            await envManager.setEnvValue('ADMIN_PASSWORD', hashed);

            // Increment tokenVersion to invalidate all existing sessions
            const currentConfig = configService.get();
            const newVersion = (currentConfig.security?.tokenVersion || 0) + 1;
            await configService.update({
                security: {
                    tokenVersion: newVersion
                }
            });

            res.json({ success: true, message: 'Password updated' });
        } catch {
            res.status(500).json({ error: 'Failed to update password' });
        }
    },

    /**
     * Authenticates a user with the admin password and issues a JWT as a cookie.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>}
     */
    login: async (req, res) => {
        const { password } = req.body;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminPassword) {
            return res.status(500).json({ 
                error: 'Server authentication not configured', 
                code: 'SETUP_REQUIRED' 
            });
        }

        const isValid = await verifyPassword(password, adminPassword);
        if (isValid) {
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                return res.status(500).json({ error: 'System security not fully configured (Missing JWT Secret)' });
            }

            const tokenVersion = configService.get().security.tokenVersion;
            const token = jwt.sign({ role: 'admin', tokenVersion }, secret, { expiresIn: '24h' });

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