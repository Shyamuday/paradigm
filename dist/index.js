"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("./logger/logger");
const config_manager_1 = require("./config/config-manager");
const easy_auth_1 = require("./auth/easy-auth");
const database_1 = require("./database/database");
const user_service_1 = require("./services/user.service");
const market_data_service_1 = require("./services/market-data.service");
const order_service_1 = require("./services/order.service");
const strategy_service_1 = require("./services/strategy.service");
dotenv_1.default.config();
class TradingBot {
    constructor() {
        this.isRunning = false;
        logger_1.logger.info('🚀 Initializing Paradigm Algo Trading Bot...');
        this.configManager = new config_manager_1.ConfigManager();
        this.databaseManager = database_1.DatabaseManager.getInstance();
        this.userService = new user_service_1.UserService();
        this.marketDataService = new market_data_service_1.MarketDataService();
        this.orderService = new order_service_1.OrderService();
        this.strategyService = new strategy_service_1.StrategyService();
    }
    async initialize() {
        try {
            logger_1.logger.info('📋 Starting bot initialization...');
            await this.configManager.loadConfig();
            logger_1.logger.info('✅ Configuration loaded');
            await this.databaseManager.connect();
            logger_1.logger.info('✅ Database connected');
            await this.initializeAuthentication();
            logger_1.logger.info('✅ Authentication initialized');
            await this.initializeMarketData();
            logger_1.logger.info('✅ Market data initialized');
            await this.initializeStrategies();
            logger_1.logger.info('✅ Trading strategies initialized');
            await this.initializeUserSession();
            logger_1.logger.info('✅ User session initialized');
            logger_1.logger.info('🎉 Bot initialization completed successfully');
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to initialize bot:', error);
            throw error;
        }
    }
    async initializeAuthentication() {
        try {
            const authConfig = {
                apiKey: process.env.ZERODHA_API_KEY || '',
                apiSecret: process.env.ZERODHA_API_SECRET || '',
                userId: process.env.ZERODHA_USER_ID || '',
                password: process.env.ZERODHA_PASSWORD || '',
                totpSecret: process.env.ZERODHA_TOTP_SECRET || '',
                redirectUri: process.env.ZERODHA_REDIRECT_URI || 'https://127.0.0.1'
            };
            this.authManager = new easy_auth_1.AutoTOTPZerodhaAuth(authConfig);
            const session = await this.authManager.authenticate();
            logger_1.logger.info('🎉 Zerodha TOTP authentication successful!');
            logger_1.logger.info('   User ID:', session.userId);
            logger_1.logger.info('   Access Token:', session.accessToken.substring(0, 10) + '...');
            logger_1.logger.info('   Token Expires:', session.expiryTime);
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize authentication:', error);
            throw error;
        }
    }
    async initializeMarketData() {
        try {
            const marketDataConfig = this.configManager.getMarketDataConfig();
            for (const instrumentConfig of marketDataConfig.instruments) {
                try {
                    const existingInstrument = await this.marketDataService.getInstrumentBySymbol(instrumentConfig.symbol);
                    if (!existingInstrument) {
                        await this.marketDataService.createInstrument(instrumentConfig);
                        logger_1.logger.info('📈 Instrument created:', instrumentConfig.symbol);
                    }
                }
                catch (error) {
                    logger_1.logger.warn('Failed to create instrument:', instrumentConfig.symbol, error);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize market data:', error);
            throw error;
        }
    }
    async initializeStrategies() {
        try {
            const strategiesConfig = this.configManager.getStrategiesConfig();
            for (const [strategyName, strategyConfig] of Object.entries(strategiesConfig)) {
                try {
                    const existingStrategy = await this.strategyService.getStrategyByName(strategyName);
                    if (!existingStrategy) {
                        await this.strategyService.createStrategy(strategyConfig);
                        logger_1.logger.info('📊 Strategy created:', strategyName);
                    }
                }
                catch (error) {
                    logger_1.logger.warn('Failed to create strategy:', strategyName, error);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize strategies:', error);
            throw error;
        }
    }
    async initializeUserSession() {
        try {
            const tradingConfig = this.configManager.getTradingConfig();
            let user = await this.userService.getUserByEmail('bot@paradigm.com');
            if (!user) {
                const newUser = await this.userService.createUser('bot@paradigm.com', 'Paradigm Trading Bot');
                user = await this.userService.getUserByEmail('bot@paradigm.com');
            }
            if (!user) {
                throw new Error('Failed to create or find user');
            }
            const session = await this.userService.createTradingSession(user.id, {
                mode: tradingConfig.mode,
                capital: tradingConfig.capital,
                status: 'active',
            });
            this.currentSessionId = session.id;
            logger_1.logger.info('📊 Trading session created:', session.id);
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize user session:', error);
            throw error;
        }
    }
    async start() {
        try {
            logger_1.logger.info('🚀 Starting trading bot...');
            if (!this.authManager) {
                throw new Error('Authentication manager not initialized');
            }
            const session = this.authManager.getSession();
            if (!session) {
                throw new Error('No active authentication session');
            }
            this.isRunning = true;
            logger_1.logger.info('✅ Trading bot started successfully');
            this.startTradingLoop();
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to start bot:', error);
            throw error;
        }
    }
    async startTradingLoop() {
        logger_1.logger.info('🔄 Starting trading loop...');
        while (this.isRunning) {
            try {
                await this.executeTradingCycle();
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
            catch (error) {
                logger_1.logger.error('❌ Error in trading loop:', error);
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }
    }
    async executeTradingCycle() {
        try {
            if (!this.currentSessionId) {
                throw new Error('No active trading session');
            }
            logger_1.logger.debug('📊 Executing trading cycle...');
            const marketData = await this.getMarketData();
            const activeStrategies = await this.strategyService.getActiveStrategies();
            for (const strategy of activeStrategies) {
                try {
                    const result = await this.strategyService.executeStrategy(strategy.name, marketData);
                    if (result.success && result.signals.length > 0) {
                        logger_1.logger.info(`📈 Strategy ${strategy.name} generated ${result.signals.length} signals`);
                        for (const signal of result.signals) {
                            await this.processSignal(signal, strategy.id);
                        }
                    }
                }
                catch (error) {
                    logger_1.logger.error(`❌ Error executing strategy ${strategy.name}:`, error);
                }
            }
            await this.updateOpenPositions();
        }
        catch (error) {
            logger_1.logger.error('❌ Error in trading cycle:', error);
        }
    }
    async getMarketData() {
        try {
            const instruments = await this.marketDataService.getAllInstruments();
            const marketData = [];
            for (const instrument of instruments) {
                const latestData = await this.marketDataService.getLatestMarketData(instrument.symbol);
                if (latestData) {
                    marketData.push({
                        symbol: instrument.symbol,
                        ltp: latestData.ltp,
                        open: latestData.open,
                        high: latestData.high,
                        low: latestData.low,
                        close: latestData.close,
                        volume: latestData.volume,
                        timestamp: latestData.timestamp,
                    });
                }
            }
            return marketData;
        }
        catch (error) {
            logger_1.logger.error('Failed to get market data:', error);
            return [];
        }
    }
    async processSignal(signal, strategyId) {
        try {
            if (!this.currentSessionId)
                return;
            logger_1.logger.info(`📊 Processing signal: ${signal.action} ${signal.symbol} at ${signal.price}`);
            const trade = await this.orderService.createTrade(this.currentSessionId, signal, strategyId);
            logger_1.logger.info(`✅ Trade created: ${trade.id}`);
        }
        catch (error) {
            logger_1.logger.error('Failed to process signal:', error);
        }
    }
    async updateOpenPositions() {
        try {
            if (!this.currentSessionId)
                return;
            const openPositions = await this.orderService.getOpenPositions(this.currentSessionId);
            for (const position of openPositions) {
                const latestData = await this.marketDataService.getLatestMarketData(position.instrument.symbol);
                if (latestData?.ltp) {
                    await this.orderService.updatePosition(position.id, {
                        currentPrice: latestData.ltp,
                        unrealizedPnL: this.calculateUnrealizedPnL(position, latestData.ltp),
                    });
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to update open positions:', error);
        }
    }
    calculateUnrealizedPnL(position, currentPrice) {
        const quantity = position.quantity;
        const averagePrice = position.averagePrice;
        const side = position.side;
        if (side === 'LONG') {
            return quantity * (currentPrice - averagePrice);
        }
        else {
            return quantity * (averagePrice - currentPrice);
        }
    }
    async stop() {
        try {
            logger_1.logger.info('🛑 Stopping trading bot...');
            this.isRunning = false;
            if (this.currentSessionId) {
                await this.userService.stopTradingSession(this.currentSessionId);
            }
            if (this.authManager) {
                await this.authManager.logout();
            }
            await this.databaseManager.disconnect();
            logger_1.logger.info('✅ Trading bot stopped successfully');
        }
        catch (error) {
            logger_1.logger.error('❌ Failed to stop bot:', error);
            throw error;
        }
    }
    async getStatus() {
        try {
            const session = this.authManager?.getSession();
            const currentSession = this.currentSessionId ? await this.userService.getTradingSession(this.currentSessionId) : null;
            const pnl = this.currentSessionId ? await this.orderService.getSessionPnL(this.currentSessionId) : null;
            return {
                isRunning: this.isRunning,
                authentication: {
                    isAuthenticated: !!session,
                    userId: session?.userId,
                    tokenExpiry: session?.tokenExpiryTime,
                },
                session: currentSession,
                pnl,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to get status:', error);
            return { error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
}
async function main() {
    const bot = new TradingBot();
    try {
        await bot.initialize();
        await bot.start();
        process.on('SIGINT', async () => {
            logger_1.logger.info('🛑 Received SIGINT, shutting down gracefully...');
            await bot.stop();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            logger_1.logger.info('🛑 Received SIGTERM, shutting down gracefully...');
            await bot.stop();
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.logger.error('💥 Fatal error in main:', error);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
exports.default = TradingBot;
//# sourceMappingURL=index.js.map