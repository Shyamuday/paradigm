import { SMA, EMA, RSI, MACD, BollingerBands, ADX, ATR, Stochastic, WilliamsR } from 'technicalindicators';
import { mean, standardDeviation } from 'simple-statistics';
import { MarketData } from '../schemas/strategy.schema';
import { logger } from '../logger/logger';
import * as math from 'mathjs';

export interface BollingerBandsResult {
    upper: number[];
    middle: number[];
    lower: number[];
    percentB: number[];
}

export interface MACDResult {
    macd: number[];
    signal: number[];
    histogram: number[];
}

export interface ADXResult {
    adx: number[];
    diPlus: number[];
    diMinus: number[];
}

export interface StochasticResult {
    k: number[];
    d: number[];
}

export class EnhancedTechnicalIndicatorsService {
    private static instance: EnhancedTechnicalIndicatorsService;
    private cache: Map<string, any> = new Map();
    private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

    static getInstance(): EnhancedTechnicalIndicatorsService {
        if (!EnhancedTechnicalIndicatorsService.instance) {
            EnhancedTechnicalIndicatorsService.instance = new EnhancedTechnicalIndicatorsService();
        }
        return EnhancedTechnicalIndicatorsService.instance;
    }

    /**
     * Calculate Simple Moving Average using technicalindicators package
     */
    calculateSMA(prices: number[], period: number): number[] {
        const cacheKey = `sma_${period}_${prices.slice(-10).join(',')}`;

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const sma = new SMA({ period, values: prices });
            const result = sma.getResult();
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            logger.error('Error calculating SMA:', error);
            return [];
        }
    }

    /**
     * Calculate Exponential Moving Average using technicalindicators package
     */
    calculateEMA(prices: number[], period: number): number[] {
        const cacheKey = `ema_${period}_${prices.slice(-10).join(',')}`;

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const ema = new EMA({ period, values: prices });
            const result = ema.getResult();
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            logger.error('Error calculating EMA:', error);
            return [];
        }
    }

    /**
     * Calculate Relative Strength Index using technicalindicators package
     */
    calculateRSI(prices: number[], period: number): number[] {
        const cacheKey = `rsi_${period}_${prices.slice(-10).join(',')}`;

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const rsi = new RSI({ period, values: prices });
            const result = rsi.getResult();
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            logger.error('Error calculating RSI:', error);
            return [];
        }
    }

    /**
 * Calculate MACD using technicalindicators package
 */
    calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MACDResult {
        const cacheKey = `macd_${fastPeriod}_${slowPeriod}_${signalPeriod}_${prices.slice(-10).join(',')}`;

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const macd = new MACD({
                values: prices,
                fastPeriod,
                slowPeriod,
                signalPeriod,
                SimpleMAOscillator: true,
                SimpleMASignal: true
            });
            const result = macd.getResult();
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            logger.error('Error calculating MACD:', error);
            return { macd: [], signal: [], histogram: [] };
        }
    }

    /**
     * Calculate Bollinger Bands using technicalindicators package
     */
    calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): BollingerBandsResult {
        const cacheKey = `bb_${period}_${stdDev}_${prices.slice(-10).join(',')}`;

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const bb = new BollingerBands({ period, stdDev, values: prices });
            const result = bb.getResult();
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            logger.error('Error calculating Bollinger Bands:', error);
            return { upper: [], middle: [], lower: [], percentB: [] };
        }
    }

    /**
     * Calculate ADX using technicalindicators package
     */
    calculateADX(high: number[], low: number[], close: number[], period: number = 14): ADXResult {
        const cacheKey = `adx_${period}_${high.slice(-5).join(',')}_${low.slice(-5).join(',')}`;

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const adx = new ADX({ period, high, low, close });
            const result = adx.getResult();
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            logger.error('Error calculating ADX:', error);
            return { adx: [], diPlus: [], diMinus: [] };
        }
    }

    /**
     * Calculate ATR using technicalindicators package
     */
    calculateATR(high: number[], low: number[], close: number[], period: number = 14): number[] {
        const cacheKey = `atr_${period}_${high.slice(-5).join(',')}_${low.slice(-5).join(',')}`;

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const atr = new ATR({ period, high, low, close });
            const result = atr.getResult();
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            logger.error('Error calculating ATR:', error);
            return [];
        }
    }

    /**
 * Calculate Stochastic Oscillator using technicalindicators package
 */
    calculateStochastic(high: number[], low: number[], close: number[], period: number = 14): StochasticResult {
        const cacheKey = `stoch_${period}_${high.slice(-5).join(',')}_${low.slice(-5).join(',')}`;

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const stoch = new Stochastic({
                period,
                high,
                low,
                close,
                signalPeriod: 3
            });
            const result = stoch.getResult();
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            logger.error('Error calculating Stochastic:', error);
            return { k: [], d: [] };
        }
    }

    /**
     * Calculate Williams %R using technicalindicators package
     */
    calculateWilliamsR(high: number[], low: number[], close: number[], period: number = 14): number[] {
        const cacheKey = `williamsr_${period}_${high.slice(-5).join(',')}_${low.slice(-5).join(',')}`;

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const williamsR = new WilliamsR({ period, high, low, close });
            const result = williamsR.getResult();
            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            logger.error('Error calculating Williams %R:', error);
            return [];
        }
    }

    /**
     * Calculate VWAP (Volume Weighted Average Price)
     */
    calculateVWAP(marketData: MarketData[]): number[] {
        const cacheKey = `vwap_${marketData.slice(-5).map(d => `${d.close}_${d.volume}`).join(',')}`;

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const result: number[] = [];
            let cumulativeTPV = 0; // Total Price * Volume
            let cumulativeVolume = 0;

            for (const data of marketData) {
                const high = data.high || 0;
                const low = data.low || 0;
                const close = data.close || 0;
                const typicalPrice = (high + low + close) / 3;
                const volume = data.volume || 0;

                cumulativeTPV += typicalPrice * volume;
                cumulativeVolume += volume;

                const vwap = cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : 0;
                result.push(vwap);
            }

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            logger.error('Error calculating VWAP:', error);
            return [];
        }
    }

    /**
     * Calculate Rate of Change
     */
    calculateROC(prices: number[], period: number = 10): number[] {
        const cacheKey = `roc_${period}_${prices.slice(-10).join(',')}`;

        if (this.isCacheValid(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const result: number[] = [];

            for (let i = 0; i < prices.length; i++) {
                if (i < period) {
                    result.push(0);
                    continue;
                }

                const currentPrice = prices[i] || 0;
                const previousPrice = prices[i - period] || 0;
                const roc = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
                result.push(roc);
            }

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            logger.error('Error calculating ROC:', error);
            return [];
        }
    }

    /**
     * Calculate statistical measures using simple-statistics
     */
    calculateStatistics(values: number[]): {
        mean: number;
        stdDev: number;
        variance: number;
        min: number;
        max: number;
        median: number;
        range: number;
        skewness: number;
        kurtosis: number;
    } {
        try {
            const validValues = values.filter(v => !isNaN(v) && isFinite(v));
            if (validValues.length === 0) {
                return {
                    mean: 0, stdDev: 0, variance: 0, min: 0, max: 0,
                    median: 0, range: 0, skewness: 0, kurtosis: 0
                };
            }

            const meanValue = mean(validValues);
            const stdDevValue = standardDeviation(validValues);
            const varianceValue = Math.pow(stdDevValue, 2);
            const minValue = Math.min(...validValues);
            const maxValue = Math.max(...validValues);
            const rangeValue = maxValue - minValue;

            // Calculate median
            const sortedValues = [...validValues].sort((a, b) => a - b);
            const mid = Math.floor(sortedValues.length / 2);
            const medianValue = sortedValues.length % 2 === 0
                ? ((sortedValues[mid - 1] || 0) + (sortedValues[mid] || 0)) / 2
                : (sortedValues[mid] || 0);

            // Calculate skewness
            const skewnessValue = this.calculateSkewness(validValues, meanValue, stdDevValue);

            // Calculate kurtosis
            const kurtosisValue = this.calculateKurtosis(validValues, meanValue, stdDevValue);

            return {
                mean: meanValue,
                stdDev: stdDevValue,
                variance: varianceValue,
                min: minValue,
                max: maxValue,
                median: medianValue,
                range: rangeValue,
                skewness: skewnessValue,
                kurtosis: kurtosisValue
            };
        } catch (error) {
            logger.error('Error calculating statistics:', error);
            return {
                mean: 0, stdDev: 0, variance: 0, min: 0, max: 0,
                median: 0, range: 0, skewness: 0, kurtosis: 0
            };
        }
    }

    /**
     * Calculate skewness (measure of asymmetry)
     */
    private calculateSkewness(data: number[], mean: number, std: number): number {
        if (std === 0) return 0;

        const n = data.length;
        const sum = data.reduce((acc, val) => {
            return acc + Math.pow((val - mean) / std, 3);
        }, 0);

        return (n / ((n - 1) * (n - 2))) * sum;
    }

    /**
     * Calculate kurtosis (measure of tail heaviness)
     */
    private calculateKurtosis(data: number[], mean: number, std: number): number {
        if (std === 0) return 0;

        const n = data.length;
        const sum = data.reduce((acc, val) => {
            return acc + Math.pow((val - mean) / std, 4);
        }, 0);

        return (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sum - (3 * (n - 1) * (n - 1) / ((n - 2) * (n - 3)));
    }

    /**
     * Calculate financial metrics from price data
     */
    calculateFinancialMetrics(prices: number[]): {
        returns: number[];
        cumulativeReturns: number[];
        sharpeRatio: number;
        maxDrawdown: number;
        volatility: number;
        var95: number;
        var99: number;
    } {
        try {
            if (prices.length < 2) {
                throw new Error('Need at least 2 price points for financial calculations');
            }

            // Calculate returns
            const returns: number[] = [];
            for (let i = 1; i < prices.length; i++) {
                const prevPrice = prices[i - 1];
                const currentPrice = prices[i];
                if (prevPrice !== undefined && currentPrice !== undefined && prevPrice > 0) {
                    const return_ = (currentPrice - prevPrice) / prevPrice;
                    returns.push(return_);
                }
            }

            // Calculate cumulative returns
            const cumulativeReturns: number[] = [];
            let cumulative = 1;
            for (const return_ of returns) {
                cumulative *= (1 + return_);
                cumulativeReturns.push(cumulative - 1);
            }

            // Calculate Sharpe ratio (assuming risk-free rate of 0)
            const meanReturn = mean(returns);
            const returnStd = standardDeviation(returns);
            const sharpeRatio = returnStd !== 0 ? meanReturn / returnStd : 0;

            // Calculate maximum drawdown
            const maxDrawdown = this.calculateMaxDrawdown(cumulativeReturns);

            // Calculate volatility (annualized)
            const volatility = returnStd * Math.sqrt(252); // Assuming daily data

            // Calculate Value at Risk
            const var95 = this.calculateVaR(returns, 0.05);
            const var99 = this.calculateVaR(returns, 0.01);

            logger.debug('Calculated financial metrics', {
                sharpeRatio,
                maxDrawdown,
                volatility
            });

            return {
                returns,
                cumulativeReturns,
                sharpeRatio,
                maxDrawdown,
                volatility,
                var95,
                var99
            };
        } catch (error) {
            logger.error('Error calculating financial metrics', error);
            throw error;
        }
    }

    /**
     * Calculate maximum drawdown
     */
    private calculateMaxDrawdown(cumulativeReturns: number[]): number {
        if (cumulativeReturns.length === 0) return 0;
        let maxDrawdown = 0;
        let peak = cumulativeReturns[0] || 0;
        for (const value of cumulativeReturns) {
            if (value !== undefined && value > peak) {
                peak = value;
            }
            if (peak === 0) continue;
            const drawdown = (peak - (value || 0)) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }
        return maxDrawdown;
    }

    /**
     * Calculate Value at Risk (VaR)
     */
    private calculateVaR(returns: number[], confidenceLevel: number): number {
        if (returns.length === 0) return 0;

        const sortedReturns = [...returns].sort((a, b) => a - b);
        const index = Math.floor(confidenceLevel * sortedReturns.length);
        return sortedReturns[index] || 0;
    }

    /**
     * Round a number to specified decimal places
     */
    round(value: number, decimals: number = 2): number {
        return Number(math.round(value, decimals));
    }

    /**
     * Format a number as percentage
     */
    formatPercentage(value: number, decimals: number = 2): string {
        return `${this.round(value * 100, decimals)}%`;
    }

    /**
     * Format a number as currency
     */
    formatCurrency(value: number, currency: string = '₹', decimals: number = 2): string {
        return `${currency}${this.round(value, decimals).toLocaleString()}`;
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    private isCacheValid(key: string): boolean {
        // Simple cache validation - in production, add timestamp checking
        return this.cache.has(key);
    }
}

// Export singleton instance
export const enhancedTechnicalIndicators = EnhancedTechnicalIndicatorsService.getInstance(); 