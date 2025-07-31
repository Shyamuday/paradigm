import { db } from '../database/database';
import { logger } from '../logger/logger';
import {
    StrategyConfigSchema,
    TradeSignalSchema,
    StrategyResultSchema,
    StrategyStateSchema,
    StrategyPerformanceSchema,
    StrategyTemplateSchema,
    PositionSchema,
    type StrategyConfig,
    type TradeSignal,
    type StrategyResult,
    type StrategyType,
    type StrategyRule,
    type TechnicalIndicator,
    type IndicatorType,
    type MarketData,
    type Position,
    type StrategyState,
    type StrategyPerformance,
    type StrategyTemplate,
    type RiskManagementConfig,
    type PositionSizingConfig
} from '../schemas/strategy.schema';
import { z } from 'zod';
import { enhancedTechnicalIndicators } from './enhanced-technical-indicators.service';

// Base Strategy Interface
export interface IStrategy {
    name: string;
    type: StrategyType;
    version: string;
    description?: string | undefined;

    initialize(config: StrategyConfig): Promise<void>;
    validateConfig(config: StrategyConfig): boolean;
    generateSignals(marketData: MarketData[]): Promise<TradeSignal[]>;
    calculatePositionSize(signal: TradeSignal, capital: number): number;
    applyRiskManagement(signal: TradeSignal): TradeSignal;
    shouldExit(position: Position, marketData: MarketData[]): Promise<boolean>;
    cleanup(): Promise<void>;
}

// Base Strategy Class
export abstract class BaseStrategy implements IStrategy {
    public name: string;
    public type: StrategyType;
    public version: string;
    public description?: string | undefined;

    protected config!: StrategyConfig;
    protected indicators: Map<string, TechnicalIndicator> = new Map();
    protected state!: StrategyState;

    constructor(name: string, type: StrategyType, version: string, description?: string | undefined) {
        this.name = name;
        this.type = type;
        this.version = version;
        this.description = description;
    }

    async initialize(config: StrategyConfig): Promise<void> {
        this.config = config;
        await this.setupIndicators();
        await this.initializeState();
        logger.info(`Strategy ${this.name} initialized`);
    }

    validateConfig(config: StrategyConfig): boolean {
        // Base validation - override in subclasses
        return !!(
            config.name &&
            config.type &&
            config.entryRules?.length > 0 &&
            config.exitRules?.length > 0
        );
    }

    abstract generateSignals(marketData: MarketData[]): Promise<TradeSignal[]>;
    abstract shouldExit(position: Position, marketData: MarketData[]): Promise<boolean>;

    calculatePositionSize(signal: TradeSignal, capital: number): number {
        const sizing = this.config.positionSizing;

        switch (sizing.method) {
            case 'FIXED':
                return sizing.value;

            case 'PERCENTAGE':
                return (capital * sizing.value) / 100;

            case 'KELLY':
                return this.calculateKellyCriterion(signal, capital);

            case 'VOLATILITY':
                return this.calculateVolatilityBasedSize(signal, capital);

            case 'CUSTOM':
                return this.evaluateCustomFormula(sizing.customFormula || '', signal, capital);

            default:
                return 0;
        }
    }

    applyRiskManagement(signal: TradeSignal): TradeSignal {
        const riskConfig = this.config.riskManagement;

        // Apply stop loss
        signal.stopLoss = this.calculateStopLoss(signal, {
            type: riskConfig.stopLossType,
            value: riskConfig.stopLossValue
        });

        // Apply take profit
        signal.takeProfit = this.calculateTakeProfit(signal, {
            type: riskConfig.takeProfitType,
            value: riskConfig.takeProfitValue
        });

        return signal;
    }

    async cleanup(): Promise<void> {
        // Cleanup resources
        this.indicators.clear();
        logger.info(`Strategy ${this.name} cleaned up`);
    }

    protected async setupIndicators(): Promise<void> {
        // Setup technical indicators based on strategy rules
        const allRules = [...this.config.entryRules, ...this.config.exitRules];

        for (const rule of allRules) {
            if (rule.parameters.indicators) {
                for (const indicator of rule.parameters.indicators) {
                    await this.setupIndicator(indicator);
                }
            }
        }
    }

    protected async setupIndicator(indicator: TechnicalIndicator): Promise<void> {
        this.indicators.set(indicator.name, indicator);
    }

    protected async initializeState(): Promise<void> {
        // Initialize or load strategy state
        this.state = {
            isActive: true,
            totalSignals: 0,
            successfulSignals: 0,
            failedSignals: 0,
            currentPositions: 0,
            totalPnL: 0,
            lastExecution: new Date(),
            metadata: {}
        };
    }

    protected calculateKellyCriterion(signal: TradeSignal, capital: number): number {
        // Simplified Kelly Criterion calculation
        const winRate = 0.6; // Should be calculated from historical data
        const avgWin = 100;
        const avgLoss = 50;

        const kellyFraction = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
        return Math.max(0, Math.min(kellyFraction * capital, capital * 0.25));
    }

    protected calculateVolatilityBasedSize(signal: TradeSignal, capital: number): number {
        // Calculate position size based on volatility
        const volatility = this.calculateVolatility(signal.symbol);
        const maxRisk = capital * 0.02; // 2% risk per trade
        return maxRisk / volatility;
    }

    protected evaluateCustomFormula(formula: string, signal: TradeSignal, capital: number): number {
        // Evaluate custom position sizing formula
        try {
            // This is a simplified implementation - in production, use a proper formula parser
            const context = {
                capital,
                price: signal.price,
                stopLoss: signal.stopLoss,
                target: signal.takeProfit,
                volatility: this.calculateVolatility(signal.symbol)
            };

            // Replace variables in formula
            let evaluatedFormula = formula;
            for (const [key, value] of Object.entries(context)) {
                evaluatedFormula = evaluatedFormula.replace(new RegExp(`\\$\{${key}\\}`, 'g'), String(value));
            }

            return eval(evaluatedFormula);
        } catch (error) {
            logger.error('Error evaluating custom formula:', error);
            return 0;
        }
    }

    protected calculateStopLoss(signal: TradeSignal, stopLossConfig: any): number {
        const price = signal.price;

        switch (stopLossConfig.type) {
            case 'FIXED_POINTS':
                return signal.action === 'BUY' ? price - stopLossConfig.value : price + stopLossConfig.value;

            case 'PERCENTAGE':
                const percentage = stopLossConfig.percentage || 0;
                return signal.action === 'BUY' ? price * (1 - percentage / 100) : price * (1 + percentage / 100);

            case 'ATR_BASED':
                const atr = this.calculateATR(signal.symbol);
                const atrMultiplier = stopLossConfig.atrMultiplier || 2;
                return signal.action === 'BUY' ? price - (atr * atrMultiplier) : price + (atr * atrMultiplier);

            default:
                return signal.stopLoss || 0;
        }
    }

    protected calculateTakeProfit(signal: TradeSignal, takeProfitConfig: any): number {
        const price = signal.price;

        switch (takeProfitConfig.type) {
            case 'FIXED_POINTS':
                return signal.action === 'BUY' ? price + takeProfitConfig.value : price - takeProfitConfig.value;

            case 'PERCENTAGE':
                const percentage = takeProfitConfig.percentage || 0;
                return signal.action === 'BUY' ? price * (1 + percentage / 100) : price * (1 - percentage / 100);

            case 'RISK_REWARD_RATIO':
                const riskRewardRatio = takeProfitConfig.value || 2;
                const stopLossDistance = Math.abs(price - (signal.stopLoss || 0));
                return signal.action === 'BUY' ? price + (stopLossDistance * riskRewardRatio) : price - (stopLossDistance * riskRewardRatio);

            default:
                return signal.takeProfit || 0;
        }
    }

    protected calculateVolatility(symbol: string): number {
        // Simplified volatility calculation - should use historical data
        return 0.02; // 2% volatility
    }

    protected calculateATR(symbol: string): number {
        // Simplified ATR calculation - should use historical data
        return 10; // 10 points ATR
    }

    protected evaluateRule(rule: StrategyRule, marketData: MarketData[]): boolean {
        // Evaluate strategy rule
        const conditions = (rule.parameters.conditions as any[]) || [];

        switch (rule.condition) {
            case 'AND':
                return conditions.every((condition: any) => this.evaluateCondition(condition, marketData));

            case 'OR':
                return conditions.some((condition: any) => this.evaluateCondition(condition, marketData));

            case 'NOT':
                return !this.evaluateCondition(conditions[0], marketData);

            default:
                return false;
        }
    }

    protected evaluateCondition(condition: any, marketData: MarketData[]): boolean {
        // Evaluate individual condition
        const { indicator, operator, value } = condition;
        const indicatorValue = this.calculateIndicatorValue(indicator, marketData);

        switch (operator) {
            case 'GT': return indicatorValue > value;
            case 'LT': return indicatorValue < value;
            case 'EQ': return indicatorValue === value;
            case 'GTE': return indicatorValue >= value;
            case 'LTE': return indicatorValue <= value;
            default: return false;
        }
    }

    protected calculateIndicatorValue(indicator: any, marketData: MarketData[]): number {
        // Calculate indicator value based on type using enhanced service
        const prices = marketData.map(d => d.close || 0).filter(price => price > 0);

        switch (indicator.type) {
            case 'MOVING_AVERAGE':
                const smaValues = enhancedTechnicalIndicators.calculateSMA(prices, indicator.period);
                return smaValues.length > 0 ? (smaValues[smaValues.length - 1] || 0) : 0;

            case 'RSI':
                const rsiValues = enhancedTechnicalIndicators.calculateRSI(prices, indicator.period);
                return rsiValues.length > 0 ? (rsiValues[rsiValues.length - 1] || 50) : 50;

            case 'MACD':
                const macdResult = enhancedTechnicalIndicators.calculateMACD(prices, indicator.fastPeriod, indicator.slowPeriod);
                return macdResult.macd.length > 0 ? (macdResult.macd[macdResult.macd.length - 1] || 0) : 0;

            default:
                return 0;
        }
    }

    // Using enhanced technical indicators service instead of local calculations
}

// Strategy Engine Service
export class StrategyEngineService {
    private strategies: Map<string, IStrategy> = new Map();
    private templates: Map<string, StrategyTemplate> = new Map();

    async registerStrategy(strategy: IStrategy): Promise<void> {
        this.strategies.set(strategy.name, strategy);
        logger.info(`Strategy registered: ${strategy.name}`);
    }

    async createStrategyFromTemplate(templateId: string, config: Partial<StrategyConfig>): Promise<StrategyConfig> {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        const strategyConfig: StrategyConfig = {
            ...template.exampleConfig,
            ...config,
            name: config.name || template.name,
            version: template.version
        };

        return strategyConfig;
    }

    async executeStrategy(strategyName: string, marketData: MarketData[]): Promise<StrategyResult> {
        try {
            const strategy = this.strategies.get(strategyName);
            if (!strategy) {
                return {
                    success: false,
                    signals: [],
                    error: `Strategy not found: ${strategyName}`
                };
            }

            const signals = await strategy.generateSignals(marketData);

            // Apply position sizing and risk management
            const processedSignals = signals.map(signal => {
                const sizedSignal = { ...signal };
                sizedSignal.quantity = strategy.calculatePositionSize(signal, 100000); // Use actual capital
                return strategy.applyRiskManagement(sizedSignal);
            });

            return {
                success: true,
                signals: processedSignals
            };
        } catch (error) {
            logger.error('Strategy execution failed:', error);
            return {
                success: false,
                signals: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async getStrategyState(strategyName: string): Promise<StrategyState | null> {
        // Cannot access protected state property from outside the class
        return null;
    }

    async validateStrategy(config: StrategyConfig): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];

        // Basic validation
        if (!config.name) errors.push('Strategy name is required');
        if (!config.type) errors.push('Strategy type is required');
        if (!config.entryRules || config.entryRules.length === 0) {
            errors.push('At least one entry rule is required');
        }
        if (!config.exitRules || config.exitRules.length === 0) {
            errors.push('At least one exit rule is required');
        }

        // Validate position sizing
        if (!config.positionSizing) {
            errors.push('Position sizing configuration is required');
        }

        // Validate risk management
        if (!config.riskManagement) {
            errors.push('Risk management configuration is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    async getAvailableStrategies(): Promise<string[]> {
        return Array.from(this.strategies.keys());
    }

    async getStrategyTemplates(): Promise<StrategyTemplate[]> {
        return Array.from(this.templates.values());
    }

    async registerTemplate(template: StrategyTemplate): Promise<void> {
        this.templates.set(template.id, template);
        logger.info(`Strategy template registered: ${template.name}`);
    }
}

// Export singleton instance
export const strategyEngine = new StrategyEngineService(); 