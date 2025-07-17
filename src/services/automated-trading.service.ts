import { EventEmitter } from 'events';
import { logger } from '../logger/logger';
import { ZerodhaAuth } from '../auth/zerodha-auth';
import { InstrumentsManager } from './instruments-manager.service';
import { OrderManagerService } from './order-manager.service';
import { WebSocketManager } from './websocket-manager.service';
import { StrategyService } from './strategy.service';
import { RiskService } from './risk.service';
import { PortfolioService } from './portfolio.service';
import { db } from '../database/database';
import {
    MarketData,
    TradeSignal,
    Position,
    StrategyConfig,
    TradingSession,
    RiskManagementConfig,
    OrderType,
    OrderStatus
} from '../types';

export interface TradingConfig {
    maxPositions: number;
    maxRiskPerTrade: number;
    maxDailyLoss: number;
    maxDrawdown: number;
    autoExecute: boolean;
    simulationMode: boolean;
    allowedSymbols: string[];
    tradingHours: {
        start: string;
        end: string;
    };
    riskManagement: RiskManagementConfig;
}

export interface TradingStats {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnL: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
    sharpeRatio: number;
    currentPositions: number;
    dailyPnL: number;
}

export class AutomatedTradingService extends EventEmitter {
    private auth: ZerodhaAuth;
    private instrumentsManager!: InstrumentsManager;
    private orderManager!: OrderManagerService;
    private websocketManager!: WebSocketManager;
    private strategyService!: StrategyService;
    private riskService!: RiskService;
    private portfolioService!: PortfolioService;

    private running: boolean = false;
    private tradingConfig!: TradingConfig;
    private activeStrategies: Map<string, any> = new Map();
    private activePositions: Map<string, Position> = new Map();
    private tradingSession: TradingSession | null = null;
    private marketDataCache: Map<string, MarketData[]> = new Map();
    private lastSignalTime: Map<string, number> = new Map();

    constructor() {
        super();
        this.auth = new ZerodhaAuth();
        this.instrumentsManager = new InstrumentsManager(this.auth);
        this.orderManager = new OrderManagerService(this.auth, this.instrumentsManager);
        this.websocketManager = new WebSocketManager(this.auth);
        this.strategyService = new StrategyService();
        this.riskService = new RiskService();
        this.portfolioService = new PortfolioService();

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        // WebSocket price updates
        this.websocketManager.on('ticks', (data: MarketData[]) => {
            this.handlePriceUpdate(data);
        });

        // Order execution events
        if (this.orderManager instanceof EventEmitter) {
            this.orderManager.on('order_filled', (order: any) => {
                this.handleOrderFilled(order);
            });

            this.orderManager.on('order_rejected', (order: any) => {
                this.handleOrderRejected(order);
            });
        }

        // Risk management events
        if (this.riskService instanceof EventEmitter) {
            this.riskService.on('risk_breach', (riskEvent: any) => {
                this.handleRiskBreach(riskEvent);
            });
        }

        // Portfolio updates
        if (this.portfolioService instanceof EventEmitter) {
            this.portfolioService.on('position_update', (position: Position) => {
                this.handlePositionUpdate(position);
            });
        }
    }

    async initialize(config: TradingConfig): Promise<void> {
        try {
            logger.info('Initializing Automated Trading Service...');

            this.tradingConfig = config;

            // Initialize authentication if no valid session
            if (!this.auth.checkSession()) {
                await this.auth.startOAuthLogin();
            }
            logger.info('Authentication successful');

            // Create trading session
            this.tradingSession = await this.createTradingSession();

            // Load active strategies
            await this.loadActiveStrategies();

            // Setup market data subscriptions
            await this.setupMarketDataSubscriptions();

            logger.info('Automated Trading Service initialized successfully');
            this.emit('initialized');

        } catch (error) {
            logger.error('Failed to initialize trading service:', error);
            throw error;
        }
    }

    async startTrading(): Promise<void> {
        if (this.running) {
            logger.warn('Trading service is already running');
            return;
        }

        try {
            logger.info('Starting automated trading...');

            // Pre-trading checks
            await this.performPreTradingChecks();

            // Start market data streaming
            await this.websocketManager.startStreaming();

            // Start strategy execution loop
            this.startStrategyExecutionLoop();

            // Start position monitoring
            this.startPositionMonitoring();

            // Start risk monitoring
            this.startRiskMonitoring();

            this.running = true;
            logger.info('Automated trading started successfully');
            this.emit('trading_started');

        } catch (error) {
            logger.error('Failed to start trading:', error);
            throw error;
        }
    }

    async stopTrading(): Promise<void> {
        if (!this.running) {
            logger.warn('Trading service is not running');
            return;
        }

        try {
            logger.info('Stopping automated trading...');

            this.running = false;

            // Stop market data streaming
            await this.websocketManager.stopStreaming();

            // Close all open positions if configured
            if (this.tradingConfig.autoExecute) {
                await this.closeAllPositions();
            }

            // Update trading session
            if (this.tradingSession) {
                await this.updateTradingSession();
            }

            logger.info('Automated trading stopped successfully');
            this.emit('trading_stopped');

        } catch (error) {
            logger.error('Failed to stop trading:', error);
            throw error;
        }
    }

    private async performPreTradingChecks(): Promise<void> {
        // Check market hours
        if (!this.isMarketOpen()) {
            throw new Error('Market is closed');
        }

        // Check account balance
        const balance = await this.portfolioService.getAccountBalance();
        if (balance < 10000) { // Minimum balance check
            throw new Error('Insufficient account balance');
        }

        // Check risk limits
        const riskMetrics = await this.riskService.getCurrentRiskMetrics();
        if (riskMetrics.dailyLoss > this.tradingConfig.maxDailyLoss) {
            throw new Error('Daily loss limit exceeded');
        }

        logger.info('Pre-trading checks passed');
    }

    private startStrategyExecutionLoop(): void {
        const executeStrategies = async () => {
            if (!this.running) return;

            try {
                for (const [strategyName, strategy] of this.activeStrategies) {
                    if (this.shouldExecuteStrategy(strategyName)) {
                        await this.executeStrategy(strategyName, strategy);
                    }
                }
            } catch (error) {
                logger.error('Strategy execution error:', error);
            }

            // Schedule next execution
            setTimeout(executeStrategies, 5000); // Execute every 5 seconds
        };

        executeStrategies();
    }

    private startPositionMonitoring(): void {
        const monitorPositions = async () => {
            if (!this.running) return;

            try {
                for (const [symbol, position] of this.activePositions) {
                    await this.monitorPosition(symbol, position);
                }
            } catch (error) {
                logger.error('Position monitoring error:', error);
            }

            // Schedule next monitoring
            setTimeout(monitorPositions, 2000); // Monitor every 2 seconds
        };

        monitorPositions();
    }

    private startRiskMonitoring(): void {
        const monitorRisk = async () => {
            if (!this.running) return;

            try {
                await this.checkRiskLimits();
            } catch (error) {
                logger.error('Risk monitoring error:', error);
            }

            // Schedule next monitoring
            setTimeout(monitorRisk, 10000); // Monitor every 10 seconds
        };

        monitorRisk();
    }

    private async executeStrategy(strategyName: string, strategy: any): Promise<void> {
        try {
            logger.info(`Executing strategy: ${strategyName}`);

            // Get symbols for this strategy
            const symbols = strategy.config.symbols || this.tradingConfig.allowedSymbols;

            for (const symbol of symbols) {
                // Get market data
                const marketData = this.marketDataCache.get(symbol) || [];
                if (marketData.length < 50) continue; // Need enough data

                // Generate signals
                const result = await this.strategyService.executeStrategy(strategyName, marketData);

                if (result.success && result.signals.length > 0) {
                    for (const signal of result.signals) {
                        await this.processSignal(signal, strategy);
                    }
                }
            }

            this.lastSignalTime.set(strategyName, Date.now());

        } catch (error) {
            logger.error(`Strategy execution failed for ${strategyName}:`, error);
        }
    }

    private async processSignal(signal: TradeSignal, strategy: any): Promise<void> {
        try {
            logger.info(`Processing signal: ${signal.action} ${signal.symbol} at ${signal.price}`);

            // Apply risk management
            const riskAdjustedSignal = await this.applyRiskManagement(signal, strategy);
            if (!riskAdjustedSignal) {
                logger.warn('Signal rejected by risk management');
                return;
            }

            // Check position limits
            if (!this.canOpenNewPosition(signal)) {
                logger.warn('Position limit exceeded, signal rejected');
                return;
            }

            // Calculate position size
            const positionSize = await this.calculatePositionSize(riskAdjustedSignal);
            if (positionSize <= 0) {
                logger.warn('Invalid position size, signal rejected');
                return;
            }

            riskAdjustedSignal.quantity = positionSize;

            // Execute trade if auto-execute is enabled
            if (this.tradingConfig.autoExecute && !this.tradingConfig.simulationMode) {
                await this.executeSignal(riskAdjustedSignal);
            } else {
                logger.info('Signal would be executed:', riskAdjustedSignal);
                this.emit('signal_generated', riskAdjustedSignal);
            }

        } catch (error) {
            logger.error('Signal processing error:', error);
        }
    }

    private async executeSignal(signal: TradeSignal): Promise<void> {
        try {
            const orderType: OrderType = signal.action === 'BUY' ? 'BUY' : 'SELL';

            // Place main order
            const order = await this.orderManager.placeOrder({
                symbol: signal.symbol,
                quantity: signal.quantity,
                price: signal.price,
                orderType: orderType,
                productType: 'MIS', // Intraday
                validity: 'DAY',
                stopLoss: signal.stopLoss,
                target: signal.target
            });

            logger.info(`Order placed: ${order.orderId} for ${signal.symbol}`);

            // Track the signal
            await this.trackSignal(signal, order);

            this.emit('order_placed', { signal, order });

        } catch (error) {
            logger.error('Order execution error:', error);
            this.emit('order_failed', { signal, error: error.message });
        }
    }

    private async handlePriceUpdate(data: MarketData[]): Promise<void> {
        try {
            const symbol = data[0].symbol;
            const price = data[0].ltp;
            const volume = data[0].volume;
            const timestamp = new Date();

            // Update market data cache
            const marketData: MarketData = {
                symbol,
                ltp: price,
                volume,
                timestamp,
                high: data[0].high,
                low: data[0].low,
                open: data[0].open,
                close: data[0].close
            };

            this.updateMarketDataCache(symbol, marketData);

            // Check for exit conditions on active positions
            await this.checkExitConditions(symbol, marketData);

            // Update portfolio
            await this.portfolioService.updateMarketData(symbol, marketData);

        } catch (error) {
            logger.error('Price update handling error:', error);
        }
    }

    private async checkExitConditions(symbol: string, marketData: MarketData): Promise<void> {
        const position = this.activePositions.get(symbol);
        if (!position) return;

        try {
            // Check stop loss
            if (this.shouldTriggerStopLoss(position, marketData)) {
                await this.exitPosition(position, 'STOP_LOSS');
                return;
            }

            // Check take profit
            if (this.shouldTriggerTakeProfit(position, marketData)) {
                await this.exitPosition(position, 'TAKE_PROFIT');
                return;
            }

            // Check strategy exit conditions
            const strategy = this.activeStrategies.get(position.strategyName);
            if (strategy) {
                const marketDataArray = this.marketDataCache.get(symbol) || [];
                const shouldExit = await strategy.shouldExit(position, marketDataArray);
                if (shouldExit) {
                    await this.exitPosition(position, 'STRATEGY_EXIT');
                }
            }

        } catch (error) {
            logger.error('Exit condition check error:', error);
        }
    }

    private shouldTriggerStopLoss(position: Position, marketData: MarketData): boolean {
        if (!position.stopLoss || !marketData.ltp) return false;

        if (position.side === 'LONG') {
            return marketData.ltp <= position.stopLoss;
        } else {
            return marketData.ltp >= position.stopLoss;
        }
    }

    private shouldTriggerTakeProfit(position: Position, marketData: MarketData): boolean {
        if (!position.target || !marketData.ltp) return false;

        if (position.side === 'LONG') {
            return marketData.ltp >= position.target;
        } else {
            return marketData.ltp <= position.target;
        }
    }

    private async exitPosition(position: Position, reason: string): Promise<void> {
        try {
            logger.info(`Exiting position: ${position.symbol} - Reason: ${reason}`);

            const exitOrderType: OrderType = position.side === 'LONG' ? 'SELL' : 'BUY';

            const order = await this.orderManager.placeOrder({
                symbol: position.symbol,
                quantity: position.quantity,
                orderType: exitOrderType,
                productType: 'MIS',
                validity: 'DAY',
                orderTag: `EXIT_${reason}`
            });

            logger.info(`Exit order placed: ${order.orderId}`);

            // Update position status
            position.status = 'CLOSING';
            position.exitReason = reason;

            this.emit('position_exiting', { position, order, reason });

        } catch (error) {
            logger.error('Position exit error:', error);
        }
    }

    private async handleOrderFilled(order: any): Promise<void> {
        try {
            logger.info(`Order filled: ${order.orderId} for ${order.symbol}`);

            // Update position
            if (order.orderTag?.startsWith('EXIT_')) {
                // Handle exit order
                await this.handleExitOrderFilled(order);
            } else {
                // Handle entry order
                await this.handleEntryOrderFilled(order);
            }

            this.emit('order_filled', order);

        } catch (error) {
            logger.error('Order filled handling error:', error);
        }
    }

    private async handleEntryOrderFilled(order: any): Promise<void> {
        // Create position
        const position: Position = {
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

        // Update portfolio
        await this.portfolioService.addPosition(position);

        logger.info(`Position opened: ${position.symbol} ${position.side} ${position.quantity}`);
    }

    private async handleExitOrderFilled(order: any): Promise<void> {
        const position = this.activePositions.get(order.symbol);
        if (!position) return;

        // Calculate realized PnL
        const realizedPnL = this.calculateRealizedPnL(position, order.price);

        // Update position
        position.status = 'CLOSED';
        position.exitPrice = order.price;
        position.exitTime = new Date();
        position.realizedPnL = realizedPnL;

        // Remove from active positions
        this.activePositions.delete(order.symbol);

        // Update portfolio
        await this.portfolioService.closePosition(position);

        logger.info(`Position closed: ${position.symbol} PnL: ${realizedPnL}`);
    }

    private calculateRealizedPnL(position: Position, exitPrice: number): number {
        const pnlPerUnit = position.side === 'LONG'
            ? exitPrice - position.entryPrice
            : position.entryPrice - exitPrice;

        return pnlPerUnit * position.quantity;
    }

    private async applyRiskManagement(signal: TradeSignal, strategy: any): Promise<TradeSignal | null> {
        try {
            // Check if signal violates risk rules
            const riskCheck = await this.riskService.validateSignal(signal);
            if (!riskCheck.valid) {
                logger.warn(`Signal rejected by risk management: ${riskCheck.reason}`);
                return null;
            }

            // Apply risk management parameters
            const riskAdjustedSignal = { ...signal };

            // Set stop loss if not already set
            if (!riskAdjustedSignal.stopLoss) {
                riskAdjustedSignal.stopLoss = this.calculateStopLoss(signal);
            }

            // Set take profit if not already set
            if (!riskAdjustedSignal.target) {
                riskAdjustedSignal.target = this.calculateTakeProfit(signal);
            }

            return riskAdjustedSignal;

        } catch (error) {
            logger.error('Risk management error:', error);
            return null;
        }
    }

    private calculateStopLoss(signal: TradeSignal): number {
        const stopLossPercentage = this.tradingConfig.riskManagement.stopLossPercentage || 2;

        if (signal.action === 'BUY') {
            return signal.price * (1 - stopLossPercentage / 100);
        } else {
            return signal.price * (1 + stopLossPercentage / 100);
        }
    }

    private calculateTakeProfit(signal: TradeSignal): number {
        const takeProfitPercentage = this.tradingConfig.riskManagement.takeProfitPercentage || 4;

        if (signal.action === 'BUY') {
            return signal.price * (1 + takeProfitPercentage / 100);
        } else {
            return signal.price * (1 - takeProfitPercentage / 100);
        }
    }

    private async calculatePositionSize(signal: TradeSignal): Promise<number> {
        try {
            const accountBalance = await this.portfolioService.getAccountBalance();
            const riskAmount = accountBalance * (this.tradingConfig.maxRiskPerTrade / 100);

            const stopLossDistance = Math.abs(signal.price - (signal.stopLoss || 0));
            if (stopLossDistance <= 0) return 0;

            const positionSize = Math.floor(riskAmount / stopLossDistance);

            // Apply minimum and maximum position size limits
            const minSize = 1;
            const maxSize = Math.floor(accountBalance * 0.1 / signal.price); // Max 10% of account

            return Math.max(minSize, Math.min(maxSize, positionSize));

        } catch (error) {
            logger.error('Position size calculation error:', error);
            return 0;
        }
    }

    private canOpenNewPosition(signal: TradeSignal): boolean {
        // Check maximum positions limit
        if (this.activePositions.size >= this.tradingConfig.maxPositions) {
            return false;
        }

        // Check if already have position in this symbol
        if (this.activePositions.has(signal.symbol)) {
            return false;
        }

        // Check allowed symbols
        if (this.tradingConfig.allowedSymbols.length > 0) {
            if (!this.tradingConfig.allowedSymbols.includes(signal.symbol)) {
                return false;
            }
        }

        return true;
    }

    private shouldExecuteStrategy(strategyName: string): boolean {
        const lastExecution = this.lastSignalTime.get(strategyName) || 0;
        const timeSinceLastExecution = Date.now() - lastExecution;

        // Execute strategy at most once per minute
        return timeSinceLastExecution > 60000;
    }

    private isMarketOpen(): boolean {
        const now = new Date();
        const currentTime = now.getHours() * 100 + now.getMinutes();

        const startTime = parseInt(this.tradingConfig.tradingHours.start.replace(':', ''));
        const endTime = parseInt(this.tradingConfig.tradingHours.end.replace(':', ''));

        return currentTime >= startTime && currentTime <= endTime;
    }

    private updateMarketDataCache(symbol: string, marketData: MarketData): void {
        const cache = this.marketDataCache.get(symbol) || [];
        cache.push(marketData);

        // Keep only last 1000 data points
        if (cache.length > 1000) {
            cache.shift();
        }

        this.marketDataCache.set(symbol, cache);
    }

    private async loadActiveStrategies(): Promise<void> {
        try {
            const strategies = await this.strategyService.getActiveStrategies();

            for (const strategy of strategies) {
                this.activeStrategies.set(strategy.name, strategy);
                logger.info(`Loaded strategy: ${strategy.name}`);
            }

        } catch (error) {
            logger.error('Failed to load active strategies:', error);
        }
    }

    private async setupMarketDataSubscriptions(): Promise<void> {
        // Subscribe to market data for all symbols in active strategies
        const allSymbols = new Set<string>();

        for (const [, strategy] of this.activeStrategies) {
            const symbols = strategy.config.symbols || this.tradingConfig.allowedSymbols;
            symbols.forEach((symbol: string) => allSymbols.add(symbol));
        }

        await this.websocketManager.subscribeToSymbols(Array.from(allSymbols));
    }

    private async createTradingSession(): Promise<TradingSession> {
        const session: TradingSession = {
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

        // Save to database
        await db.tradingSession.create({
            data: session as any
        });

        return session;
    }

    private async updateTradingSession(): Promise<void> {
        if (!this.tradingSession) return;

        const stats = await this.getTradingStats();

        this.tradingSession.endTime = new Date();
        this.tradingSession.totalTrades = stats.totalTrades;
        this.tradingSession.winningTrades = stats.winningTrades;
        this.tradingSession.losingTrades = stats.losingTrades;
        this.tradingSession.totalPnL = stats.totalPnL;
        this.tradingSession.maxDrawdown = stats.maxDrawdown;
        this.tradingSession.status = 'COMPLETED';

        await db.tradingSession.update({
            where: { id: this.tradingSession.id },
            data: this.tradingSession as any
        });
    }

    private async checkRiskLimits(): Promise<void> {
        const stats = await this.getTradingStats();

        // Check daily loss limit
        if (stats.dailyPnL < -this.tradingConfig.maxDailyLoss) {
            logger.warn('Daily loss limit exceeded, stopping trading');
            await this.stopTrading();
            this.emit('risk_limit_exceeded', { type: 'daily_loss', value: stats.dailyPnL });
        }

        // Check maximum drawdown
        if (stats.maxDrawdown > this.tradingConfig.maxDrawdown) {
            logger.warn('Maximum drawdown exceeded, stopping trading');
            await this.stopTrading();
            this.emit('risk_limit_exceeded', { type: 'max_drawdown', value: stats.maxDrawdown });
        }
    }

    private async closeAllPositions(): Promise<void> {
        logger.info('Closing all open positions...');

        const promises = Array.from(this.activePositions.values()).map(position =>
            this.exitPosition(position, 'MANUAL_EXIT')
        );

        await Promise.all(promises);
    }

    private async trackSignal(signal: TradeSignal, order: any): Promise<void> {
        await db.signal.create({
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

    async getTradingStats(): Promise<TradingStats> {
        // Implementation would calculate real-time trading statistics
        // This is a simplified version
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

    // Public methods for external control
    async addStrategy(config: StrategyConfig): Promise<void> {
        const strategy = await this.strategyService.createStrategy(config);
        this.activeStrategies.set(strategy.name, strategy);
        logger.info(`Strategy added: ${strategy.name}`);
    }

    async removeStrategy(strategyName: string): Promise<void> {
        this.activeStrategies.delete(strategyName);
        logger.info(`Strategy removed: ${strategyName}`);
    }

    getActivePositions(): Position[] {
        return Array.from(this.activePositions.values());
    }

    getActiveStrategies(): string[] {
        return Array.from(this.activeStrategies.keys());
    }

    isRunning(): boolean {
        return this.running;
    }

    private async handleOrderRejected(order: any): Promise<void> {
        logger.error(`Order rejected: ${order.orderId} - ${order.reason}`);
        this.emit('order_rejected', order);
    }

    private async handleRiskBreach(riskEvent: any): Promise<void> {
        logger.warn(`Risk breach detected: ${riskEvent.type} - ${riskEvent.message}`);

        if (riskEvent.severity === 'HIGH') {
            await this.stopTrading();
        }

        this.emit('risk_breach', riskEvent);
    }

    private async handlePositionUpdate(position: Position): Promise<void> {
        this.activePositions.set(position.symbol, position);
        this.emit('position_updated', position);
    }

    private async monitorPosition(symbol: string, position: Position): Promise<void> {
        const currentPrice = this.marketDataCache.get(symbol)?.[0]?.ltp;
        if (!currentPrice) return;

        // Update unrealized PnL
        const unrealizedPnL = this.calculateUnrealizedPnL(position, currentPrice);
        position.unrealizedPnL = unrealizedPnL;
        position.currentPrice = currentPrice;

        // Check for significant PnL changes
        if (Math.abs(unrealizedPnL) > position.entryPrice * 0.05) { // 5% change
            this.emit('significant_pnl_change', { position, unrealizedPnL });
        }
    }

    private calculateUnrealizedPnL(position: Position, currentPrice: number): number {
        const pnlPerUnit = position.side === 'LONG'
            ? currentPrice - position.entryPrice
            : position.entryPrice - currentPrice;

        return pnlPerUnit * position.quantity;
    }
} 