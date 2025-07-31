#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import * as fs from 'fs/promises';
import * as path from 'path';

interface LossPattern {
    pattern: string;
    count: number;
    totalLoss: number;
    avgLoss: number;
    percentage: number;
}

interface TradeAnalysis {
    symbol: string;
    action: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPercent: number;
    confidence: number;
    rsi: number;
    priceToSMA20: number;
    smaDiff: number;
    volume: number;
    volatility: number;
    marketTrend: string;
    closeReason: string;
    timeOfDay: string;
    dayOfWeek: string;
}

class LossAnalysis {
    private resultsDir: string;
    private symbols: string[];

    constructor() {
        this.resultsDir = path.join(__dirname, '..', 'data', 'paper-trading-results');
        this.symbols = [
            'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR',
            'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK', 'AXISBANK', 'ASIANPAINT',
            'MARUTI', 'HCLTECH', 'SUNPHARMA'
        ];
    }

    async analyzeLosses(): Promise<void> {
        console.log('🔍 Analyzing Losing Trades Patterns...\n');

        try {
            await db.$connect();

            // Get losing trades from backtest
            const losingTrades = await this.getLosingTrades();

            if (losingTrades.length === 0) {
                console.log('❌ No losing trades found to analyze');
                return;
            }

            console.log(`📊 Found ${losingTrades.length} losing trades to analyze\n`);

            // Analyze patterns
            const patterns = this.analyzePatterns(losingTrades);

            // Display analysis
            this.displayLossAnalysis(patterns, losingTrades);

            // Generate filters
            const filters = this.generateFilters(patterns);

            // Test filters
            await this.testFilters(filters);

            // Save analysis
            await this.saveAnalysis(patterns, filters);

        } catch (error) {
            console.error('❌ Error analyzing losses:', error);
        } finally {
            await db.$disconnect();
        }
    }

    private async getLosingTrades(): Promise<TradeAnalysis[]> {
        const losingTrades: TradeAnalysis[] = [];

        // Get one month of data
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        for (const symbol of this.symbols.slice(0, 8)) {
            try {
                const data = await db.candleData.findMany({
                    where: {
                        instrument: { symbol },
                        timeframe: { name: '15min' },
                        timestamp: { gte: oneMonthAgo }
                    },
                    orderBy: { timestamp: 'asc' }
                });

                if (data.length < 50) continue;

                // Simulate trades and collect losing ones
                for (let i = 50; i < data.length - 1; i++) {
                    const current = data[i]!;
                    const next = data[i + 1]!;

                    // Calculate indicators
                    const rsi = this.calculateRSI(data.slice(0, i + 1));
                    const sma20 = this.calculateSMA(data.slice(0, i + 1), 20);
                    const sma50 = this.calculateSMA(data.slice(0, i + 1), 50);

                    // Generate signal
                    const signal = this.generateSignal(current.close, rsi, sma20, sma50);

                    if (signal.action !== 'HOLD') {
                        const confidence = this.calculateConfidence(rsi, sma20, sma50, current.close);

                        if (confidence >= 0.75) { // Use conservative strategy
                            const positionSize = Math.floor(100000 / current.close);
                            const stopLoss = signal.action === 'BUY'
                                ? current.close * 0.99 // 1% stop loss
                                : current.close * 1.01;
                            const takeProfit = signal.action === 'BUY'
                                ? current.close * 1.02 // 2% take profit
                                : current.close * 0.98;

                            // Simulate trade
                            const tradeResult = this.simulateTrade(
                                signal.action, current.close, next.close, stopLoss, takeProfit, positionSize
                            );

                            // Only collect losing trades
                            if (!tradeResult.success) {
                                const priceToSMA20 = Math.abs((current.close - sma20) / sma20);
                                const smaDiff = Math.abs((sma20 - sma50) / sma50);
                                const volatility = this.calculateVolatility(data.slice(i - 10, i + 1));
                                const marketTrend = this.getMarketTrend(data.slice(i - 20, i + 1));

                                losingTrades.push({
                                    symbol,
                                    action: signal.action,
                                    entryPrice: current.close,
                                    exitPrice: tradeResult.exitPrice,
                                    pnl: tradeResult.pnl,
                                    pnlPercent: tradeResult.pnlPercent,
                                    confidence,
                                    rsi,
                                    priceToSMA20,
                                    smaDiff,
                                    volume: current.volume || 0,
                                    volatility,
                                    marketTrend,
                                    closeReason: tradeResult.closeReason,
                                    timeOfDay: current.timestamp.toTimeString().split(' ')[0].substring(0, 5),
                                    dayOfWeek: current.timestamp.toDateString().split(' ')[0]
                                });
                            }
                        }
                    }
                }

            } catch (error) {
                console.error(`Error analyzing ${symbol}:`, error);
            }
        }

        return losingTrades;
    }

    private calculateRSI(data: any[], period: number = 14): number {
        if (data.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = data.length - period; i < data.length; i++) {
            const change = data[i]!.close - data[i - 1]!.close;
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

    private calculateSMA(data: any[], period: number): number {
        if (data.length < period) return data[data.length - 1]!.close;

        const sum = data.slice(-period).reduce((acc, candle) => acc + candle.close, 0);
        return sum / period;
    }

    private generateSignal(price: number, rsi: number, sma20: number, sma50: number): { action: 'BUY' | 'SELL' | 'HOLD' } {
        const priceToSMA20 = Math.abs((price - sma20) / sma20);

        // Conservative strategy
        if (rsi < 40 && price < sma20 && priceToSMA20 < 0.02) {
            return { action: 'BUY' };
        }

        if (rsi > 60 && price > sma20 && priceToSMA20 < 0.02) {
            return { action: 'SELL' };
        }

        return { action: 'HOLD' };
    }

    private calculateConfidence(rsi: number, sma20: number, sma50: number, price: number): number {
        let confidence = 0.5;

        if (rsi < 30 || rsi > 70) confidence += 0.2;
        else if (rsi < 40 || rsi > 60) confidence += 0.1;

        const priceToSMA20 = Math.abs((price - sma20) / sma20);
        if (priceToSMA20 < 0.01) confidence += 0.2;
        else if (priceToSMA20 < 0.02) confidence += 0.1;

        return Math.min(confidence, 0.95);
    }

    private simulateTrade(action: 'BUY' | 'SELL', entryPrice: number, exitPrice: number, stopLoss: number, takeProfit: number, quantity: number): any {
        let actualExitPrice = exitPrice;
        let closeReason = 'End of period';
        let success = false;

        if (action === 'BUY') {
            if (exitPrice <= stopLoss) {
                actualExitPrice = stopLoss;
                closeReason = 'Stop Loss';
                success = false;
            } else if (exitPrice >= takeProfit) {
                actualExitPrice = takeProfit;
                closeReason = 'Take Profit';
                success = true;
            } else {
                success = exitPrice > entryPrice;
            }
        } else {
            if (exitPrice >= stopLoss) {
                actualExitPrice = stopLoss;
                closeReason = 'Stop Loss';
                success = false;
            } else if (exitPrice <= takeProfit) {
                actualExitPrice = takeProfit;
                closeReason = 'Take Profit';
                success = true;
            } else {
                success = exitPrice < entryPrice;
            }
        }

        const pnl = action === 'BUY'
            ? (actualExitPrice - entryPrice) * quantity
            : (entryPrice - actualExitPrice) * quantity;

        const pnlPercent = action === 'BUY'
            ? ((actualExitPrice - entryPrice) / entryPrice) * 100
            : ((entryPrice - actualExitPrice) / entryPrice) * 100;

        return {
            exitPrice: actualExitPrice,
            pnl,
            pnlPercent,
            success,
            closeReason
        };
    }

    private calculateVolatility(data: any[]): number {
        if (data.length < 2) return 0;

        const returns = data.slice(1).map((candle, i) =>
            Math.abs((candle.close - data[i]!.close) / data[i]!.close)
        );

        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        return avgReturn;
    }

    private getMarketTrend(data: any[]): string {
        if (data.length < 10) return 'NEUTRAL';

        const firstHalf = data.slice(0, Math.floor(data.length / 2));
        const secondHalf = data.slice(Math.floor(data.length / 2));

        const firstAvg = firstHalf.reduce((sum, c) => sum + c.close, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, c) => sum + c.close, 0) / secondHalf.length;

        const trend = ((secondAvg - firstAvg) / firstAvg) * 100;

        if (trend > 1) return 'UPTREND';
        if (trend < -1) return 'DOWNTREND';
        return 'NEUTRAL';
    }

    private analyzePatterns(losingTrades: TradeAnalysis[]): LossPattern[] {
        const patterns: { [key: string]: any } = {};

        for (const trade of losingTrades) {
            // Analyze RSI patterns
            if (trade.rsi < 30) {
                this.addPattern(patterns, 'RSI Extreme Oversold', trade);
            } else if (trade.rsi > 70) {
                this.addPattern(patterns, 'RSI Extreme Overbought', trade);
            } else if (trade.rsi < 40) {
                this.addPattern(patterns, 'RSI Oversold', trade);
            } else if (trade.rsi > 60) {
                this.addPattern(patterns, 'RSI Overbought', trade);
            }

            // Analyze price patterns
            if (trade.priceToSMA20 > 0.03) {
                this.addPattern(patterns, 'Price Far from SMA20', trade);
            }

            // Analyze market trend
            if (trade.marketTrend === 'DOWNTREND' && trade.action === 'BUY') {
                this.addPattern(patterns, 'Buy in Downtrend', trade);
            } else if (trade.marketTrend === 'UPTREND' && trade.action === 'SELL') {
                this.addPattern(patterns, 'Sell in Uptrend', trade);
            }

            // Analyze volatility
            if (trade.volatility > 0.02) {
                this.addPattern(patterns, 'High Volatility', trade);
            }

            // Analyze time patterns
            if (trade.timeOfDay.startsWith('09:') || trade.timeOfDay.startsWith('15:')) {
                this.addPattern(patterns, 'Market Open/Close', trade);
            }

            // Analyze close reasons
            if (trade.closeReason === 'Stop Loss') {
                this.addPattern(patterns, 'Stop Loss Hit', trade);
            }
        }

        // Convert to array and sort by count
        const patternArray = Object.values(patterns).map(p => ({
            pattern: p.name,
            count: p.count,
            totalLoss: p.totalLoss,
            avgLoss: p.totalLoss / p.count,
            percentage: (p.count / losingTrades.length) * 100
        }));

        return patternArray.sort((a, b) => b.count - a.count);
    }

    private addPattern(patterns: { [key: string]: any }, name: string, trade: TradeAnalysis): void {
        if (!patterns[name]) {
            patterns[name] = { name, count: 0, totalLoss: 0 };
        }
        patterns[name].count++;
        patterns[name].totalLoss += Math.abs(trade.pnl);
    }

    private displayLossAnalysis(patterns: LossPattern[], losingTrades: TradeAnalysis[]): void {
        console.log('📊 LOSS PATTERN ANALYSIS');
        console.log('========================\n');

        console.log('🔍 TOP LOSS PATTERNS:');
        console.log('======================');

        patterns.slice(0, 10).forEach((pattern, index) => {
            console.log(`${index + 1}. ${pattern.pattern}:`);
            console.log(`   📊 Count: ${pattern.count} (${pattern.percentage.toFixed(1)}%)`);
            console.log(`   💰 Total Loss: ₹${pattern.totalLoss.toFixed(2)}`);
            console.log(`   📉 Avg Loss: ₹${pattern.avgLoss.toFixed(2)}`);
            console.log('');
        });

        // Analyze by symbol
        const symbolLosses: { [key: string]: number } = {};
        for (const trade of losingTrades) {
            symbolLosses[trade.symbol] = (symbolLosses[trade.symbol] || 0) + Math.abs(trade.pnl);
        }

        console.log('📈 SYMBOL LOSS ANALYSIS:');
        console.log('========================');
        Object.entries(symbolLosses)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([symbol, loss]) => {
                console.log(`${symbol}: ₹${loss.toFixed(2)}`);
            });
        console.log('');

        // Analyze by time
        const timeLosses: { [key: string]: number } = {};
        for (const trade of losingTrades) {
            timeLosses[trade.timeOfDay] = (timeLosses[trade.timeOfDay] || 0) + Math.abs(trade.pnl);
        }

        console.log('⏰ TIME-BASED LOSS ANALYSIS:');
        console.log('============================');
        Object.entries(timeLosses)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([time, loss]) => {
                console.log(`${time}: ₹${loss.toFixed(2)}`);
            });
        console.log('');
    }

    private generateFilters(patterns: LossPattern[]): any {
        const filters: any = {
            rsi: { min: 40, max: 60 },
            volatility: { max: 0.015 },
            marketTrend: { avoid: ['DOWNTREND', 'UPTREND'] },
            timeOfDay: { avoid: ['09:00', '09:15', '09:30', '15:00', '15:15', '15:30'] },
            priceToSMA20: { max: 0.02 },
            confidence: { min: 0.85 }
        };

        // Adjust filters based on patterns
        const stopLossPattern = patterns.find(p => p.pattern === 'Stop Loss Hit');
        if (stopLossPattern && stopLossPattern.percentage > 30) {
            filters.stopLoss = { reduce: true };
        }

        const volatilityPattern = patterns.find(p => p.pattern === 'High Volatility');
        if (volatilityPattern && volatilityPattern.percentage > 20) {
            filters.volatility.max = 0.01;
        }

        return filters;
    }

    private async testFilters(filters: any): Promise<void> {
        console.log('🧪 TESTING FILTERS:');
        console.log('===================');
        console.log('⚙️  Generated Filters:');
        console.log(`   RSI Range: ${filters.rsi.min}-${filters.rsi.max}`);
        console.log(`   Max Volatility: ${(filters.volatility.max * 100).toFixed(1)}%`);
        console.log(`   Min Confidence: ${(filters.confidence.min * 100).toFixed(0)}%`);
        console.log(`   Avoid Times: ${filters.timeOfDay.avoid.join(', ')}`);
        console.log('');

        // Test with historical data
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        let totalTrades = 0;
        let winningTrades = 0;
        let totalPnl = 0;

        for (const symbol of this.symbols.slice(0, 5)) {
            try {
                const data = await db.candleData.findMany({
                    where: {
                        instrument: { symbol },
                        timeframe: { name: '15min' },
                        timestamp: { gte: oneMonthAgo }
                    },
                    orderBy: { timestamp: 'asc' }
                });

                if (data.length < 50) continue;

                for (let i = 50; i < data.length - 1; i++) {
                    const current = data[i]!;
                    const next = data[i + 1]!;

                    // Apply filters
                    if (!this.passFilters(current, filters)) continue;

                    const rsi = this.calculateRSI(data.slice(0, i + 1));
                    const sma20 = this.calculateSMA(data.slice(0, i + 1), 20);
                    const sma50 = this.calculateSMA(data.slice(0, i + 1), 50);

                    const signal = this.generateSignal(current.close, rsi, sma20, sma50);
                    const confidence = this.calculateConfidence(rsi, sma20, sma50, current.close);

                    if (signal.action !== 'HOLD' && confidence >= filters.confidence.min) {
                        const positionSize = Math.floor(100000 / current.close);
                        const stopLoss = signal.action === 'BUY'
                            ? current.close * 0.99
                            : current.close * 1.01;
                        const takeProfit = signal.action === 'BUY'
                            ? current.close * 1.02
                            : current.close * 0.98;

                        const tradeResult = this.simulateTrade(
                            signal.action, current.close, next.close, stopLoss, takeProfit, positionSize
                        );

                        totalTrades++;
                        if (tradeResult.success) winningTrades++;
                        totalPnl += tradeResult.pnl;
                    }
                }

            } catch (error) {
                console.error(`Error testing filters for ${symbol}:`, error);
            }
        }

        const successRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

        console.log('📊 FILTER TEST RESULTS:');
        console.log('========================');
        console.log(`📊 Total Trades: ${totalTrades}`);
        console.log(`✅ Winning Trades: ${winningTrades}`);
        console.log(`📈 Success Rate: ${(successRate * 100).toFixed(1)}%`);
        console.log(`💰 Total P&L: ₹${totalPnl.toFixed(2)}`);
        console.log(`📊 Avg P&L per Trade: ₹${totalTrades > 0 ? (totalPnl / totalTrades).toFixed(2) : 0}`);
        console.log('');

        if (successRate > 0.5 && totalPnl > 0) {
            console.log('✅ FILTERS SUCCESSFUL - Ready for implementation!');
        } else {
            console.log('❌ FILTERS NEED REFINEMENT');
        }
    }

    private passFilters(candle: any, filters: any): boolean {
        // Time filter
        const timeOfDay = candle.timestamp.toTimeString().substring(0, 5);
        if (filters.timeOfDay.avoid.includes(timeOfDay)) {
            return false;
        }

        // Volatility filter
        // Note: This would need to be calculated from previous candles
        // For now, we'll skip this check

        return true;
    }

    private async saveAnalysis(patterns: LossPattern[], filters: any): Promise<void> {
        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `loss-analysis-${timestamp}.json`;
            const filepath = path.join(this.resultsDir, filename);

            const analysis = {
                timestamp: new Date().toISOString(),
                patterns,
                filters,
                summary: {
                    totalPatterns: patterns.length,
                    topPattern: patterns[0],
                    recommendedFilters: filters
                }
            };

            await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));
            console.log(`💾 Loss analysis saved to: ${filepath}`);

        } catch (error) {
            console.error('❌ Error saving analysis:', error);
        }
    }
}

// Main execution
async function main() {
    const analysis = new LossAnalysis();
    await analysis.analyzeLosses();
}

if (require.main === module) {
    main();
} 