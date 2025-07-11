import { db } from '../database/database';
import { logger } from '../logger/logger';
import { StrategyConfig, TradeSignal, StrategyResult } from '../types';

interface MovingAverageConfig {
    shortPeriod: number;
    longPeriod: number;
    volumeThreshold?: number;
}

interface MarketDataPoint {
    symbol: string;
    timestamp: string | Date;
    close?: number;
    ltp?: number;
    high?: number;
    low?: number;
    volume?: number;
}

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

    private async generateSignals(strategy: any, marketData: MarketDataPoint[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (strategy.name === 'simple_ma') {
            const config = strategy.config as StrategyConfig;
            const maConfig: MovingAverageConfig = {
                shortPeriod: config.parameters?.shortPeriod || 10,
                longPeriod: config.parameters?.longPeriod || 20,
                volumeThreshold: config.parameters?.volumeThreshold
            };

            // Calculate moving averages for the entire dataset
            const shortMA = this.calculateSMA(marketData, maConfig.shortPeriod);
            const longMA = this.calculateSMA(marketData, maConfig.longPeriod);

            // Look for crossovers
            for (let i = 1; i < marketData.length; i++) {
                const currentData = marketData[i];
                const prevData = marketData[i - 1];

                if (!currentData || !prevData) continue;

                const currentShortMA = shortMA[i];
                const currentLongMA = longMA[i];
                const prevShortMA = shortMA[i - 1];
                const prevLongMA = longMA[i - 1];

                // Skip if we don't have enough data points or required data
                if (!currentShortMA || !currentLongMA || !prevShortMA || !prevLongMA || !currentData.symbol) {
                    continue;
                }

                // Check for volume threshold if configured
                if (maConfig.volumeThreshold && (!currentData.volume || currentData.volume < maConfig.volumeThreshold)) {
                    continue;
                }

                // Detect crossovers
                const currentCrossover = currentShortMA - currentLongMA;
                const previousCrossover = prevShortMA - prevLongMA;

                let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

                // Golden Cross (Short MA crosses above Long MA)
                if (previousCrossover <= 0 && currentCrossover > 0) {
                    action = 'BUY';
                }
                // Death Cross (Short MA crosses below Long MA)
                else if (previousCrossover >= 0 && currentCrossover < 0) {
                    action = 'SELL';
                }

                if (action !== 'HOLD') {
                    const signal = this.createSignal(
                        currentData,
                        action,
                        {
                            shortMA: currentShortMA,
                            longMA: currentLongMA,
                            shortPeriod: maConfig.shortPeriod,
                            longPeriod: maConfig.longPeriod
                        }
                    );
                    if (signal) {
                        signals.push(signal);
                    }
                }
            }
        }

        return signals;
    }

    private calculateSMA(data: MarketDataPoint[], period: number): (number | null)[] {
        const sma: (number | null)[] = new Array(data.length).fill(null);
        let sum = 0;
        let validPoints = 0;

        // Calculate first SMA
        for (let i = 0; i < data.length; i++) {
            const price = data[i].close || data[i].ltp;
            if (typeof price !== 'number') continue;

            sum += price;
            validPoints++;

            if (i >= period - 1 && validPoints >= period) {
                sma[i] = sum / period;
                const oldDataPoint = data[i - (period - 1)];
                if (oldDataPoint) {
                    const oldPrice = oldDataPoint.close || oldDataPoint.ltp;
                    if (typeof oldPrice === 'number') {
                        sum -= oldPrice;
                        validPoints--;
                    }
                }
            }
        }

        return sma;
    }

    private createSignal(
        data: MarketDataPoint,
        action: 'BUY' | 'SELL',
        metadata: {
            shortMA: number;
            longMA: number;
            shortPeriod: number;
            longPeriod: number;
        }
    ): TradeSignal | null {
        const price = data.close || data.ltp;
        if (!price || !data.symbol) return null;

        const atr = this.calculateATR(data);
        if (!atr) return null;

        // Calculate stop loss and target based on ATR
        const stopLossMultiplier = 2;
        const targetMultiplier = 3;
        const stopLoss = action === 'BUY'
            ? price - (atr * stopLossMultiplier)
            : price + (atr * stopLossMultiplier);

        const target = action === 'BUY'
            ? price + (atr * targetMultiplier)
            : price - (atr * targetMultiplier);

        return {
            id: `signal_${Date.now()}_${Math.random()}`,
            strategy: 'simple_ma',
            symbol: data.symbol,
            action,
            quantity: 1, // This should be calculated based on position sizing rules
            price,
            stopLoss,
            target,
            timestamp: new Date(data.timestamp),
            metadata: {
                ...metadata,
                atr,
                currentPrice: price
            }
        };
    }

    private calculateATR(data: MarketDataPoint, period: number = 14): number | null {
        const high = data.high;
        const low = data.low;
        const close = data.close || data.ltp;

        if (typeof high !== 'number' || typeof low !== 'number' || typeof close !== 'number') {
            return null;
        }

        // Simplified ATR calculation
        const tr = Math.max(
            high - low,
            Math.abs(high - close),
            Math.abs(low - close)
        );

        return tr;
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