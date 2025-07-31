#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import * as fs from 'fs/promises';
import * as path from 'path';

interface FailedTradeAnalysis {
    symbol: string;
    timeframe: string;
    totalTrades: number;
    failedTrades: number;
    failureRate: number;
    avgLossPerTrade: number;
    totalLoss: number;
    failurePatterns: {
        timeOfDay: { [hour: string]: number };
        dayOfWeek: { [day: string]: number };
        marketCondition: { [condition: string]: number };
        rsiLevel: { [level: string]: number };
        priceAction: { [action: string]: number };
    };
    recommendations: string[];
}

interface TradeDetail {
    symbol: string;
    action: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    entryTime: Date;
    exitTime: Date;
    rsiAtEntry: number;
    sma20AtEntry: number;
    priceChange: number;
    volumeAtEntry: number;
    failureReason: string;
    loss: number;
}

class FailedTradeAnalyzer {
    private resultsDir: string;
    private symbols: string[] = [
        'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
        'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA', 'TITAN', 'WIPRO', 'ULTRACEMCO', 'TECHM', 'POWERGRID',
        'NESTLEIND', 'BAJFINANCE', 'NTPC', 'BAJAJFINSV', 'ONGC', 'ADANIENT', 'JSWSTEEL', 'TATAMOTORS', 'HINDALCO', 'COALINDIA',
        'BRITANNIA', 'TATASTEEL', 'CIPLA', 'SHREECEM', 'DIVISLAB', 'EICHERMOT', 'HEROMOTOCO', 'DRREDDY', 'BPCL', 'INDUSINDBK',
        'TATACONSUM', 'SBI', 'HDFC', 'VEDL', 'GRASIM', 'M&M', 'UPL', 'TATAPOWER', 'BAJAJ-AUTO', 'HINDCOPPER', 'APOLLOHOSP'
    ];

    constructor() {
        this.resultsDir = path.join(__dirname, '..', 'data', 'paper-trading-results');
    }

    async analyzeFailedTrades(): Promise<void> {
        console.log('🔍 Analyzing Failed Trades - Understanding Loss Patterns\n');

        try {
            await db.$connect();

            const allFailedAnalyses: FailedTradeAnalysis[] = [];
            const allFailedTrades: TradeDetail[] = [];

            for (const symbol of this.symbols) {
                console.log(`🔄 Analyzing failed trades for ${symbol}...`);
                const analysis = await this.analyzeSymbolFailedTrades(symbol);
                if (analysis.failedTrades > 0) {
                    allFailedAnalyses.push(analysis);
                }
            }

            // Generate comprehensive failed trade analysis
            this.generateFailedTradeInsights(allFailedAnalyses, allFailedTrades);

            // Generate improvement recommendations
            this.generateImprovementStrategies(allFailedAnalyses);

            // Save detailed analysis
            await this.saveFailedTradeAnalysis(allFailedAnalyses, allFailedTrades);

        } catch (error) {
            console.error('❌ Error analyzing failed trades:', error);
        } finally {
            await db.$disconnect();
        }
    }

    private async analyzeSymbolFailedTrades(symbol: string): Promise<FailedTradeAnalysis> {
        const timeframes = ['15min', '30min', '1hour', '1day'];
        const allFailedTrades: TradeDetail[] = [];
        let totalTrades = 0;
        let failedTrades = 0;
        let totalLoss = 0;

        for (const timeframe of timeframes) {
            const data = await this.getSymbolData(symbol, timeframe);
            if (data.length < 50) continue;

            const trades = await this.generateTrades(data, symbol, timeframe);
            const failedTradesForTimeframe = trades.filter(t => !t.success);

            totalTrades += trades.length;
            failedTrades += failedTradesForTimeframe.length;
            totalLoss += failedTradesForTimeframe.reduce((sum, t) => sum + Math.abs(t.pnl), 0);

            // Convert to detailed format
            failedTradesForTimeframe.forEach(trade => {
                allFailedTrades.push({
                    symbol,
                    action: trade.action,
                    entryPrice: trade.entryPrice,
                    exitPrice: trade.exitPrice,
                    entryTime: trade.entryTime || new Date(),
                    exitTime: trade.exitTime || new Date(),
                    rsiAtEntry: trade.rsiAtEntry || 50,
                    sma20AtEntry: trade.sma20AtEntry || 0,
                    priceChange: trade.priceChange || 0,
                    volumeAtEntry: trade.volumeAtEntry || 0,
                    failureReason: this.determineFailureReason(trade),
                    loss: Math.abs(trade.pnl)
                });
            });
        }

        const failurePatterns = this.analyzeFailurePatterns(allFailedTrades);
        const recommendations = this.generateSymbolRecommendations(allFailedTrades);

        return {
            symbol,
            timeframe: 'multiple',
            totalTrades,
            failedTrades,
            failureRate: totalTrades > 0 ? failedTrades / totalTrades : 0,
            avgLossPerTrade: failedTrades > 0 ? totalLoss / failedTrades : 0,
            totalLoss,
            failurePatterns,
            recommendations
        };
    }

    private async getSymbolData(symbol: string, timeframe: string): Promise<any[]> {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        return await db.candleData.findMany({
            where: {
                instrument: { symbol },
                timeframe: { name: timeframe },
                timestamp: { gte: oneMonthAgo }
            },
            orderBy: { timestamp: 'asc' }
        });
    }

    private async generateTrades(data: any[], symbol: string, timeframe: string): Promise<any[]> {
        const trades: any[] = [];

        for (let i = 50; i < data.length - 1; i++) {
            const current = data[i]!;
            const next = data[i + 1]!;

            const rsi = this.calculateRSI(data.slice(0, i + 1));
            const sma20 = this.calculateSMA(data.slice(0, i + 1), 20);

            let action = 'HOLD';
            if (rsi < 30 && current.close < sma20) {
                action = 'BUY';
            } else if (rsi > 70 && current.close > sma20) {
                action = 'SELL';
            }

            if (action !== 'HOLD') {
                const trade = this.simulateTrade(action, current, next, rsi, sma20);
                trades.push(trade);
            }
        }

        return trades;
    }

    private simulateTrade(action: string, current: any, next: any, rsi: number, sma20: number): any {
        const quantity = Math.max(1, Math.floor(100000 * 0.1 / current.close));
        const stopLoss = action === 'BUY' ? current.close * 0.98 : current.close * 1.02;
        const takeProfit = action === 'BUY' ? current.close * 1.03 : current.close * 0.97;

        let actualExitPrice = next.close;
        let success = false;

        if (action === 'BUY') {
            if (next.close <= stopLoss) {
                actualExitPrice = stopLoss;
                success = false;
            } else if (next.close >= takeProfit) {
                actualExitPrice = takeProfit;
                success = true;
            } else {
                success = next.close > current.close;
            }
        } else {
            if (next.close >= stopLoss) {
                actualExitPrice = stopLoss;
                success = false;
            } else if (next.close <= takeProfit) {
                actualExitPrice = takeProfit;
                success = true;
            } else {
                success = next.close < current.close;
            }
        }

        const pnl = action === 'BUY'
            ? (actualExitPrice - current.close) * quantity
            : (current.close - actualExitPrice) * quantity;

        return {
            action,
            entryPrice: current.close,
            exitPrice: actualExitPrice,
            quantity,
            pnl,
            success,
            entryTime: current.timestamp,
            exitTime: next.timestamp,
            rsiAtEntry: rsi,
            sma20AtEntry: sma20,
            priceChange: (next.close - current.close) / current.close,
            volumeAtEntry: current.volume || 0
        };
    }

    private determineFailureReason(trade: any): string {
        const priceChange = trade.priceChange;
        const rsi = trade.rsiAtEntry;

        if (trade.action === 'BUY') {
            if (priceChange < -0.02) return 'Sharp Price Decline';
            if (rsi < 25) return 'Oversold Trap';
            if (rsi > 45) return 'RSI Not Low Enough';
            return 'Market Reversal';
        } else {
            if (priceChange > 0.02) return 'Sharp Price Rise';
            if (rsi > 75) return 'Overbought Trap';
            if (rsi < 55) return 'RSI Not High Enough';
            return 'Market Reversal';
        }
    }

    private analyzeFailurePatterns(failedTrades: TradeDetail[]): any {
        const patterns = {
            timeOfDay: {} as { [hour: string]: number },
            dayOfWeek: {} as { [day: string]: number },
            marketCondition: {} as { [condition: string]: number },
            rsiLevel: {} as { [level: string]: number },
            priceAction: {} as { [action: string]: number }
        };

        failedTrades.forEach(trade => {
            // Time of day analysis
            const hour = trade.entryTime.getHours();
            const hourKey = `${hour}:00`;
            patterns.timeOfDay[hourKey] = (patterns.timeOfDay[hourKey] || 0) + 1;

            // Day of week analysis
            const day = trade.entryTime.toLocaleDateString('en-US', { weekday: 'long' });
            patterns.dayOfWeek[day] = (patterns.dayOfWeek[day] || 0) + 1;

            // RSI level analysis
            const rsiLevel = this.getRSILevel(trade.rsiAtEntry);
            patterns.rsiLevel[rsiLevel] = (patterns.rsiLevel[rsiLevel] || 0) + 1;

            // Market condition analysis
            const marketCondition = this.getMarketCondition(trade);
            patterns.marketCondition[marketCondition] = (patterns.marketCondition[marketCondition] || 0) + 1;

            // Price action analysis
            const priceAction = this.getPriceAction(trade);
            patterns.priceAction[priceAction] = (patterns.priceAction[priceAction] || 0) + 1;
        });

        return patterns;
    }

    private getRSILevel(rsi: number): string {
        if (rsi < 20) return 'Extreme Oversold (<20)';
        if (rsi < 30) return 'Oversold (20-30)';
        if (rsi < 40) return 'Low (30-40)';
        if (rsi < 60) return 'Neutral (40-60)';
        if (rsi < 70) return 'High (60-70)';
        if (rsi < 80) return 'Overbought (70-80)';
        return 'Extreme Overbought (>80)';
    }

    private getMarketCondition(trade: TradeDetail): string {
        const priceChange = trade.priceChange;
        const volume = trade.volumeAtEntry;

        if (Math.abs(priceChange) > 0.03) return 'High Volatility';
        if (volume > 1000000) return 'High Volume';
        if (priceChange > 0.01) return 'Uptrend';
        if (priceChange < -0.01) return 'Downtrend';
        return 'Sideways';
    }

    private getPriceAction(trade: TradeDetail): string {
        const priceChange = trade.priceChange;

        if (priceChange > 0.05) return 'Strong Rally';
        if (priceChange > 0.02) return 'Moderate Rise';
        if (priceChange > -0.02) return 'Sideways';
        if (priceChange > -0.05) return 'Moderate Decline';
        return 'Strong Decline';
    }

    private generateSymbolRecommendations(failedTrades: TradeDetail[]): string[] {
        const recommendations: string[] = [];

        // Analyze RSI patterns
        const rsiLevels = failedTrades.map(t => t.rsiAtEntry);
        const avgRSI = rsiLevels.reduce((sum, rsi) => sum + rsi, 0) / rsiLevels.length;

        if (avgRSI < 25) {
            recommendations.push('Avoid extreme oversold conditions - wait for RSI to stabilize');
        } else if (avgRSI > 75) {
            recommendations.push('Avoid extreme overbought conditions - wait for RSI to normalize');
        }

        // Analyze time patterns
        const hours = failedTrades.map(t => t.entryTime.getHours());
        const mostFailedHour = this.getMostFrequent(hours);
        if (mostFailedHour !== null) {
            recommendations.push(`Avoid trading at ${mostFailedHour}:00 - high failure rate`);
        }

        // Analyze failure reasons
        const failureReasons = failedTrades.map(t => t.failureReason);
        const mostCommonReason = this.getMostFrequent(failureReasons);
        if (mostCommonReason) {
            recommendations.push(`Address ${mostCommonReason} - most common failure reason`);
        }

        // Analyze loss patterns
        const losses = failedTrades.map(t => t.loss);
        const avgLoss = losses.reduce((sum, loss) => sum + loss, 0) / losses.length;
        if (avgLoss > 100) {
            recommendations.push('Reduce position size - high average loss per trade');
        }

        return recommendations;
    }

    private getMostFrequent<T>(array: T[]): T | null {
        const counts: { [key: string]: number } = {};
        array.forEach(item => {
            const key = String(item);
            counts[key] = (counts[key] || 0) + 1;
        });

        const maxCount = Math.max(...Object.values(counts));
        const mostFrequent = Object.keys(counts).find(key => counts[key] === maxCount);
        return mostFrequent ? (mostFrequent as T) : null;
    }

    private calculateRSI(data: any[]): number {
        if (data.length < 14) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = data.length - 14; i < data.length; i++) {
            const change = data[i]!.close - data[i - 1]!.close;
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }

        const avgGain = gains / 14;
        const avgLoss = losses / 14;

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private calculateSMA(data: any[], period: number): number {
        if (data.length < period) return data[data.length - 1]!.close;
        const sum = data.slice(-period).reduce((acc, candle) => acc + candle.close, 0);
        return sum / period;
    }

    private generateFailedTradeInsights(allFailedAnalyses: FailedTradeAnalysis[], allFailedTrades: TradeDetail[]): void {
        console.log('\n🔍 FAILED TRADE ANALYSIS INSIGHTS');
        console.log('='.repeat(60));

        // Overall statistics
        const totalFailedTrades = allFailedAnalyses.reduce((sum, a) => sum + a.failedTrades, 0);
        const totalLoss = allFailedAnalyses.reduce((sum, a) => sum + a.totalLoss, 0);
        const avgFailureRate = allFailedAnalyses.reduce((sum, a) => sum + a.failureRate, 0) / allFailedAnalyses.length;

        console.log('\n📊 OVERALL FAILURE STATISTICS:');
        console.log('==============================');
        console.log(`📉 Total Failed Trades: ${totalFailedTrades}`);
        console.log(`💰 Total Loss: ₹${totalLoss.toFixed(2)}`);
        console.log(`📊 Average Failure Rate: ${(avgFailureRate * 100).toFixed(1)}%`);
        console.log(`📈 Average Loss per Failed Trade: ₹${(totalLoss / totalFailedTrades).toFixed(2)}`);

        // Worst performing symbols
        console.log('\n❌ WORST PERFORMING SYMBOLS (High Failure Rate):');
        console.log('=================================================');
        allFailedAnalyses
            .sort((a, b) => b.failureRate - a.failureRate)
            .slice(0, 10)
            .forEach((analysis, index) => {
                console.log(`${index + 1}. ${analysis.symbol}: ${(analysis.failureRate * 100).toFixed(1)}% failure rate, ₹${analysis.totalLoss.toFixed(2)} total loss`);
            });

        // Most expensive failures
        console.log('\n💸 MOST EXPENSIVE FAILURES:');
        console.log('============================');
        allFailedAnalyses
            .sort((a, b) => b.totalLoss - a.totalLoss)
            .slice(0, 10)
            .forEach((analysis, index) => {
                console.log(`${index + 1}. ${analysis.symbol}: ₹${analysis.totalLoss.toFixed(2)} total loss, ${analysis.failedTrades} failed trades`);
            });

        // Failure patterns analysis
        this.analyzeGlobalFailurePatterns(allFailedAnalyses);
    }

    private analyzeGlobalFailurePatterns(allFailedAnalyses: FailedTradeAnalysis[]): void {
        console.log('\n📈 GLOBAL FAILURE PATTERNS:');
        console.log('============================');

        // Aggregate patterns across all symbols
        const globalPatterns = {
            timeOfDay: {} as { [hour: string]: number },
            dayOfWeek: {} as { [day: string]: number },
            rsiLevel: {} as { [level: string]: number },
            failureReason: {} as { [reason: string]: number }
        };

        allFailedAnalyses.forEach(analysis => {
            Object.entries(analysis.failurePatterns.timeOfDay).forEach(([hour, count]) => {
                globalPatterns.timeOfDay[hour] = (globalPatterns.timeOfDay[hour] || 0) + count;
            });

            Object.entries(analysis.failurePatterns.dayOfWeek).forEach(([day, count]) => {
                globalPatterns.dayOfWeek[day] = (globalPatterns.dayOfWeek[day] || 0) + count;
            });

            Object.entries(analysis.failurePatterns.rsiLevel).forEach(([level, count]) => {
                globalPatterns.rsiLevel[level] = (globalPatterns.rsiLevel[level] || 0) + count;
            });
        });

        // Most dangerous trading hours
        console.log('\n⏰ MOST DANGEROUS TRADING HOURS:');
        Object.entries(globalPatterns.timeOfDay)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([hour, count]) => {
                console.log(`   ${hour}: ${count} failed trades`);
            });

        // Most dangerous days
        console.log('\n📅 MOST DANGEROUS TRADING DAYS:');
        Object.entries(globalPatterns.dayOfWeek)
            .sort((a, b) => b[1] - a[1])
            .forEach(([day, count]) => {
                console.log(`   ${day}: ${count} failed trades`);
            });

        // Most dangerous RSI levels
        console.log('\n📊 MOST DANGEROUS RSI LEVELS:');
        Object.entries(globalPatterns.rsiLevel)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([level, count]) => {
                console.log(`   ${level}: ${count} failed trades`);
            });
    }

    private generateImprovementStrategies(allFailedAnalyses: FailedTradeAnalysis[]): void {
        console.log('\n🚀 IMPROVEMENT STRATEGIES FOR FAILED TRADES');
        console.log('='.repeat(60));

        console.log('\n🎯 STRATEGY IMPROVEMENTS:');
        console.log('=========================');
        console.log('1. 📊 RSI FILTERS:');
        console.log('   - Avoid extreme oversold (RSI < 20) and overbought (RSI > 80)');
        console.log('   - Wait for RSI to stabilize before entering trades');
        console.log('   - Use RSI divergence for better entry timing');

        console.log('\n2. ⏰ TIME-BASED FILTERS:');
        console.log('   - Avoid trading during high-failure time windows');
        console.log('   - Focus on market opening and closing hours');
        console.log('   - Consider day-of-week patterns');

        console.log('\n3. 📈 VOLUME CONFIRMATION:');
        console.log('   - Only trade when volume is above average');
        console.log('   - Use volume spikes as confirmation signals');
        console.log('   - Avoid low-volume periods');

        console.log('\n4. 🎯 POSITION SIZING:');
        console.log('   - Reduce position size for high-risk setups');
        console.log('   - Use dynamic position sizing based on volatility');
        console.log('   - Implement proper risk management');

        console.log('\n5. 🔄 STOP LOSS OPTIMIZATION:');
        console.log('   - Use ATR-based stop losses instead of fixed percentages');
        console.log('   - Implement trailing stops for winning trades');
        console.log('   - Consider market volatility for stop placement');

        console.log('\n6. 📊 ADDITIONAL INDICATORS:');
        console.log('   - Add MACD for trend confirmation');
        console.log('   - Use Bollinger Bands for volatility analysis');
        console.log('   - Consider moving average crossovers');

        console.log('\n7. 🎯 ENTRY TIMING:');
        console.log('   - Wait for multiple confirmations before entering');
        console.log('   - Use price action patterns for better timing');
        console.log('   - Consider market sentiment and news events');

        console.log('\n8. 📉 RISK MANAGEMENT:');
        console.log('   - Set maximum daily loss limits');
        console.log('   - Implement portfolio-level risk controls');
        console.log('   - Use correlation analysis to avoid over-concentration');

        // Symbol-specific recommendations
        console.log('\n🎯 SYMBOL-SPECIFIC RECOMMENDATIONS:');
        console.log('===================================');
        allFailedAnalyses
            .filter(a => a.failureRate > 0.5)
            .slice(0, 10)
            .forEach(analysis => {
                console.log(`\n${analysis.symbol} (${(analysis.failureRate * 100).toFixed(1)}% failure rate):`);
                analysis.recommendations.forEach(rec => {
                    console.log(`   • ${rec}`);
                });
            });
    }

    private async saveFailedTradeAnalysis(allFailedAnalyses: FailedTradeAnalysis[], allFailedTrades: TradeDetail[]): Promise<void> {
        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `failed-trade-analysis-${timestamp}.json`;
            const filepath = path.join(this.resultsDir, filename);

            const analysisData = {
                timestamp: new Date().toISOString(),
                period: '1 month',
                totalSymbolsAnalyzed: allFailedAnalyses.length,
                totalFailedTrades: allFailedAnalyses.reduce((sum, a) => sum + a.failedTrades, 0),
                totalLoss: allFailedAnalyses.reduce((sum, a) => sum + a.totalLoss, 0),
                averageFailureRate: allFailedAnalyses.reduce((sum, a) => sum + a.failureRate, 0) / allFailedAnalyses.length,
                analyses: allFailedAnalyses,
                failedTrades: allFailedTrades,
                summary: {
                    worstSymbols: allFailedAnalyses.sort((a, b) => b.failureRate - a.failureRate).slice(0, 10),
                    mostExpensiveFailures: allFailedAnalyses.sort((a, b) => b.totalLoss - a.totalLoss).slice(0, 10)
                }
            };

            await fs.writeFile(filepath, JSON.stringify(analysisData, null, 2));
            console.log(`\n💾 Failed trade analysis saved to: ${filepath}`);

        } catch (error) {
            console.error('❌ Error saving failed trade analysis:', error);
        }
    }
}

// Main execution
async function main() {
    const analyzer = new FailedTradeAnalyzer();
    await analyzer.analyzeFailedTrades();
}

if (require.main === module) {
    main();
} 