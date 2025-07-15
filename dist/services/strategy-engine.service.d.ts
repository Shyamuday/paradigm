import { StrategyConfig, TradeSignal, StrategyResult, StrategyType, StrategyRule, TechnicalIndicator, MarketData, Position, StrategyState, StrategyTemplate } from '../types';
export interface IStrategy {
    name: string;
    type: StrategyType;
    version: string;
    description?: string;
    initialize(config: StrategyConfig): Promise<void>;
    validateConfig(config: StrategyConfig): boolean;
    generateSignals(marketData: MarketData[]): Promise<TradeSignal[]>;
    calculatePositionSize(signal: TradeSignal, capital: number): number;
    applyRiskManagement(signal: TradeSignal): TradeSignal;
    shouldExit(position: Position, marketData: MarketData[]): Promise<boolean>;
    cleanup(): Promise<void>;
}
export declare abstract class BaseStrategy implements IStrategy {
    name: string;
    type: StrategyType;
    version: string;
    description?: string;
    protected config: StrategyConfig;
    protected indicators: Map<string, TechnicalIndicator>;
    protected state: StrategyState;
    constructor(name: string, type: StrategyType, version: string, description?: string);
    initialize(config: StrategyConfig): Promise<void>;
    validateConfig(config: StrategyConfig): boolean;
    abstract generateSignals(marketData: MarketData[]): Promise<TradeSignal[]>;
    abstract shouldExit(position: Position, marketData: MarketData[]): Promise<boolean>;
    calculatePositionSize(signal: TradeSignal, capital: number): number;
    applyRiskManagement(signal: TradeSignal): TradeSignal;
    cleanup(): Promise<void>;
    protected setupIndicators(): Promise<void>;
    protected setupIndicator(indicator: TechnicalIndicator): Promise<void>;
    protected initializeState(): Promise<void>;
    protected calculateKellyCriterion(signal: TradeSignal, capital: number): number;
    protected calculateVolatilityBasedSize(signal: TradeSignal, capital: number): number;
    protected evaluateCustomFormula(formula: string, signal: TradeSignal, capital: number): number;
    protected calculateStopLoss(signal: TradeSignal, stopLossConfig: any): number;
    protected calculateTakeProfit(signal: TradeSignal, takeProfitConfig: any): number;
    protected calculateVolatility(symbol: string): number;
    protected calculateATR(symbol: string): number;
    protected evaluateRule(rule: StrategyRule, marketData: MarketData[]): boolean;
    protected evaluateCondition(condition: any, marketData: MarketData[]): boolean;
    protected calculateIndicatorValue(indicator: any, marketData: MarketData[]): number;
    protected calculateMovingAverage(data: MarketData[], period: number): number;
    protected calculateRSI(data: MarketData[], period: number): number;
    protected calculateMACD(data: MarketData[], fastPeriod: number, slowPeriod: number): number;
}
export declare class StrategyEngineService {
    private strategies;
    private templates;
    registerStrategy(strategy: IStrategy): Promise<void>;
    createStrategyFromTemplate(templateId: string, config: Partial<StrategyConfig>): Promise<StrategyConfig>;
    executeStrategy(strategyName: string, marketData: MarketData[]): Promise<StrategyResult>;
    getStrategyState(strategyName: string): Promise<StrategyState | null>;
    validateStrategy(config: StrategyConfig): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    getAvailableStrategies(): Promise<string[]>;
    getStrategyTemplates(): Promise<StrategyTemplate[]>;
    registerTemplate(template: StrategyTemplate): Promise<void>;
}
export declare const strategyEngine: StrategyEngineService;
//# sourceMappingURL=strategy-engine.service.d.ts.map