import { BaseStrategy } from '../strategy-engine.service';
import {
    StrategyConfig,
    TradeSignal as SchemaTradeSignal,
    MarketData as SchemaMarketData,
    Position as SchemaPosition,
    StrategyType
} from '../../schemas/strategy.schema';
import { TradeSignal, MarketData, Position } from '../../types';

function ensureNumber(val: unknown): number {
    return typeof val === 'number' && !isNaN(val) ? val : 0;
}

function toSchemaMarketDataArray(data: MarketData[]): SchemaMarketData[] {
    return data.map(d => ({
        symbol: d.symbol,
        timestamp: d.timestamp,
        open: d.open ?? 0,
        high: d.high ?? 0,
        low: d.low ?? 0,
        close: d.close ?? 0,
        volume: d.volume ?? 0
        // oi is optional and not present on internal MarketData
    }));
}

export class EnhancedMomentumStrategy extends BaseStrategy {
    private priceHistory: Map<string, number[]> = new Map();
    private volumeHistory: Map<string, number[]> = new Map();
    private indicatorCache: Map<string, any> = new Map();

    constructor() {
        super(
            'Enhanced Momentum Strategy',
            'MOMENTUM',
            '2.0.0',
            'Advanced momentum strategy with multiple technical indicators and sophisticated risk management'
        );
    }

    async generateSignals(marketData: SchemaMarketData[]): Promise<SchemaTradeSignal[]> {
        // Convert schema MarketData to internal MarketData if needed
        const internalData: MarketData[] = marketData as unknown as MarketData[];
        const signals: SchemaTradeSignal[] = [];

        if (internalData.length < 100) {
            return signals;
        }

        // Strategy parameters
        const rsiPeriod = this.config.parameters.rsiPeriod || 14;
        const macdFast = this.config.parameters.macdFast || 12;
        const macdSlow = this.config.parameters.macdSlow || 26;
        const adxPeriod = this.config.parameters.adxPeriod || 14;
        const bbPeriod = this.config.parameters.bbPeriod || 20;
        const bbStdDev = this.config.parameters.bbStdDev || 2;
        const volumeMultiplier = this.config.parameters.volumeMultiplier || 1.5;
        const momentumPeriod = this.config.parameters.momentumPeriod || 10;

        // Calculate all technical indicators
        const schemaData = toSchemaMarketDataArray(internalData);
        const rsi = this.calculateRSI(schemaData, rsiPeriod);
        const macd = this.calculateMACD(schemaData, macdFast, macdSlow);
        const adxArr = this.calculateADX(schemaData as any, adxPeriod);
        const adx = Array.isArray(adxArr) ? (adxArr.length > 0 ? adxArr[adxArr.length - 1] : 0) : (typeof adxArr === 'number' ? adxArr : 0);
        const bbArr = this.calculateBollingerBands(schemaData as any, bbPeriod, bbStdDev);
        const bb = Array.isArray(bbArr) ? (bbArr.length > 0 ? bbArr[bbArr.length - 1] : { upper: 0, middle: 0, lower: 0 }) : (bbArr ?? { upper: 0, middle: 0, lower: 0 });
        const momentumArr = this.calculateMomentum(schemaData as any, momentumPeriod);
        const momentum = ensureNumber(Array.isArray(momentumArr) ? (momentumArr.length > 0 ? momentumArr[momentumArr.length - 1] : 0) : (typeof momentumArr === 'number' ? momentumArr : 0));
        const volumeProfileArr = this.calculateVolumeProfile(schemaData as any, 20);
        const volumeProfile = Array.isArray(volumeProfileArr) ? (volumeProfileArr.length > 0 ? volumeProfileArr[volumeProfileArr.length - 1] : { aboveAverage: false, increasing: false, average: 0 }) : (volumeProfileArr ?? { aboveAverage: false, increasing: false, average: 0 });

        for (let i = Math.max(100, adxPeriod + 10); i < internalData.length; i++) {
            const currentData = internalData[i];
            const prevData = internalData[i - 1];
            if (!currentData || !prevData) continue;
            const currentPrice = currentData.close ?? currentData.ltp ?? 0;
            const prevPrice = prevData.close ?? prevData.ltp ?? 0;
            if (currentPrice === undefined || prevPrice === undefined) continue;

            // Get indicator values
            const currentRSI = rsi;
            const prevRSI = rsi;
            const currentMACD = macd;
            const prevMACD = macd;
            const currentADX = adx;
            const currentBB = bb;
            const currentMomentum = Number(momentum) || 0;
            const currentVolumeProfile = volumeProfile;

            if (!this.isValidIndicatorSet(currentRSI, currentMACD, currentADX, currentBB, currentMomentum)) {
                continue;
            }

            // LONG SIGNAL CONDITIONS
            // fallbackMarketData is no longer needed since schema allows nulls
            const longConditions = this.checkLongConditions(
                Number(currentPrice) || 0, Number(prevPrice) || 0,
                Number(currentRSI) || 0, Number(prevRSI) || 0,
                Number(currentMACD) || 0, Number(prevMACD) || 0,
                Number(currentADX) || 0,
                currentBB || { upper: 0, middle: 0, lower: 0 },
                momentum,
                currentVolumeProfile || { aboveAverage: false, increasing: false, average: 0 },
                currentData || { symbol: '', timestamp: new Date(), open: null, high: null, low: null, close: null, volume: null }
            );

            if (longConditions.valid) {
                const signal = this.createAdvancedSignal(currentData, 'BUY', longConditions.strength, longConditions.metadata);
                if (signal) signals.push(signal as unknown as SchemaTradeSignal);
            }

            // SHORT SIGNAL CONDITIONS
            // fallbackMarketData is no longer needed since schema allows nulls
            const shortConditions = this.checkShortConditions(
                currentPrice ?? 0, prevPrice ?? 0,
                currentRSI ?? 0, prevRSI ?? 0,
                currentMACD ?? 0, prevMACD ?? 0,
                currentADX ?? 0,
                currentBB ?? { upper: 0, middle: 0, lower: 0 },
                momentum,
                currentVolumeProfile ?? { aboveAverage: false, increasing: false, average: 0 },
                currentData ?? { symbol: '', timestamp: new Date(), open: null, high: null, low: null, close: null, volume: null }
            );

            if (shortConditions.valid) {
                const signal = this.createAdvancedSignal(currentData, 'SELL', shortConditions.strength, shortConditions.metadata);
                if (signal) signals.push(signal as unknown as SchemaTradeSignal);
            }
        }

        return signals;
    }

    private checkLongConditions(
        currentPrice: number,
        prevPrice: number,
        currentRSI: number,
        prevRSI: number,
        currentMACD: number,
        prevMACD: number,
        currentADX: number,
        currentBB: any,
        currentMomentum: number,
        volumeProfile: any,
        marketData: MarketData
    ): { valid: boolean; strength: number; metadata: any } {
        let score = 0;
        let maxScore = 0;
        const metadata: any = {};

        // 1. RSI Momentum (Weight: 20%)
        maxScore += 20;
        if (currentRSI > 50 && currentRSI < 70) {
            score += 15; // Bullish but not overbought
            metadata.rsiSignal = 'bullish_momentum';
        } else if (currentRSI <= 50 && currentRSI > 30 && currentRSI > prevRSI) {
            score += 10; // Recovering from oversold
            metadata.rsiSignal = 'recovery';
        } else if (currentRSI > 70) {
            score -= 10; // Overbought penalty
            metadata.rsiSignal = 'overbought';
        }

        // 2. MACD Signal (Weight: 25%)
        maxScore += 25;
        if (currentMACD > 0 && prevMACD <= 0) { // MACD bullish crossover
            score += 25;
            metadata.macdSignal = 'bullish_crossover';
        } else if (currentMACD > 0 && (currentMACD > (prevMACD ?? 0))) { // MACD bullish and strengthening
            score += 15;
            metadata.macdSignal = 'bullish_strengthening';
        } else if (currentMACD < 0) { // MACD bearish
            score -= 15;
            metadata.macdSignal = 'bearish';
        }

        // 3. ADX Trend Strength (Weight: 15%)
        maxScore += 15;
        if (currentADX > 25) {
            score += 15; // Strong trend
            metadata.adxSignal = 'strong_trend';
        } else if (currentADX > 20) {
            score += 10; // Moderate trend
            metadata.adxSignal = 'moderate_trend';
        } else {
            score -= 5; // Weak trend
            metadata.adxSignal = 'weak_trend';
        }

        // 4. Bollinger Bands (Weight: 15%)
        maxScore += 15;
        if (currentPrice > currentBB.middle && currentPrice < currentBB.upper) {
            score += 15; // In upper half, room to grow
            metadata.bbSignal = 'bullish_zone';
        } else if (currentPrice <= currentBB.lower) {
            score += 10; // Oversold bounce potential
            metadata.bbSignal = 'oversold_bounce';
        } else if (currentPrice >= currentBB.upper) {
            score -= 10; // Overbought
            metadata.bbSignal = 'overbought';
        }

        // 5. Price Momentum (Weight: 10%)
        maxScore += 10;
        if (currentMomentum > 0) {
            score += 10; // Positive momentum
            metadata.momentumSignal = 'positive';
        } else {
            score -= 5; // Negative momentum
            metadata.momentumSignal = 'negative';
        }

        // 6. Volume Confirmation (Weight: 15%)
        maxScore += 15;
        if (volumeProfile.aboveAverage && volumeProfile.increasing) {
            score += 15; // Strong volume confirmation
            metadata.volumeSignal = 'strong_confirmation';
        } else if (volumeProfile.aboveAverage) {
            score += 10; // Good volume
            metadata.volumeSignal = 'good_volume';
        } else {
            score -= 5; // Low volume
            metadata.volumeSignal = 'low_volume';
        }

        const strength = score / maxScore;
        const valid = strength >= 0.6; // Require 60% confidence

        return {
            valid,
            strength,
            metadata: {
                ...metadata,
                score,
                maxScore,
                confidence: strength
            }
        };
    }

    private checkShortConditions(
        currentPrice: number,
        prevPrice: number,
        currentRSI: number,
        prevRSI: number,
        currentMACD: number,
        prevMACD: number,
        currentADX: number,
        currentBB: any,
        currentMomentum: number,
        volumeProfile: any,
        marketData: MarketData
    ): { valid: boolean; strength: number; metadata: any } {
        let score = 0;
        let maxScore = 0;
        const metadata: any = {};

        // 1. RSI Momentum (Weight: 20%)
        maxScore += 20;
        if (currentRSI < 50 && currentRSI > 30) {
            score += 15; // Bearish but not oversold
            metadata.rsiSignal = 'bearish_momentum';
        } else if (currentRSI >= 50 && currentRSI < 70 && currentRSI < prevRSI) {
            score += 10; // Declining from overbought
            metadata.rsiSignal = 'decline';
        } else if (currentRSI < 30) {
            score -= 10; // Oversold penalty
            metadata.rsiSignal = 'oversold';
        }

        // 2. MACD Signal (Weight: 25%)
        maxScore += 25;
        if (currentMACD < 0 && prevMACD >= 0) { // MACD bearish crossover
            score += 25;
            metadata.macdSignal = 'bearish_crossover';
        } else if (currentMACD < 0 && (currentMACD < (prevMACD ?? 0))) { // MACD bearish and weakening
            score += 15;
            metadata.macdSignal = 'bearish_weakening';
        } else if (currentMACD > 0) { // MACD bullish
            score -= 15;
            metadata.macdSignal = 'bullish';
        }

        // 3. ADX Trend Strength (Weight: 15%)
        maxScore += 15;
        if (currentADX > 25) {
            score += 15; // Strong trend
            metadata.adxSignal = 'strong_trend';
        } else if (currentADX > 20) {
            score += 10; // Moderate trend
            metadata.adxSignal = 'moderate_trend';
        } else {
            score -= 5; // Weak trend
            metadata.adxSignal = 'weak_trend';
        }

        // 4. Bollinger Bands (Weight: 15%)
        maxScore += 15;
        if (currentPrice < currentBB.middle && currentPrice > currentBB.lower) {
            score += 15; // In lower half, room to fall
            metadata.bbSignal = 'bearish_zone';
        } else if (currentPrice >= currentBB.upper) {
            score += 10; // Overbought sell potential
            metadata.bbSignal = 'overbought_sell';
        } else if (currentPrice <= currentBB.lower) {
            score -= 10; // Oversold
            metadata.bbSignal = 'oversold';
        }

        // 5. Price Momentum (Weight: 10%)
        maxScore += 10;
        if (currentMomentum < 0) {
            score += 10; // Negative momentum
            metadata.momentumSignal = 'negative';
        } else {
            score -= 5; // Positive momentum
            metadata.momentumSignal = 'positive';
        }

        // 6. Volume Confirmation (Weight: 15%)
        maxScore += 15;
        if (volumeProfile.aboveAverage && volumeProfile.increasing) {
            score += 15; // Strong volume confirmation
            metadata.volumeSignal = 'strong_confirmation';
        } else if (volumeProfile.aboveAverage) {
            score += 10; // Good volume
            metadata.volumeSignal = 'good_volume';
        } else {
            score -= 5; // Low volume
            metadata.volumeSignal = 'low_volume';
        }

        const strength = score / maxScore;
        const valid = strength >= 0.6; // Require 60% confidence

        return {
            valid,
            strength,
            metadata: {
                ...metadata,
                score,
                maxScore,
                confidence: strength
            }
        };
    }

    async shouldExit(position: SchemaPosition, marketData: SchemaMarketData[]): Promise<boolean> {
        const internalPosition = position as unknown as Position;
        const internalData: MarketData[] = marketData as unknown as MarketData[];
        if (internalData.length < 50) return false;
        const schemaData = toSchemaMarketDataArray(internalData);
        const currentData = internalData[internalData.length - 1];
        if (!currentData) return false;
        const currentPrice = currentData.close ?? currentData.ltp ?? 0;
        if (currentPrice === undefined) return false;
        // Calculate key indicators for exit
        const rsi = this.calculateRSI(schemaData, 14);
        const macd = this.calculateMACD(schemaData, 12, 26);
        const currentRSI = rsi;
        const currentMACD = macd;

        // Exit conditions for LONG positions
        if (internalPosition.side === 'LONG') {
            // RSI overbought exit
            if (currentRSI > 75) {
                return true;
            }

            // MACD bearish crossover
            if (currentMACD < 0) {
                return true;
            }

            // Trailing stop loss
            if (this.shouldTriggerTrailingStop(internalPosition, currentPrice)) {
                return true;
            }
        }

        // Exit conditions for SHORT positions
        if (internalPosition.side === 'SHORT') {
            // RSI oversold exit
            if (currentRSI < 25) {
                return true;
            }

            // MACD bullish crossover
            if (currentMACD > 0) {
                return true;
            }

            // Trailing stop loss
            if (this.shouldTriggerTrailingStop(internalPosition, currentPrice)) {
                return true;
            }
        }

        return false;
    }

    private shouldTriggerTrailingStop(position: Position, currentPrice: number): boolean {
        const trailingStopPercentage = this.config.parameters.trailingStopPercentage || 3;

        if (position.side === 'LONG') {
            const highestPrice = position.highestPrice || position.entryPrice;
            const trailingStopPrice = highestPrice * (1 - trailingStopPercentage / 100);

            // Update highest price if current price is higher
            if (currentPrice > highestPrice) {
                position.highestPrice = currentPrice;
                return false;
            }

            return currentPrice <= trailingStopPrice;
        } else {
            const lowestPrice = position.lowestPrice || position.entryPrice;
            const trailingStopPrice = lowestPrice * (1 + trailingStopPercentage / 100);

            // Update lowest price if current price is lower
            if (currentPrice < lowestPrice) {
                position.lowestPrice = currentPrice;
                return false;
            }

            return currentPrice >= trailingStopPrice;
        }
    }

    calculateRSI(data: SchemaMarketData[], period: number): number {
        const rsi: number[] = [];
        if (data.length < period + 1) return 0;
        let gains = 0;
        let losses = 0;
        for (let i = 1; i <= period; i++) {
            const change = ((data[i]?.close ?? 0) - (data[i - 1]?.close ?? 0));
            const safeChange = change ?? 0;
            if (safeChange > 0) gains += safeChange;
            else losses -= safeChange;
        }
        let avgGain = gains / period;
        let avgLoss = losses / period;
        for (let i = period; i < data.length; i++) {
            if (i === period) {
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                rsi.push(100 - (100 / (1 + rs)));
            } else {
                const change = ((data[i]?.close ?? 0) - (data[i - 1]?.close ?? 0));
                const safeChange = change ?? 0;
                let currentGain = 0;
                let currentLoss = 0;
                if (safeChange > 0) currentGain = safeChange;
                else currentLoss = -safeChange;
                avgGain = (avgGain * (period - 1) + currentGain) / period;
                avgLoss = (avgLoss * (period - 1) + currentLoss) / period;
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                rsi.push(100 - (100 / (1 + rs)));
            }
        }
        return rsi[rsi.length - 1] ?? 0;
    }

    calculateMACD(data: SchemaMarketData[], fastPeriod: number, slowPeriod: number): number {
        const signalPeriod = 9;
        const fastEMA = this.calculateEMA(data as any, fastPeriod);
        const slowEMA = this.calculateEMA(data as any, slowPeriod);
        const macdLine: number[] = [];
        for (let i = 0; i < data.length; i++) {
            const fast = Array.isArray(fastEMA) ? (fastEMA[i] !== undefined ? fastEMA[i] : 0) : (typeof fastEMA === 'number' ? fastEMA : 0);
            const slow = Array.isArray(slowEMA) ? (slowEMA[i] !== undefined ? slowEMA[i] : 0) : (typeof slowEMA === 'number' ? slowEMA : 0);
            macdLine.push((fast ?? 0) - (slow ?? 0));
        }
        const signalLine = this.calculateEMAFromArray(macdLine, signalPeriod);
        const idx = macdLine.length - 1;
        return (macdLine[idx] ?? 0) - (signalLine[idx] ?? 0);
    }

    private calculateEMA(data: MarketData[], period: number): number[] {
        const ema: number[] = [];
        const multiplier = 2 / (period + 1);

        // Calculate first EMA as SMA
        let sum = 0;
        for (let i = 0; i < period && i < data.length; i++) {
            const dataPoint = data[i];
            if (dataPoint) {
                sum += dataPoint.close ?? dataPoint.ltp ?? 0;
            }
        }

        for (let i = 0; i < period - 1; i++) {
            ema.push(0);
        }

        if (data.length >= period) {
            ema.push(sum / period);

            // Calculate EMA for remaining points
            for (let i = period; i < data.length; i++) {
                const price = data[i]?.close || data[i]?.ltp || 0;
                const prevEMA = ema[i - 1] !== undefined ? ema[i - 1] : 0;
                ema.push((price * multiplier) + ((prevEMA ?? 0) * (1 - multiplier)));
            }
        }

        return ema;
    }

    private calculateEMAFromArray(data: number[], period: number): number[] {
        const ema: number[] = [];
        const multiplier = 2 / (period + 1);

        // Calculate first EMA as SMA
        let sum = 0;
        for (let i = 0; i < period && i < data.length; i++) {
            sum += data[i] ?? 0;
        }

        for (let i = 0; i < period - 1; i++) {
            ema.push(0);
        }

        if (data.length >= period) {
            ema.push(sum / period);

            // Calculate EMA for remaining points
            for (let i = period; i < data.length; i++) {
                const value = data[i] ?? 0;
                const prevEMA = ema[i - 1] ?? 0;
                ema.push((value * multiplier) + (prevEMA * (1 - multiplier)));
            }
        }

        return ema;
    }

    private calculateADX(data: MarketData[], period: number): number[] {
        const adx: number[] = [];
        // Simplified ADX calculation
        // In real implementation, you'd want a more accurate ADX calculation

        for (let i = 0; i < data.length; i++) {
            if (i < period) {
                adx.push(0);
            } else {
                // Simplified calculation - use price momentum as proxy
                const recentData = data.slice(i - period, i);
                let totalMovement = 0;
                let directionalMovement = 0;

                for (let j = 1; j < recentData.length; j++) {
                    const current = recentData[j];
                    const previous = recentData[j - 1];

                    const currentPrice = current?.close ?? current?.ltp ?? 0;
                    const previousPrice = previous?.close ?? previous?.ltp ?? 0;

                    totalMovement += Math.abs(currentPrice - previousPrice);
                    directionalMovement += currentPrice - previousPrice;
                }

                const adxValue = totalMovement > 0 ? (Math.abs(directionalMovement) / totalMovement) * 100 : 0;
                adx.push(Math.min(100, adxValue));
            }
        }

        return adx;
    }

    private calculateBollingerBands(data: MarketData[], period: number, stdDev: number): any[] {
        const bb: any[] = [];

        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                bb.push({ upper: 0, middle: 0, lower: 0 });
            } else {
                const recentData = data.slice(i - period + 1, i + 1);
                const prices = recentData.map(d => d.close || d.ltp || 0);

                const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
                const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
                const standardDeviation = Math.sqrt(variance);

                bb.push({
                    upper: mean + (standardDeviation * stdDev),
                    middle: mean,
                    lower: mean - (standardDeviation * stdDev)
                });
            }
        }

        return bb;
    }

    private calculateMomentum(data: MarketData[], period: number): number[] {
        const momentum: number[] = [];

        for (let i = 0; i < data.length; i++) {
            if (i < period) {
                momentum.push(0);
            } else {
                const currentPrice = data[i]?.close ?? data[i]?.ltp ?? 0;
                const previousPrice = data[i - period]?.close ?? data[i - period]?.ltp ?? 0;
                momentum.push(currentPrice - previousPrice);
            }
        }

        return momentum;
    }

    private calculateVolumeProfile(data: MarketData[], period: number): any[] {
        const volumeProfile: any[] = [];

        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                volumeProfile.push({ aboveAverage: false, increasing: false, average: 0 });
            } else {
                const recentData = data.slice(i - period + 1, i + 1);
                const volumes = recentData.map(d => d.volume || 0);
                const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;

                const currentVolume = data[i]?.volume ?? 0;
                const previousVolume = data[i - 1]?.volume ?? 0;

                volumeProfile.push({
                    aboveAverage: currentVolume > avgVolume,
                    increasing: currentVolume > previousVolume,
                    average: avgVolume
                });
            }
        }

        return volumeProfile;
    }

    private isValidIndicatorSet(rsi: number, macd: number, adx: number, bb: any, momentum: number[]): boolean {
        return rsi != null && macd != null && adx != null && bb != null && momentum != null;
    }

    private createAdvancedSignal(
        data: MarketData,
        action: 'BUY' | 'SELL',
        strength: number,
        metadata: any
    ): TradeSignal | null {
        const price = data.close ?? data.ltp ?? 0;
        if (!price || !data.symbol) return null;
        // Calculate dynamic stop loss and target based on signal strength
        const baseStopLossPercentage = this.config.parameters.baseStopLossPercentage || 2;
        const baseTargetPercentage = this.config.parameters.baseTargetPercentage || 4;
        // Adjust based on signal strength
        const strengthMultiplier = Math.max(0.5, Math.min(1.5, strength));
        const stopLossPercentage = baseStopLossPercentage / strengthMultiplier;
        const targetPercentage = baseTargetPercentage * strengthMultiplier;
        let stopLoss: number;
        let target: number;
        if (action === 'BUY') {
            stopLoss = price * (1 - stopLossPercentage / 100);
            target = price * (1 + targetPercentage / 100);
        } else {
            stopLoss = price * (1 + stopLossPercentage / 100);
            target = price * (1 - targetPercentage / 100);
        }
        return {
            id: `signal_${Date.now()}_${Math.random()}`,
            symbol: data.symbol,
            action,
            quantity: 1,
            price,
            stopLoss,
            target,
            timestamp: new Date(data.timestamp),
            strategy: this.name,
            metadata: {
                ...metadata,
                strategyType: this.type,
                version: this.version,
                signalStrength: strength,
                confidence: strength,
                stopLossPercentage,
                targetPercentage,
                riskRewardRatio: targetPercentage / stopLossPercentage
            }
        };
    }

    validateConfig(config: StrategyConfig): boolean {
        const baseValid = super.validateConfig(config);
        if (!baseValid) return false;

        // Validate momentum strategy specific parameters
        const params = config.parameters;

        return !!(
            typeof params.rsiPeriod === 'number' && params.rsiPeriod > 0 &&
            typeof params.macdFast === 'number' && params.macdFast > 0 &&
            typeof params.macdSlow === 'number' && typeof params.macdFast === 'number' && params.macdSlow > params.macdFast &&
            typeof params.macdSignal === 'number' && params.macdSignal > 0 &&
            typeof params.adxPeriod === 'number' && params.adxPeriod > 0 &&
            typeof params.bbPeriod === 'number' && params.bbPeriod > 0 &&
            typeof params.bbStdDev === 'number' && params.bbStdDev > 0 &&
            typeof params.volumeMultiplier === 'number' && params.volumeMultiplier > 0 &&
            typeof params.momentumPeriod === 'number' && params.momentumPeriod > 0
        );
    }
} 