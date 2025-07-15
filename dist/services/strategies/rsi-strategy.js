"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RSIStrategy = void 0;
const strategy_engine_service_1 = require("../strategy-engine.service");
class RSIStrategy extends strategy_engine_service_1.BaseStrategy {
    constructor() {
        super('RSI Mean Reversion', 'MEAN_REVERSION', '1.0.0', 'RSI-based mean reversion strategy for oversold/overbought conditions');
    }
    async generateSignals(marketData) {
        const signals = [];
        if (marketData.length < 30) {
            return signals;
        }
        const period = this.config.parameters.period || 14;
        const oversoldThreshold = this.config.parameters.oversoldThreshold || 30;
        const overboughtThreshold = this.config.parameters.overboughtThreshold || 70;
        const volumeThreshold = this.config.parameters.volumeThreshold;
        const rsiValues = this.calculateRSIArray(marketData, period);
        for (let i = 1; i < marketData.length; i++) {
            const currentData = marketData[i];
            const prevData = marketData[i - 1];
            if (!currentData || !prevData)
                continue;
            const currentRSI = rsiValues[i];
            const prevRSI = rsiValues[i - 1];
            if (currentRSI === null || prevRSI === null || currentRSI === undefined || prevRSI === undefined)
                continue;
            if (volumeThreshold && (!currentData.volume || currentData.volume < volumeThreshold)) {
                continue;
            }
            let action = 'HOLD';
            if (prevRSI <= oversoldThreshold && currentRSI > oversoldThreshold) {
                action = 'BUY';
            }
            else if (prevRSI >= overboughtThreshold && currentRSI < overboughtThreshold) {
                action = 'SELL';
            }
            if (action !== 'HOLD') {
                const signal = this.createSignal(currentData, action, {
                    rsi: currentRSI,
                    period,
                    oversoldThreshold,
                    overboughtThreshold,
                    condition: action === 'BUY' ? 'oversold' : 'overbought'
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
        const period = this.config.parameters.period || 14;
        const oversoldThreshold = this.config.parameters.oversoldThreshold || 30;
        const overboughtThreshold = this.config.parameters.overboughtThreshold || 70;
        const rsiValues = this.calculateRSIArray(marketData, period);
        const currentRSI = rsiValues[rsiValues.length - 1];
        if (currentRSI === null || currentRSI === undefined)
            return false;
        if (position.side === 'LONG' && currentRSI >= overboughtThreshold) {
            return true;
        }
        if (position.side === 'SHORT' && currentRSI <= oversoldThreshold) {
            return true;
        }
        return false;
    }
    calculateRSIArray(data, period) {
        const rsi = new Array(data.length).fill(null);
        if (data.length < period + 1)
            return rsi;
        let gains = 0;
        let losses = 0;
        for (let i = 1; i <= period; i++) {
            const change = (data[i]?.close || data[i]?.ltp || 0) - (data[i - 1]?.close || data[i - 1]?.ltp || 0);
            if (change > 0)
                gains += change;
            else
                losses -= change;
        }
        let avgGain = gains / period;
        let avgLoss = losses / period;
        if (avgLoss === 0) {
            rsi[period] = 100;
        }
        else {
            const rs = avgGain / avgLoss;
            rsi[period] = 100 - (100 / (1 + rs));
        }
        for (let i = period + 1; i < data.length; i++) {
            const change = (data[i]?.close || data[i]?.ltp || 0) - (data[i - 1]?.close || data[i - 1]?.ltp || 0);
            let currentGain = 0;
            let currentLoss = 0;
            if (change > 0)
                currentGain = change;
            else
                currentLoss = -change;
            avgGain = (avgGain * (period - 1) + currentGain) / period;
            avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
            if (avgLoss === 0) {
                rsi[i] = 100;
            }
            else {
                const rs = avgGain / avgLoss;
                rsi[i] = 100 - (100 / (1 + rs));
            }
        }
        return rsi;
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
        const { period, oversoldThreshold, overboughtThreshold } = config.parameters;
        if (!period || period < 1) {
            return false;
        }
        if (!oversoldThreshold || oversoldThreshold < 0 || oversoldThreshold > 100) {
            return false;
        }
        if (!overboughtThreshold || overboughtThreshold < 0 || overboughtThreshold > 100) {
            return false;
        }
        if (oversoldThreshold >= overboughtThreshold) {
            return false;
        }
        return true;
    }
}
exports.RSIStrategy = RSIStrategy;
//# sourceMappingURL=rsi-strategy.js.map