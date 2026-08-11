const { verifyToken } = require('../config/jwt');
const User = require('../models/User');

// Protect routes - require authentication
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Token is not valid' });
    }

    req.user = await User.findById(decoded.id);
    
    if (!req.user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

// Attach req.user if a valid token is present, but never reject the request when it's absent or
// invalid - for public endpoints that only need to know identity when it's available (e.g.
// "highlight the current user's own prediction within a public list").
exports.optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer')) {
    return next();
  }

  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    if (decoded) {
      req.user = await User.findById(decoded.id);
    }
  } catch (error) {
    // Silently ignore - an invalid/expired token on a public route just means "not logged in".
  }
  next();
};

// Authorize specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `User role '${req.user.role}' is not authorized to access this route` 
      });
    }
    next();
  };
};
