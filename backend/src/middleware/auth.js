const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'hathor-guardian-secret';

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token. User not found or inactive.'
      });
    }

    // Add user info to request
    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      user: user
    };

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired.'
      });
    }

    logger.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed.'
    });
  }
};

// Role-based authorization middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions.'
      });
    }

    next();
  };
};

// API key authentication middleware
const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required.'
      });
    }

    // Find user with this API key
    const user = await User.findOne({
      'apiKeys.key': apiKey,
      'apiKeys.isActive': true
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key.'
      });
    }

    // Update last used timestamp
    const keyIndex = user.apiKeys.findIndex(k => k.key === apiKey);
    if (keyIndex !== -1) {
      user.apiKeys[keyIndex].lastUsed = new Date();
      await user.save();
    }

    // Add user info to request
    req.user = {
      userId: user._id,
      role: user.role,
      user: user,
      apiKey: user.apiKeys[keyIndex]
    };

    next();

  } catch (error) {
    logger.error('API key auth error:', error);
    res.status(500).json({
      success: false,
      error: 'API key authentication failed.'
    });
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (user && user.isActive) {
        req.user = {
          userId: decoded.userId,
          role: decoded.role,
          user: user
        };
      }
    }

    next();

  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  auth,
  authorize,
  apiKeyAuth,
  optionalAuth
};