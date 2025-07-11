import { db } from '../database/database';
import { logger } from '../logger/logger';
import { StrategyConfig, TradeSignal, StrategyResult } from '../types';

export class StrategyService {
    async createStrategy(config: StrategyConfig) {
        try {
            const strategy = await db.strategy.create({
                data: {
                    name: config.name,
                    description: config.description || null,
                    isActive: config.enabled,
                    config: config as any,
                },
            });

            logger.info('Strategy created:', strategy.name);
            return strategy;
        } catch (error) {
            logger.error('Failed to create strategy:', error);
            throw error;
        }
    }

    async getStrategy(strategyId: string) {
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

    async getStrategyByName(name: string) {
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

    async getAllStrategies() {
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

    async getActiveStrategies() {
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

    async updateStrategy(strategyId: string, updates: Partial<StrategyConfig>) {
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

            logger.info('Strategy updated:', strategy.name);
            return strategy;
        } catch (error) {
            logger.error('Failed to update strategy:', error);
            throw error;
        }
    }

    async toggleStrategy(strategyId: string, enabled: boolean) {
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

    async deleteStrategy(strategyId: string) {
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

    // Strategy execution methods
    async executeStrategy(strategyName: string, marketData: any[]): Promise<StrategyResult> {
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

            const signals = await this.generateSignals(strategy, marketData);

            logger.info('Strategy signals generated:', signals.length);
            return {
                success: true,
                signals,
            };
        } catch (error) {
            logger.error('Strategy execution failed:', error);
            return {
                success: false,
                signals: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    private async generateSignals(strategy: any, marketData: any[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        // Simple Moving Average Strategy Example
        if (strategy.name === 'simple_ma') {
            const config = strategy.config as StrategyConfig;
            const shortPeriod = config.parameters.shortPeriod || 10;
            const longPeriod = config.parameters.longPeriod || 20;

            for (const data of marketData) {
                // This is a simplified example - in practice you'd implement proper technical indicators
                const signal = this.calculateMovingAverageSignal(data, shortPeriod, longPeriod);
                if (signal) {
                    signals.push(signal);
                }
            }
        }

        return signals;
    }

    private calculateMovingAverageSignal(data: any, shortPeriod: number, longPeriod: number): TradeSignal | null {
        // Simplified moving average calculation
        // In practice, you'd implement proper technical analysis

        const price = data.ltp || data.close;
        const symbol = data.symbol;

        if (!price || !symbol) return null;

        // Generate a simple signal based on price movement
        // This is a placeholder - implement actual MA crossover logic
        const action = Math.random() > 0.7 ? (Math.random() > 0.5 ? 'BUY' : 'SELL') : 'HOLD';

        if (action === 'HOLD') return null;

        return {
            id: `signal_${Date.now()}_${Math.random()}`,
            strategy: 'simple_ma',
            symbol,
            action,
            quantity: 1,
            price,
            stopLoss: action === 'BUY' ? price * 0.98 : price * 1.02,
            target: action === 'BUY' ? price * 1.05 : price * 0.95,
            timestamp: new Date(),
            metadata: {
                shortPeriod,
                longPeriod,
                currentPrice: price,
            },
        };
    }

    async getStrategyPerformance(strategyId: string) {
        try {
            const trades = await db.trade.findMany({
                where: { strategyId },
                include: {
                    positions: true,
                },
            });

            const totalTrades = trades.length;
            const completedTrades = trades.filter(t => t.status === 'COMPLETE');
            const winningTrades = completedTrades.filter(t => (t.realizedPnL || 0) > 0);
            const losingTrades = completedTrades.filter(t => (t.realizedPnL || 0) < 0);

            const totalPnL = completedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
            const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;

            return {
                totalTrades,
                completedTrades: completedTrades.length,
                winningTrades: winningTrades.length,
                losingTrades: losingTrades.length,
                winRate,
                totalPnL,
                averagePnL: completedTrades.length > 0 ? totalPnL / completedTrades.length : 0,
            };
        } catch (error) {
            logger.error('Failed to get strategy performance:', error);
            throw error;
        }
    }
} 