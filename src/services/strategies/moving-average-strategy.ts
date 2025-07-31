<<<<<<< HEAD
import { BaseStrategy } from '../strategy-engine.service';
import {
    StrategyConfig,
    TradeSignal,
    MarketData,
    Position,
    StrategyState,
    StrategyPerformance,
    StrategyType
} from '../../schemas/strategy.schema';
import { logger } from '../../logger/logger';
import { enhancedTechnicalIndicators } from '../enhanced-technical-indicators.service';

export class MovingAverageStrategy extends BaseStrategy {
    constructor() {
        super('Moving Average Crossover', 'TREND_FOLLOWING', '1.0.0',
            'A simple moving average crossover strategy that generates buy/sell signals based on short and long period moving average crossovers.');
    }

    validateConfig(config: StrategyConfig): boolean {
        const requiredParams = ['shortPeriod', 'longPeriod'];
        const hasRequiredParams = requiredParams.every(param =>
            config.parameters && config.parameters[param] !== undefined
        );

        if (!hasRequiredParams) {
            logger.error('MovingAverageStrategy: Missing required parameters');
            return false;
        }

        const shortPeriod = config.parameters.shortPeriod as number;
        const longPeriod = config.parameters.longPeriod as number;

        if (shortPeriod >= longPeriod) {
            logger.error('MovingAverageStrategy: Short period must be less than long period');
            return false;
        }

        return true;
=======
import { IStrategy, MarketData, TradeSignal } from './strategy.interface';
import { logger } from '../../logger/logger';

interface MovingAverageConfig {
    shortPeriod: number;
    longPeriod: number;
    volumeThreshold?: number;
}

export class MovingAverageStrategy implements IStrategy {
    public name = 'moving_average';
    public description = 'A simple moving average crossover strategy.';
    private config!: MovingAverageConfig;

    async initialize(config: any): Promise<void> {
        if (!config.shortPeriod || !config.longPeriod) {
            throw new Error('Missing required configuration for MovingAverageStrategy.');
        }
        this.config = config;
        logger.info('MovingAverageStrategy initialized with config:', this.config);
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];
<<<<<<< HEAD

        if (!this.config.parameters) {
            logger.error('MovingAverageStrategy: Configuration not initialized');
            return signals;
        }

        const shortPeriod = this.config.parameters.shortPeriod as number;
        const longPeriod = this.config.parameters.longPeriod as number;
        const volumeThreshold = this.config.parameters.volumeThreshold as number;

        if (marketData.length < longPeriod) {
            return signals;
        }

        const prices = marketData.map(d => d.close || 0).filter(price => price > 0);
        const shortMA = enhancedTechnicalIndicators.calculateSMA(prices, shortPeriod);
        const longMA = enhancedTechnicalIndicators.calculateSMA(prices, longPeriod);

        for (let i = longPeriod; i < marketData.length; i++) {
=======
        if (marketData.length < this.config.longPeriod) {
            return signals;
        }

        const shortMA = this.calculateSMA(marketData, this.config.shortPeriod);
        const longMA = this.calculateSMA(marketData, this.config.longPeriod);

        for (let i = this.config.longPeriod; i < marketData.length; i++) {
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
            const currentData = marketData[i];
            if (!currentData) continue;

            const currentShortMA = shortMA[i];
            const currentLongMA = longMA[i];
            const prevShortMA = shortMA[i - 1];
            const prevLongMA = longMA[i - 1];

            if (
                currentShortMA !== null &&
                currentLongMA !== null &&
                prevShortMA !== null &&
                prevLongMA !== null
            ) {
<<<<<<< HEAD
                if (volumeThreshold && currentData.volume && currentData.volume < volumeThreshold) {
=======
                if (this.config.volumeThreshold && currentData.volume < this.config.volumeThreshold) {
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
                    continue;
                }

                const currentCrossover = currentShortMA! - currentLongMA!;
                const previousCrossover = prevShortMA! - prevLongMA!;

                if (previousCrossover <= 0 && currentCrossover > 0) {
<<<<<<< HEAD
                    const signal: TradeSignal = {
                        id: crypto.randomUUID(),
                        symbol: currentData.symbol,
                        action: 'BUY',
                        side: 'LONG',
                        quantity: 0, // Will be calculated by position sizing
                        price: currentData.close || 0,
                        confidence: 70,
                        timestamp: currentData.timestamp,
                        strategyName: this.name,
                        reasoning: `Short MA (${currentShortMA!.toFixed(2)}) crossed above Long MA (${currentLongMA!.toFixed(2)})`,
                        metadata: {
                            shortMA: currentShortMA!,
                            longMA: currentLongMA!,
                            crossover: currentCrossover
                        }
                    };

                    // Apply position sizing and risk management
                    const sizedSignal = { ...signal };
                    sizedSignal.quantity = this.calculatePositionSize(signal, 100000);
                    const finalSignal = this.applyRiskManagement(sizedSignal);

                    signals.push(finalSignal);
                } else if (previousCrossover >= 0 && currentCrossover < 0) {
                    const signal: TradeSignal = {
                        id: crypto.randomUUID(),
                        symbol: currentData.symbol,
                        action: 'SELL',
                        side: 'SHORT',
                        quantity: 0, // Will be calculated by position sizing
                        price: currentData.close || 0,
                        confidence: 70,
                        timestamp: currentData.timestamp,
                        strategyName: this.name,
                        reasoning: `Short MA (${currentShortMA!.toFixed(2)}) crossed below Long MA (${currentLongMA!.toFixed(2)})`,
                        metadata: {
                            shortMA: currentShortMA!,
                            longMA: currentLongMA!,
                            crossover: currentCrossover
                        }
                    };

                    // Apply position sizing and risk management
                    const sizedSignal = { ...signal };
                    sizedSignal.quantity = this.calculatePositionSize(signal, 100000);
                    const finalSignal = this.applyRiskManagement(sizedSignal);

                    signals.push(finalSignal);
=======
                    signals.push({
                        symbol: currentData.symbol,
                        action: 'BUY',
                        price: currentData.close,
                        timestamp: currentData.timestamp,
                        strategy: this.name,
                        metadata: {
                            shortMA: currentShortMA,
                            longMA: currentLongMA,
                        },
                    });
                } else if (previousCrossover >= 0 && currentCrossover < 0) {
                    signals.push({
                        symbol: currentData.symbol,
                        action: 'SELL',
                        price: currentData.close,
                        timestamp: currentData.timestamp,
                        strategy: this.name,
                        metadata: {
                            shortMA: currentShortMA,
                            longMA: currentLongMA,
                        },
                    });
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
                }
            }
        }

        return signals;
    }

<<<<<<< HEAD
    async shouldExit(position: Position, marketData: MarketData[]): Promise<boolean> {
        if (!this.config.parameters) return false;

        const shortPeriod = this.config.parameters.shortPeriod as number;
        const longPeriod = this.config.parameters.longPeriod as number;

        if (marketData.length < longPeriod) return false;

        const prices = marketData.map(d => d.close || 0).filter(price => price > 0);
        const shortMA = enhancedTechnicalIndicators.calculateSMA(prices, shortPeriod);
        const longMA = enhancedTechnicalIndicators.calculateSMA(prices, longPeriod);

        const currentShortMA = shortMA[shortMA.length - 1];
        const currentLongMA = longMA[longMA.length - 1];

        if (currentShortMA === null || currentLongMA === null) return false;

        // Exit long position if short MA crosses below long MA
        if (position.side === 'LONG' && currentShortMA! < currentLongMA!) {
            return true;
        }

        // Exit short position if short MA crosses above long MA
        if (position.side === 'SHORT' && currentShortMA! > currentLongMA!) {
            return true;
        }

        return false;
    }

    getState(): StrategyState {
        return this.state;
    }

    getPerformance(): StrategyPerformance {
        // Calculate performance metrics based on state
        const totalTrades = this.state.totalSignals;
        const winningTrades = this.state.successfulSignals;
        const losingTrades = this.state.failedSignals;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            totalPnL: this.state.totalPnL,
            maxDrawdown: 0, // Calculate from historical data
            sharpeRatio: 0, // Calculate from historical data
            maxConsecutiveLosses: 0, // Calculate from historical data
            averageWin: 0, // Calculate from historical data
            averageLoss: 0, // Calculate from historical data
            profitFactor: 0, // Calculate from historical data
            metadata: {}
        };
    }

    // Using centralized technical indicator service instead of local calculation
=======
    private calculateSMA(data: MarketData[], period: number): (number | null)[] {
        const sma: (number | null)[] = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                sma.push(null);
                continue;
            }
            const slice = data.slice(i - period + 1, i + 1);
            const sum = slice.reduce((acc, val) => acc + val.close, 0);
            sma.push(sum / period);
        }
        return sma;
    }
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
}