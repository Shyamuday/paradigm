import { db } from '../database/database';

export interface StrategyConfig {
    name: string;
    rsiRange: { min: number; max: number };
    confidenceThreshold: number;
    timeFilters: { avoid: string[] };
    marketTrendFilters: { avoid: string[] };
    volatilityThreshold: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    positionSizePercent: number;
    maxPositions: number;
    timeframe: string;
    symbols: string[];
}

export interface TradeSignal {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    price: number;
    confidence: number;
    rsi: number;
    sma20: number;
    sma50: number;
    reasoning: string;
    timestamp: Date;
}

export interface TradeResult {
    symbol: string;
    action: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPercent: number;
    success: boolean;
    closeReason: string;
    entryTime: Date;
    exitTime: Date;
    confidence: number;
    rsi: number;
}

export class AdaptiveStrategyService {
    private config: StrategyConfig;

    constructor(config: StrategyConfig) {
        this.config = config;
    }

    // Predefined strategy configurations
    static getStrategyConfig(strategyName: string): StrategyConfig {
        const strategies: { [key: string]: StrategyConfig } = {
            'conservative': {
                name: 'Conservative',
                rsiRange: { min: 45, max: 55 },
                confidenceThreshold: 0.85,
                timeFilters: { avoid: ['09:00', '09:15', '09:30', '15:00', '15:15', '15:30'] },
                marketTrendFilters: { avoid: ['DOWNTREND', 'UPTREND'] },
                volatilityThreshold: 0.01,
                stopLossPercent: 0.01,
                takeProfitPercent: 0.02,
                positionSizePercent: 0.02,
                maxPositions: 3,
                timeframe: '15min',
                symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK']
            },
            'moderate': {
                name: 'Moderate',
                rsiRange: { min: 40, max: 60 },
                confidenceThreshold: 0.80,
                timeFilters: { avoid: ['09:15', '15:15'] },
                marketTrendFilters: { avoid: ['DOWNTREND', 'UPTREND'] },
                volatilityThreshold: 0.015,
                stopLossPercent: 0.015,
                takeProfitPercent: 0.025,
                positionSizePercent: 0.03,
                maxPositions: 5,
                timeframe: '15min',
                symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN']
            },
            'aggressive': {
                name: 'Aggressive',
                rsiRange: { min: 35, max: 65 },
                confidenceThreshold: 0.75,
                timeFilters: { avoid: [] },
                marketTrendFilters: { avoid: [] },
                volatilityThreshold: 0.02,
                stopLossPercent: 0.02,
                takeProfitPercent: 0.03,
                positionSizePercent: 0.05,
                maxPositions: 8,
                timeframe: '15min',
                symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK']
            },
            'filtered': {
                name: 'Filtered Basic',
                rsiRange: { min: 40, max: 60 },
                confidenceThreshold: 0.80,
                timeFilters: { avoid: ['09:15', '15:15'] },
                marketTrendFilters: { avoid: ['DOWNTREND', 'UPTREND'] },
                volatilityThreshold: 0.02,
                stopLossPercent: 0.01,
                takeProfitPercent: 0.02,
                positionSizePercent: 0.03,
                maxPositions: 5,
                timeframe: '15min',
                symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN']
            },
            'paper-trading': {
                name: 'Paper Trading',
                rsiRange: { min: 40, max: 60 },
                confidenceThreshold: 0.75,
                timeFilters: { avoid: ['09:15', '15:15'] },
                marketTrendFilters: { avoid: ['DOWNTREND', 'UPTREND'] },
                volatilityThreshold: 0.02,
                stopLossPercent: 0.01,
                takeProfitPercent: 0.02,
                positionSizePercent: 0.02,
                maxPositions: 10,
                timeframe: '15min',
                symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA']
            }
        };

        return strategies[strategyName] || strategies['moderate'];
    }

    async analyzeSymbol(symbol: string): Promise<TradeSignal | null> {
        try {
            const data = await this.getSymbolData(symbol);
            if (data.length < 50) return null;

            const current = data[data.length - 1]!;

            // Apply filters
            if (!this.passFilters(current, data)) {
                return null;
            }

            // Calculate indicators
            const rsi = this.calculateRSI(data);
            const sma20 = this.calculateSMA(data, 20);
            const sma50 = this.calculateSMA(data, 50);

            // Generate signal
            const signal = this.generateSignal(current.close, rsi, sma20, sma50);
            const confidence = this.calculateConfidence(rsi, sma20, sma50, current.close);

            if (signal.action === 'HOLD' || confidence < this.config.confidenceThreshold) {
                return null;
            }

            return {
                symbol,
                action: signal.action,
                price: current.close,
                confidence,
                rsi,
                sma20,
                sma50,
                reasoning: signal.reasoning,
                timestamp: current.timestamp
            };

        } catch (error) {
            console.error(`Error analyzing ${symbol}:`, error);
            return null;
        }
    }

    private async getSymbolData(symbol: string): Promise<any[]> {
        const data = await db.candleData.findMany({
            where: {
                instrument: { symbol },
                timeframe: { name: this.config.timeframe }
            },
            orderBy: { timestamp: 'desc' },
            take: 100
        });

        return data.reverse();
    }

    private passFilters(candle: any, data: any[]): boolean {
        // Time filter
        const timeOfDay = candle.timestamp.toTimeString().substring(0, 5);
        if (this.config.timeFilters.avoid.includes(timeOfDay)) {
            return false;
        }

        // Market trend filter
        const marketTrend = this.getMarketTrend(data);
        if (this.config.marketTrendFilters.avoid.includes(marketTrend)) {
            return false;
        }

        // Volatility filter
        const volatility = this.calculateVolatility(data);
        if (volatility > this.config.volatilityThreshold) {
            return false;
        }

        return true;
    }

    private calculateRSI(data: any[], period: number = 14): number {
        if (data.length < period + 1) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = data.length - period; i < data.length; i++) {
            const change = data[i]!.close - data[i - 1]!.close;
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private calculateSMA(data: any[], period: number): number {
        if (data.length < period) return data[data.length - 1]!.close;

        const sum = data.slice(-period).reduce((acc, candle) => acc + candle.close, 0);
        return sum / period;
    }

    private generateSignal(price: number, rsi: number, sma20: number, sma50: number): { action: 'BUY' | 'SELL' | 'HOLD'; reasoning: string } {
        const priceToSMA20 = Math.abs((price - sma20) / sma20);

        // Buy conditions
        if (rsi < this.config.rsiRange.min && price < sma20 && priceToSMA20 < 0.02) {
            return {
                action: 'BUY',
                reasoning: `RSI oversold (${rsi.toFixed(1)}), price near SMA20 support`
            };
        }

        // Sell conditions
        if (rsi > this.config.rsiRange.max && price > sma20 && priceToSMA20 < 0.02) {
            return {
                action: 'SELL',
                reasoning: `RSI overbought (${rsi.toFixed(1)}), price near SMA20 resistance`
            };
        }

        return { action: 'HOLD', reasoning: 'No clear signal' };
    }

    private calculateConfidence(rsi: number, sma20: number, sma50: number, price: number): number {
        let confidence = 0.5;

        // RSI confidence
        if (rsi < 30 || rsi > 70) confidence += 0.2;
        else if (rsi < 40 || rsi > 60) confidence += 0.1;

        // Price relative to moving averages
        const priceToSMA20 = Math.abs((price - sma20) / sma20);
        if (priceToSMA20 < 0.01) confidence += 0.2;
        else if (priceToSMA20 < 0.02) confidence += 0.1;

        // Moving average alignment
        const smaDiff = Math.abs((sma20 - sma50) / sma50);
        if (smaDiff < 0.02) confidence += 0.1; // Range-bound market

        return Math.min(confidence, 0.95);
    }

    private calculateVolatility(data: any[]): number {
        if (data.length < 2) return 0;

        const returns = data.slice(-10).map((candle, i) =>
            Math.abs((candle.close - data[data.length - 11 + i]!.close) / data[data.length - 11 + i]!.close)
        );

        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        return avgReturn;
    }

    private getMarketTrend(data: any[]): string {
        if (data.length < 10) return 'NEUTRAL';

        const firstHalf = data.slice(0, Math.floor(data.length / 2));
        const secondHalf = data.slice(Math.floor(data.length / 2));

        const firstAvg = firstHalf.reduce((sum, c) => sum + c.close, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, c) => sum + c.close, 0) / secondHalf.length;

        const trend = ((secondAvg - firstAvg) / firstAvg) * 100;

        if (trend > 1) return 'UPTREND';
        if (trend < -1) return 'DOWNTREND';
        return 'NEUTRAL';
    }

    simulateTrade(signal: TradeSignal, nextPrice: number): TradeResult {
        const quantity = Math.floor(100000 * this.config.positionSizePercent / signal.price);
        const stopLoss = signal.action === 'BUY'
            ? signal.price * (1 - this.config.stopLossPercent)
            : signal.price * (1 + this.config.stopLossPercent);
        const takeProfit = signal.action === 'BUY'
            ? signal.price * (1 + this.config.takeProfitPercent)
            : signal.price * (1 - this.config.takeProfitPercent);

        let exitPrice = nextPrice;
        let closeReason = 'End of period';
        let success = false;

        if (signal.action === 'BUY') {
            if (nextPrice <= stopLoss) {
                exitPrice = stopLoss;
                closeReason = 'Stop Loss';
                success = false;
            } else if (nextPrice >= takeProfit) {
                exitPrice = takeProfit;
                closeReason = 'Take Profit';
                success = true;
            } else {
                success = nextPrice > signal.price;
            }
        } else {
            if (nextPrice >= stopLoss) {
                exitPrice = stopLoss;
                closeReason = 'Stop Loss';
                success = false;
            } else if (nextPrice <= takeProfit) {
                exitPrice = takeProfit;
                closeReason = 'Take Profit';
                success = true;
            } else {
                success = nextPrice < signal.price;
            }
        }

        const pnl = signal.action === 'BUY'
            ? (exitPrice - signal.price) * quantity
            : (signal.price - exitPrice) * quantity;

        const pnlPercent = signal.action === 'BUY'
            ? ((exitPrice - signal.price) / signal.price) * 100
            : ((signal.price - exitPrice) / signal.price) * 100;

        return {
            symbol: signal.symbol,
            action: signal.action,
            entryPrice: signal.price,
            exitPrice,
            quantity,
            pnl,
            pnlPercent,
            success,
            closeReason,
            entryTime: signal.timestamp,
            exitTime: new Date(),
            confidence: signal.confidence,
            rsi: signal.rsi
        };
    }

    getConfig(): StrategyConfig {
        return this.config;
    }

    updateConfig(newConfig: Partial<StrategyConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
} 