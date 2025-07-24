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
    OrderType
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
    private kite!: any;
    private instrumentsManager!: InstrumentsManager;
    private orderManager!: OrderManagerService;
    private websocketManager!: WebSocketManager;
    private strategyService!: StrategyService;
    private riskService!: RiskService;
    private portfolioService!: PortfolioService;
    private marketDataService!: any;
    private orderService!: any;

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
        // KiteConnect instance will be set after authentication
        // Other services will be initialized in initialize()
        this.setupEventHandlers = this.setupEventHandlers.bind(this);
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
            if (!(await this.auth.hasValidSession())) {
                await this.auth.startOAuthLogin();
            }
            logger.info('Authentication successful');

            // Get KiteConnect instance
            this.kite = this.auth.getKite();

            // Initialize dependent services
            this.marketDataService = new (require('./market-data.service').MarketDataService)(this.instrumentsManager, this.kite);
            this.orderService = new (require('./order.service').OrderService)();
            this.instrumentsManager = new InstrumentsManager(this.auth);
            // tradingSession is created below, so orderManager will be initialized after tradingSession is set
            this.websocketManager = new WebSocketManager(this.kite);
            this.strategyService = new StrategyService(new (require('../config/config-manager').ConfigManager)());
            this.riskService = new RiskService();
            this.portfolioService = new PortfolioService(this.kite, this.marketDataService, this.orderService);

            this.setupEventHandlers();

            // Create trading session
            this.tradingSession = await this.createTradingSession();
            this.orderManager = new OrderManagerService(this.kite, this.tradingSession.id);

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
            this.websocketManager.connect();

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
            this.websocketManager.disconnect();

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

        // TODO: Implement account balance check using portfolio metrics
        // const metrics = await this.portfolioService.getPortfolioMetrics(sessionId);
        // if (metrics.totalValue < 10000) throw new Error('Insufficient account balance');

        // TODO: Implement risk metrics check using riskService.getRiskMetrics
        // const riskMetrics = await this.riskService.getRiskMetrics(sessionId, startDate, endDate);
        // if (riskMetrics[0]?.dailyPnL > this.tradingConfig.maxDailyLoss) throw new Error('Daily loss limit exceeded');

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

                // Map MarketData to required type (ensure no nulls for required fields)
                const mappedMarketData = marketData.map(md => ({
                    ...md,
                    open: md.open ?? 0,
                    high: md.high ?? 0,
                    low: md.low ?? 0,
                    close: md.close ?? 0,
                    volume: md.volume ?? 0,
                    ltp: md.ltp ?? 0,
                    change: md.change ?? 0,
                    changePercent: md.changePercent ?? 0
                }));

                // Generate signals
                const result = await this.strategyService.executeStrategy(strategyName, mappedMarketData);

                if (result.success && result.signals.length > 0) {
                    for (const signal of result.signals) {
                        // Ensure TradeSignal has required properties
                        const tempSignal: any = {
                            id: (signal as any).id ?? `signal_${Date.now()}`,
                            strategy: (signal as any).strategy ?? strategyName,
                            symbol: signal.symbol,
                            action: signal.action,
                            quantity: (signal as any).quantity ?? 1,
                            price: (signal as any).price ?? 0,
                            timestamp: (signal as any).timestamp ?? new Date(),
                            metadata: (signal as any).metadata ?? {}
                        };
                        if (typeof (signal as any).stopLoss === 'number') tempSignal.stopLoss = (signal as any).stopLoss;
                        if (typeof (signal as any).target === 'number') tempSignal.target = (signal as any).target;
                        const fullSignal = tempSignal as TradeSignal;
                        await this.processSignal(fullSignal, strategy);
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
            // Use 'MARKET' as default OrderType
            const orderType: OrderType = 'MARKET';

            const orderId = await this.orderManager.placeOrder(signal);
            logger.info(`Order placed: ${orderId} for ${signal.symbol}`);

            // Track the signal
            await this.trackSignal(signal, orderId);

            this.emit('order_placed', { signal, order: orderId });

        } catch (error) {
            logger.error('Order execution error:', error);
            this.emit('order_failed', { signal, error: error instanceof Error ? error.message : String(error) });
        }
    }

    private async handlePriceUpdate(data: MarketData[]): Promise<void> {
        try {
            if (!data || data.length === 0) return;
            const symbol = data[0]?.symbol ?? '';
            const price = data[0]?.ltp ?? 0;
            const volume = data[0]?.volume ?? 0;
            const timestamp = new Date();

            // Update market data cache
            const marketData: MarketData = {
                id: `md_${Date.now()}`,
                instrumentId: '', // TODO: Fill with actual instrumentId
                instrument: {} as any, // TODO: Fill with actual instrument object
                symbol,
                timestamp,
                open: data[0]?.open ?? null,
                high: data[0]?.high ?? null,
                low: data[0]?.low ?? null,
                close: data[0]?.close ?? null,
                volume: data[0]?.volume ?? null,
                ltp: data[0]?.ltp ?? null,
                change: data[0]?.change ?? null,
                changePercent: data[0]?.changePercent ?? null
            };

            this.updateMarketDataCache(symbol, marketData);

            // Check for exit conditions on active positions
            await this.checkExitConditions(symbol, marketData);

            // TODO: Implement updateMarketData logic in PortfolioService or handle market data tracking here
        } catch (error) {
            logger.error('Price update handling error:', error instanceof Error ? error.message : String(error));
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
                if (typeof strategy.shouldExit === 'function') {
                    const shouldExit = await strategy.shouldExit(position, marketDataArray);
                    if (shouldExit) {
                        await this.exitPosition(position, 'STRATEGY_EXIT');
                    }
                }
            }

        } catch (error) {
            logger.error('Exit condition check error:', error instanceof Error ? error.message : String(error));
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

            const exitOrderType: OrderType = 'MARKET';

            const exitSignal: TradeSignal = {
                id: `exit_${Date.now()}`,
                strategy: position.strategyName,
                symbol: position.symbol,
                action: position.side === 'LONG' ? 'SELL' : 'BUY',
                quantity: position.quantity,
                price: position.currentPrice ?? 0,
                stopLoss: position.stopLoss ?? undefined,
                target: position.target ?? undefined,
                timestamp: new Date(),
                metadata: { exitReason: reason }
            };
            const orderId = await this.orderManager.placeOrder(exitSignal);
            logger.info(`Exit order placed: ${orderId}`);

            // Update position status
            position.status = 'CLOSING';
            position.exitReason = reason;

            this.emit('position_exiting', { position, order: orderId, reason });

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
            sessionId: this.tradingSession?.id || 'session_' + Date.now(),
            instrumentId: order.instrumentId || 'instrument_' + Date.now(),
            instrument: {
                id: order.instrumentId || 'instrument_' + Date.now(),
                symbol: order.symbol,
                name: order.symbol,
                exchange: 'NSE',
                instrumentType: 'EQ',
                lotSize: 1,
                tickSize: 0.01,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            symbol: order.symbol,
            quantity: order.quantity,
            averagePrice: order.price,
            entryPrice: order.price,
            currentPrice: order.price,
            side: order.orderType === 'BUY' ? 'LONG' : 'SHORT',
            stopLoss: order.stopLoss || null,
            target: order.target || null,
            trailingStop: false,
            unrealizedPnL: 0,
            realizedPnL: 0,
            openTime: new Date(),
            closeTime: null,
            entryTime: new Date(),
            status: 'OPEN',
            strategyName: order.strategyName || 'Unknown'
        };

        this.activePositions.set(order.symbol, position);

        // TODO: Implement addPosition logic in PortfolioService or handle position tracking here

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

        // TODO: Implement closePosition logic in PortfolioService or handle position tracking here

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
            // TODO: Implement signal validation using riskService
            // const riskCheck = await this.riskService.checkPositionRisk(...);
            // if (!riskCheck) { logger.warn('Signal rejected by risk management'); return null; }

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
        const stopLossPercentage = this.tradingConfig.riskManagement.stopLoss.percentage || 2;

        if (signal.action === 'BUY') {
            return signal.price * (1 - stopLossPercentage / 100);
        } else {
            return signal.price * (1 + stopLossPercentage / 100);
        }
    }

    private calculateTakeProfit(signal: TradeSignal): number {
        const takeProfitPercentage = this.tradingConfig.riskManagement.takeProfit.percentage || 4;

        if (signal.action === 'BUY') {
            return signal.price * (1 + takeProfitPercentage / 100);
        } else {
            return signal.price * (1 - takeProfitPercentage / 100);
        }
    }

    private async calculatePositionSize(signal: TradeSignal): Promise<number> {
        try {
            // TODO: Implement account balance check using portfolioService
            // const accountBalance = await this.portfolioService.getAccountBalance();
            // const riskAmount = accountBalance * (this.tradingConfig.maxRiskPerTrade / 100);

            const stopLossDistance = Math.abs(signal.price - (signal.stopLoss || 0));
            if (stopLossDistance <= 0) return 0;

            // TODO: Implement position size calculation using riskService
            // const positionSize = Math.floor(riskAmount / stopLossDistance);
            const positionSize = 1; // Placeholder

            // Apply minimum and maximum position size limits
            const minSize = 1;
            const maxSize = Math.floor(10000 * 0.1 / signal.price); // Max 10% of account (placeholder)

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
            // TODO: Implement getActiveStrategies logic or manage strategies in this service
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

        // TODO: Convert symbols to instrument tokens and subscribe
        // this.websocketManager.subscribe(tokens);
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

    private async trackSignal(signal: TradeSignal, orderId: string): Promise<void> {
        // TODO: Implement signal tracking when signal model is added to schema
        logger.info(`Signal tracked: ${signal.id} -> Order: ${orderId}`);
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
        // TODO: Implement createStrategy logic or use StrategyFactory directly
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