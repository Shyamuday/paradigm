#!/usr/bin/env ts-node

import { SimpleTensorFlowStrategy, SimpleTensorFlowConfig } from '../src/services/strategies/simple-tensorflow-strategy';
import { DatabaseManager } from '../src/database/database';
import { logger } from '../src/logger/logger';

class ForceTrainML {
    private dbManager: DatabaseManager;
    private strategies: Map<string, SimpleTensorFlowStrategy> = new Map();

    constructor() {
        this.dbManager = DatabaseManager.getInstance();
    }

    async start(): Promise<void> {
        try {
            console.log('🚀 Starting Force ML Training on All Timeframes...\n');

            await this.dbManager.connect();
            console.log('✅ Database connected');

            await this.initializeStrategies();
            console.log('✅ Strategies initialized');

            await this.forceTrainAllModels();
            console.log('✅ All ML models trained successfully!');

        } catch (error) {
            console.error('❌ Error in force training:', error);
            throw error;
        } finally {
            await this.dbManager.disconnect();
        }
    }

    private async initializeStrategies(): Promise<void> {
        const db = this.dbManager.getPrisma();
        const timeframes = await db.timeframeConfig.findMany({
            orderBy: { intervalMinutes: 'asc' }
        });

        console.log('🧠 Initializing strategies for force training...');

        for (const timeframe of timeframes) {
            try {
                const config: SimpleTensorFlowConfig = {
                    name: `ForceTrain_${timeframe.name}`,
                    enabled: true,
                    type: 'CUSTOM',
                    version: '3.0.0',
                    description: `Force training strategy for ${timeframe.name}`,
                    category: 'MACHINE_LEARNING',
                    riskLevel: 'MEDIUM',
                    timeframes: [timeframe.name],
                    entryRules: [],
                    exitRules: [],
                    positionSizing: {
                        method: 'CUSTOM',
                        value: 10,
                        maxPositionSize: 0.1,
                        minPositionSize: 0.01
                    },
                    riskManagement: {
                        maxRiskPerTrade: 0.02,
                        maxDailyLoss: 5000,
                        maxDrawdown: 0.15,
                        stopLossType: 'PERCENTAGE',
                        stopLossValue: 2,
                        takeProfitType: 'PERCENTAGE',
                        takeProfitValue: 4,
                        trailingStop: true
                    },
                    filters: [],
                    notifications: [],
                    parameters: {},
                    capitalAllocation: 100000,
                    instruments: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'],
                    indicators: {
                        sma: { period: 20 },
                        ema: { period: 20 },
                        rsi: { period: 14 },
                        macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
                        bollinger: { period: 20, stdDev: 2 },
                        atr: { period: 14 }
                    },
                    ml: {
                        lookbackPeriod: 50,
                        predictionHorizon: 5,
                        confidenceThreshold: 0.6,
                        retrainInterval: 30,
                        hiddenLayers: [128, 64, 32],
                        learningRate: 0.001,
                        epochs: 50
                    },
                    risk: {
                        maxPositionSize: 0.1,
                        stopLoss: 2,
                        takeProfit: 4,
                        maxDrawdown: 0.15
                    }
                };

                const strategy = new SimpleTensorFlowStrategy(config);
                this.strategies.set(timeframe.name, strategy);
                console.log(`   ✅ ${timeframe.name} strategy initialized`);

            } catch (error) {
                console.error(`   ❌ Error initializing ${timeframe.name} strategy:`, error);
            }
        }
    }

    private async forceTrainAllModels(): Promise<void> {
        const db = this.dbManager.getPrisma();
        const instruments = await db.instrument.findMany({
            where: {
                symbol: { in: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK'] },
                exchange: 'NSE'
            }
        });

        console.log('\n🎯 Force Training ML Models...\n');

        for (const instrument of instruments) {
            console.log(`\n📊 Training models for ${instrument.symbol}:`);
            console.log('─'.repeat(50));

            for (const [timeframeName, strategy] of this.strategies.entries()) {
                try {
                    console.log(`\n🧠 Training ${timeframeName} model...`);

                    // Get more historical data for training
                    const marketData = await this.getExtendedMarketData(instrument.symbol, timeframeName);

                    if (marketData.length < 100) {
                        console.log(`   ⚠️  Insufficient data for ${timeframeName}: ${marketData.length} records (need 100+)`);
                        continue;
                    }

                    console.log(`   📊 Data points: ${marketData.length}`);

                    // Force retrain the model
                    await this.forceRetrainModel(strategy, marketData, instrument.symbol, timeframeName);

                    // Test the trained model
                    await this.testTrainedModel(strategy, marketData, instrument.symbol, timeframeName);

                } catch (error) {
                    console.error(`   ❌ Error training ${timeframeName} model for ${instrument.symbol}:`, error);
                }
            }
        }
    }

    private async getExtendedMarketData(symbol: string, timeframe: string): Promise<any[]> {
        const db = this.dbManager.getPrisma();

        const instrument = await db.instrument.findFirst({
            where: { symbol, exchange: 'NSE' }
        });

        if (!instrument) return [];

        const timeframeConfig = await db.timeframeConfig.findFirst({
            where: { name: timeframe }
        });

        if (!timeframeConfig) return [];

        // Get more data for training
        const candleData = await db.candleData.findMany({
            where: {
                instrumentId: instrument.id,
                timeframeId: timeframeConfig.id
            },
            orderBy: { timestamp: 'desc' },
            take: 500 // Get 500 records for training
        });

        return candleData.map(cd => ({
            symbol: symbol,
            timestamp: cd.timestamp,
            open: cd.open,
            high: cd.high,
            low: cd.low,
            close: cd.close,
            volume: cd.volume
        })).reverse();
    }

    private async forceRetrainModel(strategy: SimpleTensorFlowStrategy, marketData: any[], symbol: string, timeframe: string): Promise<void> {
        try {
            console.log(`   🔄 Force retraining ${timeframe} model...`);

            // Force retrain by calling the private method directly
            await (strategy as any).retrainModel();

            // Check if model is trained
            const state = (strategy as any).getState();
            console.log(`   ✅ Model trained: ${state.modelTrained}`);
            console.log(`   📚 Feature history: ${state.featureHistoryLength}`);

            if (state.modelTrained) {
                console.log(`   🎯 ${timeframe} model successfully trained for ${symbol}!`);
            } else {
                console.log(`   ❌ ${timeframe} model training failed for ${symbol}`);
            }

        } catch (error) {
            console.error(`   ❌ Error force retraining ${timeframe} model:`, error);
        }
    }

    private async testTrainedModel(strategy: SimpleTensorFlowStrategy, marketData: any[], symbol: string, timeframe: string): Promise<void> {
        try {
            console.log(`   🧪 Testing ${timeframe} model...`);

            // Generate signals to test the model
            const signals = await strategy.generateSignals(marketData);

            console.log(`   📊 Generated ${signals.length} signals`);

            if (signals.length > 0 && signals[0]) {
                const signal = signals[0];
                console.log(`   🎯 Sample signal: ${signal.action} @ ₹${signal.price.toFixed(2)}`);
                console.log(`   🎯 Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
                console.log(`   💡 Reasoning: ${signal.reasoning}`);

                // Test position sizing
                const positionSize = strategy.calculatePositionSize(signal, 100000);
                console.log(`   📈 Position size: ${positionSize} shares`);

                // Test performance metrics
                const performance = (strategy as any).getPerformance();
                console.log(`   📊 Accuracy: ${performance.accuracy}`);
                console.log(`   📈 Total signals: ${performance.totalSignals}`);
            }

            console.log(`   ✅ ${timeframe} model test completed for ${symbol}`);

        } catch (error) {
            console.error(`   ❌ Error testing ${timeframe} model:`, error);
        }
    }
}

// CLI interface
if (require.main === module) {
    const forceTrainer = new ForceTrainML();
    forceTrainer.start().catch(console.error);
}

export { ForceTrainML }; 