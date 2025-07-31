<<<<<<< HEAD
import { db } from '../database/database';
import { logger } from '../logger/logger';
import {
    StrategyConfig,
    TradeSignal,
    MarketData,
    StrategyResult,
    StrategyState,
    StrategyPerformance,
    StrategyTemplate
} from '../schemas/strategy.schema';
import { IStrategy, BaseStrategy, strategyEngine } from './strategy-engine.service';
import { StrategyFactory } from './strategy-factory.service';
import { ConfigManager } from '../config/config-manager';

export interface StrategyHealthCheck {
    strategyName: string;
    isHealthy: boolean;
    lastExecution: Date;
    executionTime: number;
    errorCount: number;
    signalCount: number;
    performance: StrategyPerformance;
}

export interface StrategyExecutionMetrics {
    strategyName: string;
    executionStart: Date;
    executionEnd: Date;
    executionTime: number;
    signalsGenerated: number;
    errors: string[];
    memoryUsage: number;
    cpuUsage: number;
}

export class EnhancedStrategyService {
    private configManager: ConfigManager;
    private activeStrategies: Map<string, IStrategy> = new Map();
    private executionMetrics: Map<string, StrategyExecutionMetrics[]> = new Map();
    private healthChecks: Map<string, StrategyHealthCheck> = new Map();

    constructor(configManager: ConfigManager) {
        this.configManager = configManager;
    }

    async initialize(): Promise<void> {
        logger.info('Initializing Enhanced Strategy Service');

        // Load strategy templates
        await this.loadStrategyTemplates();

        // Initialize active strategies
        await this.initializeActiveStrategies();

        logger.info('Enhanced Strategy Service initialized successfully');
    }

    async executeAllStrategies(marketData: MarketData[]): Promise<StrategyResult[]> {
        const results: StrategyResult[] = [];
        const strategiesConfig = this.configManager.getStrategiesConfig();

        for (const strategyName in strategiesConfig) {
            const strategyConfig = strategiesConfig[strategyName];
            if (strategyConfig && strategyConfig.enabled) {
                const result = await this.executeStrategyWithMonitoring(strategyName, marketData);
                results.push(result);
            }
        }

        return results;
    }

    async executeStrategyWithMonitoring(strategyName: string, marketData: MarketData[]): Promise<StrategyResult> {
        const executionStart = new Date();
        const metrics: StrategyExecutionMetrics = {
            strategyName,
            executionStart,
            executionEnd: new Date(),
            executionTime: 0,
            signalsGenerated: 0,
            errors: [],
            memoryUsage: 0,
            cpuUsage: 0
        };

        try {
            logger.info(`Executing strategy with monitoring: ${strategyName}`);

            const strategiesConfig = this.configManager.getStrategiesConfig();
            const strategyConfig = strategiesConfig[strategyName];

            if (!strategyConfig || !strategyConfig.enabled) {
                throw new Error(`Strategy '${strategyName}' not found or is disabled.`);
            }

            // Get or create strategy instance
            let strategy: IStrategy | null = this.activeStrategies.get(strategyName) || null;
            if (!strategy) {
                // Create a complete strategy config with default values
                const completeConfig: StrategyConfig = {
                    ...strategyConfig,
                    type: 'TREND_FOLLOWING',
                    version: '1.0.0',
                    category: 'TECHNICAL',
                    riskLevel: 'MEDIUM',
                    timeframes: ['1D'],
                    entryRules: [],
                    exitRules: [],
                    positionSizing: {
                        method: 'PERCENTAGE',
                        value: 2,
                        maxPositionSize: 0.1,
                        minPositionSize: 0.01
                    },
                    riskManagement: {
                        maxRiskPerTrade: 0.02,
                        maxDailyLoss: 5000,
                        maxDrawdown: 0.1,
                        stopLossType: 'PERCENTAGE',
                        stopLossValue: 2,
                        takeProfitType: 'RATIO',
                        takeProfitValue: 2,
                        trailingStop: false
                    },
                    filters: [],
                    notifications: []
                };

                strategy = await StrategyFactory.createStrategy(strategyName, completeConfig);
                if (strategy) {
                    this.activeStrategies.set(strategyName, strategy);
                }
            }

            if (!strategy) {
                throw new Error(`Failed to create strategy '${strategyName}'.`);
            }

            // Execute strategy
            const signals = await strategy.generateSignals(marketData);
            metrics.signalsGenerated = signals.length;

            // Update health check
            this.updateHealthCheck(strategyName, true, signals.length);

            logger.info(`Strategy '${strategyName}' generated ${signals.length} signals.`);

            return {
                success: true,
                signals,
            };
        } catch (error: any) {
            logger.error(`Strategy execution failed for '${strategyName}':`, error);

            metrics.errors.push(error.message);
            this.updateHealthCheck(strategyName, false, 0);

            return {
                success: false,
                signals: [],
                error: error.message,
            };
        } finally {
            metrics.executionEnd = new Date();
            metrics.executionTime = metrics.executionEnd.getTime() - metrics.executionStart.getTime();

            // Store metrics
            this.storeExecutionMetrics(strategyName, metrics);
        }
    }

    async getStrategyHealth(strategyName: string): Promise<StrategyHealthCheck | null> {
        return this.healthChecks.get(strategyName) || null;
    }

    async getAllStrategyHealth(): Promise<StrategyHealthCheck[]> {
        return Array.from(this.healthChecks.values());
    }

    async getStrategyPerformance(strategyName: string): Promise<StrategyPerformance | null> {
        const strategy = this.activeStrategies.get(strategyName);
        if (!strategy) return null;

        // Return default performance if getPerformance method doesn't exist
        return {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalPnL: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            maxConsecutiveLosses: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 0,
            metadata: {}
        };
    }

    async getExecutionMetrics(strategyName: string, limit: number = 100): Promise<StrategyExecutionMetrics[]> {
        const metrics = this.executionMetrics.get(strategyName) || [];
        return metrics.slice(-limit);
    }

    async registerStrategyTemplate(template: StrategyTemplate): Promise<void> {
        await strategyEngine.registerTemplate(template);
        logger.info(`Strategy template registered: ${template.name}`);
    }

    async createStrategyFromTemplate(templateId: string, config: Partial<StrategyConfig>): Promise<StrategyConfig> {
        return await strategyEngine.createStrategyFromTemplate(templateId, config);
    }

    async validateStrategyConfig(config: StrategyConfig): Promise<{ valid: boolean; errors: string[] }> {
        return await strategyEngine.validateStrategy(config);
    }

    async getAvailableStrategies(): Promise<string[]> {
        return StrategyFactory.getAvailableStrategies();
    }

    async getStrategyInfo(strategyName: string): Promise<{ name: string; description: string; type: string } | null> {
        return StrategyFactory.getStrategyInfo(strategyName);
    }

    async reloadStrategy(strategyName: string): Promise<boolean> {
        try {
            // Remove existing strategy
            this.activeStrategies.delete(strategyName);
            this.healthChecks.delete(strategyName);

            // Reinitialize
            const strategiesConfig = this.configManager.getStrategiesConfig();
            const strategyConfig = strategiesConfig[strategyName];

            if (strategyConfig && strategyConfig.enabled) {
                // Create a complete strategy config with default values
                const completeConfig: StrategyConfig = {
                    ...strategyConfig,
                    type: 'TREND_FOLLOWING',
                    version: '1.0.0',
                    category: 'TECHNICAL',
                    riskLevel: 'MEDIUM',
                    timeframes: ['1D'],
                    entryRules: [],
                    exitRules: [],
                    positionSizing: {
                        method: 'PERCENTAGE',
                        value: 2,
                        maxPositionSize: 0.1,
                        minPositionSize: 0.01
                    },
                    riskManagement: {
                        maxRiskPerTrade: 0.02,
                        maxDailyLoss: 5000,
                        maxDrawdown: 0.1,
                        stopLossType: 'PERCENTAGE',
                        stopLossValue: 2,
                        takeProfitType: 'RATIO',
                        takeProfitValue: 2,
                        trailingStop: false
                    },
                    filters: [],
                    notifications: []
                };

                const strategy = await StrategyFactory.createStrategy(strategyName, completeConfig);
                if (strategy) {
                    this.activeStrategies.set(strategyName, strategy);
                    logger.info(`Strategy '${strategyName}' reloaded successfully`);
                    return true;
                }
            }

            return false;
        } catch (error) {
            logger.error(`Failed to reload strategy '${strategyName}':`, error);
            return false;
        }
    }

    async stopStrategy(strategyName: string): Promise<boolean> {
        try {
            const strategy = this.activeStrategies.get(strategyName);
            if (strategy) {
                await strategy.cleanup();
                this.activeStrategies.delete(strategyName);
                logger.info(`Strategy '${strategyName}' stopped successfully`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Failed to stop strategy '${strategyName}':`, error);
            return false;
        }
    }

    private async loadStrategyTemplates(): Promise<void> {
        // Load built-in strategy templates
        const templates: StrategyTemplate[] = [
            {
                id: crypto.randomUUID(),
                name: 'Moving Average Crossover',
                description: 'Simple moving average crossover strategy',
                type: 'TREND_FOLLOWING',
                category: 'TECHNICAL',
                riskLevel: 'MEDIUM',
                defaultParameters: {
                    shortPeriod: 10,
                    longPeriod: 20,
                    volumeThreshold: 1000
                },
                requiredParameters: ['shortPeriod', 'longPeriod'],
                optionalParameters: ['volumeThreshold'],
                defaultTimeframes: ['1D', '1H'],
                defaultInstruments: ['NIFTY', 'BANKNIFTY'],
                exampleConfig: {} as StrategyConfig, // Will be populated
                documentation: 'A simple trend-following strategy based on moving average crossovers',
                tags: ['trend', 'moving-average', 'crossover'],
                isPublic: true,
                author: 'System',
                version: '1.0.0',
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: 'RSI Mean Reversion',
                description: 'RSI-based mean reversion strategy',
                type: 'MEAN_REVERSION',
                category: 'TECHNICAL',
                riskLevel: 'MEDIUM',
                defaultParameters: {
                    period: 14,
                    overbought: 70,
                    oversold: 30
                },
                requiredParameters: ['period', 'overbought', 'oversold'],
                optionalParameters: [],
                defaultTimeframes: ['1D', '4H'],
                defaultInstruments: ['NIFTY', 'BANKNIFTY'],
                exampleConfig: {} as StrategyConfig, // Will be populated
                documentation: 'A mean reversion strategy based on RSI overbought/oversold levels',
                tags: ['mean-reversion', 'rsi', 'oscillator'],
                isPublic: true,
                author: 'System',
                version: '1.0.0',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        for (const template of templates) {
            await this.registerStrategyTemplate(template);
        }
    }

    private async initializeActiveStrategies(): Promise<void> {
        const strategiesConfig = this.configManager.getStrategiesConfig();

        for (const strategyName in strategiesConfig) {
            const strategyConfig = strategiesConfig[strategyName];
            if (strategyConfig && strategyConfig.enabled) {
                try {
                    // Create a complete strategy config with default values
                    const completeConfig: StrategyConfig = {
                        ...strategyConfig,
                        type: 'TREND_FOLLOWING',
                        version: '1.0.0',
                        category: 'TECHNICAL',
                        riskLevel: 'MEDIUM',
                        timeframes: ['1D'],
                        entryRules: [],
                        exitRules: [],
                        positionSizing: {
                            method: 'PERCENTAGE',
                            value: 2,
                            maxPositionSize: 0.1,
                            minPositionSize: 0.01
                        },
                        riskManagement: {
                            maxRiskPerTrade: 0.02,
                            maxDailyLoss: 5000,
                            maxDrawdown: 0.1,
                            stopLossType: 'PERCENTAGE',
                            stopLossValue: 2,
                            takeProfitType: 'RATIO',
                            takeProfitValue: 2,
                            trailingStop: false
                        },
                        filters: [],
                        notifications: []
                    };

                    const strategy = await StrategyFactory.createStrategy(strategyName, completeConfig);
                    if (strategy) {
                        this.activeStrategies.set(strategyName, strategy);
                        this.initializeHealthCheck(strategyName);
                        logger.info(`Active strategy initialized: ${strategyName}`);
                    }
                } catch (error) {
                    logger.error(`Failed to initialize strategy '${strategyName}':`, error);
                }
            }
        }
    }

    private initializeHealthCheck(strategyName: string): void {
        this.healthChecks.set(strategyName, {
            strategyName,
            isHealthy: true,
            lastExecution: new Date(),
            executionTime: 0,
            errorCount: 0,
            signalCount: 0,
            performance: {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                totalPnL: 0,
                maxDrawdown: 0,
                sharpeRatio: 0,
                maxConsecutiveLosses: 0,
                averageWin: 0,
                averageLoss: 0,
                profitFactor: 0,
                metadata: {}
            }
        });
    }

    private updateHealthCheck(strategyName: string, isHealthy: boolean, signalCount: number): void {
        const healthCheck = this.healthChecks.get(strategyName);
        if (healthCheck) {
            healthCheck.isHealthy = isHealthy;
            healthCheck.lastExecution = new Date();
            healthCheck.signalCount += signalCount;

            if (!isHealthy) {
                healthCheck.errorCount++;
            }

            // Update performance from strategy (using default if method doesn't exist)
            const strategy = this.activeStrategies.get(strategyName);
            if (strategy) {
                // Use default performance since getPerformance method doesn't exist on IStrategy
                healthCheck.performance = {
                    totalTrades: 0,
                    winningTrades: 0,
                    losingTrades: 0,
                    winRate: 0,
                    totalPnL: 0,
                    maxDrawdown: 0,
                    sharpeRatio: 0,
                    maxConsecutiveLosses: 0,
                    averageWin: 0,
                    averageLoss: 0,
                    profitFactor: 0,
                    metadata: {}
                };
            }
        }
    }

    private storeExecutionMetrics(strategyName: string, metrics: StrategyExecutionMetrics): void {
        const strategyMetrics = this.executionMetrics.get(strategyName) || [];
        strategyMetrics.push(metrics);

        // Keep only last 1000 metrics per strategy
        if (strategyMetrics.length > 1000) {
            strategyMetrics.splice(0, strategyMetrics.length - 1000);
        }

        this.executionMetrics.set(strategyName, strategyMetrics);
=======
// Stub implementation for EnhancedStrategyService
export class EnhancedStrategyService {
    constructor(_a?: any, _b?: any) { }
    async getStrategy(strategyId: string): Promise<any> {
        // Return a mock strategy object
        return { name: 'MockStrategy' };
    }

    async generateSignals(strategyName: string, periodData: any, technicalAnalysis: any): Promise<{ success: boolean; signals: any[] }> {
        // Return a mock signals array
        return { success: true, signals: [] };
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
    }
} 