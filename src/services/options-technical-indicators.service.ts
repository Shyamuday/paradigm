import { logger } from '../logger/logger';
import {
    MarketData,
    CandleData,
    OptionsContract,
    TimeframeConfig
} from '../types';

// Technical indicator interfaces
interface TechnicalIndicator {
    name: string;
    value: number;
    timestamp: Date;
    timeframe: string;
    metadata?: any;
}

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

interface OptionsTechnicalAnalysis {
    contractId: string;
    underlyingSymbol: string;
    strikePrice: number;
    optionType: string;
    expiryDate: Date;
    timeframe: string;
    indicators: {
        adx?: ADXResult;
        rsi?: RSIResult;
        macd?: MACDResult;
        bollingerBands?: BollingerBandsResult;
        [key: string]: any;
    };
    timestamp: Date;
}

export class OptionsTechnicalIndicatorsService {
    private supportedTimeframes: string[] = ['1min', '3min', '5min', '15min', '30min', '1hour', '1day'];
    private supportedIndicators: string[] = ['ADX', 'RSI', 'MACD', 'BOLLINGER_BANDS', 'STOCHASTIC', 'CCI', 'WILLIAMS_R'];

    constructor() {
        logger.info('Options Technical Indicators Service initialized');
    }

    /**
     * Apply ADX indicator to options data
     */
    async calculateADXForOptions(
        optionsContract: OptionsContract,
        timeframe: string,
        period: number = 14
    ): Promise<ADXResult | null> {
        try {
            // Get underlying price data for the specified timeframe
            const underlyingData = await this.getUnderlyingDataForTimeframe(
                optionsContract.underlyingSymbol,
                timeframe,
                period + 20 // Extra data for calculations
            );

            if (!underlyingData || underlyingData.length < period + 1) {
                logger.warn(`Insufficient data for ADX calculation on ${optionsContract.underlyingSymbol} ${timeframe}`);
                return null;
            }

            const adxResult = this.calculateADX(underlyingData, period);

            if (adxResult) {
                logger.info(`ADX calculated for ${optionsContract.underlyingSymbol} ${timeframe}: ${adxResult.adx.toFixed(2)}`);
            }

            return adxResult;
        } catch (error) {
            logger.error(`Error calculating ADX for options: ${error}`);
            return null;
        }
    }

    /**
     * Apply RSI indicator to options data
     */
    async calculateRSIForOptions(
        optionsContract: OptionsContract,
        timeframe: string,
        period: number = 14
    ): Promise<RSIResult | null> {
        try {
            const underlyingData = await this.getUnderlyingDataForTimeframe(
                optionsContract.underlyingSymbol,
                timeframe,
                period + 10
            );

            if (!underlyingData || underlyingData.length < period + 1) {
                logger.warn(`Insufficient data for RSI calculation on ${optionsContract.underlyingSymbol} ${timeframe}`);
                return null;
            }

            const rsiResult = this.calculateRSI(underlyingData, period);

            if (rsiResult) {
                logger.info(`RSI calculated for ${optionsContract.underlyingSymbol} ${timeframe}: ${rsiResult.rsi.toFixed(2)}`);
            }

            return rsiResult;
        } catch (error) {
            logger.error(`Error calculating RSI for options: ${error}`);
            return null;
        }
    }

    /**
     * Apply MACD indicator to options data
     */
    async calculateMACDForOptions(
        optionsContract: OptionsContract,
        timeframe: string,
        fastPeriod: number = 12,
        slowPeriod: number = 26,
        signalPeriod: number = 9
    ): Promise<MACDResult | null> {
        try {
            const underlyingData = await this.getUnderlyingDataForTimeframe(
                optionsContract.underlyingSymbol,
                timeframe,
                slowPeriod + signalPeriod + 10
            );

            if (!underlyingData || underlyingData.length < slowPeriod + signalPeriod) {
                logger.warn(`Insufficient data for MACD calculation on ${optionsContract.underlyingSymbol} ${timeframe}`);
                return null;
            }

            const macdResult = this.calculateMACD(underlyingData, fastPeriod, slowPeriod, signalPeriod);

            if (macdResult) {
                logger.info(`MACD calculated for ${optionsContract.underlyingSymbol} ${timeframe}: ${macdResult.macd.toFixed(4)}`);
            }

            return macdResult;
        } catch (error) {
            logger.error(`Error calculating MACD for options: ${error}`);
            return null;
        }
    }

    /**
     * Apply Bollinger Bands to options data
     */
    async calculateBollingerBandsForOptions(
        optionsContract: OptionsContract,
        timeframe: string,
        period: number = 20,
        standardDeviations: number = 2
    ): Promise<BollingerBandsResult | null> {
        try {
            const underlyingData = await this.getUnderlyingDataForTimeframe(
                optionsContract.underlyingSymbol,
                timeframe,
                period + 5
            );

            if (!underlyingData || underlyingData.length < period) {
                logger.warn(`Insufficient data for Bollinger Bands calculation on ${optionsContract.underlyingSymbol} ${timeframe}`);
                return null;
            }

            const bbResult = this.calculateBollingerBands(underlyingData, period, standardDeviations);

            if (bbResult) {
                logger.info(`Bollinger Bands calculated for ${optionsContract.underlyingSymbol} ${timeframe}`);
            }

            return bbResult;
        } catch (error) {
            logger.error(`Error calculating Bollinger Bands for options: ${error}`);
            return null;
        }
    }

    /**
     * Comprehensive technical analysis for options
     */
    async performTechnicalAnalysisForOptions(
        optionsContract: OptionsContract,
        timeframe: string,
        indicators: string[] = ['ADX', 'RSI', 'MACD', 'BOLLINGER_BANDS']
    ): Promise<OptionsTechnicalAnalysis | null> {
        try {
            logger.info(`Performing technical analysis for ${optionsContract.underlyingSymbol} ${timeframe}`);

            const analysis: OptionsTechnicalAnalysis = {
                contractId: optionsContract.id,
                underlyingSymbol: optionsContract.underlyingSymbol,
                strikePrice: optionsContract.strikePrice,
                optionType: optionsContract.optionType,
                expiryDate: optionsContract.expiryDate,
                timeframe,
                indicators: {},
                timestamp: new Date()
            };

            // Calculate requested indicators
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
                        logger.warn(`Unsupported indicator: ${indicator}`);
                }
            }

            logger.info(`Technical analysis completed for ${optionsContract.underlyingSymbol} ${timeframe}`);
            return analysis;
        } catch (error) {
            logger.error(`Error performing technical analysis for options: ${error}`);
            return null;
        }
    }

    /**
     * Get underlying price data for specific timeframe
     */
    private async getUnderlyingDataForTimeframe(
        underlyingSymbol: string,
        timeframe: string,
        limit: number = 100
    ): Promise<CandleData[] | null> {
        try {
            // This would typically query your database
            // For now, we'll simulate the data retrieval
            logger.info(`Fetching ${timeframe} data for ${underlyingSymbol}, limit: ${limit}`);

            // TODO: Implement actual database query
            // const data = await prisma.candleData.findMany({
            //   where: {
            //     instrument: { underlyingSymbol },
            //     timeframe: { name: timeframe }
            //   },
            //   orderBy: { timestamp: 'desc' },
            //   take: limit
            // });

            // For demonstration, return mock data
            return this.generateMockCandleData(underlyingSymbol, timeframe, limit);
        } catch (error) {
            logger.error(`Error fetching underlying data: ${error}`);
            return null;
        }
    }

    /**
     * Calculate ADX (Average Directional Index)
     */
    private calculateADX(data: CandleData[], period: number = 14): ADXResult | null {
        if (data.length < period + 1) return null;

        const high = data.map(d => d.high);
        const low = data.map(d => d.low);
        const close = data.map(d => d.close);

        const plusDM: number[] = [];
        const minusDM: number[] = [];
        const trueRange: number[] = [];

        // Calculate True Range and Directional Movement
        for (let i = 1; i < data.length; i++) {
            const tr = Math.max(
                high[i] - low[i],
                Math.abs(high[i] - close[i - 1]),
                Math.abs(low[i] - close[i - 1])
            );
            trueRange.push(tr);

            const highDiff = high[i] - high[i - 1];
            const lowDiff = low[i - 1] - low[i];

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
        const plusDI = (smoothedPlusDM[smoothedPlusDM.length - 1] / smoothedTR[smoothedTR.length - 1]) * 100;
        const minusDI = (smoothedMinusDM[smoothedMinusDM.length - 1] / smoothedTR[smoothedTR.length - 1]) * 100;

        // Calculate DX and ADX
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

    /**
     * Calculate RSI (Relative Strength Index)
     */
    private calculateRSI(data: CandleData[], period: number = 14): RSIResult | null {
        if (data.length < period + 1) return null;

        const gains: number[] = [];
        const losses: number[] = [];

        // Calculate gains and losses
        for (let i = 1; i < data.length; i++) {
            const change = data[i].close - data[i - 1].close;
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }

        // Calculate average gains and losses
        const avgGain = gains.slice(-period).reduce((sum, gain) => sum + gain, 0) / period;
        const avgLoss = losses.slice(-period).reduce((sum, loss) => sum + loss, 0) / period;

        // Calculate RSI
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));

        return {
            rsi,
            timestamp: data[data.length - 1].timestamp,
            timeframe: data[0].timeframe?.name || 'unknown'
        };
    }

    /**
     * Calculate MACD (Moving Average Convergence Divergence)
     */
    private calculateMACD(
        data: CandleData[],
        fastPeriod: number = 12,
        slowPeriod: number = 26,
        signalPeriod: number = 9
    ): MACDResult | null {
        if (data.length < slowPeriod + signalPeriod) return null;

        const close = data.map(d => d.close);

        // Calculate EMAs
        const fastEMA = this.calculateEMA(close, fastPeriod);
        const slowEMA = this.calculateEMA(close, slowPeriod);

        // Calculate MACD line
        const macdLine = fastEMA[fastEMA.length - 1] - slowEMA[slowEMA.length - 1];

        // Calculate signal line
        const macdValues = fastEMA.map((fast, i) => fast - slowEMA[i]);
        const signalLine = this.calculateEMA(macdValues, signalPeriod)[signalPeriod - 1];

        // Calculate histogram
        const histogram = macdLine - signalLine;

        return {
            macd: macdLine,
            signal: signalLine,
            histogram,
            timestamp: data[data.length - 1].timestamp,
            timeframe: data[0].timeframe?.name || 'unknown'
        };
    }

    /**
     * Calculate Bollinger Bands
     */
    private calculateBollingerBands(
        data: CandleData[],
        period: number = 20,
        standardDeviations: number = 2
    ): BollingerBandsResult | null {
        if (data.length < period) return null;

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

    /**
     * Smooth data using Wilder's smoothing method
     */
    private smooth(data: number[], period: number): number[] {
        const smoothed: number[] = [];
        let sum = 0;

        for (let i = 0; i < data.length; i++) {
            if (i < period) {
                sum += data[i];
                smoothed.push(sum / (i + 1));
            } else {
                sum = smoothed[i - 1] * (period - 1) + data[i];
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
            sum += data[i];
        }
        ema.push(sum / period);

        // Calculate subsequent EMAs
        for (let i = period; i < data.length; i++) {
            const newEMA = (data[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier));
            ema.push(newEMA);
        }

        return ema;
    }

    /**
     * Generate mock candle data for demonstration
     */
    private generateMockCandleData(symbol: string, timeframe: string, limit: number): CandleData[] {
        const data: CandleData[] = [];
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

    /**
     * Get supported timeframes
     */
    getSupportedTimeframes(): string[] {
        return this.supportedTimeframes;
    }

    /**
     * Get supported indicators
     */
    getSupportedIndicators(): string[] {
        return this.supportedIndicators;
    }

    /**
     * Validate timeframe
     */
    isValidTimeframe(timeframe: string): boolean {
        return this.supportedTimeframes.includes(timeframe);
    }

    /**
     * Validate indicator
     */
    isValidIndicator(indicator: string): boolean {
        return this.supportedIndicators.includes(indicator.toUpperCase());
    }
}

// Export singleton instance
export const optionsTechnicalIndicators = new OptionsTechnicalIndicatorsService(); 