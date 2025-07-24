import {
  SMA, EMA, RSI, MACD, BollingerBands, Stochastic, ATR, ADX,
  WilliamsR, CCI, MFI, OBV, VWAP
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
      const prices = data.map(d => d.close).filter((p): p is number => p !== null);
      const smaValues = SMA.calculate({ period, values: prices });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < smaValues.length; i++) {
        const value = smaValues[i] ?? 0;
        const dataIdx = data.length - smaValues.length + i;
        const timestamp = data[dataIdx]?.timestamp ?? new Date();
        results.push({
          value,
          timestamp,
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
      const prices = data.map(d => d.close).filter((p): p is number => p !== null);
      const emaValues = EMA.calculate({ period, values: prices });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < emaValues.length; i++) {
        const value = emaValues[i] ?? 0;
        const dataIdx = data.length - emaValues.length + i;
        const timestamp = data[dataIdx]?.timestamp ?? new Date();
        results.push({
          value,
          timestamp,
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
  calculateRSI(data: MarketData[], period: number): IndicatorResult[] {
    try {
      const prices = data.map(d => d.close).filter((p): p is number => p !== null);
      const rsiValues = RSI.calculate({ period, values: prices });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < rsiValues.length; i++) {
        const value = rsiValues[i] ?? 0;
        const dataIdx = data.length - rsiValues.length + i;
        const timestamp = data[dataIdx]?.timestamp ?? new Date();
        results.push({
          value,
          timestamp,
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
      const prices = data.map(d => d.close).filter((p): p is number => p !== null);
      const macdValues = MACD.calculate({
        fastPeriod,
        slowPeriod,
        signalPeriod,
        values: prices,
        SimpleMAOscillator: false,
        SimpleMASignal: false
      });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < macdValues.length; i++) {
        const macd = macdValues[i];
        if (!macd) continue;
        results.push({
          value: [macd.MACD ?? 0, macd.signal ?? 0, macd.histogram ?? 0],
          timestamp: data[data.length - macdValues.length + i]?.timestamp ?? new Date(),
          metadata: {
            fastPeriod,
            slowPeriod,
            signalPeriod,
            type: 'MACD',
            macd: macd.MACD ?? 0,
            signal: macd.signal ?? 0,
            histogram: macd.histogram ?? 0
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
      const prices = data.map(d => d.close).filter((p): p is number => p !== null);
      const bbValues = BollingerBands.calculate({
        period,
        values: prices,
        stdDev: standardDeviation
      });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < bbValues.length; i++) {
        const bb = bbValues[i];
        if (!bb) continue;
        results.push({
          value: [bb.upper ?? 0, bb.middle ?? 0, bb.lower ?? 0],
          timestamp: data[data.length - bbValues.length + i]?.timestamp ?? new Date(),
          metadata: {
            period,
            standardDeviation,
            type: 'BollingerBands',
            upper: bb.upper ?? 0,
            middle: bb.middle ?? 0,
            lower: bb.lower ?? 0
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
      const high = data.map(d => d.high).filter((p): p is number => p !== null);
      const low = data.map(d => d.low).filter((p): p is number => p !== null);
      const close = data.map(d => d.close).filter((p): p is number => p !== null);
      const stochValues = Stochastic.calculate({ period, signalPeriod, high, low, close });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < stochValues.length; i++) {
        const stoch = stochValues[i];
        if (!stoch) continue;
        const dataIdx = data.length - stochValues.length + i;
        const timestamp = data[dataIdx]?.timestamp ?? new Date();
        results.push({
          value: [stoch.k ?? 0, stoch.d ?? 0],
          timestamp,
          metadata: { period, signalPeriod, type: 'Stochastic', k: stoch.k ?? 0, d: stoch.d ?? 0 }
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
      const high = data.map(d => d.high).filter((p): p is number => p !== null);
      const low = data.map(d => d.low).filter((p): p is number => p !== null);
      const close = data.map(d => d.close).filter((p): p is number => p !== null);
      const atrValues = ATR.calculate({
        period,
        high,
        low,
        close
      });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < atrValues.length; i++) {
        const value = atrValues[i] ?? 0;
        const dataIdx = data.length - atrValues.length + i;
        const timestamp = data[dataIdx]?.timestamp ?? new Date();
        results.push({
          value,
          timestamp,
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
      const high = data.map(d => d.high).filter((p): p is number => p !== null);
      const low = data.map(d => d.low).filter((p): p is number => p !== null);
      const close = data.map(d => d.close).filter((p): p is number => p !== null);
      const adxValues = ADX.calculate({
        period,
        high,
        low,
        close
      });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < adxValues.length; i++) {
        const adx = adxValues[i];
        if (!adx) continue;
        const dataIdx = data.length - adxValues.length + i;
        const timestamp = data[dataIdx]?.timestamp ?? new Date();
        results.push({
          value: [adx.adx ?? 0, (adx as any).plusDI ?? 0, (adx as any).minusDI ?? 0],
          timestamp,
          metadata: {
            period,
            type: 'ADX',
            adx: adx.adx ?? 0,
            plusDI: (adx as any).plusDI ?? 0,
            minusDI: (adx as any).minusDI ?? 0
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
      const high = data.map(d => d.high).filter((p): p is number => p !== null);
      const low = data.map(d => d.low).filter((p): p is number => p !== null);
      const close = data.map(d => d.close).filter((p): p is number => p !== null);
      const wrValues = WilliamsR.calculate({ period, high, low, close });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < wrValues.length; i++) {
        const value = wrValues[i] ?? 0;
        const dataIdx = data.length - wrValues.length + i;
        const timestamp = data[dataIdx]?.timestamp ?? new Date();
        results.push({
          value,
          timestamp,
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
      const high = data.map(d => d.high).filter((p): p is number => p !== null);
      const low = data.map(d => d.low).filter((p): p is number => p !== null);
      const close = data.map(d => d.close).filter((p): p is number => p !== null);
      const cciValues = CCI.calculate({ period, high, low, close });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < cciValues.length; i++) {
        const value = cciValues[i] ?? 0;
        const dataIdx = data.length - cciValues.length + i;
        const timestamp = data[dataIdx]?.timestamp ?? new Date();
        results.push({
          value,
          timestamp,
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
      const high = data.map(d => d.high).filter((p): p is number => p !== null);
      const low = data.map(d => d.low).filter((p): p is number => p !== null);
      const close = data.map(d => d.close).filter((p): p is number => p !== null);
      const volume = data.map(d => d.volume ?? 0).filter((p): p is number => p !== null);
      const mfiValues = MFI.calculate({ period, high, low, close, volume });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < mfiValues.length; i++) {
        const value = mfiValues[i] ?? 0;
        const dataIdx = data.length - mfiValues.length + i;
        const timestamp = data[dataIdx]?.timestamp ?? new Date();
        results.push({
          value,
          timestamp,
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
      const close = data.map(d => d.close).filter((p): p is number => p !== null);
      const volume = data.map(d => d.volume ?? 0).filter((p): p is number => p !== null);
      const obvValues = OBV.calculate({ close, volume });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < obvValues.length; i++) {
        const value = obvValues[i] ?? 0;
        const dataIdx = data.length - obvValues.length + i;
        const timestamp = data[dataIdx]?.timestamp ?? new Date();
        results.push({
          value,
          timestamp,
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
      const high = data.map(d => d.high).filter((p): p is number => p !== null);
      const low = data.map(d => d.low).filter((p): p is number => p !== null);
      const close = data.map(d => d.close).filter((p): p is number => p !== null);
      const volume = data.map(d => d.volume ?? 0).filter((p): p is number => p !== null);
      const vwapValues = VWAP.calculate({ high, low, close, volume });
      const results: IndicatorResult[] = [];
      for (let i = 0; i < vwapValues.length; i++) {
        const value = vwapValues[i] ?? 0;
        const dataIdx = data.length - vwapValues.length + i;
        const timestamp = data[dataIdx]?.timestamp ?? new Date();
        results.push({
          value,
          timestamp,
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
      if (!latest) return null;
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