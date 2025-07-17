import {
  SMA, EMA, RSI, MACD, BollingerBands, Stochastic, ATR, ADX,
  WilliamsR, CCI, MFI, OBV, VWAP, Supertrend, ParabolicSAR
} from 'technicalindicators';
import { logger } from '../logger/logger';
import { MarketData } from '../schemas/strategy.schema';

export interface IndicatorResult {
  value: number | number[];
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface IndicatorConfig {
  period?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
  standardDeviation?: number;
  multiplier?: number;
  overbought?: number;
  oversold?: number;
  [key: string]: any;
}

export class TechnicalIndicatorsService {
  private cache = new Map<string, IndicatorResult>();

  /**
   * Calculate Simple Moving Average (SMA)
   */
  calculateSMA(data: MarketData[], period: number): IndicatorResult[] {
    try {
      const prices = data.map(d => d.close);
      const smaValues = SMA.calculate({ period, values: prices });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < smaValues.length; i++) {
        results.push({
          value: smaValues[i],
          timestamp: data[data.length - smaValues.length + i].timestamp,
          metadata: { period, type: 'SMA' }
        });
      }
      
      logger.debug(`Calculated SMA for period ${period}`, { count: results.length });
      return results;
    } catch (error) {
      logger.error('Error calculating SMA', error);
      throw error;
    }
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   */
  calculateEMA(data: MarketData[], period: number): IndicatorResult[] {
    try {
      const prices = data.map(d => d.close);
      const emaValues = EMA.calculate({ period, values: prices });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < emaValues.length; i++) {
        results.push({
          value: emaValues[i],
          timestamp: data[data.length - emaValues.length + i].timestamp,
          metadata: { period, type: 'EMA' }
        });
      }
      
      logger.debug(`Calculated EMA for period ${period}`, { count: results.length });
      return results;
    } catch (error) {
      logger.error('Error calculating EMA', error);
      throw error;
    }
  }

  /**
   * Calculate Relative Strength Index (RSI)
   */
  calculateRSI(data: MarketData[], period: number = 14): IndicatorResult[] {
    try {
      const prices = data.map(d => d.close);
      const rsiValues = RSI.calculate({ period, values: prices });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < rsiValues.length; i++) {
        results.push({
          value: rsiValues[i],
          timestamp: data[data.length - rsiValues.length + i].timestamp,
          metadata: { period, type: 'RSI' }
        });
      }
      
      logger.debug(`Calculated RSI for period ${period}`, { count: results.length });
      return results;
    } catch (error) {
      logger.error('Error calculating RSI', error);
      throw error;
    }
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  calculateMACD(data: MarketData[], config: IndicatorConfig = {}): IndicatorResult[] {
    try {
      const {
        fastPeriod = 12,
        slowPeriod = 26,
        signalPeriod = 9
      } = config;

      const prices = data.map(d => d.close);
      const macdValues = MACD.calculate({
        fastPeriod,
        slowPeriod,
        signalPeriod,
        values: prices
      });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < macdValues.length; i++) {
        const macd = macdValues[i];
        results.push({
          value: [macd.MACD, macd.signal, macd.histogram],
          timestamp: data[data.length - macdValues.length + i].timestamp,
          metadata: { 
            fastPeriod, 
            slowPeriod, 
            signalPeriod, 
            type: 'MACD',
            macd: macd.MACD,
            signal: macd.signal,
            histogram: macd.histogram
          }
        });
      }
      
      logger.debug(`Calculated MACD`, { count: results.length, config });
      return results;
    } catch (error) {
      logger.error('Error calculating MACD', error);
      throw error;
    }
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(data: MarketData[], config: IndicatorConfig = {}): IndicatorResult[] {
    try {
      const {
        period = 20,
        standardDeviation = 2
      } = config;

      const prices = data.map(d => d.close);
      const bbValues = BollingerBands.calculate({
        period,
        values: prices,
        stdDev: standardDeviation
      });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < bbValues.length; i++) {
        const bb = bbValues[i];
        results.push({
          value: [bb.upper, bb.middle, bb.lower],
          timestamp: data[data.length - bbValues.length + i].timestamp,
          metadata: { 
            period, 
            standardDeviation, 
            type: 'BollingerBands',
            upper: bb.upper,
            middle: bb.middle,
            lower: bb.lower
          }
        });
      }
      
      logger.debug(`Calculated Bollinger Bands`, { count: results.length, config });
      return results;
    } catch (error) {
      logger.error('Error calculating Bollinger Bands', error);
      throw error;
    }
  }

  /**
   * Calculate Stochastic Oscillator
   */
  calculateStochastic(data: MarketData[], config: IndicatorConfig = {}): IndicatorResult[] {
    try {
      const {
        period = 14,
        signalPeriod = 3
      } = config;

      const input = data.map(d => ({
        high: d.high,
        low: d.low,
        close: d.close
      }));

      const stochValues = Stochastic.calculate({
        period,
        signalPeriod,
        high: input.map(d => d.high),
        low: input.map(d => d.low),
        close: input.map(d => d.close)
      });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < stochValues.length; i++) {
        const stoch = stochValues[i];
        results.push({
          value: [stoch.k, stoch.d],
          timestamp: data[data.length - stochValues.length + i].timestamp,
          metadata: { 
            period, 
            signalPeriod, 
            type: 'Stochastic',
            k: stoch.k,
            d: stoch.d
          }
        });
      }
      
      logger.debug(`Calculated Stochastic`, { count: results.length, config });
      return results;
    } catch (error) {
      logger.error('Error calculating Stochastic', error);
      throw error;
    }
  }

  /**
   * Calculate Average True Range (ATR)
   */
  calculateATR(data: MarketData[], period: number = 14): IndicatorResult[] {
    try {
      const input = data.map(d => ({
        high: d.high,
        low: d.low,
        close: d.close
      }));

      const atrValues = ATR.calculate({
        period,
        high: input.map(d => d.high),
        low: input.map(d => d.low),
        close: input.map(d => d.close)
      });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < atrValues.length; i++) {
        results.push({
          value: atrValues[i],
          timestamp: data[data.length - atrValues.length + i].timestamp,
          metadata: { period, type: 'ATR' }
        });
      }
      
      logger.debug(`Calculated ATR for period ${period}`, { count: results.length });
      return results;
    } catch (error) {
      logger.error('Error calculating ATR', error);
      throw error;
    }
  }

  /**
   * Calculate Average Directional Index (ADX)
   */
  calculateADX(data: MarketData[], period: number = 14): IndicatorResult[] {
    try {
      const input = data.map(d => ({
        high: d.high,
        low: d.low,
        close: d.close
      }));

      const adxValues = ADX.calculate({
        period,
        high: input.map(d => d.high),
        low: input.map(d => d.low),
        close: input.map(d => d.close)
      });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < adxValues.length; i++) {
        const adx = adxValues[i];
        results.push({
          value: [adx.adx, adx.plusDI, adx.minusDI],
          timestamp: data[data.length - adxValues.length + i].timestamp,
          metadata: { 
            period, 
            type: 'ADX',
            adx: adx.adx,
            plusDI: adx.plusDI,
            minusDI: adx.minusDI
          }
        });
      }
      
      logger.debug(`Calculated ADX for period ${period}`, { count: results.length });
      return results;
    } catch (error) {
      logger.error('Error calculating ADX', error);
      throw error;
    }
  }

  /**
   * Calculate Williams %R
   */
  calculateWilliamsR(data: MarketData[], period: number = 14): IndicatorResult[] {
    try {
      const input = data.map(d => ({
        high: d.high,
        low: d.low,
        close: d.close
      }));

      const wrValues = WilliamsR.calculate({
        period,
        high: input.map(d => d.high),
        low: input.map(d => d.low),
        close: input.map(d => d.close)
      });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < wrValues.length; i++) {
        results.push({
          value: wrValues[i],
          timestamp: data[data.length - wrValues.length + i].timestamp,
          metadata: { period, type: 'WilliamsR' }
        });
      }
      
      logger.debug(`Calculated Williams %R for period ${period}`, { count: results.length });
      return results;
    } catch (error) {
      logger.error('Error calculating Williams %R', error);
      throw error;
    }
  }

  /**
   * Calculate Commodity Channel Index (CCI)
   */
  calculateCCI(data: MarketData[], period: number = 20): IndicatorResult[] {
    try {
      const input = data.map(d => ({
        high: d.high,
        low: d.low,
        close: d.close
      }));

      const cciValues = CCI.calculate({
        period,
        high: input.map(d => d.high),
        low: input.map(d => d.low),
        close: input.map(d => d.close)
      });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < cciValues.length; i++) {
        results.push({
          value: cciValues[i],
          timestamp: data[data.length - cciValues.length + i].timestamp,
          metadata: { period, type: 'CCI' }
        });
      }
      
      logger.debug(`Calculated CCI for period ${period}`, { count: results.length });
      return results;
    } catch (error) {
      logger.error('Error calculating CCI', error);
      throw error;
    }
  }

  /**
   * Calculate Money Flow Index (MFI)
   */
  calculateMFI(data: MarketData[], period: number = 14): IndicatorResult[] {
    try {
      const input = data.map(d => ({
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume
      }));

      const mfiValues = MFI.calculate({
        period,
        high: input.map(d => d.high),
        low: input.map(d => d.low),
        close: input.map(d => d.close),
        volume: input.map(d => d.volume)
      });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < mfiValues.length; i++) {
        results.push({
          value: mfiValues[i],
          timestamp: data[data.length - mfiValues.length + i].timestamp,
          metadata: { period, type: 'MFI' }
        });
      }
      
      logger.debug(`Calculated MFI for period ${period}`, { count: results.length });
      return results;
    } catch (error) {
      logger.error('Error calculating MFI', error);
      throw error;
    }
  }

  /**
   * Calculate On Balance Volume (OBV)
   */
  calculateOBV(data: MarketData[]): IndicatorResult[] {
    try {
      const input = data.map(d => ({
        close: d.close,
        volume: d.volume
      }));

      const obvValues = OBV.calculate({
        close: input.map(d => d.close),
        volume: input.map(d => d.volume)
      });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < obvValues.length; i++) {
        results.push({
          value: obvValues[i],
          timestamp: data[data.length - obvValues.length + i].timestamp,
          metadata: { type: 'OBV' }
        });
      }
      
      logger.debug(`Calculated OBV`, { count: results.length });
      return results;
    } catch (error) {
      logger.error('Error calculating OBV', error);
      throw error;
    }
  }

  /**
   * Calculate Volume Weighted Average Price (VWAP)
   */
  calculateVWAP(data: MarketData[]): IndicatorResult[] {
    try {
      const input = data.map(d => ({
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume
      }));

      const vwapValues = VWAP.calculate({
        high: input.map(d => d.high),
        low: input.map(d => d.low),
        close: input.map(d => d.close),
        volume: input.map(d => d.volume)
      });
      
      const results: IndicatorResult[] = [];
      for (let i = 0; i < vwapValues.length; i++) {
        results.push({
          value: vwapValues[i],
          timestamp: data[data.length - vwapValues.length + i].timestamp,
          metadata: { type: 'VWAP' }
        });
      }
      
      logger.debug(`Calculated VWAP`, { count: results.length });
      return results;
    } catch (error) {
      logger.error('Error calculating VWAP', error);
      throw error;
    }
  }

  /**
   * Get the latest value of an indicator
   */
  getLatestValue(data: MarketData[], indicator: string, config: IndicatorConfig = {}): number | null {
    try {
      let results: IndicatorResult[] = [];

      switch (indicator.toUpperCase()) {
        case 'SMA':
          results = this.calculateSMA(data, config.period || 20);
          break;
        case 'EMA':
          results = this.calculateEMA(data, config.period || 20);
          break;
        case 'RSI':
          results = this.calculateRSI(data, config.period || 14);
          break;
        case 'ATR':
          results = this.calculateATR(data, config.period || 14);
          break;
        case 'CCI':
          results = this.calculateCCI(data, config.period || 20);
          break;
        case 'MFI':
          results = this.calculateMFI(data, config.period || 14);
          break;
        case 'WILLIAMSR':
          results = this.calculateWilliamsR(data, config.period || 14);
          break;
        default:
          logger.warn(`Unknown indicator: ${indicator}`);
          return null;
      }

      if (results.length === 0) return null;

      const latest = results[results.length - 1];
      const value = Array.isArray(latest.value) ? latest.value[0] : latest.value;
      
      return typeof value === 'number' ? value : null;
    } catch (error) {
      logger.error(`Error getting latest value for ${indicator}`, error);
      return null;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Technical indicators cache cleared');
  }
}

// Export singleton instance
export const technicalIndicators = new TechnicalIndicatorsService(); 