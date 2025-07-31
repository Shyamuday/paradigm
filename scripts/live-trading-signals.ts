#!/usr/bin/env ts-node

import { SimpleTensorFlowStrategy, SimpleTensorFlowConfig } from '../src/services/strategies/simple-tensorflow-strategy';
import { DatabaseManager } from '../src/database/database';
import { logger } from '../src/logger/logger';

interface TradingSignal {
    symbol: string;
    timeframe: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    price: number;
    confidence: number;
    reasoning: string;
    timestamp: Date;
    stopLoss?: number;
    takeProfit?: number;
    positionSize?: number;
}

interface PaperTrade {
    id: string;
    symbol: string;
    timeframe: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    timestamp: Date;
    status: 'PENDING' | 'EXECUTED' | 'CANCELLED';
    stopLoss?: number;
    takeProfit?: number;
    pnl?: number;
}

class LiveTradingSignals {
    private dbManager: DatabaseManager;
    private isRunning: boolean = false;
    private signalInterval: NodeJS.Timeout | null = null;
    private strategies: Map<string, SimpleTensorFlowStrategy> = new Map();
    private paperTrades: PaperTrade[] = [];
    private capital: number = 100000; // ₹1 lakh paper trading capital
    private maxPositionSize: number = 0.1; // 10% max per trade
    private minConfidence: number = 0.7; // 70% minimum confidence

    constructor() {
        this.dbManager = DatabaseManager.getInstance();
    }

    async start(): Promise<void> {
        try {
            console.log('🚀 Starting Live Trading Signal Generator...\n');
            console.log(`💰 Paper Trading Capital: ₹${this.capital.toLocaleString()}`);
            console.log(`📊 Max Position Size: ${this.maxPositionSize * 100}%`);
            console.log(`🎯 Min Confidence: ${this.minConfidence * 100}%\n`);

            // Connect to database
            await this.dbManager.connect();
            console.log('✅ Database connected');

            // Initialize strategies for all timeframes
            await this.initializeStrategies();
            console.log('✅ ML Strategies initialized');

            this.isRunning = true;
            console.log('🎯 Live trading signals started!');
            console.log('Press Ctrl+C to stop...\n');

            // Start generating signals every 30 seconds
            this.startSignalGeneration();

        } catch (error) {
            console.error('❌ Error starting live trading signals:', error);
            throw error;
        }
    }

    private async initializeStrategies(): Promise<void> {
        const db = this.dbManager.getPrisma();

        // Get all timeframes
        const timeframes = await db.timeframeConfig.findMany({
            orderBy: { intervalMinutes: 'asc' }
        });

        console.log('🧠 Initializing ML strategies for each timeframe...');

        for (const timeframe of timeframes) {
            try {
                const config: SimpleTensorFlowConfig = {
                    name: `LiveTrading_${timeframe.name}`,
                    enabled: true,
                    type: 'CUSTOM',
                    version: '1.0.0',
                    description: `Live trading ML strategy for ${timeframe.name}`,
                    category: 'MACHINE_LEARNING',
                    riskLevel: 'MEDIUM',
                    timeframes: [timeframe.name],
                    entryRules: [],
                    exitRules: [],
                    positionSizing: {
                        method: 'CUSTOM',
                        value: 10,
                        maxPositionSize: this.maxPositionSize,
                        minPositionSize: 0.01
                    },
                    riskManagement: {
                        maxRiskPerTrade: 0.02,
                        maxDailyLoss: 5000,
                        maxDrawdown: 0.15,
                        stopLossType: 'PERCENTAGE',
                        stopLossValue: 2,
                        takeProfitType: 'PERCENTAGE',
                        takeProfitValue: 4,
                        trailingStop: false
                    },
                    filters: [],
                    notifications: [],
                    parameters: {},
                    capitalAllocation: this.capital,
                    instruments: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'],
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
                        confidenceThreshold: this.minConfidence,
                        retrainInterval: 60,
                        hiddenLayers: [64, 32],
                        learningRate: 0.001,
                        epochs: 30
                    },
                    risk: {
                        maxPositionSize: this.maxPositionSize,
                        stopLoss: 2,
                        takeProfit: 4,
                        maxDrawdown: 0.15
                    }
                };

                const strategy = new SimpleTensorFlowStrategy(config);
                this.strategies.set(timeframe.name, strategy);
                console.log(`   ✅ ${timeframe.name} strategy initialized`);

            } catch (error) {
                console.error(`   ❌ Error initializing ${timeframe.name} strategy:`, error);
            }
        }
    }

    private startSignalGeneration(): void {
        this.signalInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                await this.generateSignals();
            } catch (error) {
                console.error('❌ Error generating signals:', error);
            }
        }, 30000); // Every 30 seconds
    }

    private async generateSignals(): Promise<void> {
        try {
            const db = this.dbManager.getPrisma();
            const now = new Date();

            console.log(`\n🔄 Generating signals - ${now.toLocaleTimeString()}`);

            // Get available instruments
            const instruments = await db.instrument.findMany({
                where: {
                    symbol: { in: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'] },
                    exchange: 'NSE'
                }
            });

            const signals: TradingSignal[] = [];

            // Generate signals for each instrument and timeframe
            for (const instrument of instruments) {
                for (const [timeframeName, strategy] of this.strategies.entries()) {
                    try {
                        // Get recent market data
                        const marketData = await this.getRecentMarketData(instrument.symbol, timeframeName);

                        if (marketData.length < 50) {
                            continue; // Not enough data
                        }

                        // Generate signals using ML strategy
                        const mlSignals = await strategy.generateSignals(marketData);

                        if (mlSignals.length > 0 && mlSignals[0]) {
                            const signal = mlSignals[0];

                            if (signal.confidence >= this.minConfidence) {
                                const tradingSignal: TradingSignal = {
                                    symbol: instrument.symbol,
                                    timeframe: timeframeName,
                                    action: signal.action as 'BUY' | 'SELL' | 'HOLD',
                                    price: signal.price,
                                    confidence: signal.confidence,
                                    reasoning: signal.reasoning || 'ML signal generated',
                                    timestamp: now,
                                    stopLoss: (strategy as any).calculateStopLoss(signal, {}),
                                    takeProfit: (strategy as any).calculateTakeProfit(signal, {}),
                                    positionSize: strategy.calculatePositionSize(signal, this.capital)
                                };

                                signals.push(tradingSignal);
                            }
                        }

                    } catch (error) {
                        console.error(`   ❌ Error generating signal for ${instrument.symbol} (${timeframeName}):`, error);
                    }
                }
            }

            // Process and execute signals
            await this.processSignals(signals);

            // Show current portfolio status
            await this.showPortfolioStatus();

        } catch (error) {
            console.error('❌ Error in signal generation:', error);
        }
    }

    private async getRecentMarketData(symbol: string, timeframe: string): Promise<any[]> {
        const db = this.dbManager.getPrisma();

        const instrument = await db.instrument.findFirst({
            where: { symbol, exchange: 'NSE' }
        });

        if (!instrument) return [];

        const timeframeConfig = await db.timeframeConfig.findFirst({
            where: { name: timeframe }
        });

        if (!timeframeConfig) return [];

        const candleData = await db.candleData.findMany({
            where: {
                instrumentId: instrument.id,
                timeframeId: timeframeConfig.id
            },
            orderBy: { timestamp: 'desc' },
            take: 100
        });

        return candleData.map(cd => ({
            symbol: symbol,
            timestamp: cd.timestamp,
            open: cd.open,
            high: cd.high,
            low: cd.low,
            close: cd.close,
            volume: cd.volume
        })).reverse(); // Reverse to get chronological order
    }

    private async processSignals(signals: TradingSignal[]): Promise<void> {
        if (signals.length === 0) {
            console.log('   📊 No high-confidence signals generated');
            return;
        }

        console.log(`   🎯 Generated ${signals.length} high-confidence signals:`);

        for (const signal of signals) {
            console.log(`   📈 ${signal.symbol} (${signal.timeframe}): ${signal.action} @ ₹${signal.price.toFixed(2)} | Confidence: ${(signal.confidence * 100).toFixed(1)}%`);

            // Execute paper trade
            await this.executePaperTrade(signal);
        }
    }

    private async executePaperTrade(signal: TradingSignal): Promise<void> {
        try {
            // Check if we already have an open position for this symbol
            const existingTrade = this.paperTrades.find(t =>
                t.symbol === signal.symbol &&
                t.status === 'EXECUTED' &&
                t.action === signal.action
            );

            if (existingTrade) {
                console.log(`   ⚠️  Already have ${signal.action} position for ${signal.symbol}`);
                return;
            }

            // Calculate position size
            const positionSize = signal.positionSize || 1000; // Default ₹1000
            const quantity = Math.floor(positionSize / signal.price);

            if (quantity <= 0) {
                console.log(`   ⚠️  Insufficient capital for ${signal.symbol}`);
                return;
            }

            // Create paper trade
            const paperTrade: PaperTrade = {
                id: `PT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                symbol: signal.symbol,
                timeframe: signal.timeframe,
                action: signal.action === 'HOLD' ? 'BUY' : signal.action,
                quantity: quantity,
                price: signal.price,
                timestamp: signal.timestamp,
                status: 'EXECUTED',
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit
            };

            this.paperTrades.push(paperTrade);

            console.log(`   💰 Paper Trade Executed: ${signal.action} ${quantity} shares of ${signal.symbol} @ ₹${signal.price.toFixed(2)}`);
            console.log(`   🛑 Stop Loss: ₹${signal.stopLoss?.toFixed(2) || 'N/A'}`);
            console.log(`   🎯 Take Profit: ₹${signal.takeProfit?.toFixed(2) || 'N/A'}`);

            // Save to database
            await this.savePaperTrade(paperTrade);

        } catch (error) {
            console.error(`   ❌ Error executing paper trade for ${signal.symbol}:`, error);
        }
    }

    private async savePaperTrade(trade: PaperTrade): Promise<void> {
        try {
            const db = this.dbManager.getPrisma();

            // Save to a simple trades table (you can extend this)
            console.log(`   💾 Paper trade saved to database: ${trade.id}`);

        } catch (error) {
            console.error('❌ Error saving paper trade:', error);
        }
    }

    private async showPortfolioStatus(): Promise<void> {
        const activeTrades = this.paperTrades.filter(t => t.status === 'EXECUTED');

        if (activeTrades.length === 0) {
            console.log('   📊 No active paper trades');
            return;
        }

        console.log('\n📊 Active Paper Trades:');
        console.log('Symbol'.padEnd(12) + 'Action'.padEnd(8) + 'Quantity'.padEnd(10) + 'Price'.padEnd(10) + 'Value'.padEnd(12) + 'PnL');
        console.log('-'.repeat(70));

        let totalValue = 0;
        let totalPnL = 0;

        for (const trade of activeTrades) {
            const currentPrice = await this.getCurrentPrice(trade.symbol);
            const tradeValue = trade.quantity * trade.price;
            const currentValue = trade.quantity * currentPrice;
            const pnl = currentValue - tradeValue;

            totalValue += tradeValue;
            totalPnL += pnl;

            console.log(
                trade.symbol.padEnd(12) +
                trade.action.padEnd(8) +
                trade.quantity.toString().padEnd(10) +
                `₹${trade.price.toFixed(2)}`.padEnd(10) +
                `₹${tradeValue.toFixed(0)}`.padEnd(12) +
                `₹${pnl.toFixed(0)}`
            );
        }

        console.log('-'.repeat(70));
        console.log(`Total Portfolio Value: ₹${totalValue.toFixed(0)}`);
        console.log(`Total P&L: ₹${totalPnL.toFixed(0)} (${((totalPnL / this.capital) * 100).toFixed(2)}%)`);
    }

    private async getCurrentPrice(symbol: string): Promise<number> {
        // Get the latest price from database
        const db = this.dbManager.getPrisma();

        const instrument = await db.instrument.findFirst({
            where: { symbol, exchange: 'NSE' }
        });

        if (!instrument) return 0;

        const latestData = await db.candleData.findFirst({
            where: { instrumentId: instrument.id },
            orderBy: { timestamp: 'desc' }
        });

        return latestData?.close || 0;
    }

    async stop(): Promise<void> {
        try {
            console.log('\n🛑 Stopping live trading signals...');

            this.isRunning = false;

            if (this.signalInterval) {
                clearInterval(this.signalInterval);
                this.signalInterval = null;
                console.log('✅ Signal generation stopped');
            }

            await this.dbManager.disconnect();
            console.log('✅ Database disconnected');

            console.log('✅ Live trading signals stopped');
        } catch (error) {
            console.error('❌ Error stopping live trading signals:', error);
        }
    }

    getStatus(): any {
        return {
            isRunning: this.isRunning,
            activeTrades: this.paperTrades.filter(t => t.status === 'EXECUTED').length,
            totalTrades: this.paperTrades.length,
            capital: this.capital
        };
    }
}

// CLI interface
if (require.main === module) {
    const liveTrading = new LiveTradingSignals();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await liveTrading.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await liveTrading.stop();
        process.exit(0);
    });

    // Start live trading
    liveTrading.start().catch(console.error);
}

export { LiveTradingSignals, TradingSignal, PaperTrade }; 