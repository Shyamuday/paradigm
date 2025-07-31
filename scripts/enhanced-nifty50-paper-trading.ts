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
    optimalPositionSize: number;
    optimalStopLoss: number;
    optimalTakeProfit: number;
}

class EnhancedNifty50PaperTrading {
    private timeframes = ['15min', '30min', '1hour'];
    private timeframeWeights = {
        '15min': 0.4,
        '30min': 0.35,
        '1hour': 0.25
    };
    private capital = 1000000; // 10 Lakhs
    private maxPositionSize = 0.05; // 5% per trade
    private maxOpenPositions = 10;
    private trades: PaperTrade[] = [];
    private results: Map<string, TradingResult> = new Map();
    private isRunning = false;
    private signalInterval: NodeJS.Timeout | null = null;
    private nifty50Symbols: string[] = [];

    async start(): Promise<void> {
        console.log('🚀 Starting Enhanced Nifty 50 Paper Trading...\n');

        try {
            await db.$connect();
            console.log('✅ Database connected');

            await this.loadNifty50Symbols();
            console.log(`📊 Loaded ${this.nifty50Symbols.length} symbols`);

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
        // Use a subset of Nifty 50 for testing
        this.nifty50Symbols = [
            'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
            'BHARTIARTL', 'KOTAKBANK', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA'
        ];
        console.log(`📈 Trading symbols: ${this.nifty50Symbols.join(', ')}`);
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

        let totalSignals = 0;

        for (const symbol of this.nifty50Symbols) {
            try {
                const signals = await this.getMultiTimeframeSignals(symbol);

                if (signals.length > 0) {
                    const consensus = this.calculateConsensus(signals, symbol);
                    await this.processConsensusSignal(consensus);
                    totalSignals++;
                }

            } catch (error) {
                console.error(`   ❌ Error analyzing ${symbol}:`, error);
            }
        }

        console.log(`   📊 Generated ${totalSignals} consensus signals`);
    }

    private async getMultiTimeframeSignals(symbol: string): Promise<any[]> {
        const signals: any[] = [];

        for (const timeframe of this.timeframes) {
            try {
                const data = await this.getRecentData(symbol, timeframe);
                if (data.length < 30) continue;

                const signal = this.generateSignal(data, symbol, timeframe);
                if (signal) {
                    signals.push(signal);
                }
            } catch (error) {
                // Continue with other timeframes
            }
        }

        return signals;
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

    private generateSignal(data: any[], symbol: string, timeframe: string): any {
        const reversed = data.reverse();
        const current = reversed[reversed.length - 1];

        // Calculate multiple indicators
        const rsi = this.calculateRSI(reversed, 14);
        const sma10 = this.calculateSMA(reversed.slice(-10));
        const sma20 = this.calculateSMA(reversed.slice(-20));
        const sma50 = this.calculateSMA(reversed.slice(-50));
        const volume = current.volume || 0;

        // Multiple signal conditions
        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let confidence = 0.5;
        let reasoning = '';

        const price = current.close;
        const priceChange = (price - reversed[reversed.length - 2].close) / reversed[reversed.length - 2].close;

        // Condition 1: RSI oversold/overbought with trend confirmation
        if (rsi < 35 && sma10 > sma20 && priceChange > 0) {
            action = 'BUY';
            confidence = Math.min(0.85, (35 - rsi) / 35 * 0.3 + 0.6);
            reasoning = `RSI oversold (${rsi.toFixed(1)}) with bullish trend`;
        } else if (rsi > 65 && sma10 < sma20 && priceChange < 0) {
            action = 'SELL';
            confidence = Math.min(0.85, (rsi - 65) / 35 * 0.3 + 0.6);
            reasoning = `RSI overbought (${rsi.toFixed(1)}) with bearish trend`;
        }
        // Condition 2: Moving average crossover
        else if (sma10 > sma20 && sma20 > sma50 && priceChange > 0.005) {
            action = 'BUY';
            confidence = 0.7;
            reasoning = `Strong uptrend - MA crossover`;
        } else if (sma10 < sma20 && sma20 < sma50 && priceChange < -0.005) {
            action = 'SELL';
            confidence = 0.7;
            reasoning = `Strong downtrend - MA crossover`;
        }
        // Condition 3: Momentum breakout
        else if (price > sma20 * 1.02 && rsi > 50 && rsi < 70) {
            action = 'BUY';
            confidence = 0.65;
            reasoning = `Momentum breakout above MA20`;
        } else if (price < sma20 * 0.98 && rsi < 50 && rsi > 30) {
            action = 'SELL';
            confidence = 0.65;
            reasoning = `Momentum breakdown below MA20`;
        }

        if (action !== 'HOLD' && confidence > 0.6) {
            return {
                symbol,
                timeframe,
                action,
                price,
                confidence,
                reasoning,
                rsi,
                sma10,
                sma20,
                volume
            };
        }

        return null;
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

    private calculateConsensus(signals: any[], symbol: string): any {
        if (signals.length === 0) return null;

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

        return {
            symbol,
            action: consensusAction,
            confidence: weightedConfidence,
            price: weightedPrice,
            timeframes,
            reasoning: `Multi-timeframe consensus from ${timeframes.join(', ')}`
        };
    }

    private async processConsensusSignal(consensus: any): Promise<void> {
        if (!consensus || consensus.action === 'HOLD' || consensus.confidence < 0.65) {
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

    private async openTrade(consensus: any): Promise<void> {
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
            marketCondition: 'TRENDING',
            riskLevel: consensus.confidence > 0.75 ? 'LOW' : consensus.confidence > 0.65 ? 'MEDIUM' : 'HIGH',
            success: false
        };

        this.trades.push(trade);

        console.log(`🚀 Opened ${consensus.action} position: ${consensus.symbol} @ ₹${consensus.price.toFixed(2)}`);
        console.log(`   Confidence: ${(consensus.confidence * 100).toFixed(1)}% | Quantity: ${quantity}`);
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

        // Save to file for future live trading
        await this.saveResultsToFile();
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

        // Calculate optimal parameters
        const optimalPositionSize = Math.min(0.1, Math.max(0.02, successRate * 0.1));
        const optimalStopLoss = Math.max(0.02, Math.min(0.05, (1 - successRate) * 0.1));
        const optimalTakeProfit = optimalStopLoss * 2;

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
            riskAdjustedReturn,
            optimalPositionSize,
            optimalStopLoss,
            optimalTakeProfit
        };
    }

    private async saveResultsToFile(): Promise<void> {
        const fs = require('fs').promises;
        const path = require('path');

        const resultsDir = path.join(__dirname, '..', 'data', 'paper-trading-results');

        try {
            await fs.mkdir(resultsDir, { recursive: true });

            const resultsData = Array.from(this.results.values());
            const filename = `nifty50-paper-trading-results-${new Date().toISOString().split('T')[0]}.json`;
            const filepath = path.join(resultsDir, filename);

            const data = {
                timestamp: new Date().toISOString(),
                totalSymbols: resultsData.length,
                results: resultsData,
                summary: {
                    totalTrades: resultsData.reduce((sum, r) => sum + r.totalTrades, 0),
                    totalPnl: resultsData.reduce((sum, r) => sum + r.totalPnl, 0),
                    avgSuccessRate: resultsData.reduce((sum, r) => sum + r.successRate, 0) / resultsData.length,
                    topPerformers: resultsData
                        .filter(r => r.totalTrades >= 3)
                        .sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn)
                        .slice(0, 5)
                        .map(r => ({
                            symbol: r.symbol,
                            successRate: r.successRate,
                            totalPnl: r.totalPnl,
                            sharpeRatio: r.sharpeRatio,
                            bestTimeframe: r.bestTimeframe
                        }))
                }
            };

            await fs.writeFile(filepath, JSON.stringify(data, null, 2));
            console.log(`💾 Results saved to: ${filepath}`);

            // Show top performers
            if (data.summary.topPerformers.length > 0) {
                console.log('\n🏆 Top Performing Symbols:');
                data.summary.topPerformers.forEach((performer, index) => {
                    console.log(`${index + 1}. ${performer.symbol}: ${(performer.successRate * 100).toFixed(1)}% success, ₹${performer.totalPnl.toFixed(2)} P&L`);
                });
            }

        } catch (error) {
            console.error('❌ Error saving results:', error);
        }
    }

    async stop(): Promise<void> {
        console.log('\n🛑 Stopping Enhanced Nifty 50 Paper Trading...');

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
    const trader = new EnhancedNifty50PaperTrading();

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