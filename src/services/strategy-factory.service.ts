import { logger } from '../logger/logger';
import {
    StrategyConfig,
    StrategyTemplate,
    StrategyType,
    StrategyCategory,
    RiskLevel,
    PositionSizingConfig,
    RiskManagementConfig,
    StopLossConfig,
    TakeProfitConfig
} from '../types';
import { IStrategy, strategyEngine } from './strategy-engine.service';
import { MovingAverageStrategy } from './strategies/moving-average-strategy';
import { RSIStrategy } from './strategies/rsi-strategy';
import { BreakoutStrategy } from './strategies/breakout-strategy';
import { OptionsStrategy } from './strategies/options-strategy';

export class StrategyFactoryService {
    private strategyClasses: Map<StrategyType, new () => IStrategy> = new Map();
    private templates: Map<string, StrategyTemplate> = new Map();

    constructor() {
        this.registerStrategyClasses();
        this.registerDefaultTemplates();
    }

    private registerStrategyClasses(): void {
        this.strategyClasses.set('TREND_FOLLOWING', MovingAverageStrategy);
        this.strategyClasses.set('MEAN_REVERSION', RSIStrategy);
        this.strategyClasses.set('BREAKOUT', BreakoutStrategy);
        this.strategyClasses.set('OPTIONS_STRATEGY', OptionsStrategy);
    }

    private registerDefaultTemplates(): void {
        // Moving Average Template
        const maTemplate: StrategyTemplate = {
            id: 'moving_average_crossover',
            name: 'Moving Average Crossover',
            description: 'Simple moving average crossover strategy for trend following',
            type: 'TREND_FOLLOWING',
            category: 'TECHNICAL_ANALYSIS',
            riskLevel: 'MEDIUM',
            defaultParameters: {
                shortPeriod: 10,
                longPeriod: 20,
                volumeThreshold: 1000
            },
            requiredParameters: ['shortPeriod', 'longPeriod'],
            optionalParameters: ['volumeThreshold'],
            defaultTimeframes: ['5min', '15min', '1hour'],
            defaultInstruments: ['NIFTY', 'BANKNIFTY'],
            exampleConfig: this.createDefaultMAConfig(),
            documentation: `
# Moving Average Crossover Strategy

This strategy generates buy/sell signals based on moving average crossovers.

## Parameters:
- shortPeriod: Short-term moving average period (default: 10)
- longPeriod: Long-term moving average period (default: 20)
- volumeThreshold: Minimum volume required for signal (optional)

## Signals:
- BUY: When short MA crosses above long MA (Golden Cross)
- SELL: When short MA crosses below long MA (Death Cross)
      `,
            tags: ['trend-following', 'moving-average', 'crossover'],
            isPublic: true,
            author: 'Paradigm Trading System',
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // RSI Template
        const rsiTemplate: StrategyTemplate = {
            id: 'rsi_mean_reversion',
            name: 'RSI Mean Reversion',
            description: 'RSI-based mean reversion strategy for oversold/overbought conditions',
            type: 'MEAN_REVERSION',
            category: 'TECHNICAL_ANALYSIS',
            riskLevel: 'HIGH',
            defaultParameters: {
                period: 14,
                oversoldThreshold: 30,
                overboughtThreshold: 70,
                volumeThreshold: 1000
            },
            requiredParameters: ['period', 'oversoldThreshold', 'overboughtThreshold'],
            optionalParameters: ['volumeThreshold'],
            defaultTimeframes: ['5min', '15min', '1hour'],
            defaultInstruments: ['NIFTY', 'BANKNIFTY'],
            exampleConfig: this.createDefaultRSIConfig(),
            documentation: `
# RSI Mean Reversion Strategy

This strategy generates signals based on RSI oversold/overbought conditions.

## Parameters:
- period: RSI calculation period (default: 14)
- oversoldThreshold: RSI level considered oversold (default: 30)
- overboughtThreshold: RSI level considered overbought (default: 70)
- volumeThreshold: Minimum volume required for signal (optional)

## Signals:
- BUY: When RSI crosses above oversold threshold
- SELL: When RSI crosses below overbought threshold
      `,
            tags: ['mean-reversion', 'rsi', 'oscillator'],
            isPublic: true,
            author: 'Paradigm Trading System',
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Breakout Template
        const breakoutTemplate: StrategyTemplate = {
            id: 'breakout_strategy',
            name: 'Breakout Strategy',
            description: 'Detects breakouts from support and resistance levels',
            type: 'BREAKOUT',
            category: 'TECHNICAL_ANALYSIS',
            riskLevel: 'HIGH',
            defaultParameters: {
                lookbackPeriod: 20,
                breakoutThreshold: 0.02,
                volumeMultiplier: 1.5,
                confirmationPeriod: 2
            },
            requiredParameters: ['lookbackPeriod', 'breakoutThreshold', 'volumeMultiplier'],
            optionalParameters: ['confirmationPeriod'],
            defaultTimeframes: ['15min', '1hour', '1day'],
            defaultInstruments: ['NIFTY', 'BANKNIFTY'],
            exampleConfig: this.createDefaultBreakoutConfig(),
            documentation: `
# Breakout Strategy

This strategy detects breakouts from support and resistance levels.

## Parameters:
- lookbackPeriod: Period for calculating support/resistance (default: 20)
- breakoutThreshold: Minimum breakout percentage (default: 0.02 = 2%)
- volumeMultiplier: Volume confirmation multiplier (default: 1.5)
- confirmationPeriod: Periods to confirm breakout (default: 2)

## Signals:
- BUY: When price breaks above resistance with volume confirmation
- SELL: When price breaks below support with volume confirmation
      `,
            tags: ['breakout', 'support-resistance', 'volume'],
            isPublic: true,
            author: 'Paradigm Trading System',
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.templates.set(maTemplate.id, maTemplate);
        this.templates.set(rsiTemplate.id, rsiTemplate);
        this.templates.set(breakoutTemplate.id, breakoutTemplate);

        // Options Strategy Templates
        const coveredCallTemplate: StrategyTemplate = {
            id: 'covered_call_strategy',
            name: 'Covered Call Strategy',
            description: 'Income generation strategy by selling call options against owned stock',
            type: 'OPTIONS_STRATEGY',
            category: 'OPTIONS',
            riskLevel: 'MEDIUM',
            defaultParameters: {
                strategyType: 'COVERED_CALL',
                daysToExpiry: 30,
                deltaTarget: 0.35,
                maxDelta: 0.5
            },
            requiredParameters: ['strategyType', 'daysToExpiry'],
            optionalParameters: ['deltaTarget', 'maxDelta', 'volatilityThreshold'],
            defaultTimeframes: ['1day'],
            defaultInstruments: ['NIFTY', 'BANKNIFTY'],
            exampleConfig: this.createDefaultCoveredCallConfig(),
            documentation: `
# Covered Call Strategy

This strategy generates income by selling call options against owned stock.

## Parameters:
- strategyType: 'COVERED_CALL'
- daysToExpiry: Days to option expiry (default: 30)
- deltaTarget: Target delta for strike selection (default: 0.35)
- maxDelta: Maximum delta exposure (default: 0.5)

## Risk Profile:
- Max Profit: Strike price - Stock price + Premium received
- Max Loss: Stock price (if stock goes to zero)
- Break Even: Stock price - Premium received
      `,
            tags: ['options', 'income', 'covered-call', 'delta-neutral'],
            isPublic: true,
            author: 'Paradigm Trading System',
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const ironCondorTemplate: StrategyTemplate = {
            id: 'iron_condor_strategy',
            name: 'Iron Condor Strategy',
            description: 'Range-bound market strategy using credit spreads',
            type: 'OPTIONS_STRATEGY',
            category: 'OPTIONS',
            riskLevel: 'HIGH',
            defaultParameters: {
                strategyType: 'IRON_CONDOR',
                daysToExpiry: 45,
                width: 100,
                maxDelta: 0.3
            },
            requiredParameters: ['strategyType', 'daysToExpiry'],
            optionalParameters: ['width', 'maxDelta', 'volatilityThreshold'],
            defaultTimeframes: ['1day'],
            defaultInstruments: ['NIFTY', 'BANKNIFTY'],
            exampleConfig: this.createDefaultIronCondorConfig(),
            documentation: `
# Iron Condor Strategy

This strategy profits from low volatility and range-bound markets.

## Parameters:
- strategyType: 'IRON_CONDOR'
- daysToExpiry: Days to option expiry (default: 45)
- width: Width of spreads in points (default: 100)
- maxDelta: Maximum delta exposure (default: 0.3)

## Risk Profile:
- Max Profit: Net credit received
- Max Loss: Width of spread - Net credit
- Break Even: Put short strike and Call short strike
      `,
            tags: ['options', 'credit-spread', 'iron-condor', 'range-bound'],
            isPublic: true,
            author: 'Paradigm Trading System',
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const straddleTemplate: StrategyTemplate = {
            id: 'straddle_strategy',
            name: 'Straddle Strategy',
            description: 'Volatility expansion strategy using ATM options',
            type: 'OPTIONS_STRATEGY',
            category: 'OPTIONS',
            riskLevel: 'HIGH',
            defaultParameters: {
                strategyType: 'STRADDLE',
                daysToExpiry: 30,
                volatilityThreshold: 0.2,
                maxDelta: 0.1
            },
            requiredParameters: ['strategyType', 'daysToExpiry'],
            optionalParameters: ['volatilityThreshold', 'maxDelta'],
            defaultTimeframes: ['1day'],
            defaultInstruments: ['NIFTY', 'BANKNIFTY'],
            exampleConfig: this.createDefaultStraddleConfig(),
            documentation: `
# Straddle Strategy

This strategy profits from large price movements in either direction.

## Parameters:
- strategyType: 'STRADDLE'
- daysToExpiry: Days to option expiry (default: 30)
- volatilityThreshold: Minimum volatility for entry (default: 0.2)
- maxDelta: Maximum delta exposure (default: 0.1)

## Risk Profile:
- Max Profit: Unlimited
- Max Loss: Cost of straddle
- Break Even: Strike ± Cost of straddle
      `,
            tags: ['options', 'volatility', 'straddle', 'directional'],
            isPublic: true,
            author: 'Paradigm Trading System',
            version: '1.0.0',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.templates.set(coveredCallTemplate.id, coveredCallTemplate);
        this.templates.set(ironCondorTemplate.id, ironCondorTemplate);
        this.templates.set(straddleTemplate.id, straddleTemplate);
    }

    async createStrategy(config: StrategyConfig): Promise<IStrategy> {
        try {
            const StrategyClass = this.strategyClasses.get(config.type);
            if (!StrategyClass) {
                throw new Error(`Strategy type not supported: ${config.type}`);
            }

            const strategy = new StrategyClass();
            await strategy.initialize(config);

            return strategy;
        } catch (error) {
            logger.error('Failed to create strategy:', error);
            throw error;
        }
    }

    async createStrategyFromTemplate(templateId: string, customConfig: Partial<StrategyConfig>): Promise<IStrategy> {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        const config: StrategyConfig = {
            ...template.exampleConfig,
            ...customConfig,
            name: customConfig.name || template.name,
            version: template.version
        };

        return this.createStrategy(config);
    }

    async createCustomStrategy(
        name: string,
        type: StrategyType,
        parameters: Record<string, any>,
        customConfig: Partial<StrategyConfig> = {}
    ): Promise<IStrategy> {
        const config: StrategyConfig = {
            name,
            enabled: true,
            description: `Custom ${type.toLowerCase()} strategy`,
            type,
            version: '1.0.0',
            author: 'Custom',
            category: 'CUSTOM',
            riskLevel: 'MEDIUM',
            timeframes: ['5min', '15min', '1hour'],
            entryRules: [],
            exitRules: [],
            positionSizing: this.createDefaultPositionSizing(),
            riskManagement: this.createDefaultRiskManagement(),
            filters: [],
            notifications: [],
            parameters,
            capitalAllocation: 10000,
            instruments: ['NIFTY'],
            ...customConfig
        };

        return this.createStrategy(config);
    }

    getAvailableTemplates(): StrategyTemplate[] {
        return Array.from(this.templates.values());
    }

    getTemplate(templateId: string): StrategyTemplate | undefined {
        return this.templates.get(templateId);
    }

    async registerTemplate(template: StrategyTemplate): Promise<void> {
        this.templates.set(template.id, template);
        logger.info(`Template registered: ${template.name}`);
    }

    getSupportedStrategyTypes(): StrategyType[] {
        return Array.from(this.strategyClasses.keys());
    }

    private createDefaultMAConfig(): StrategyConfig {
        return {
            name: 'Moving Average Crossover',
            enabled: true,
            description: 'Simple moving average crossover strategy',
            type: 'TREND_FOLLOWING',
            version: '1.0.0',
            author: 'Paradigm Trading System',
            category: 'TECHNICAL_ANALYSIS',
            riskLevel: 'MEDIUM',
            timeframes: ['5min', '15min', '1hour'],
            entryRules: [
                {
                    id: 'ma_golden_cross',
                    name: 'Golden Cross Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        shortPeriod: 10,
                        longPeriod: 20,
                        volumeThreshold: 1000
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter when short MA crosses above long MA'
                }
            ],
            exitRules: [
                {
                    id: 'ma_death_cross',
                    name: 'Death Cross Exit',
                    type: 'EXIT',
                    condition: 'AND',
                    parameters: {
                        shortPeriod: 10,
                        longPeriod: 20
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit when short MA crosses below long MA'
                }
            ],
            positionSizing: this.createDefaultPositionSizing(),
            riskManagement: this.createDefaultRiskManagement(),
            filters: [],
            notifications: [],
            parameters: {
                shortPeriod: 10,
                longPeriod: 20,
                volumeThreshold: 1000
            },
            capitalAllocation: 10000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };
    }

    private createDefaultRSIConfig(): StrategyConfig {
        return {
            name: 'RSI Mean Reversion',
            enabled: true,
            description: 'RSI-based mean reversion strategy',
            type: 'MEAN_REVERSION',
            version: '1.0.0',
            author: 'Paradigm Trading System',
            category: 'TECHNICAL_ANALYSIS',
            riskLevel: 'HIGH',
            timeframes: ['5min', '15min', '1hour'],
            entryRules: [
                {
                    id: 'rsi_oversold_entry',
                    name: 'RSI Oversold Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        period: 14,
                        oversoldThreshold: 30,
                        volumeThreshold: 1000
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter when RSI crosses above oversold threshold'
                }
            ],
            exitRules: [
                {
                    id: 'rsi_overbought_exit',
                    name: 'RSI Overbought Exit',
                    type: 'EXIT',
                    condition: 'AND',
                    parameters: {
                        period: 14,
                        overboughtThreshold: 70
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit when RSI crosses below overbought threshold'
                }
            ],
            positionSizing: this.createDefaultPositionSizing(),
            riskManagement: this.createDefaultRiskManagement(),
            filters: [],
            notifications: [],
            parameters: {
                period: 14,
                oversoldThreshold: 30,
                overboughtThreshold: 70,
                volumeThreshold: 1000
            },
            capitalAllocation: 10000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };
    }

    private createDefaultBreakoutConfig(): StrategyConfig {
        return {
            name: 'Breakout Strategy',
            enabled: true,
            description: 'Breakout detection strategy',
            type: 'BREAKOUT',
            version: '1.0.0',
            author: 'Paradigm Trading System',
            category: 'TECHNICAL_ANALYSIS',
            riskLevel: 'HIGH',
            timeframes: ['15min', '1hour', '1day'],
            entryRules: [
                {
                    id: 'resistance_breakout_entry',
                    name: 'Resistance Breakout Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        lookbackPeriod: 20,
                        breakoutThreshold: 0.02,
                        volumeMultiplier: 1.5,
                        confirmationPeriod: 2
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter when price breaks above resistance'
                }
            ],
            exitRules: [
                {
                    id: 'support_breakdown_exit',
                    name: 'Support Breakdown Exit',
                    type: 'EXIT',
                    condition: 'AND',
                    parameters: {
                        lookbackPeriod: 20,
                        breakoutThreshold: 0.02
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit when price breaks below support'
                }
            ],
            positionSizing: this.createDefaultPositionSizing(),
            riskManagement: this.createDefaultRiskManagement(),
            filters: [],
            notifications: [],
            parameters: {
                lookbackPeriod: 20,
                breakoutThreshold: 0.02,
                volumeMultiplier: 1.5,
                confirmationPeriod: 2
            },
            capitalAllocation: 10000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };
    }

    private createDefaultPositionSizing(): PositionSizingConfig {
        return {
            method: 'RISK_PER_TRADE',
            riskPerTrade: 2, // 2% risk per trade
            maxPositionSize: 100000,
            minPositionSize: 1000
        };
    }

    private createDefaultCoveredCallConfig(): StrategyConfig {
        return {
            name: 'Covered Call Strategy',
            enabled: true,
            description: 'Income generation strategy by selling call options',
            type: 'OPTIONS_STRATEGY',
            version: '1.0.0',
            author: 'Paradigm Trading System',
            category: 'OPTIONS',
            riskLevel: 'MEDIUM',
            timeframes: ['1day'],
            entryRules: [
                {
                    id: 'covered_call_entry',
                    name: 'Covered Call Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        strategyType: 'COVERED_CALL',
                        daysToExpiry: 30,
                        deltaTarget: 0.35
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter covered call position'
                }
            ],
            exitRules: [
                {
                    id: 'covered_call_exit',
                    name: 'Covered Call Exit',
                    type: 'EXIT',
                    condition: 'OR',
                    parameters: {
                        daysToExpiry: 5,
                        profitTarget: 0.8
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit covered call position'
                }
            ],
            positionSizing: {
                method: 'FIXED_AMOUNT',
                fixedAmount: 10000,
                maxPositionSize: 50000,
                minPositionSize: 1000
            },
            riskManagement: {
                stopLoss: {
                    type: 'PERCENTAGE',
                    value: 10,
                    percentage: 10
                },
                takeProfit: {
                    type: 'PERCENTAGE',
                    value: 20,
                    percentage: 20
                },
                maxDrawdown: 15,
                maxDailyLoss: 5,
                maxOpenPositions: 3
            },
            filters: [],
            notifications: [],
            parameters: {
                strategyType: 'COVERED_CALL',
                daysToExpiry: 30,
                deltaTarget: 0.35,
                maxDelta: 0.5
            },
            capitalAllocation: 100000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };
    }

    private createDefaultIronCondorConfig(): StrategyConfig {
        return {
            name: 'Iron Condor Strategy',
            enabled: true,
            description: 'Range-bound market strategy using credit spreads',
            type: 'OPTIONS_STRATEGY',
            version: '1.0.0',
            author: 'Paradigm Trading System',
            category: 'OPTIONS',
            riskLevel: 'HIGH',
            timeframes: ['1day'],
            entryRules: [
                {
                    id: 'iron_condor_entry',
                    name: 'Iron Condor Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        strategyType: 'IRON_CONDOR',
                        daysToExpiry: 45,
                        width: 100
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter iron condor position'
                }
            ],
            exitRules: [
                {
                    id: 'iron_condor_exit',
                    name: 'Iron Condor Exit',
                    type: 'EXIT',
                    condition: 'OR',
                    parameters: {
                        daysToExpiry: 10,
                        profitTarget: 0.7
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit iron condor position'
                }
            ],
            positionSizing: {
                method: 'FIXED_AMOUNT',
                fixedAmount: 5000,
                maxPositionSize: 25000,
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
                maxDrawdown: 20,
                maxDailyLoss: 3,
                maxOpenPositions: 2
            },
            filters: [],
            notifications: [],
            parameters: {
                strategyType: 'IRON_CONDOR',
                daysToExpiry: 45,
                width: 100,
                maxDelta: 0.3
            },
            capitalAllocation: 50000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };
    }

    private createDefaultStraddleConfig(): StrategyConfig {
        return {
            name: 'Straddle Strategy',
            enabled: true,
            description: 'Volatility expansion strategy using ATM options',
            type: 'OPTIONS_STRATEGY',
            version: '1.0.0',
            author: 'Paradigm Trading System',
            category: 'OPTIONS',
            riskLevel: 'HIGH',
            timeframes: ['1day'],
            entryRules: [
                {
                    id: 'straddle_entry',
                    name: 'Straddle Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        strategyType: 'STRADDLE',
                        daysToExpiry: 30,
                        volatilityThreshold: 0.2
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter straddle position'
                }
            ],
            exitRules: [
                {
                    id: 'straddle_exit',
                    name: 'Straddle Exit',
                    type: 'EXIT',
                    condition: 'OR',
                    parameters: {
                        daysToExpiry: 5,
                        profitTarget: 0.6
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit straddle position'
                }
            ],
            positionSizing: {
                method: 'FIXED_AMOUNT',
                fixedAmount: 3000,
                maxPositionSize: 15000,
                minPositionSize: 1000
            },
            riskManagement: {
                stopLoss: {
                    type: 'PERCENTAGE',
                    value: 20,
                    percentage: 20
                },
                takeProfit: {
                    type: 'PERCENTAGE',
                    value: 30,
                    percentage: 30
                },
                maxDrawdown: 25,
                maxDailyLoss: 2,
                maxOpenPositions: 1
            },
            filters: [],
            notifications: [],
            parameters: {
                strategyType: 'STRADDLE',
                daysToExpiry: 30,
                volatilityThreshold: 0.2,
                maxDelta: 0.1
            },
            capitalAllocation: 30000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };
    }

    private createDefaultRiskManagement(): RiskManagementConfig {
        return {
            stopLoss: {
                type: 'ATR_BASED',
                value: 2,
                atrMultiplier: 2
            } as StopLossConfig,
            takeProfit: {
                type: 'RISK_REWARD_RATIO',
                value: 2
            } as TakeProfitConfig,
            maxDrawdown: 10, // 10% max drawdown
            maxDailyLoss: 5, // 5% max daily loss
            maxOpenPositions: 5
        };
    }
}

// Export singleton instance
export const strategyFactory = new StrategyFactoryService(); 