import { logger } from '../logger/logger';
import { EventEmitter2 } from 'eventemitter2';

// Error categories for better handling
export enum ErrorCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  NETWORK = 'NETWORK',
  DATABASE = 'DATABASE',
  VALIDATION = 'VALIDATION',
  BUSINESS_LOGIC = 'BUSINESS_LOGIC',
  EXTERNAL_API = 'EXTERNAL_API',
  SYSTEM = 'SYSTEM',
  TRADING = 'TRADING',
  MARKET_DATA = 'MARKET_DATA',
  STRATEGY = 'STRATEGY',
  ORDER = 'ORDER',
  POSITION = 'POSITION',
  RISK = 'RISK',
  CONFIGURATION = 'CONFIGURATION',
  UNKNOWN = 'UNKNOWN'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Custom error types
export class TradingError extends Error {
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly context: Record<string, any>;
  public readonly timestamp: Date;
  public readonly originalError?: Error | undefined;

  constructor(
    message: string,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    code: string = 'UNKNOWN_ERROR',
    retryable: boolean = false,
    context: Record<string, any> = {},
    originalError?: Error
  ) {
    super(message);
    this.name = 'TradingError';
    this.category = category;
    this.severity = severity;
    this.code = code;
    this.retryable = retryable;
    this.context = context;
    this.timestamp = new Date();
    this.originalError = originalError;

    // Ensure proper stack trace
    if (originalError?.stack) {
      this.stack = `${this.stack}\nCaused by: ${originalError.stack}`;
    }
  }
}

// Specific error types
export class AuthenticationError extends TradingError {
  constructor(message: string, context: Record<string, any> = {}, originalError?: Error) {
    super(message, ErrorCategory.AUTHENTICATION, ErrorSeverity.HIGH, 'AUTH_ERROR', true, context, originalError);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends TradingError {
  constructor(message: string, context: Record<string, any> = {}, originalError?: Error) {
    super(message, ErrorCategory.API_RATE_LIMIT, ErrorSeverity.MEDIUM, 'RATE_LIMIT_ERROR', true, context, originalError);
    this.name = 'RateLimitError';
  }
}

export class NetworkError extends TradingError {
  constructor(message: string, context: Record<string, any> = {}, originalError?: Error) {
    super(message, ErrorCategory.NETWORK, ErrorSeverity.MEDIUM, 'NETWORK_ERROR', true, context, originalError);
    this.name = 'NetworkError';
  }
}

export class DatabaseError extends TradingError {
  constructor(message: string, context: Record<string, any> = {}, originalError?: Error) {
    super(message, ErrorCategory.DATABASE, ErrorSeverity.HIGH, 'DATABASE_ERROR', true, context, originalError);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends TradingError {
  constructor(message: string, context: Record<string, any> = {}, originalError?: Error) {
    super(message, ErrorCategory.VALIDATION, ErrorSeverity.LOW, 'VALIDATION_ERROR', false, context, originalError);
    this.name = 'ValidationError';
  }
}

export class TradingOperationError extends TradingError {
  constructor(message: string, context: Record<string, any> = {}, originalError?: Error) {
    super(message, ErrorCategory.TRADING, ErrorSeverity.HIGH, 'TRADING_ERROR', false, context, originalError);
    this.name = 'TradingOperationError';
  }
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

// Default retry configurations
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'NETWORK_ERROR',
    'RATE_LIMIT_ERROR',
    'AUTH_ERROR',
    'DATABASE_ERROR',
    'EXTERNAL_API_ERROR'
  ]
};

// Error context interface
export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  operation?: string;
  endpoint?: string;
  requestId?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

// Centralized Error Handler
export class ErrorHandler extends EventEmitter2 {
  private static instance: ErrorHandler;
  private errorCounts: Map<string, number> = new Map();
  private retryConfig: RetryConfig;

  private constructor(retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
    super();
    this.retryConfig = retryConfig;
  }

  public static getInstance(retryConfig?: RetryConfig): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(retryConfig);
    }
    return ErrorHandler.instance;
  }

  /**
   * Execute operation with retry logic
   */
  public async withRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext = {},
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();
<<<<<<< HEAD

=======
        
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
        // Log successful retry if it wasn't the first attempt
        if (attempt > 1) {
          logger.info('Operation succeeded after retry', {
            attempt,
            operation: context.operation,
            requestId: context.requestId
          });
        }
<<<<<<< HEAD

        return result;
      } catch (error) {
        lastError = this.normalizeError(error as Error, context);

=======
        
        return result;
      } catch (error) {
                 lastError = this.normalizeError(error as Error, context);
        
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
        // Check if error is retryable
        if (!this.isRetryableError(lastError, config)) {
          throw lastError;
        }

        // Log retry attempt
        logger.warn('Operation failed, retrying', {
          attempt,
          maxRetries: config.maxRetries,
          error: lastError.message,
          operation: context.operation,
          requestId: context.requestId
        });

        // If this is the last attempt, throw the error
        if (attempt === config.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        );

        await this.sleep(delay);
      }
    }

    // All retries exhausted
    logger.error('Operation failed after all retries', {
      maxRetries: config.maxRetries,
      error: lastError!.message,
      operation: context.operation,
      requestId: context.requestId
    });

    throw lastError!;
  }

  /**
   * Handle error with proper categorization and logging
   */
  public handleError(error: Error, context: ErrorContext = {}): void {
    const normalizedError = this.normalizeError(error, context);
<<<<<<< HEAD

    // Update error counts
    this.updateErrorCount(normalizedError);

    // Log error based on severity
    this.logError(normalizedError);

    // Emit error event for external handlers
    this.emit('error', normalizedError);

    // Handle critical errors
    if (normalizedError.severity === ErrorSeverity.CRITICAL) {
      this.emit('criticalError', normalizedError); // Ensure both events are emitted
=======
    
    // Update error counts
    this.updateErrorCount(normalizedError);
    
    // Log error based on severity
    this.logError(normalizedError);
    
    // Emit error event for external handlers
    this.emit('error', normalizedError);
    
    // Handle critical errors
    if (normalizedError.severity === ErrorSeverity.CRITICAL) {
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
      this.handleCriticalError(normalizedError);
    }
  }

  /**
   * Normalize any error to TradingError
   */
  public normalizeError(error: Error, context: ErrorContext = {}): TradingError {
    if (error instanceof TradingError) {
      return error;
    }

    // Categorize error based on error type and message
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error, category);
    const code = this.generateErrorCode(error, category);
    const retryable = this.isRetryableError(error);

    return new TradingError(
      error.message,
      category,
      severity,
      code,
      retryable,
      { ...context, originalError: error },
      error
    );
  }

  /**
   * Categorize error based on type and message
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

<<<<<<< HEAD
    // Database errors (check first to avoid conflicts with network errors)
    if (name.includes('database') || name.includes('prisma') || name.includes('sql') ||
      message.includes('database') || message.includes('sql') || message.includes('db') ||
      message.includes('connection failed') || message.includes('query failed') || message.includes('deadlock')) {
      return ErrorCategory.DATABASE;
    }

    // Authentication errors
    if (name.includes('auth') || message.includes('unauthorized') || message.includes('token') ||
      message.includes('auth') || message.includes('login') || message.includes('credential') ||
      message.includes('forbidden')) {
=======
    // Network errors
    if (name.includes('network') || name.includes('timeout') || name.includes('connection')) {
      return ErrorCategory.NETWORK;
    }

    // Authentication errors
    if (name.includes('auth') || message.includes('unauthorized') || message.includes('token')) {
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
      return ErrorCategory.AUTHENTICATION;
    }

    // Rate limit errors
<<<<<<< HEAD
    if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
      return ErrorCategory.API_RATE_LIMIT;
    }

    // Network errors (check after database to avoid conflicts)
    if (name.includes('network') || name.includes('timeout') ||
      message.includes('network') || message.includes('timeout') || message.includes('timed out') ||
      message.includes('unreachable') || message.includes('refused')) {
      return ErrorCategory.NETWORK;
    }

    // Trading errors (check before validation to avoid conflicts)
    if (message.includes('order') || message.includes('position') || message.includes('trade') ||
      message.includes('execution') || message.includes('fill')) {
      return ErrorCategory.TRADING;
    }

    // Validation errors
    if (name.includes('validation') || name.includes('invalid') ||
      message.includes('validation') || message.includes('invalid') || message.includes('not allowed') ||
      message.includes('required')) {
      return ErrorCategory.VALIDATION;
    }

    // Market data errors
    if (message.includes('market') || message.includes('quote') || message.includes('price') ||
      message.includes('ticker')) {
      return ErrorCategory.MARKET_DATA;
    }

    // System errors
    if (name.includes('system') || message.includes('system') || message.includes('internal')) {
      return ErrorCategory.SYSTEM;
    }

    // Configuration errors
    if (name.includes('config') || message.includes('config') || message.includes('configuration')) {
      return ErrorCategory.CONFIGURATION;
    }

=======
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return ErrorCategory.API_RATE_LIMIT;
    }

    // Database errors
    if (name.includes('prisma') || name.includes('database') || name.includes('sql')) {
      return ErrorCategory.DATABASE;
    }

    // Validation errors
    if (name.includes('validation') || name.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }

    // Trading errors
    if (message.includes('order') || message.includes('position') || message.includes('trade')) {
      return ErrorCategory.TRADING;
    }

    // Market data errors
    if (message.includes('market') || message.includes('quote') || message.includes('price')) {
      return ErrorCategory.MARKET_DATA;
    }

>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    const message = error.message.toLowerCase();

    // Critical errors
    if (message.includes('fatal') || message.includes('critical')) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity errors
<<<<<<< HEAD
    if (category === ErrorCategory.AUTHENTICATION ||
      category === ErrorCategory.TRADING ||
      category === ErrorCategory.DATABASE) {
=======
    if (category === ErrorCategory.AUTHENTICATION || 
        category === ErrorCategory.TRADING ||
        category === ErrorCategory.DATABASE) {
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
      return ErrorSeverity.HIGH;
    }

    // Medium severity errors
<<<<<<< HEAD
    if (category === ErrorCategory.NETWORK ||
      category === ErrorCategory.API_RATE_LIMIT ||
      category === ErrorCategory.EXTERNAL_API) {
=======
    if (category === ErrorCategory.NETWORK || 
        category === ErrorCategory.API_RATE_LIMIT ||
        category === ErrorCategory.EXTERNAL_API) {
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
      return ErrorSeverity.MEDIUM;
    }

    // Low severity errors
    if (category === ErrorCategory.VALIDATION) {
      return ErrorSeverity.LOW;
    }

    return ErrorSeverity.MEDIUM;
  }

  /**
   * Generate error code
   */
  private generateErrorCode(error: Error, category: ErrorCategory): string {
    const baseCode = category.replace('_', '').toUpperCase();
    const timestamp = Date.now().toString().slice(-6);
    return `${baseCode}_${timestamp}`;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error, config: RetryConfig = this.retryConfig): boolean {
    if (error instanceof TradingError) {
      return error.retryable;
    }

    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network errors are retryable
<<<<<<< HEAD
    if (name.includes('network') || name.includes('timeout') || name.includes('connection') || message.includes('network') || message.includes('timeout') || message.includes('connection') || message.includes('timed out') || message.includes('unreachable') || message.includes('refused')) {
=======
    if (name.includes('network') || name.includes('timeout') || name.includes('connection')) {
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
      return true;
    }

    // Rate limit errors are retryable
<<<<<<< HEAD
    if (message.includes('rate limit') || message.includes('too many requests') || message.includes('429')) {
=======
    if (message.includes('rate limit') || message.includes('too many requests')) {
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
      return true;
    }

    // Authentication errors might be retryable (token refresh)
<<<<<<< HEAD
    if ((name.includes('auth') || message.includes('auth')) && (message.includes('expired') || message.includes('token'))) {
=======
    if (name.includes('auth') && message.includes('expired')) {
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
      return true;
    }

    // Database connection errors are retryable
<<<<<<< HEAD
    if ((name.includes('prisma') || name.includes('database') || message.includes('database') || message.includes('db')) && (message.includes('connection') || message.includes('query failed') || message.includes('deadlock'))) {
      return true;
    }

    // External API errors are retryable
    if (message.includes('external') || message.includes('api') || message.includes('service unavailable')) {
      return true;
    }

    // System errors that might be transient
    if (message.includes('temporary') || message.includes('transient') || message.includes('retry')) {
=======
    if (name.includes('prisma') && message.includes('connection')) {
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
      return true;
    }

    return false;
  }

  /**
   * Update error count tracking
   */
  private updateErrorCount(error: TradingError): void {
    const key = `${error.category}_${error.code}`;
    const currentCount = this.errorCounts.get(key) || 0;
    this.errorCounts.set(key, currentCount + 1);
  }

  /**
   * Log error based on severity
   */
  private logError(error: TradingError): void {
    const logData = {
      category: error.category,
      severity: error.severity,
      code: error.code,
      retryable: error.retryable,
      context: error.context,
      timestamp: error.timestamp,
      stack: error.stack
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        logger.fatal('Critical error occurred', logData);
        break;
      case ErrorSeverity.HIGH:
        logger.error('High severity error', logData);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('Medium severity error', logData);
        break;
      case ErrorSeverity.LOW:
        logger.info('Low severity error', logData);
        break;
    }
  }

  /**
   * Handle critical errors
   */
  private handleCriticalError(error: TradingError): void {
    // Emit critical error event
    this.emit('criticalError', error);
<<<<<<< HEAD

=======
    
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
    // Log to system alerts
    logger.fatal('CRITICAL ERROR - System intervention may be required', {
      error: error.message,
      category: error.category,
      context: error.context
    });

    // In a production system, you might want to:
    // - Send alerts to monitoring systems
    // - Trigger emergency procedures
    // - Stop trading operations
    // - Notify administrators
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): Record<string, any> {
    const stats: Record<string, any> = {};
<<<<<<< HEAD

    for (const [key, count] of this.errorCounts.entries()) {
      const [category, code] = key.split('_');
      if (category && code) {
        if (!stats[category]) {
          stats[category] = {};
        }
        stats[category][code] = count;
      }
    }

=======
    
         for (const [key, count] of this.errorCounts.entries()) {
       const [category, code] = key.split('_');
       if (category && code) {
         if (!stats[category]) {
           stats[category] = {};
         }
         stats[category][code] = count;
       }
     }
    
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
    return stats;
  }

  /**
   * Clear error statistics
   */
  public clearErrorStats(): void {
    this.errorCounts.clear();
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create error with context
   */
  public createError(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: Record<string, any> = {}
  ): TradingError {
    return new TradingError(message, category, severity, undefined, false, context);
  }

  /**
   * Wrap async function with error handling
   */
  public wrapAsync<T>(
    fn: (...args: any[]) => Promise<T>,
    context: ErrorContext = {}
  ): (...args: any[]) => Promise<T> {
    return async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error as Error, context);
        throw this.normalizeError(error as Error, context);
      }
    };
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility functions for common error patterns
export const createAuthenticationError = (message: string, context: Record<string, any> = {}) =>
  new AuthenticationError(message, context);

export const createRateLimitError = (message: string, context: Record<string, any> = {}) =>
  new RateLimitError(message, context);

export const createNetworkError = (message: string, context: Record<string, any> = {}) =>
  new NetworkError(message, context);

export const createDatabaseError = (message: string, context: Record<string, any> = {}) =>
  new DatabaseError(message, context);

export const createValidationError = (message: string, context: Record<string, any> = {}) =>
  new ValidationError(message, context);

export const createTradingError = (message: string, context: Record<string, any> = {}) =>
  new TradingOperationError(message, context); 