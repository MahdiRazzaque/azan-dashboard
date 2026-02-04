const jwt = require('jsonwebtoken');
const configService = require('@config');

/**
 * Middleware to authenticate requests using a JWT from cookies.
 * Verifies the authentication token and attaches the user data to the request object.
 * 
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The next middleware function.
 * @returns {void}
 */
const authenticateToken = (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  // Strictly use JWT_SECRET from environment. Fallback to ADMIN_PASSWORD is removed for security.
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
      console.error("JWT_SECRET is not configured in environment.");
      return res.status(500).json({ error: 'Server configuration error' });
  }

  jwt.verify(token, secret, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });

    // Verify token version against current server configuration
    const currentVersion = configService.get().security.tokenVersion;
    if (user.tokenVersion !== currentVersion) {
        return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    req.user = user;
    next();
  });
};

module.exports = authenticateToken;