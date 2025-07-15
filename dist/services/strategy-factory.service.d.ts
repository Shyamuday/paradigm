import { StrategyConfig, StrategyTemplate, StrategyType } from '../types';
import { IStrategy } from './strategy-engine.service';
export declare class StrategyFactoryService {
    private strategyClasses;
    private templates;
    constructor();
    private registerStrategyClasses;
    private registerDefaultTemplates;
    createStrategy(config: StrategyConfig): Promise<IStrategy>;
    createStrategyFromTemplate(templateId: string, customConfig: Partial<StrategyConfig>): Promise<IStrategy>;
    createCustomStrategy(name: string, type: StrategyType, parameters: Record<string, any>, customConfig?: Partial<StrategyConfig>): Promise<IStrategy>;
    getAvailableTemplates(): StrategyTemplate[];
    getTemplate(templateId: string): StrategyTemplate | undefined;
    registerTemplate(template: StrategyTemplate): Promise<void>;
    getSupportedStrategyTypes(): StrategyType[];
    private createDefaultMAConfig;
    private createDefaultRSIConfig;
    private createDefaultBreakoutConfig;
    private createDefaultPositionSizing;
    private createDefaultCoveredCallConfig;
    private createDefaultIronCondorConfig;
    private createDefaultStraddleConfig;
    private createDefaultRiskManagement;
}
export declare const strategyFactory: StrategyFactoryService;
//# sourceMappingURL=strategy-factory.service.d.ts.map