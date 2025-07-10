import winston from 'winston';
import path from 'path';

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'trading-bot' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: consoleFormat
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'trading-bot.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Error file transport
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Add stream for Morgan HTTP logging
export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Helper functions for different log categories
export const createCategoryLogger = (category: string) => {
  return {
    info: (message: string, meta?: any) => logger.info(message, { category, ...meta }),
    warn: (message: string, meta?: any) => logger.warn(message, { category, ...meta }),
    error: (message: string, meta?: any) => logger.error(message, { category, ...meta }),
    debug: (message: string, meta?: any) => logger.debug(message, { category, ...meta })
  };
};

// Export category loggers
export const authLogger = createCategoryLogger('AUTH');
export const marketDataLogger = createCategoryLogger('MARKET_DATA');
export const strategyLogger = createCategoryLogger('STRATEGY');
export const orderLogger = createCategoryLogger('ORDER');
export const positionLogger = createCategoryLogger('POSITION');
export const riskLogger = createCategoryLogger('RISK');
export const schedulerLogger = createCategoryLogger('SCHEDULER');
export const storageLogger = createCategoryLogger('STORAGE');
export const dashboardLogger = createCategoryLogger('DASHBOARD'); 