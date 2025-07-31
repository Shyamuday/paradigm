import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  CircuitBreaker, 
  CircuitBreakerManager, 
  CircuitState,
  DEFAULT_CIRCUIT_CONFIG,
  createApiCircuitBreaker,
  createDatabaseCircuitBreaker,
  createExternalServiceCircuitBreaker
} from '../utils/circuit-breaker';

describe('Circuit Breaker', () => {
  let circuit: CircuitBreaker;

  beforeEach(() => {
    circuit = new CircuitBreaker({ name: 'test_circuit' });
  });

  afterEach(() => {
    circuit.reset();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(circuit.getState()).toBe(CircuitState.CLOSED);
      expect(circuit.getConfig().failureThreshold).toBe(DEFAULT_CIRCUIT_CONFIG.failureThreshold);
      expect(circuit.getConfig().recoveryTimeout).toBe(DEFAULT_CIRCUIT_CONFIG.recoveryTimeout);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        failureThreshold: 2,
        recoveryTimeout: 30000,
        timeout: 5000,
        name: 'custom_circuit'
      };
      
      const customCircuit = new CircuitBreaker(customConfig);
      expect(customCircuit.getConfig().failureThreshold).toBe(2);
      expect(customCircuit.getConfig().recoveryTimeout).toBe(30000);
    });
  });

  describe('State Management', () => {
    it('should start in CLOSED state', () => {
      expect(circuit.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition to OPEN state after failures', async () => {
      // Force failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuit.execute(async () => {
            throw new Error('Test failure');
          });
        } catch (error) {
          // Expected
        }
      }

      expect(circuit.getState()).toBe(CircuitState.OPEN);
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Open the circuit first
      for (let i = 0; i < 5; i++) {
        try {
          await circuit.execute(async () => {
            throw new Error('Test failure');
          });
        } catch (error) {
          // Expected
        }
      }

      expect(circuit.getState()).toBe(CircuitState.OPEN);

      // Wait for recovery timeout (use shorter timeout for test)
      const shortCircuit = new CircuitBreaker({
        name: 'short_timeout',
        recoveryTimeout: 100 // 100ms for test
      });

      // Open this circuit
      for (let i = 0; i < 5; i++) {
        try {
          await shortCircuit.execute(async () => {
            throw new Error('Test failure');
          });
        } catch (error) {
          // Expected
        }
      }

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Try to execute - should transition to HALF_OPEN
      try {
        await shortCircuit.execute(async () => {
          throw new Error('Test failure');
        });
      } catch (error) {
        // Expected
      }

      expect(shortCircuit.getState()).toBe(CircuitState.OPEN);
    });

    it('should transition to CLOSED after successful operations in HALF_OPEN', async () => {
      const shortCircuit = new CircuitBreaker({
        name: 'half_open_test',
        failureThreshold: 2,
        recoveryTimeout: 100,
        successThreshold: 2
      });

      // Open the circuit
      for (let i = 0; i < 2; i++) {
        try {
          await shortCircuit.execute(async () => {
            throw new Error('Test failure');
          });
        } catch (error) {
          // Expected
        }
      }

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Successful operations should close the circuit
      for (let i = 0; i < 2; i++) {
        await shortCircuit.execute(async () => {
          return { success: true };
        });
      }

      expect(shortCircuit.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Execution', () => {
    it('should execute successful operations', async () => {
      const result = await circuit.execute(async () => {
        return { data: 'success' };
      });

      expect(result).toEqual({ data: 'success' });
      expect(circuit.getMetrics().successfulRequests).toBe(1);
    });

    it('should handle failed operations', async () => {
      try {
        await circuit.execute(async () => {
          throw new Error('Operation failed');
        });
      } catch (error) {
        expect((error as Error).message).toBe('Operation failed');
      }

      expect(circuit.getMetrics().failedRequests).toBe(1);
    });

    it('should handle timeout operations', async () => {
      const timeoutCircuit = new CircuitBreaker({
        name: 'timeout_test',
        timeout: 100
      });

      try {
        await timeoutCircuit.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return { data: 'success' };
        });
      } catch (error) {
        expect((error as Error).message).toContain('timeout');
      }

      expect(timeoutCircuit.getMetrics().timeoutRequests).toBe(1);
    });

    it('should fail fast when circuit is OPEN', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuit.execute(async () => {
            throw new Error('Test failure');
          });
        } catch (error) {
          // Expected
        }
      }

      // Try to execute when circuit is open
      try {
        await circuit.execute(async () => {
          return { data: 'success' };
        });
      } catch (error) {
        expect((error as Error).message).toContain('Circuit breaker is OPEN');
      }
    });
  });

  describe('Metrics', () => {
    it('should track successful requests', async () => {
      await circuit.execute(async () => ({ success: true }));
      await circuit.execute(async () => ({ success: true }));

      const metrics = circuit.getMetrics();
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.currentFailureRate).toBe(0);
    });

    it('should track failed requests', async () => {
      try {
        await circuit.execute(async () => {
          throw new Error('Failure 1');
        });
      } catch (error) {
        // Expected
      }

      try {
        await circuit.execute(async () => {
          throw new Error('Failure 2');
        });
      } catch (error) {
        // Expected
      }

      const metrics = circuit.getMetrics();
      expect(metrics.failedRequests).toBe(2);
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.currentFailureRate).toBe(1);
    });

    it('should track mixed success and failure rates', async () => {
      // 2 successes, 1 failure
      await circuit.execute(async () => ({ success: true }));
      await circuit.execute(async () => ({ success: true }));
      
      try {
        await circuit.execute(async () => {
          throw new Error('Failure');
        });
      } catch (error) {
        // Expected
      }

      const metrics = circuit.getMetrics();
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.currentFailureRate).toBeCloseTo(0.333, 2);
    });
  });

  describe('Health Status', () => {
    it('should report healthy when closed', () => {
      const health = circuit.getHealthStatus();
      expect(health.healthy).toBe(true);
      expect(health.state).toBe(CircuitState.CLOSED);
      expect(health.failureRate).toBe(0);
    });

    it('should report unhealthy when open', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuit.execute(async () => {
            throw new Error('Test failure');
          });
        } catch (error) {
          // Expected
        }
      }

      const health = circuit.getHealthStatus();
      expect(health.healthy).toBe(false);
      expect(health.state).toBe(CircuitState.OPEN);
      expect(health.failureRate).toBe(1);
    });
  });

  describe('Manual Control', () => {
    it('should allow manual opening', () => {
      circuit.forceOpen('Manual test');
      expect(circuit.getState()).toBe(CircuitState.OPEN);
    });

    it('should allow manual closing', () => {
      circuit.forceOpen('Manual test');
      circuit.forceClose('Manual test');
      expect(circuit.getState()).toBe(CircuitState.CLOSED);
    });

    it('should allow reset', async () => {
      // Generate some metrics
      await circuit.execute(async () => ({ success: true }));
      try {
        await circuit.execute(async () => {
          throw new Error('Test failure');
        });
      } catch (error) {
        // Expected
      }

      circuit.reset();
      
      const metrics = circuit.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(circuit.getState()).toBe(CircuitState.CLOSED);
    });
  });

  describe('Events', () => {
    it('should emit state change events', (done) => {
      circuit.on('stateChange', (from, to, reason) => {
        expect(from).toBe(CircuitState.CLOSED);
        expect(to).toBe(CircuitState.OPEN);
        expect(reason).toBe('Failure threshold exceeded');
        done();
      });

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        circuit.execute(async () => {
          throw new Error('Test failure');
        }).catch(() => {
          // Expected
        });
      }
    });

    it('should emit success events', (done) => {
      circuit.on('success', (metrics) => {
        expect(metrics.successfulRequests).toBe(1);
        done();
      });

      circuit.execute(async () => ({ success: true }));
    });

    it('should emit failure events', (done) => {
      circuit.on('failure', (error, metrics) => {
        expect(error.message).toBe('Test failure');
        expect(metrics.failedRequests).toBe(1);
        done();
      });

      circuit.execute(async () => {
        throw new Error('Test failure');
      }).catch(() => {
        // Expected
      });
    });
  });
});

describe('Circuit Breaker Manager', () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = new CircuitBreakerManager();
  });

  afterEach(() => {
    manager.resetAll();
  });

  describe('Circuit Management', () => {
    it('should create and retrieve circuits', () => {
      const circuit = manager.getCircuit('test_circuit');
      expect(circuit).toBeInstanceOf(CircuitBreaker);
      expect(circuit.getConfig().name).toBe('test_circuit');
    });

    it('should reuse existing circuits', () => {
      const circuit1 = manager.getCircuit('test_circuit');
      const circuit2 = manager.getCircuit('test_circuit');
      expect(circuit1).toBe(circuit2);
    });

    it('should remove circuits', () => {
      manager.getCircuit('test_circuit');
      expect(manager.getCircuitByName('test_circuit')).toBeDefined();
      
      const removed = manager.removeCircuit('test_circuit');
      expect(removed).toBe(true);
      expect(manager.getCircuitByName('test_circuit')).toBeUndefined();
    });
  });

  describe('Execution', () => {
    it('should execute operations through manager', async () => {
      const result = await manager.execute('test_circuit', async () => {
        return { data: 'success' };
      });

      expect(result).toEqual({ data: 'success' });
    });

    it('should create circuit with custom config', async () => {
      const result = await manager.execute(
        'custom_circuit',
        async () => ({ data: 'success' }),
        { failureThreshold: 2, timeout: 5000 }
      );

      expect(result).toEqual({ data: 'success' });
      
      const circuit = manager.getCircuitByName('custom_circuit');
      expect(circuit?.getConfig().failureThreshold).toBe(2);
    });
  });

  describe('Monitoring', () => {
    it('should provide health status for all circuits', async () => {
      manager.getCircuit('circuit1');
      manager.getCircuit('circuit2');

      const healthStatus = manager.getHealthStatus();
      expect(Object.keys(healthStatus)).toHaveLength(2);
      expect(healthStatus.circuit1.healthy).toBe(true);
      expect(healthStatus.circuit2.healthy).toBe(true);
    });

    it('should provide statistics for all circuits', async () => {
      const circuit1 = manager.getCircuit('circuit1');
      const circuit2 = manager.getCircuit('circuit2');

      // Generate some activity
      await circuit1.execute(async () => ({ success: true }));
      try {
        await circuit2.execute(async () => {
          throw new Error('Test failure');
        });
      } catch (error) {
        // Expected
      }

      const statistics = manager.getStatistics();
      expect(Object.keys(statistics)).toHaveLength(2);
      expect(statistics.circuit1.successfulRequests).toBe(1);
      expect(statistics.circuit2.failedRequests).toBe(1);
    });
  });

  describe('Events', () => {
    it('should forward events from individual circuits', (done) => {
      manager.on('circuitOpen', (circuitName, metrics) => {
        expect(circuitName).toBe('test_circuit');
        expect(metrics.failedRequests).toBeGreaterThan(0);
        done();
      });

      const circuit = manager.getCircuit('test_circuit', { failureThreshold: 1 });
      
      circuit.execute(async () => {
        throw new Error('Test failure');
      }).catch(() => {
        // Expected
      });
    });
  });
});

describe('Utility Functions', () => {
  describe('createApiCircuitBreaker', () => {
    it('should create API circuit breaker with default config', () => {
      const circuit = createApiCircuitBreaker('test_api');
      expect(circuit.getConfig().name).toBe('api_test_api');
      expect(circuit.getConfig().failureThreshold).toBe(3);
      expect(circuit.getConfig().timeout).toBe(5000);
    });

    it('should create API circuit breaker with custom config', () => {
      const circuit = createApiCircuitBreaker('test_api', {
        failureThreshold: 5,
        timeout: 10000
      });
      expect(circuit.getConfig().failureThreshold).toBe(5);
      expect(circuit.getConfig().timeout).toBe(10000);
    });
  });

  describe('createDatabaseCircuitBreaker', () => {
    it('should create database circuit breaker with default config', () => {
      const circuit = createDatabaseCircuitBreaker('test_db');
      expect(circuit.getConfig().name).toBe('db_test_db');
      expect(circuit.getConfig().failureThreshold).toBe(5);
      expect(circuit.getConfig().timeout).toBe(10000);
    });
  });

  describe('createExternalServiceCircuitBreaker', () => {
    it('should create external service circuit breaker with default config', () => {
      const circuit = createExternalServiceCircuitBreaker('test_service');
      expect(circuit.getConfig().name).toBe('service_test_service');
      expect(circuit.getConfig().failureThreshold).toBe(3);
      expect(circuit.getConfig().timeout).toBe(8000);
    });
  });
}); 