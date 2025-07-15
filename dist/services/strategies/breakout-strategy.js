"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreakoutStrategy = void 0;
const strategy_engine_service_1 = require("../strategy-engine.service");
class BreakoutStrategy extends strategy_engine_service_1.BaseStrategy {
    constructor() {
        super('Breakout Strategy', 'BREAKOUT', '1.0.0', 'Detects breakouts from support and resistance levels');
    }
    async generateSignals(marketData) {
        const signals = [];
        if (marketData.length < 50) {
            return signals;
        }
        const lookbackPeriod = this.config.parameters.lookbackPeriod || 20;
        const breakoutThreshold = this.config.parameters.breakoutThreshold || 0.02;
        const volumeMultiplier = this.config.parameters.volumeMultiplier || 1.5;
        const confirmationPeriod = this.config.parameters.confirmationPeriod || 2;
        const levels = this.calculateSupportResistanceLevels(marketData, lookbackPeriod);
        for (let i = lookbackPeriod + confirmationPeriod; i < marketData.length; i++) {
            const currentData = marketData[i];
            if (!currentData)
                continue;
            const currentPrice = currentData.close || currentData.ltp;
            if (!currentPrice)
                continue;
            const resistanceBreakout = this.checkResistanceBreakout(currentPrice, levels.resistance, breakoutThreshold, marketData.slice(i - confirmationPeriod, i), volumeMultiplier);
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
            const supportBreakdown = this.checkSupportBreakdown(currentPrice, levels.support, breakoutThreshold, marketData.slice(i - confirmationPeriod, i), volumeMultiplier);
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
    async shouldExit(position, marketData) {
        if (marketData.length < 20)
            return false;
        const lookbackPeriod = this.config.parameters.lookbackPeriod || 20;
        const levels = this.calculateSupportResistanceLevels(marketData, lookbackPeriod);
        const currentPrice = marketData[marketData.length - 1]?.close || marketData[marketData.length - 1]?.ltp;
        if (!currentPrice)
            return false;
        if (position.side === 'LONG' && currentPrice < levels.resistance) {
            return true;
        }
        if (position.side === 'SHORT' && currentPrice > levels.support) {
            return true;
        }
        return false;
    }
    calculateSupportResistanceLevels(data, period) {
        const recentData = data.slice(-period);
        let high = -Infinity;
        let low = Infinity;
        for (const candle of recentData) {
            const candleHigh = candle.high || candle.close || candle.ltp || 0;
            const candleLow = candle.low || candle.close || candle.ltp || 0;
            if (candleHigh > high)
                high = candleHigh;
            if (candleLow < low)
                low = candleLow;
        }
        return {
            resistance: high,
            support: low
        };
    }
    checkResistanceBreakout(currentPrice, resistanceLevel, threshold, confirmationData, volumeMultiplier) {
        if (currentPrice <= resistanceLevel * (1 + threshold)) {
            return false;
        }
        const confirmedBreakout = confirmationData.every(candle => {
            const price = candle.close || candle.ltp;
            return price && price > resistanceLevel;
        });
        if (!confirmedBreakout) {
            return false;
        }
        const avgVolume = this.calculateAverageVolume(confirmationData);
        const currentVolume = confirmationData[confirmationData.length - 1]?.volume || 0;
        return currentVolume > avgVolume * volumeMultiplier;
    }
    checkSupportBreakdown(currentPrice, supportLevel, threshold, confirmationData, volumeMultiplier) {
        if (currentPrice >= supportLevel * (1 - threshold)) {
            return false;
        }
        const confirmedBreakdown = confirmationData.every(candle => {
            const price = candle.close || candle.ltp;
            return price && price < supportLevel;
        });
        if (!confirmedBreakdown) {
            return false;
        }
        const avgVolume = this.calculateAverageVolume(confirmationData);
        const currentVolume = confirmationData[confirmationData.length - 1]?.volume || 0;
        return currentVolume > avgVolume * volumeMultiplier;
    }
    calculateAverageVolume(data) {
        const volumes = data.map(candle => candle.volume || 0).filter(v => v > 0);
        if (volumes.length === 0)
            return 0;
        const sum = volumes.reduce((acc, vol) => acc + vol, 0);
        return sum / volumes.length;
    }
    createSignal(data, action, metadata) {
        const price = data.close || data.ltp;
        if (!price || !data.symbol)
            return null;
        return {
            id: `signal_${Date.now()}_${Math.random()}`,
            strategy: this.name,
            symbol: data.symbol,
            action,
            quantity: 1,
            price,
            timestamp: new Date(data.timestamp),
            metadata: {
                ...metadata,
                strategyType: this.type,
                version: this.version
            }
        };
    }
    validateConfig(config) {
        const baseValid = super.validateConfig(config);
        if (!baseValid)
            return false;
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
exports.BreakoutStrategy = BreakoutStrategy;
//# sourceMappingURL=breakout-strategy.js.map