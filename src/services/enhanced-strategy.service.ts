import { db } from '../database/database';
import { logger } from '../logger/logger';
import {
    StrategyConfig,
    TradeSignal,
    StrategyResult,
    StrategyPerformance,
    StrategyState,
    StrategyTemplate,
    MarketData,
    Position
} from '../types';
import { strategyEngine } from './strategy-engine.service';
import { strategyFactory } from './strategy-factory.service';
import { EnhancedMarketDataService } from './enhanced-market-data.service';

export class EnhancedStrategyService {
    private marketDataService: EnhancedMarketDataService;

    constructor() {
        this.marketDataService = new EnhancedMarketDataService();
    }

    // Strategy Creation and Management
    async createStrategy(config: StrategyConfig): Promise<any> {
        try {
            // Validate strategy configuration
            const validation = await strategyEngine.validateStrategy(config);
            if (!validation.valid) {
                throw new Error(`Strategy validation failed: ${validation.errors.join(', ')}`);
            }

            // Create strategy instance
            const strategy = await strategyFactory.createStrategy(config);

            // Register with strategy engine
            await strategyEngine.registerStrategy(strategy);

            // Save to database
            const dbStrategy = await db.strategy.create({
                data: {
                    name: config.name,
                    description: config.description || null,
                    isActive: config.enabled,
                    config: config as any,
                },
            });

            logger.info('Strategy created and registered:', config.name);
            return dbStrategy;
        } catch (error) {
            logger.error('Failed to create strategy:', error);
            throw error;
        }
    }

    async createStrategyFromTemplate(templateId: string, customConfig: Partial<StrategyConfig>): Promise<any> {
        try {
            const strategy = await strategyFactory.createStrategyFromTemplate(templateId, customConfig);
            await strategyEngine.registerStrategy(strategy);

            const dbStrategy = await db.strategy.create({
                data: {
                    name: customConfig.name || strategy.name,
                    description: customConfig.description || strategy.description || null,
                    isActive: customConfig.enabled !== false,
                    config: strategy.config as any,
                },
            });

            logger.info('Strategy created from template:', dbStrategy.name);
            return dbStrategy;
        } catch (error) {
            logger.error('Failed to create strategy from template:', error);
            throw error;
        }
    }

    async getStrategy(strategyId: string): Promise<any> {
        try {
            const strategy = await db.strategy.findUnique({
                where: { id: strategyId },
                include: {
                    trades: {
                        include: {
                            instrument: true,
                            session: true,
                        },
                    },
                },
            });

            return strategy;
        } catch (error) {
            logger.error('Failed to get strategy:', error);
            throw error;
        }
    }

    async getStrategyByName(name: string): Promise<any> {
        try {
            const strategy = await db.strategy.findUnique({
                where: { name },
                include: {
                    trades: {
                        include: {
                            instrument: true,
                            session: true,
                        },
                    },
                },
            });

            return strategy;
        } catch (error) {
            logger.error('Failed to get strategy by name:', error);
            throw error;
        }
    }

    async getAllStrategies(): Promise<any[]> {
        try {
            const strategies = await db.strategy.findMany({
                orderBy: { name: 'asc' },
            });

            return strategies;
        } catch (error) {
            logger.error('Failed to get all strategies:', error);
            throw error;
        }
    }

    async getActiveStrategies(): Promise<any[]> {
        try {
            const strategies = await db.strategy.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
            });

            return strategies;
        } catch (error) {
            logger.error('Failed to get active strategies:', error);
            throw error;
        }
    }

    async updateStrategy(strategyId: string, updates: Partial<StrategyConfig>): Promise<any> {
        try {
            const updateData: any = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.enabled !== undefined) updateData.isActive = updates.enabled;
            if (updates !== undefined) updateData.config = updates;

            const strategy = await db.strategy.update({
                where: { id: strategyId },
                data: updateData,
            });

            // Update strategy in engine if it's registered
            const engineStrategy = await strategyEngine.getStrategyState(strategy.name);
            if (engineStrategy) {
                // Re-register updated strategy
                const updatedStrategy = await strategyFactory.createStrategy(updates as StrategyConfig);
                await strategyEngine.registerStrategy(updatedStrategy);
            }

            logger.info('Strategy updated:', strategy.name);
            return strategy;
        } catch (error) {
            logger.error('Failed to update strategy:', error);
            throw error;
        }
    }

    async toggleStrategy(strategyId: string, enabled: boolean): Promise<any> {
        try {
            const strategy = await db.strategy.update({
                where: { id: strategyId },
                data: { isActive: enabled },
            });

            logger.info('Strategy toggled:', strategy.name, enabled ? 'enabled' : 'disabled');
            return strategy;
        } catch (error) {
            logger.error('Failed to toggle strategy:', error);
            throw error;
        }
    }

    async deleteStrategy(strategyId: string): Promise<any> {
        try {
            const strategy = await db.strategy.delete({
                where: { id: strategyId },
            });

            logger.info('Strategy deleted:', strategy.name);
            return strategy;
        } catch (error) {
            logger.error('Failed to delete strategy:', error);
            throw error;
        }
    }

    // Strategy Execution
    async executeStrategy(strategyName: string, marketData: MarketData[]): Promise<StrategyResult> {
        try {
            logger.info('Executing strategy:', strategyName);

            const strategy = await this.getStrategyByName(strategyName);
            if (!strategy || !strategy.isActive) {
                return {
                    success: false,
                    signals: [],
                    error: 'Strategy not found or inactive',
                };
            }

            // Execute strategy using engine
            const result = await strategyEngine.executeStrategy(strategyName, marketData);

            // Save signals to database if successful
            if (result.success && result.signals.length > 0) {
                await this.saveSignalsToDatabase(result.signals, strategy.id);
            }

            return result;
        } catch (error) {
            logger.error('Strategy execution failed:', error);
            return {
                success: false,
                signals: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    async executeStrategyWithLiveData(strategyName: string, symbol: string, timeframe: string): Promise<StrategyResult> {
        try {
            // Get live market data
            const marketData = await this.marketDataService.getMultiTimeframeData(symbol, timeframe, 100);

            if (!marketData || marketData.length === 0) {
                return {
                    success: false,
                    signals: [],
                    error: 'No market data available',
                };
            }

            return this.executeStrategy(strategyName, marketData);
        } catch (error) {
            logger.error('Live strategy execution failed:', error);
            return {
                success: false,
                signals: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    // Strategy Performance Analysis
    async getStrategyPerformance(strategyId: string): Promise<StrategyPerformance | null> {
        try {
            const trades = await db.trade.findMany({
                where: { strategyId },
                include: {
                    instrument: true,
                },
                orderBy: { orderTime: 'asc' },
            });

            if (trades.length === 0) {
                return null;
            }

            return this.calculatePerformanceMetrics(trades);
        } catch (error) {
            logger.error('Failed to get strategy performance:', error);
            throw error;
        }
    }

    async getStrategyState(strategyName: string): Promise<StrategyState | null> {
        try {
            return await strategyEngine.getStrategyState(strategyName);
        } catch (error) {
            logger.error('Failed to get strategy state:', error);
            return null;
        }
    }

    // Template Management
    async getAvailableTemplates(): Promise<StrategyTemplate[]> {
        try {
            return strategyFactory.getAvailableTemplates();
        } catch (error) {
            logger.error('Failed to get templates:', error);
            throw error;
        }
    }

    async getTemplate(templateId: string): Promise<StrategyTemplate | undefined> {
        try {
            return strategyFactory.getTemplate(templateId);
        } catch (error) {
            logger.error('Failed to get template:', error);
            throw error;
        }
    }

    async registerTemplate(template: StrategyTemplate): Promise<void> {
        try {
            await strategyFactory.registerTemplate(template);
        } catch (error) {
            logger.error('Failed to register template:', error);
            throw error;
        }
    }

    // Strategy Validation
    async validateStrategy(config: StrategyConfig): Promise<{ valid: boolean; errors: string[] }> {
        try {
            return await strategyEngine.validateStrategy(config);
        } catch (error) {
            logger.error('Strategy validation failed:', error);
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : 'Unknown validation error']
            };
        }
    }

    // Position Management
    async shouldExitPosition(position: Position, strategyName: string, marketData: MarketData[]): Promise<boolean> {
        try {
            const strategy = await strategyEngine.getStrategyState(strategyName);
            if (!strategy) return false;

            // Get strategy instance and check exit conditions
            const availableStrategies = await strategyEngine.getAvailableStrategies();
            if (availableStrategies.includes(strategyName)) {
                // This would require accessing the actual strategy instance
                // For now, return false - implement based on your needs
                return false;
            }

            return false;
        } catch (error) {
            logger.error('Failed to check exit conditions:', error);
            return false;
        }
    }

    // Utility Methods
    private async saveSignalsToDatabase(signals: TradeSignal[], strategyId: string): Promise<void> {
        try {
            // Save signals to database for tracking
            for (const signal of signals) {
                await db.trade.create({
                    data: {
                        sessionId: 'default', // Use actual session ID
                        instrumentId: 'default', // Use actual instrument ID
                        strategyId,
                        action: signal.action,
                        quantity: signal.quantity,
                        price: signal.price,
                        orderType: 'MARKET',
                        status: 'PENDING',
                        stopLoss: signal.stopLoss,
                        target: signal.target,
                        orderTime: signal.timestamp,
                    },
                });
            }
        } catch (error) {
            logger.error('Failed to save signals to database:', error);
        }
    }

    private calculatePerformanceMetrics(trades: any[]): StrategyPerformance {
        const completedTrades = trades.filter(t => t.status === 'COMPLETE');
        const winningTrades = completedTrades.filter(t => (t.realizedPnL || 0) > 0);
        const losingTrades = completedTrades.filter(t => (t.realizedPnL || 0) < 0);

        const totalPnL = completedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
        const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;
        const totalReturn = totalPnL / 100000; // Assuming 100k initial capital
        const maxDrawdown = this.calculateMaxDrawdown(completedTrades);

        return {
            id: `perf_${Date.now()}`,
            strategyId: trades[0]?.strategyId || '',
            period: 'ALL',
            startDate: trades[0]?.orderTime || new Date(),
            endDate: trades[trades.length - 1]?.orderTime || new Date(),
            totalReturn,
            annualizedReturn: totalReturn * 252, // Simplified annualization
            sharpeRatio: this.calculateSharpeRatio(completedTrades),
            sortinoRatio: this.calculateSortinoRatio(completedTrades),
            calmarRatio: totalReturn / maxDrawdown,
            maxDrawdown,
            winRate,
            profitFactor: this.calculateProfitFactor(winningTrades, losingTrades),
            averageWin: winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0) / winningTrades.length : 0,
            averageLoss: losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + Math.abs(t.realizedPnL || 0), 0) / losingTrades.length : 0,
            largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.realizedPnL || 0)) : 0,
            largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.realizedPnL || 0)) : 0,
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            averageHoldingPeriod: this.calculateAverageHoldingPeriod(completedTrades),
            volatility: this.calculateVolatility(completedTrades),
            beta: 1, // Simplified
            alpha: 0, // Simplified
            informationRatio: 0, // Simplified
            treynorRatio: 0, // Simplified
            jensenAlpha: 0, // Simplified
            createdAt: new Date()
        };
    }

    private calculateMaxDrawdown(trades: any[]): number {
        let peak = 0;
        let maxDrawdown = 0;
        let runningPnL = 0;

        for (const trade of trades) {
            runningPnL += trade.realizedPnL || 0;
            if (runningPnL > peak) {
                peak = runningPnL;
            }
            const drawdown = (peak - runningPnL) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        return maxDrawdown * 100; // Return as percentage
    }

    private calculateSharpeRatio(trades: any[]): number {
        if (trades.length < 2) return 0;

        const returns = trades.map(t => t.realizedPnL || 0);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);

        return stdDev > 0 ? avgReturn / stdDev : 0;
    }

    private calculateSortinoRatio(trades: any[]): number {
        if (trades.length < 2) return 0;

        const returns = trades.map(t => t.realizedPnL || 0);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const negativeReturns = returns.filter(r => r < 0);
        const downsideVariance = negativeReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const downsideDeviation = Math.sqrt(downsideVariance);

        return downsideDeviation > 0 ? avgReturn / downsideDeviation : 0;
    }

    private calculateProfitFactor(winningTrades: any[], losingTrades: any[]): number {
        const totalWins = winningTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
        const totalLosses = losingTrades.reduce((sum, t) => sum + Math.abs(t.realizedPnL || 0), 0);

        return totalLosses > 0 ? totalWins / totalLosses : 0;
    }

    private calculateAverageHoldingPeriod(trades: any[]): number {
        const holdingPeriods = trades
            .filter(t => t.executionTime && t.orderTime)
            .map(t => (new Date(t.executionTime).getTime() - new Date(t.orderTime).getTime()) / (1000 * 60 * 60 * 24)); // Days

        return holdingPeriods.length > 0 ? holdingPeriods.reduce((sum, h) => sum + h, 0) / holdingPeriods.length : 0;
    }

    private calculateVolatility(trades: any[]): number {
        if (trades.length < 2) return 0;

        const returns = trades.map(t => t.realizedPnL || 0);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;

        return Math.sqrt(variance);
    }
}

// Export singleton instance
export const enhancedStrategyService = new EnhancedStrategyService(); 