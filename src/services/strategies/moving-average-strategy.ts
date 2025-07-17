import { BaseStrategy } from '../strategy-engine.service';
import {
    StrategyConfig,
    TradeSignal,
    MarketData,
    Position,
    StrategyType,
    TechnicalIndicator
} from '../../types';

export class MovingAverageStrategy extends BaseStrategy {
    constructor() {
        super(
            'Moving Average Crossover',
            'TREND_FOLLOWING',
            '1.0.0',
            'Simple moving average crossover strategy for trend following'
        );
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (marketData.length < 50) {
            return signals; // Need enough data for moving averages
        }

        const shortPeriod = this.config.parameters.shortPeriod || 10;
        const longPeriod = this.config.parameters.longPeriod || 20;
        const volumeThreshold = this.config.parameters.volumeThreshold;

        // Calculate moving averages
        const shortMA = this.calculateEMA(marketData, shortPeriod);
        const longMA = this.calculateEMA(marketData, longPeriod);

        // Look for crossovers
        for (let i = 1; i < marketData.length; i++) {
            const currentData = marketData[i];
            const prevData = marketData[i - 1];

            if (!currentData || !prevData) continue;

            const currentShortMA = shortMA[i];
            const currentLongMA = longMA[i];
            const prevShortMA = shortMA[i - 1];
            const prevLongMA = longMA[i - 1];

            if (!currentShortMA || !currentLongMA || !prevShortMA || !prevLongMA) {
                continue;
            }

            // Check volume threshold
            if (volumeThreshold && (!currentData.volume || currentData.volume < volumeThreshold)) {
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
                const signal = this.createSignal(currentData, action, {
                    shortMA: currentShortMA,
                    longMA: currentLongMA,
                    shortPeriod,
                    longPeriod,
                    crossover: currentCrossover
                });

                if (signal) {
                    signals.push(signal);
                }
            }
        }

        return signals;
    }

    async shouldExit(position: Position, marketData: MarketData[]): Promise<boolean> {
        if (marketData.length < 20) return false;

        const shortPeriod = this.config.parameters.shortPeriod || 10;
        const longPeriod = this.config.parameters.longPeriod || 20;

        const shortMA = this.calculateEMA(marketData, shortPeriod);
        const longMA = this.calculateEMA(marketData, longPeriod);

        const currentShortMA = shortMA[shortMA.length - 1];
        const currentLongMA = longMA[longMA.length - 1];

        if (!currentShortMA || !currentLongMA) return false;

        // Exit if trend reverses
        if (position.side === 'LONG' && currentShortMA < currentLongMA) {
            return true;
        }

        if (position.side === 'SHORT' && currentShortMA > currentLongMA) {
            return true;
        }

        return false;
    }

    private calculateEMA(data: MarketData[], period: number): (number | null)[] {
        const ema: (number | null)[] = new Array(data.length).fill(null);
        const multiplier = 2 / (period + 1);

        // Calculate first EMA as SMA
        let sum = 0;
        let validPoints = 0;

        for (let i = 0; i < period && i < data.length; i++) {
            const price = data[i]?.close || data[i]?.ltp;
            if (typeof price === 'number') {
                sum += price;
                validPoints++;
            }
        }

        if (validPoints === period) {
            ema[period - 1] = sum / period;
        }

        // Calculate EMA for remaining points
        for (let i = period; i < data.length; i++) {
            const price = data[i]?.close || data[i]?.ltp;
            const prevEMA = ema[i - 1];

            if (typeof price === 'number' && prevEMA !== null && prevEMA !== undefined) {
                ema[i] = (price * multiplier) + (prevEMA * (1 - multiplier));
            }
        }

        return ema;
    }

    private createSignal(
        data: MarketData,
        action: 'BUY' | 'SELL',
        metadata: any
    ): TradeSignal | null {
        const price = data.close || data.ltp;
        if (!price || !data.symbol) return null;

        return {
            id: `signal_${Date.now()}_${Math.random()}`,
            strategy: this.name,
            symbol: data.symbol,
            action,
            quantity: 1, // Will be calculated by position sizing
            price,
            timestamp: new Date(data.timestamp),
            metadata: {
                ...metadata,
                strategyType: this.type,
                version: this.version
            }
        };
    }

    validateConfig(config: StrategyConfig): boolean {
        const baseValid = super.validateConfig(config);
        if (!baseValid) return false;

        // Validate MA strategy specific parameters
        const { shortPeriod, longPeriod } = config.parameters;

        if (!shortPeriod || !longPeriod) {
            return false;
        }

        if (shortPeriod >= longPeriod) {
            return false;
        }

        if (shortPeriod < 1 || longPeriod < 1) {
            return false;
        }

        return true;
    }
} 