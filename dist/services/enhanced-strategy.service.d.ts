import { StrategyConfig, StrategyResult, StrategyPerformance, StrategyState, StrategyTemplate, MarketData, Position } from '../types';
export declare class EnhancedStrategyService {
    private marketDataService;
    constructor();
    createStrategy(config: StrategyConfig): Promise<any>;
    createStrategyFromTemplate(templateId: string, customConfig: Partial<StrategyConfig>): Promise<any>;
    getStrategy(strategyId: string): Promise<any>;
    getStrategyByName(name: string): Promise<any>;
    getAllStrategies(): Promise<any[]>;
    getActiveStrategies(): Promise<any[]>;
    updateStrategy(strategyId: string, updates: Partial<StrategyConfig>): Promise<any>;
    toggleStrategy(strategyId: string, enabled: boolean): Promise<any>;
    deleteStrategy(strategyId: string): Promise<any>;
    executeStrategy(strategyName: string, marketData: MarketData[]): Promise<StrategyResult>;
    executeStrategyWithLiveData(strategyName: string, symbol: string, timeframe: string): Promise<StrategyResult>;
    getStrategyPerformance(strategyId: string): Promise<StrategyPerformance | null>;
    getStrategyState(strategyName: string): Promise<StrategyState | null>;
    getAvailableTemplates(): Promise<StrategyTemplate[]>;
    getTemplate(templateId: string): Promise<StrategyTemplate | undefined>;
    registerTemplate(template: StrategyTemplate): Promise<void>;
    validateStrategy(config: StrategyConfig): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    shouldExitPosition(position: Position, strategyName: string, marketData: MarketData[]): Promise<boolean>;
    private saveSignalsToDatabase;
    private calculatePerformanceMetrics;
    private calculateMaxDrawdown;
    private calculateSharpeRatio;
    private calculateSortinoRatio;
    private calculateProfitFactor;
    private calculateAverageHoldingPeriod;
    private calculateVolatility;
}
export declare const enhancedStrategyService: EnhancedStrategyService;
//# sourceMappingURL=enhanced-strategy.service.d.ts.map