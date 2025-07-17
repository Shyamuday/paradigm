import { BaseStrategy } from '../strategy-engine.service';
import {
    StrategyConfig,
    TradeSignal,
    MarketData,
    Position,
    StrategyType
} from '../../types';

export class BreakoutStrategy extends BaseStrategy {
    constructor() {
        super(
            'Breakout Strategy',
            'BREAKOUT',
            '1.0.0',
            'Detects breakouts from support and resistance levels'
        );
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (marketData.length < 50) {
            return signals; // Need enough data for breakout detection
        }

        const lookbackPeriod = this.config.parameters.lookbackPeriod || 20;
        const breakoutThreshold = this.config.parameters.breakoutThreshold || 0.02; // 2%
        const volumeMultiplier = this.config.parameters.volumeMultiplier || 1.5;
        const confirmationPeriod = this.config.parameters.confirmationPeriod || 2;

        // Calculate support and resistance levels
        const levels = this.calculateSupportResistanceLevels(marketData, lookbackPeriod);

        // Look for breakouts
        for (let i = lookbackPeriod + confirmationPeriod; i < marketData.length; i++) {
            const currentData = marketData[i];
            if (!currentData) continue;

            const currentPrice = currentData.close || currentData.ltp;
            if (!currentPrice) continue;

            // Check for resistance breakout (BUY signal)
            const resistanceBreakout = this.checkResistanceBreakout(
                currentPrice,
                levels.resistance,
                breakoutThreshold,
                marketData.slice(i - confirmationPeriod, i),
                volumeMultiplier
            );

            if (resistanceBreakout) {
                const signal = this.createSignal(currentData, 'BUY', {
                    breakoutType: 'resistance',
                    breakoutPrice: currentPrice,
                    resistanceLevel: levels.resistance,
                    volume: currentData.volume,
                    confirmationPeriod
                });

                if (signal) {
                    signals.push(signal);
                }
            }

            // Check for support breakdown (SELL signal)
            const supportBreakdown = this.checkSupportBreakdown(
                currentPrice,
                levels.support,
                breakoutThreshold,
                marketData.slice(i - confirmationPeriod, i),
                volumeMultiplier
            );

            if (supportBreakdown) {
                const signal = this.createSignal(currentData, 'SELL', {
                    breakoutType: 'support',
                    breakoutPrice: currentPrice,
                    supportLevel: levels.support,
                    volume: currentData.volume,
                    confirmationPeriod
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

        const lookbackPeriod = this.config.parameters.lookbackPeriod || 20;
        const levels = this.calculateSupportResistanceLevels(marketData, lookbackPeriod);
        const currentPrice = marketData[marketData.length - 1]?.close || marketData[marketData.length - 1]?.ltp;

        if (!currentPrice) return false;

        // Exit long position if price falls back below resistance
        if (position.side === 'LONG' && currentPrice < levels.resistance) {
            return true;
        }

        // Exit short position if price rises back above support
        if (position.side === 'SHORT' && currentPrice > levels.support) {
            return true;
        }

        return false;
    }

    private calculateSupportResistanceLevels(data: MarketData[], period: number): { support: number; resistance: number } {
        const recentData = data.slice(-period);

        let high = -Infinity;
        let low = Infinity;

        for (const candle of recentData) {
            const candleHigh = candle.high || candle.close || candle.ltp || 0;
            const candleLow = candle.low || candle.close || candle.ltp || 0;

            if (candleHigh > high) high = candleHigh;
            if (candleLow < low) low = candleLow;
        }

        return {
            resistance: high,
            support: low
        };
    }

    private checkResistanceBreakout(
        currentPrice: number,
        resistanceLevel: number,
        threshold: number,
        confirmationData: MarketData[],
        volumeMultiplier: number
    ): boolean {
        // Check if price broke above resistance with sufficient margin
        if (currentPrice <= resistanceLevel * (1 + threshold)) {
            return false;
        }

        // Check if breakout is confirmed over multiple periods
        const confirmedBreakout = confirmationData.every(candle => {
            const price = candle.close || candle.ltp;
            return price && price > resistanceLevel;
        });

        if (!confirmedBreakout) {
            return false;
        }

        // Check for volume confirmation
        const avgVolume = this.calculateAverageVolume(confirmationData);
        const currentVolume = confirmationData[confirmationData.length - 1]?.volume || 0;

        return currentVolume > avgVolume * volumeMultiplier;
    }

    private checkSupportBreakdown(
        currentPrice: number,
        supportLevel: number,
        threshold: number,
        confirmationData: MarketData[],
        volumeMultiplier: number
    ): boolean {
        // Check if price broke below support with sufficient margin
        if (currentPrice >= supportLevel * (1 - threshold)) {
            return false;
        }

        // Check if breakdown is confirmed over multiple periods
        const confirmedBreakdown = confirmationData.every(candle => {
            const price = candle.close || candle.ltp;
            return price && price < supportLevel;
        });

        if (!confirmedBreakdown) {
            return false;
        }

        // Check for volume confirmation
        const avgVolume = this.calculateAverageVolume(confirmationData);
        const currentVolume = confirmationData[confirmationData.length - 1]?.volume || 0;

        return currentVolume > avgVolume * volumeMultiplier;
    }

    private calculateAverageVolume(data: MarketData[]): number {
        const volumes = data.map(candle => candle.volume || 0).filter(v => v > 0);
        if (volumes.length === 0) return 0;

        const sum = volumes.reduce((acc, vol) => acc + vol, 0);
        return sum / volumes.length;
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

        // Validate breakout strategy specific parameters
        const { lookbackPeriod, breakoutThreshold, volumeMultiplier, confirmationPeriod } = config.parameters;

        if (!lookbackPeriod || lookbackPeriod < 5) {
            return false;
        }

        if (!breakoutThreshold || breakoutThreshold <= 0 || breakoutThreshold > 0.1) {
            return false;
        }

        if (!volumeMultiplier || volumeMultiplier < 1) {
            return false;
        }

        if (!confirmationPeriod || confirmationPeriod < 1) {
            return false;
        }

        return true;
    }
} 