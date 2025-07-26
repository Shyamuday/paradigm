#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { AdvancedBacktestEngine } from '../src/services/advanced-backtest-engine.service';
import { MovingAverageStrategy } from '../src/services/strategies/moving-average-strategy';
import { RsiStrategy } from '../src/services/strategies/rsi-strategy';
import { BreakoutStrategy } from '../src/services/strategies/breakout-strategy';
import { MLStrategy } from '../src/services/strategies/ml-strategy';
import { ConfigManager } from '../src/config/config-manager';
import { logger } from '../src/logger/logger';

// Load environment variables
config();

async function runBacktest() {
    try {
        logger.info('🚀 Starting comprehensive backtest...');

        // Load configuration
        const configManager = new ConfigManager();
        const config = await configManager.getConfig();

        // Create backtest configuration
        const backtestConfig = {
            startDate: new Date('2024-01-01'),
            endDate: new Date('2024-12-31'),
            initialCapital: 100000,
            commission: 0.0005, // 0.05% commission
            slippage: 0.0001,   // 0.01% slippage
            dataSource: 'historical',
            instruments: ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY'],
            strategies: ['MovingAverage', 'RSI', 'Breakout', 'ML'],
            walkForward: {
                enabled: true,
                windowSize: 60,    // 60 days training
                stepSize: 30,      // 30 days step
                minTestPeriod: 30  // 30 days minimum test
            },
            monteCarlo: {
                enabled: true,
                simulations: 1000,
                confidenceLevel: 0.95
            },
            riskManagement: {
                maxDrawdown: 0.15,
                stopLoss: 0.02,
                takeProfit: 0.04,
                positionSizing: 'optimal' as const
            }
        };

        // Create backtest engine
        const backtestEngine = new AdvancedBacktestEngine(backtestConfig);

        // Add strategies
        const movingAverageStrategy = new MovingAverageStrategy();
        await movingAverageStrategy.initialize({
            name: 'MovingAverage',
            enabled: true,
            parameters: {
                shortPeriod: 10,
                longPeriod: 20,
                stopLoss: 0.02,
                takeProfit: 0.04
            },
            capitalAllocation: 0.25,
            instruments: ['NIFTY'],
            type: 'TREND_FOLLOWING',
            version: '1.0.0',
            category: 'TECHNICAL',
            riskLevel: 'MEDIUM',
            timeframes: ['1D'],
            entryRules: [],
            exitRules: [],
            positionSizing: {
                method: 'PERCENTAGE',
                value: 0.1,
                maxPositionSize: 0.25,
                minPositionSize: 0.01
            },
            riskManagement: {
                maxRiskPerTrade: 0.02,
                maxDailyLoss: 1000,
                maxDrawdown: 0.15,
                stopLossType: 'PERCENTAGE',
                stopLossValue: 0.02,
                takeProfitType: 'PERCENTAGE',
                takeProfitValue: 0.04,
                trailingStop: false
            },
            filters: [],
            notifications: []
        });

        const rsiStrategy = new RsiStrategy();
        await rsiStrategy.initialize({
            name: 'RSI',
            enabled: true,
            parameters: {
                period: 14,
                overbought: 70,
                oversold: 30,
                stopLoss: 0.02,
                takeProfit: 0.04
            },
            capitalAllocation: 0.25,
            instruments: ['NIFTY'],
            type: 'MEAN_REVERSION',
            version: '1.0.0',
            category: 'TECHNICAL',
            riskLevel: 'MEDIUM',
            timeframes: ['1D'],
            entryRules: [],
            exitRules: [],
            positionSizing: {
                method: 'PERCENTAGE',
                value: 0.1,
                maxPositionSize: 0.25,
                minPositionSize: 0.01
            },
            riskManagement: {
                maxRiskPerTrade: 0.02,
                maxDailyLoss: 1000,
                maxDrawdown: 0.15,
                stopLossType: 'PERCENTAGE',
                stopLossValue: 0.02,
                takeProfitType: 'PERCENTAGE',
                takeProfitValue: 0.04,
                trailingStop: false
            },
            filters: [],
            notifications: []
        });

        const breakoutStrategy = new BreakoutStrategy();
        await breakoutStrategy.initialize({
            name: 'Breakout',
            enabled: true,
            parameters: {
                lookbackPeriod: 20,
                breakoutThreshold: 2,
                stopLoss: 0.02,
                takeProfit: 0.04
            },
            capitalAllocation: 0.25,
            instruments: ['NIFTY'],
            type: 'BREAKOUT',
            version: '1.0.0',
            category: 'TECHNICAL',
            riskLevel: 'MEDIUM',
            timeframes: ['1D'],
            entryRules: [],
            exitRules: [],
            positionSizing: {
                method: 'PERCENTAGE',
                value: 0.1,
                maxPositionSize: 0.25,
                minPositionSize: 0.01
            },
            riskManagement: {
                maxRiskPerTrade: 0.02,
                maxDailyLoss: 1000,
                maxDrawdown: 0.15,
                stopLossType: 'PERCENTAGE',
                stopLossValue: 0.02,
                takeProfitType: 'PERCENTAGE',
                takeProfitValue: 0.04,
                trailingStop: false
            },
            filters: [],
            notifications: []
        });

        const mlStrategy = new MLStrategy({
            name: 'ML',
            enabled: true,
            parameters: {},
            capitalAllocation: 0.25,
            instruments: ['NIFTY'],
            type: 'CUSTOM',
            version: '1.0.0',
            category: 'MACHINE_LEARNING',
            riskLevel: 'MEDIUM',
            timeframes: ['1D'],
            entryRules: [],
            exitRules: [],
            positionSizing: {
                method: 'PERCENTAGE',
                value: 0.1,
                maxPositionSize: 0.25,
                minPositionSize: 0.01
            },
            riskManagement: {
                maxRiskPerTrade: 0.02,
                maxDailyLoss: 1000,
                maxDrawdown: 0.15,
                stopLossType: 'PERCENTAGE',
                stopLossValue: 0.02,
                takeProfitType: 'PERCENTAGE',
                takeProfitValue: 0.04,
                trailingStop: false
            },
            filters: [],
            notifications: [],
            indicators: {
                sma: { period: 20 },
                ema: { period: 12 },
                rsi: { period: 14 },
                macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
                bollinger: { period: 20, stdDev: 2 },
                atr: { period: 14 }
            },
            ml: {
                lookbackPeriod: 50,
                predictionHorizon: 5,
                confidenceThreshold: 0.7,
                retrainInterval: 30,
                featureEngineering: true
            },
            risk: {
                maxPositionSize: 0.1,
                stopLoss: 0.02,
                takeProfit: 0.04,
                maxDrawdown: 0.15
            }
        });

        backtestEngine.addStrategy('MovingAverage', movingAverageStrategy);
        backtestEngine.addStrategy('RSI', rsiStrategy);
        backtestEngine.addStrategy('Breakout', breakoutStrategy);
        backtestEngine.addStrategy('ML', mlStrategy);

        // Add mock market data (in real implementation, load from database or API)
        const mockData = generateMockMarketData(backtestConfig.startDate, backtestConfig.endDate);
        backtestEngine.addMarketData('NIFTY', mockData);

        // Run backtest
        const results = await backtestEngine.runBacktest();

        // Display results
        displayBacktestResults(results);

    } catch (error) {
        logger.error('Backtest failed:', error);
        console.error('❌ Error running backtest:', error);
        process.exit(1);
    }
}

function displayBacktestResults(results: any) {
    console.log('\n📊 BACKTEST RESULTS');
    console.log('===================');

    // Overall Performance
    console.log('\n💰 Overall Performance:');
    console.log(`   Total Return: ${(results.metrics.totalReturn * 100).toFixed(2)}%`);
    console.log(`   Annualized Return: ${(results.metrics.annualizedReturn * 100).toFixed(2)}%`);
    console.log(`   Sharpe Ratio: ${results.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`   Sortino Ratio: ${results.metrics.sortinoRatio.toFixed(2)}`);
    console.log(`   Max Drawdown: ${(results.metrics.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`   Volatility: ${(results.metrics.volatility * 100).toFixed(2)}%`);

    // Trade Statistics
    console.log('\n📈 Trade Statistics:');
    console.log(`   Total Trades: ${results.metrics.totalTrades}`);
    console.log(`   Winning Trades: ${results.metrics.winningTrades}`);
    console.log(`   Losing Trades: ${results.metrics.losingTrades}`);
    console.log(`   Win Rate: ${(results.metrics.winRate * 100).toFixed(2)}%`);
    console.log(`   Profit Factor: ${results.metrics.profitFactor.toFixed(2)}`);
    console.log(`   Average Win: ₹${results.metrics.averageWin.toFixed(2)}`);
    console.log(`   Average Loss: ₹${results.metrics.averageLoss.toFixed(2)}`);

    // Risk Metrics
    console.log('\n⚠️  Risk Metrics:');
    console.log(`   VaR (95%): ${(results.metrics.var95 * 100).toFixed(2)}%`);
    console.log(`   VaR (99%): ${(results.metrics.var99 * 100).toFixed(2)}%`);
    console.log(`   Calmar Ratio: ${results.metrics.calmarRatio.toFixed(2)}`);
    console.log(`   Recovery Factor: ${results.metrics.recoveryFactor.toFixed(2)}`);
    console.log(`   Ulcer Index: ${results.metrics.ulcerIndex.toFixed(4)}`);
    console.log(`   Gain to Pain Ratio: ${results.metrics.gainToPainRatio.toFixed(2)}`);

    // Walk-Forward Analysis
    if (results.walkForward && results.walkForward.length > 0) {
        console.log('\n🔄 Walk-Forward Analysis:');
        const trainingResults = results.walkForward.filter((r: any) => r.period.type === 'training');
        const testingResults = results.walkForward.filter((r: any) => r.period.type === 'testing');

        if (trainingResults.length > 0) {
            const avgTrainingReturn = trainingResults.reduce((sum: number, r: any) => sum + r.metrics.totalReturn, 0) / trainingResults.length;
            console.log(`   Average Training Return: ${(avgTrainingReturn * 100).toFixed(2)}%`);
        }

        if (testingResults.length > 0) {
            const avgTestingReturn = testingResults.reduce((sum: number, r: any) => sum + r.metrics.totalReturn, 0) / testingResults.length;
            console.log(`   Average Testing Return: ${(avgTestingReturn * 100).toFixed(2)}%`);
        }
    }

    // Monte Carlo Simulation
    if (results.monteCarlo) {
        console.log('\n🎲 Monte Carlo Simulation:');
        console.log(`   Simulations: ${results.monteCarlo.simulations}`);
        console.log(`   Expected Return: ${(results.monteCarlo.expectedReturn * 100).toFixed(2)}%`);
        console.log(`   Expected Volatility: ${(results.monteCarlo.expectedVolatility * 100).toFixed(2)}%`);
        console.log(`   Worst Case Return: ${(results.monteCarlo.worstCaseReturn * 100).toFixed(2)}%`);
        console.log(`   Best Case Return: ${(results.monteCarlo.bestCaseReturn * 100).toFixed(2)}%`);
        console.log(`   Probability of Loss: ${(results.monteCarlo.probabilityOfLoss * 100).toFixed(2)}%`);
        console.log(`   Probability of 10%+ Drawdown: ${(results.monteCarlo.probabilityOfDrawdown * 100).toFixed(2)}%`);
    }

    console.log('\n✅ Backtest completed successfully!');
}

function generateMockMarketData(startDate: Date, endDate: Date): any[] {
    const data: any[] = [];
    let currentDate = new Date(startDate);
    let price = 18000; // Starting price for NIFTY

    while (currentDate <= endDate) {
        // Generate realistic price movements
        const change = (Math.random() - 0.5) * 200; // ±100 points
        price += change;

        // Ensure price stays reasonable
        price = Math.max(15000, Math.min(25000, price));

        const high = price + Math.random() * 50;
        const low = price - Math.random() * 50;
        const volume = Math.floor(Math.random() * 1000000) + 500000;

        data.push({
            timestamp: new Date(currentDate),
            symbol: 'NIFTY',
            open: price - change * 0.3,
            high,
            low,
            close: price,
            volume
        });

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return data;
}

// Run if called directly
if (require.main === module) {
    runBacktest();
}

export { runBacktest }; 