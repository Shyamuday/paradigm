import { db } from '../database/database';
import { logger } from '../logger/logger';
import { MarketData, TradeSignal, StrategyConfig } from '../schemas/strategy.schema';
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

            // Create a complete strategy config from the simplified config
            const completeStrategyConfig: StrategyConfig = {
                name: strategyConfig.name,
                enabled: strategyConfig.enabled,
                description: strategyConfig.description || '',
                parameters: strategyConfig.parameters,
                capitalAllocation: strategyConfig.capitalAllocation,
                instruments: strategyConfig.instruments,
                type: 'TREND_FOLLOWING', // Default type
                version: '1.0.0', // Default version
                category: 'TECHNICAL', // Default category
                riskLevel: 'MEDIUM', // Default risk level
                timeframes: ['5min', '15min', '1hour'], // Default timeframes
                entryRules: [], // Empty rules for now
                exitRules: [], // Empty rules for now
                positionSizing: {
                    method: 'PERCENTAGE',
                    value: strategyConfig.capitalAllocation * 100,
                    maxPositionSize: 0.1,
                    minPositionSize: 0.01
                },
                riskManagement: {
                    maxRiskPerTrade: 0.02,
                    maxDailyLoss: 5000,
                    maxDrawdown: 0.1,
                    stopLossType: 'PERCENTAGE',
                    stopLossValue: 2,
                    takeProfitType: 'PERCENTAGE',
                    takeProfitValue: 4,
                    trailingStop: false
                },
                filters: [],
                notifications: []
            };

            const strategy = await StrategyFactory.createStrategy(strategyName, completeStrategyConfig);
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