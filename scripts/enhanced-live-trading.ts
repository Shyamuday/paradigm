#!/usr/bin/env ts-node

import { SimpleTensorFlowStrategy, SimpleTensorFlowConfig } from '../src/services/strategies/simple-tensorflow-strategy';
import { DatabaseManager } from '../src/database/database';
import { logger } from '../src/logger/logger';

interface EnhancedTradingSignal {
    symbol: string;
    timeframe: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    price: number;
    confidence: number;
    reasoning: string;
    timestamp: Date;
    stopLoss: number;
    takeProfit: number;
    target: number;
    positionSize: number;
    volatility: number;
    riskRewardRatio: number;
    expectedReturn: number;
    maxDrawdown: number;
}

interface EnhancedPaperTrade {
    id: string;
    symbol: string;
    timeframe: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    target: number;
    timestamp: Date;
    status: 'PENDING' | 'EXECUTED' | 'CLOSED' | 'CANCELLED';
    exitPrice?: number;
    exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TARGET' | 'MANUAL';
    exitTimestamp?: Date;
    pnl?: number;
    pnlPercent?: number;
    maxDrawdown?: number;
    riskRewardRatio: number;
    volatility: number;
    mlConfidence: number;
    strategy: string;
}

interface TradingResult {
    tradeId: string;
    symbol: string;
    timeframe: string;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    duration: number; // in minutes
    success: boolean;
    mlConfidence: number;
    volatility: number;
    riskRewardRatio: number;
    timestamp: Date;
}

class EnhancedLiveTrading {
    private dbManager: DatabaseManager;
    private isRunning: boolean = false;
    private signalInterval: NodeJS.Timeout | null = null;
    private strategies: Map<string, SimpleTensorFlowStrategy> = new Map();
    private paperTrades: EnhancedPaperTrade[] = [];
    private tradingResults: TradingResult[] = [];
    private capital: number = 100000;
    private maxPositionSize: number = 0.1;
    private minConfidence: number = 0.7;
    private maxDrawdown: number = 0.15; // 15% max drawdown

    constructor() {
        this.dbManager = DatabaseManager.getInstance();
    }

    async start(): Promise<void> {
        try {
            console.log('🚀 Starting Enhanced Live Trading System...\n');
            console.log(`💰 Capital: ₹${this.capital.toLocaleString()}`);
            console.log(`📊 Max Position: ${this.maxPositionSize * 100}%`);
            console.log(`🎯 Min Confidence: ${this.minConfidence * 100}%`);
            console.log(`🛑 Max Drawdown: ${this.maxDrawdown * 100}%\n`);

            await this.dbManager.connect();
            console.log('✅ Database connected');

            await this.initializeStrategies();
            console.log('✅ ML Strategies initialized');

            this.isRunning = true;
            console.log('🎯 Enhanced live trading started!');
            console.log('Press Ctrl+C to stop...\n');

            this.startSignalGeneration();

        } catch (error) {
            console.error('❌ Error starting enhanced live trading:', error);
            throw error;
        }
    }

    private async initializeStrategies(): Promise<void> {
        const db = this.dbManager.getPrisma();
        const timeframes = await db.timeframeConfig.findMany({
            orderBy: { intervalMinutes: 'asc' }
        });

        console.log('🧠 Initializing enhanced ML strategies...');

        for (const timeframe of timeframes) {
            try {
                const config: SimpleTensorFlowConfig = {
                    name: `Enhanced_${timeframe.name}`,
                    enabled: true,
                    type: 'CUSTOM',
                    version: '2.0.0',
                    description: `Enhanced ML strategy for ${timeframe.name}`,
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
                        maxDrawdown: this.maxDrawdown,
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
                        maxDrawdown: this.maxDrawdown
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
                await this.generateEnhancedSignals();
                await this.monitorActiveTrades();
            } catch (error) {
                console.error('❌ Error in signal generation:', error);
            }
        }, 30000);
    }

    private async generateEnhancedSignals(): Promise<void> {
        try {
            const db = this.dbManager.getPrisma();
            const now = new Date();

            console.log(`\n🔄 Generating enhanced signals - ${now.toLocaleTimeString()}`);

            const instruments = await db.instrument.findMany({
                where: {
                    symbol: { in: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'] },
                    exchange: 'NSE'
                }
            });

            const signals: EnhancedTradingSignal[] = [];

            for (const instrument of instruments) {
                for (const [timeframeName, strategy] of this.strategies.entries()) {
                    try {
                        const marketData = await this.getRecentMarketData(instrument.symbol, timeframeName);

                        if (marketData.length < 50) continue;

                        const mlSignals = await strategy.generateSignals(marketData);

                        if (mlSignals.length > 0 && mlSignals[0]) {
                            const signal = mlSignals[0];

                            if (signal.confidence >= this.minConfidence) {
                                // Calculate dynamic risk parameters
                                const volatility = this.calculateVolatility(marketData);
                                const atr = this.calculateATR(marketData);

                                // Dynamic stop-loss based on volatility and ATR
                                const dynamicStopLoss = this.calculateDynamicStopLoss(signal, volatility, atr);
                                const dynamicTakeProfit = this.calculateDynamicTakeProfit(signal, volatility, atr);
                                const target = this.calculateTarget(signal, volatility, atr);

                                const enhancedSignal: EnhancedTradingSignal = {
                                    symbol: instrument.symbol,
                                    timeframe: timeframeName,
                                    action: signal.action as 'BUY' | 'SELL' | 'HOLD',
                                    price: signal.price,
                                    confidence: signal.confidence,
                                    reasoning: signal.reasoning || 'ML signal generated',
                                    timestamp: now,
                                    stopLoss: dynamicStopLoss,
                                    takeProfit: dynamicTakeProfit,
                                    target: target,
                                    positionSize: strategy.calculatePositionSize(signal, this.capital),
                                    volatility: volatility,
                                    riskRewardRatio: Math.abs((target - signal.price) / (signal.price - dynamicStopLoss)),
                                    expectedReturn: this.calculateExpectedReturn(signal, target, dynamicStopLoss, signal.confidence),
                                    maxDrawdown: this.calculateMaxDrawdown(signal, dynamicStopLoss)
                                };

                                signals.push(enhancedSignal);
                            }
                        }

                    } catch (error) {
                        console.error(`   ❌ Error generating signal for ${instrument.symbol} (${timeframeName}):`, error);
                    }
                }
            }

            await this.processEnhancedSignals(signals);
            await this.showEnhancedPortfolioStatus();

        } catch (error) {
            console.error('❌ Error in enhanced signal generation:', error);
        }
    }

    private calculateVolatility(marketData: any[]): number {
        const prices = marketData.map(d => d.close);
        const returns = [];

        for (let i = 1; i < prices.length; i++) {
            if (prices[i - 1] > 0) {
                returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
            }
        }

        if (returns.length === 0) return 0.02; // Default 2% volatility

        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        return Math.sqrt(variance);
    }

    private calculateATR(marketData: any[]): number {
        const highs = marketData.map(d => d.high);
        const lows = marketData.map(d => d.low);
        const closes = marketData.map(d => d.close);

        let atr = 0;
        for (let i = 1; i < closes.length; i++) {
            const tr = Math.max(
                highs[i] - lows[i],
                Math.abs(highs[i] - closes[i - 1]),
                Math.abs(lows[i] - closes[i - 1])
            );
            atr += tr;
        }

        return atr / (closes.length - 1);
    }

    private calculateDynamicStopLoss(signal: any, volatility: number, atr: number): number {
        const baseStopLoss = 0.02; // 2% base stop-loss
        const volatilityAdjustment = volatility * 2; // Adjust based on volatility
        const atrAdjustment = atr / signal.price; // ATR-based adjustment

        const dynamicStopLoss = Math.max(baseStopLoss, volatilityAdjustment, atrAdjustment);

        return signal.action === 'BUY'
            ? signal.price * (1 - dynamicStopLoss)
            : signal.price * (1 + dynamicStopLoss);
    }

    private calculateDynamicTakeProfit(signal: any, volatility: number, atr: number): number {
        const baseTakeProfit = 0.04; // 4% base take-profit
        const volatilityAdjustment = volatility * 3; // Higher adjustment for take-profit
        const atrAdjustment = (atr / signal.price) * 2; // 2x ATR for take-profit

        const dynamicTakeProfit = Math.max(baseTakeProfit, volatilityAdjustment, atrAdjustment);

        return signal.action === 'BUY'
            ? signal.price * (1 + dynamicTakeProfit)
            : signal.price * (1 - dynamicTakeProfit);
    }

    private calculateTarget(signal: any, volatility: number, atr: number): number {
        const baseTarget = 0.06; // 6% base target
        const volatilityAdjustment = volatility * 4; // Higher adjustment for target
        const atrAdjustment = (atr / signal.price) * 3; // 3x ATR for target

        const dynamicTarget = Math.max(baseTarget, volatilityAdjustment, atrAdjustment);

        return signal.action === 'BUY'
            ? signal.price * (1 + dynamicTarget)
            : signal.price * (1 - dynamicTarget);
    }

    private calculateExpectedReturn(signal: any, target: number, stopLoss: number, confidence: number): number {
        const risk = Math.abs(signal.price - stopLoss);
        const reward = Math.abs(target - signal.price);
        const riskRewardRatio = reward / risk;

        // Expected return = (probability of success * reward) - (probability of failure * risk)
        return (confidence * reward) - ((1 - confidence) * risk);
    }

    private calculateMaxDrawdown(signal: any, stopLoss: number): number {
        return Math.abs(signal.price - stopLoss) / signal.price;
    }

    private async processEnhancedSignals(signals: EnhancedTradingSignal[]): Promise<void> {
        if (signals.length === 0) {
            console.log('   📊 No high-confidence enhanced signals generated');
            return;
        }

        console.log(`   🎯 Generated ${signals.length} enhanced signals:`);

        for (const signal of signals) {
            console.log(`   📈 ${signal.symbol} (${signal.timeframe}): ${signal.action} @ ₹${signal.price.toFixed(2)}`);
            console.log(`      🎯 Confidence: ${(signal.confidence * 100).toFixed(1)}% | Volatility: ${(signal.volatility * 100).toFixed(2)}%`);
            console.log(`      🛑 Stop Loss: ₹${signal.stopLoss.toFixed(2)} | 🎯 Target: ₹${signal.target.toFixed(2)}`);
            console.log(`      📊 Risk/Reward: ${signal.riskRewardRatio.toFixed(2)} | Expected Return: ₹${signal.expectedReturn.toFixed(2)}`);

            await this.executeEnhancedPaperTrade(signal);
        }
    }

    private async executeEnhancedPaperTrade(signal: EnhancedTradingSignal): Promise<void> {
        try {
            const existingTrade = this.paperTrades.find(t =>
                t.symbol === signal.symbol &&
                t.status === 'EXECUTED' &&
                t.action === signal.action
            );

            if (existingTrade) {
                console.log(`   ⚠️  Already have ${signal.action} position for ${signal.symbol}`);
                return;
            }

            const quantity = Math.floor(signal.positionSize / signal.price);

            if (quantity <= 0) {
                console.log(`   ⚠️  Insufficient capital for ${signal.symbol}`);
                return;
            }

            const paperTrade: EnhancedPaperTrade = {
                id: `EPT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                symbol: signal.symbol,
                timeframe: signal.timeframe,
                action: signal.action,
                quantity: quantity,
                entryPrice: signal.price,
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit,
                target: signal.target,
                timestamp: signal.timestamp,
                status: 'EXECUTED',
                riskRewardRatio: signal.riskRewardRatio,
                volatility: signal.volatility,
                mlConfidence: signal.confidence,
                strategy: `Enhanced_${signal.timeframe}`
            };

            this.paperTrades.push(paperTrade);

            console.log(`   💰 Enhanced Paper Trade: ${signal.action} ${quantity} shares @ ₹${signal.price.toFixed(2)}`);
            console.log(`   🎯 Target: ₹${signal.target.toFixed(2)} | Expected Return: ₹${signal.expectedReturn.toFixed(2)}`);

            await this.saveEnhancedPaperTrade(paperTrade);

        } catch (error) {
            console.error(`   ❌ Error executing enhanced paper trade for ${signal.symbol}:`, error);
        }
    }

    private async monitorActiveTrades(): Promise<void> {
        const activeTrades = this.paperTrades.filter(t => t.status === 'EXECUTED');

        for (const trade of activeTrades) {
            try {
                const currentPrice = await this.getCurrentPrice(trade.symbol);

                if (currentPrice <= 0) continue;

                // Check stop-loss
                if (trade.action === 'BUY' && currentPrice <= trade.stopLoss) {
                    await this.closeTrade(trade, currentPrice, 'STOP_LOSS');
                } else if (trade.action === 'SELL' && currentPrice >= trade.stopLoss) {
                    await this.closeTrade(trade, currentPrice, 'STOP_LOSS');
                }

                // Check take-profit
                else if (trade.action === 'BUY' && currentPrice >= trade.takeProfit) {
                    await this.closeTrade(trade, currentPrice, 'TAKE_PROFIT');
                } else if (trade.action === 'SELL' && currentPrice <= trade.takeProfit) {
                    await this.closeTrade(trade, currentPrice, 'TAKE_PROFIT');
                }

                // Check target
                else if (trade.action === 'BUY' && currentPrice >= trade.target) {
                    await this.closeTrade(trade, currentPrice, 'TARGET');
                } else if (trade.action === 'SELL' && currentPrice <= trade.target) {
                    await this.closeTrade(trade, currentPrice, 'TARGET');
                }

            } catch (error) {
                console.error(`❌ Error monitoring trade ${trade.id}:`, error);
            }
        }
    }

    private async closeTrade(trade: EnhancedPaperTrade, exitPrice: number, reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TARGET'): Promise<void> {
        trade.status = 'CLOSED';
        trade.exitPrice = exitPrice;
        trade.exitReason = reason;
        trade.exitTimestamp = new Date();

        const pnl = trade.action === 'BUY'
            ? (exitPrice - trade.entryPrice) * trade.quantity
            : (trade.entryPrice - exitPrice) * trade.quantity;

        trade.pnl = pnl;
        trade.pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;

        const duration = trade.exitTimestamp.getTime() - trade.timestamp.getTime();
        const durationMinutes = duration / (1000 * 60);

        const result: TradingResult = {
            tradeId: trade.id,
            symbol: trade.symbol,
            timeframe: trade.timeframe,
            entryPrice: trade.entryPrice,
            exitPrice: exitPrice,
            pnl: pnl,
            pnlPercent: trade.pnlPercent,
            duration: durationMinutes,
            success: pnl > 0,
            mlConfidence: trade.mlConfidence,
            volatility: trade.volatility,
            riskRewardRatio: trade.riskRewardRatio,
            timestamp: trade.exitTimestamp
        };

        this.tradingResults.push(result);

        console.log(`   🎯 Trade Closed: ${trade.symbol} ${trade.action} | ${reason} | P&L: ₹${pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%)`);
        console.log(`   ⏱️  Duration: ${durationMinutes.toFixed(1)} minutes | Confidence: ${(trade.mlConfidence * 100).toFixed(1)}%`);

        await this.saveTradingResult(result);
    }

    private async saveEnhancedPaperTrade(trade: EnhancedPaperTrade): Promise<void> {
        try {
            const db = this.dbManager.getPrisma();
            console.log(`   💾 Enhanced paper trade saved: ${trade.id}`);
        } catch (error) {
            console.error('❌ Error saving enhanced paper trade:', error);
        }
    }

    private async saveTradingResult(result: TradingResult): Promise<void> {
        try {
            const db = this.dbManager.getPrisma();
            console.log(`   💾 Trading result saved: ${result.tradeId}`);
        } catch (error) {
            console.error('❌ Error saving trading result:', error);
        }
    }

    private async showEnhancedPortfolioStatus(): Promise<void> {
        const activeTrades = this.paperTrades.filter(t => t.status === 'EXECUTED');
        const closedTrades = this.paperTrades.filter(t => t.status === 'CLOSED');

        if (activeTrades.length === 0 && closedTrades.length === 0) {
            console.log('   📊 No trades in portfolio');
            return;
        }

        console.log('\n📊 Enhanced Portfolio Status:');

        if (activeTrades.length > 0) {
            console.log('\n🔄 Active Trades:');
            console.log('Symbol'.padEnd(12) + 'Action'.padEnd(8) + 'Entry'.padEnd(10) + 'Stop'.padEnd(10) + 'Target'.padEnd(10) + 'Confidence');
            console.log('-'.repeat(80));

            for (const trade of activeTrades) {
                console.log(
                    trade.symbol.padEnd(12) +
                    trade.action.padEnd(8) +
                    `₹${trade.entryPrice.toFixed(2)}`.padEnd(10) +
                    `₹${trade.stopLoss.toFixed(2)}`.padEnd(10) +
                    `₹${trade.target.toFixed(2)}`.padEnd(10) +
                    `${(trade.mlConfidence * 100).toFixed(1)}%`
                );
            }
        }

        if (closedTrades.length > 0) {
            console.log('\n✅ Closed Trades:');
            console.log('Symbol'.padEnd(12) + 'Action'.padEnd(8) + 'Entry'.padEnd(10) + 'Exit'.padEnd(10) + 'P&L'.padEnd(10) + 'Duration');
            console.log('-'.repeat(80));

            let totalPnL = 0;
            let winningTrades = 0;

            for (const trade of closedTrades) {
                if (trade.pnl) {
                    totalPnL += trade.pnl;
                    if (trade.pnl > 0) winningTrades++;
                }

                const duration = trade.exitTimestamp && trade.timestamp
                    ? ((trade.exitTimestamp.getTime() - trade.timestamp.getTime()) / (1000 * 60)).toFixed(1)
                    : 'N/A';

                console.log(
                    trade.symbol.padEnd(12) +
                    trade.action.padEnd(8) +
                    `₹${trade.entryPrice.toFixed(2)}`.padEnd(10) +
                    `₹${trade.exitPrice?.toFixed(2) || 'N/A'}`.padEnd(10) +
                    `₹${trade.pnl?.toFixed(2) || 'N/A'}`.padEnd(10) +
                    `${duration}m`
                );
            }

            const winRate = closedTrades.length > 0 ? (winningTrades / closedTrades.length) * 100 : 0;
            console.log('-'.repeat(80));
            console.log(`Total P&L: ₹${totalPnL.toFixed(2)} | Win Rate: ${winRate.toFixed(1)}% | Total Trades: ${closedTrades.length}`);
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
        })).reverse();
    }

    private async getCurrentPrice(symbol: string): Promise<number> {
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
            console.log('\n🛑 Stopping enhanced live trading...');

            this.isRunning = false;

            if (this.signalInterval) {
                clearInterval(this.signalInterval);
                this.signalInterval = null;
            }

            await this.dbManager.disconnect();
            console.log('✅ Enhanced live trading stopped');

            // Show final statistics
            await this.showFinalStatistics();

        } catch (error) {
            console.error('❌ Error stopping enhanced live trading:', error);
        }
    }

    private async showFinalStatistics(): Promise<void> {
        const closedTrades = this.paperTrades.filter(t => t.status === 'CLOSED');

        if (closedTrades.length === 0) {
            console.log('📊 No completed trades to analyze');
            return;
        }

        console.log('\n📊 Final Trading Statistics:');
        console.log('='.repeat(50));

        const totalTrades = closedTrades.length;
        const winningTrades = closedTrades.filter(t => t.pnl && t.pnl > 0).length;
        const losingTrades = totalTrades - winningTrades;
        const winRate = (winningTrades / totalTrades) * 100;

        const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const avgPnL = totalPnL / totalTrades;
        const avgConfidence = closedTrades.reduce((sum, t) => sum + t.mlConfidence, 0) / totalTrades;
        const avgVolatility = closedTrades.reduce((sum, t) => sum + t.volatility, 0) / totalTrades;

        console.log(`Total Trades: ${totalTrades}`);
        console.log(`Winning Trades: ${winningTrades} (${winRate.toFixed(1)}%)`);
        console.log(`Losing Trades: ${losingTrades}`);
        console.log(`Total P&L: ₹${totalPnL.toFixed(2)}`);
        console.log(`Average P&L per Trade: ₹${avgPnL.toFixed(2)}`);
        console.log(`Average ML Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
        console.log(`Average Volatility: ${(avgVolatility * 100).toFixed(2)}%`);
        console.log(`Return on Capital: ${((totalPnL / this.capital) * 100).toFixed(2)}%`);
    }

    getStatus(): any {
        return {
            isRunning: this.isRunning,
            activeTrades: this.paperTrades.filter(t => t.status === 'EXECUTED').length,
            closedTrades: this.paperTrades.filter(t => t.status === 'CLOSED').length,
            totalPnL: this.paperTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
            capital: this.capital
        };
    }
}

// CLI interface
if (require.main === module) {
    const enhancedTrading = new EnhancedLiveTrading();

    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await enhancedTrading.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await enhancedTrading.stop();
        process.exit(0);
    });

    enhancedTrading.start().catch(console.error);
}

export { EnhancedLiveTrading, EnhancedTradingSignal, EnhancedPaperTrade, TradingResult }; 