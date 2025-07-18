import pino from 'pino';
import pinoPretty from 'pino-pretty';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingConfig } from '../config/config.schema';

// Enhanced logging configuration
interface EnhancedLoggingConfig extends LoggingConfig {
  prettyPrint?: boolean;
  logToFile?: boolean;
  logToConsole?: boolean;
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

class LoggerManager {
  private logger!: pino.Logger;
  private config: EnhancedLoggingConfig;

  constructor(config?: EnhancedLoggingConfig) {
    this.config = {
      level: 'info',
      filePath: './logs/trading-bot.log',
      maxFileSize: '10m',
      maxFiles: 5,
      prettyPrint: true,
      logToFile: true,
      logToConsole: true,
      logLevel: 'info',
      ...config
    };

    this.initializeLogger();
  }

  private initializeLogger(): void {
    const streams: pino.StreamEntry[] = [];

    // Console stream with pretty printing
    if (this.config.logToConsole) {
      streams.push({
        level: this.config.logLevel || 'info',
        stream: this.config.prettyPrint 
          ? pinoPretty({
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
              messageFormat: '{msg} {req.method} {req.url}',
                             customPrettifiers: {
                 time: (timestamp) => `🕐 ${timestamp}`,
                 level: (level) => `[${typeof level === 'string' ? level.toUpperCase() : level}]`,
               }
            })
          : process.stdout
      });
    }

    // File stream
    if (this.config.logToFile) {
      this.ensureLogDirectory();
      streams.push({
        level: this.config.logLevel || 'info',
        stream: pino.destination({
          dest: this.config.filePath,
          sync: false
        })
      });
    }

    // Create multi-stream logger
    this.logger = pino({
      level: this.config.logLevel || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
        log: (object) => object
      },
      serializers: {
        err: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res
      }
    }, pino.multistream(streams));
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.config.filePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  // Main logging methods
  info(message: string, data?: any): void {
    this.logger.info(data || {}, message);
  }

  warn(message: string, data?: any): void {
    this.logger.warn(data || {}, message);
  }

  error(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      this.logger.error({ err: error }, message);
    } else {
      this.logger.error(error || {}, message);
    }
  }

  debug(message: string, data?: any): void {
    this.logger.debug(data || {}, message);
  }

  trace(message: string, data?: any): void {
    this.logger.trace(data || {}, message);
  }

  fatal(message: string, error?: Error | any): void {
    if (error instanceof Error) {
      this.logger.fatal({ err: error }, message);
    } else {
      this.logger.fatal(error || {}, message);
    }
  }

  // Trading-specific logging methods
  trade(signal: any, action: string): void {
    this.logger.info({ 
      type: 'trade',
      action,
      signal: {
        symbol: signal.symbol,
        action: signal.action,
        price: signal.price,
        quantity: signal.quantity,
        timestamp: signal.timestamp
      }
    }, `Trade ${action}: ${signal.symbol}`);
  }

  strategy(strategyName: string, event: string, data?: any): void {
    this.logger.info({
      type: 'strategy',
      strategy: strategyName,
      event,
      ...data
    }, `Strategy ${strategyName}: ${event}`);
  }

  marketData(symbol: string, data: any): void {
    this.logger.debug({
      type: 'market_data',
      symbol,
      price: data.last_price,
      volume: data.volume,
      timestamp: data.timestamp
    }, `Market data for ${symbol}`);
  }

  performance(metrics: any): void {
    this.logger.info({
      type: 'performance',
      metrics
    }, 'Performance metrics updated');
  }

  // API request/response logging
  apiRequest(method: string, url: string, params?: any): void {
    this.logger.debug({
      type: 'api_request',
      method,
      url,
      params
    }, `API Request: ${method} ${url}`);
  }

  apiResponse(method: string, url: string, status: number, duration: number): void {
    this.logger.debug({
      type: 'api_response',
      method,
      url,
      status,
      duration
    }, `API Response: ${method} ${url} - ${status} (${duration}ms)`);
  }

  // Error logging with context
  errorWithContext(message: string, context: any, error?: Error): void {
    this.logger.error({
      context,
      err: error
    }, message);
  }

  // Get the underlying Pino logger for advanced usage
  getPinoLogger(): pino.Logger {
    return this.logger;
  }

  // Update configuration
  updateConfig(newConfig: Partial<EnhancedLoggingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.initializeLogger();
  }
}

// Create default logger instance
const defaultLogger = new LoggerManager();

// Export for backward compatibility
export const logger = {
  info: (message: string, data?: any) => defaultLogger.info(message, data),
  warn: (message: string, data?: any) => defaultLogger.warn(message, data),
  error: (message: string, error?: Error | any) => defaultLogger.error(message, error),
  debug: (message: string, data?: any) => defaultLogger.debug(message, data),
  trace: (message: string, data?: any) => defaultLogger.trace(message, data),
  fatal: (message: string, error?: Error | any) => defaultLogger.fatal(message, error),
  trade: (signal: any, action: string) => defaultLogger.trade(signal, action),
  strategy: (strategyName: string, event: string, data?: any) => defaultLogger.strategy(strategyName, event, data),
  marketData: (symbol: string, data: any) => defaultLogger.marketData(symbol, data),
  performance: (metrics: any) => defaultLogger.performance(metrics),
  apiRequest: (method: string, url: string, params?: any) => defaultLogger.apiRequest(method, url, params),
  apiResponse: (method: string, url: string, status: number, duration: number) => defaultLogger.apiResponse(method, url, status, duration),
  errorWithContext: (message: string, context: any, error?: Error) => defaultLogger.errorWithContext(message, context, error)
};

// Export initializeLogger function
export const initializeLogger = (config?: EnhancedLoggingConfig): LoggerManager => {
  return new LoggerManager(config);
};

// Export the logger manager for advanced usage
export { LoggerManager };
export default defaultLogger; 