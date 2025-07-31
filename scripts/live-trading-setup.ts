#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';

interface LiveTradingConfig {
    symbol: string;
    enabled: boolean;
    positionSize: number;
    stopLoss: number;
    takeProfit: number;
    bestTimeframe: string;
    confidence: number;
    successRate: number;
    maxDailyTrades: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

class LiveTradingSetup {
    private minSuccessRate = 0.6; // 60% minimum success rate
    private minTrades = 5; // Minimum 5 trades for validation
    private maxRiskPerTrade = 0.02; // 2% max risk per trade

    async setupLiveTrading(): Promise<void> {
        console.log('🎯 Setting up Live Trading from Paper Trading Results...\n');

        try {
            await db.$connect();

            // Load paper trading results
            const results = await this.loadPaperTradingResults();

            if (results.length === 0) {
                console.log('⚠️  No paper trading results found. Run paper trading first.');
                return;
            }

            // Filter and rank symbols for live trading
            const liveTradingCandidates = this.filterLiveTradingCandidates(results);

            if (liveTradingCandidates.length === 0) {
                console.log('⚠️  No symbols meet live trading criteria');
                return;
            }

            // Generate live trading configuration
            const liveConfig = this.generateLiveTradingConfig(liveTradingCandidates);

            // Save configuration
            await this.saveLiveTradingConfig(liveConfig);

            // Display setup summary
            this.displaySetupSummary(liveConfig);

        } catch (error) {
            console.error('❌ Error setting up live trading:', error);
        } finally {
            await db.$disconnect();
        }
    }

    private async loadPaperTradingResults(): Promise<any[]> {
        const fs = require('fs').promises;
        const path = require('path');

        const resultsDir = path.join(__dirname, '..', 'data', 'paper-trading-results');

        try {
            const files = await fs.readdir(resultsDir);
            const resultFiles = files.filter(f => f.startsWith('nifty50-paper-trading-results-'));

            if (resultFiles.length === 0) {
                return [];
            }

            // Get the most recent file
            const latestFile = resultFiles.sort().reverse()[0];
            const filepath = path.join(resultsDir, latestFile);

            const data = await fs.readFile(filepath, 'utf8');
            const results = JSON.parse(data);

            console.log(`📊 Loaded ${results.results.length} paper trading results`);
            return results.results;

        } catch (error) {
            console.error('❌ Error loading paper trading results:', error);
            return [];
        }
    }

    private filterLiveTradingCandidates(results: any[]): any[] {
        return results.filter(result =>
            result.totalTrades >= this.minTrades &&
            result.successRate >= this.minSuccessRate &&
            result.totalPnl > 0 &&
            result.sharpeRatio > 0.5
        ).sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn);
    }

    private generateLiveTradingConfig(candidates: any[]): LiveTradingConfig[] {
        const configs: LiveTradingConfig[] = [];

        candidates.forEach((candidate, index) => {
            // Calculate position size based on success rate and risk
            const basePositionSize = Math.min(0.05, candidate.successRate * 0.1);
            const positionSize = Math.max(0.02, basePositionSize * (1 - index * 0.1));

            // Calculate stop loss based on historical performance
            const stopLoss = Math.max(0.02, Math.min(0.05, (1 - candidate.successRate) * 0.1));
            const takeProfit = stopLoss * 2; // 2:1 risk-reward ratio

            // Determine risk level
            let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
            if (candidate.successRate > 0.75 && candidate.sharpeRatio > 1.0) {
                riskLevel = 'LOW';
            } else if (candidate.successRate > 0.65 && candidate.sharpeRatio > 0.7) {
                riskLevel = 'MEDIUM';
            } else {
                riskLevel = 'HIGH';
            }

            // Calculate max daily trades based on success rate
            const maxDailyTrades = Math.floor(candidate.successRate * 5) + 1;

            configs.push({
                symbol: candidate.symbol,
                enabled: true,
                positionSize,
                stopLoss,
                takeProfit,
                bestTimeframe: candidate.bestTimeframe,
                confidence: candidate.avgConfidence,
                successRate: candidate.successRate,
                maxDailyTrades,
                riskLevel
            });
        });

        return configs;
    }

    private async saveLiveTradingConfig(configs: LiveTradingConfig[]): Promise<void> {
        const fs = require('fs').promises;
        const path = require('path');

        const configDir = path.join(__dirname, '..', 'data', 'live-trading-config');

        try {
            await fs.mkdir(configDir, { recursive: true });

            const filename = `live-trading-config-${new Date().toISOString().split('T')[0]}.json`;
            const filepath = path.join(configDir, filename);

            const config = {
                timestamp: new Date().toISOString(),
                totalSymbols: configs.length,
                capital: 1000000, // 10 Lakhs
                maxDailyLoss: 50000, // 5% daily loss limit
                maxOpenPositions: 10,
                timeframes: ['15min', '30min', '1hour'],
                symbols: configs
            };

            await fs.writeFile(filepath, JSON.stringify(config, null, 2));
            console.log(`💾 Live trading config saved to: ${filepath}`);

        } catch (error) {
            console.error('❌ Error saving live trading config:', error);
        }
    }

    private displaySetupSummary(configs: LiveTradingConfig[]): void {
        console.log('\n🎯 Live Trading Setup Summary:');
        console.log('==============================');
        console.log(`✅ ${configs.length} symbols configured for live trading\n`);

        configs.forEach((config, index) => {
            console.log(`${index + 1}. ${config.symbol}`);
            console.log(`   Success Rate: ${(config.successRate * 100).toFixed(1)}%`);
            console.log(`   Position Size: ${(config.positionSize * 100).toFixed(1)}%`);
            console.log(`   Stop Loss: ${(config.stopLoss * 100).toFixed(1)}%`);
            console.log(`   Take Profit: ${(config.takeProfit * 100).toFixed(1)}%`);
            console.log(`   Best Timeframe: ${config.bestTimeframe}`);
            console.log(`   Risk Level: ${config.riskLevel}`);
            console.log(`   Max Daily Trades: ${config.maxDailyTrades}`);
            console.log('');
        });

        // Risk management summary
        const totalRisk = configs.reduce((sum, config) => sum + config.positionSize, 0);
        const avgSuccessRate = configs.reduce((sum, config) => sum + config.successRate, 0) / configs.length;

        console.log('📊 Risk Management Summary:');
        console.log(`   Total Position Risk: ${(totalRisk * 100).toFixed(1)}%`);
        console.log(`   Average Success Rate: ${(avgSuccessRate * 100).toFixed(1)}%`);
        console.log(`   Recommended Capital: ₹${(1000000 * totalRisk).toFixed(0)}`);

        console.log('\n🚀 Ready for Live Trading!');
        console.log('   Run: npx ts-node scripts/start-live-trading.ts');
    }

    async loadLiveTradingConfig(): Promise<any> {
        const fs = require('fs').promises;
        const path = require('path');

        const configDir = path.join(__dirname, '..', 'data', 'live-trading-config');

        try {
            const files = await fs.readdir(configDir);
            const configFiles = files.filter(f => f.startsWith('live-trading-config-'));

            if (configFiles.length === 0) {
                console.log('⚠️  No live trading config found');
                return null;
            }

            // Get the most recent file
            const latestFile = configFiles.sort().reverse()[0];
            const filepath = path.join(configDir, latestFile);

            const data = await fs.readFile(filepath, 'utf8');
            const config = JSON.parse(data);

            console.log(`📊 Loaded live trading config with ${config.symbols.length} symbols`);
            return config;

        } catch (error) {
            console.error('❌ Error loading live trading config:', error);
            return null;
        }
    }
}

// Main execution
async function main() {
    const setup = new LiveTradingSetup();
    await setup.setupLiveTrading();
}

if (require.main === module) {
    main();
}

export { LiveTradingSetup, LiveTradingConfig }; 