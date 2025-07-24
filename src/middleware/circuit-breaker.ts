import { Request, Response, NextFunction } from 'express';
import {
  circuitBreakerManager,
  CircuitBreaker,
  CircuitState,
  createApiCircuitBreaker,
  createDatabaseCircuitBreaker,
  createExternalServiceCircuitBreaker
} from '../utils/circuit-breaker';
import { logger } from '../logger/logger';

// Circuit breaker middleware configuration
export interface CircuitBreakerMiddlewareConfig {
  circuitName: string;
  operation: (req: Request, res: Response, next: NextFunction) => Promise<any>;
  fallback?: (req: Request, res: Response, error: Error) => any;
  timeout?: number;
  failureThreshold?: number;
  recoveryTimeout?: number;
}

// Circuit breaker middleware
export const circuitBreakerMiddleware = (config: CircuitBreakerMiddlewareConfig) => {
  const circuit = circuitBreakerManager.getCircuit(config.circuitName, {
    timeout: config.timeout || 10000,
    failureThreshold: config.failureThreshold || 5,
    recoveryTimeout: config.recoveryTimeout || 60000
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await circuit.execute(
        () => config.operation(req, res, next),
        {
          method: req.method,
          url: req.url,
          userId: (req as any).user?.id,
          requestId: (req as any).context?.requestId
        }
      );

      // If operation returns a response, send it
      if (result && typeof result === 'object' && !res.headersSent) {
        res.json(result);
      }

    } catch (error) {
      logger.warn(`Circuit breaker failure in ${config.circuitName}`, {
        error: (error as Error).message,
        url: req.url,
        method: req.method,
        circuitState: circuit.getState()
      });

      // Use fallback if provided
      if (config.fallback) {
        try {
          const fallbackResult = config.fallback(req, res, error as Error);
          if (fallbackResult && !res.headersSent) {
            res.json(fallbackResult);
          }
        } catch (fallbackError) {
          logger.error(`Fallback also failed for ${config.circuitName}`, {
            originalError: (error as Error).message,
            fallbackError: (fallbackError as Error).message
          });
          next(error);
        }
      } else {
        // Send circuit breaker error response
        const circuitState = circuit.getState();
        const healthStatus = circuit.getHealthStatus();

        res.status(503).json({
          error: {
            message: `Service temporarily unavailable: ${config.circuitName}`,
            circuitState,
            lastFailure: healthStatus.lastFailure,
            nextAttempt: healthStatus.nextAttempt,
            failureRate: healthStatus.failureRate
          },
          requestId: (req as any).context?.requestId
        });
      }
    }
  };
};

// Health check middleware for circuit breakers
export const circuitBreakerHealthMiddleware = (req: Request, res: Response) => {
  const healthStatus = circuitBreakerManager.getHealthStatus();
  const statistics = circuitBreakerManager.getStatistics();

  const response = {
    timestamp: new Date().toISOString(),
    overallHealth: Object.values(healthStatus).every(status => status.healthy),
    circuits: healthStatus,
    statistics: {
      totalCircuits: Object.keys(healthStatus).length,
      healthyCircuits: Object.values(healthStatus).filter(status => status.healthy).length,
      openCircuits: Object.values(healthStatus).filter(status => status.state === CircuitState.OPEN).length,
      halfOpenCircuits: Object.values(healthStatus).filter(status => status.state === CircuitState.HALF_OPEN).length
    },
    details: statistics
  };

  // Set appropriate status code
  const statusCode = response.overallHealth ? 200 : 503;
  res.status(statusCode).json(response);
};

// Circuit breaker statistics middleware
export const circuitBreakerStatsMiddleware = (req: Request, res: Response) => {
  const statistics = circuitBreakerManager.getStatistics();
  const healthStatus = circuitBreakerManager.getHealthStatus();

  const response = {
    timestamp: new Date().toISOString(),
    summary: {
      totalCircuits: Object.keys(statistics).length,
      totalRequests: Object.values(statistics).reduce((sum, stats) => sum + stats.totalRequests, 0),
      successfulRequests: Object.values(statistics).reduce((sum, stats) => sum + stats.successfulRequests, 0),
      failedRequests: Object.values(statistics).reduce((sum, stats) => sum + stats.failedRequests, 0),
      timeoutRequests: Object.values(statistics).reduce((sum, stats) => sum + stats.timeoutRequests, 0),
      overallFailureRate: 0
    },
    circuits: Object.keys(statistics).map(name => ({
      name,
      metrics: statistics[name],
      health: healthStatus[name]
    }))
  };

  // Calculate overall failure rate
  if (response.summary.totalRequests > 0) {
    response.summary.overallFailureRate = response.summary.failedRequests / response.summary.totalRequests;
  }

  res.json(response);
};

// Circuit breaker control middleware
export const circuitBreakerControlMiddleware = (req: Request, res: Response) => {
  const { action, circuitName, reason } = req.body;

  if (!action || !circuitName) {
    return res.status(400).json({
      error: 'Missing required fields: action, circuitName'
    });
  }

  const circuit = circuitBreakerManager.getCircuitByName(circuitName);
  if (!circuit) {
    return res.status(404).json({
      error: `Circuit breaker not found: ${circuitName}`
    });
  }

  try {
    switch (action.toLowerCase()) {
      case 'open':
        circuit.forceOpen(reason || 'Manually opened');
        break;
      case 'close':
        circuit.forceClose(reason || 'Manually closed');
        break;
      case 'reset':
        circuit.reset();
        break;
      default:
        return res.status(400).json({
          error: `Invalid action: ${action}. Valid actions: open, close, reset`
        });
    }

    res.json({
      message: `Circuit breaker ${circuitName} ${action} successful`,
      circuitState: circuit.getState(),
      healthStatus: circuit.getHealthStatus()
    });

  } catch (error) {
    logger.error(`Failed to control circuit breaker ${circuitName}`, {
      action,
      error: (error as Error).message
    });

    res.status(500).json({
      error: `Failed to ${action} circuit breaker: ${(error as Error).message}`
    });
    return;
  }
  // Add a return to ensure all code paths return a value
  return;
};

// Circuit breaker monitoring middleware
export const circuitBreakerMonitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Listen for circuit breaker events
  circuitBreakerManager.on('circuitOpen', (circuitName, metrics) => {
    logger.warn(`Circuit breaker opened: ${circuitName}`, {
      circuitName,
      metrics,
      timestamp: new Date().toISOString()
    });
  });

  circuitBreakerManager.on('circuitClose', (circuitName, metrics) => {
    logger.info(`Circuit breaker closed: ${circuitName}`, {
      circuitName,
      metrics,
      timestamp: new Date().toISOString()
    });
  });

  circuitBreakerManager.on('circuitStateChange', (circuitName, from, to, reason) => {
    logger.info(`Circuit breaker state change: ${circuitName}`, {
      circuitName,
      from,
      to,
      reason,
      timestamp: new Date().toISOString()
    });
  });

  next();
};

// Predefined circuit breaker configurations
export const circuitBreakerConfigs = {
  // API circuit breakers
  zerodhaApi: {
    failureThreshold: 3,
    recoveryTimeout: 30000,
    timeout: 5000,
    name: 'zerodha_api'
  },

  marketDataApi: {
    failureThreshold: 5,
    recoveryTimeout: 45000,
    timeout: 8000,
    name: 'market_data_api'
  },

  // Database circuit breakers
  postgresDb: {
    failureThreshold: 5,
    recoveryTimeout: 60000,
    timeout: 10000,
    name: 'postgres_db'
  },

  redisCache: {
    failureThreshold: 3,
    recoveryTimeout: 30000,
    timeout: 2000,
    name: 'redis_cache'
  },

  // External service circuit breakers
  notificationService: {
    failureThreshold: 2,
    recoveryTimeout: 60000,
    timeout: 5000,
    name: 'notification_service'
  },

  analyticsService: {
    failureThreshold: 3,
    recoveryTimeout: 45000,
    timeout: 10000,
    name: 'analytics_service'
  }
};

// Utility functions for common circuit breaker patterns
export const createZerodhaApiCircuitBreaker = () => {
  return createApiCircuitBreaker('zerodha', circuitBreakerConfigs.zerodhaApi);
};

export const createMarketDataApiCircuitBreaker = () => {
  return createApiCircuitBreaker('market_data', circuitBreakerConfigs.marketDataApi);
};

export const createPostgresCircuitBreaker = () => {
  return createDatabaseCircuitBreaker('postgres', circuitBreakerConfigs.postgresDb);
};

export const createRedisCircuitBreaker = () => {
  return createDatabaseCircuitBreaker('redis', circuitBreakerConfigs.redisCache);
};

export const createNotificationServiceCircuitBreaker = () => {
  return createExternalServiceCircuitBreaker('notification', circuitBreakerConfigs.notificationService);
};

export const createAnalyticsServiceCircuitBreaker = () => {
  return createExternalServiceCircuitBreaker('analytics', circuitBreakerConfigs.analyticsService);
};

// Export all middleware
export const circuitBreakerMiddlewareExports = {
  circuitBreakerMiddleware,
  circuitBreakerHealthMiddleware,
  circuitBreakerStatsMiddleware,
  circuitBreakerControlMiddleware,
  circuitBreakerMonitoringMiddleware,
  createZerodhaApiCircuitBreaker,
  createMarketDataApiCircuitBreaker,
  createPostgresCircuitBreaker,
  createRedisCircuitBreaker,
  createNotificationServiceCircuitBreaker,
  createAnalyticsServiceCircuitBreaker
};

export { circuitBreakerManager }; 