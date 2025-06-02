const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('redis');
const logger = require('../utils/logger');

// Create Redis client
const redisClient = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

// Rate limiter configurations
const rateLimiters = {
  // General API rate limiter
  api: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl_api',
    points: 100, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 60, // Block for 60 seconds if limit exceeded
  }),

  // Fraud detection endpoint (more restrictive)
  fraud: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl_fraud',
    points: 50, // Number of requests
    duration: 60, // Per 60 seconds
    blockDuration: 120, // Block for 2 minutes if limit exceeded
  }),

  // Authentication endpoints (very restrictive)
  auth: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'rl_auth',
    points: 5, // Number of requests
    duration: 900, // Per 15 minutes
    blockDuration: 900, // Block for 15 minutes if limit exceeded
  })
};

const createRateLimitMiddleware = (limiterType = 'api') => {
  const limiter = rateLimiters[limiterType];
  
  return async (req, res, next) => {
    try {
      const key = req.ip;
      await limiter.consume(key);
      next();
    } catch (rejRes) {
      const remainingPoints = rejRes.remainingPoints || 0;
      const msBeforeNext = rejRes.msBeforeNext || 0;
      
      res.set({
        'Retry-After': Math.round(msBeforeNext / 1000) || 1,
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + msBeforeNext)
      });

      logger.warn('Rate limit exceeded:', {
        ip: req.ip,
        endpoint: req.originalUrl,
        remainingPoints,
        msBeforeNext
      });

      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.round(msBeforeNext / 1000)
      });
    }
  };
};

module.exports = createRateLimitMiddleware;
