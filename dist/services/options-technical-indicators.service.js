"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionsTechnicalIndicators = exports.OptionsTechnicalIndicatorsService = void 0;
const logger_1 = require("../logger/logger");
class OptionsTechnicalIndicatorsService {
    constructor() {
        this.supportedTimeframes = ['1min', '3min', '5min', '15min', '30min', '1hour', '1day'];
        this.supportedIndicators = ['ADX', 'RSI', 'MACD', 'BOLLINGER_BANDS', 'STOCHASTIC', 'CCI', 'WILLIAMS_R'];
        logger_1.logger.info('Options Technical Indicators Service initialized');
    }
    async calculateADXForOptions(optionsContract, timeframe, period = 14) {
        try {
            const underlyingData = await this.getUnderlyingDataForTimeframe(optionsContract.underlyingSymbol, timeframe, period + 20);
            if (!underlyingData || underlyingData.length < period + 1) {
                logger_1.logger.warn(`Insufficient data for ADX calculation on ${optionsContract.underlyingSymbol} ${timeframe}`);
                return null;
            }
            const adxResult = this.calculateADX(underlyingData, period);
            if (adxResult) {
                logger_1.logger.info(`ADX calculated for ${optionsContract.underlyingSymbol} ${timeframe}: ${adxResult.adx.toFixed(2)}`);
            }
            return adxResult;
        }
        catch (error) {
            logger_1.logger.error(`Error calculating ADX for options: ${error}`);
            return null;
        }
    }
    async calculateRSIForOptions(optionsContract, timeframe, period = 14) {
        try {
            const underlyingData = await this.getUnderlyingDataForTimeframe(optionsContract.underlyingSymbol, timeframe, period + 10);
            if (!underlyingData || underlyingData.length < period + 1) {
                logger_1.logger.warn(`Insufficient data for RSI calculation on ${optionsContract.underlyingSymbol} ${timeframe}`);
                return null;
            }
            const rsiResult = this.calculateRSI(underlyingData, period);
            if (rsiResult) {
                logger_1.logger.info(`RSI calculated for ${optionsContract.underlyingSymbol} ${timeframe}: ${rsiResult.rsi.toFixed(2)}`);
            }
            return rsiResult;
        }
        catch (error) {
            logger_1.logger.error(`Error calculating RSI for options: ${error}`);
            return null;
        }
    }
    async calculateMACDForOptions(optionsContract, timeframe, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        try {
            const underlyingData = await this.getUnderlyingDataForTimeframe(optionsContract.underlyingSymbol, timeframe, slowPeriod + signalPeriod + 10);
            if (!underlyingData || underlyingData.length < slowPeriod + signalPeriod) {
                logger_1.logger.warn(`Insufficient data for MACD calculation on ${optionsContract.underlyingSymbol} ${timeframe}`);
                return null;
            }
            const macdResult = this.calculateMACD(underlyingData, fastPeriod, slowPeriod, signalPeriod);
            if (macdResult) {
                logger_1.logger.info(`MACD calculated for ${optionsContract.underlyingSymbol} ${timeframe}: ${macdResult.macd.toFixed(4)}`);
            }
            return macdResult;
        }
        catch (error) {
            logger_1.logger.error(`Error calculating MACD for options: ${error}`);
            return null;
        }
    }
    async calculateBollingerBandsForOptions(optionsContract, timeframe, period = 20, standardDeviations = 2) {
        try {
            const underlyingData = await this.getUnderlyingDataForTimeframe(optionsContract.underlyingSymbol, timeframe, period + 5);
            if (!underlyingData || underlyingData.length < period) {
                logger_1.logger.warn(`Insufficient data for Bollinger Bands calculation on ${optionsContract.underlyingSymbol} ${timeframe}`);
                return null;
            }
            const bbResult = this.calculateBollingerBands(underlyingData, period, standardDeviations);
            if (bbResult) {
                logger_1.logger.info(`Bollinger Bands calculated for ${optionsContract.underlyingSymbol} ${timeframe}`);
            }
            return bbResult;
        }
        catch (error) {
            logger_1.logger.error(`Error calculating Bollinger Bands for options: ${error}`);
            return null;
        }
    }
    async performTechnicalAnalysisForOptions(optionsContract, timeframe, indicators = ['ADX', 'RSI', 'MACD', 'BOLLINGER_BANDS']) {
        try {
            logger_1.logger.info(`Performing technical analysis for ${optionsContract.underlyingSymbol} ${timeframe}`);
            const analysis = {
                contractId: optionsContract.id,
                underlyingSymbol: optionsContract.underlyingSymbol,
                strikePrice: optionsContract.strikePrice,
                optionType: optionsContract.optionType,
                expiryDate: optionsContract.expiryDate,
                timeframe,
                indicators: {},
                timestamp: new Date()
            };
            for (const indicator of indicators) {
                switch (indicator.toUpperCase()) {
                    case 'ADX':
                        analysis.indicators.adx = await this.calculateADXForOptions(optionsContract, timeframe);
                        break;
                    case 'RSI':
                        analysis.indicators.rsi = await this.calculateRSIForOptions(optionsContract, timeframe);
                        break;
                    case 'MACD':
                        analysis.indicators.macd = await this.calculateMACDForOptions(optionsContract, timeframe);
                        break;
                    case 'BOLLINGER_BANDS':
                        analysis.indicators.bollingerBands = await this.calculateBollingerBandsForOptions(optionsContract, timeframe);
                        break;
                    default:
                        logger_1.logger.warn(`Unsupported indicator: ${indicator}`);
                }
            }
            logger_1.logger.info(`Technical analysis completed for ${optionsContract.underlyingSymbol} ${timeframe}`);
            return analysis;
        }
        catch (error) {
            logger_1.logger.error(`Error performing technical analysis for options: ${error}`);
            return null;
        }
    }
    async getUnderlyingDataForTimeframe(underlyingSymbol, timeframe, limit = 100) {
        try {
            logger_1.logger.info(`Fetching ${timeframe} data for ${underlyingSymbol}, limit: ${limit}`);
            return this.generateMockCandleData(underlyingSymbol, timeframe, limit);
        }
        catch (error) {
            logger_1.logger.error(`Error fetching underlying data: ${error}`);
            return null;
        }
    }
    calculateADX(data, period = 14) {
        if (data.length < period + 1)
            return null;
        const high = data.map(d => d.high);
        const low = data.map(d => d.low);
        const close = data.map(d => d.close);
        const plusDM = [];
        const minusDM = [];
        const trueRange = [];
        for (let i = 1; i < data.length; i++) {
            const tr = Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]));
            trueRange.push(tr);
            const highDiff = high[i] - high[i - 1];
            const lowDiff = low[i - 1] - low[i];
            if (highDiff > lowDiff && highDiff > 0) {
                plusDM.push(highDiff);
                minusDM.push(0);
            }
            else if (lowDiff > highDiff && lowDiff > 0) {
                plusDM.push(0);
                minusDM.push(lowDiff);
            }
            else {
                plusDM.push(0);
                minusDM.push(0);
            }
        }
        const smoothedTR = this.smooth(trueRange, period);
        const smoothedPlusDM = this.smooth(plusDM, period);
        const smoothedMinusDM = this.smooth(minusDM, period);
        const plusDI = (smoothedPlusDM[smoothedPlusDM.length - 1] / smoothedTR[smoothedTR.length - 1]) * 100;
        const minusDI = (smoothedMinusDM[smoothedMinusDM.length - 1] / smoothedTR[smoothedTR.length - 1]) * 100;
        const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
        const adx = this.smooth([dx], period)[0];
        return {
            adx,
            plusDI,
            minusDI,
            timestamp: data[data.length - 1].timestamp,
            timeframe: data[0].timeframe?.name || 'unknown'
        };
    }
    calculateRSI(data, period = 14) {
        if (data.length < period + 1)
            return null;
        const gains = [];
        const losses = [];
        for (let i = 1; i < data.length; i++) {
            const change = data[i].close - data[i - 1].close;
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }
        const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
        const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        return {
            rsi,
            timestamp: data[data.length - 1].timestamp,
            timeframe: data[0].timeframe?.name || 'unknown'
        };
    }
    calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        if (data.length < slowPeriod + signalPeriod)
            return null;
        const close = data.map(d => d.close);
        const fastEMA = this.calculateEMA(close, fastPeriod);
        const slowEMA = this.calculateEMA(close, slowPeriod);
        const macdLine = fastEMA[fastEMA.length - 1] - slowEMA[slowEMA.length - 1];
        const macdValues = fastEMA.map((fast, i) => fast - slowEMA[i]);
        const signalLine = this.calculateEMA(macdValues, signalPeriod)[signalPeriod - 1];
        const histogram = macdLine - signalLine;
        return {
            macd: macdLine,
            signal: signalLine,
            histogram,
            timestamp: data[data.length - 1].timestamp,
            timeframe: data[0].timeframe?.name || 'unknown'
        };
    }
    calculateBollingerBands(data, period = 20, standardDeviations = 2) {
        if (data.length < period)
            return null;
        const close = data.map(d => d.close);
        const recentClose = close.slice(-period);
        const middle = recentClose.reduce((sum, price) => sum + price, 0) / period;
        const variance = recentClose.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        const upper = middle + (standardDeviations * stdDev);
        const lower = middle - (standardDeviations * stdDev);
        const bandwidth = (upper - lower) / middle * 100;
        const currentPrice = close[close.length - 1];
        const percentB = (currentPrice - lower) / (upper - lower);
        return {
            upper,
            middle,
            lower,
            bandwidth,
            percentB,
            timestamp: data[data.length - 1].timestamp,
            timeframe: data[0].timeframe?.name || 'unknown'
        };
    }
    smooth(data, period) {
        const smoothed = [];
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            if (i < period) {
                sum += data[i];
                smoothed.push(sum / (i + 1));
            }
            else {
                sum = smoothed[i - 1] * (period - 1) + data[i];
                smoothed.push(sum / period);
            }
        }
        return smoothed;
    }
    calculateEMA(data, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += data[i];
        }
        ema.push(sum / period);
        for (let i = period; i < data.length; i++) {
            const newEMA = (data[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
            ema.push(newEMA);
        }
        return ema;
    }
    generateMockCandleData(symbol, timeframe, limit) {
        const data = [];
        const basePrice = 18000;
        let currentPrice = basePrice;
        for (let i = 0; i < limit; i++) {
            const timestamp = new Date();
            timestamp.setMinutes(timestamp.getMinutes() - (limit - i) * 5);
            const change = (Math.random() - 0.5) * 100;
            currentPrice += change;
            const open = currentPrice;
            const high = currentPrice + Math.random() * 50;
            const low = currentPrice - Math.random() * 50;
            const close = currentPrice + (Math.random() - 0.5) * 20;
            const volume = Math.floor(Math.random() * 1000) + 100;
            data.push({
                id: `mock_${i}`,
                instrumentId: `instrument_${symbol}`,
                instrument: { id: `instrument_${symbol}`, symbol, name: symbol },
                timeframeId: `timeframe_${timeframe}`,
                timeframe: { id: `timeframe_${timeframe}`, name: timeframe, intervalMinutes: 5 },
                timestamp,
                open,
                high,
                low,
                close,
                volume,
                typicalPrice: (high + low + close) / 3,
                weightedPrice: (high + low + close + close) / 4,
                priceChange: close - open,
                priceChangePercent: ((close - open) / open) * 100,
                upperShadow: high - Math.max(open, close),
                lowerShadow: Math.min(open, close) - low,
                bodySize: Math.abs(close - open),
                totalRange: high - low
            });
        }
        return data;
    }
    getSupportedTimeframes() {
        return this.supportedTimeframes;
    }
    getSupportedIndicators() {
        return this.supportedIndicators;
    }
    isValidTimeframe(timeframe) {
        return this.supportedTimeframes.includes(timeframe);
    }
    isValidIndicator(indicator) {
        return this.supportedIndicators.includes(indicator.toUpperCase());
    }
}
exports.OptionsTechnicalIndicatorsService = OptionsTechnicalIndicatorsService;
exports.optionsTechnicalIndicators = new OptionsTechnicalIndicatorsService();
//# sourceMappingURL=options-technical-indicators.service.js.map