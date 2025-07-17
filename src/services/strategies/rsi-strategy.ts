import { IStrategy, MarketData, TradeSignal } from './strategy.interface';
import { logger } from '../../logger/logger';

interface RsiConfig {
    period: number;
    overbought: number;
    oversold: number;
}

export class RsiStrategy implements IStrategy {
    public name = 'rsi';
    public description = 'A Relative Strength Index (RSI) based strategy.';
    private config!: RsiConfig;

    async initialize(config: any): Promise<void> {
        if (!config.period || !config.overbought || !config.oversold) {
            throw new Error('Missing required configuration for RsiStrategy.');
        }
        this.config = config;
        logger.info('RsiStrategy initialized with config:', this.config);
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];
        if (marketData.length < this.config.period) {
            return signals;
        }

        const rsiValues = this.calculateRSI(marketData, this.config.period);

        for (let i = this.config.period; i < marketData.length; i++) {
            const currentData = marketData[i];
            if (!currentData) continue;

            const currentRsi = rsiValues[i];
            const prevRsi = rsiValues[i - 1];

            if (currentRsi !== null && prevRsi !== null) {
                if (prevRsi! <= this.config.oversold && currentRsi! > this.config.oversold) {
                    signals.push({
                        symbol: currentData.symbol,
                        action: 'BUY',
                        price: currentData.close,
                        timestamp: currentData.timestamp,
                        strategy: this.name,
                        metadata: {
                            rsi: currentRsi,
                        },
                    });
                } else if (prevRsi! >= this.config.overbought && currentRsi! < this.config.overbought) {
                    signals.push({
                        symbol: currentData.symbol,
                        action: 'SELL',
                        price: currentData.close,
                        timestamp: currentData.timestamp,
                        strategy: this.name,
                        metadata: {
                            rsi: currentRsi,
                        },
                    });
                }
            }
        }

        return signals;
    }

    private calculateRSI(data: MarketData[], period: number): (number | null)[] {
        const rsi: (number | null)[] = [];
        for (let i = 0; i < data.length; i++) {
            rsi.push(null);
        }

        let gains = 0;
        let losses = 0;

        // Calculate initial average gain and loss
        for (let i = 1; i <= period; i++) {
            const current = data[i];
            const previous = data[i - 1];
            if (!current || !previous) continue;
            const change = current.close - previous.close;
            if (change > 0) {
                gains += change;
            } else {
                losses -= change;
            }
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        if (avgLoss === 0) {
            rsi[period] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsi[period] = 100 - (100 / (1 + rs));
        }

        // Calculate subsequent RSI values
        for (let i = period + 1; i < data.length; i++) {
            const current = data[i];
            const previous = data[i - 1];
            if (!current || !previous) continue;
            const change = current.close - previous.close;
            let currentGain = 0;
            let currentLoss = 0;

            if (change > 0) {
                currentGain = change;
            } else {
                currentLoss = -change;
            }

            avgGain = (avgGain * (period - 1) + currentGain) / period;
            avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

            if (avgLoss === 0) {
                rsi[i] = 100;
            } else {
                const rs = avgGain / avgLoss;
                rsi[i] = 100 - (100 / (1 + rs));
            }
        }

        return rsi;
    }
}