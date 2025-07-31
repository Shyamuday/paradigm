#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';

class QuickPaperStatus {
    private symbols = [
        'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
        'BHARTIARTL', 'KOTAKBANK', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA'
    ];
    private timeframes = ['15min', '30min', '1hour'];

    async checkStatus(): Promise<void> {
        console.log('📊 Quick Paper Trading Status Check...\n');

        try {
            await db.$connect();

            // Check data availability
            await this.checkDataAvailability();

            // Check for potential signals
            await this.checkForSignals();

            // Check saved results
            await this.checkSavedResults();

        } catch (error) {
            console.error('❌ Error checking status:', error);
        } finally {
            await db.$disconnect();
        }
    }

    private async checkDataAvailability(): Promise<void> {
        console.log('📊 Data Availability Check:');
        console.log('==========================');

        let symbolsWithData = 0;
        const dataSummary: any = {};

        for (const symbol of this.symbols) {
            let hasData = false;
            const timeframeData: any = {};

            for (const timeframe of this.timeframes) {
                try {
                    const data = await this.getRecentData(symbol, timeframe);
                    if (data.length > 0) {
                        hasData = true;
                        timeframeData[timeframe] = data.length;
                    }
                } catch (error) {
                    // Continue
                }
            }

            if (hasData) {
                symbolsWithData++;
                dataSummary[symbol] = timeframeData;
            }
        }

        console.log(`✅ Symbols with data: ${symbolsWithData}/${this.symbols.length}`);

        if (symbolsWithData > 0) {
            console.log('\n📈 Data Summary:');
            Object.entries(dataSummary).forEach(([symbol, data]: [string, any]) => {
                const timeframes = Object.entries(data).map(([tf, count]) => `${tf}:${count}`).join(', ');
                console.log(`   ${symbol.padEnd(12)} | ${timeframes}`);
            });
        }

        console.log('');
    }

    private async checkForSignals(): Promise<void> {
        console.log('🔍 Checking for Trading Signals:');
        console.log('================================');

        let totalSignals = 0;
        const signalsBySymbol: any = {};

        for (const symbol of this.symbols) {
            const symbolSignals = await this.generateTestSignals(symbol);
            if (symbolSignals.length > 0) {
                signalsBySymbol[symbol] = symbolSignals;
                totalSignals += symbolSignals.length;
            }
        }

        if (totalSignals > 0) {
            console.log(`✅ Found ${totalSignals} potential signals:\n`);
            Object.entries(signalsBySymbol).forEach(([symbol, signals]: [string, any]) => {
                console.log(`📈 ${symbol}:`);
                signals.forEach((signal: any) => {
                    console.log(`   ${signal.timeframe.padEnd(8)} | ${signal.action.padEnd(4)} | ₹${signal.price.toFixed(2).padStart(8)} | ${(signal.confidence * 100).toFixed(1).padStart(5)}% | ${signal.reasoning}`);
                });
                console.log('');
            });
        } else {
            console.log('⏸️  No trading signals at this time');
            console.log('   Waiting for market conditions to align...\n');
        }
    }

    private async checkSavedResults(): Promise<void> {
        console.log('💾 Checking Saved Results:');
        console.log('==========================');

        const fs = require('fs').promises;
        const path = require('path');

        const resultsDir = path.join(__dirname, '..', 'data', 'paper-trading-results');

        try {
            const files = await fs.readdir(resultsDir);
            const resultFiles = files.filter((f: string) => f.startsWith('nifty50-paper-trading-results-'));

            if (resultFiles.length === 0) {
                console.log('📁 No paper trading results found yet');
                console.log('   The system is collecting data and will save results soon...\n');
                return;
            }

            // Get the most recent file
            const latestFile = resultFiles.sort().reverse()[0];
            const filepath = path.join(resultsDir, latestFile);

            const data = await fs.readFile(filepath, 'utf8');
            const results = JSON.parse(data);

            console.log(`📊 Latest results file: ${latestFile}`);
            console.log(`📈 Total symbols analyzed: ${results.results?.length || 0}`);

            if (results.summary) {
                console.log(`💰 Total P&L: ₹${results.summary.totalPnl?.toFixed(2) || '0.00'}`);
                console.log(`📊 Total Trades: ${results.summary.totalTrades || 0}`);
                console.log(`📈 Average Success Rate: ${((results.summary.avgSuccessRate || 0) * 100).toFixed(1)}%`);

                if (results.summary.topPerformers && results.summary.topPerformers.length > 0) {
                    console.log('\n🏆 Top Performers:');
                    results.summary.topPerformers.forEach((performer: any, index: number) => {
                        console.log(`   ${index + 1}. ${performer.symbol}: ${(performer.successRate * 100).toFixed(1)}% success, ₹${performer.totalPnl.toFixed(2)} P&L`);
                    });
                }
            }

        } catch (error) {
            console.log('📁 No saved results found yet');
            console.log('   Results will be saved after trades are completed...\n');
        }
    }

    private async generateTestSignals(symbol: string): Promise<any[]> {
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

        // Calculate indicators
        const rsi = this.calculateRSI(reversed, 14);
        const sma10 = this.calculateSMA(reversed.slice(-10));
        const sma20 = this.calculateSMA(reversed.slice(-20));

        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let confidence = 0.5;
        let reasoning = '';

        const price = current.close;
        const priceChange = (price - reversed[reversed.length - 2].close) / reversed[reversed.length - 2].close;

        // Signal conditions
        if (rsi < 35 && sma10 > sma20 && priceChange > 0) {
            action = 'BUY';
            confidence = Math.min(0.85, (35 - rsi) / 35 * 0.3 + 0.6);
            reasoning = `RSI oversold (${rsi.toFixed(1)}) with bullish trend`;
        } else if (rsi > 65 && sma10 < sma20 && priceChange < 0) {
            action = 'SELL';
            confidence = Math.min(0.85, (rsi - 65) / 35 * 0.3 + 0.6);
            reasoning = `RSI overbought (${rsi.toFixed(1)}) with bearish trend`;
        } else if (sma10 > sma20 && sma20 > this.calculateSMA(reversed.slice(-50)) && priceChange > 0.005) {
            action = 'BUY';
            confidence = 0.7;
            reasoning = `Strong uptrend - MA crossover`;
        } else if (sma10 < sma20 && sma20 < this.calculateSMA(reversed.slice(-50)) && priceChange < -0.005) {
            action = 'SELL';
            confidence = 0.7;
            reasoning = `Strong downtrend - MA crossover`;
        }

        if (action !== 'HOLD' && confidence > 0.6) {
            return {
                symbol,
                timeframe,
                action,
                price,
                confidence,
                reasoning
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
}

// Main execution
async function main() {
    const status = new QuickPaperStatus();
    await status.checkStatus();
}

if (require.main === module) {
    main();
} 