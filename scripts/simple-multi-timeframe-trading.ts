#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';

interface TimeframeSignal {
    timeframe: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    price: number;
    reasoning: string;
}

interface ConsensusSignal {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    price: number;
    timeframes: string[];
    reasoning: string;
}

class SimpleMultiTimeframeTrading {
    private timeframes = ['15min', '30min', '1hour']; // Different timeframes
    private symbols = ['RELIANCE'];
    private timeframeWeights = {
        '15min': 0.4,  // 40% weight
        '30min': 0.35, // 35% weight
        '1hour': 0.25  // 25% weight
    };

    async start(): Promise<void> {
        console.log('🚀 Starting Simple Multi-Timeframe Trading...\n');

        try {
            await db.$connect();

            // Run continuous monitoring
            this.startMonitoring();

        } catch (error) {
            console.error('❌ Error starting multi-timeframe trading:', error);
        }
    }

    private startMonitoring(): void {
        const interval = setInterval(async () => {
            try {
                await this.analyzeAllTimeframes();
            } catch (error) {
                console.error('❌ Error in monitoring:', error);
            }
        }, 60000); // Check every minute

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Stopping multi-timeframe trading...');
            clearInterval(interval);
            await db.$disconnect();
            process.exit(0);
        });
    }

    private async analyzeAllTimeframes(): Promise<void> {
        console.log(`\n🕐 ${new Date().toLocaleTimeString()} - Analyzing timeframes...`);

        for (const symbol of this.symbols) {
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
                this.displayResults(symbol, signals, consensus);
            }
        }
    }

    private async getTimeframeSignal(symbol: string, timeframe: string): Promise<TimeframeSignal | null> {
        try {
            const data = await this.getRecentData(symbol, timeframe);
            if (data.length < 20) return null;

            return this.generateSignal(data, timeframe);
        } catch (error) {
            console.error(`   ❌ Error getting ${timeframe} signal for ${symbol}:`, error);
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
            take: 50
        });
    }

    private generateSignal(data: any[], timeframe: string): TimeframeSignal {
        const reversed = data.reverse(); // Get chronological order
        const current = reversed[reversed.length - 1];

        // Simple RSI-based signal
        const rsi = this.calculateRSI(reversed, 14);
        const sma10 = this.calculateSMA(reversed.slice(-10));
        const sma20 = this.calculateSMA(reversed.slice(-20));

        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let confidence = 0.5;
        let reasoning = '';

        // RSI conditions
        if (rsi < 30 && sma10 > sma20) {
            action = 'BUY';
            confidence = Math.min(0.8, (30 - rsi) / 30 * 0.3 + 0.5);
            reasoning = `RSI oversold (${rsi.toFixed(1)}) with bullish trend`;
        } else if (rsi > 70 && sma10 < sma20) {
            action = 'SELL';
            confidence = Math.min(0.8, (rsi - 70) / 30 * 0.3 + 0.5);
            reasoning = `RSI overbought (${rsi.toFixed(1)}) with bearish trend`;
        } else if (sma10 > sma20 && rsi > 40 && rsi < 60) {
            action = 'BUY';
            confidence = 0.6;
            reasoning = `Trend following - SMA crossover bullish`;
        } else if (sma10 < sma20 && rsi > 40 && rsi < 60) {
            action = 'SELL';
            confidence = 0.6;
            reasoning = `Trend following - SMA crossover bearish`;
        }

        return {
            timeframe,
            action,
            confidence,
            price: current.close,
            reasoning
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

        return {
            symbol,
            action: consensusAction,
            confidence: weightedConfidence,
            price: weightedPrice,
            timeframes,
            reasoning: `Multi-timeframe consensus from ${timeframes.join(', ')}`
        };
    }

    private displayResults(symbol: string, signals: TimeframeSignal[], consensus: ConsensusSignal): void {
        console.log(`\n📊 ${symbol} Multi-Timeframe Analysis:`);
        console.log('=====================================');

        // Display individual timeframe signals
        signals.forEach(signal => {
            const weight = this.timeframeWeights[signal.timeframe as keyof typeof this.timeframeWeights] || 0.33;
            const weightPercent = (weight * 100).toFixed(0);
            const confidencePercent = (signal.confidence * 100).toFixed(1);

            console.log(`   ${signal.timeframe.padEnd(8)} | ${signal.action.padEnd(4)} | ${confidencePercent.padStart(5)}% | ${weightPercent.padStart(3)}% weight | ₹${signal.price.toFixed(2)}`);
            console.log(`           | ${signal.reasoning}`);
        });

        // Display consensus
        console.log(`\n🎯 Consensus Signal:`);
        console.log(`   Action: ${consensus.action}`);
        console.log(`   Confidence: ${(consensus.confidence * 100).toFixed(1)}%`);
        console.log(`   Price: ₹${consensus.price.toFixed(2)}`);
        console.log(`   Timeframes: ${consensus.timeframes.join(', ')}`);
        console.log(`   Reasoning: ${consensus.reasoning}`);

        // Trading recommendation
        if (consensus.action !== 'HOLD' && consensus.confidence > 0.6) {
            console.log(`\n🚀 TRADING RECOMMENDATION:`);
            console.log(`   ${consensus.action} ${symbol} at ₹${consensus.price.toFixed(2)}`);
            console.log(`   Confidence: ${(consensus.confidence * 100).toFixed(1)}%`);

            // Calculate position size based on confidence
            const positionSize = Math.min(consensus.confidence * 0.1, 0.1); // Max 10% of capital
            console.log(`   Suggested Position Size: ${(positionSize * 100).toFixed(1)}% of capital`);
        } else {
            console.log(`\n⏸️  No high-confidence signal - HOLDING`);
        }
    }

    async stop(): Promise<void> {
        await db.$disconnect();
        console.log('✅ Multi-timeframe trading stopped');
    }
}

// Main execution
async function main() {
    const trader = new SimpleMultiTimeframeTrading();

    try {
        await trader.start();
    } catch (error) {
        console.error('❌ Error in multi-timeframe trading:', error);
        await trader.stop();
        process.exit(1);
    }
}

if (require.main === module) {
    main();
} 