#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';

interface PaperTradingResult {
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
    marketCondition: string;
    riskLevel: string;
    recommendedForLive: boolean;
    liveTradingWeight: number;
    optimalPositionSize: number;
    optimalStopLoss: number;
    optimalTakeProfit: number;
    timestamp: Date;
}

class PaperTradingResultsManager {
    async saveResults(results: PaperTradingResult[]): Promise<void> {
        try {
            console.log('💾 Saving paper trading results for live trading...\n');

            await db.$connect();

            for (const result of results) {
                await this.saveResultToDatabase(result);
            }

            console.log(`✅ Saved ${results.length} results for live trading`);

            // Generate live trading recommendations
            await this.generateLiveTradingRecommendations(results);

        } catch (error) {
            console.error('❌ Error saving results:', error);
        } finally {
            await db.$disconnect();
        }
    }

    private async saveResultToDatabase(result: PaperTradingResult): Promise<void> {
        try {
            // Save to a custom table or use existing tables
            // For now, we'll log the results and save to a JSON file
            console.log(`📊 ${result.symbol}: ${(result.successRate * 100).toFixed(1)}% success, ₹${result.totalPnl.toFixed(2)} P&L`);

            // You can create a custom table in your database schema for this
            // For now, we'll save to a JSON file
            await this.saveToJsonFile(result);

        } catch (error) {
            console.error(`❌ Error saving result for ${result.symbol}:`, error);
        }
    }

    private async saveToJsonFile(result: PaperTradingResult): Promise<void> {
        const fs = require('fs').promises;
        const path = require('path');

        const resultsDir = path.join(__dirname, '..', 'data', 'paper-trading-results');

        try {
            await fs.mkdir(resultsDir, { recursive: true });

            const filename = `paper-trading-${result.symbol}-${new Date().toISOString().split('T')[0]}.json`;
            const filepath = path.join(resultsDir, filename);

            await fs.writeFile(filepath, JSON.stringify(result, null, 2));

        } catch (error) {
            console.error(`❌ Error saving to file for ${result.symbol}:`, error);
        }
    }

    private async generateLiveTradingRecommendations(results: PaperTradingResult[]): Promise<void> {
        console.log('\n🎯 Live Trading Recommendations:');
        console.log('================================');

        // Filter results for live trading
        const liveTradingCandidates = results.filter(r =>
            r.totalTrades >= 5 &&
            r.successRate >= 0.6 &&
            r.sharpeRatio > 0.5 &&
            r.totalPnl > 0
        );

        if (liveTradingCandidates.length === 0) {
            console.log('⚠️  No symbols meet live trading criteria');
            return;
        }

        // Sort by risk-adjusted return
        const sortedCandidates = liveTradingCandidates.sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn);

        console.log(`✅ ${sortedCandidates.length} symbols recommended for live trading:\n`);

        sortedCandidates.forEach((candidate, index) => {
            const position = index + 1;
            const weight = Math.max(0.1, 1 - (index * 0.1)); // Decreasing weight for lower ranked symbols

            console.log(`${position}. ${candidate.symbol}`);
            console.log(`   Success Rate: ${(candidate.successRate * 100).toFixed(1)}%`);
            console.log(`   Total P&L: ₹${candidate.totalPnl.toFixed(2)}`);
            console.log(`   Sharpe Ratio: ${candidate.sharpeRatio.toFixed(2)}`);
            console.log(`   Best Timeframe: ${candidate.bestTimeframe}`);
            console.log(`   Live Trading Weight: ${(weight * 100).toFixed(1)}%`);
            console.log(`   Optimal Position Size: ${(candidate.optimalPositionSize * 100).toFixed(1)}%`);
            console.log(`   Stop Loss: ${(candidate.optimalStopLoss * 100).toFixed(1)}%`);
            console.log(`   Take Profit: ${(candidate.optimalTakeProfit * 100).toFixed(1)}%`);
            console.log('');
        });

        // Save recommendations to file
        await this.saveRecommendationsToFile(sortedCandidates);
    }

    private async saveRecommendationsToFile(candidates: PaperTradingResult[]): Promise<void> {
        const fs = require('fs').promises;
        const path = require('path');

        const recommendationsDir = path.join(__dirname, '..', 'data', 'live-trading-recommendations');

        try {
            await fs.mkdir(recommendationsDir, { recursive: true });

            const filename = `live-trading-recommendations-${new Date().toISOString().split('T')[0]}.json`;
            const filepath = path.join(recommendationsDir, filename);

            const recommendations = {
                timestamp: new Date().toISOString(),
                totalCandidates: candidates.length,
                recommendations: candidates.map((candidate, index) => ({
                    rank: index + 1,
                    symbol: candidate.symbol,
                    successRate: candidate.successRate,
                    totalPnl: candidate.totalPnl,
                    sharpeRatio: candidate.sharpeRatio,
                    bestTimeframe: candidate.bestTimeframe,
                    liveTradingWeight: Math.max(0.1, 1 - (index * 0.1)),
                    optimalPositionSize: candidate.optimalPositionSize,
                    optimalStopLoss: candidate.optimalStopLoss,
                    optimalTakeProfit: candidate.optimalTakeProfit,
                    recommendedForLive: true
                }))
            };

            await fs.writeFile(filepath, JSON.stringify(recommendations, null, 2));
            console.log(`💾 Live trading recommendations saved to: ${filepath}`);

        } catch (error) {
            console.error('❌ Error saving recommendations:', error);
        }
    }

    async loadRecommendations(): Promise<any[]> {
        const fs = require('fs').promises;
        const path = require('path');

        const recommendationsDir = path.join(__dirname, '..', 'data', 'live-trading-recommendations');

        try {
            const files = await fs.readdir(recommendationsDir);
            const recommendationFiles = files.filter(f => f.startsWith('live-trading-recommendations-'));

            if (recommendationFiles.length === 0) {
                console.log('⚠️  No live trading recommendations found');
                return [];
            }

            // Get the most recent file
            const latestFile = recommendationFiles.sort().reverse()[0];
            const filepath = path.join(recommendationsDir, latestFile);

            const data = await fs.readFile(filepath, 'utf8');
            const recommendations = JSON.parse(data);

            console.log(`📊 Loaded ${recommendations.recommendations.length} live trading recommendations`);
            return recommendations.recommendations;

        } catch (error) {
            console.error('❌ Error loading recommendations:', error);
            return [];
        }
    }
}

// Main execution
async function main() {
    const manager = new PaperTradingResultsManager();

    // Example usage - you would typically call this from your paper trading script
    const exampleResults: PaperTradingResult[] = [
        {
            symbol: 'RELIANCE',
            totalTrades: 10,
            winningTrades: 7,
            losingTrades: 3,
            totalPnl: 1500.50,
            successRate: 0.7,
            avgPnl: 150.05,
            maxDrawdown: -200.00,
            sharpeRatio: 1.2,
            bestTimeframe: '15min',
            avgConfidence: 0.75,
            riskAdjustedReturn: 0.84,
            marketCondition: 'TRENDING',
            riskLevel: 'MEDIUM',
            recommendedForLive: true,
            liveTradingWeight: 0.9,
            optimalPositionSize: 0.05,
            optimalStopLoss: 0.03,
            optimalTakeProfit: 0.06,
            timestamp: new Date()
        }
    ];

    await manager.saveResults(exampleResults);
}

if (require.main === module) {
    main();
}

export { PaperTradingResultsManager, PaperTradingResult }; 