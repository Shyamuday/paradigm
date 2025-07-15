"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionsTechnicalAnalysis = exports.OptionsTechnicalAnalysisService = void 0;
const logger_1 = require("../logger/logger");
class OptionsTechnicalAnalysisService {
    async calculateADXForOptions(underlyingSymbol, timeframe, period = 14) {
        try {
            logger_1.logger.info(`Calculating ADX for ${underlyingSymbol} on ${timeframe} timeframe`);
            const priceData = await this.getUnderlyingPriceData(underlyingSymbol, timeframe, period + 20);
            if (!priceData || priceData.length < period + 1) {
                logger_1.logger.warn(`Insufficient data for ADX calculation`);
                return null;
            }
            const adx = this.calculateADX(priceData, period);
            logger_1.logger.info(`ADX calculated: ${adx.adx.toFixed(2)}, +DI: ${adx.plusDI.toFixed(2)}, -DI: ${adx.minusDI.toFixed(2)}`);
            return {
                ...adx,
                timeframe,
                timestamp: new Date()
            };
        }
        catch (error) {
            logger_1.logger.error(`Error calculating ADX: ${error}`);
            return null;
        }
    }
    async calculateRSIForOptions(underlyingSymbol, timeframe, period = 14) {
        try {
            logger_1.logger.info(`Calculating RSI for ${underlyingSymbol} on ${timeframe} timeframe`);
            const priceData = await this.getUnderlyingPriceData(underlyingSymbol, timeframe, period + 10);
            if (!priceData || priceData.length < period + 1) {
                logger_1.logger.warn(`Insufficient data for RSI calculation`);
                return null;
            }
            const rsi = this.calculateRSI(priceData, period);
            logger_1.logger.info(`RSI calculated: ${rsi.toFixed(2)}`);
            return {
                rsi,
                timeframe,
                timestamp: new Date()
            };
        }
        catch (error) {
            logger_1.logger.error(`Error calculating RSI: ${error}`);
            return null;
        }
    }
    async calculateMACDForOptions(underlyingSymbol, timeframe, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        try {
            logger_1.logger.info(`Calculating MACD for ${underlyingSymbol} on ${timeframe} timeframe`);
            const priceData = await this.getUnderlyingPriceData(underlyingSymbol, timeframe, slowPeriod + signalPeriod + 10);
            if (!priceData || priceData.length < slowPeriod + signalPeriod) {
                logger_1.logger.warn(`Insufficient data for MACD calculation`);
                return null;
            }
            const macd = this.calculateMACD(priceData, fastPeriod, slowPeriod, signalPeriod);
            logger_1.logger.info(`MACD calculated: ${macd.macd.toFixed(4)}, Signal: ${macd.signal.toFixed(4)}`);
            return {
                ...macd,
                timeframe,
                timestamp: new Date()
            };
        }
        catch (error) {
            logger_1.logger.error(`Error calculating MACD: ${error}`);
            return null;
        }
    }
    async calculateBollingerBandsForOptions(underlyingSymbol, timeframe, period = 20, standardDeviations = 2) {
        try {
            logger_1.logger.info(`Calculating Bollinger Bands for ${underlyingSymbol} on ${timeframe} timeframe`);
            const priceData = await this.getUnderlyingPriceData(underlyingSymbol, timeframe, period + 5);
            if (!priceData || priceData.length < period) {
                logger_1.logger.warn(`Insufficient data for Bollinger Bands calculation`);
                return null;
            }
            const bb = this.calculateBollingerBands(priceData, period, standardDeviations);
            logger_1.logger.info(`Bollinger Bands calculated: Upper: ${bb.upper.toFixed(2)}, Lower: ${bb.lower.toFixed(2)}`);
            return {
                ...bb,
                timeframe,
                timestamp: new Date()
            };
        }
        catch (error) {
            logger_1.logger.error(`Error calculating Bollinger Bands: ${error}`);
            return null;
        }
    }
    async performCompleteTechnicalAnalysis(underlyingSymbol, timeframe, indicators = ['ADX', 'RSI', 'MACD', 'BOLLINGER_BANDS']) {
        try {
            logger_1.logger.info(`Performing complete technical analysis for ${underlyingSymbol} on ${timeframe} timeframe`);
            const analysis = {
                underlyingSymbol,
                timeframe,
                timestamp: new Date(),
                indicators: {}
            };
            for (const indicator of indicators) {
                switch (indicator.toUpperCase()) {
                    case 'ADX':
                        analysis.indicators.adx = await this.calculateADXForOptions(underlyingSymbol, timeframe);
                        break;
                    case 'RSI':
                        analysis.indicators.rsi = await this.calculateRSIForOptions(underlyingSymbol, timeframe);
                        break;
                    case 'MACD':
                        analysis.indicators.macd = await this.calculateMACDForOptions(underlyingSymbol, timeframe);
                        break;
                    case 'BOLLINGER_BANDS':
                        analysis.indicators.bollingerBands = await this.calculateBollingerBandsForOptions(underlyingSymbol, timeframe);
                        break;
                    default:
                        logger_1.logger.warn(`Unsupported indicator: ${indicator}`);
                }
            }
            logger_1.logger.info(`Complete technical analysis finished for ${underlyingSymbol}`);
            return analysis;
        }
        catch (error) {
            logger_1.logger.error(`Error performing complete technical analysis: ${error}`);
            return null;
        }
    }
    async getUnderlyingPriceData(underlyingSymbol, timeframe, limit = 100) {
        try {
            logger_1.logger.info(`Fetching ${timeframe} data for ${underlyingSymbol}, limit: ${limit}`);
            return this.generateMockPriceData(underlyingSymbol, limit);
        }
        catch (error) {
            logger_1.logger.error(`Error fetching underlying data: ${error}`);
            return [];
        }
    }
    calculateADX(data, period = 14) {
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
        return { adx, plusDI, minusDI };
    }
    calculateRSI(data, period = 14) {
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
        return 100 - (100 / (1 + rs));
    }
    calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const close = data.map(d => d.close);
        const fastEMA = this.calculateEMA(close, fastPeriod);
        const slowEMA = this.calculateEMA(close, slowPeriod);
        const macdLine = fastEMA[fastEMA.length - 1] - slowEMA[slowEMA.length - 1];
        const macdValues = fastEMA.map((fast, i) => fast - slowEMA[i]);
        const signalLine = this.calculateEMA(macdValues, signalPeriod)[signalPeriod - 1];
        const histogram = macdLine - signalLine;
        return { macd: macdLine, signal: signalLine, histogram };
    }
    calculateBollingerBands(data, period = 20, standardDeviations = 2) {
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
        return { upper, middle, lower, bandwidth, percentB };
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
    generateMockPriceData(symbol, limit) {
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
            data.push({
                high,
                low,
                close,
                timestamp
            });
        }
        return data;
    }
}
exports.OptionsTechnicalAnalysisService = OptionsTechnicalAnalysisService;
exports.optionsTechnicalAnalysis = new OptionsTechnicalAnalysisService();
//# sourceMappingURL=options-technical-analysis.js.map