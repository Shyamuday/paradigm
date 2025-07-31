#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TradeResult {
    symbol: string;
    action: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    entryTime: Date;
    exitTime: Date;
    pnl: number;
    pnlPercent: number;
    confidence: number;
    timeframe: string;
    success: boolean;
    holdingPeriod: number; // in minutes
}

interface SymbolAnalysis {
    symbol: string;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    totalPnl: number;
    successRate: number;
    avgPnl: number;
    avgPnlPercent: number;
    maxDrawdown: number;
    sharpeRatio: number;
    avgConfidence: number;
    avgHoldingPeriod: number;
    bestTimeframe: string;
    riskAdjustedReturn: number;
    optimalPositionSize: number;
    optimalStopLoss: number;
    optimalTakeProfit: number;
    trades: TradeResult[];
}

interface OverallAnalysis {
    totalTrades: number;
    totalPnl: number;
    avgSuccessRate: number;
    avgPnl: number;
    maxDrawdown: number;
    sharpeRatio: number;
    bestSymbols: SymbolAnalysis[];
    worstSymbols: SymbolAnalysis[];
    timeframePerformance: { [key: string]: any };
    confidenceAnalysis: { [key: string]: any };
    riskMetrics: {
        var95: number;
        maxSingleLoss: number;
        maxSingleWin: number;
        avgWin: number;
        avgLoss: number;
        winLossRatio: number;
    };
}

class PaperTradingAnalyzer {
    private resultsDir: string;

    constructor() {
        this.resultsDir = path.join(__dirname, '..', 'data', 'paper-trading-results');
    }

    async analyzeResults(): Promise<void> {
        console.log('📊 Analyzing Paper Trading Results...\n');

        try {
            await db.$connect();

            // Get all result files
            const resultFiles = await this.getResultFiles();

            if (resultFiles.length === 0) {
                console.log('❌ No result files found');
                return;
            }

            console.log(`📁 Found ${resultFiles.length} result files`);

            // Analyze each file
            const allTrades: TradeResult[] = [];

            for (const file of resultFiles) {
                const trades = await this.extractTradesFromFile(file);
                allTrades.push(...trades);
            }

            console.log(`📈 Total trades found: ${allTrades.length}`);

            if (allTrades.length === 0) {
                console.log('❌ No trades found in result files');
                return;
            }

            // Perform comprehensive analysis
            const analysis = await this.performAnalysis(allTrades);

            // Display results
            this.displayAnalysis(analysis);

            // Save detailed analysis
            await this.saveDetailedAnalysis(analysis);

        } catch (error) {
            console.error('❌ Error analyzing results:', error);
        } finally {
            await db.$disconnect();
        }
    }

    private async getResultFiles(): Promise<string[]> {
        try {
            const files = await fs.readdir(this.resultsDir);
            return files
                .filter(f => f.startsWith('nifty50-paper-trading-results-'))
                .map(f => path.join(this.resultsDir, f))
                .sort();
        } catch (error) {
            return [];
        }
    }

    private async extractTradesFromFile(filePath: string): Promise<TradeResult[]> {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const result = JSON.parse(data);

            const trades: TradeResult[] = [];

            // Extract trades from the result structure
            if (result.results && Array.isArray(result.results)) {
                for (const symbolResult of result.results) {
                    if (symbolResult.trades && Array.isArray(symbolResult.trades)) {
                        trades.push(...symbolResult.trades);
                    }
                }
            }

            return trades;
        } catch (error) {
            console.log(`⚠️  Error reading file ${filePath}:`, error);
            return [];
        }
    }

    private async performAnalysis(trades: TradeResult[]): Promise<OverallAnalysis> {
        // Group trades by symbol
        const symbolGroups = this.groupTradesBySymbol(trades);

        // Analyze each symbol
        const symbolAnalyses: SymbolAnalysis[] = [];

        for (const [symbol, symbolTrades] of Object.entries(symbolGroups)) {
            const analysis = this.analyzeSymbol(symbol, symbolTrades);
            symbolAnalyses.push(analysis);
        }

        // Calculate overall metrics
        const overallAnalysis = this.calculateOverallMetrics(symbolAnalyses);

        return overallAnalysis;
    }

    private groupTradesBySymbol(trades: TradeResult[]): { [symbol: string]: TradeResult[] } {
        const groups: { [symbol: string]: TradeResult[] } = {};

        for (const trade of trades) {
            if (!groups[trade.symbol]) {
                groups[trade.symbol] = [];
            }
            groups[trade.symbol].push(trade);
        }

        return groups;
    }

    private analyzeSymbol(symbol: string, trades: TradeResult[]): SymbolAnalysis {
        const winningTrades = trades.filter(t => t.success);
        const losingTrades = trades.filter(t => !t.success);

        const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
        const avgPnl = totalPnl / trades.length;
        const avgPnlPercent = trades.reduce((sum, t) => sum + t.pnlPercent, 0) / trades.length;
        const successRate = winningTrades.length / trades.length;
        const avgConfidence = trades.reduce((sum, t) => sum + t.confidence, 0) / trades.length;
        const avgHoldingPeriod = trades.reduce((sum, t) => sum + t.holdingPeriod, 0) / trades.length;

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

        // Calculate Sharpe ratio (simplified)
        const returns = trades.map(t => t.pnlPercent);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

        // Find best timeframe
        const timeframeGroups = this.groupTradesByTimeframe(trades);
        let bestTimeframe = 'unknown';
        let bestTimeframePnl = -Infinity;

        for (const [timeframe, timeframeTrades] of Object.entries(timeframeGroups)) {
            const timeframePnl = timeframeTrades.reduce((sum, t) => sum + t.pnl, 0);
            if (timeframePnl > bestTimeframePnl) {
                bestTimeframePnl = timeframePnl;
                bestTimeframe = timeframe;
            }
        }

        // Calculate risk-adjusted return
        const riskAdjustedReturn = maxDrawdown > 0 ? totalPnl / maxDrawdown : totalPnl;

        // Calculate optimal parameters
        const optimalPositionSize = Math.min(0.05, Math.max(0.01, 1 / Math.sqrt(trades.length)));
        const optimalStopLoss = Math.max(0.02, Math.min(0.1, avgPnlPercent * -2));
        const optimalTakeProfit = Math.max(0.05, Math.min(0.2, avgPnlPercent * 3));

        return {
            symbol,
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            totalPnl,
            successRate,
            avgPnl,
            avgPnlPercent,
            maxDrawdown,
            sharpeRatio,
            avgConfidence,
            avgHoldingPeriod,
            bestTimeframe,
            riskAdjustedReturn,
            optimalPositionSize,
            optimalStopLoss,
            optimalTakeProfit,
            trades
        };
    }

    private groupTradesByTimeframe(trades: TradeResult[]): { [timeframe: string]: TradeResult[] } {
        const groups: { [timeframe: string]: TradeResult[] } = {};

        for (const trade of trades) {
            if (!groups[trade.timeframe]) {
                groups[trade.timeframe] = [];
            }
            groups[trade.timeframe].push(trade);
        }

        return groups;
    }

    private calculateOverallMetrics(symbolAnalyses: SymbolAnalysis[]): OverallAnalysis {
        const allTrades = symbolAnalyses.flatMap(s => s.trades);

        const totalTrades = allTrades.length;
        const totalPnl = allTrades.reduce((sum, t) => sum + t.pnl, 0);
        const avgSuccessRate = symbolAnalyses.reduce((sum, s) => sum + s.successRate, 0) / symbolAnalyses.length;
        const avgPnl = totalPnl / totalTrades;

        // Calculate max drawdown across all symbols
        let maxDrawdown = 0;
        let peak = 0;
        let runningPnl = 0;

        for (const trade of allTrades) {
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
        const returns = allTrades.map(t => t.pnlPercent);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const sharpeRatio = variance > 0 ? avgReturn / Math.sqrt(variance) : 0;

        // Sort symbols by performance
        const sortedSymbols = [...symbolAnalyses].sort((a, b) => b.totalPnl - a.totalPnl);
        const bestSymbols = sortedSymbols.slice(0, 5);
        const worstSymbols = sortedSymbols.slice(-5).reverse();

        // Analyze timeframe performance
        const timeframePerformance = this.analyzeTimeframePerformance(allTrades);

        // Analyze confidence levels
        const confidenceAnalysis = this.analyzeConfidenceLevels(allTrades);

        // Calculate risk metrics
        const riskMetrics = this.calculateRiskMetrics(allTrades);

        return {
            totalTrades,
            totalPnl,
            avgSuccessRate,
            avgPnl,
            maxDrawdown,
            sharpeRatio,
            bestSymbols,
            worstSymbols,
            timeframePerformance,
            confidenceAnalysis,
            riskMetrics
        };
    }

    private analyzeTimeframePerformance(trades: TradeResult[]): { [key: string]: any } {
        const timeframeGroups = this.groupTradesByTimeframe(trades);
        const performance: { [key: string]: any } = {};

        for (const [timeframe, timeframeTrades] of Object.entries(timeframeGroups)) {
            const totalPnl = timeframeTrades.reduce((sum, t) => sum + t.pnl, 0);
            const successRate = timeframeTrades.filter(t => t.success).length / timeframeTrades.length;
            const avgPnl = totalPnl / timeframeTrades.length;

            performance[timeframe] = {
                totalTrades: timeframeTrades.length,
                totalPnl,
                successRate,
                avgPnl
            };
        }

        return performance;
    }

    private analyzeConfidenceLevels(trades: TradeResult[]): { [key: string]: any } {
        const confidenceRanges = [
            { min: 0.6, max: 0.7, label: '60-70%' },
            { min: 0.7, max: 0.8, label: '70-80%' },
            { min: 0.8, max: 0.9, label: '80-90%' },
            { min: 0.9, max: 1.0, label: '90-100%' }
        ];

        const analysis: { [key: string]: any } = {};

        for (const range of confidenceRanges) {
            const rangeTrades = trades.filter(t => t.confidence >= range.min && t.confidence < range.max);

            if (rangeTrades.length > 0) {
                const totalPnl = rangeTrades.reduce((sum, t) => sum + t.pnl, 0);
                const successRate = rangeTrades.filter(t => t.success).length / rangeTrades.length;
                const avgPnl = totalPnl / rangeTrades.length;

                analysis[range.label] = {
                    totalTrades: rangeTrades.length,
                    totalPnl,
                    successRate,
                    avgPnl
                };
            }
        }

        return analysis;
    }

    private calculateRiskMetrics(trades: TradeResult[]): any {
        const winningTrades = trades.filter(t => t.success);
        const losingTrades = trades.filter(t => !t.success);

        const maxSingleLoss = Math.min(...trades.map(t => t.pnl));
        const maxSingleWin = Math.max(...trades.map(t => t.pnl));
        const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0;
        const winLossRatio = avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : 0;

        // Calculate VaR (Value at Risk) - 95% confidence
        const sortedReturns = trades.map(t => t.pnlPercent).sort((a, b) => a - b);
        const varIndex = Math.floor(sortedReturns.length * 0.05);
        const var95 = sortedReturns[varIndex] || 0;

        return {
            var95,
            maxSingleLoss,
            maxSingleWin,
            avgWin,
            avgLoss,
            winLossRatio
        };
    }

    private displayAnalysis(analysis: OverallAnalysis): void {
        console.log('📊 PAPER TRADING ANALYSIS RESULTS');
        console.log('==================================\n');

        // Overall performance
        console.log('🎯 OVERALL PERFORMANCE:');
        console.log('=======================');
        console.log(`📈 Total Trades: ${analysis.totalTrades}`);
        console.log(`💰 Total P&L: ₹${analysis.totalPnl.toFixed(2)}`);
        console.log(`📊 Average Success Rate: ${(analysis.avgSuccessRate * 100).toFixed(1)}%`);
        console.log(`📈 Average P&L per Trade: ₹${analysis.avgPnl.toFixed(2)}`);
        console.log(`📉 Maximum Drawdown: ₹${analysis.maxDrawdown.toFixed(2)}`);
        console.log(`📊 Sharpe Ratio: ${analysis.sharpeRatio.toFixed(3)}`);
        console.log('');

        // Risk metrics
        console.log('⚠️  RISK METRICS:');
        console.log('=================');
        console.log(`📊 VaR (95%): ${(analysis.riskMetrics.var95 * 100).toFixed(2)}%`);
        console.log(`📉 Max Single Loss: ₹${analysis.riskMetrics.maxSingleLoss.toFixed(2)}`);
        console.log(`📈 Max Single Win: ₹${analysis.riskMetrics.maxSingleWin.toFixed(2)}`);
        console.log(`📊 Average Win: ₹${analysis.riskMetrics.avgWin.toFixed(2)}`);
        console.log(`📉 Average Loss: ₹${analysis.riskMetrics.avgLoss.toFixed(2)}`);
        console.log(`📊 Win/Loss Ratio: ${analysis.riskMetrics.winLossRatio.toFixed(2)}`);
        console.log('');

        // Best performers
        if (analysis.bestSymbols.length > 0) {
            console.log('🏆 TOP PERFORMERS:');
            console.log('==================');
            analysis.bestSymbols.forEach((symbol, index) => {
                console.log(`${index + 1}. ${symbol.symbol}: ₹${symbol.totalPnl.toFixed(2)} (${(symbol.successRate * 100).toFixed(1)}% success)`);
            });
            console.log('');
        }

        // Worst performers
        if (analysis.worstSymbols.length > 0) {
            console.log('📉 WORST PERFORMERS:');
            console.log('====================');
            analysis.worstSymbols.forEach((symbol, index) => {
                console.log(`${index + 1}. ${symbol.symbol}: ₹${symbol.totalPnl.toFixed(2)} (${(symbol.successRate * 100).toFixed(1)}% success)`);
            });
            console.log('');
        }

        // Timeframe performance
        if (Object.keys(analysis.timeframePerformance).length > 0) {
            console.log('⏰ TIMEFRAME PERFORMANCE:');
            console.log('=========================');
            Object.entries(analysis.timeframePerformance).forEach(([timeframe, perf]) => {
                console.log(`${timeframe.padEnd(8)} | ${perf.totalTrades.toString().padStart(3)} trades | ₹${perf.totalPnl.toFixed(2).padStart(8)} | ${(perf.successRate * 100).toFixed(1).padStart(5)}% success`);
            });
            console.log('');
        }

        // Confidence analysis
        if (Object.keys(analysis.confidenceAnalysis).length > 0) {
            console.log('🎯 CONFIDENCE LEVEL ANALYSIS:');
            console.log('=============================');
            Object.entries(analysis.confidenceAnalysis).forEach(([confidence, perf]) => {
                console.log(`${confidence.padEnd(8)} | ${perf.totalTrades.toString().padStart(3)} trades | ₹${perf.totalPnl.toFixed(2).padStart(8)} | ${(perf.successRate * 100).toFixed(1).padStart(5)}% success`);
            });
            console.log('');
        }

        // Recommendations
        console.log('💡 RECOMMENDATIONS FOR LIVE TRADING:');
        console.log('====================================');

        if (analysis.totalPnl > 0) {
            console.log('✅ System shows positive returns - ready for live trading');
        } else {
            console.log('⚠️  System shows negative returns - needs optimization');
        }

        if (analysis.avgSuccessRate > 0.6) {
            console.log('✅ Good success rate - strategy is working');
        } else {
            console.log('⚠️  Low success rate - consider strategy adjustments');
        }

        if (analysis.sharpeRatio > 1) {
            console.log('✅ Good risk-adjusted returns');
        } else {
            console.log('⚠️  Poor risk-adjusted returns - high volatility');
        }

        console.log('');
        console.log('🚀 Next Steps:');
        console.log('1. Run live trading setup script');
        console.log('2. Start with small position sizes');
        console.log('3. Monitor performance closely');
        console.log('4. Adjust parameters based on results');
    }

    private async saveDetailedAnalysis(analysis: OverallAnalysis): Promise<void> {
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `detailed-analysis-${timestamp}.json`;
        const filepath = path.join(this.resultsDir, filename);

        try {
            await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));
            console.log(`💾 Detailed analysis saved to: ${filepath}`);
        } catch (error) {
            console.error('❌ Error saving detailed analysis:', error);
        }
    }
}

// Main execution
async function main() {
    const analyzer = new PaperTradingAnalyzer();
    await analyzer.analyzeResults();
}

if (require.main === module) {
    main();
} 