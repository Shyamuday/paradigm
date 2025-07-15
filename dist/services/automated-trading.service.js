"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomatedTradingService = void 0;
const events_1 = require("events");
const logger_1 = require("../logger/logger");
const auto_totp_example_1 = require("../auth/auto-totp-example");
const instruments_manager_service_1 = require("./instruments-manager.service");
const order_manager_service_1 = require("./order-manager.service");
const websocket_manager_service_1 = require("./websocket-manager.service");
const enhanced_strategy_service_1 = require("./enhanced-strategy.service");
const risk_service_1 = require("./risk.service");
const portfolio_service_1 = require("./portfolio.service");
const database_1 = require("../database/database");
class AutomatedTradingService extends events_1.EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.activeStrategies = new Map();
        this.activePositions = new Map();
        this.tradingSession = null;
        this.marketDataCache = new Map();
        this.lastSignalTime = new Map();
        this.auth = new auto_totp_example_1.AutoTOTPZerodhaAuth();
        this.instrumentsManager = new instruments_manager_service_1.InstrumentsManagerService();
        this.orderManager = new order_manager_service_1.OrderManagerService();
        this.websocketManager = new websocket_manager_service_1.WebSocketManagerService();
        this.strategyService = new enhanced_strategy_service_1.EnhancedStrategyService();
        this.riskService = new risk_service_1.RiskService();
        this.portfolioService = new portfolio_service_1.PortfolioService();
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.websocketManager.on('price_update', (data) => {
            this.handlePriceUpdate(data);
        });
        this.orderManager.on('order_filled', (order) => {
            this.handleOrderFilled(order);
        });
        this.orderManager.on('order_rejected', (order) => {
            this.handleOrderRejected(order);
        });
        this.riskService.on('risk_breach', (riskEvent) => {
            this.handleRiskBreach(riskEvent);
        });
        this.portfolioService.on('position_update', (position) => {
            this.handlePositionUpdate(position);
        });
    }
    async initialize(config) {
        try {
            logger_1.logger.info('Initializing Automated Trading Service...');
            this.tradingConfig = config;
            await this.auth.login();
            logger_1.logger.info('Authentication successful');
            await this.instrumentsManager.initialize();
            await this.orderManager.initialize();
            await this.websocketManager.initialize();
            await this.riskService.initialize();
            await this.portfolioService.initialize();
            this.tradingSession = await this.createTradingSession();
            await this.loadActiveStrategies();
            await this.setupMarketDataSubscriptions();
            logger_1.logger.info('Automated Trading Service initialized successfully');
            this.emit('initialized');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize trading service:', error);
            throw error;
        }
    }
    async startTrading() {
        if (this.isRunning) {
            logger_1.logger.warn('Trading service is already running');
            return;
        }
        try {
            logger_1.logger.info('Starting automated trading...');
            await this.performPreTradingChecks();
            await this.websocketManager.startStreaming();
            this.startStrategyExecutionLoop();
            this.startPositionMonitoring();
            this.startRiskMonitoring();
            this.isRunning = true;
            logger_1.logger.info('Automated trading started successfully');
            this.emit('trading_started');
        }
        catch (error) {
            logger_1.logger.error('Failed to start trading:', error);
            throw error;
        }
    }
    async stopTrading() {
        if (!this.isRunning) {
            logger_1.logger.warn('Trading service is not running');
            return;
        }
        try {
            logger_1.logger.info('Stopping automated trading...');
            this.isRunning = false;
            await this.websocketManager.stopStreaming();
            if (this.tradingConfig.autoExecute) {
                await this.closeAllPositions();
            }
            if (this.tradingSession) {
                await this.updateTradingSession();
            }
            logger_1.logger.info('Automated trading stopped successfully');
            this.emit('trading_stopped');
        }
        catch (error) {
            logger_1.logger.error('Failed to stop trading:', error);
            throw error;
        }
    }
    async performPreTradingChecks() {
        if (!this.isMarketOpen()) {
            throw new Error('Market is closed');
        }
        const balance = await this.portfolioService.getAccountBalance();
        if (balance < 10000) {
            throw new Error('Insufficient account balance');
        }
        const riskMetrics = await this.riskService.getCurrentRiskMetrics();
        if (riskMetrics.dailyLoss > this.tradingConfig.maxDailyLoss) {
            throw new Error('Daily loss limit exceeded');
        }
        logger_1.logger.info('Pre-trading checks passed');
    }
    startStrategyExecutionLoop() {
        const executeStrategies = async () => {
            if (!this.isRunning)
                return;
            try {
                for (const [strategyName, strategy] of this.activeStrategies) {
                    if (this.shouldExecuteStrategy(strategyName)) {
                        await this.executeStrategy(strategyName, strategy);
                    }
                }
            }
            catch (error) {
                logger_1.logger.error('Strategy execution error:', error);
            }
            setTimeout(executeStrategies, 5000);
        };
        executeStrategies();
    }
    startPositionMonitoring() {
        const monitorPositions = async () => {
            if (!this.isRunning)
                return;
            try {
                for (const [symbol, position] of this.activePositions) {
                    await this.monitorPosition(symbol, position);
                }
            }
            catch (error) {
                logger_1.logger.error('Position monitoring error:', error);
            }
            setTimeout(monitorPositions, 2000);
        };
        monitorPositions();
    }
    startRiskMonitoring() {
        const monitorRisk = async () => {
            if (!this.isRunning)
                return;
            try {
                await this.checkRiskLimits();
            }
            catch (error) {
                logger_1.logger.error('Risk monitoring error:', error);
            }
            setTimeout(monitorRisk, 10000);
        };
        monitorRisk();
    }
    async executeStrategy(strategyName, strategy) {
        try {
            logger_1.logger.info(`Executing strategy: ${strategyName}`);
            const symbols = strategy.config.symbols || this.tradingConfig.allowedSymbols;
            for (const symbol of symbols) {
                const marketData = this.marketDataCache.get(symbol) || [];
                if (marketData.length < 50)
                    continue;
                const result = await this.strategyService.executeStrategy(strategyName, marketData);
                if (result.success && result.signals.length > 0) {
                    for (const signal of result.signals) {
                        await this.processSignal(signal, strategy);
                    }
                }
            }
            this.lastSignalTime.set(strategyName, Date.now());
        }
        catch (error) {
            logger_1.logger.error(`Strategy execution failed for ${strategyName}:`, error);
        }
    }
    async processSignal(signal, strategy) {
        try {
            logger_1.logger.info(`Processing signal: ${signal.action} ${signal.symbol} at ${signal.price}`);
            const riskAdjustedSignal = await this.applyRiskManagement(signal, strategy);
            if (!riskAdjustedSignal) {
                logger_1.logger.warn('Signal rejected by risk management');
                return;
            }
            if (!this.canOpenNewPosition(signal)) {
                logger_1.logger.warn('Position limit exceeded, signal rejected');
                return;
            }
            const positionSize = await this.calculatePositionSize(riskAdjustedSignal);
            if (positionSize <= 0) {
                logger_1.logger.warn('Invalid position size, signal rejected');
                return;
            }
            riskAdjustedSignal.quantity = positionSize;
            if (this.tradingConfig.autoExecute && !this.tradingConfig.simulationMode) {
                await this.executeSignal(riskAdjustedSignal);
            }
            else {
                logger_1.logger.info('Signal would be executed:', riskAdjustedSignal);
                this.emit('signal_generated', riskAdjustedSignal);
            }
        }
        catch (error) {
            logger_1.logger.error('Signal processing error:', error);
        }
    }
    async executeSignal(signal) {
        try {
            const orderType = signal.action === 'BUY' ? 'BUY' : 'SELL';
            const order = await this.orderManager.placeOrder({
                symbol: signal.symbol,
                quantity: signal.quantity,
                price: signal.price,
                orderType: orderType,
                productType: 'MIS',
                validity: 'DAY',
                stopLoss: signal.stopLoss,
                target: signal.target
            });
            logger_1.logger.info(`Order placed: ${order.orderId} for ${signal.symbol}`);
            await this.trackSignal(signal, order);
            this.emit('order_placed', { signal, order });
        }
        catch (error) {
            logger_1.logger.error('Order execution error:', error);
            this.emit('order_failed', { signal, error: error.message });
        }
    }
    async handlePriceUpdate(data) {
        try {
            const symbol = data.instrument_token;
            const price = data.last_price;
            const volume = data.volume;
            const timestamp = new Date();
            const marketData = {
                symbol,
                ltp: price,
                volume,
                timestamp,
                high: data.ohlc?.high,
                low: data.ohlc?.low,
                open: data.ohlc?.open,
                close: data.ohlc?.close
            };
            this.updateMarketDataCache(symbol, marketData);
            await this.checkExitConditions(symbol, marketData);
            await this.portfolioService.updateMarketData(symbol, marketData);
        }
        catch (error) {
            logger_1.logger.error('Price update handling error:', error);
        }
    }
    async checkExitConditions(symbol, marketData) {
        const position = this.activePositions.get(symbol);
        if (!position)
            return;
        try {
            if (this.shouldTriggerStopLoss(position, marketData)) {
                await this.exitPosition(position, 'STOP_LOSS');
                return;
            }
            if (this.shouldTriggerTakeProfit(position, marketData)) {
                await this.exitPosition(position, 'TAKE_PROFIT');
                return;
            }
            const strategy = this.activeStrategies.get(position.strategyName);
            if (strategy) {
                const marketDataArray = this.marketDataCache.get(symbol) || [];
                const shouldExit = await strategy.shouldExit(position, marketDataArray);
                if (shouldExit) {
                    await this.exitPosition(position, 'STRATEGY_EXIT');
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Exit condition check error:', error);
        }
    }
    shouldTriggerStopLoss(position, marketData) {
        if (!position.stopLoss || !marketData.ltp)
            return false;
        if (position.side === 'LONG') {
            return marketData.ltp <= position.stopLoss;
        }
        else {
            return marketData.ltp >= position.stopLoss;
        }
    }
    shouldTriggerTakeProfit(position, marketData) {
        if (!position.target || !marketData.ltp)
            return false;
        if (position.side === 'LONG') {
            return marketData.ltp >= position.target;
        }
        else {
            return marketData.ltp <= position.target;
        }
    }
    async exitPosition(position, reason) {
        try {
            logger_1.logger.info(`Exiting position: ${position.symbol} - Reason: ${reason}`);
            const exitOrderType = position.side === 'LONG' ? 'SELL' : 'BUY';
            const order = await this.orderManager.placeOrder({
                symbol: position.symbol,
                quantity: position.quantity,
                orderType: exitOrderType,
                productType: 'MIS',
                validity: 'DAY',
                orderTag: `EXIT_${reason}`
            });
            logger_1.logger.info(`Exit order placed: ${order.orderId}`);
            position.status = 'CLOSING';
            position.exitReason = reason;
            this.emit('position_exiting', { position, order, reason });
        }
        catch (error) {
            logger_1.logger.error('Position exit error:', error);
        }
    }
    async handleOrderFilled(order) {
        try {
            logger_1.logger.info(`Order filled: ${order.orderId} for ${order.symbol}`);
            if (order.orderTag?.startsWith('EXIT_')) {
                await this.handleExitOrderFilled(order);
            }
            else {
                await this.handleEntryOrderFilled(order);
            }
            this.emit('order_filled', order);
        }
        catch (error) {
            logger_1.logger.error('Order filled handling error:', error);
        }
    }
    async handleEntryOrderFilled(order) {
        const position = {
            id: `pos_${Date.now()}`,
            symbol: order.symbol,
            side: order.orderType === 'BUY' ? 'LONG' : 'SHORT',
            quantity: order.quantity,
            entryPrice: order.price,
            currentPrice: order.price,
            unrealizedPnL: 0,
            realizedPnL: 0,
            status: 'OPEN',
            entryTime: new Date(),
            strategyName: order.strategyName || 'Unknown',
            stopLoss: order.stopLoss,
            target: order.target
        };
        this.activePositions.set(order.symbol, position);
        await this.portfolioService.addPosition(position);
        logger_1.logger.info(`Position opened: ${position.symbol} ${position.side} ${position.quantity}`);
    }
    async handleExitOrderFilled(order) {
        const position = this.activePositions.get(order.symbol);
        if (!position)
            return;
        const realizedPnL = this.calculateRealizedPnL(position, order.price);
        position.status = 'CLOSED';
        position.exitPrice = order.price;
        position.exitTime = new Date();
        position.realizedPnL = realizedPnL;
        this.activePositions.delete(order.symbol);
        await this.portfolioService.closePosition(position);
        logger_1.logger.info(`Position closed: ${position.symbol} PnL: ${realizedPnL}`);
    }
    calculateRealizedPnL(position, exitPrice) {
        const pnlPerUnit = position.side === 'LONG'
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;
        return pnlPerUnit * position.quantity;
    }
    async applyRiskManagement(signal, strategy) {
        try {
            const riskCheck = await this.riskService.validateSignal(signal);
            if (!riskCheck.valid) {
                logger_1.logger.warn(`Signal rejected by risk management: ${riskCheck.reason}`);
                return null;
            }
            const riskAdjustedSignal = { ...signal };
            if (!riskAdjustedSignal.stopLoss) {
                riskAdjustedSignal.stopLoss = this.calculateStopLoss(signal);
            }
            if (!riskAdjustedSignal.target) {
                riskAdjustedSignal.target = this.calculateTakeProfit(signal);
            }
            return riskAdjustedSignal;
        }
        catch (error) {
            logger_1.logger.error('Risk management error:', error);
            return null;
        }
    }
    calculateStopLoss(signal) {
        const stopLossPercentage = this.tradingConfig.riskManagement.stopLossPercentage || 2;
        if (signal.action === 'BUY') {
            return signal.price * (1 - stopLossPercentage / 100);
        }
        else {
            return signal.price * (1 + stopLossPercentage / 100);
        }
    }
    calculateTakeProfit(signal) {
        const takeProfitPercentage = this.tradingConfig.riskManagement.takeProfitPercentage || 4;
        if (signal.action === 'BUY') {
            return signal.price * (1 + takeProfitPercentage / 100);
        }
        else {
            return signal.price * (1 - takeProfitPercentage / 100);
        }
    }
    async calculatePositionSize(signal) {
        try {
            const accountBalance = await this.portfolioService.getAccountBalance();
            const riskAmount = accountBalance * (this.tradingConfig.maxRiskPerTrade / 100);
            const stopLossDistance = Math.abs(signal.price - (signal.stopLoss || 0));
            if (stopLossDistance <= 0)
                return 0;
            const positionSize = Math.floor(riskAmount / stopLossDistance);
            const minSize = 1;
            const maxSize = Math.floor(accountBalance * 0.1 / signal.price);
            return Math.max(minSize, Math.min(maxSize, positionSize));
        }
        catch (error) {
            logger_1.logger.error('Position size calculation error:', error);
            return 0;
        }
    }
    canOpenNewPosition(signal) {
        if (this.activePositions.size >= this.tradingConfig.maxPositions) {
            return false;
        }
        if (this.activePositions.has(signal.symbol)) {
            return false;
        }
        if (this.tradingConfig.allowedSymbols.length > 0) {
            if (!this.tradingConfig.allowedSymbols.includes(signal.symbol)) {
                return false;
            }
        }
        return true;
    }
    shouldExecuteStrategy(strategyName) {
        const lastExecution = this.lastSignalTime.get(strategyName) || 0;
        const timeSinceLastExecution = Date.now() - lastExecution;
        return timeSinceLastExecution > 60000;
    }
    isMarketOpen() {
        const now = new Date();
        const currentTime = now.getHours() * 100 + now.getMinutes();
        const startTime = parseInt(this.tradingConfig.tradingHours.start.replace(':', ''));
        const endTime = parseInt(this.tradingConfig.tradingHours.end.replace(':', ''));
        return currentTime >= startTime && currentTime <= endTime;
    }
    updateMarketDataCache(symbol, marketData) {
        const cache = this.marketDataCache.get(symbol) || [];
        cache.push(marketData);
        if (cache.length > 1000) {
            cache.shift();
        }
        this.marketDataCache.set(symbol, cache);
    }
    async loadActiveStrategies() {
        try {
            const strategies = await this.strategyService.getActiveStrategies();
            for (const strategy of strategies) {
                this.activeStrategies.set(strategy.name, strategy);
                logger_1.logger.info(`Loaded strategy: ${strategy.name}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to load active strategies:', error);
        }
    }
    async setupMarketDataSubscriptions() {
        const allSymbols = new Set();
        for (const [, strategy] of this.activeStrategies) {
            const symbols = strategy.config.symbols || this.tradingConfig.allowedSymbols;
            symbols.forEach((symbol) => allSymbols.add(symbol));
        }
        await this.websocketManager.subscribeToSymbols(Array.from(allSymbols));
    }
    async createTradingSession() {
        const session = {
            id: `session_${Date.now()}`,
            startTime: new Date(),
            endTime: null,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            maxDrawdown: 0,
            status: 'ACTIVE',
            config: this.tradingConfig
        };
        await database_1.db.tradingSession.create({
            data: session
        });
        return session;
    }
    async updateTradingSession() {
        if (!this.tradingSession)
            return;
        const stats = await this.getTradingStats();
        this.tradingSession.endTime = new Date();
        this.tradingSession.totalTrades = stats.totalTrades;
        this.tradingSession.winningTrades = stats.winningTrades;
        this.tradingSession.losingTrades = stats.losingTrades;
        this.tradingSession.totalPnL = stats.totalPnL;
        this.tradingSession.maxDrawdown = stats.maxDrawdown;
        this.tradingSession.status = 'COMPLETED';
        await database_1.db.tradingSession.update({
            where: { id: this.tradingSession.id },
            data: this.tradingSession
        });
    }
    async checkRiskLimits() {
        const stats = await this.getTradingStats();
        if (stats.dailyPnL < -this.tradingConfig.maxDailyLoss) {
            logger_1.logger.warn('Daily loss limit exceeded, stopping trading');
            await this.stopTrading();
            this.emit('risk_limit_exceeded', { type: 'daily_loss', value: stats.dailyPnL });
        }
        if (stats.maxDrawdown > this.tradingConfig.maxDrawdown) {
            logger_1.logger.warn('Maximum drawdown exceeded, stopping trading');
            await this.stopTrading();
            this.emit('risk_limit_exceeded', { type: 'max_drawdown', value: stats.maxDrawdown });
        }
    }
    async closeAllPositions() {
        logger_1.logger.info('Closing all open positions...');
        const promises = Array.from(this.activePositions.values()).map(position => this.exitPosition(position, 'MANUAL_EXIT'));
        await Promise.all(promises);
    }
    async trackSignal(signal, order) {
        await database_1.db.signal.create({
            data: {
                id: signal.id,
                symbol: signal.symbol,
                action: signal.action,
                quantity: signal.quantity,
                price: signal.price,
                stopLoss: signal.stopLoss,
                target: signal.target,
                strategy: signal.strategy,
                orderId: order.orderId,
                timestamp: signal.timestamp,
                metadata: signal.metadata
            }
        });
    }
    async getTradingStats() {
        return {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalPnL: 0,
            winRate: 0,
            avgWin: 0,
            avgLoss: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            currentPositions: this.activePositions.size,
            dailyPnL: 0
        };
    }
    async addStrategy(config) {
        const strategy = await this.strategyService.createStrategy(config);
        this.activeStrategies.set(strategy.name, strategy);
        logger_1.logger.info(`Strategy added: ${strategy.name}`);
    }
    async removeStrategy(strategyName) {
        this.activeStrategies.delete(strategyName);
        logger_1.logger.info(`Strategy removed: ${strategyName}`);
    }
    getActivePositions() {
        return Array.from(this.activePositions.values());
    }
    getActiveStrategies() {
        return Array.from(this.activeStrategies.keys());
    }
    isRunning() {
        return this.isRunning;
    }
    async handleOrderRejected(order) {
        logger_1.logger.error(`Order rejected: ${order.orderId} - ${order.reason}`);
        this.emit('order_rejected', order);
    }
    async handleRiskBreach(riskEvent) {
        logger_1.logger.warn(`Risk breach detected: ${riskEvent.type} - ${riskEvent.message}`);
        if (riskEvent.severity === 'HIGH') {
            await this.stopTrading();
        }
        this.emit('risk_breach', riskEvent);
    }
    async handlePositionUpdate(position) {
        this.activePositions.set(position.symbol, position);
        this.emit('position_updated', position);
    }
    async monitorPosition(symbol, position) {
        const currentPrice = this.marketDataCache.get(symbol)?.[0]?.ltp;
        if (!currentPrice)
            return;
        const unrealizedPnL = this.calculateUnrealizedPnL(position, currentPrice);
        position.unrealizedPnL = unrealizedPnL;
        position.currentPrice = currentPrice;
        if (Math.abs(unrealizedPnL) > position.entryPrice * 0.05) {
            this.emit('significant_pnl_change', { position, unrealizedPnL });
        }
    }
    calculateUnrealizedPnL(position, currentPrice) {
        const pnlPerUnit = position.side === 'LONG'
            ? currentPrice - position.entryPrice
            : position.entryPrice - currentPrice;
        return pnlPerUnit * position.quantity;
    }
}
exports.AutomatedTradingService = AutomatedTradingService;
//# sourceMappingURL=automated-trading.service.js.map