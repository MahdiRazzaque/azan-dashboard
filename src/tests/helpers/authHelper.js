const jwt = require('jsonwebtoken');

const authHelper = {
    /**
     * Generates a valid JWT auth cookie string.
     * @param {string} secret - The secret to sign with (defaults to process.env.JWT_SECRET)
     * @returns {string} The cookie string "auth_token=..."
     */
    getAuthToken(secret = process.env.JWT_SECRET) {
        // Fallback if env not set (though setup.js should set it)
        const s = secret || 'test-secret';
        const token = jwt.sign({ role: 'admin' }, s, { expiresIn: '1h' });
        return `auth_token=${token}`;
    }
};

module.exports = authHelper;
