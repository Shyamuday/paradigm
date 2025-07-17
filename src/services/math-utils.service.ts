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

      const mean = math.mean(data);
      const median = math.median(data);
      const std = math.std(data);
      const variance = math.variance(data);
      const min = math.min(data);
      const max = math.max(data);
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
      return acc + math.pow((val - mean) / std, 3);
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
      return acc + math.pow((val - mean) / std, 4);
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
        const return_ = (prices[i] - prices[i - 1]) / prices[i - 1];
        returns.push(return_);
      }

      // Calculate cumulative returns
      const cumulativeReturns: number[] = [];
      let cumulative = 1;
      for (const return_ of returns) {
        cumulative *= (1 + return_);
        cumulativeReturns.push(cumulative - 1);
      }

      // Calculate Sharpe ratio (assuming risk-free rate of 0)
      const meanReturn = math.mean(returns);
      const returnStd = math.std(returns);
      const sharpeRatio = returnStd !== 0 ? meanReturn / returnStd : 0;

      // Calculate maximum drawdown
      const maxDrawdown = this.calculateMaxDrawdown(cumulativeReturns);

      // Calculate volatility (annualized)
      const volatility = returnStd * math.sqrt(252); // Assuming daily data

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
    let maxDrawdown = 0;
    let peak = cumulativeReturns[0];

    for (const value of cumulativeReturns) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
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
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = math.floor(confidenceLevel * sortedReturns.length);
    return sortedReturns[index];
  }

  /**
   * Calculate moving average
   */
  calculateMovingAverage(data: number[], period: number): number[] {
    try {
      if (data.length < period) {
        return [];
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
      
      // First EMA is SMA
      let ema = data[0];
      result.push(ema);

      for (let i = 1; i < data.length; i++) {
        ema = (data[i] * multiplier) + (ema * (1 - multiplier));
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
        return [];
      }

      const gains: number[] = [];
      const losses: number[] = [];

      // Calculate price changes
      for (let i = 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? -change : 0);
      }

      const rsi: number[] = [];
      
      // Calculate initial average gain and loss
      let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
      let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

      // Calculate first RSI
      let rs = avgGain / avgLoss;
      let rsiValue = 100 - (100 / (1 + rs));
      rsi.push(rsiValue);

      // Calculate subsequent RSI values
      for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        
        rs = avgGain / avgLoss;
        rsiValue = 100 - (100 / (1 + rs));
        rsi.push(rsiValue);
      }

      logger.debug(`Calculated RSI`, { period, resultCount: rsi.length });
      return rsi;
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
      const fastEMA = this.calculateEMA(data, fastPeriod);
      const slowEMA = this.calculateEMA(data, slowPeriod);

      // Calculate MACD line
      const macd: number[] = [];
      const minLength = math.min(fastEMA.length, slowEMA.length);
      
      for (let i = 0; i < minLength; i++) {
        const macdValue = fastEMA[i] - slowEMA[i];
        macd.push(macdValue);
      }

      // Calculate signal line (EMA of MACD)
      const signal = this.calculateEMA(macd, signalPeriod);

      // Calculate histogram
      const histogram: number[] = [];
      const signalLength = signal.length;
      
      for (let i = 0; i < signalLength; i++) {
        const histValue = macd[macd.length - signalLength + i] - signal[i];
        histogram.push(histValue);
      }

      logger.debug(`Calculated MACD`, { 
        fastPeriod, 
        slowPeriod, 
        signalPeriod, 
        resultCount: histogram.length 
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
      const sma = this.calculateMovingAverage(data, period);
      const upper: number[] = [];
      const middle = sma;
      const lower: number[] = [];

      for (let i = 0; i < sma.length; i++) {
        const startIndex = data.length - sma.length + i - period + 1;
        const endIndex = data.length - sma.length + i + 1;
        const slice = data.slice(math.max(0, startIndex), endIndex);
        
        const std = math.std(slice);
        const upperBand = sma[i] + (stdDev * std);
        const lowerBand = sma[i] - (stdDev * std);
        
        upper.push(upperBand);
        lower.push(lowerBand);
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
   * Calculate correlation coefficient between two arrays
   */
  calculateCorrelation(x: number[], y: number[]): number {
    try {
      if (x.length !== y.length) {
        throw new Error('Arrays must have the same length');
      }

      const n = x.length;
      const sumX = math.sum(x);
      const sumY = math.sum(y);
      const sumXY = x.reduce((acc, val, i) => acc + val * y[i], 0);
      const sumX2 = x.reduce((acc, val) => acc + val * val, 0);
      const sumY2 = y.reduce((acc, val) => acc + val * val, 0);

      const numerator = n * sumXY - sumX * sumY;
      const denominator = math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

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
      if (x.length !== y.length) {
        throw new Error('Arrays must have the same length');
      }

      const n = x.length;
      const sumX = math.sum(x);
      const sumY = math.sum(y);
      const sumXY = x.reduce((acc, val, i) => acc + val * y[i], 0);
      const sumX2 = x.reduce((acc, val) => acc + val * val, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Calculate R-squared
      const yMean = sumY / n;
      const ssRes = y.reduce((acc, val, i) => {
        const predicted = slope * x[i] + intercept;
        return acc + math.pow(val - predicted, 2);
      }, 0);
      const ssTot = y.reduce((acc, val) => acc + math.pow(val - yMean, 2), 0);
      const rSquared = 1 - (ssRes / ssTot);

      logger.debug('Calculated linear regression', { slope, intercept, rSquared });
      return { slope, intercept, rSquared };
    } catch (error) {
      logger.error('Error calculating linear regression', error);
      throw error;
    }
  }

  /**
   * Round to specified decimal places
   */
  round(value: number, decimals: number = 2): number {
    return math.round(value, decimals);
  }

  /**
   * Format number as percentage
   */
  formatPercentage(value: number, decimals: number = 2): string {
    return `${this.round(value * 100, decimals)}%`;
  }

  /**
   * Format number as currency
   */
  formatCurrency(value: number, currency: string = '₹', decimals: number = 2): string {
    return `${currency}${this.round(value, decimals).toLocaleString()}`;
  }
}

// Export singleton instance
export const mathUtils = new MathUtilsService(); 