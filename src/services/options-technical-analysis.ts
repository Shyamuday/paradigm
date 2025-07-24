import { logger } from '../logger/logger';

// Technical indicator interfaces
interface ADXResult {
    adx: number;
    plusDI: number;
    minusDI: number;
    timestamp: Date;
    timeframe: string;
}

interface RSIResult {
    rsi: number;
    timestamp: Date;
    timeframe: string;
}

interface MACDResult {
    macd: number;
    signal: number;
    histogram: number;
    timestamp: Date;
    timeframe: string;
}

interface BollingerBandsResult {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
    timestamp: Date;
    timeframe: string;
}

export class OptionsTechnicalAnalysisService {

    /**
     * Calculate ADX for options based on underlying price data
     */
    async calculateADXForOptions(
        underlyingSymbol: string,
        timeframe: string,
        period: number = 14
    ): Promise<ADXResult | null> {
        try {
            logger.info(`Calculating ADX for ${underlyingSymbol} on ${timeframe} timeframe`);

            // Get underlying price data for the specified timeframe
            const priceData = await this.getUnderlyingPriceData(underlyingSymbol, timeframe, period + 20);

            if (!priceData || priceData.length < period + 1) {
                logger.warn(`Insufficient data for ADX calculation`);
                return null;
            }

            const adx = this.calculateADX(priceData, period);

            logger.info(`ADX calculated: ${adx.adx.toFixed(2)}, +DI: ${adx.plusDI.toFixed(2)}, -DI: ${adx.minusDI.toFixed(2)}`);

            return {
                ...adx,
                timeframe,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error(`Error calculating ADX: ${error}`);
            return null;
        }
    }

    /**
     * Calculate RSI for options
     */
    async calculateRSIForOptions(
        underlyingSymbol: string,
        timeframe: string,
        period: number = 14
    ): Promise<RSIResult | null> {
        try {
            logger.info(`Calculating RSI for ${underlyingSymbol} on ${timeframe} timeframe`);

            const priceData = await this.getUnderlyingPriceData(underlyingSymbol, timeframe, period + 10);

            if (!priceData || priceData.length < period + 1) {
                logger.warn(`Insufficient data for RSI calculation`);
                return null;
            }

            const rsi = this.calculateRSI(priceData, period);

            logger.info(`RSI calculated: ${rsi.toFixed(2)}`);

            return {
                rsi,
                timeframe,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error(`Error calculating RSI: ${error}`);
            return null;
        }
    }

    /**
     * Calculate MACD for options
     */
    async calculateMACDForOptions(
        underlyingSymbol: string,
        timeframe: string,
        fastPeriod: number = 12,
        slowPeriod: number = 26,
        signalPeriod: number = 9
    ): Promise<MACDResult | null> {
        try {
            logger.info(`Calculating MACD for ${underlyingSymbol} on ${timeframe} timeframe`);

            const priceData = await this.getUnderlyingPriceData(underlyingSymbol, timeframe, slowPeriod + signalPeriod + 10);

            if (!priceData || priceData.length < slowPeriod + signalPeriod) {
                logger.warn(`Insufficient data for MACD calculation`);
                return null;
            }

            const macd = this.calculateMACD(priceData, fastPeriod, slowPeriod, signalPeriod);

            logger.info(`MACD calculated: ${macd.macd.toFixed(4)}, Signal: ${macd.signal.toFixed(4)}`);

            return {
                ...macd,
                timeframe,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error(`Error calculating MACD: ${error}`);
            return null;
        }
    }

    /**
     * Calculate Bollinger Bands for options
     */
    async calculateBollingerBandsForOptions(
        underlyingSymbol: string,
        timeframe: string,
        period: number = 20,
        standardDeviations: number = 2
    ): Promise<BollingerBandsResult | null> {
        try {
            logger.info(`Calculating Bollinger Bands for ${underlyingSymbol} on ${timeframe} timeframe`);

            const priceData = await this.getUnderlyingPriceData(underlyingSymbol, timeframe, period + 5);

            if (!priceData || priceData.length < period) {
                logger.warn(`Insufficient data for Bollinger Bands calculation`);
                return null;
            }

            const bb = this.calculateBollingerBands(priceData, period, standardDeviations);

            logger.info(`Bollinger Bands calculated: Upper: ${bb.upper.toFixed(2)}, Lower: ${bb.lower.toFixed(2)}`);

            return {
                ...bb,
                timeframe,
                timestamp: new Date()
            };
        } catch (error) {
            logger.error(`Error calculating Bollinger Bands: ${error}`);
            return null;
        }
    }

    /**
     * Comprehensive technical analysis for options
     */
    async performCompleteTechnicalAnalysis(
        underlyingSymbol: string,
        timeframe: string,
        indicators: string[] = ['ADX', 'RSI', 'MACD', 'BOLLINGER_BANDS']
    ): Promise<any> {
        try {
            logger.info(`Performing complete technical analysis for ${underlyingSymbol} on ${timeframe} timeframe`);

            const analysis: any = {
                underlyingSymbol,
                timeframe,
                timestamp: new Date(),
                indicators: {}
            };

            // Calculate requested indicators
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
                        logger.warn(`Unsupported indicator: ${indicator}`);
                }
            }

            logger.info(`Complete technical analysis finished for ${underlyingSymbol}`);
            return analysis;
        } catch (error) {
            logger.error(`Error performing complete technical analysis: ${error}`);
            return null;
        }
    }

    // Stub for analyzeOptionsData
    async analyzeOptionsData(symbol: string, timeframe: string, mode: string): Promise<any> {
        return { success: true, indicators: { adx: { adx: 20 }, rsi: { rsi: 50 }, macd: { macd: 0, signal: 0, histogram: 0 }, bollinger: { upper: 0, middle: 0, lower: 0 } } };
    }

    // Stub for calculateTechnicalIndicators
    async calculateTechnicalIndicators(data: any[], timeframe: string): Promise<any> {
        return { adx: { adx: 20 }, rsi: { rsi: 50 }, macd: { macd: 0, signal: 0, histogram: 0 }, bollinger: { upper: 0, middle: 0, lower: 0 } };
    }

    /**
     * Get underlying price data for specific timeframe
     */
    private async getUnderlyingPriceData(
        underlyingSymbol: string,
        timeframe: string,
        limit: number = 100
    ): Promise<{ high: number; low: number; close: number; timestamp: Date }[]> {
        try {
            logger.info(`Fetching ${timeframe} data for ${underlyingSymbol}, limit: ${limit}`);

            // TODO: Replace with actual database query
            // const data = await prisma.candleData.findMany({
            //   where: {
            //     instrument: { underlyingSymbol },
            //     timeframe: { name: timeframe }
            //   },
            //   orderBy: { timestamp: 'desc' },
            //   take: limit,
            //   select: { high: true, low: true, close: true, timestamp: true }
            // });

            // For demonstration, return mock data
            return this.generateMockPriceData(underlyingSymbol, limit);
        } catch (error) {
            logger.error(`Error fetching underlying data: ${error}`);
            return [];
        }
    }

    /**
     * Calculate ADX (Average Directional Index)
     */
    private calculateADX(data: { high: number; low: number; close: number }[], period: number = 14): { adx: number; plusDI: number; minusDI: number } {
        const high = data.map(d => d.high);
        const low = data.map(d => d.low);
        const close = data.map(d => d.close);

        const plusDM: number[] = [];
        const minusDM: number[] = [];
        const trueRange: number[] = [];

        // Calculate True Range and Directional Movement
        for (let i = 1; i < data.length; i++) {
            const currentHigh = high[i] ?? 0;
            const currentLow = low[i] ?? 0;
            const prevClose = close[i - 1] ?? 0;
            const prevHigh = high[i - 1] ?? 0;
            const prevLow = low[i - 1] ?? 0;

            const tr = Math.max(
                currentHigh - currentLow,
                Math.abs(currentHigh - prevClose),
                Math.abs(currentLow - prevClose)
            );
            trueRange.push(tr);

            const highDiff = currentHigh - prevHigh;
            const lowDiff = prevLow - currentLow;

            if (highDiff > lowDiff && highDiff > 0) {
                plusDM.push(highDiff);
                minusDM.push(0);
            } else if (lowDiff > highDiff && lowDiff > 0) {
                plusDM.push(0);
                minusDM.push(lowDiff);
            } else {
                plusDM.push(0);
                minusDM.push(0);
            }
        }

        // Calculate smoothed values
        const smoothedTR = this.smooth(trueRange, period);
        const smoothedPlusDM = this.smooth(plusDM, period);
        const smoothedMinusDM = this.smooth(minusDM, period);

        // Calculate DI values
        const plusDI = (smoothedPlusDM[smoothedPlusDM.length - 1] ?? 0) / (smoothedTR[smoothedTR.length - 1] ?? 1) * 100;
        const minusDI = (smoothedMinusDM[smoothedMinusDM.length - 1] ?? 0) / (smoothedTR[smoothedTR.length - 1] ?? 1) * 100;

        // Calculate DX and ADX
        const dx = (plusDI + minusDI) !== 0 ? Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100 : 0;
        const adx = this.smooth([dx], period)[0] ?? 0;

        return { adx, plusDI, minusDI };
    }

    /**
     * Calculate RSI (Relative Strength Index)
     */
    private calculateRSI(data: { close: number }[], period: number = 14): number {
        const gains: number[] = [];
        const losses: number[] = [];

        // Calculate gains and losses
        for (let i = 1; i < data.length; i++) {
            const currentClose = data[i]?.close ?? 0;
            const prevClose = data[i - 1]?.close ?? 0;
            const change = currentClose - prevClose;
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }

        // Calculate average gains and losses
        const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
        const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

        // Calculate RSI
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    /**
     * Calculate MACD (Moving Average Convergence Divergence)
     */
    private calculateMACD(
        data: { close: number }[],
        fastPeriod: number = 12,
        slowPeriod: number = 26,
        signalPeriod: number = 9
    ): { macd: number; signal: number; histogram: number } {
        const close = data.map(d => d.close);

        // Calculate EMAs
        const fastEMA = this.calculateEMA(close, fastPeriod);
        const slowEMA = this.calculateEMA(close, slowPeriod);

        // Calculate MACD line
        const macdLine = (fastEMA[fastEMA.length - 1] ?? 0) - (slowEMA[slowEMA.length - 1] ?? 0);

        // Calculate signal line
        const macdValues = fastEMA.map((fast, i) => fast - (slowEMA[i] ?? 0));
        const signalLineValues = this.calculateEMA(macdValues, signalPeriod);
        const signalLine = signalLineValues[signalPeriod - 1] ?? 0;

        // Calculate histogram
        const histogram = macdLine - signalLine;

        return { macd: macdLine, signal: signalLine, histogram };
    }

    /**
     * Calculate Bollinger Bands
     */
    private calculateBollingerBands(
        data: { close: number }[],
        period: number = 20,
        standardDeviations: number = 2
    ): { upper: number; middle: number; lower: number; bandwidth: number; percentB: number } {
        const close = data.map(d => d.close);
        const recentClose = close.slice(-period);

        // Calculate middle band (SMA)
        const middle = recentClose.reduce((sum, price) => sum + price, 0) / period;

        // Calculate standard deviation
        const variance = recentClose.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
        const stdDev = Math.sqrt(variance);

        // Calculate upper and lower bands
        const upper = middle + (standardDeviations * stdDev);
        const lower = middle - (standardDeviations * stdDev);

        // Calculate bandwidth and %B
        const bandwidth = middle !== 0 ? (upper - lower) / middle * 100 : 0;
        const currentPrice = close[close.length - 1] ?? 0;
        const percentB = (upper - lower) !== 0 ? (currentPrice - lower) / (upper - lower) : 0;

        return { upper, middle, lower, bandwidth, percentB };
    }

    /**
     * Smooth data using Wilder's smoothing method
     */
    private smooth(data: number[], period: number): number[] {
        const smoothed: number[] = [];
        let sum = 0;

        for (let i = 0; i < data.length; i++) {
            const currentData = data[i] ?? 0;
            if (i < period) {
                sum += currentData;
                smoothed.push(sum / (i + 1));
            } else {
                const prevSmoothed = smoothed[i - 1] ?? 0;
                sum = prevSmoothed * (period - 1) + currentData;
                smoothed.push(sum / period);
            }
        }

        return smoothed;
    }

    /**
     * Calculate EMA (Exponential Moving Average)
     */
    private calculateEMA(data: number[], period: number): number[] {
        const ema: number[] = [];
        const multiplier = 2 / (period + 1);

        // First EMA is SMA
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += data[i] ?? 0;
        }
        ema.push(sum / period);

        // Calculate subsequent EMAs
        for (let i = period; i < data.length; i++) {
            const prevEMA = ema[ema.length - 1] ?? 0;
            const currentData = data[i] ?? 0;
            const newEMA = (currentData * multiplier) + (prevEMA * (1 - multiplier));
            ema.push(newEMA);
        }

        return ema;
    }

    /**
     * Generate mock price data for demonstration
     */
    private generateMockPriceData(symbol: string, limit: number): { high: number; low: number; close: number; timestamp: Date }[] {
        const data: { high: number; low: number; close: number; timestamp: Date }[] = [];
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

// Export singleton instance
export const optionsTechnicalAnalysis = new OptionsTechnicalAnalysisService(); 