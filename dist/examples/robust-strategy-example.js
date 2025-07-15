"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RobustStrategyExample = void 0;
const enhanced_strategy_service_1 = require("../services/enhanced-strategy.service");
const enhanced_market_data_service_1 = require("../services/enhanced-market-data.service");
const logger_1 = require("../logger/logger");
class RobustStrategyExample {
    constructor() {
        this.marketDataService = new enhanced_market_data_service_1.EnhancedMarketDataService();
    }
    async runCompleteExample() {
        try {
            logger_1.logger.info('Starting Robust Strategy Module Example');
            await this.exploreTemplates();
            await this.createStrategiesFromTemplates();
            await this.createCustomStrategies();
            await this.executeStrategiesWithLiveData();
            await this.analyzeStrategyPerformance();
            await this.advancedStrategyConfigurations();
            logger_1.logger.info('Robust Strategy Module Example completed successfully');
        }
        catch (error) {
            logger_1.logger.error('Example failed:', error);
        }
    }
    async exploreTemplates() {
        logger_1.logger.info('\n=== Exploring Strategy Templates ===');
        const templates = await enhanced_strategy_service_1.enhancedStrategyService.getAvailableTemplates();
        for (const template of templates) {
            logger_1.logger.info(`\nTemplate: ${template.name}`);
            logger_1.logger.info(`Type: ${template.type}`);
            logger_1.logger.info(`Category: ${template.category}`);
            logger_1.logger.info(`Risk Level: ${template.riskLevel}`);
            logger_1.logger.info(`Description: ${template.description}`);
            logger_1.logger.info(`Required Parameters: ${template.requiredParameters.join(', ')}`);
            logger_1.logger.info(`Default Timeframes: ${template.defaultTimeframes.join(', ')}`);
            logger_1.logger.info(`Tags: ${template.tags.join(', ')}`);
        }
        logger_1.logger.info(`\nTotal templates available: ${templates.length}`);
    }
    async createStrategiesFromTemplates() {
        logger_1.logger.info('\n=== Creating Strategies from Templates ===');
        const maStrategy = await enhanced_strategy_service_1.enhancedStrategyService.createStrategyFromTemplate('moving_average_crossover', {
            name: 'My MA Crossover',
            enabled: true,
            parameters: {
                shortPeriod: 5,
                longPeriod: 15,
                volumeThreshold: 2000
            },
            capitalAllocation: 50000,
            instruments: ['NIFTY', 'BANKNIFTY']
        });
        logger_1.logger.info(`Created MA Strategy: ${maStrategy.name}`);
        const rsiStrategy = await enhanced_strategy_service_1.enhancedStrategyService.createStrategyFromTemplate('rsi_mean_reversion', {
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
        });
        logger_1.logger.info(`Created RSI Strategy: ${rsiStrategy.name}`);
        const breakoutStrategy = await enhanced_strategy_service_1.enhancedStrategyService.createStrategyFromTemplate('breakout_strategy', {
            name: 'My Breakout Strategy',
            enabled: true,
            parameters: {
                lookbackPeriod: 15,
                breakoutThreshold: 0.015,
                volumeMultiplier: 2.0,
                confirmationPeriod: 3
            },
            capitalAllocation: 40000,
            instruments: ['BANKNIFTY']
        });
        logger_1.logger.info(`Created Breakout Strategy: ${breakoutStrategy.name}`);
    }
    async createCustomStrategies() {
        logger_1.logger.info('\n=== Creating Custom Strategies ===');
        const macdStrategy = await this.createCustomMACDStrategy();
        logger_1.logger.info(`Created Custom MACD Strategy: ${macdStrategy.name}`);
        const bbStrategy = await this.createCustomBollingerBandsStrategy();
        logger_1.logger.info(`Created Custom Bollinger Bands Strategy: ${bbStrategy.name}`);
        const multiStrategy = await this.createCustomMultiIndicatorStrategy();
        logger_1.logger.info(`Created Custom Multi-Indicator Strategy: ${multiStrategy.name}`);
    }
    async createCustomMACDStrategy() {
        const macdConfig = {
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
                riskPerTrade: 1.5,
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
        return await enhanced_strategy_service_1.enhancedStrategyService.createStrategy(macdConfig);
    }
    async createCustomBollingerBandsStrategy() {
        const bbConfig = {
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
                percentageOfCapital: 5,
                maxPositionSize: 30000,
                minPositionSize: 1000
            },
            riskManagement: {
                stopLoss: {
                    type: 'PERCENTAGE',
                    value: 2,
                    percentage: 2
                },
                takeProfit: {
                    type: 'PERCENTAGE',
                    value: 4,
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
        return await enhanced_strategy_service_1.enhancedStrategyService.createStrategy(bbConfig);
    }
    async createCustomMultiIndicatorStrategy() {
        const multiConfig = {
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
                    value: 50,
                    fixedAmount: 50
                },
                takeProfit: {
                    type: 'FIXED_POINTS',
                    value: 100,
                    fixedAmount: 100
                },
                trailingStop: {
                    enabled: true,
                    type: 'PERCENTAGE',
                    value: 1,
                    activationLevel: 50,
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
        return await enhanced_strategy_service_1.enhancedStrategyService.createStrategy(multiConfig);
    }
    async executeStrategiesWithLiveData() {
        logger_1.logger.info('\n=== Executing Strategies with Live Data ===');
        const strategies = await enhanced_strategy_service_1.enhancedStrategyService.getActiveStrategies();
        for (const strategy of strategies) {
            logger_1.logger.info(`\nExecuting strategy: ${strategy.name}`);
            try {
                const symbols = strategy.config.instruments || ['NIFTY'];
                const timeframes = strategy.config.timeframes || ['15min'];
                for (const symbol of symbols) {
                    for (const timeframe of timeframes) {
                        const result = await enhanced_strategy_service_1.enhancedStrategyService.executeStrategyWithLiveData(strategy.name, symbol, timeframe);
                        if (result.success) {
                            logger_1.logger.info(`  ${symbol} (${timeframe}): ${result.signals.length} signals generated`);
                            for (const signal of result.signals) {
                                logger_1.logger.info(`    Signal: ${signal.action} ${signal.symbol} @ ${signal.price}`);
                                logger_1.logger.info(`    Quantity: ${signal.quantity}, Stop Loss: ${signal.stopLoss}, Target: ${signal.target}`);
                            }
                        }
                        else {
                            logger_1.logger.warn(`  ${symbol} (${timeframe}): ${result.error}`);
                        }
                    }
                }
            }
            catch (error) {
                logger_1.logger.error(`  Error executing ${strategy.name}:`, error);
            }
        }
    }
    async analyzeStrategyPerformance() {
        logger_1.logger.info('\n=== Analyzing Strategy Performance ===');
        const strategies = await enhanced_strategy_service_1.enhancedStrategyService.getAllStrategies();
        for (const strategy of strategies) {
            logger_1.logger.info(`\nAnalyzing performance for: ${strategy.name}`);
            try {
                const performance = await enhanced_strategy_service_1.enhancedStrategyService.getStrategyPerformance(strategy.id);
                if (performance) {
                    logger_1.logger.info(`  Total Return: ${performance.totalReturn.toFixed(2)}%`);
                    logger_1.logger.info(`  Annualized Return: ${performance.annualizedReturn.toFixed(2)}%`);
                    logger_1.logger.info(`  Sharpe Ratio: ${performance.sharpeRatio.toFixed(2)}`);
                    logger_1.logger.info(`  Max Drawdown: ${performance.maxDrawdown.toFixed(2)}%`);
                    logger_1.logger.info(`  Win Rate: ${performance.winRate.toFixed(2)}%`);
                    logger_1.logger.info(`  Profit Factor: ${performance.profitFactor.toFixed(2)}`);
                    logger_1.logger.info(`  Total Trades: ${performance.totalTrades}`);
                    logger_1.logger.info(`  Average Win: ${performance.averageWin.toFixed(2)}`);
                    logger_1.logger.info(`  Average Loss: ${performance.averageLoss.toFixed(2)}`);
                }
                else {
                    logger_1.logger.info(`  No performance data available`);
                }
            }
            catch (error) {
                logger_1.logger.error(`  Error analyzing ${strategy.name}:`, error);
            }
        }
    }
    async advancedStrategyConfigurations() {
        logger_1.logger.info('\n=== Advanced Strategy Configurations ===');
        const customFormulaStrategy = await this.createCustomFormulaStrategy();
        logger_1.logger.info(`Created Custom Formula Strategy: ${customFormulaStrategy.name}`);
        const complexRiskStrategy = await this.createComplexRiskStrategy();
        logger_1.logger.info(`Created Complex Risk Strategy: ${complexRiskStrategy.name}`);
        const multiTimeframeStrategy = await this.createMultiTimeframeStrategy();
        logger_1.logger.info(`Created Multi-Timeframe Strategy: ${multiTimeframeStrategy.name}`);
    }
    async createCustomFormulaStrategy() {
        const config = {
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
        return await enhanced_strategy_service_1.enhancedStrategyService.createStrategy(config);
    }
    async createComplexRiskStrategy() {
        const config = {
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
                    value: 30,
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
        return await enhanced_strategy_service_1.enhancedStrategyService.createStrategy(config);
    }
    async createMultiTimeframeStrategy() {
        const config = {
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
        return await enhanced_strategy_service_1.enhancedStrategyService.createStrategy(config);
    }
}
exports.RobustStrategyExample = RobustStrategyExample;
async function main() {
    const example = new RobustStrategyExample();
    await example.runCompleteExample();
}
if (require.main === module) {
    main().catch(console.error);
}
exports.default = RobustStrategyExample;
//# sourceMappingURL=robust-strategy-example.js.map