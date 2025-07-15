"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.strategyEngine = exports.StrategyEngineService = exports.BaseStrategy = void 0;
const logger_1 = require("../logger/logger");
class BaseStrategy {
    constructor(name, type, version, description) {
        this.indicators = new Map();
        this.name = name;
        this.type = type;
        this.version = version;
        this.description = description;
    }
    async initialize(config) {
        this.config = config;
        await this.setupIndicators();
        await this.initializeState();
        logger_1.logger.info(`Strategy ${this.name} initialized`);
    }
    validateConfig(config) {
        return !!(config.name &&
            config.type &&
            config.entryRules?.length > 0 &&
            config.exitRules?.length > 0);
    }
    calculatePositionSize(signal, capital) {
        const sizing = this.config.positionSizing;
        switch (sizing.method) {
            case 'FIXED_AMOUNT':
                return sizing.fixedAmount || 0;
            case 'PERCENTAGE_OF_CAPITAL':
                return (capital * (sizing.percentageOfCapital || 0)) / 100;
            case 'RISK_PER_TRADE':
                const riskAmount = capital * (sizing.riskPerTrade || 0) / 100;
                const stopLossDistance = Math.abs(signal.price - (signal.stopLoss || 0));
                return stopLossDistance > 0 ? riskAmount / stopLossDistance : 0;
            case 'KELLY_CRITERION':
                return this.calculateKellyCriterion(signal, capital);
            case 'VOLATILITY_BASED':
                return this.calculateVolatilityBasedSize(signal, capital);
            case 'CUSTOM_FORMULA':
                return this.evaluateCustomFormula(sizing.customFormula || '', signal, capital);
            default:
                return 0;
        }
    }
    applyRiskManagement(signal) {
        const riskConfig = this.config.riskManagement;
        if (riskConfig.stopLoss) {
            signal.stopLoss = this.calculateStopLoss(signal, riskConfig.stopLoss);
        }
        if (riskConfig.takeProfit) {
            signal.target = this.calculateTakeProfit(signal, riskConfig.takeProfit);
        }
        return signal;
    }
    async cleanup() {
        this.indicators.clear();
        logger_1.logger.info(`Strategy ${this.name} cleaned up`);
    }
    async setupIndicators() {
        const allRules = [...this.config.entryRules, ...this.config.exitRules];
        for (const rule of allRules) {
            if (rule.parameters.indicators) {
                for (const indicator of rule.parameters.indicators) {
                    await this.setupIndicator(indicator);
                }
            }
        }
    }
    async setupIndicator(indicator) {
        this.indicators.set(indicator.name, indicator);
    }
    async initializeState() {
        this.state = {
            id: `state_${this.name}_${Date.now()}`,
            strategyId: this.config.name,
            status: 'ACTIVE',
            currentPositions: [],
            pendingSignals: [],
            lastExecutionTime: new Date(),
            errorCount: 0,
            performanceMetrics: {},
            isHealthy: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
    calculateKellyCriterion(signal, capital) {
        const winRate = 0.6;
        const avgWin = 100;
        const avgLoss = 50;
        const kellyFraction = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
        return Math.max(0, Math.min(kellyFraction * capital, capital * 0.25));
    }
    calculateVolatilityBasedSize(signal, capital) {
        const volatility = this.calculateVolatility(signal.symbol);
        const maxRisk = capital * 0.02;
        return maxRisk / volatility;
    }
    evaluateCustomFormula(formula, signal, capital) {
        try {
            const context = {
                capital,
                price: signal.price,
                stopLoss: signal.stopLoss,
                target: signal.target,
                volatility: this.calculateVolatility(signal.symbol)
            };
            let evaluatedFormula = formula;
            for (const [key, value] of Object.entries(context)) {
                evaluatedFormula = evaluatedFormula.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value.toString());
            }
            return eval(evaluatedFormula);
        }
        catch (error) {
            logger_1.logger.error('Error evaluating custom formula:', error);
            return 0;
        }
    }
    calculateStopLoss(signal, stopLossConfig) {
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
    calculateTakeProfit(signal, takeProfitConfig) {
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
                return signal.target || 0;
        }
    }
    calculateVolatility(symbol) {
        return 0.02;
    }
    calculateATR(symbol) {
        return 10;
    }
    evaluateRule(rule, marketData) {
        const conditions = rule.parameters.conditions || [];
        switch (rule.condition) {
            case 'AND':
                return conditions.every(condition => this.evaluateCondition(condition, marketData));
            case 'OR':
                return conditions.some(condition => this.evaluateCondition(condition, marketData));
            case 'NOT':
                return !this.evaluateCondition(conditions[0], marketData);
            default:
                return false;
        }
    }
    evaluateCondition(condition, marketData) {
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
    calculateIndicatorValue(indicator, marketData) {
        switch (indicator.type) {
            case 'MOVING_AVERAGE':
                return this.calculateMovingAverage(marketData, indicator.period);
            case 'RSI':
                return this.calculateRSI(marketData, indicator.period);
            case 'MACD':
                return this.calculateMACD(marketData, indicator.fastPeriod, indicator.slowPeriod);
            default:
                return 0;
        }
    }
    calculateMovingAverage(data, period) {
        if (data.length < period)
            return 0;
        const recentData = data.slice(-period);
        const sum = recentData.reduce((acc, d) => acc + (d.close || 0), 0);
        return sum / period;
    }
    calculateRSI(data, period) {
        if (data.length < period + 1)
            return 50;
        let gains = 0;
        let losses = 0;
        for (let i = data.length - period; i < data.length; i++) {
            const change = (data[i].close || 0) - (data[i - 1].close || 0);
            if (change > 0)
                gains += change;
            else
                losses -= change;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgLoss === 0)
            return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    calculateMACD(data, fastPeriod, slowPeriod) {
        const fastMA = this.calculateMovingAverage(data, fastPeriod);
        const slowMA = this.calculateMovingAverage(data, slowPeriod);
        return fastMA - slowMA;
    }
}
exports.BaseStrategy = BaseStrategy;
class StrategyEngineService {
    constructor() {
        this.strategies = new Map();
        this.templates = new Map();
    }
    async registerStrategy(strategy) {
        this.strategies.set(strategy.name, strategy);
        logger_1.logger.info(`Strategy registered: ${strategy.name}`);
    }
    async createStrategyFromTemplate(templateId, config) {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }
        const strategyConfig = {
            ...template.exampleConfig,
            ...config,
            name: config.name || template.name,
            version: template.version
        };
        return strategyConfig;
    }
    async executeStrategy(strategyName, marketData) {
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
            const processedSignals = signals.map(signal => {
                const sizedSignal = { ...signal };
                sizedSignal.quantity = strategy.calculatePositionSize(signal, 100000);
                return strategy.applyRiskManagement(sizedSignal);
            });
            return {
                success: true,
                signals: processedSignals
            };
        }
        catch (error) {
            logger_1.logger.error('Strategy execution failed:', error);
            return {
                success: false,
                signals: [],
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async getStrategyState(strategyName) {
        const strategy = this.strategies.get(strategyName);
        if (strategy && 'state' in strategy) {
            return strategy.state;
        }
        return null;
    }
    async validateStrategy(config) {
        const errors = [];
        if (!config.name)
            errors.push('Strategy name is required');
        if (!config.type)
            errors.push('Strategy type is required');
        if (!config.entryRules || config.entryRules.length === 0) {
            errors.push('At least one entry rule is required');
        }
        if (!config.exitRules || config.exitRules.length === 0) {
            errors.push('At least one exit rule is required');
        }
        if (!config.positionSizing) {
            errors.push('Position sizing configuration is required');
        }
        if (!config.riskManagement) {
            errors.push('Risk management configuration is required');
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    async getAvailableStrategies() {
        return Array.from(this.strategies.keys());
    }
    async getStrategyTemplates() {
        return Array.from(this.templates.values());
    }
    async registerTemplate(template) {
        this.templates.set(template.id, template);
        logger_1.logger.info(`Strategy template registered: ${template.name}`);
    }
}
exports.StrategyEngineService = StrategyEngineService;
exports.strategyEngine = new StrategyEngineService();
//# sourceMappingURL=strategy-engine.service.js.map