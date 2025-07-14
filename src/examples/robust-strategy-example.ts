import { enhancedStrategyService } from '../services/enhanced-strategy.service';
import { strategyFactory } from '../services/strategy-factory.service';
import { strategyEngine } from '../services/strategy-engine.service';
import { EnhancedMarketDataService } from '../services/enhanced-market-data.service';
import {
    StrategyConfig,
    StrategyType,
    StrategyCategory,
    RiskLevel,
    PositionSizingConfig,
    RiskManagementConfig,
    StopLossConfig,
    TakeProfitConfig,
    StrategyRule,
    TechnicalIndicator,
    IndicatorType
} from '../types';
import { logger } from '../logger/logger';

export class RobustStrategyExample {
    private marketDataService: EnhancedMarketDataService;

    constructor() {
        this.marketDataService = new EnhancedMarketDataService();
    }

    async runCompleteExample(): Promise<void> {
        try {
            logger.info('Starting Robust Strategy Module Example');

            // 1. Explore available templates
            await this.exploreTemplates();

            // 2. Create strategies from templates
            await this.createStrategiesFromTemplates();

            // 3. Create custom strategies
            await this.createCustomStrategies();

            // 4. Execute strategies with live data
            await this.executeStrategiesWithLiveData();

            // 5. Analyze strategy performance
            await this.analyzeStrategyPerformance();

            // 6. Advanced strategy configurations
            await this.advancedStrategyConfigurations();

            logger.info('Robust Strategy Module Example completed successfully');
        } catch (error) {
            logger.error('Example failed:', error);
        }
    }

    private async exploreTemplates(): Promise<void> {
        logger.info('\n=== Exploring Strategy Templates ===');

        const templates = await enhancedStrategyService.getAvailableTemplates();

        for (const template of templates) {
            logger.info(`\nTemplate: ${template.name}`);
            logger.info(`Type: ${template.type}`);
            logger.info(`Category: ${template.category}`);
            logger.info(`Risk Level: ${template.riskLevel}`);
            logger.info(`Description: ${template.description}`);
            logger.info(`Required Parameters: ${template.requiredParameters.join(', ')}`);
            logger.info(`Default Timeframes: ${template.defaultTimeframes.join(', ')}`);
            logger.info(`Tags: ${template.tags.join(', ')}`);
        }

        logger.info(`\nTotal templates available: ${templates.length}`);
    }

    private async createStrategiesFromTemplates(): Promise<void> {
        logger.info('\n=== Creating Strategies from Templates ===');

        // 1. Create Moving Average Strategy
        const maStrategy = await enhancedStrategyService.createStrategyFromTemplate(
            'moving_average_crossover',
            {
                name: 'My MA Crossover',
                enabled: true,
                parameters: {
                    shortPeriod: 5,
                    longPeriod: 15,
                    volumeThreshold: 2000
                },
                capitalAllocation: 50000,
                instruments: ['NIFTY', 'BANKNIFTY']
            }
        );
        logger.info(`Created MA Strategy: ${maStrategy.name}`);

        // 2. Create RSI Strategy
        const rsiStrategy = await enhancedStrategyService.createStrategyFromTemplate(
            'rsi_mean_reversion',
            {
                name: 'My RSI Strategy',
                enabled: true,
                parameters: {
                    period: 10,
                    oversoldThreshold: 25,
                    overboughtThreshold: 75,
                    volumeThreshold: 1500
                },
                capitalAllocation: 30000,
                instruments: ['NIFTY']
            }
        );
        logger.info(`Created RSI Strategy: ${rsiStrategy.name}`);

        // 3. Create Breakout Strategy
        const breakoutStrategy = await enhancedStrategyService.createStrategyFromTemplate(
            'breakout_strategy',
            {
                name: 'My Breakout Strategy',
                enabled: true,
                parameters: {
                    lookbackPeriod: 15,
                    breakoutThreshold: 0.015, // 1.5%
                    volumeMultiplier: 2.0,
                    confirmationPeriod: 3
                },
                capitalAllocation: 40000,
                instruments: ['BANKNIFTY']
            }
        );
        logger.info(`Created Breakout Strategy: ${breakoutStrategy.name}`);
    }

    private async createCustomStrategies(): Promise<void> {
        logger.info('\n=== Creating Custom Strategies ===');

        // 1. Custom MACD Strategy
        const macdStrategy = await this.createCustomMACDStrategy();
        logger.info(`Created Custom MACD Strategy: ${macdStrategy.name}`);

        // 2. Custom Bollinger Bands Strategy
        const bbStrategy = await this.createCustomBollingerBandsStrategy();
        logger.info(`Created Custom Bollinger Bands Strategy: ${bbStrategy.name}`);

        // 3. Custom Multi-Indicator Strategy
        const multiStrategy = await this.createCustomMultiIndicatorStrategy();
        logger.info(`Created Custom Multi-Indicator Strategy: ${multiStrategy.name}`);
    }

    private async createCustomMACDStrategy(): Promise<any> {
        const macdConfig: StrategyConfig = {
            name: 'Custom MACD Strategy',
            enabled: true,
            description: 'Custom MACD crossover strategy with volume confirmation',
            type: 'TREND_FOLLOWING',
            version: '1.0.0',
            author: 'Custom Trader',
            category: 'TECHNICAL_ANALYSIS',
            riskLevel: 'MEDIUM',
            timeframes: ['5min', '15min', '1hour'],
            entryRules: [
                {
                    id: 'macd_bullish_crossover',
                    name: 'MACD Bullish Crossover',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        fastPeriod: 12,
                        slowPeriod: 26,
                        signalPeriod: 9,
                        volumeThreshold: 1000
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter when MACD line crosses above signal line'
                }
            ],
            exitRules: [
                {
                    id: 'macd_bearish_crossover',
                    name: 'MACD Bearish Crossover',
                    type: 'EXIT',
                    condition: 'AND',
                    parameters: {
                        fastPeriod: 12,
                        slowPeriod: 26,
                        signalPeriod: 9
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit when MACD line crosses below signal line'
                }
            ],
            positionSizing: {
                method: 'RISK_PER_TRADE',
                riskPerTrade: 1.5, // 1.5% risk per trade
                maxPositionSize: 50000,
                minPositionSize: 1000
            },
            riskManagement: {
                stopLoss: {
                    type: 'ATR_BASED',
                    value: 2,
                    atrMultiplier: 2.5
                },
                takeProfit: {
                    type: 'RISK_REWARD_RATIO',
                    value: 2.5
                },
                maxDrawdown: 8,
                maxDailyLoss: 3,
                maxOpenPositions: 3
            },
            filters: [
                {
                    id: 'volume_filter',
                    name: 'Volume Filter',
                    type: 'VOLUME_FILTER',
                    parameters: {
                        minVolume: 1000,
                        volumePeriod: 20
                    },
                    isActive: true,
                    description: 'Only trade when volume is above average'
                }
            ],
            notifications: [
                {
                    id: 'signal_notification',
                    type: 'SIGNAL_GENERATED',
                    conditions: [],
                    channels: [
                        {
                            type: 'EMAIL',
                            config: { email: 'trader@example.com' }
                        }
                    ],
                    isActive: true
                }
            ],
            parameters: {
                fastPeriod: 12,
                slowPeriod: 26,
                signalPeriod: 9,
                volumeThreshold: 1000
            },
            capitalAllocation: 100000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };

        return await enhancedStrategyService.createStrategy(macdConfig);
    }

    private async createCustomBollingerBandsStrategy(): Promise<any> {
        const bbConfig: StrategyConfig = {
            name: 'Custom Bollinger Bands Strategy',
            enabled: true,
            description: 'Mean reversion strategy using Bollinger Bands',
            type: 'MEAN_REVERSION',
            version: '1.0.0',
            author: 'Custom Trader',
            category: 'TECHNICAL_ANALYSIS',
            riskLevel: 'HIGH',
            timeframes: ['15min', '1hour'],
            entryRules: [
                {
                    id: 'bb_oversold_entry',
                    name: 'Bollinger Bands Oversold Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        period: 20,
                        stdDev: 2,
                        volumeThreshold: 1000
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter when price touches lower Bollinger Band'
                }
            ],
            exitRules: [
                {
                    id: 'bb_overbought_exit',
                    name: 'Bollinger Bands Overbought Exit',
                    type: 'EXIT',
                    condition: 'AND',
                    parameters: {
                        period: 20,
                        stdDev: 2
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit when price touches upper Bollinger Band'
                }
            ],
            positionSizing: {
                method: 'PERCENTAGE_OF_CAPITAL',
                percentageOfCapital: 5, // 5% of capital per trade
                maxPositionSize: 30000,
                minPositionSize: 1000
            },
            riskManagement: {
                stopLoss: {
                    type: 'PERCENTAGE',
                    value: 2, // 2% stop loss
                    percentage: 2
                },
                takeProfit: {
                    type: 'PERCENTAGE',
                    value: 4, // 4% take profit
                    percentage: 4
                },
                maxDrawdown: 12,
                maxDailyLoss: 4,
                maxOpenPositions: 2
            },
            filters: [],
            notifications: [],
            parameters: {
                period: 20,
                stdDev: 2,
                volumeThreshold: 1000
            },
            capitalAllocation: 80000,
            instruments: ['NIFTY']
        };

        return await enhancedStrategyService.createStrategy(bbConfig);
    }

    private async createCustomMultiIndicatorStrategy(): Promise<any> {
        const multiConfig: StrategyConfig = {
            name: 'Custom Multi-Indicator Strategy',
            enabled: true,
            description: 'Advanced strategy combining multiple indicators',
            type: 'CUSTOM',
            version: '1.0.0',
            author: 'Custom Trader',
            category: 'TECHNICAL_ANALYSIS',
            riskLevel: 'MEDIUM',
            timeframes: ['5min', '15min', '1hour'],
            entryRules: [
                {
                    id: 'multi_indicator_entry',
                    name: 'Multi-Indicator Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        rsiPeriod: 14,
                        rsiOversold: 30,
                        maShortPeriod: 10,
                        maLongPeriod: 20,
                        volumeThreshold: 1500
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter when RSI is oversold and MA shows uptrend'
                }
            ],
            exitRules: [
                {
                    id: 'multi_indicator_exit',
                    name: 'Multi-Indicator Exit',
                    type: 'EXIT',
                    condition: 'OR',
                    parameters: {
                        rsiPeriod: 14,
                        rsiOverbought: 70,
                        maShortPeriod: 10,
                        maLongPeriod: 20
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit when RSI is overbought or MA shows downtrend'
                }
            ],
            positionSizing: {
                method: 'KELLY_CRITERION',
                kellyCriterion: true,
                maxPositionSize: 40000,
                minPositionSize: 1000
            },
            riskManagement: {
                stopLoss: {
                    type: 'FIXED_POINTS',
                    value: 50, // 50 points stop loss
                    fixedAmount: 50
                },
                takeProfit: {
                    type: 'FIXED_POINTS',
                    value: 100, // 100 points take profit
                    fixedAmount: 100
                },
                trailingStop: {
                    enabled: true,
                    type: 'PERCENTAGE',
                    value: 1, // 1% trailing stop
                    activationLevel: 50, // Activate after 50 points profit
                    lockInProfit: true
                },
                maxDrawdown: 10,
                maxDailyLoss: 3,
                maxOpenPositions: 4
            },
            filters: [
                {
                    id: 'time_filter',
                    name: 'Trading Hours Filter',
                    type: 'TIME_FILTER',
                    parameters: {
                        startTime: '09:15',
                        endTime: '15:30',
                        timezone: 'Asia/Kolkata'
                    },
                    isActive: true,
                    description: 'Only trade during market hours'
                }
            ],
            notifications: [
                {
                    id: 'performance_notification',
                    type: 'PERFORMANCE_UPDATE',
                    conditions: [
                        {
                            metric: 'dailyPnL',
                            operator: 'LT',
                            value: -5
                        }
                    ],
                    channels: [
                        {
                            type: 'SMS',
                            config: { phone: '+1234567890' }
                        }
                    ],
                    isActive: true
                }
            ],
            parameters: {
                rsiPeriod: 14,
                rsiOversold: 30,
                rsiOverbought: 70,
                maShortPeriod: 10,
                maLongPeriod: 20,
                volumeThreshold: 1500
            },
            capitalAllocation: 120000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };

        return await enhancedStrategyService.createStrategy(multiConfig);
    }

    private async executeStrategiesWithLiveData(): Promise<void> {
        logger.info('\n=== Executing Strategies with Live Data ===');

        const strategies = await enhancedStrategyService.getActiveStrategies();

        for (const strategy of strategies) {
            logger.info(`\nExecuting strategy: ${strategy.name}`);

            try {
                // Execute with live data for different symbols and timeframes
                const symbols = strategy.config.instruments || ['NIFTY'];
                const timeframes = strategy.config.timeframes || ['15min'];

                for (const symbol of symbols) {
                    for (const timeframe of timeframes) {
                        const result = await enhancedStrategyService.executeStrategyWithLiveData(
                            strategy.name,
                            symbol,
                            timeframe
                        );

                        if (result.success) {
                            logger.info(`  ${symbol} (${timeframe}): ${result.signals.length} signals generated`);

                            for (const signal of result.signals) {
                                logger.info(`    Signal: ${signal.action} ${signal.symbol} @ ${signal.price}`);
                                logger.info(`    Quantity: ${signal.quantity}, Stop Loss: ${signal.stopLoss}, Target: ${signal.target}`);
                            }
                        } else {
                            logger.warn(`  ${symbol} (${timeframe}): ${result.error}`);
                        }
                    }
                }
            } catch (error) {
                logger.error(`  Error executing ${strategy.name}:`, error);
            }
        }
    }

    private async analyzeStrategyPerformance(): Promise<void> {
        logger.info('\n=== Analyzing Strategy Performance ===');

        const strategies = await enhancedStrategyService.getAllStrategies();

        for (const strategy of strategies) {
            logger.info(`\nAnalyzing performance for: ${strategy.name}`);

            try {
                const performance = await enhancedStrategyService.getStrategyPerformance(strategy.id);

                if (performance) {
                    logger.info(`  Total Return: ${performance.totalReturn.toFixed(2)}%`);
                    logger.info(`  Annualized Return: ${performance.annualizedReturn.toFixed(2)}%`);
                    logger.info(`  Sharpe Ratio: ${performance.sharpeRatio.toFixed(2)}`);
                    logger.info(`  Max Drawdown: ${performance.maxDrawdown.toFixed(2)}%`);
                    logger.info(`  Win Rate: ${performance.winRate.toFixed(2)}%`);
                    logger.info(`  Profit Factor: ${performance.profitFactor.toFixed(2)}`);
                    logger.info(`  Total Trades: ${performance.totalTrades}`);
                    logger.info(`  Average Win: ${performance.averageWin.toFixed(2)}`);
                    logger.info(`  Average Loss: ${performance.averageLoss.toFixed(2)}`);
                } else {
                    logger.info(`  No performance data available`);
                }
            } catch (error) {
                logger.error(`  Error analyzing ${strategy.name}:`, error);
            }
        }
    }

    private async advancedStrategyConfigurations(): Promise<void> {
        logger.info('\n=== Advanced Strategy Configurations ===');

        // 1. Strategy with custom position sizing formula
        const customFormulaStrategy = await this.createCustomFormulaStrategy();
        logger.info(`Created Custom Formula Strategy: ${customFormulaStrategy.name}`);

        // 2. Strategy with complex risk management
        const complexRiskStrategy = await this.createComplexRiskStrategy();
        logger.info(`Created Complex Risk Strategy: ${complexRiskStrategy.name}`);

        // 3. Strategy with multiple timeframes
        const multiTimeframeStrategy = await this.createMultiTimeframeStrategy();
        logger.info(`Created Multi-Timeframe Strategy: ${multiTimeframeStrategy.name}`);
    }

    private async createCustomFormulaStrategy(): Promise<any> {
        const config: StrategyConfig = {
            name: 'Custom Formula Strategy',
            enabled: true,
            description: 'Strategy with custom position sizing formula',
            type: 'CUSTOM',
            version: '1.0.0',
            author: 'Custom Trader',
            category: 'CUSTOM',
            riskLevel: 'MEDIUM',
            timeframes: ['15min', '1hour'],
            entryRules: [
                {
                    id: 'simple_entry',
                    name: 'Simple Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: { period: 20 },
                    priority: 1,
                    isActive: true,
                    description: 'Simple entry rule'
                }
            ],
            exitRules: [
                {
                    id: 'simple_exit',
                    name: 'Simple Exit',
                    type: 'EXIT',
                    condition: 'AND',
                    parameters: { period: 20 },
                    priority: 1,
                    isActive: true,
                    description: 'Simple exit rule'
                }
            ],
            positionSizing: {
                method: 'CUSTOM_FORMULA',
                customFormula: '${capital} * 0.02 * (1 + ${volatility} * 10)',
                maxPositionSize: 50000,
                minPositionSize: 1000
            },
            riskManagement: {
                stopLoss: {
                    type: 'ATR_BASED',
                    value: 2,
                    atrMultiplier: 2
                },
                takeProfit: {
                    type: 'RISK_REWARD_RATIO',
                    value: 2
                },
                maxDrawdown: 10,
                maxDailyLoss: 5,
                maxOpenPositions: 3
            },
            filters: [],
            notifications: [],
            parameters: { period: 20 },
            capitalAllocation: 100000,
            instruments: ['NIFTY']
        };

        return await enhancedStrategyService.createStrategy(config);
    }

    private async createComplexRiskStrategy(): Promise<any> {
        const config: StrategyConfig = {
            name: 'Complex Risk Strategy',
            enabled: true,
            description: 'Strategy with complex risk management rules',
            type: 'CUSTOM',
            version: '1.0.0',
            author: 'Custom Trader',
            category: 'CUSTOM',
            riskLevel: 'HIGH',
            timeframes: ['5min', '15min'],
            entryRules: [
                {
                    id: 'complex_entry',
                    name: 'Complex Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: { period: 10 },
                    priority: 1,
                    isActive: true,
                    description: 'Complex entry rule'
                }
            ],
            exitRules: [
                {
                    id: 'complex_exit',
                    name: 'Complex Exit',
                    type: 'EXIT',
                    condition: 'OR',
                    parameters: { period: 10 },
                    priority: 1,
                    isActive: true,
                    description: 'Complex exit rule'
                }
            ],
            positionSizing: {
                method: 'RISK_PER_TRADE',
                riskPerTrade: 1,
                maxPositionSize: 20000,
                minPositionSize: 1000
            },
            riskManagement: {
                stopLoss: {
                    type: 'TIME_BASED',
                    value: 30, // 30 minutes
                    timeBased: true,
                    timeLimit: 30
                },
                takeProfit: {
                    type: 'PERCENTAGE',
                    value: 3,
                    percentage: 3,
                    partialExit: [
                        {
                            percentage: 50,
                            target: 2,
                            stopLoss: 1
                        },
                        {
                            percentage: 50,
                            target: 4,
                            stopLoss: 2
                        }
                    ]
                },
                trailingStop: {
                    enabled: true,
                    type: 'ATR_BASED',
                    value: 1.5,
                    activationLevel: 1,
                    lockInProfit: true
                },
                maxDrawdown: 8,
                maxDailyLoss: 2,
                maxOpenPositions: 2,
                correlationLimit: 0.7,
                sectorExposure: 20
            },
            filters: [
                {
                    id: 'volatility_filter',
                    name: 'Volatility Filter',
                    type: 'VOLATILITY_FILTER',
                    parameters: {
                        minVolatility: 0.01,
                        maxVolatility: 0.05
                    },
                    isActive: true,
                    description: 'Only trade in moderate volatility'
                }
            ],
            notifications: [
                {
                    id: 'risk_alert',
                    type: 'RISK_ALERT',
                    conditions: [
                        {
                            metric: 'drawdown',
                            operator: 'GT',
                            value: 5
                        }
                    ],
                    channels: [
                        {
                            type: 'WEBHOOK',
                            config: { url: 'https://api.example.com/risk-alert' }
                        }
                    ],
                    isActive: true
                }
            ],
            parameters: { period: 10 },
            capitalAllocation: 80000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };

        return await enhancedStrategyService.createStrategy(config);
    }

    private async createMultiTimeframeStrategy(): Promise<any> {
        const config: StrategyConfig = {
            name: 'Multi-Timeframe Strategy',
            enabled: true,
            description: 'Strategy that analyzes multiple timeframes',
            type: 'CUSTOM',
            version: '1.0.0',
            author: 'Custom Trader',
            category: 'CUSTOM',
            riskLevel: 'MEDIUM',
            timeframes: ['5min', '15min', '1hour', '1day'],
            entryRules: [
                {
                    id: 'multi_tf_entry',
                    name: 'Multi-Timeframe Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        shortTf: '5min',
                        mediumTf: '15min',
                        longTf: '1hour',
                        trendConfirmation: true
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter when all timeframes align'
                }
            ],
            exitRules: [
                {
                    id: 'multi_tf_exit',
                    name: 'Multi-Timeframe Exit',
                    type: 'EXIT',
                    condition: 'OR',
                    parameters: {
                        shortTf: '5min',
                        mediumTf: '15min',
                        longTf: '1hour'
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit when any timeframe shows reversal'
                }
            ],
            positionSizing: {
                method: 'VOLATILITY_BASED',
                volatilityBased: true,
                maxPositionSize: 60000,
                minPositionSize: 1000
            },
            riskManagement: {
                stopLoss: {
                    type: 'ATR_BASED',
                    value: 2,
                    atrMultiplier: 2
                },
                takeProfit: {
                    type: 'RISK_REWARD_RATIO',
                    value: 2
                },
                maxDrawdown: 10,
                maxDailyLoss: 4,
                maxOpenPositions: 3
            },
            filters: [],
            notifications: [],
            parameters: {
                shortTf: '5min',
                mediumTf: '15min',
                longTf: '1hour',
                trendConfirmation: true
            },
            capitalAllocation: 150000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };

        return await enhancedStrategyService.createStrategy(config);
    }
}

// Example usage
async function main() {
    const example = new RobustStrategyExample();
    await example.runCompleteExample();
}

// Run the example if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

export default RobustStrategyExample; 