import { Request, Response, NextFunction } from 'express';
import {
  securityValidator,
  SecurityValidator,
  ValidationResult,
  SecurityLevel,
  ValidationType,
  validateTradingInput,
  validateOrderInput,
  validateUserInput,
  validatePassword
} from '../utils/security-validator';
import { logger } from '../logger/logger';

// Security middleware configuration
export interface SecurityMiddlewareConfig {
  enableInputValidation?: boolean;
  enableAuthentication?: boolean;
  enableAuthorization?: boolean;
  enableRateLimit?: boolean;
  enableSecurityHeaders?: boolean;
  enableAuditLog?: boolean;
  allowedOrigins?: string[];
  maxRequestSize?: number;
  rateLimitWindow?: number;
  rateLimitMax?: number;
}

// Security middleware
export const securityMiddleware = (config: SecurityMiddlewareConfig = {}) => {
  const {
    enableInputValidation = true,
    enableAuthentication = true,
    enableAuthorization = true,
    enableRateLimit = true,
    enableSecurityHeaders = true,
    enableAuditLog = true,
    allowedOrigins = ['http://localhost:3000'],
    maxRequestSize = 1024 * 1024, // 1MB
    rateLimitWindow = 15 * 60 * 1000, // 15 minutes
    rateLimitMax = 100
  } = config;

  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add request context
    (req as any).context = {
      requestId,
      startTime,
      securityChecks: []
    };

    try {
      // 1. Security Headers
      if (enableSecurityHeaders) {
        setSecurityHeaders(res);
      }

      // 2. CORS Validation
      const corsValidation = validateCORS(req, allowedOrigins);
      if (!corsValidation.isValid) {
        return res.status(403).json({
          error: 'CORS validation failed',
          details: corsValidation.errors
        });
      }

      // 3. Request Size Validation
      const sizeValidation = validateRequestSize(req, maxRequestSize);
      if (!sizeValidation.isValid) {
        return res.status(413).json({
          error: 'Request too large',
          details: sizeValidation.errors
        });
      }

      // 4. Rate Limiting
      if (enableRateLimit) {
        const rateLimitValidation = securityValidator.checkRateLimit(
          getClientIdentifier(req),
          { requestId, path: req.path, method: req.method }
        );

        if (!rateLimitValidation.isValid) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            details: rateLimitValidation.errors
          });
        }
      }

      // 5. Authentication Validation
      if (enableAuthentication) {
        const authHeader = req.headers.authorization;
        if (authHeader) {
          const authValidation = securityValidator.validateAuthentication(
            authHeader.replace('Bearer ', ''),
            { requestId, path: req.path, method: req.method }
          );

          if (!authValidation.isValid) {
            return res.status(401).json({
              error: 'Authentication failed',
              details: authValidation.errors
            });
          }
        }
      }

      // 6. Authorization Validation
      if (enableAuthorization) {
        const userId = (req as any).user?.id;
        if (userId) {
          const authzValidation = securityValidator.validateAuthorization(
            userId,
            req.path,
            req.method,
            { requestId, path: req.path, method: req.method }
          );

          if (!authzValidation.isValid) {
            return res.status(403).json({
              error: 'Authorization failed',
              details: authzValidation.errors
            });
          }
        }
      }

      // 7. Input Validation (if enabled)
      if (enableInputValidation) {
        const inputValidation = validateRequestInput(req);
        if (!inputValidation.isValid) {
          return res.status(400).json({
            error: 'Input validation failed',
            details: inputValidation.errors
          });
        }
      }

      // Log security check completion
      if (enableAuditLog) {
        const duration = Date.now() - startTime;
        logger.info('Security validation completed', {
          requestId,
          path: req.path,
          method: req.method,
          duration,
          securityChecks: (req as any).context.securityChecks
        });
      }

      next();
      return;

    } catch (error) {
      logger.error('Security middleware error', {
        requestId,
        error: (error as Error).message,
        stack: (error as Error).stack
      });

      return res.status(500).json({
        error: 'Security validation error',
        requestId
      });
    }
  };
};

// Input validation middleware
export const inputValidationMiddleware = (validationRules: Record<string, string>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];
    const requestId = (req as any).context?.requestId || 'unknown';

    try {
      // Validate request body
      if (req.body) {
        for (const [field, ruleName] of Object.entries(validationRules)) {
          const value = req.body[field];
          const validation = securityValidator.validateInput(
            value,
            ruleName,
            { requestId, field, source: 'body' }
          );

          if (!validation.isValid) {
            errors.push(...validation.errors.map(err => `${field}: ${err}`));
          }
        }
      }

      // Validate query parameters
      if (req.query) {
        for (const [field, ruleName] of Object.entries(validationRules)) {
          const value = req.query[field];
          if (value !== undefined) {
            const validation = securityValidator.validateInput(
              value,
              ruleName,
              { requestId, field, source: 'query' }
            );

            if (!validation.isValid) {
              errors.push(...validation.errors.map(err => `${field}: ${err}`));
            }
          }
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          error: 'Input validation failed',
          details: errors,
          requestId
        });
      }

      next();
      return;

    } catch (error) {
      logger.error('Input validation middleware error', {
        requestId,
        error: (error as Error).message
      });

      return res.status(500).json({
        error: 'Input validation error',
        requestId
      });
    }
  };
};

// Authentication middleware
export const authenticationMiddleware = (options: {
  requireAuth?: boolean;
  roles?: string[];
} = {}) => {
  const { requireAuth = true, roles = [] } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).context?.requestId || 'unknown';

    try {
      const authHeader = req.headers.authorization;

      if (!authHeader && requireAuth) {
        return res.status(401).json({
          error: 'Authentication required',
          requestId
        });
      }

      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const validation = securityValidator.validateAuthentication(
          token,
          { requestId, path: req.path, method: req.method }
        );

        if (!validation.isValid) {
          return res.status(401).json({
            error: 'Authentication failed',
            details: validation.errors,
            requestId
          });
        }

        // Check roles if specified
        if (roles.length > 0) {
          const userRole = (req as any).user?.role;
          if (!userRole || !roles.includes(userRole)) {
            return res.status(403).json({
              error: 'Insufficient permissions',
              requestId
            });
          }
        }
      }

      next();
      return;

    } catch (error) {
      logger.error('Authentication middleware error', {
        requestId,
        error: (error as Error).message
      });

      return res.status(500).json({
        error: 'Authentication error',
        requestId
      });
    }
  };
};

// Rate limiting middleware
export const rateLimitMiddleware = (options: {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: Request) => string;
} = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    keyGenerator = getClientIdentifier
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = (req as any).context?.requestId || 'unknown';
    const identifier = keyGenerator(req);

    try {
      const validation = securityValidator.checkRateLimit(
        identifier,
        { requestId, path: req.path, method: req.method }
      );

      if (!validation.isValid) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          details: validation.errors,
          requestId
        });
      }

      next();
      return;

    } catch (error) {
      logger.error('Rate limit middleware error', {
        requestId,
        error: (error as Error).message
      });

      return res.status(500).json({
        error: 'Rate limit error',
        requestId
      });
    }
  };
};

// Security headers middleware
export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  setSecurityHeaders(res);
  next();
};

// Audit logging middleware
export const auditLogMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = (req as any).context?.requestId || 'unknown';

  // Override res.end to capture response
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: any, cb?: () => void) {
    const duration = Date.now() - startTime;

    // Log request details
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: (req as any).user?.id
    });

    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
  return;
};

// Trading-specific validation middleware
export const tradingValidationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).context?.requestId || 'unknown';
  const errors: string[] = [];

  try {
    // Validate trading-specific inputs
    if (req.body.symbol) {
      const symbolValidation = validateTradingInput(req.body.symbol, { requestId });
      if (!symbolValidation.isValid) {
        errors.push(...symbolValidation.errors);
      }
    }

    if (req.body.quantity) {
      const quantityValidation = securityValidator.validateInput(
        req.body.quantity,
        'quantity',
        { requestId }
      );
      if (!quantityValidation.isValid) {
        errors.push(...quantityValidation.errors);
      }
    }

    if (req.body.price) {
      const priceValidation = securityValidator.validateInput(
        req.body.price,
        'price',
        { requestId }
      );
      if (!priceValidation.isValid) {
        errors.push(...priceValidation.errors);
      }
    }

    if (req.body.orderType) {
      const orderTypeValidation = validateOrderInput(req.body.orderType, { requestId });
      if (!orderTypeValidation.isValid) {
        errors.push(...orderTypeValidation.errors);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Trading validation failed',
        details: errors,
        requestId
      });
    }

    next();
    return;

  } catch (error) {
    logger.error('Trading validation middleware error', {
      requestId,
      error: (error as Error).message
    });

    return res.status(500).json({
      error: 'Trading validation error',
      requestId
    });
  }
};

// User registration validation middleware
export const userRegistrationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).context?.requestId || 'unknown';
  const errors: string[] = [];

  try {
    // Validate email
    if (req.body.email) {
      const emailValidation = validateUserInput(req.body.email, { requestId });
      if (!emailValidation.isValid) {
        errors.push(...emailValidation.errors);
      }
    }

    // Validate password
    if (req.body.password) {
      const passwordValidation = validatePassword(req.body.password, { requestId });
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors);
      }
    }

    // Validate username
    if (req.body.username) {
      const usernameValidation = securityValidator.validateInput(
        req.body.username,
        'username',
        { requestId }
      );
      if (!usernameValidation.isValid) {
        errors.push(...usernameValidation.errors);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'User registration validation failed',
        details: errors,
        requestId
      });
    }

    next();
    return;

  } catch (error) {
    logger.error('User registration middleware error', {
      requestId,
      error: (error as Error).message
    });

    return res.status(500).json({
      error: 'User registration validation error',
      requestId
    });
  }
};

// Security monitoring middleware
export const securityMonitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).context?.requestId || 'unknown';

  // Monitor for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /union\s+select/i,
    /drop\s+table/i,
    /exec\s*\(/i
  ];

  const requestString = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
    headers: req.headers
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      logger.warn('Suspicious request pattern detected', {
        requestId,
        pattern: pattern.source,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Suspicious request pattern detected',
        requestId
      });
    }
  }

  next();
  return;
};

// Utility functions
function setSecurityHeaders(res: Response): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
}

function validateCORS(req: Request, allowedOrigins: string[]): ValidationResult {
  const origin = req.headers.origin;

  if (!origin) {
    return {
      isValid: true,
      errors: [],
      warnings: [],
      securityLevel: SecurityLevel.LOW,
      timestamp: new Date(),
      context: { type: 'cors' }
    };
  }

  if (!allowedOrigins.includes(origin)) {
    return {
      isValid: false,
      errors: ['Origin not allowed'],
      warnings: [],
      securityLevel: SecurityLevel.HIGH,
      timestamp: new Date(),
      context: { type: 'cors', origin }
    };
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
    securityLevel: SecurityLevel.LOW,
    timestamp: new Date(),
    context: { type: 'cors', origin }
  };
}

function validateRequestSize(req: Request, maxSize: number): ValidationResult {
  const contentLength = parseInt(req.headers['content-length'] || '0');

  if (contentLength > maxSize) {
    return {
      isValid: false,
      errors: [`Request size exceeds maximum allowed size of ${maxSize} bytes`],
      warnings: [],
      securityLevel: SecurityLevel.MEDIUM,
      timestamp: new Date(),
      context: { type: 'size', contentLength, maxSize }
    };
  }

  return {
    isValid: true,
    errors: [],
    warnings: [],
    securityLevel: SecurityLevel.LOW,
    timestamp: new Date(),
    context: { type: 'size', contentLength }
  };
}

function validateRequestInput(req: Request): ValidationResult {
  const errors: string[] = [];
  const requestId = (req as any).context?.requestId || 'unknown';

  // Basic input sanitization check
  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Check for common injection patterns
  const injectionPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /union\s+select/i,
    /drop\s+table/i,
    /exec\s*\(/i
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(requestData)) {
      errors.push(`Potential injection pattern detected: ${pattern.source}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
    securityLevel: errors.length > 0 ? SecurityLevel.HIGH : SecurityLevel.LOW,
    timestamp: new Date(),
    context: { type: 'input', requestId }
  };
}

function getClientIdentifier(req: Request): string {
  return req.ip || req.connection.remoteAddress || 'unknown';
}

// Export all middleware
export const securityMiddlewareExports = {
  securityMiddleware,
  inputValidationMiddleware,
  authenticationMiddleware,
  rateLimitMiddleware,
  securityHeadersMiddleware,
  auditLogMiddleware,
  tradingValidationMiddleware,
  userRegistrationMiddleware,
  securityMonitoringMiddleware
}; 