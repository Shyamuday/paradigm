import winston from 'winston';
import path from 'path';
import fs from 'fs/promises';
import { LoggingConfig } from '../config/config.schema';

const createDefaultLogger = () => {
  return winston.createLogger({
    level: 'info',
    transports: [new winston.transports.Console()],
  });
};

let logger: winston.Logger = createDefaultLogger();

export async function initializeLogger(config: LoggingConfig): Promise<void> {
  const logsDir = path.join(process.cwd(), 'logs');
  await fs.mkdir(logsDir, { recursive: true });

  const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
      }
      return msg;
    })
  );

  logger.configure({
    level: config.level,
    format: logFormat,
    defaultMeta: { service: 'trading-bot' },
    transports: [
      new winston.transports.Console({
        format: consoleFormat,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'trading-bot.log'),
        maxsize: parseInt(config.maxFileSize),
        maxFiles: config.maxFiles,
        tailable: true,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        maxsize: parseInt(config.maxFileSize),
        maxFiles: config.maxFiles,
        tailable: true,
      }),
    ],
  });
}

export { logger };

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