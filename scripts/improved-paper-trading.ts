#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import * as fs from 'fs/promises';
import * as path from 'path';

class ImprovedPaperTrading {
    private resultsDir: string;
    private symbols: string[];
    private trades: any[] = [];
    private capital: number = 1000000; // ₹10 Lakhs

    constructor() {
        this.resultsDir = path.join(__dirname, '..', 'data', 'paper-trading-results');
        this.symbols = [
            'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR',
            'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK', 'AXISBANK', 'ASIANPAINT',
            'MARUTI', 'HCLTECH', 'SUNPHARMA'
        ];
    }

    async startImprovedTrading(): Promise<void> {
        console.log('🚀 Starting Improved Paper Trading...\n');

        try {
            await db.$connect();
            console.log('✅ Database connected');
            console.log(`📈 Trading symbols: ${this.symbols.join(', ')}`);
            console.log(`💰 Capital: ₹${this.capital.toLocaleString()}`);
            console.log(`🎯 Strategy: Range-bound with strict risk management`);
            console.log('✅ Improved trading started\n');

            // Start trading loop
            await this.tradingLoop();

        } catch (error) {
            console.error('❌ Error in trading:', error);
        } finally {
            await db.$disconnect();
        }
    }

    private async tradingLoop(): Promise<void> {
        let cycle = 0;

        while (true) {
            cycle++;
            const now = new Date();
            console.log(`🕐 ${now.toLocaleTimeString()} - Cycle ${cycle} - Analyzing ${this.symbols.length} symbols...`);

            try {
                // Check market conditions
                const marketCondition = await this.checkMarketCondition();

                if (marketCondition.shouldTrade) {
                    const signals = await this.generateImprovedSignals();

                    for (const signal of signals) {
                        await this.executeImprovedTrade(signal);
                    }

                    console.log(`   📊 Generated ${signals.length} improved signals`);
                } else {
                    console.log(`   ⏸️  ${marketCondition.reason} - skipping trades`);
                }

                // Monitor existing trades
                await this.monitorImprovedTrades();

                // Display status
                this.displayImprovedStatus();

                // Save results
                await this.saveImprovedResults();

                // Wait 5 minutes
                await this.sleep(5 * 60 * 1000);

            } catch (error) {
                console.error(`❌ Error in cycle ${cycle}:`, error);
                await this.sleep(60 * 1000);
            }
        }
    }

    private async checkMarketCondition(): Promise<{ shouldTrade: boolean; reason: string }> {
        try {
            // Get recent data
            const recentData = await db.candleData.findMany({
                where: {
                    instrument: { symbol: { in: this.symbols.slice(0, 5) } },
                    timestamp: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } // Last 2 hours
                },
                include: { instrument: true },
                orderBy: { timestamp: 'desc' },
                take: 50
            });

            if (recentData.length < 10) {
                return { shouldTrade: false, reason: 'Insufficient data' };
            }

            // Calculate volatility
            const priceChanges = recentData.map(candle =>
                Math.abs((candle.close - candle.open) / candle.open)
            );
            const avgVolatility = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;

            // Only trade in low volatility conditions
            if (avgVolatility > 0.03) {
                return { shouldTrade: false, reason: 'High volatility detected' };
            }

            return { shouldTrade: true, reason: 'Favorable conditions' };

        } catch (error) {
            return { shouldTrade: false, reason: 'Error checking market' };
        }
    }

    private async generateImprovedSignals(): Promise<any[]> {
        const signals: any[] = [];

        for (const symbol of this.symbols.slice(0, 8)) { // Limit to 8 symbols
            try {
                const signal = await this.analyzeImprovedSymbol(symbol);
                if (signal && signal.confidence >= 0.75) { // Higher confidence threshold
                    signals.push(signal);
                }
            } catch (error) {
                console.log(`   ⚠️  Error analyzing ${symbol}`);
            }
        }

        return signals.slice(0, 3); // Limit to 3 trades per cycle
    }

    private async analyzeImprovedSymbol(symbol: string): Promise<any | null> {
        try {
            // Get 15min data
            const data = await db.candleData.findMany({
                where: {
                    instrument: { symbol },
                    timeframe: { name: '15min' }
                },
                orderBy: { timestamp: 'desc' },
                take: 30
            });

            if (data.length < 20) return null;

            const reversedData = data.reverse();
            const currentPrice = reversedData[reversedData.length - 1]!.close;

            // Calculate indicators
            const rsi = this.calculateRSI(reversedData);
            const sma20 = this.calculateSMA(reversedData, 20);
            const sma50 = this.calculateSMA(reversedData, 50);

            // Improved range-bound strategy
            const signal = this.generateImprovedSignal(currentPrice, rsi, sma20, sma50);

            if (signal.action !== 'HOLD') {
                const confidence = this.calculateImprovedConfidence(rsi, sma20, sma50, currentPrice);

                return {
                    symbol,
                    action: signal.action,
                    price: currentPrice,
                    confidence,
                    timeframe: '15min',
                    strategy: 'Improved Range-Bound',
                    reasoning: signal.reasoning
                };
            }

            return null;

        } catch (error) {
            return null;
        }
    }

    private calculateRSI(data: any[], period: number = 14): number {
        if (data.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = data.length - period; i < data.length; i++) {
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

    private calculateSMA(data: any[], period: number): number {
        if (data.length < period) return data[data.length - 1].close;

        const sum = data.slice(-period).reduce((acc, candle) => acc + candle.close, 0);
        return sum / period;
    }

    private generateImprovedSignal(price: number, rsi: number, sma20: number, sma50: number): { action: 'BUY' | 'SELL' | 'HOLD'; reasoning: string } {
        const priceToSMA20 = Math.abs((price - sma20) / sma20);
        const smaDiff = Math.abs((sma20 - sma50) / sma50);

        // Stricter conditions for range-bound trading
        if (rsi < 35 && price < sma20 && priceToSMA20 < 0.015 && smaDiff < 0.02) {
            return {
                action: 'BUY',
                reasoning: `Strong oversold (RSI: ${rsi.toFixed(1)}), price near support`
            };
        }

        if (rsi > 65 && price > sma20 && priceToSMA20 < 0.015 && smaDiff < 0.02) {
            return {
                action: 'SELL',
                reasoning: `Strong overbought (RSI: ${rsi.toFixed(1)}), price near resistance`
            };
        }

        return { action: 'HOLD', reasoning: 'No clear signal' };
    }

    private calculateImprovedConfidence(rsi: number, sma20: number, sma50: number, price: number): number {
        let confidence = 0.6; // Higher base confidence

        // RSI confidence
        if (rsi < 30 || rsi > 70) confidence += 0.25;
        else if (rsi < 35 || rsi > 65) confidence += 0.15;

        // Price relative to moving averages
        const priceToSMA20 = Math.abs((price - sma20) / sma20);
        if (priceToSMA20 < 0.01) confidence += 0.25;
        else if (priceToSMA20 < 0.015) confidence += 0.15;

        // Moving average alignment
        const smaDiff = Math.abs((sma20 - sma50) / sma50);
        if (smaDiff < 0.015) confidence += 0.15; // Very tight range

        return Math.min(confidence, 0.95);
    }

    private async executeImprovedTrade(signal: any): Promise<void> {
        try {
            const positionSize = Math.floor((this.capital * 0.03) / signal.price); // 3% per trade
            const stopLoss = signal.action === 'BUY'
                ? signal.price * 0.985 // 1.5% stop loss
                : signal.price * 1.015;
            const takeProfit = signal.action === 'BUY'
                ? signal.price * 1.025 // 2.5% take profit
                : signal.price * 0.975;

            const trade = {
                symbol: signal.symbol,
                action: signal.action,
                entryPrice: signal.price,
                quantity: positionSize,
                confidence: signal.confidence,
                status: 'OPEN',
                strategy: signal.strategy,
                timeframe: signal.timeframe,
                stopLoss,
                takeProfit,
                entryTime: new Date(),
                pnl: 0,
                success: false
            };

            this.trades.push(trade);

            console.log(`🚀 Opened ${signal.action} position: ${signal.symbol} @ ₹${signal.price.toFixed(2)}`);
            console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}% | Quantity: ${positionSize}`);
            console.log(`   Stop Loss: ₹${stopLoss.toFixed(2)} | Take Profit: ₹${takeProfit.toFixed(2)}`);
            console.log(`   Strategy: ${signal.strategy}`);

        } catch (error) {
            console.error(`❌ Error executing trade for ${signal.symbol}:`, error);
        }
    }

    private async monitorImprovedTrades(): Promise<void> {
        const tradesToClose: any[] = [];

        for (const trade of this.trades) {
            if (trade.status !== 'OPEN') continue;

            try {
                const currentData = await db.candleData.findFirst({
                    where: {
                        instrument: { symbol: trade.symbol },
                        timeframe: { name: trade.timeframe }
                    },
                    orderBy: { timestamp: 'desc' }
                });

                if (!currentData) continue;

                const currentPrice = currentData.close;

                // Check stop loss and take profit
                let shouldClose = false;
                let closeReason = '';
                let success = false;

                if (trade.action === 'BUY') {
                    if (currentPrice <= trade.stopLoss) {
                        shouldClose = true;
                        closeReason = 'Stop Loss';
                        success = false;
                    } else if (currentPrice >= trade.takeProfit) {
                        shouldClose = true;
                        closeReason = 'Take Profit';
                        success = true;
                    }
                } else {
                    if (currentPrice >= trade.stopLoss) {
                        shouldClose = true;
                        closeReason = 'Stop Loss';
                        success = false;
                    } else if (currentPrice <= trade.takeProfit) {
                        shouldClose = true;
                        closeReason = 'Take Profit';
                        success = true;
                    }
                }

                if (shouldClose) {
                    trade.exitPrice = currentPrice;
                    trade.status = 'CLOSED';
                    trade.success = success;
                    trade.exitTime = new Date();
                    trade.pnl = trade.action === 'BUY'
                        ? (currentPrice - trade.entryPrice) * trade.quantity
                        : (trade.entryPrice - currentPrice) * trade.quantity;

                    tradesToClose.push(trade);

                    console.log(`📊 Closed ${trade.action} position: ${trade.symbol}`);
                    console.log(`   Entry: ₹${trade.entryPrice.toFixed(2)} | Exit: ₹${currentPrice.toFixed(2)}`);
                    console.log(`   P&L: ₹${trade.pnl.toFixed(2)} | ${success ? '✅' : '❌'}`);
                    console.log(`   Reason: ${closeReason}`);
                }

            } catch (error) {
                console.error(`❌ Error monitoring trade for ${trade.symbol}:`, error);
            }
        }
    }

    private displayImprovedStatus(): void {
        const openTrades = this.trades.filter(t => t.status === 'OPEN');
        const closedTrades = this.trades.filter(t => t.status === 'CLOSED');
        const winningTrades = closedTrades.filter(t => t.success);
        const losingTrades = closedTrades.filter(t => !t.success);

        const totalPnl = closedTrades.reduce((sum, t) => sum + t.pnl, 0);
        const successRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;

        console.log('\n📊 Improved Paper Trading Portfolio Status:');
        console.log('===========================================');
        console.log(`💰 Total P&L: ₹${totalPnl.toFixed(2)}`);
        console.log(`📈 Success Rate: ${(successRate * 100).toFixed(1)}%`);
        console.log(`📊 Total Trades: ${closedTrades.length}`);
        console.log(`🔄 Open Trades: ${openTrades.length}`);
        console.log(`✅ Winning Trades: ${winningTrades.length}`);
        console.log(`❌ Losing Trades: ${losingTrades.length}`);

        if (openTrades.length > 0) {
            console.log('\n🔄 Open Positions:');
            openTrades.forEach(trade => {
                console.log(`   ${trade.symbol} | ${trade.action} | ₹${trade.entryPrice.toFixed(2)} | ${(trade.confidence * 100).toFixed(1)}%`);
            });
        }
        console.log('');
    }

    private async saveImprovedResults(): Promise<void> {
        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `improved-paper-trading-results-${timestamp}.json`;
            const filepath = path.join(this.resultsDir, filename);

            const results = {
                timestamp: new Date().toISOString(),
                trades: this.trades,
                summary: {
                    totalTrades: this.trades.filter(t => t.status === 'CLOSED').length,
                    winningTrades: this.trades.filter(t => t.status === 'CLOSED' && t.success).length,
                    totalPnl: this.trades.filter(t => t.status === 'CLOSED').reduce((sum, t) => sum + t.pnl, 0),
                    successRate: this.trades.filter(t => t.status === 'CLOSED').length > 0
                        ? this.trades.filter(t => t.status === 'CLOSED' && t.success).length / this.trades.filter(t => t.status === 'CLOSED').length
                        : 0
                }
            };

            await fs.writeFile(filepath, JSON.stringify(results, null, 2));
            console.log(`💾 Results saved to: ${filepath}`);

        } catch (error) {
            console.error('❌ Error saving results:', error);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const trading = new ImprovedPaperTrading();
    await trading.startImprovedTrading();
}

if (require.main === module) {
    main();
} 