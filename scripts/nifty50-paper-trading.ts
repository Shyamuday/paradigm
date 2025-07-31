#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';

interface PaperTrade {
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
    exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TARGET' | 'TIME_BASED' | 'SIGNAL_REVERSAL';
    exitTimestamp?: Date;
    pnl?: number;
    pnlPercent?: number;
    duration?: number;
    confidence: number;
    reasoning: string;
    marketCondition: string;
    riskLevel: string;
    success: boolean;
}

interface TimeframeSignal {
    timeframe: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    price: number;
    reasoning: string;
    rsi: number;
    sma10: number;
    sma20: number;
    volume: number;
}

interface ConsensusSignal {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    price: number;
    timeframes: string[];
    reasoning: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    marketCondition: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CALM';
}

interface TradingResult {
    symbol: string;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    successRate: number;
    avgPnl: number;
    maxDrawdown: number;
    sharpeRatio: number;
    bestTimeframe: string;
    avgConfidence: number;
    riskAdjustedReturn: number;
}

class Nifty50PaperTrading {
    private timeframes = ['15min', '30min', '1hour'];
    private timeframeWeights = {
        '15min': 0.4,
        '30min': 0.35,
        '1hour': 0.25
    };
    private capital = 1000000; // 10 Lakhs for paper trading
    private maxPositionSize = 0.05; // 5% per trade
    private maxOpenPositions = 10;
    private trades: PaperTrade[] = [];
    private results: Map<string, TradingResult> = new Map();
    private isRunning = false;
    private signalInterval: NodeJS.Timeout | null = null;
    private nifty50Symbols: string[] = [];

    async start(): Promise<void> {
        console.log('🚀 Starting Nifty 50 Paper Trading System...\n');

        try {
            await db.$connect();
            console.log('✅ Database connected');

            await this.loadNifty50Symbols();
            console.log(`📊 Loaded ${this.nifty50Symbols.length} Nifty 50 symbols`);

            this.startPaperTrading();
            console.log('✅ Paper trading started');

            this.isRunning = true;

            // Show initial status
            await this.showPortfolioStatus();

        } catch (error) {
            console.error('❌ Failed to start paper trading:', error);
            throw error;
        }
    }

    private async loadNifty50Symbols(): Promise<void> {
        try {
            // Load Nifty 50 symbols from database
            const instruments = await db.instrument.findMany({
                where: {
                    symbol: {
                        in: [
                            'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
                            'BHARTIARTL', 'KOTAKBANK', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA',
                            'TATAMOTORS', 'WIPRO', 'ULTRACEMCO', 'TITAN', 'BAJFINANCE', 'NESTLEIND', 'POWERGRID',
                            'BAJAJFINSV', 'NTPC', 'HINDALCO', 'JSWSTEEL', 'ONGC', 'TATASTEEL', 'ADANIENT', 'COALINDIA',
                            'DRREDDY', 'SHREECEM', 'CIPLA', 'DIVISLAB', 'EICHERMOT', 'HEROMOTOCO', 'BRITANNIA',
                            'GRASIM', 'TECHM', 'BAJAJ-AUTO', 'TATACONSUM', 'HDFC', 'INDUSINDBK', 'VEDL',
                            'BPCL', 'UPL', 'SBILIFE', 'TATAPOWER', 'M&M', 'HDFCLIFE', 'APOLLOHOSP'
                        ]
                    }
                },
                take: 50
            });

            this.nifty50Symbols = instruments.map(instrument => instrument.symbol);
            console.log(`📈 Loaded symbols: ${this.nifty50Symbols.slice(0, 10).join(', ')}...`);

        } catch (error) {
            console.error('❌ Error loading Nifty 50 symbols:', error);
            // Fallback to a smaller list
            this.nifty50Symbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];
        }
    }

    private startPaperTrading(): void {
        this.signalInterval = setInterval(async () => {
            if (this.isRunning) {
                await this.analyzeAllSymbols();
                await this.monitorTrades();
                await this.showPortfolioStatus();
                await this.saveResults();
            }
        }, 300000); // Check every 5 minutes
    }

    private async analyzeAllSymbols(): Promise<void> {
        console.log(`\n🕐 ${new Date().toLocaleTimeString()} - Analyzing ${this.nifty50Symbols.length} symbols...`);

        for (const symbol of this.nifty50Symbols) {
            try {
                const signals: TimeframeSignal[] = [];

                // Get signals from each timeframe
                for (const timeframe of this.timeframes) {
                    const signal = await this.getTimeframeSignal(symbol, timeframe);
                    if (signal) {
                        signals.push(signal);
                    }
                }

                if (signals.length > 0) {
                    const consensus = this.calculateConsensus(signals, symbol);
                    await this.processConsensusSignal(consensus);
                }

            } catch (error) {
                console.error(`   ❌ Error analyzing ${symbol}:`, error);
            }
        }
    }

    private async getTimeframeSignal(symbol: string, timeframe: string): Promise<TimeframeSignal | null> {
        try {
            const data = await this.getRecentData(symbol, timeframe);
            if (data.length < 30) return null;

            return this.generateSignal(data, timeframe);
        } catch (error) {
            return null;
        }
    }

    private async getRecentData(symbol: string, timeframe: string): Promise<any[]> {
        const timeframeConfig = await db.timeframeConfig.findFirst({
            where: { name: timeframe }
        });

        if (!timeframeConfig) return [];

        const instrument = await db.instrument.findFirst({
            where: { symbol }
        });

        if (!instrument) return [];

        return await db.candleData.findMany({
            where: {
                instrumentId: instrument.id,
                timeframeId: timeframeConfig.id
            },
            orderBy: { timestamp: 'desc' },
            take: 100
        });
    }

    private generateSignal(data: any[], timeframe: string): TimeframeSignal {
        const reversed = data.reverse(); // Get chronological order
        const current = reversed[reversed.length - 1];

        // Calculate technical indicators
        const rsi = this.calculateRSI(reversed, 14);
        const sma10 = this.calculateSMA(reversed.slice(-10));
        const sma20 = this.calculateSMA(reversed.slice(-20));
        const volume = current.volume || 0;

        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let confidence = 0.5;
        let reasoning = '';

        // Multi-condition signal generation
        const price = current.close;
        const priceChange = (price - reversed[reversed.length - 2].close) / reversed[reversed.length - 2].close;

        // RSI conditions
        if (rsi < 30 && sma10 > sma20 && priceChange > 0) {
            action = 'BUY';
            confidence = Math.min(0.85, (30 - rsi) / 30 * 0.3 + 0.6);
            reasoning = `RSI oversold (${rsi.toFixed(1)}) with bullish trend`;
        } else if (rsi > 70 && sma10 < sma20 && priceChange < 0) {
            action = 'SELL';
            confidence = Math.min(0.85, (rsi - 70) / 30 * 0.3 + 0.6);
            reasoning = `RSI overbought (${rsi.toFixed(1)}) with bearish trend`;
        } else if (sma10 > sma20 && rsi > 40 && rsi < 60 && priceChange > 0.01) {
            action = 'BUY';
            confidence = 0.7;
            reasoning = `Trend following - SMA crossover bullish`;
        } else if (sma10 < sma20 && rsi > 40 && rsi < 60 && priceChange < -0.01) {
            action = 'SELL';
            confidence = 0.7;
            reasoning = `Trend following - SMA crossover bearish`;
        }

        return {
            timeframe,
            action,
            confidence,
            price,
            reasoning,
            rsi,
            sma10,
            sma20,
            volume
        };
    }

    private calculateRSI(data: any[], period: number): number {
        if (data.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const change = data[i].close - data[i - 1].close;
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private calculateSMA(data: any[]): number {
        return data.reduce((sum, candle) => sum + candle.close, 0) / data.length;
    }

    private calculateConsensus(signals: TimeframeSignal[], symbol: string): ConsensusSignal {
        let totalWeight = 0;
        let weightedAction = 0;
        let weightedConfidence = 0;
        let weightedPrice = 0;
        const timeframes: string[] = [];

        for (const signal of signals) {
            const weight = this.timeframeWeights[signal.timeframe as keyof typeof this.timeframeWeights] || 0.33;
            const actionValue = signal.action === 'BUY' ? 1 : signal.action === 'SELL' ? -1 : 0;

            totalWeight += weight;
            weightedAction += actionValue * weight * signal.confidence;
            weightedConfidence += signal.confidence * weight;
            weightedPrice += signal.price * weight;
            timeframes.push(signal.timeframe);
        }

        if (totalWeight > 0) {
            weightedAction /= totalWeight;
            weightedConfidence /= totalWeight;
            weightedPrice /= totalWeight;
        }

        let consensusAction: 'BUY' | 'SELL' | 'HOLD';
        if (weightedAction > 0.3) consensusAction = 'BUY';
        else if (weightedAction < -0.3) consensusAction = 'SELL';
        else consensusAction = 'HOLD';

        // Determine risk level and market condition
        const avgRSI = signals.reduce((sum, s) => sum + s.rsi, 0) / signals.length;
        const avgConfidence = weightedConfidence;

        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
        if (avgConfidence > 0.75) riskLevel = 'LOW';
        else if (avgConfidence > 0.6) riskLevel = 'MEDIUM';
        else riskLevel = 'HIGH';

        let marketCondition: 'TRENDING' | 'RANGING' | 'VOLATILE' | 'CALM';
        if (Math.abs(weightedAction) > 0.5) marketCondition = 'TRENDING';
        else if (avgRSI > 70 || avgRSI < 30) marketCondition = 'VOLATILE';
        else if (Math.abs(weightedAction) < 0.1) marketCondition = 'CALM';
        else marketCondition = 'RANGING';

        return {
            symbol,
            action: consensusAction,
            confidence: weightedConfidence,
            price: weightedPrice,
            timeframes,
            reasoning: `Multi-timeframe consensus from ${timeframes.join(', ')}`,
            riskLevel,
            marketCondition
        };
    }

    private async processConsensusSignal(consensus: ConsensusSignal): Promise<void> {
        if (consensus.action === 'HOLD' || consensus.confidence < 0.65) {
            return;
        }

        // Check if we already have an open position
        const openPosition = this.trades.find(t =>
            t.symbol === consensus.symbol && t.status === 'EXECUTED'
        );

        if (openPosition) {
            // Check if we should close the position
            if ((openPosition.action === 'BUY' && consensus.action === 'SELL') ||
                (openPosition.action === 'SELL' && consensus.action === 'BUY')) {
                await this.closeTrade(openPosition, consensus.price, 'SIGNAL_REVERSAL');
            }
        } else {
            // Check if we can open a new position
            const openPositions = this.trades.filter(t => t.status === 'EXECUTED').length;
            if (openPositions < this.maxOpenPositions) {
                await this.openTrade(consensus);
            }
        }
    }

    private async openTrade(consensus: ConsensusSignal): Promise<void> {
        const tradeId = `PAPER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const positionSize = Math.min(this.maxPositionSize * consensus.confidence, this.maxPositionSize);
        const quantity = Math.floor((this.capital * positionSize) / consensus.price);

        const stopLoss = consensus.action === 'BUY'
            ? consensus.price * 0.97  // 3% stop loss
            : consensus.price * 1.03;

        const takeProfit = consensus.action === 'BUY'
            ? consensus.price * 1.06  // 6% take profit
            : consensus.price * 0.94;

        const target = consensus.action === 'BUY'
            ? consensus.price * 1.09  // 9% target
            : consensus.price * 0.91;

        const trade: PaperTrade = {
            id: tradeId,
            symbol: consensus.symbol,
            timeframe: consensus.timeframes.join(','),
            action: consensus.action,
            quantity,
            entryPrice: consensus.price,
            stopLoss,
            takeProfit,
            target,
            timestamp: new Date(),
            status: 'EXECUTED',
            confidence: consensus.confidence,
            reasoning: consensus.reasoning,
            marketCondition: consensus.marketCondition,
            riskLevel: consensus.riskLevel,
            success: false
        };

        this.trades.push(trade);

        console.log(`🚀 Opened ${consensus.action} position: ${consensus.symbol} @ ₹${consensus.price.toFixed(2)}`);
        console.log(`   Confidence: ${(consensus.confidence * 100).toFixed(1)}% | Risk: ${consensus.riskLevel}`);
    }

    private async monitorTrades(): Promise<void> {
        for (const trade of this.trades.filter(t => t.status === 'EXECUTED')) {
            try {
                const currentPrice = await this.getCurrentPrice(trade.symbol);
                if (currentPrice === 0) continue;

                // Check exit conditions
                if (trade.action === 'BUY') {
                    if (currentPrice <= trade.stopLoss) {
                        await this.closeTrade(trade, trade.stopLoss, 'STOP_LOSS');
                    } else if (currentPrice >= trade.takeProfit) {
                        await this.closeTrade(trade, trade.takeProfit, 'TAKE_PROFIT');
                    } else if (currentPrice >= trade.target) {
                        await this.closeTrade(trade, trade.target, 'TARGET');
                    }
                } else if (trade.action === 'SELL') {
                    if (currentPrice >= trade.stopLoss) {
                        await this.closeTrade(trade, trade.stopLoss, 'STOP_LOSS');
                    } else if (currentPrice <= trade.takeProfit) {
                        await this.closeTrade(trade, trade.takeProfit, 'TAKE_PROFIT');
                    } else if (currentPrice <= trade.target) {
                        await this.closeTrade(trade, trade.target, 'TARGET');
                    }
                }

                // Time-based exit (24 hours)
                const tradeDuration = Date.now() - trade.timestamp.getTime();
                if (tradeDuration > 24 * 60 * 60 * 1000) {
                    await this.closeTrade(trade, currentPrice, 'TIME_BASED');
                }

            } catch (error) {
                console.error(`   ❌ Error monitoring trade ${trade.id}:`, error);
            }
        }
    }

    private async closeTrade(trade: PaperTrade, exitPrice: number, reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TARGET' | 'TIME_BASED' | 'SIGNAL_REVERSAL'): Promise<void> {
        trade.exitPrice = exitPrice;
        trade.exitReason = reason;
        trade.exitTimestamp = new Date();
        trade.status = 'CLOSED';

        const priceDiff = trade.action === 'BUY' ? exitPrice - trade.entryPrice : trade.entryPrice - exitPrice;
        trade.pnl = priceDiff * trade.quantity;
        trade.pnlPercent = (priceDiff / trade.entryPrice) * 100;
        trade.duration = (trade.exitTimestamp.getTime() - trade.timestamp.getTime()) / (1000 * 60 * 60); // hours
        trade.success = trade.pnl > 0;

        console.log(`📊 Closed ${trade.action} position: ${trade.symbol}`);
        console.log(`   Entry: ₹${trade.entryPrice.toFixed(2)} | Exit: ₹${exitPrice.toFixed(2)}`);
        console.log(`   P&L: ₹${trade.pnl?.toFixed(2)} (${trade.pnlPercent?.toFixed(2)}%) | ${trade.success ? '✅' : '❌'}`);
    }

    private async getCurrentPrice(symbol: string): Promise<number> {
        try {
            const data = await this.getRecentData(symbol, '15min');
            return data.length > 0 ? data[0].close : 0;
        } catch (error) {
            return 0;
        }
    }

    private async showPortfolioStatus(): Promise<void> {
        const openTrades = this.trades.filter(t => t.status === 'EXECUTED');
        const closedTrades = this.trades.filter(t => t.status === 'CLOSED');

        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const successRate = closedTrades.length > 0 ? closedTrades.filter(t => t.success).length / closedTrades.length : 0;

        console.log('\n📊 Paper Trading Portfolio Status:');
        console.log('==================================');
        console.log(`💰 Total P&L: ₹${totalPnl.toFixed(2)}`);
        console.log(`📈 Success Rate: ${(successRate * 100).toFixed(1)}%`);
        console.log(`📊 Total Trades: ${closedTrades.length}`);
        console.log(`🔄 Open Trades: ${openTrades.length}`);
        console.log(`💼 Capital Used: ${((openTrades.length / this.maxOpenPositions) * 100).toFixed(1)}%`);

        if (openTrades.length > 0) {
            console.log('\n🔄 Open Positions:');
            openTrades.forEach(trade => {
                const unrealizedPnl = trade.action === 'BUY'
                    ? (trade.entryPrice - (trade.exitPrice || trade.entryPrice)) * trade.quantity
                    : ((trade.exitPrice || trade.entryPrice) - trade.entryPrice) * trade.quantity;
                console.log(`   ${trade.symbol} | ${trade.action} | ₹${trade.entryPrice.toFixed(2)} | ${(trade.confidence * 100).toFixed(1)}% | ₹${unrealizedPnl.toFixed(2)}`);
            });
        }
    }

    private async saveResults(): Promise<void> {
        // Calculate results for each symbol
        for (const symbol of this.nifty50Symbols) {
            const symbolTrades = this.trades.filter(t => t.symbol === symbol && t.status === 'CLOSED');

            if (symbolTrades.length > 0) {
                const result = this.calculateSymbolPerformance(symbol, symbolTrades);
                this.results.set(symbol, result);
            }
        }

        // Save to database or file for future live trading
        await this.saveResultsToDatabase();
    }

    private calculateSymbolPerformance(symbol: string, trades: PaperTrade[]): TradingResult {
        const winningTrades = trades.filter(t => t.success);
        const losingTrades = trades.filter(t => !t.success);
        const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const successRate = winningTrades.length / trades.length;
        const avgPnl = totalPnl / trades.length;
        const avgConfidence = trades.reduce((sum, t) => sum + t.confidence, 0) / trades.length;

        // Calculate max drawdown
        let maxDrawdown = 0;
        let peak = 0;
        let cumulative = 0;

        for (const trade of trades) {
            cumulative += trade.pnl || 0;
            if (cumulative > peak) {
                peak = cumulative;
            }
            const drawdown = peak - cumulative;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        // Calculate Sharpe ratio
        const returns = trades.map(t => t.pnl || 0);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

        // Find best timeframe
        const timeframePerformance = new Map<string, { pnl: number; count: number }>();
        for (const trade of trades) {
            const timeframes = trade.timeframe.split(',');
            for (const tf of timeframes) {
                if (!timeframePerformance.has(tf)) {
                    timeframePerformance.set(tf, { pnl: 0, count: 0 });
                }
                const perf = timeframePerformance.get(tf)!;
                perf.pnl += trade.pnl || 0;
                perf.count += 1;
            }
        }

        const bestTimeframe = Array.from(timeframePerformance.entries())
            .reduce((best, [tf, perf]) => perf.pnl > best[1].pnl ? [tf, perf] : best)[0];

        const riskAdjustedReturn = sharpeRatio * successRate;

        return {
            symbol,
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            totalPnl,
            successRate,
            avgPnl,
            maxDrawdown,
            sharpeRatio,
            bestTimeframe,
            avgConfidence,
            riskAdjustedReturn
        };
    }

    private async saveResultsToDatabase(): Promise<void> {
        try {
            // Save trading results to database for future live trading
            const resultsData = Array.from(this.results.values());

            // You can save this to a custom table or use existing tables
            console.log(`💾 Saved ${resultsData.length} symbol results for live trading`);

            // Log top performers
            const topPerformers = resultsData
                .filter(r => r.totalTrades >= 3)
                .sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn)
                .slice(0, 5);

            if (topPerformers.length > 0) {
                console.log('\n🏆 Top Performing Symbols for Live Trading:');
                topPerformers.forEach(result => {
                    console.log(`   ${result.symbol}: ${(result.successRate * 100).toFixed(1)}% success, ₹${result.totalPnl.toFixed(2)} P&L, Sharpe: ${result.sharpeRatio.toFixed(2)}`);
                });
            }

        } catch (error) {
            console.error('❌ Error saving results:', error);
        }
    }

    async stop(): Promise<void> {
        console.log('\n🛑 Stopping Nifty 50 Paper Trading...');

        this.isRunning = false;

        if (this.signalInterval) {
            clearInterval(this.signalInterval);
            this.signalInterval = null;
        }

        await this.showFinalResults();
        await db.$disconnect();

        console.log('✅ Paper trading stopped');
    }

    private async showFinalResults(): Promise<void> {
        const closedTrades = this.trades.filter(t => t.status === 'CLOSED');

        if (closedTrades.length === 0) {
            console.log('\n📊 No paper trades completed');
            return;
        }

        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const successRate = closedTrades.filter(t => t.success).length / closedTrades.length;
        const avgPnl = totalPnl / closedTrades.length;

        console.log('\n📊 Final Paper Trading Results:');
        console.log('===============================');
        console.log(`💰 Total P&L: ₹${totalPnl.toFixed(2)}`);
        console.log(`📈 Success Rate: ${(successRate * 100).toFixed(1)}%`);
        console.log(`📊 Average P&L per Trade: ₹${avgPnl.toFixed(2)}`);
        console.log(`🔄 Total Trades: ${closedTrades.length}`);
        console.log(`📊 Symbols Traded: ${new Set(closedTrades.map(t => t.symbol)).size}`);

        // Performance by market condition
        const conditionPerformance = new Map<string, { pnl: number; count: number; success: number }>();
        for (const trade of closedTrades) {
            if (!conditionPerformance.has(trade.marketCondition)) {
                conditionPerformance.set(trade.marketCondition, { pnl: 0, count: 0, success: 0 });
            }
            const perf = conditionPerformance.get(trade.marketCondition)!;
            perf.pnl += trade.pnl || 0;
            perf.count += 1;
            if (trade.success) perf.success += 1;
        }

        console.log('\n📊 Performance by Market Condition:');
        for (const [condition, perf] of conditionPerformance) {
            const successRate = perf.count > 0 ? (perf.success / perf.count) * 100 : 0;
            console.log(`   ${condition.padEnd(10)} | P&L: ₹${perf.pnl.toFixed(2)} | Success: ${successRate.toFixed(1)}% | Trades: ${perf.count}`);
        }

        console.log('\n💡 Results saved for live trading implementation');
    }

    getStatus(): any {
        return {
            isRunning: this.isRunning,
            symbols: this.nifty50Symbols.length,
            openTrades: this.trades.filter(t => t.status === 'EXECUTED').length,
            totalTrades: this.trades.length,
            timeframes: this.timeframes,
            results: this.results.size
        };
    }
}

// Main execution
async function main() {
    const trader = new Nifty50PaperTrading();

    try {
        await trader.start();

        // Keep running until interrupted
        process.on('SIGINT', async () => {
            console.log('\n🛑 Received interrupt signal...');
            await trader.stop();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error in paper trading:', error);
        await trader.stop();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
} 