import * as YAML from 'yamljs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger, initializeLogger } from '../logger/logger';
import { BotConfig, BotConfigSchema } from './config.schema';
import { z } from 'zod';
import { merge } from 'lodash';

export class ConfigManager {
  private config!: BotConfig;
  private readonly configPath: string;
  private isWatching = false;

  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'trading-config.yaml');
  }

  async loadConfig(): Promise<void> {
    try {
      logger.info('Loading configuration...');
      const defaultConfig = this.getDefaultConfig();
      let finalConfig: any = defaultConfig;

      try {
        const yamlContent = await fs.readFile(this.configPath, 'utf8');
        const yamlConfig = YAML.parse(yamlContent);
        finalConfig = merge({}, defaultConfig, yamlConfig);
        logger.info('Configuration loaded from YAML file');
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          logger.warn('YAML config file not found, using default configuration');
        } else {
          throw error;
        }
      }

      finalConfig = this.overrideWithEnvVars(finalConfig);

      this.config = this.validateConfig(finalConfig);

      await initializeLogger(this.config.logging);

      logger.info('Configuration loaded and validated successfully');

      if (!this.isWatching && process.env.NODE_ENV !== 'test') {
        this.watchConfig();
        this.isWatching = true;
      }
    } catch (error: any) {
      logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  getConfig(): BotConfig {
    return this.config;
  }

  private validateConfig(config: any): BotConfig {
    try {
      return BotConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Configuration validation failed:', error.issues);
        throw error;
      }
      throw error;
    }
  }

  private async watchConfig(): Promise<void> {
    try {
      const watcher = fs.watch(this.configPath);
      for await (const event of watcher) {
        if (event.eventType === 'change') {
          logger.info('Configuration file changed. Reloading...');
          await this.loadConfig();
        }
      }
    } catch (error) {
      logger.error('Failed to watch config file:', error);
    }
  }

  private getDefaultConfig(): BotConfig {
    return {
      trading: {
        mode: 'paper',
        capital: 100000,
        maxDailyLoss: 5000,
        maxPositionSize: 0.1,
        maxOpenPositions: 5
      },
      marketData: {
        websocketUrl: 'wss://ws.kite.trade/',
        historicalDays: 30,
        instruments: [
          {
            symbol: 'NIFTY',
            exchange: 'NSE',
            instrumentType: 'INDEX'
          },
          {
            symbol: 'BANKNIFTY',
            exchange: 'NSE',
            instrumentType: 'INDEX'
          }
        ]
      },
      risk: {
        maxDailyLoss: 5000,
        maxPositionSize: 0.1,
        maxOpenPositions: 5,
        defaultStopLossPercentage: 2.0,
        trailingStopLoss: true,
        maxRiskPerTrade: 0.02,
        maxPortfolioRisk: 0.1
      },
      schedule: {
        startTime: '09:15',
        endTime: '15:30',
        timezone: 'Asia/Kolkata',
        preMarketStart: '09:00',
        postMarketEnd: '15:45'
      },
      strategies: {
        moving_average: {
          name: 'moving_average',
          enabled: true,
          description: 'Simple Moving Average Crossover',
          parameters: {
            shortPeriod: 10,
            longPeriod: 20
          },
          capitalAllocation: 0.3,
          instruments: ['NIFTY', 'BANKNIFTY']
        },
        rsi: {
          name: 'rsi',
          enabled: false,
          description: 'Relative Strength Index Strategy',
          parameters: {
            period: 14,
            overbought: 70,
            oversold: 30
          },
          capitalAllocation: 0.2,
          instruments: ['RELIANCE']
        }
      },
      logging: {
        level: 'info',
        filePath: './logs/trading-bot.log',
        maxFileSize: '10m',
        maxFiles: 5
      },
      database: {
        url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/paradigm_trading',
        poolSize: 10,
        timeout: 30000
      },
      dashboard: {
        enabled: true,
        port: 3000,
        corsOrigin: '*'
      }
    };
  }

  private mergeConfig(defaultConfig: BotConfig, yamlConfig: any): BotConfig {
    return merge({}, defaultConfig, yamlConfig);
  }

  private overrideWithEnvVars(config: BotConfig): BotConfig {
    const envConfig = { ...config };

    // Trading config overrides
    if (process.env.TRADING_MODE) {
      envConfig.trading.mode = process.env.TRADING_MODE as 'paper' | 'live' | 'backtest';
    }
    if (process.env.TRADING_CAPITAL) {
      envConfig.trading.capital = parseFloat(process.env.TRADING_CAPITAL);
    }
    if (process.env.MAX_DAILY_LOSS) {
      envConfig.trading.maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS);
    }
    if (process.env.MAX_POSITION_SIZE) {
      envConfig.trading.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE);
    }
    if (process.env.MAX_OPEN_POSITIONS) {
      envConfig.trading.maxOpenPositions = parseInt(process.env.MAX_OPEN_POSITIONS);
    }

    // Market data config overrides
    if (process.env.MARKET_DATA_WEBSOCKET_URL) {
      envConfig.marketData.websocketUrl = process.env.MARKET_DATA_WEBSOCKET_URL;
    }
    if (process.env.HISTORICAL_DATA_DAYS) {
      envConfig.marketData.historicalDays = parseInt(process.env.HISTORICAL_DATA_DAYS);
    }

    // Risk config overrides
    if (process.env.STOP_LOSS_PERCENTAGE) {
      envConfig.risk.defaultStopLossPercentage = parseFloat(process.env.STOP_LOSS_PERCENTAGE);
    }
    if (process.env.TRAILING_STOP_LOSS) {
      envConfig.risk.trailingStopLoss = process.env.TRAILING_STOP_LOSS === 'true';
    }

    // Schedule config overrides
    if (process.env.TRADING_START_TIME) {
      envConfig.schedule.startTime = process.env.TRADING_START_TIME;
    }
    if (process.env.TRADING_END_TIME) {
      envConfig.schedule.endTime = process.env.TRADING_END_TIME;
    }
    if (process.env.TIMEZONE) {
      envConfig.schedule.timezone = process.env.TIMEZONE;
    }

    // Logging config overrides
    if (process.env.LOG_LEVEL) {
      envConfig.logging.level = process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
    }
    if (process.env.LOG_FILE_PATH) {
      envConfig.logging.filePath = process.env.LOG_FILE_PATH;
    }

    // Dashboard config overrides
    if (process.env.DASHBOARD_ENABLED) {
      envConfig.dashboard.enabled = process.env.DASHBOARD_ENABLED === 'true';
    }
    if (process.env.DASHBOARD_PORT) {
      envConfig.dashboard.port = parseInt(process.env.DASHBOARD_PORT);
    }

    return envConfig;
  }

  // Helper methods for specific config sections
  getTradingConfig() {
    return this.config.trading;
  }

  getMarketDataConfig() {
    return this.config.marketData;
  }

  getRiskConfig() {
    return this.config.risk;
  }

  getScheduleConfig() {
    return this.config.schedule;
  }

  getStrategiesConfig() {
    return this.config.strategies;
  }

  getLoggingConfig() {
    return this.config.logging;
  }

  getDatabaseConfig() {
    return this.config.database;
  }

  getDashboardConfig() {
    return this.config.dashboard;
  }

  // Zerodha credentials
  getZerodhaCredentials() {
    return {
      apiKey: process.env.ZERODHA_API_KEY || '',
      apiSecret: process.env.ZERODHA_API_SECRET || '',
      requestToken: process.env.ZERODHA_REQUEST_TOKEN || ''
    };
  }
}