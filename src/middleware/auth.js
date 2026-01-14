const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const token = req.cookies.auth_token;

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  // Use ADMIN_PASSWORD as secret for simplicity unless JWT_SECRET is provided
  // In a production app, we should use a dedicated secure random string for JWT_SECRET
  const secret = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD;
  
  if (!secret) {
      console.error("JWT Secret or ADMIN_PASSWORD not configured.");
      return res.status(500).json({ error: 'Server configuration error' });
  }

  jwt.verify(token, secret, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;
