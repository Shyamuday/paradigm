import * as math from 'mathjs';
import { logger } from '../logger/logger';

export interface StatisticalResult {
  mean: number;
  median: number;
  std: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  skewness: number;
  kurtosis: number;
}

export interface FinancialMetrics {
  returns: number[];
  cumulativeReturns: number[];
  sharpeRatio: number;
  maxDrawdown: number;
  volatility: number;
  var95: number; // Value at Risk 95%
  var99: number; // Value at Risk 99%
}

export class MathUtilsService {
  /**
   * Calculate basic statistics for an array of numbers
   */
  calculateStatistics(data: number[]): StatisticalResult {
    try {
      if (data.length === 0) {
        throw new Error('Cannot calculate statistics for empty array');
      }

      const mean = Number(math.mean(data));
      const median = Number(math.median(data));
      const std = Number(math.std(data));
      const variance = Number(math.variance(data));
      const min = Number(math.min(data));
      const max = Number(math.max(data));
      const range = max - min;

      // Calculate skewness
      const skewness = this.calculateSkewness(data, mean, std);

      // Calculate kurtosis
      const kurtosis = this.calculateKurtosis(data, mean, std);

      logger.debug('Calculated statistics', {
        count: data.length,
        mean,
        std,
        range
      });

      return {
        mean,
        median,
        std,
        variance,
        min,
        max,
        range,
        skewness,
        kurtosis
      };
    } catch (error) {
      logger.error('Error calculating statistics', error);
      throw error;
    }
  }

  /**
   * Calculate skewness (measure of asymmetry)
   */
  private calculateSkewness(data: number[], mean: number, std: number): number {
    if (std === 0) return 0;

    const n = data.length;
    const sum = data.reduce((acc, val) => {
      return acc + Number(math.pow((val - mean) / std, 3));
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
      return acc + Number(math.pow((val - mean) / std, 4));
    }, 0);

    return (n * (n + 1) / ((n - 1) * (n - 2) * (n - 3))) * sum - (3 * (n - 1) * (n - 1) / ((n - 2) * (n - 3)));
  }

  /**
   * Calculate financial metrics from price data
   */
  calculateFinancialMetrics(prices: number[]): FinancialMetrics {
    try {
      if (prices.length < 2) {
        throw new Error('Need at least 2 price points for financial calculations');
      }

      // Calculate returns
      const returns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        const prevPrice = prices[i - 1];
        const currentPrice = prices[i];
        if (prevPrice !== undefined && currentPrice !== undefined) {
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
      const meanReturn = Number(math.mean(returns));
      const returnStd = Number(math.std(returns));
      const sharpeRatio = returnStd !== 0 ? meanReturn / returnStd : 0;

      // Calculate maximum drawdown
      const maxDrawdown = this.calculateMaxDrawdown(cumulativeReturns);

      // Calculate volatility (annualized)
      const volatility = returnStd * Number(math.sqrt(252)); // Assuming daily data

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
    let peak = cumulativeReturns[0] ?? 0;
    for (const value of cumulativeReturns) {
      if (value !== undefined && value > peak) {
        peak = value;
      }
      if (peak === 0) continue;
      const drawdown = (peak - (value ?? 0)) / peak;
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
   * Calculate moving average
   */
  calculateMovingAverage(data: number[], period: number): number[] {
    try {
      if (data.length < period) {
        throw new Error(`Insufficient data: need ${period} points, got ${data.length}`);
      }

      const result: number[] = [];
      for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }

      logger.debug(`Calculated moving average`, { period, resultCount: result.length });
      return result;
    } catch (error) {
      logger.error('Error calculating moving average', error);
      throw error;
    }
  }

  /**
   * Calculate exponential moving average
   */
  calculateEMA(data: number[], period: number): number[] {
    try {
      if (data.length === 0) return [];
      const multiplier = 2 / (period + 1);
      const result: number[] = [];
      let ema = data[0] ?? 0;
      result.push(ema);
      for (let i = 1; i < data.length; i++) {
        const currentValue = data[i] ?? 0;
        ema = (currentValue * multiplier) + (ema * (1 - multiplier));
        result.push(ema);
      }
      logger.debug(`Calculated EMA`, { period, resultCount: result.length });
      return result;
    } catch (error) {
      logger.error('Error calculating EMA', error);
      throw error;
    }
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  calculateRSI(data: number[], period: number = 14): number[] {
    try {
      if (data.length < period + 1) {
        throw new Error(`Insufficient data for RSI: need ${period + 1} points, got ${data.length}`);
      }

      const gains: number[] = [];
      const losses: number[] = [];

      // Calculate price changes
      for (let i = 1; i < data.length; i++) {
        const currentValue = data[i];
        const prevValue = data[i - 1];

        if (currentValue !== undefined && prevValue !== undefined) {
          const change = currentValue - prevValue;
          gains.push(change > 0 ? change : 0);
          losses.push(change < 0 ? -change : 0);
        }
      }

      const result: number[] = [];
      let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

      // Calculate first RSI
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      result.push(rsi);

      // Calculate subsequent RSI values
      for (let i = period; i < gains.length; i++) {
        const currentGain = gains[i];
        const currentLoss = losses[i];

        if (currentGain !== undefined && currentLoss !== undefined) {
          avgGain = (avgGain * (period - 1) + currentGain) / period;
          avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

          const rs = avgGain / avgLoss;
          const rsi = 100 - (100 / (1 + rs));
          result.push(rsi);
        }
      }

      logger.debug(`Calculated RSI`, { period, resultCount: result.length });
      return result;
    } catch (error) {
      logger.error('Error calculating RSI', error);
      throw error;
    }
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  calculateMACD(data: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): {
    macd: number[];
    signal: number[];
    histogram: number[];
  } {
    try {
      if (data.length < slowPeriod) {
        throw new Error(`Insufficient data for MACD: need ${slowPeriod} points, got ${data.length}`);
      }

      const fastEMA = this.calculateEMA(data, fastPeriod);
      const slowEMA = this.calculateEMA(data, slowPeriod);

      // Calculate MACD line
      const macd: number[] = [];
      for (let i = 0; i < slowEMA.length; i++) {
        const fastValue = fastEMA[i];
        const slowValue = slowEMA[i];

        if (fastValue !== undefined && slowValue !== undefined) {
          const macdValue = fastValue - slowValue;
          macd.push(macdValue);
        }
      }

      // Calculate signal line
      const signal = this.calculateEMA(macd, signalPeriod);

      // Calculate histogram
      const histogram: number[] = [];
      const signalLength = signal.length;
      for (let i = 0; i < signalLength; i++) {
        const macdValue = macd[macd.length - signalLength + i];
        const signalValue = signal[i];

        if (macdValue !== undefined && signalValue !== undefined) {
          const histValue = macdValue - signalValue;
          histogram.push(histValue);
        }
      }

      logger.debug(`Calculated MACD`, {
        fastPeriod,
        slowPeriod,
        signalPeriod,
        resultCount: macd.length
      });

      return { macd, signal, histogram };
    } catch (error) {
      logger.error('Error calculating MACD', error);
      throw error;
    }
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(data: number[], period: number = 20, stdDev: number = 2): {
    upper: number[];
    middle: number[];
    lower: number[];
  } {
    try {
      if (data.length < period) {
        throw new Error(`Insufficient data for Bollinger Bands: need ${period} points, got ${data.length}`);
      }

      const sma = this.calculateMovingAverage(data, period);
      const upper: number[] = [];
      const middle: number[] = [];
      const lower: number[] = [];

      for (let i = 0; i < sma.length; i++) {
        const startIndex = i;
        const endIndex = startIndex + period;
        const slice = data.slice(startIndex, endIndex);

        const std = Number(math.std(slice));
        const smaValue = sma[i];

        if (smaValue !== undefined) {
          const upperBand = smaValue + (stdDev * std);
          const lowerBand = smaValue - (stdDev * std);

          upper.push(upperBand);
          middle.push(smaValue);
          lower.push(lowerBand);
        }
      }

      logger.debug(`Calculated Bollinger Bands`, {
        period,
        stdDev,
        resultCount: upper.length
      });

      return { upper, middle, lower };
    } catch (error) {
      logger.error('Error calculating Bollinger Bands', error);
      throw error;
    }
  }

  /**
   * Calculate correlation coefficient
   */
  calculateCorrelation(x: number[], y: number[]): number {
    try {
      if (x.length !== y.length || x.length === 0) {
        throw new Error('Arrays must have same length and be non-empty');
      }

      const n = x.length;
      const sumX = x.reduce((acc, val) => acc + val, 0);
      const sumY = y.reduce((acc, val) => acc + val, 0);
      const sumXY = x.reduce((acc, val, i) => {
        const yVal = y[i];
        return acc + val * (yVal || 0);
      }, 0);
      const sumX2 = x.reduce((acc, val) => acc + val * val, 0);
      const sumY2 = y.reduce((acc, val) => acc + val * val, 0);

      const numerator = n * sumXY - sumX * sumY;
      const denominator = Number(math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)));

      return denominator !== 0 ? numerator / denominator : 0;
    } catch (error) {
      logger.error('Error calculating correlation', error);
      throw error;
    }
  }

  /**
   * Calculate linear regression
   */
  calculateLinearRegression(x: number[], y: number[]): {
    slope: number;
    intercept: number;
    rSquared: number;
  } {
    try {
      if (x.length !== y.length || x.length < 2) {
        throw new Error('Arrays must have same length and at least 2 points');
      }

      const n = x.length;
      const sumX = x.reduce((acc, val) => acc + val, 0);
      const sumY = y.reduce((acc, val) => acc + val, 0);
      const sumXY = x.reduce((acc, val, i) => {
        const yVal = y[i];
        return acc + val * (yVal || 0);
      }, 0);
      const sumX2 = x.reduce((acc, val) => acc + val * val, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Calculate R-squared
      const yMean = sumY / n;
      const ssRes = y.reduce((acc, val, i) => {
        const xVal = x[i];
        if (xVal !== undefined) {
          const predicted = slope * xVal + intercept;
          return acc + Number(math.pow(val - predicted, 2));
        }
        return acc;
      }, 0);
      const ssTot = y.reduce((acc, val) => acc + Number(math.pow(val - yMean, 2)), 0);
      const rSquared = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

      logger.debug('Calculated linear regression', { slope, intercept, rSquared });
      return { slope, intercept, rSquared };
    } catch (error) {
      logger.error('Error calculating linear regression', error);
      throw error;
    }
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
}

// Export singleton instance
export const mathUtils = new MathUtilsService(); 