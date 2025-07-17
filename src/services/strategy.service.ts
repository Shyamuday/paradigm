import { db } from '../database/database';
import { logger } from '../logger/logger';
import { MarketData, TradeSignal } from './strategies/strategy.interface';
import { StrategyFactory } from './strategy-factory.service';
import { ConfigManager } from '../config/config-manager';

export interface StrategyResult {
    success: boolean;
    signals: TradeSignal[];
    error?: string;
}

export class StrategyService {
    private configManager: ConfigManager;

    constructor(configManager: ConfigManager) {
        this.configManager = configManager;
    }

    async executeAllStrategies(marketData: MarketData[]): Promise<StrategyResult[]> {
        const results: StrategyResult[] = [];
        const strategiesConfig = this.configManager.getStrategiesConfig();

        for (const strategyName in strategiesConfig) {
            const strategyConfig = strategiesConfig[strategyName];
            if (strategyConfig && strategyConfig.enabled) {
                const result = await this.executeStrategy(strategyName, marketData);
                results.push(result);
            }
        }

        return results;
    }

    async executeStrategy(strategyName: string, marketData: MarketData[]): Promise<StrategyResult> {
        try {
            logger.info(`Executing strategy: ${strategyName}`);
            const strategiesConfig = this.configManager.getStrategiesConfig();
            const strategyConfig = strategiesConfig[strategyName];

            if (!strategyConfig || !strategyConfig.enabled) {
                return {
                    success: false,
                    signals: [],
                    error: `Strategy '${strategyName}' not found or is disabled.`,
                };
            }

            const strategy = await StrategyFactory.createStrategy(strategyName, strategyConfig.parameters);
            if (!strategy) {
                return {
                    success: false,
                    signals: [],
                    error: `Failed to create strategy '${strategyName}'.`,
                };
            }

            const signals = await strategy.generateSignals(marketData);
            logger.info(`Strategy '${strategyName}' generated ${signals.length} signals.`);

            return {
                success: true,
                signals,
            };
        } catch (error: any) {
            logger.error(`Strategy execution failed for '${strategyName}':`, error);
            return {
                success: false,
                signals: [],
                error: error.message,
            };
        }
    }
}