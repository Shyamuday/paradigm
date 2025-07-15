"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigManager = void 0;
const YAML = __importStar(require("yamljs"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("../logger/logger");
class ConfigManager {
    constructor() {
        this.configPath = path.join(process.cwd(), 'config', 'trading-config.yaml');
        this.config = this.getDefaultConfig();
    }
    async loadConfig() {
        try {
            logger_1.logger.info('Loading configuration...');
            if (fs.existsSync(this.configPath)) {
                const yamlConfig = YAML.load(this.configPath);
                this.config = this.mergeConfig(this.config, yamlConfig);
                logger_1.logger.info('Configuration loaded from YAML file');
            }
            else {
                logger_1.logger.warn('YAML config file not found, using default configuration');
            }
            this.config = this.overrideWithEnvVars(this.config);
            logger_1.logger.info('Configuration loaded successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to load configuration:', error);
            throw error;
        }
    }
    getConfig() {
        return this.config;
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
    getDefaultConfig() {
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
    mergeConfig(defaultConfig, yamlConfig) {
        return {
            ...defaultConfig,
            ...yamlConfig
        };
    }
    overrideWithEnvVars(config) {
        const envConfig = { ...config };
        if (process.env.TRADING_MODE) {
            envConfig.trading.mode = process.env.TRADING_MODE;
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
        if (process.env.MARKET_DATA_WEBSOCKET_URL) {
            envConfig.marketData.websocketUrl = process.env.MARKET_DATA_WEBSOCKET_URL;
        }
        if (process.env.HISTORICAL_DATA_DAYS) {
            envConfig.marketData.historicalDays = parseInt(process.env.HISTORICAL_DATA_DAYS);
        }
        if (process.env.STOP_LOSS_PERCENTAGE) {
            envConfig.risk.defaultStopLossPercentage = parseFloat(process.env.STOP_LOSS_PERCENTAGE);
        }
        if (process.env.TRAILING_STOP_LOSS) {
            envConfig.risk.trailingStopLoss = process.env.TRAILING_STOP_LOSS === 'true';
        }
        if (process.env.TRADING_START_TIME) {
            envConfig.schedule.startTime = process.env.TRADING_START_TIME;
        }
        if (process.env.TRADING_END_TIME) {
            envConfig.schedule.endTime = process.env.TRADING_END_TIME;
        }
        if (process.env.TIMEZONE) {
            envConfig.schedule.timezone = process.env.TIMEZONE;
        }
        if (process.env.LOG_LEVEL) {
            envConfig.logging.level = process.env.LOG_LEVEL;
        }
        if (process.env.LOG_FILE_PATH) {
            envConfig.logging.filePath = process.env.LOG_FILE_PATH;
        }
        if (process.env.DASHBOARD_ENABLED) {
            envConfig.dashboard.enabled = process.env.DASHBOARD_ENABLED === 'true';
        }
        if (process.env.DASHBOARD_PORT) {
            envConfig.dashboard.port = parseInt(process.env.DASHBOARD_PORT);
        }
        return envConfig;
    }
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
    getZerodhaCredentials() {
        return {
            apiKey: process.env.ZERODHA_API_KEY || '',
            apiSecret: process.env.ZERODHA_API_SECRET || '',
            requestToken: process.env.ZERODHA_REQUEST_TOKEN || ''
        };
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=config-manager.js.map