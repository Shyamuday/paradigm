import rateLimit from 'express-rate-limit';
import { logger } from '../logger/logger';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

// Rate limiter for trading operations
export const tradingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 trading requests per minute
  message: {
    error: 'Too many trading requests, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Trading rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Too many trading requests, please slow down.',
      retryAfter: '1 minute'
    });
  }
});

// Rate limiter for market data requests
export const marketDataLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Limit each IP to 50 market data requests per minute
  message: {
    error: 'Too many market data requests, please slow down.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Market data rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Too many market data requests, please slow down.',
      retryAfter: '1 minute'
    });
  }
});

// Rate limiter for webhook endpoints
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 webhook requests per minute
  message: {
    error: 'Too many webhook requests.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Webhook rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Too many webhook requests.',
      retryAfter: '1 minute'
    });
  }
});

// Rate limiter for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 uploads per hour
  message: {
    error: 'Too many file uploads, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Too many file uploads, please try again later.',
      retryAfter: '1 hour'
    });
  }
});

// Custom rate limiter factory
export const createCustomLimiter = (
  windowMs: number,
  max: number,
  message: string,
  retryAfter?: string
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: retryAfter || `${Math.ceil(windowMs / 60000)} minutes`
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Custom rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent'),
        windowMs,
        max
      });
      res.status(429).json({
        error: message,
        retryAfter: retryAfter || `${Math.ceil(windowMs / 60000)} minutes`
      });
    }
  });
};

// Rate limiter for specific user actions
export const userActionLimiter = (action: string, max: number, windowMs: number = 60000) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      // Use user ID if available, otherwise use IP
      return req.user?.id || req.ip;
    },
    message: {
      error: `Too many ${action} attempts, please try again later.`,
      retryAfter: `${Math.ceil(windowMs / 60000)} minutes`
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`User action rate limit exceeded: ${action}`, {
        userId: req.user?.id,
        ip: req.ip,
        path: req.path,
        action
      });
      res.status(429).json({
        error: `Too many ${action} attempts, please try again later.`,
        retryAfter: `${Math.ceil(windowMs / 60000)} minutes`
      });
    }
  });
};

// Export all limiters
export const rateLimiters = {
  api: apiLimiter,
  auth: authLimiter,
  trading: tradingLimiter,
  marketData: marketDataLimiter,
  webhook: webhookLimiter,
  upload: uploadLimiter,
  createCustom: createCustomLimiter,
  userAction: userActionLimiter
}; 