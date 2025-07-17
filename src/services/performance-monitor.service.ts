import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import { logger } from '../logger/logger';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PerformanceThreshold {
  name: string;
  warning: number;
  critical: number;
  unit: string;
}

export interface PerformanceAlert {
  level: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  message: string;
}

export class PerformanceMonitorService extends EventEmitter {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private observers: PerformanceObserver[] = [];
  private isMonitoring = false;
  private maxMetricsPerName = 1000; // Keep last 1000 metrics per name

  constructor() {
    super();
    this.setupDefaultThresholds();
  }

  /**
   * Start performance monitoring
   */
  start(): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring already started');
      return;
    }

    this.isMonitoring = true;
    this.setupObservers();
    logger.info('Performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      logger.warn('Performance monitoring not started');
      return;
    }

    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    logger.info('Performance monitoring stopped');
  }

  /**
   * Record a custom metric
   */
  recordMetric(name: string, value: number, unit: string = 'ms', metadata?: Record<string, any>): void {
    if (!this.isMonitoring) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      metadata
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(metric);

    // Keep only the last maxMetricsPerName metrics
    if (metrics.length > this.maxMetricsPerName) {
      metrics.splice(0, metrics.length - this.maxMetricsPerName);
    }

    // Check thresholds
    this.checkThresholds(metric);

    logger.debug('Performance metric recorded', { name, value, unit });
  }

  /**
   * Measure execution time of a function
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration, 'ms', metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}_error`, duration, 'ms', { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Measure execution time of a synchronous function
   */
  measureSync<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration, 'ms', metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}_error`, duration, 'ms', { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Create a performance mark
   */
  mark(name: string): void {
    if (!this.isMonitoring) return;
    performance.mark(name);
    logger.debug('Performance mark created', { name });
  }

  /**
   * Measure between two marks
   */
  measure(name: string, startMark: string, endMark: string): void {
    if (!this.isMonitoring) return;
    
    try {
      const measure = performance.measure(name, startMark, endMark);
      this.recordMetric(name, measure.duration, 'ms');
      logger.debug('Performance measure recorded', { name, duration: measure.duration });
    } catch (error) {
      logger.error('Error measuring performance', { name, startMark, endMark, error });
    }
  }

  /**
   * Set performance threshold
   */
  setThreshold(threshold: PerformanceThreshold): void {
    this.thresholds.set(threshold.name, threshold);
    logger.debug('Performance threshold set', threshold);
  }

  /**
   * Get performance statistics for a metric
   */
  getStats(metricName: string, duration: number = 3600000): { // Default 1 hour
    count: number;
    min: number;
    max: number;
    avg: number;
    median: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.metrics.get(metricName);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const cutoff = Date.now() - duration;
    const recentMetrics = metrics.filter(m => m.timestamp.getTime() > cutoff);
    
    if (recentMetrics.length === 0) {
      return null;
    }

    const values = recentMetrics.map(m => m.value).sort((a, b) => a - b);
    const count = values.length;
    const min = values[0];
    const max = values[count - 1];
    const avg = values.reduce((a, b) => a + b, 0) / count;
    const median = values[Math.floor(count / 2)];
    const p95 = values[Math.floor(count * 0.95)];
    const p99 = values[Math.floor(count * 0.99)];

    return { count, min, max, avg, median, p95, p99 };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, PerformanceMetric[]> {
    return new Map(this.metrics);
  }

  /**
   * Get metrics for a specific name
   */
  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || [];
  }

  /**
   * Clear metrics
   */
  clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
      logger.info('Metrics cleared', { name });
    } else {
      this.metrics.clear();
      logger.info('All metrics cleared');
    }
  }

  /**
   * Get system performance metrics
   */
  getSystemMetrics(): {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    uptime: number;
  } {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    return {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: memoryPercentage
      },
      cpu: {
        usage: process.cpuUsage().user / 1000000 // Convert to seconds
      },
      uptime: process.uptime()
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): {
    timestamp: Date;
    systemMetrics: any;
    customMetrics: Record<string, any>;
    alerts: PerformanceAlert[];
  } {
    const systemMetrics = this.getSystemMetrics();
    const customMetrics: Record<string, any> = {};
    const alerts: PerformanceAlert[] = [];

    // Get stats for all metrics
    for (const [name, metrics] of this.metrics.entries()) {
      const stats = this.getStats(name);
      if (stats) {
        customMetrics[name] = stats;
      }
    }

    // Check for alerts
    for (const [name, metrics] of this.metrics.entries()) {
      const threshold = this.thresholds.get(name);
      if (threshold && metrics.length > 0) {
        const latestValue = metrics[metrics.length - 1].value;
        
        if (latestValue >= threshold.critical) {
          alerts.push({
            level: 'critical',
            metric: name,
            value: latestValue,
            threshold: threshold.critical,
            timestamp: new Date(),
            message: `${name} exceeded critical threshold: ${latestValue} ${threshold.unit} >= ${threshold.critical} ${threshold.unit}`
          });
        } else if (latestValue >= threshold.warning) {
          alerts.push({
            level: 'warning',
            metric: name,
            value: latestValue,
            threshold: threshold.warning,
            timestamp: new Date(),
            message: `${name} exceeded warning threshold: ${latestValue} ${threshold.unit} >= ${threshold.warning} ${threshold.unit}`
          });
        }
      }
    }

    return {
      timestamp: new Date(),
      systemMetrics,
      customMetrics,
      alerts
    };
  }

  /**
   * Setup performance observers
   */
  private setupObservers(): void {
    // Observe measure events
    const measureObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        this.recordMetric(entry.name, entry.duration, 'ms', {
          entryType: entry.entryType,
          startTime: entry.startTime
        });
      }
    });
    measureObserver.observe({ entryTypes: ['measure'] });
    this.observers.push(measureObserver);

    // Observe mark events
    const markObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        logger.debug('Performance mark observed', { 
          name: entry.name, 
          startTime: entry.startTime 
        });
      }
    });
    markObserver.observe({ entryTypes: ['mark'] });
    this.observers.push(markObserver);
  }

  /**
   * Check performance thresholds
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.name);
    if (!threshold) return;

    if (metric.value >= threshold.critical) {
      const alert: PerformanceAlert = {
        level: 'critical',
        metric: metric.name,
        value: metric.value,
        threshold: threshold.critical,
        timestamp: metric.timestamp,
        message: `${metric.name} exceeded critical threshold: ${metric.value} ${metric.unit} >= ${threshold.critical} ${threshold.unit}`
      };
      
      this.emit('alert', alert);
      logger.error('Performance alert: Critical', alert);
    } else if (metric.value >= threshold.warning) {
      const alert: PerformanceAlert = {
        level: 'warning',
        metric: metric.name,
        value: metric.value,
        threshold: threshold.warning,
        timestamp: metric.timestamp,
        message: `${metric.name} exceeded warning threshold: ${metric.value} ${metric.unit} >= ${threshold.warning} ${threshold.unit}`
      };
      
      this.emit('alert', alert);
      logger.warn('Performance alert: Warning', alert);
    }
  }

  /**
   * Setup default performance thresholds
   */
  private setupDefaultThresholds(): void {
    const defaultThresholds: PerformanceThreshold[] = [
      {
        name: 'api_request_duration',
        warning: 1000, // 1 second
        critical: 5000, // 5 seconds
        unit: 'ms'
      },
      {
        name: 'strategy_execution_duration',
        warning: 500, // 500ms
        critical: 2000, // 2 seconds
        unit: 'ms'
      },
      {
        name: 'order_placement_duration',
        warning: 2000, // 2 seconds
        critical: 10000, // 10 seconds
        unit: 'ms'
      },
      {
        name: 'market_data_fetch_duration',
        warning: 500, // 500ms
        critical: 2000, // 2 seconds
        unit: 'ms'
      },
      {
        name: 'database_query_duration',
        warning: 100, // 100ms
        critical: 1000, // 1 second
        unit: 'ms'
      }
    ];

    defaultThresholds.forEach(threshold => {
      this.setThreshold(threshold);
    });
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean;
    totalMetrics: number;
    metricNames: string[];
    thresholds: PerformanceThreshold[];
  } {
    return {
      isMonitoring: this.isMonitoring,
      totalMetrics: Array.from(this.metrics.values()).reduce((sum, metrics) => sum + metrics.length, 0),
      metricNames: Array.from(this.metrics.keys()),
      thresholds: Array.from(this.thresholds.values())
    };
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitorService();

// Trading-specific performance metrics
export const tradingMetrics = {
  // API performance
  API_REQUEST: 'api_request_duration',
  API_RESPONSE: 'api_response_duration',
  
  // Strategy performance
  STRATEGY_EXECUTION: 'strategy_execution_duration',
  STRATEGY_SIGNAL_GENERATION: 'strategy_signal_generation_duration',
  
  // Order performance
  ORDER_PLACEMENT: 'order_placement_duration',
  ORDER_MODIFICATION: 'order_modification_duration',
  ORDER_CANCELLATION: 'order_cancellation_duration',
  
  // Market data performance
  MARKET_DATA_FETCH: 'market_data_fetch_duration',
  MARKET_DATA_PROCESSING: 'market_data_processing_duration',
  
  // Database performance
  DATABASE_QUERY: 'database_query_duration',
  DATABASE_WRITE: 'database_write_duration',
  
  // Cache performance
  CACHE_GET: 'cache_get_duration',
  CACHE_SET: 'cache_set_duration',
  
  // Risk management
  RISK_CHECK: 'risk_check_duration',
  POSITION_CALCULATION: 'position_calculation_duration',
  
  // System performance
  MEMORY_USAGE: 'memory_usage_percentage',
  CPU_USAGE: 'cpu_usage_percentage',
  DISK_USAGE: 'disk_usage_percentage'
}; 