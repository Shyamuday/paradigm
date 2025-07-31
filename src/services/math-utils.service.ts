import * as math from 'mathjs';
import { logger } from '../logger/logger';
import { enhancedTechnicalIndicators } from './enhanced-technical-indicators.service';

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
  // Basic statistics moved to enhanced-technical-indicators.service.ts
  // Use enhancedTechnicalIndicators.calculateStatistics()

  // Skewness and kurtosis calculations moved to enhanced-technical-indicators.service.ts

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

  // Technical indicators moved to enhanced-technical-indicators.service.ts
  // Use enhancedTechnicalIndicators.calculateSMA(), calculateEMA(), calculateRSI(), etc.

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