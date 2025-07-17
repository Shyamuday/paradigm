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
            const strategy = await db.create('Strategy', {
                id: `strategy_${Date.now()}`,
                name: config.name,
                description: config.description || null,
                isActive: config.enabled,
                config: config as any,
                createdAt: new Date(),
                updatedAt: new Date()
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
            const strategy = await db.findUnique('Strategy', { id: strategyId });
            return strategy;
        } catch (error) {
            logger.error('Failed to get strategy:', error);
            throw error;
        }
    }

    async getStrategyByName(name: string) {
        try {
            const strategy = await db.findUnique('Strategy', { name });
            return strategy;
        } catch (error) {
            logger.error('Failed to get strategy by name:', error);
            throw error;
        }
    }

    async getAllStrategies() {
        try {
            const strategies = await db.findMany('Strategy', {
                orderBy: { name: 'asc' }
            });
            return strategies;
        } catch (error) {
            logger.error('Failed to get all strategies:', error);
            throw error;
        }
    }

    async getActiveStrategies() {
        try {
            const strategies = await db.findMany('Strategy', {
                where: { isActive: true },
                orderBy: { name: 'asc' }
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
            updateData.updatedAt = new Date();

            const strategy = await db.update('Strategy', { id: strategyId }, updateData);

            logger.info('Strategy updated:', strategy.name);
            return strategy;
        } catch (error) {
            logger.error('Failed to update strategy:', error);
            throw error;
        }
    }

    async toggleStrategy(strategyId: string, enabled: boolean) {
        try {
            const strategy = await db.update('Strategy',
                { id: strategyId },
                { isActive: enabled, updatedAt: new Date() }
            );

            logger.info('Strategy toggled:', strategy.name, enabled ? 'enabled' : 'disabled');
            return strategy;
        } catch (error) {
            logger.error('Failed to toggle strategy:', error);
            throw error;
        }
    }

    async deleteStrategy(strategyId: string) {
        try {
            const strategy = await db.delete('Strategy', { id: strategyId });
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

        try {
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
        } catch (error) {
            logger.error('Error generating signals:', error);
        }

        return signals;
    }

    private calculateSMA(data: MarketDataPoint[], period: number): number[] {
        const sma: number[] = [];

        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                sma.push(0); // Not enough data points
                continue;
            }

            let sum = 0;
            for (let j = i - period + 1; j <= i; j++) {
                const price = data[j].close || data[j].ltp || 0;
                sum += price;
            }
            sma.push(sum / period);
        }

        return sma;
    }

    private createSignal(
        marketData: MarketDataPoint,
        action: 'BUY' | 'SELL',
        metadata: any
    ): TradeSignal | null {
        try {
            const price = marketData.close || marketData.ltp;
            if (!price || !marketData.symbol) {
                return null;
            }

            return {
                id: `signal_${Date.now()}_${Math.random()}`,
                strategy: 'MovingAverage',
                symbol: marketData.symbol,
                action,
                quantity: 1, // Default quantity
                price,
                timestamp: new Date(marketData.timestamp),
                metadata
            };
        } catch (error) {
            logger.error('Error creating signal:', error);
            return null;
        }
    }
} 