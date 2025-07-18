import { Request, Response, NextFunction } from 'express';
import { errorHandler, ErrorContext, TradingError, ErrorSeverity } from '../utils/error-handler';
import { logger } from '../logger/logger';

// Request context interface
interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  operation?: string;
  endpoint?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Generate unique request ID
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Extract user context from request
const extractRequestContext = (req: Request): RequestContext => {
  return {
    requestId: generateRequestId(),
    userId: (req as any).user?.id,
    sessionId: (req as any).session?.id,
    operation: `${req.method} ${req.path}`,
    endpoint: req.path,
    timestamp: new Date(),
    metadata: {
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      query: req.query,
      params: req.params
    }
  };
};

// Error response interface
interface ErrorResponse {
  error: {
    message: string;
    code: string;
    category: string;
    severity: string;
    requestId: string;
    timestamp: string;
    retryable: boolean;
  };
  details?: Record<string, any>;
}

// Create error response
const createErrorResponse = (error: TradingError, requestId: string): ErrorResponse => {
  const response: ErrorResponse = {
    error: {
      message: error.message,
      code: error.code,
      category: error.category,
      severity: error.severity,
      requestId,
      timestamp: error.timestamp.toISOString(),
      retryable: error.retryable
    }
  };

  // Only include details in development
  if (process.env.NODE_ENV === 'development') {
    response.details = {
      stack: error.stack,
      context: error.context,
      originalError: error.originalError?.message
    };
  }

  return response;
};

// Determine HTTP status code based on error
const getHttpStatus = (error: TradingError): number => {
  switch (error.category) {
    case 'AUTHENTICATION':
      return 401;
    case 'VALIDATION':
      return 400;
    case 'API_RATE_LIMIT':
      return 429;
    case 'DATABASE':
      return 503;
    case 'NETWORK':
      return 503;
    case 'TRADING':
      return 422;
    case 'BUSINESS_LOGIC':
      return 400;
    default:
      return 500;
  }
};

// Express error handling middleware
export const expressErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const context = extractRequestContext(req);
  const tradingError = errorHandler.normalizeError(error, context);
  
  // Handle the error through centralized handler
  errorHandler.handleError(tradingError, context);
  
  // Create error response
  const errorResponse = createErrorResponse(tradingError, context.requestId);
  const statusCode = getHttpStatus(tradingError);
  
  // Log error details
  logger.error('Express error handler', {
    error: tradingError.message,
    category: tradingError.category,
    severity: tradingError.severity,
    statusCode,
    requestId: context.requestId,
    endpoint: context.endpoint,
    userId: context.userId
  });
  
  // Send error response
  res.status(statusCode).json(errorResponse);
};

// Async error wrapper middleware
export const asyncErrorHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const context = extractRequestContext(req);
    
    Promise.resolve(fn(req, res, next)).catch((error: Error) => {
      const tradingError = errorHandler.normalizeError(error, context);
      errorHandler.handleError(tradingError, context);
      next(tradingError);
    });
  };
};

// Request context middleware
export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const context = extractRequestContext(req);
  
  // Add context to request object
  (req as any).context = context;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', context.requestId);
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    requestId: context.requestId,
    userId: context.userId,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
  
  next();
};

// Error monitoring middleware
export const errorMonitoringMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      requestId: (req as any).context?.requestId
    });
    
    // Check for slow requests
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.url,
        duration,
        requestId: (req as any).context?.requestId
      });
    }
    
    return originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
};

// Health check endpoint
export const healthCheckHandler = (req: Request, res: Response): void => {
  const errorStats = errorHandler.getErrorStats();
  const totalErrors = Object.values(errorStats).reduce((sum: number, category: any) => {
    return sum + Object.values(category).reduce((catSum: number, count: any) => catSum + count, 0);
  }, 0);
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    errorStats: {
      total: totalErrors,
      byCategory: errorStats
    }
  };
  
  res.json(health);
};

// Error statistics endpoint
export const errorStatsHandler = (req: Request, res: Response): void => {
  const stats = errorHandler.getErrorStats();
  
  res.json({
    timestamp: new Date().toISOString(),
    stats,
    summary: {
      totalErrors: Object.values(stats).reduce((sum: number, category: any) => {
        return sum + Object.values(category).reduce((catSum: number, count: any) => catSum + count, 0);
      }, 0),
      categories: Object.keys(stats).length
    }
  });
};

// Clear error statistics endpoint
export const clearErrorStatsHandler = (req: Request, res: Response): void => {
  errorHandler.clearErrorStats();
  
  res.json({
    message: 'Error statistics cleared',
    timestamp: new Date().toISOString()
  });
};

// Export all middleware
export const errorMiddleware = {
  expressErrorHandler,
  asyncErrorHandler,
  requestContextMiddleware,
  errorMonitoringMiddleware,
  healthCheckHandler,
  errorStatsHandler,
  clearErrorStatsHandler
}; 