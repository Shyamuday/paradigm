import { BaseStrategy } from '../strategy-engine.service';
import {
    StrategyConfig,
    TradeSignal,
    MarketData,
    Position,
<<<<<<< HEAD
    StrategyState,
    StrategyPerformance
} from '../../schemas/strategy.schema';
import { logger } from '../../logger/logger';

export class BreakoutStrategy extends BaseStrategy {
    constructor() {
        super('Breakout Strategy', 'BREAKOUT', '1.0.0',
            'A breakout strategy that identifies and trades breakouts from key support/resistance levels.');
    }

    validateConfig(config: StrategyConfig): boolean {
        const requiredParams = ['lookbackPeriod', 'breakoutThreshold'];
        const hasRequiredParams = requiredParams.every(param =>
            config.parameters && config.parameters[param] !== undefined
        );

        if (!hasRequiredParams) {
            logger.error('BreakoutStrategy: Missing required parameters');
            return false;
        }

        return true;
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (!this.config.parameters) {
            logger.error('BreakoutStrategy: Configuration not initialized');
            return signals;
        }

        const lookbackPeriod = this.config.parameters.lookbackPeriod as number;
        const breakoutThreshold = this.config.parameters.breakoutThreshold as number;

        if (marketData.length < lookbackPeriod) {
            return signals;
        }

        for (let i = lookbackPeriod; i < marketData.length; i++) {
            const currentData = marketData[i];
            if (!currentData) continue;

            const lookbackData = marketData.slice(i - lookbackPeriod, i);
            const resistance = this.calculateResistance(lookbackData);
            const support = this.calculateSupport(lookbackData);
            const currentPrice = currentData.close || 0;

            // Bullish breakout
            if (currentPrice > resistance + breakoutThreshold) {
                const signal: TradeSignal = {
                    id: crypto.randomUUID(),
                    symbol: currentData.symbol,
                    action: 'BUY',
                    side: 'LONG',
                    quantity: 0,
                    price: currentPrice,
                    confidence: 75,
                    timestamp: currentData.timestamp,
                    strategyName: this.name,
                    reasoning: `Price broke above resistance level ${resistance.toFixed(2)}`,
                    metadata: {
                        resistance,
                        support,
                        breakoutType: 'BULLISH'
                    }
                };

                const sizedSignal = { ...signal };
                sizedSignal.quantity = this.calculatePositionSize(signal, 100000);
                const finalSignal = this.applyRiskManagement(sizedSignal);

                signals.push(finalSignal);
            }
            // Bearish breakout
            else if (currentPrice < support - breakoutThreshold) {
                const signal: TradeSignal = {
                    id: crypto.randomUUID(),
                    symbol: currentData.symbol,
                    action: 'SELL',
                    side: 'SHORT',
                    quantity: 0,
                    price: currentPrice,
                    confidence: 75,
                    timestamp: currentData.timestamp,
                    strategyName: this.name,
                    reasoning: `Price broke below support level ${support.toFixed(2)}`,
                    metadata: {
                        resistance,
                        support,
                        breakoutType: 'BEARISH'
                    }
                };

                const sizedSignal = { ...signal };
                sizedSignal.quantity = this.calculatePositionSize(signal, 100000);
                const finalSignal = this.applyRiskManagement(sizedSignal);

                signals.push(finalSignal);
            }
        }

        return signals;
    }

    async shouldExit(position: Position, marketData: MarketData[]): Promise<boolean> {
        if (!this.config.parameters) return false;

        const lookbackPeriod = this.config.parameters.lookbackPeriod as number;
        const breakoutThreshold = this.config.parameters.breakoutThreshold as number;

        if (marketData.length < lookbackPeriod) return false;

        const lookbackData = marketData.slice(-lookbackPeriod);
        const resistance = this.calculateResistance(lookbackData);
        const support = this.calculateSupport(lookbackData);
        const currentPrice = marketData[marketData.length - 1]?.close || 0;

        // Exit long position if price falls below support
        if (position.side === 'LONG' && currentPrice < support - breakoutThreshold) {
            return true;
        }

        // Exit short position if price rises above resistance
        if (position.side === 'SHORT' && currentPrice > resistance + breakoutThreshold) {
=======
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

    async generateSignals(marketData: any[]): Promise<any[]> {
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

        // Convert to base class expected format
        return signals.map(signal => ({
            ...signal,
            side: signal.action === 'BUY' ? 'LONG' : 'SHORT',
            confidence: 0.7,
            strategyName: this.name
        }));
    }

    async shouldExit(position: Position, marketData: any[]): Promise<boolean> {
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
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
            return true;
        }

        return false;
    }

<<<<<<< HEAD
    getState(): StrategyState {
        return this.state;
    }

    getPerformance(): StrategyPerformance {
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
            maxDrawdown: 0,
            sharpeRatio: 0,
            maxConsecutiveLosses: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 0,
            metadata: {}
        };
    }

    private calculateResistance(data: MarketData[]): number {
        return Math.max(...data.map(d => d.high || 0));
    }

    private calculateSupport(data: MarketData[]): number {
        return Math.min(...data.map(d => d.low || 0));
=======
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

    validateConfig(config: any): boolean {
        const baseValid = super.validateConfig(config);
        if (!baseValid) return false;

        // Validate breakout strategy specific parameters
        const { lookbackPeriod, breakoutThreshold, volumeMultiplier, confirmationPeriod } = config.parameters || {};

        if (typeof lookbackPeriod !== 'number' || lookbackPeriod < 5) {
            return false;
        }

        if (typeof breakoutThreshold !== 'number' || breakoutThreshold <= 0 || breakoutThreshold > 0.1) {
            return false;
        }

        if (typeof volumeMultiplier !== 'number' || volumeMultiplier < 1) {
            return false;
        }

        if (typeof confirmationPeriod !== 'number' || confirmationPeriod < 1) {
            return false;
        }

        return true;
>>>>>>> 176e79a3444e6c15f5b39fd914859712a1b50345
    }
} 