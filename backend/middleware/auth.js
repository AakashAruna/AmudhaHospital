const jwt = require('jsonwebtoken');
const { User } = require('../models');

const SECRET_KEY = process.env.JWT_SECRET || process.env.SECRET_KEY || 'supersecretkeyforhospitalmanagementsystemdevelopment';
const ALGORITHM = 'HS256';

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  // Bearer <token>
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ detail: 'Authentication token is missing' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY, { algorithms: [ALGORITHM] });
    // sub holds username
    const username = decoded.sub;

    if (!username) {
      return res.status(401).json({ detail: 'Could not validate credentials' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ detail: 'User not found or credentials invalid' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('JWT Verification error:', err);
    return res.status(401).json({ detail: 'Could not validate credentials' });
  }
};

// Middleware to check role authorization
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ detail: 'Unauthorized' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        detail: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  SECRET_KEY,
  ALGORITHM
};
