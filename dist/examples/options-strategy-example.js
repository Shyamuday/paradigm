"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionsStrategyExample = void 0;
const enhanced_strategy_service_1 = require("../services/enhanced-strategy.service");
const logger_1 = require("../logger/logger");
class OptionsStrategyExample {
    async runOptionsStrategyExample() {
        try {
            logger_1.logger.info('Starting Options Strategy Example');
            await this.createOptionsStrategiesFromTemplates();
            await this.createCustomOptionsStrategies();
            await this.demonstrateOptionsStrategies();
            await this.optionsRiskManagement();
            logger_1.logger.info('Options Strategy Example completed successfully');
        }
        catch (error) {
            logger_1.logger.error('Options Strategy Example failed:', error);
        }
    }
    async createOptionsStrategiesFromTemplates() {
        logger_1.logger.info('\n=== Creating Options Strategies from Templates ===');
        const coveredCallStrategy = await enhanced_strategy_service_1.enhancedStrategyService.createStrategyFromTemplate('covered_call_strategy', {
            name: 'My Covered Call Strategy',
            enabled: true,
            parameters: {
                strategyType: 'COVERED_CALL',
                daysToExpiry: 30,
                deltaTarget: 0.35,
                maxDelta: 0.5
            },
            capitalAllocation: 100000,
            instruments: ['NIFTY']
        });
        logger_1.logger.info(`Created Covered Call Strategy: ${coveredCallStrategy.name}`);
        const ironCondorStrategy = await enhanced_strategy_service_1.enhancedStrategyService.createStrategyFromTemplate('iron_condor_strategy', {
            name: 'My Iron Condor Strategy',
            enabled: true,
            parameters: {
                strategyType: 'IRON_CONDOR',
                daysToExpiry: 45,
                width: 100,
                maxDelta: 0.3
            },
            capitalAllocation: 50000,
            instruments: ['BANKNIFTY']
        });
        logger_1.logger.info(`Created Iron Condor Strategy: ${ironCondorStrategy.name}`);
        const straddleStrategy = await enhanced_strategy_service_1.enhancedStrategyService.createStrategyFromTemplate('straddle_strategy', {
            name: 'My Straddle Strategy',
            enabled: true,
            parameters: {
                strategyType: 'STRADDLE',
                daysToExpiry: 30,
                volatilityThreshold: 0.2,
                maxDelta: 0.1
            },
            capitalAllocation: 30000,
            instruments: ['NIFTY']
        });
        logger_1.logger.info(`Created Straddle Strategy: ${straddleStrategy.name}`);
    }
    async createCustomOptionsStrategies() {
        logger_1.logger.info('\n=== Creating Custom Options Strategies ===');
        const butterflyStrategy = await this.createCustomButterflyStrategy();
        logger_1.logger.info(`Created Custom Butterfly Strategy: ${butterflyStrategy.name}`);
        const calendarStrategy = await this.createCustomCalendarStrategy();
        logger_1.logger.info(`Created Custom Calendar Strategy: ${calendarStrategy.name}`);
        const protectivePutStrategy = await this.createCustomProtectivePutStrategy();
        logger_1.logger.info(`Created Custom Protective Put Strategy: ${protectivePutStrategy.name}`);
    }
    async createCustomButterflyStrategy() {
        const butterflyConfig = {
            name: 'Custom Butterfly Spread Strategy',
            enabled: true,
            description: 'Custom butterfly spread for neutral market outlook',
            type: 'OPTIONS_STRATEGY',
            version: '1.0.0',
            author: 'Custom Trader',
            category: 'OPTIONS',
            riskLevel: 'MEDIUM',
            timeframes: ['1day'],
            entryRules: [
                {
                    id: 'butterfly_entry',
                    name: 'Butterfly Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        strategyType: 'BUTTERFLY_SPREAD',
                        daysToExpiry: 30,
                        width: 100
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter butterfly spread position'
                }
            ],
            exitRules: [
                {
                    id: 'butterfly_exit',
                    name: 'Butterfly Exit',
                    type: 'EXIT',
                    condition: 'OR',
                    parameters: {
                        daysToExpiry: 5,
                        profitTarget: 0.8
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit butterfly spread position'
                }
            ],
            positionSizing: {
                method: 'FIXED_AMOUNT',
                fixedAmount: 2000,
                maxPositionSize: 10000,
                minPositionSize: 500
            },
            riskManagement: {
                stopLoss: {
                    type: 'PERCENTAGE',
                    value: 25,
                    percentage: 25
                },
                takeProfit: {
                    type: 'PERCENTAGE',
                    value: 40,
                    percentage: 40
                },
                maxDrawdown: 15,
                maxDailyLoss: 2,
                maxOpenPositions: 2
            },
            filters: [],
            notifications: [],
            parameters: {
                strategyType: 'BUTTERFLY_SPREAD',
                daysToExpiry: 30,
                width: 100
            },
            capitalAllocation: 20000,
            instruments: ['NIFTY']
        };
        return await enhanced_strategy_service_1.enhancedStrategyService.createStrategy(butterflyConfig);
    }
    async createCustomCalendarStrategy() {
        const calendarConfig = {
            name: 'Custom Calendar Spread Strategy',
            enabled: true,
            description: 'Custom calendar spread for time decay advantage',
            type: 'OPTIONS_STRATEGY',
            version: '1.0.0',
            author: 'Custom Trader',
            category: 'OPTIONS',
            riskLevel: 'LOW',
            timeframes: ['1day'],
            entryRules: [
                {
                    id: 'calendar_entry',
                    name: 'Calendar Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        strategyType: 'CALENDAR_SPREAD',
                        shortExpiry: 30,
                        longExpiry: 60,
                        volatilityThreshold: 0.15
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter calendar spread position'
                }
            ],
            exitRules: [
                {
                    id: 'calendar_exit',
                    name: 'Calendar Exit',
                    type: 'EXIT',
                    condition: 'OR',
                    parameters: {
                        shortExpiry: 5,
                        profitTarget: 0.7
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit calendar spread position'
                }
            ],
            positionSizing: {
                method: 'FIXED_AMOUNT',
                fixedAmount: 1500,
                maxPositionSize: 7500,
                minPositionSize: 500
            },
            riskManagement: {
                stopLoss: {
                    type: 'PERCENTAGE',
                    value: 20,
                    percentage: 20
                },
                takeProfit: {
                    type: 'PERCENTAGE',
                    value: 35,
                    percentage: 35
                },
                maxDrawdown: 10,
                maxDailyLoss: 1,
                maxOpenPositions: 3
            },
            filters: [],
            notifications: [],
            parameters: {
                strategyType: 'CALENDAR_SPREAD',
                shortExpiry: 30,
                longExpiry: 60,
                volatilityThreshold: 0.15
            },
            capitalAllocation: 15000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };
        return await enhanced_strategy_service_1.enhancedStrategyService.createStrategy(calendarConfig);
    }
    async createCustomProtectivePutStrategy() {
        const protectivePutConfig = {
            name: 'Custom Protective Put Strategy',
            enabled: true,
            description: 'Custom protective put for downside protection',
            type: 'OPTIONS_STRATEGY',
            version: '1.0.0',
            author: 'Custom Trader',
            category: 'OPTIONS',
            riskLevel: 'LOW',
            timeframes: ['1day'],
            entryRules: [
                {
                    id: 'protective_put_entry',
                    name: 'Protective Put Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        strategyType: 'PROTECTIVE_PUT',
                        daysToExpiry: 30,
                        deltaTarget: -0.25
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter protective put position'
                }
            ],
            exitRules: [
                {
                    id: 'protective_put_exit',
                    name: 'Protective Put Exit',
                    type: 'EXIT',
                    condition: 'OR',
                    parameters: {
                        daysToExpiry: 5,
                        profitTarget: 0.5
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit protective put position'
                }
            ],
            positionSizing: {
                method: 'PERCENTAGE_OF_CAPITAL',
                percentageOfCapital: 3,
                maxPositionSize: 20000,
                minPositionSize: 1000
            },
            riskManagement: {
                stopLoss: {
                    type: 'PERCENTAGE',
                    value: 15,
                    percentage: 15
                },
                takeProfit: {
                    type: 'PERCENTAGE',
                    value: 25,
                    percentage: 25
                },
                maxDrawdown: 8,
                maxDailyLoss: 1,
                maxOpenPositions: 2
            },
            filters: [],
            notifications: [],
            parameters: {
                strategyType: 'PROTECTIVE_PUT',
                daysToExpiry: 30,
                deltaTarget: -0.25
            },
            capitalAllocation: 80000,
            instruments: ['NIFTY']
        };
        return await enhanced_strategy_service_1.enhancedStrategyService.createStrategy(protectivePutConfig);
    }
    async demonstrateOptionsStrategies() {
        logger_1.logger.info('\n=== Demonstrating Options Strategies ===');
        const strategies = [
            {
                name: 'Covered Call Strategy',
                description: 'Income generation with limited upside',
                riskProfile: 'Limited profit, unlimited loss',
                bestFor: 'Neutral to slightly bullish markets'
            },
            {
                name: 'Iron Condor Strategy',
                description: 'Range-bound market profits',
                riskProfile: 'Limited profit, limited loss',
                bestFor: 'Low volatility, sideways markets'
            },
            {
                name: 'Straddle Strategy',
                description: 'Volatility expansion profits',
                riskProfile: 'Unlimited profit, limited loss',
                bestFor: 'High volatility, large moves expected'
            },
            {
                name: 'Butterfly Spread Strategy',
                description: 'Neutral market with defined risk',
                riskProfile: 'Limited profit, limited loss',
                bestFor: 'Neutral markets with low volatility'
            },
            {
                name: 'Calendar Spread Strategy',
                description: 'Time decay advantage',
                riskProfile: 'Limited profit, limited loss',
                bestFor: 'Low volatility, time decay scenarios'
            },
            {
                name: 'Protective Put Strategy',
                description: 'Downside protection',
                riskProfile: 'Unlimited profit, limited loss',
                bestFor: 'Bullish markets with protection needs'
            }
        ];
        for (const strategy of strategies) {
            logger_1.logger.info(`\nStrategy: ${strategy.name}`);
            logger_1.logger.info(`Description: ${strategy.description}`);
            logger_1.logger.info(`Risk Profile: ${strategy.riskProfile}`);
            logger_1.logger.info(`Best For: ${strategy.bestFor}`);
        }
    }
    async optionsRiskManagement() {
        logger_1.logger.info('\n=== Options Risk Management ===');
        const riskManagementRules = [
            {
                rule: 'Position Sizing',
                description: 'Never risk more than 2-5% of capital on any single options position',
                implementation: 'Use fixed amount or percentage-based position sizing'
            },
            {
                rule: 'Delta Management',
                description: 'Monitor and limit total delta exposure across all positions',
                implementation: 'Set maxDelta parameter in strategy configuration'
            },
            {
                rule: 'Time Decay',
                description: 'Exit positions before high theta decay periods',
                implementation: 'Exit 5-10 days before expiry for most strategies'
            },
            {
                rule: 'Volatility Management',
                description: 'Adjust position sizes based on implied volatility',
                implementation: 'Reduce size in high volatility, increase in low volatility'
            },
            {
                rule: 'Correlation Limits',
                description: 'Avoid over-concentration in correlated positions',
                implementation: 'Limit exposure to same underlying or sector'
            },
            {
                rule: 'Profit Taking',
                description: 'Take profits at 50-80% of maximum profit potential',
                implementation: 'Set profitTarget parameter in exit rules'
            },
            {
                rule: 'Stop Losses',
                description: 'Use percentage-based or delta-based stop losses',
                implementation: 'Exit at 15-25% loss for most strategies'
            },
            {
                rule: 'Expiry Management',
                description: 'Roll positions before expiry to maintain exposure',
                implementation: 'Monitor daysToExpiry and roll when needed'
            }
        ];
        for (const rule of riskManagementRules) {
            logger_1.logger.info(`\nRule: ${rule.rule}`);
            logger_1.logger.info(`Description: ${rule.description}`);
            logger_1.logger.info(`Implementation: ${rule.implementation}`);
        }
        logger_1.logger.info('\n=== Options Risk Calculations ===');
        const riskCalculations = [
            {
                metric: 'Delta',
                description: 'Rate of change of option price with respect to underlying',
                calculation: 'Sum of all option deltas in portfolio',
                limit: '±0.5 for most strategies'
            },
            {
                metric: 'Gamma',
                description: 'Rate of change of delta with respect to underlying',
                calculation: 'Sum of all option gammas in portfolio',
                limit: 'Monitor for large moves'
            },
            {
                metric: 'Theta',
                description: 'Rate of change of option price with respect to time',
                calculation: 'Sum of all option thetas in portfolio',
                limit: 'Exit high negative theta positions'
            },
            {
                metric: 'Vega',
                description: 'Rate of change of option price with respect to volatility',
                calculation: 'Sum of all option vegas in portfolio',
                limit: 'Monitor volatility exposure'
            }
        ];
        for (const calc of riskCalculations) {
            logger_1.logger.info(`\nMetric: ${calc.metric}`);
            logger_1.logger.info(`Description: ${calc.description}`);
            logger_1.logger.info(`Calculation: ${calc.calculation}`);
            logger_1.logger.info(`Limit: ${calc.limit}`);
        }
    }
}
exports.OptionsStrategyExample = OptionsStrategyExample;
async function main() {
    const example = new OptionsStrategyExample();
    await example.runOptionsStrategyExample();
}
if (require.main === module) {
    main().catch(console.error);
}
exports.default = OptionsStrategyExample;
//# sourceMappingURL=options-strategy-example.js.map