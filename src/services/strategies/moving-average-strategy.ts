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
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];
        if (marketData.length < this.config.longPeriod) {
            return signals;
        }

        const shortMA = this.calculateSMA(marketData, this.config.shortPeriod);
        const longMA = this.calculateSMA(marketData, this.config.longPeriod);

        for (let i = this.config.longPeriod; i < marketData.length; i++) {
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
                if (this.config.volumeThreshold && currentData.volume < this.config.volumeThreshold) {
                    continue;
                }

                const currentCrossover = currentShortMA! - currentLongMA!;
                const previousCrossover = prevShortMA! - prevLongMA!;

                if (previousCrossover <= 0 && currentCrossover > 0) {
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
                }
            }
        }

        return signals;
    }

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
}