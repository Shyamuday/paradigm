import * as YAML from 'yamljs';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger/logger';
import { BotConfig } from '../types';

export class ConfigManager {
  private config: BotConfig;
  private configPath: string;

  constructor() {
    this.configPath = path.join(process.cwd(), 'config', 'trading-config.yaml');
    this.config = this.getDefaultConfig();
  }

  async loadConfig(): Promise<void> {
    try {
      logger.info('Loading configuration...');
      
      // Load YAML config file
      if (fs.existsSync(this.configPath)) {
        const yamlConfig = YAML.load(this.configPath);
        this.config = this.mergeConfig(this.config, yamlConfig);
        logger.info('Configuration loaded from YAML file');
      } else {
        logger.warn('YAML config file not found, using default configuration');
      }

      // Override with environment variables
      this.config = this.overrideWithEnvVars(this.config);
      
      logger.info('Configuration loaded successfully');
      
    } catch (error) {
      logger.error('Failed to load configuration:', error);
      throw error;
    }
  }

  getConfig(): BotConfig {
    return this.config;
  }

  updateConfig(updates: Partial<BotConfig>): void {
    this.config = { ...this.config, ...updates };
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
        simple_ma: {
          name: 'simple_ma',
          enabled: true,
          description: 'Simple Moving Average Crossover',
          parameters: {
            shortPeriod: 10,
            longPeriod: 20
          },
          capitalAllocation: 0.3,
          instruments: ['NIFTY', 'BANKNIFTY']
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
    return {
      ...defaultConfig,
      ...yamlConfig
    };
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