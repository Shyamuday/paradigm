#!/usr/bin/env ts-node

import { logger } from '../src/logger/logger';
import { MLStrategy } from '../src/services/strategies/ml-strategy';
import { StrategyEngineService } from '../src/services/strategy-engine.service';
import { MarketDataService } from '../src/services/market-data.service';
import { OrderManagerService } from '../src/services/order-manager.service';
import { RiskService } from '../src/services/risk.service';
import { PortfolioService } from '../src/services/portfolio.service';
import { mlService } from '../src/services/machine-learning.service';
import { ConfigManager } from '../src/config/config-manager';
import { ZerodhaAuth } from '../src/auth/zerodha-auth';
import { WebSocketManager } from '../src/services/websocket-manager.service';
import { LiveDataIntegrationService } from '../src/services/live-data-integration.service';
import { performanceMonitor } from '../src/services/performance-monitor.service';
import { notificationService } from '../src/services/notification.service';

/**
 * ML + Auto Trading Combined System
 * Runs both ML-based strategies and traditional auto trading simultaneously
 */
class MLAutoTrader {
    private configManager: ConfigManager;
    private strategyEngine: StrategyEngineService;
    private marketDataService: MarketDataService;
    private orderManager: OrderManagerService;
    private riskService: RiskService;
    private portfolioService: PortfolioService;
    private mlStrategy: MLStrategy;
    private auth: ZerodhaAuth;
    private websocketManager: WebSocketManager;
    private liveDataService: LiveDataIntegrationService;
    private isRunning: boolean = false;
    private isAuthenticated: boolean = false;
    private tradingMode: 'PAPER' | 'LIVE' = 'PAPER';

    constructor() {
        this.configManager = new ConfigManager();
        this.strategyEngine = new StrategyEngineService();
        this.marketDataService = new MarketDataService({} as any, {} as any);
        this.orderManager = new OrderManagerService({} as any, 'ml-auto-trader-session');
        this.riskService = new RiskService();
        this.portfolioService = new PortfolioService({} as any, this.marketDataService, {} as any);
        this.auth = new ZerodhaAuth();
        this.websocketManager = new WebSocketManager({} as any);
        this.liveDataService = new LiveDataIntegrationService({} as any, {} as any);

        // Initialize ML Strategy
        this.mlStrategy = new MLStrategy({
            name: 'ML Auto Strategy',
            enabled: true,
            type: 'CUSTOM',
            version: '1.0.0',
            description: 'Combined ML and Auto Trading Strategy',
            category: 'TECHNICAL',
            riskLevel: 'MEDIUM',
            timeframes: ['5min', '15min', '1hour'],
            entryRules: [],
            exitRules: [],
            positionSizing: {
                method: 'PERCENTAGE',
                value: 10,
                maxPositionSize: 0.1,
                minPositionSize: 0.01
            },
            riskManagement: {
                maxRiskPerTrade: 0.02,
                maxDailyLoss: 5000,
                maxDrawdown: 0.1,
                stopLossType: 'PERCENTAGE',
                stopLossValue: 2,
                takeProfitType: 'PERCENTAGE',
                takeProfitValue: 4,
                trailingStop: false
            },
            filters: [],
            notifications: [],
            parameters: {},
            capitalAllocation: 100000,
            instruments: ['NIFTY', 'BANKNIFTY'],
            indicators: {
                sma: { period: 20 },
                ema: { period: 20 },
                rsi: { period: 14 },
                macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
                bollinger: { period: 20, stdDev: 2 },
                atr: { period: 14 }
            },
            ml: {
                lookbackPeriod: 50,
                predictionHorizon: 5,
                confidenceThreshold: 0.7,
                retrainInterval: 60,
                featureEngineering: true
            },
            risk: {
                maxPositionSize: 0.1,
                stopLoss: 2,
                takeProfit: 4,
                maxDrawdown: 0.1
            }
        });
    }

    async start(): Promise<void> {
        try {
            logger.info('🚀 Starting ML + Auto Trading Combined System...');

            // Load configuration
            await this.configManager.loadConfig();
            logger.info('✅ Configuration loaded');

            // Determine trading mode
            this.tradingMode = process.env.TRADING_MODE === 'LIVE' ? 'LIVE' : 'PAPER';
            logger.info(`📊 Trading Mode: ${this.tradingMode}`);

            // Initialize authentication
            await this.initializeAuthentication();
            if (!this.isAuthenticated) {
                throw new Error('Authentication failed');
            }

            // Initialize performance monitoring
            performanceMonitor.start();
            logger.info('✅ Performance monitoring started');

            // Initialize notification service
            notificationService.enable();
            logger.info('✅ Notification service initialized');

            // Initialize ML service
            mlService.enable();
            logger.info('✅ ML Service enabled');

            // Strategy engine is ready
            logger.info('✅ Strategy Engine ready');

            // Register ML strategy
            await this.strategyEngine.registerStrategy(this.mlStrategy);
            logger.info('✅ ML Strategy registered');

            // Initialize real-time data
            await this.initializeRealTimeData();
            logger.info('✅ Real-time data initialized');

            // Initialize position monitoring
            await this.initializePositionMonitoring();
            logger.info('✅ Position monitoring initialized');

            // Send startup notification
            await this.sendNotification('ML Auto Trader started successfully', 'STARTUP');

            // Start the combined trading loop
            this.isRunning = true;
            await this.runCombinedTradingLoop();

        } catch (error) {
            logger.error('❌ Error starting ML Auto Trader:', error);
            await this.sendNotification(`Failed to start ML Auto Trader: ${error.message}`, 'ERROR');
            throw error;
        }
    }

    private async initializeAuthentication(): Promise<void> {
        try {
            logger.info('🔐 Initializing authentication...');

            // Check if we have valid session
            const hasValidSession = await this.auth.hasValidSession();
            if (hasValidSession) {
                this.isAuthenticated = true;
                logger.info('✅ Using existing session');
                return;
            }

            // Authenticate with Zerodha
            await this.auth.startOAuthLogin();
            this.isAuthenticated = true;
            logger.info('✅ Authentication successful');

        } catch (error) {
            logger.error('❌ Authentication failed:', error);
            this.isAuthenticated = false;
            throw error;
        }
    }

    private async initializeRealTimeData(): Promise<void> {
        try {
            // Initialize WebSocket for real-time data
            await this.websocketManager.connect();

            // Subscribe to instruments (using default tokens for NIFTY and BANKNIFTY)
            const instruments = this.mlStrategy.getInstruments();
            // Convert instrument symbols to tokens (simplified - in real implementation, you'd get these from Zerodha API)
            const instrumentTokens = instruments.map(symbol => {
                switch (symbol) {
                    case 'NIFTY': return 256265; // NIFTY 50 token
                    case 'BANKNIFTY': return 260105; // BANKNIFTY token
                    default: return 256265; // Default to NIFTY
                }
            });
            this.websocketManager.subscribe(instrumentTokens);

            // Start live data processing
            await this.liveDataService.startLiveMonitoring(instruments);

            logger.info('✅ Real-time data initialized');

        } catch (error) {
            logger.error('❌ Failed to initialize real-time data:', error);
            throw error;
        }
    }

    private async initializePositionMonitoring(): Promise<void> {
        try {
            // Start position monitoring
            setInterval(async () => {
                await this.monitorPositions();
            }, 30000); // Check every 30 seconds

            logger.info('✅ Position monitoring initialized');

        } catch (error) {
            logger.error('❌ Failed to initialize position monitoring:', error);
            throw error;
        }
    }

    private async monitorPositions(): Promise<void> {
        try {
            const positions = await this.portfolioService.getPositions('ml-auto-trader-session');

            for (const position of positions) {
                // Check if position needs to be closed based on ML strategy
                const shouldExit = await this.mlStrategy.shouldExit(position, []);

                if (shouldExit) {
                    logger.info(`🔄 Closing position: ${position.instrument.symbol}`);
                    await this.closePosition(position);
                }

                // Check risk limits
                const riskCheck = await this.riskService.checkPositionRisk('ml-auto-trader', position.quantity, 1);
                if (!riskCheck) {
                    logger.warn(`⚠️ Risk limit exceeded for ${position.instrument.symbol}`);
                    await this.sendNotification(`Risk limit exceeded: ${position.instrument.symbol}`, 'RISK_ALERT');
                }
            }

        } catch (error) {
            logger.error('Error monitoring positions:', error);
        }
    }

    private async closePosition(position: any): Promise<void> {
        try {
            const order = await this.orderManager.placeOrder({
                id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                strategy: 'ML_AUTO',
                symbol: position.instrument.symbol,
                action: position.side === 'LONG' ? 'SELL' : 'BUY',
                quantity: position.quantity,
                price: position.currentPrice || 0,
                timestamp: new Date()
            });

            logger.info(`✅ Position closed: ${position.symbol}`);
            await this.sendNotification(`Position closed: ${position.symbol}`, 'POSITION_CLOSED');

        } catch (error) {
            logger.error(`Error closing position ${position.symbol}:`, error);
        }
    }

    private async runCombinedTradingLoop(): Promise<void> {
        logger.info('🔄 Starting combined trading loop...');

        while (this.isRunning) {
            try {
                // 1. Get real-time market data
                const marketData = await this.getRealTimeMarketData();
                if (!marketData || marketData.length === 0) {
                    logger.warn('No market data available, waiting...');
                    await this.sleep(30000);
                    continue;
                }

                // 2. Generate ML signals
                const mlSignals = await this.generateMLSignals(marketData);
                logger.info(`ML Signals generated: ${mlSignals.length}`);

                // 3. Generate traditional auto trading signals
                const autoSignals = await this.generateAutoSignals(marketData);
                logger.info(`Auto Signals generated: ${autoSignals.length}`);

                // 4. Combine and filter signals
                const combinedSignals = this.combineSignals(mlSignals, autoSignals);
                logger.info(`Combined signals: ${combinedSignals.length}`);

                // 5. Execute trades (only in LIVE mode)
                if (this.tradingMode === 'LIVE') {
                    await this.executeSignals(combinedSignals);
                } else {
                    logger.info(`📝 Paper trading mode - would execute ${combinedSignals.length} signals`);
                }

                // 6. Update ML model with new data
                await this.updateMLModel(marketData);

                // 7. Record performance metrics
                this.recordPerformanceMetrics(combinedSignals);

                // 8. Wait before next iteration
                await this.sleep(60000); // 1 minute interval

            } catch (error) {
                logger.error('Error in trading loop:', error);
                await this.sendNotification(`Trading loop error: ${error.message}`, 'ERROR');
                await this.sleep(30000);
            }
        }
    }

    private async getRealTimeMarketData(): Promise<any[]> {
        try {
            // Get real-time data from WebSocket
            const instruments = this.mlStrategy.getInstruments();
            const marketData: any[] = [];

            for (const instrument of instruments) {
                const realTimeData = await this.liveDataService.getRealTimeMultiTimeframeData(instrument);
                if (realTimeData) {
                    marketData.push(realTimeData);
                }
            }

            return marketData;
        } catch (error) {
            logger.error('Error getting real-time market data:', error);
            return [];
        }
    }

    private async generateMLSignals(marketData: any[]): Promise<any[]> {
        try {
            const signals = await this.mlStrategy.generateSignals(marketData);
            return signals.map(signal => ({
                ...signal,
                source: 'ML',
                confidence: signal.confidence || 0.5
            }));
        } catch (error) {
            logger.error('Error generating ML signals:', error);
            return [];
        }
    }

    private async generateAutoSignals(marketData: any[]): Promise<any[]> {
        try {
            const signals: any[] = [];

            // Simple moving average crossover
            const sma20 = this.calculateSMA(marketData.map(d => d.close), 20);
            const sma50 = this.calculateSMA(marketData.map(d => d.close), 50);

            if (sma20 > sma50) {
                signals.push({
                    id: `auto_${Date.now()}`,
                    symbol: marketData[0]?.symbol,
                    action: 'BUY',
                    quantity: 1,
                    price: marketData[marketData.length - 1]?.close,
                    confidence: 0.6,
                    timestamp: new Date(),
                    source: 'AUTO',
                    strategyName: 'SMA_CROSSOVER'
                });
            }

            return signals;
        } catch (error) {
            logger.error('Error generating auto signals:', error);
            return [];
        }
    }

    private combineSignals(mlSignals: any[], autoSignals: any[]): any[] {
        const combined: any[] = [];

        // Add ML signals with higher priority
        combined.push(...mlSignals.map(signal => ({
            ...signal,
            priority: 'HIGH'
        })));

        // Add auto signals with lower priority
        combined.push(...autoSignals.map(signal => ({
            ...signal,
            priority: 'MEDIUM'
        })));

        // Filter out conflicting signals
        return this.filterConflictingSignals(combined);
    }

    private filterConflictingSignals(signals: any[]): any[] {
        const filtered: any[] = [];
        const symbolSignals = new Map<string, any[]>();

        // Group signals by symbol
        for (const signal of signals) {
            const symbol = signal.symbol;
            if (!symbolSignals.has(symbol)) {
                symbolSignals.set(symbol, []);
            }
            symbolSignals.get(symbol)!.push(signal);
        }

        // For each symbol, keep the highest confidence signal
        for (const [symbol, symbolSignalList] of symbolSignals) {
            if (symbolSignalList.length > 0) {
                const bestSignal = symbolSignalList.reduce((best, current) =>
                    (current.confidence || 0) > (best.confidence || 0) ? current : best
                );
                filtered.push(bestSignal);
            }
        }

        return filtered;
    }

    private async executeSignals(signals: any[]): Promise<void> {
        for (const signal of signals) {
            try {
                // Check risk limits
                const riskCheck = await this.riskService.checkPositionRisk('ml-auto-trader', signal.quantity, 1);

                if (!riskCheck) {
                    logger.warn(`Risk check failed for ${signal.symbol}`);
                    continue;
                }

                // Execute the trade
                const order = await this.orderManager.placeOrder({
                    id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    strategy: 'ML_AUTO',
                    symbol: signal.symbol,
                    action: signal.action,
                    quantity: signal.quantity,
                    price: signal.price,
                    timestamp: new Date()
                });

                logger.info(`Order executed: ${signal.symbol} ${signal.action} ${signal.quantity} @ ${signal.price}`);
                logger.info(`Signal source: ${signal.source}, Confidence: ${signal.confidence}`);

                // Send notification
                await this.sendNotification(
                    `Order executed: ${signal.symbol} ${signal.action} ${signal.quantity} @ ${signal.price}`,
                    'ORDER_EXECUTED'
                );

            } catch (error) {
                logger.error(`Error executing signal for ${signal.symbol}:`, error);
                await this.sendNotification(`Order failed: ${signal.symbol} - ${error.message}`, 'ERROR');
            }
        }
    }

    private async updateMLModel(marketData: any[]): Promise<void> {
        try {
            // Add new data to ML service for training
            for (const data of marketData) {
                const features = mlService.extractFeatures([data]);
                if (features) {
                    // Calculate target (simple price change)
                    const target = data.close > data.open ? 1 : -1;
                    mlService.addTrainingData(data.symbol, Object.values(features), target, data.timestamp);
                }
            }

            // Retrain model periodically
            const shouldRetrain = Math.random() < 0.1; // 10% chance each iteration
            if (shouldRetrain) {
                logger.info('🔄 Retraining ML model...');
                // This would trigger model retraining
            }

        } catch (error) {
            logger.error('Error updating ML model:', error);
        }
    }

    private recordPerformanceMetrics(signals: any[]): void {
        try {
            // Record signal generation metrics
            performanceMonitor.recordMetric('signals_generated', signals.length);
            performanceMonitor.recordMetric('ml_signals', signals.filter(s => s.source === 'ML').length);
            performanceMonitor.recordMetric('auto_signals', signals.filter(s => s.source === 'AUTO').length);

            // Record average confidence
            const avgConfidence = signals.reduce((sum, s) => sum + (s.confidence || 0), 0) / signals.length;
            performanceMonitor.recordMetric('avg_signal_confidence', avgConfidence);

        } catch (error) {
            logger.error('Error recording performance metrics:', error);
        }
    }

    public async sendNotification(message: string, type: string): Promise<void> {
        try {
            await notificationService.send({
                title: `ML Auto Trader: ${type}`,
                message,
                level: type === 'ERROR' ? 'error' : 'info',
                timestamp: new Date(),
                channels: ['slack', 'email']
            });
        } catch (error) {
            logger.error('Error sending notification:', error);
        }
    }

    private calculateSMA(prices: number[], period: number): number {
        if (prices.length < period) return 0;
        const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async stop(): Promise<void> {
        logger.info('🛑 Stopping ML Auto Trader...');
        this.isRunning = false;

        // Stop real-time data
        await this.websocketManager.disconnect();
        await this.liveDataService.stopLiveMonitoring();

        // Stop performance monitoring
        performanceMonitor.stop();

        // Send shutdown notification
        await this.sendNotification('ML Auto Trader stopped', 'SHUTDOWN');

        logger.info('✅ ML Auto Trader stopped gracefully');
    }

    getStatus(): any {
        return {
            isRunning: this.isRunning,
            isAuthenticated: this.isAuthenticated,
            tradingMode: this.tradingMode,
            mlStrategy: this.mlStrategy.getState(),
            performance: this.mlStrategy.getPerformance(),
            systemMetrics: performanceMonitor.getAllMetrics()
        };
    }
}

// Main execution
async function main() {
    const trader = new MLAutoTrader();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        logger.info('Received SIGINT, shutting down gracefully...');
        await trader.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info('Received SIGTERM, shutting down gracefully...');
        await trader.stop();
        process.exit(0);
    });

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
        logger.error('Uncaught Exception:', error);
        await trader.sendNotification(`Uncaught Exception: ${error.message}`, 'ERROR');
        await trader.stop();
        process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
        logger.error('Unhandled Rejection', { promise, reason });
        await trader.sendNotification(`Unhandled Rejection: ${reason}`, 'ERROR');
        await trader.stop();
        process.exit(1);
    });

    try {
        await trader.start();
    } catch (error) {
        logger.error('Failed to start ML Auto Trader:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (require.main === module) {
    main();
}

export { MLAutoTrader }; 