import { EventEmitter2 } from 'eventemitter2';
import { logger } from '../logger/logger';

// Circuit breaker states
export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service is back
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;     // Number of failures before opening circuit
  recoveryTimeout: number;      // Time in ms to wait before trying half-open
  expectedErrors: string[];     // Error patterns that count as failures
  successThreshold: number;     // Number of successes needed to close circuit
  timeout: number;              // Request timeout in ms
  volumeThreshold: number;      // Minimum requests before considering failure rate
  name: string;                 // Circuit breaker name for logging
}

// Default configuration
export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 60000, // 1 minute
  expectedErrors: [
    'timeout',
    'network',
    'connection',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT'
  ],
  successThreshold: 2,
  timeout: 10000, // 10 seconds
  volumeThreshold: 10,
  name: 'default'
};

// Circuit breaker metrics
export interface CircuitMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timeoutRequests: number;
  currentFailureRate: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  stateChangeHistory: Array<{
    from: CircuitState;
    to: CircuitState;
    timestamp: Date;
    reason: string;
  }>;
}

// Circuit breaker events
export interface CircuitBreakerEvents {
  'stateChange': (from: CircuitState, to: CircuitState, reason: string) => void;
  'failure': (error: Error, metrics: CircuitMetrics) => void;
  'success': (metrics: CircuitMetrics) => void;
  'timeout': (metrics: CircuitMetrics) => void;
  'open': (metrics: CircuitMetrics) => void;
  'halfOpen': (metrics: CircuitMetrics) => void;
  'close': (metrics: CircuitMetrics) => void;
}

// Circuit breaker class
export class CircuitBreaker extends EventEmitter2 {
  private state: CircuitState = CircuitState.CLOSED;
  private config: CircuitBreakerConfig;
  private metrics: CircuitMetrics;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastStateChange: Date = new Date();
  private nextAttemptTime?: Date | undefined;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config };
    this.metrics = this.initializeMetrics();
    
    logger.info(`Circuit breaker initialized: ${this.config.name}`, {
      config: this.config,
      initialState: this.state
    });
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen('Recovery timeout reached');
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.config.name}. Last failure: ${this.metrics.lastFailureTime}`);
      }
    }

    // Check if circuit is half-open
    if (this.state === CircuitState.HALF_OPEN) {
      // Allow only one request in half-open state
      if (this.successCount > 0 || this.failureCount > 0) {
        throw new Error(`Circuit breaker is HALF_OPEN for ${this.config.name}. Testing in progress.`);
      }
    }

    // Execute the operation
    return await this.executeOperation(operation, context);
  }

  /**
   * Execute the actual operation with timeout and error handling
   */
  private async executeOperation<T>(
    operation: () => Promise<T>,
    context: Record<string, any> = {}
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timeout after ${this.config.timeout}ms`));
        }, this.config.timeout);
      });

      // Execute operation with timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);

      // Operation succeeded
      this.onSuccess();
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.onFailure(error as Error, duration, context);
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;
    this.metrics.successfulRequests++;
    this.metrics.lastSuccessTime = new Date();

    logger.debug(`Circuit breaker success: ${this.config.name}`, {
      successCount: this.successCount,
      failureCount: this.failureCount,
      state: this.state
    });

    // Emit success event
    this.emit('success', this.metrics);

    // Handle state transitions
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed('Success threshold reached');
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }

    this.updateMetrics();
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error, duration: number, context: Record<string, any> = {}): void {
    this.failureCount++;
    this.metrics.failedRequests++;
    this.metrics.lastFailureTime = new Date();

    // Check if error is a timeout
    if (error.message.includes('timeout')) {
      this.metrics.timeoutRequests++;
      this.emit('timeout', this.metrics);
    }

    logger.warn(`Circuit breaker failure: ${this.config.name}`, {
      error: error.message,
      duration,
      failureCount: this.failureCount,
      successCount: this.successCount,
      state: this.state,
      context
    });

    // Emit failure event
    this.emit('failure', error, this.metrics);

    // Handle state transitions
    if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpenCircuit()) {
        this.transitionToOpen('Failure threshold exceeded');
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen('Failure during half-open test');
    }

    this.updateMetrics();
  }

  /**
   * Check if circuit should open
   */
  private shouldOpenCircuit(): boolean {
    // Need minimum volume before considering failure rate
    if (this.metrics.totalRequests < this.config.volumeThreshold) {
      return false;
    }

    // Check if failure count exceeds threshold
    if (this.failureCount >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate
    const failureRate = this.metrics.failedRequests / this.metrics.totalRequests;
    return failureRate > 0.5; // 50% failure rate threshold
  }

  /**
   * Check if circuit should attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) {
      return false;
    }
    return new Date() >= this.nextAttemptTime;
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(reason: string): void {
    if (this.state === CircuitState.OPEN) {
      return; // Already open
    }

    const previousState = this.state;
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);

    this.recordStateChange(previousState, CircuitState.OPEN, reason);
    this.emit('stateChange', previousState, CircuitState.OPEN, reason);
    this.emit('open', this.metrics);

    logger.warn(`Circuit breaker opened: ${this.config.name}`, {
      reason,
      nextAttemptTime: this.nextAttemptTime,
      metrics: this.metrics
    });
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(reason: string): void {
    if (this.state === CircuitState.HALF_OPEN) {
      return; // Already half-open
    }

    const previousState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.failureCount = 0;
    this.successCount = 0;

    this.recordStateChange(previousState, CircuitState.HALF_OPEN, reason);
    this.emit('stateChange', previousState, CircuitState.HALF_OPEN, reason);
    this.emit('halfOpen', this.metrics);

    logger.info(`Circuit breaker half-open: ${this.config.name}`, {
      reason,
      metrics: this.metrics
    });
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(reason: string): void {
    if (this.state === CircuitState.CLOSED) {
      return; // Already closed
    }

    const previousState = this.state;
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = undefined;

    this.recordStateChange(previousState, CircuitState.CLOSED, reason);
    this.emit('stateChange', previousState, CircuitState.CLOSED, reason);
    this.emit('close', this.metrics);

    logger.info(`Circuit breaker closed: ${this.config.name}`, {
      reason,
      metrics: this.metrics
    });
  }

  /**
   * Record state change in history
   */
  private recordStateChange(from: CircuitState, to: CircuitState, reason: string): void {
    this.metrics.stateChangeHistory.push({
      from,
      to,
      timestamp: new Date(),
      reason
    });

    // Keep only last 10 state changes
    if (this.metrics.stateChangeHistory.length > 10) {
      this.metrics.stateChangeHistory = this.metrics.stateChangeHistory.slice(-10);
    }

    this.lastStateChange = new Date();
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    if (this.metrics.totalRequests > 0) {
      this.metrics.currentFailureRate = this.metrics.failedRequests / this.metrics.totalRequests;
    }
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): CircuitMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      timeoutRequests: 0,
      currentFailureRate: 0,
      stateChangeHistory: []
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitMetrics {
    return { ...this.metrics };
  }

  /**
   * Get configuration
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Force circuit to open
   */
  forceOpen(reason: string = 'Manually forced'): void {
    this.transitionToOpen(reason);
  }

  /**
   * Force circuit to close
   */
  forceClose(reason: string = 'Manually forced'): void {
    this.transitionToClosed(reason);
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = undefined;
    this.metrics = this.initializeMetrics();
    this.transitionToClosed('Manual reset');
  }

  /**
   * Check if circuit is healthy
   */
  isHealthy(): boolean {
    return this.state === CircuitState.CLOSED || 
           (this.state === CircuitState.HALF_OPEN && this.successCount > 0);
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    healthy: boolean;
    state: CircuitState;
    failureRate: number;
    lastFailure?: Date | undefined;
    nextAttempt?: Date | undefined;
  } {
    return {
      healthy: this.isHealthy(),
      state: this.state,
      failureRate: this.metrics.currentFailureRate,
      lastFailure: this.metrics.lastFailureTime,
      nextAttempt: this.nextAttemptTime
    };
  }
}

// Circuit breaker manager for multiple circuits
export class CircuitBreakerManager extends EventEmitter2 {
  private circuits: Map<string, CircuitBreaker> = new Map();
  private defaultConfig: Partial<CircuitBreakerConfig>;

  constructor(defaultConfig: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.defaultConfig = defaultConfig;
  }

  /**
   * Get or create circuit breaker
   */
  getCircuit(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuits.has(name)) {
      const circuitConfig = { ...this.defaultConfig, ...config, name };
      const circuit = new CircuitBreaker(circuitConfig);
      
      // Forward events from individual circuits
      circuit.on('stateChange', (from, to, reason) => {
        this.emit('circuitStateChange', name, from, to, reason);
      });

      circuit.on('open', (metrics) => {
        this.emit('circuitOpen', name, metrics);
      });

      circuit.on('close', (metrics) => {
        this.emit('circuitClose', name, metrics);
      });

      this.circuits.set(name, circuit);
      
      logger.info(`Circuit breaker created: ${name}`, { config: circuitConfig });
    }

    return this.circuits.get(name)!;
  }

  /**
   * Execute operation with circuit breaker
   */
  async execute<T>(
    circuitName: string,
    operation: () => Promise<T>,
    config?: Partial<CircuitBreakerConfig>,
    context: Record<string, any> = {}
  ): Promise<T> {
    const circuit = this.getCircuit(circuitName, config);
    return await circuit.execute(operation, context);
  }

  /**
   * Get all circuits
   */
  getAllCircuits(): Map<string, CircuitBreaker> {
    return new Map(this.circuits);
  }

  /**
   * Get circuit by name
   */
  getCircuitByName(name: string): CircuitBreaker | undefined {
    return this.circuits.get(name);
  }

  /**
   * Remove circuit
   */
  removeCircuit(name: string): boolean {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.removeAllListeners();
      this.circuits.delete(name);
      logger.info(`Circuit breaker removed: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Get health status of all circuits
   */
  getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [name, circuit] of this.circuits.entries()) {
      status[name] = circuit.getHealthStatus();
    }

    return status;
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const [name, circuit] of this.circuits.entries()) {
      circuit.reset();
      logger.info(`Circuit breaker reset: ${name}`);
    }
  }

  /**
   * Get statistics for all circuits
   */
  getStatistics(): Record<string, CircuitMetrics> {
    const stats: Record<string, CircuitMetrics> = {};
    
    for (const [name, circuit] of this.circuits.entries()) {
      stats[name] = circuit.getMetrics();
    }

    return stats;
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager();

// Utility functions for common circuit breaker patterns
export const createApiCircuitBreaker = (apiName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker => {
  return circuitBreakerManager.getCircuit(`api_${apiName}`, {
    failureThreshold: 3,
    recoveryTimeout: 30000,
    timeout: 5000,
    ...config
  });
};

export const createDatabaseCircuitBreaker = (dbName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker => {
  return circuitBreakerManager.getCircuit(`db_${dbName}`, {
    failureThreshold: 5,
    recoveryTimeout: 60000,
    timeout: 10000,
    ...config
  });
};

export const createExternalServiceCircuitBreaker = (serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker => {
  return circuitBreakerManager.getCircuit(`service_${serviceName}`, {
    failureThreshold: 3,
    recoveryTimeout: 45000,
    timeout: 8000,
    ...config
  });
}; 