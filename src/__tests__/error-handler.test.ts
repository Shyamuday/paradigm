import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  errorHandler, 
  ErrorHandler, 
  TradingError, 
  ErrorCategory, 
  ErrorSeverity,
  createAuthenticationError,
  createNetworkError,
  createValidationError,
  DEFAULT_RETRY_CONFIG
} from '../utils/error-handler';

describe('Error Handler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    // Create a fresh instance for each test
    handler = ErrorHandler.getInstance();
    handler.clearErrorStats();
  });

  afterEach(() => {
    handler.clearErrorStats();
  });

  describe('Error Creation', () => {
    it('should create TradingError with correct properties', () => {
      const error = new TradingError(
        'Test error',
        ErrorCategory.NETWORK,
        ErrorSeverity.MEDIUM,
        'TEST_ERROR',
        true,
        { test: 'data' }
      );

      expect(error.message).toBe('Test error');
      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(error.severity).toBe(ErrorSeverity.MEDIUM);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.retryable).toBe(true);
      expect(error.context.test).toBe('data');
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should create specific error types correctly', () => {
      const authError = createAuthenticationError('Auth failed', { userId: '123' });
      const networkError = createNetworkError('Connection failed', { endpoint: '/api' });
      const validationError = createValidationError('Invalid input', { field: 'email' });

      expect(authError.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(authError.severity).toBe(ErrorSeverity.HIGH);
      expect(authError.retryable).toBe(true);

      expect(networkError.category).toBe(ErrorCategory.NETWORK);
      expect(networkError.severity).toBe(ErrorSeverity.MEDIUM);
      expect(networkError.retryable).toBe(true);

      expect(validationError.category).toBe(ErrorCategory.VALIDATION);
      expect(validationError.severity).toBe(ErrorSeverity.LOW);
      expect(validationError.retryable).toBe(false);
    });
  });

  describe('Error Normalization', () => {
    it('should normalize regular errors to TradingError', () => {
      const regularError = new Error('Network timeout');
      const normalized = handler.normalizeError(regularError, { operation: 'test' });

      expect(normalized).toBeInstanceOf(TradingError);
      expect(normalized.category).toBe(ErrorCategory.NETWORK);
      expect(normalized.retryable).toBe(true);
      expect(normalized.context.operation).toBe('test');
    });

    it('should preserve TradingError instances', () => {
      const tradingError = new TradingError('Test', ErrorCategory.TRADING);
      const normalized = handler.normalizeError(tradingError);

      expect(normalized).toBe(tradingError);
    });

    it('should categorize errors correctly', () => {
      const errors = [
        { error: new Error('Authentication token expired'), expected: ErrorCategory.AUTHENTICATION },
        { error: new Error('Rate limit exceeded'), expected: ErrorCategory.API_RATE_LIMIT },
        { error: new Error('Database connection failed'), expected: ErrorCategory.DATABASE },
        { error: new Error('Invalid order parameters'), expected: ErrorCategory.TRADING },
        { error: new Error('Network timeout'), expected: ErrorCategory.NETWORK },
        { error: new Error('Unknown error'), expected: ErrorCategory.UNKNOWN }
      ];

      errors.forEach(({ error, expected }) => {
        const normalized = handler.normalizeError(error);
        expect(normalized.category).toBe(expected);
      });
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed operations', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Network timeout');
        }
        return 'success';
      };

      const result = await handler.withRetry(operation, { operation: 'test' });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should not retry non-retryable errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Invalid input');
      };

      await expect(handler.withRetry(operation, { operation: 'test' })).rejects.toThrow('Invalid input');
      expect(attempts).toBe(1);
    });

    it('should respect max retries', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        throw new Error('Network timeout');
      };

      await expect(handler.withRetry(operation, { operation: 'test' })).rejects.toThrow('Network timeout');
      expect(attempts).toBe(DEFAULT_RETRY_CONFIG.maxRetries);
    });

    it('should use exponential backoff', async () => {
      const startTime = Date.now();
      let attempts = 0;
      
      const operation = async () => {
        attempts++;
        throw new Error('Network timeout');
      };

      try {
        await handler.withRetry(operation, { operation: 'test' });
      } catch (error) {
        // Expected to fail
      }

      const duration = Date.now() - startTime;
      expect(attempts).toBe(DEFAULT_RETRY_CONFIG.maxRetries);
      expect(duration).toBeGreaterThan(1000); // Should have some delay
    });
  });

  describe('Error Statistics', () => {
    it('should track error statistics', () => {
      const errors = [
        new Error('Auth error'),
        new Error('Network error'),
        new Error('Database error'),
        new Error('Auth error'), // Duplicate
      ];

      errors.forEach(error => {
        handler.handleError(error, { operation: 'test' });
      });

      const stats = handler.getErrorStats();
      expect(stats.AUTHENTICATION).toBeDefined();
      expect(stats.NETWORK).toBeDefined();
      expect(stats.DATABASE).toBeDefined();
    });

    it('should clear error statistics', () => {
      handler.handleError(new Error('Test error'), { operation: 'test' });
      
      let stats = handler.getErrorStats();
      expect(Object.keys(stats).length).toBeGreaterThan(0);

      handler.clearErrorStats();
      stats = handler.getErrorStats();
      expect(Object.keys(stats).length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors with context', () => {
      const error = new Error('Test error');
      const context = { 
        userId: '123', 
        operation: 'test_operation',
        requestId: 'req_456'
      };

      handler.handleError(error, context);

      const stats = handler.getErrorStats();
      expect(Object.keys(stats).length).toBeGreaterThan(0);
    });

    it('should emit error events', (done) => {
      const error = new Error('Test error');
      
      handler.on('error', (emittedError) => {
        expect(emittedError).toBeInstanceOf(TradingError);
        expect(emittedError.message).toBe('Test error');
        done();
      });

      handler.handleError(error, { operation: 'test' });
    });

    it('should emit critical error events', (done) => {
      const error = new Error('Critical system failure');
      
      handler.on('criticalError', (emittedError) => {
        expect(emittedError).toBeInstanceOf(TradingError);
        expect(emittedError.message).toBe('Critical system failure');
        done();
      });

      handler.handleError(error, { operation: 'test' });
    });
  });

  describe('Async Function Wrapping', () => {
    it('should wrap async functions with error handling', async () => {
      const riskyFunction = async (input: number): Promise<string> => {
        if (input < 0) {
          throw new Error('Invalid input');
        }
        return `Processed: ${input}`;
      };

      const safeFunction = handler.wrapAsync(riskyFunction, { operation: 'test' });

      // Should succeed
      const result = await safeFunction(5);
      expect(result).toBe('Processed: 5');

      // Should throw error
      await expect(safeFunction(-5)).rejects.toThrow('Invalid input');
    });
  });

  describe('Singleton Pattern', () => {
    it('should maintain singleton instance', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should use custom retry config', () => {
      const customConfig = {
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 60000,
        backoffMultiplier: 3,
        retryableErrors: ['CUSTOM_ERROR']
      };

      const customHandler = ErrorHandler.getInstance(customConfig);
      expect(customHandler).toBe(ErrorHandler.getInstance()); // Should still be singleton
    });
  });
}); 