#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import * as fs from 'fs/promises';
import * as path from 'path';

interface OptimizationResult {
    parameters: {
        minConfidence: number;
        stopLossPercent: number;
        takeProfitPercent: number;
        rsiOversold: number;
        rsiOverbought: number;
        positionSizePercent: number;
    };
    performance: {
        totalTrades: number;
        winningTrades: number;
        successRate: number;
        totalPnl: number;
        avgPnl: number;
        maxDrawdown: number;
        sharpeRatio: number;
        profitFactor: number;
    };
}

class StrategyOptimizer {
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

    async optimizeStrategy(): Promise<void> {
        console.log('🔧 Starting Strategy Optimization...\n');

        try {
            await db.$connect();

            // Define parameter ranges to test
            const parameterSets = this.generateParameterSets();
            console.log(`📊 Testing ${parameterSets.length} parameter combinations...\n`);

            const results: OptimizationResult[] = [];

            for (let i = 0; i < parameterSets.length; i++) {
                const params = parameterSets[i];
                console.log(`🔄 Testing combination ${i + 1}/${parameterSets.length}...`);

                const result = await this.testParameters(params);
                results.push(result);

                console.log(`   Success Rate: ${(result.performance.successRate * 100).toFixed(1)}%`);
                console.log(`   Total P&L: ₹${result.performance.totalPnl.toFixed(2)}`);
                console.log(`   Profit Factor: ${result.performance.profitFactor.toFixed(2)}`);
                console.log('');
            }

            // Find best performing strategy
            const bestResult = this.findBestStrategy(results);

            // Display results
            this.displayOptimizationResults(results, bestResult);

            // Save results
            await this.saveOptimizationResults(results, bestResult);

        } catch (error) {
            console.error('❌ Error in optimization:', error);
        } finally {
            await db.$disconnect();
        }
    }

    private generateParameterSets(): any[] {
        const sets: any[] = [];

        // Test different confidence thresholds
        const confidences = [0.65, 0.70, 0.75, 0.80, 0.85];

        // Test different stop loss levels
        const stopLosses = [0.01, 0.015, 0.02, 0.025, 0.03];

        // Test different take profit levels
        const takeProfits = [0.02, 0.025, 0.03, 0.035, 0.04];

        // Test different RSI levels
        const rsiOversold = [30, 35, 40];
        const rsiOverbought = [60, 65, 70];

        // Test different position sizes
        const positionSizes = [0.03, 0.05, 0.07, 0.10];

        // Generate combinations (limited to avoid too many tests)
        let count = 0;
        for (const conf of confidences) {
            for (const sl of stopLosses) {
                for (const tp of takeProfits) {
                    for (const rsiLow of rsiOversold) {
                        for (const rsiHigh of rsiOverbought) {
                            for (const posSize of positionSizes) {
                                if (count >= 50) break; // Limit to 50 combinations

                                sets.push({
                                    minConfidence: conf,
                                    stopLossPercent: sl,
                                    takeProfitPercent: tp,
                                    rsiOversold: rsiLow,
                                    rsiOverbought: rsiHigh,
                                    positionSizePercent: posSize
                                });
                                count++;
                            }
                        }
                    }
                }
            }
        }

        return sets;
    }

    private async testParameters(params: any): Promise<OptimizationResult> {
        const trades: any[] = [];

        // Get historical data for testing
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        for (const symbol of this.symbols.slice(0, 5)) { // Test with first 5 symbols
            const symbolTrades = await this.backtestSymbol(symbol, oneMonthAgo, params);
            trades.push(...symbolTrades);
        }

        // Calculate performance metrics
        const performance = this.calculatePerformance(trades);

        return {
            parameters: params,
            performance
        };
    }

    private async backtestSymbol(symbol: string, startDate: Date, params: any): Promise<any[]> {
        const trades: any[] = [];

        try {
            // Get historical data
            const data = await db.candleData.findMany({
                where: {
                    instrument: { symbol },
                    timestamp: { gte: startDate },
                    timeframe: { name: '15min' }
                },
                orderBy: { timestamp: 'asc' }
            });

            if (data.length < 50) return trades;

            // Simulate trading
            for (let i = 50; i < data.length - 1; i++) {
                const current = data[i];
                const next = data[i + 1];

                // Calculate indicators
                const rsi = this.calculateRSI(data.slice(0, i + 1));
                const sma20 = this.calculateSMA(data.slice(0, i + 1), 20);
                const sma50 = this.calculateSMA(data.slice(0, i + 1), 50);

                // Generate signal
                const signal = this.generateOptimizedSignal(current.close, rsi, sma20, sma50, params);

                if (signal.action !== 'HOLD') {
                    const confidence = this.calculateConfidence(rsi, sma20, sma50, current.close);

                    if (confidence >= params.minConfidence) {
                        const entryPrice = current.close;
                        const exitPrice = next.close;
                        const positionSize = Math.floor(100000 * params.positionSizePercent / entryPrice);

                        const stopLoss = signal.action === 'BUY'
                            ? entryPrice * (1 - params.stopLossPercent)
                            : entryPrice * (1 + params.stopLossPercent);

                        const takeProfit = signal.action === 'BUY'
                            ? entryPrice * (1 + params.takeProfitPercent)
                            : entryPrice * (1 - params.takeProfitPercent);

                        // Check if trade would be closed by stop loss or take profit
                        let actualExitPrice = exitPrice;
                        let closeReason = 'End of period';
                        let success = false;

                        if (signal.action === 'BUY') {
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

                        const pnl = signal.action === 'BUY'
                            ? (actualExitPrice - entryPrice) * positionSize
                            : (entryPrice - actualExitPrice) * positionSize;

                        trades.push({
                            symbol,
                            action: signal.action,
                            entryPrice,
                            exitPrice: actualExitPrice,
                            pnl,
                            success,
                            confidence,
                            closeReason
                        });
                    }
                }
            }

        } catch (error) {
            console.error(`Error backtesting ${symbol}:`, error);
        }

        return trades;
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

    private generateOptimizedSignal(price: number, rsi: number, sma20: number, sma50: number, params: any): { action: 'BUY' | 'SELL' | 'HOLD' } {
        const priceToSMA20 = Math.abs((price - sma20) / sma20);

        // Buy conditions
        if (rsi < params.rsiOversold && price < sma20 && priceToSMA20 < 0.02) {
            return { action: 'BUY' };
        }

        // Sell conditions
        if (rsi > params.rsiOverbought && price > sma20 && priceToSMA20 < 0.02) {
            return { action: 'SELL' };
        }

        return { action: 'HOLD' };
    }

    private calculateConfidence(rsi: number, sma20: number, sma50: number, price: number): number {
        let confidence = 0.5;

        // RSI confidence
        if (rsi < 30 || rsi > 70) confidence += 0.2;
        else if (rsi < 40 || rsi > 60) confidence += 0.1;

        // Price relative to moving averages
        const priceToSMA20 = Math.abs((price - sma20) / sma20);
        if (priceToSMA20 < 0.01) confidence += 0.2;
        else if (priceToSMA20 < 0.02) confidence += 0.1;

        return Math.min(confidence, 0.95);
    }

    private calculatePerformance(trades: any[]): any {
        if (trades.length === 0) {
            return {
                totalTrades: 0,
                winningTrades: 0,
                successRate: 0,
                totalPnl: 0,
                avgPnl: 0,
                maxDrawdown: 0,
                sharpeRatio: 0,
                profitFactor: 0
            };
        }

        const winningTrades = trades.filter(t => t.success);
        const losingTrades = trades.filter(t => !t.success);

        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
        const successRate = winningTrades.length / trades.length;
        const avgPnl = totalPnl / trades.length;

        // Calculate max drawdown
        let maxDrawdown = 0;
        let peak = 0;
        let runningPnl = 0;

        for (const trade of trades) {
            runningPnl += trade.pnl;
            if (runningPnl > peak) {
                peak = runningPnl;
            }
            const drawdown = peak - runningPnl;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        // Calculate Sharpe ratio
        const returns = trades.map(t => t.pnl);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

        // Calculate profit factor
        const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

        return {
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            successRate,
            totalPnl,
            avgPnl,
            maxDrawdown,
            sharpeRatio,
            profitFactor
        };
    }

    private findBestStrategy(results: OptimizationResult[]): OptimizationResult {
        // Score each strategy based on multiple criteria
        const scoredResults = results.map(result => {
            const score =
                (result.performance.successRate * 0.3) +
                (result.performance.profitFactor * 0.3) +
                (result.performance.sharpeRatio * 0.2) +
                (result.performance.totalPnl > 0 ? 0.2 : 0);

            return { ...result, score };
        });

        // Sort by score and return the best
        scoredResults.sort((a, b) => b.score - a.score);
        return scoredResults[0];
    }

    private displayOptimizationResults(results: OptimizationResult[], bestResult: OptimizationResult): void {
        console.log('📊 STRATEGY OPTIMIZATION RESULTS');
        console.log('================================\n');

        // Display top 5 strategies
        const topResults = results
            .map((result, index) => ({ ...result, rank: index + 1 }))
            .sort((a, b) => b.performance.totalPnl - a.performance.totalPnl)
            .slice(0, 5);

        console.log('🏆 TOP 5 STRATEGIES:');
        console.log('====================');

        topResults.forEach((result, index) => {
            console.log(`${index + 1}. Strategy ${result.rank}:`);
            console.log(`   📊 Success Rate: ${(result.performance.successRate * 100).toFixed(1)}%`);
            console.log(`   💰 Total P&L: ₹${result.performance.totalPnl.toFixed(2)}`);
            console.log(`   📈 Profit Factor: ${result.performance.profitFactor.toFixed(2)}`);
            console.log(`   📊 Sharpe Ratio: ${result.performance.sharpeRatio.toFixed(3)}`);
            console.log(`   ⚙️  Parameters:`);
            console.log(`      Confidence: ${(result.parameters.minConfidence * 100).toFixed(0)}%`);
            console.log(`      Stop Loss: ${(result.parameters.stopLossPercent * 100).toFixed(1)}%`);
            console.log(`      Take Profit: ${(result.parameters.takeProfitPercent * 100).toFixed(1)}%`);
            console.log(`      RSI Range: ${result.parameters.rsiOversold}-${result.parameters.rsiOverbought}`);
            console.log(`      Position Size: ${(result.parameters.positionSizePercent * 100).toFixed(1)}%`);
            console.log('');
        });

        // Display best strategy
        console.log('🎯 BEST OPTIMIZED STRATEGY:');
        console.log('===========================');
        console.log(`📊 Success Rate: ${(bestResult.performance.successRate * 100).toFixed(1)}%`);
        console.log(`💰 Total P&L: ₹${bestResult.performance.totalPnl.toFixed(2)}`);
        console.log(`📈 Profit Factor: ${bestResult.performance.profitFactor.toFixed(2)}`);
        console.log(`📊 Sharpe Ratio: ${bestResult.performance.sharpeRatio.toFixed(3)}`);
        console.log(`📉 Max Drawdown: ₹${bestResult.performance.maxDrawdown.toFixed(2)}`);
        console.log('');
        console.log('⚙️  OPTIMAL PARAMETERS:');
        console.log('=======================');
        console.log(`🎯 Min Confidence: ${(bestResult.parameters.minConfidence * 100).toFixed(0)}%`);
        console.log(`⚠️  Stop Loss: ${(bestResult.parameters.stopLossPercent * 100).toFixed(1)}%`);
        console.log(`🎯 Take Profit: ${(bestResult.parameters.takeProfitPercent * 100).toFixed(1)}%`);
        console.log(`📊 RSI Oversold: ${bestResult.parameters.rsiOversold}`);
        console.log(`📊 RSI Overbought: ${bestResult.parameters.rsiOverbought}`);
        console.log(`💰 Position Size: ${(bestResult.parameters.positionSizePercent * 100).toFixed(1)}%`);
        console.log('');

        if (bestResult.performance.totalPnl > 0 && bestResult.performance.successRate > 0.5) {
            console.log('✅ OPTIMIZATION SUCCESSFUL - Strategy ready for live trading!');
        } else {
            console.log('❌ OPTIMIZATION UNSUCCESSFUL - Strategy needs further refinement');
        }
    }

    private async saveOptimizationResults(results: OptimizationResult[], bestResult: OptimizationResult): Promise<void> {
        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `strategy-optimization-${timestamp}.json`;
            const filepath = path.join(this.resultsDir, filename);

            const optimizationData = {
                timestamp: new Date().toISOString(),
                totalCombinations: results.length,
                bestStrategy: bestResult,
                allResults: results,
                summary: {
                    profitableStrategies: results.filter(r => r.performance.totalPnl > 0).length,
                    avgSuccessRate: results.reduce((sum, r) => sum + r.performance.successRate, 0) / results.length,
                    avgProfitFactor: results.reduce((sum, r) => sum + r.performance.profitFactor, 0) / results.length
                }
            };

            await fs.writeFile(filepath, JSON.stringify(optimizationData, null, 2));
            console.log(`💾 Optimization results saved to: ${filepath}`);

        } catch (error) {
            console.error('❌ Error saving optimization results:', error);
        }
    }
}

// Main execution
async function main() {
    const optimizer = new StrategyOptimizer();
    await optimizer.optimizeStrategy();
}

if (require.main === module) {
    main();
} 