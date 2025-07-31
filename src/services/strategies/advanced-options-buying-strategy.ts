import { BaseStrategy } from '../strategy-engine.service';
import {
    StrategyConfig,
    TradeSignal as SchemaTradeSignal,
    MarketData as SchemaMarketData,
    Position as SchemaPosition,
    StrategyType
} from '../../schemas/strategy.schema';
import { TradeSignal, MarketData, Position } from '../../types';
import { enhancedTechnicalIndicators } from '../enhanced-technical-indicators.service';
import { logger } from '../../logger/logger';

// Options-specific interfaces
interface OptionContract {
    symbol: string;
    strike: number;
    expiry: Date;
    optionType: 'CE' | 'PE';
    lotSize: number;
    currentPrice: number;
    underlyingPrice: number;
    impliedVolatility: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    openInterest: number;
    volume: number;
    bid: number;
    ask: number;
    lastPrice: number;
}

interface OptionsSignal {
    id: string;
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    side: 'LONG' | 'SHORT';
    quantity: number;
    price: number;
    confidence: number;
    timestamp: Date;
    strategyName: string;
    stopLoss?: number;
    takeProfit?: number;
    reasoning?: string;
    metadata?: Record<string, any>;
    optionType: 'CE' | 'PE';
    strike: number;
    expiry: Date;
    impliedVolatility: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    timeValue: number;
    intrinsicValue: number;
    breakEvenPrice: number;
    maxRisk: number;
    maxReward: number;
    probabilityOfProfit: number;
    daysToExpiry: number;
    volatilityRank: number;
    liquidityScore: number;
}

interface VolatilityAnalysis {
    currentIV: number;
    historicalIV: number;
    ivPercentile: number;
    ivRank: number;
    volatilitySkew: number;
    termStructure: number[];
    volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
}

interface GreeksAnalysis {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    deltaExposure: number;
    gammaExposure: number;
    thetaDecay: number;
    vegaExposure: number;
    riskMetrics: {
        deltaRisk: number;
        gammaRisk: number;
        thetaRisk: number;
        vegaRisk: number;
    };
}

interface MarketCondition {
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'SIDEWAYS';
    volatility: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
    momentum: 'STRONG_UP' | 'WEAK_UP' | 'NEUTRAL' | 'WEAK_DOWN' | 'STRONG_DOWN';
    support: number;
    resistance: number;
    keyLevels: number[];
    breakoutProbability: number;
}

export class AdvancedOptionsBuyingStrategy extends BaseStrategy {
    private volatilityHistory: Map<string, number[]> = new Map();
    private greeksCache: Map<string, GreeksAnalysis> = new Map();
    private marketConditions: Map<string, MarketCondition> = new Map();
    private optionsChain: Map<string, OptionContract[]> = new Map();
    private signalHistory: OptionsSignal[] = [];
    private performanceMetrics: {
        totalSignals: number;
        winningSignals: number;
        losingSignals: number;
        totalPnL: number;
        maxDrawdown: number;
        averageHoldingPeriod: number;
        volatilityCapture: number;
        thetaDecayLoss: number;
    } = {
            totalSignals: 0,
            winningSignals: 0,
            losingSignals: 0,
            totalPnL: 0,
            maxDrawdown: 0,
            averageHoldingPeriod: 0,
            volatilityCapture: 0,
            thetaDecayLoss: 0
        };

    constructor() {
        super(
            'Advanced Options Buying Strategy',
            'OPTIONS',
            '2.0.0',
            'Sophisticated options buying strategy with Greeks analysis, volatility forecasting, and advanced risk management'
        );
    }

    async generateSignals(marketData: SchemaMarketData[]): Promise<SchemaTradeSignal[]> {
        const internalData: MarketData[] = marketData as unknown as MarketData[];
        const signals: OptionsSignal[] = [];

        if (internalData.length < 100) {
            logger.warn('Insufficient data for options strategy');
            return signals as unknown as SchemaTradeSignal[];
        }

        try {
            // Analyze market conditions
            const marketCondition = this.analyzeMarketCondition(internalData);
            this.marketConditions.set(internalData[0]?.symbol || 'UNKNOWN', marketCondition);

            // Analyze volatility
            const volatilityAnalysis = this.analyzeVolatility(internalData);

            // Get options chain data (simulated for now)
            const optionsChain = await this.getOptionsChain(internalData[0]?.symbol || 'UNKNOWN');
            this.optionsChain.set(internalData[0]?.symbol || 'UNKNOWN', optionsChain);

            // Generate signals based on market conditions and volatility
            const callSignals = this.generateCallSignals(internalData, marketCondition, volatilityAnalysis, optionsChain);
            const putSignals = this.generatePutSignals(internalData, marketCondition, volatilityAnalysis, optionsChain);

            signals.push(...callSignals, ...putSignals);

            // Filter signals based on risk management
            const filteredSignals = this.applyOptionsRiskManagement(signals);

            logger.info('Advanced Options Strategy generated signals', {
                symbol: internalData[0]?.symbol,
                totalSignals: signals.length,
                filteredSignals: filteredSignals.length,
                marketCondition: marketCondition.trend,
                volatilityRegime: volatilityAnalysis.volatilityRegime
            });

            return filteredSignals as unknown as SchemaTradeSignal[];

        } catch (error) {
            logger.error('Error generating options signals:', error);
            return [];
        }
    }

    async shouldExit(position: SchemaPosition, marketData: SchemaMarketData[]): Promise<boolean> {
        const internalPosition = position as unknown as Position;
        const internalData: MarketData[] = marketData as unknown as MarketData[];

        if (internalData.length < 50) return false;

        const currentPrice = internalData[internalData.length - 1]?.close || 0;
        if (!currentPrice) return false;

        // Check stop loss and take profit
        if (internalPosition.stopLoss && currentPrice <= internalPosition.stopLoss) {
            return true;
        }

        if (internalPosition.target && currentPrice >= internalPosition.target) {
            return true;
        }

        // Check time-based exit (close to expiry)
        const signal = this.signalHistory.find(s => s.id === internalPosition.id);
        if (signal && signal.daysToExpiry < 3) {
            return true;
        }

        return false;
    }

    private analyzeMarketCondition(marketData: MarketData[]): MarketCondition {
        const prices = marketData.map(d => d.close || 0).filter(p => p > 0);
        const highs = marketData.map(d => d.high || 0).filter(h => h > 0);
        const lows = marketData.map(d => d.low || 0).filter(l => l > 0);

        // Calculate technical indicators
        const sma20 = enhancedTechnicalIndicators.calculateSMA(prices, 20);
        const sma50 = enhancedTechnicalIndicators.calculateSMA(prices, 50);
        const rsi = enhancedTechnicalIndicators.calculateRSI(prices, 14);
        const macd = enhancedTechnicalIndicators.calculateMACD(prices, 12, 26);
        const bb = enhancedTechnicalIndicators.calculateBollingerBands(prices, 20, 2);

        const currentPrice = prices[prices.length - 1] || 0;
        const currentSMA20 = sma20.length > 0 ? (sma20[sma20.length - 1] ?? 0) : 0;
        const currentSMA50 = sma50.length > 0 ? (sma50[sma50.length - 1] ?? 0) : 0;
        const currentRSI = rsi.length > 0 ? (rsi[rsi.length - 1] ?? 50) : 50;
        const currentMACD = macd.macd.length > 0 ? (macd.macd[macd.macd.length - 1] ?? 0) : 0;
        const currentBB = {
            upper: bb.upper.length > 0 ? (bb.upper[bb.upper.length - 1] ?? 0) : 0,
            middle: bb.middle.length > 0 ? (bb.middle[bb.middle.length - 1] ?? 0) : 0,
            lower: bb.lower.length > 0 ? (bb.lower[bb.lower.length - 1] ?? 0) : 0
        };

        // Determine trend
        let trend: MarketCondition['trend'] = 'NEUTRAL';
        if (currentPrice > currentSMA20 && currentSMA20 > currentSMA50 && currentMACD > 0) {
            trend = 'BULLISH';
        } else if (currentPrice < currentSMA20 && currentSMA20 < currentSMA50 && currentMACD < 0) {
            trend = 'BEARISH';
        } else if (Math.abs(currentPrice - currentSMA20) / currentSMA20 < 0.02) {
            trend = 'SIDEWAYS';
        }

        // Determine momentum
        let momentum: MarketCondition['momentum'] = 'NEUTRAL';
        if (currentRSI > 70 && currentPrice > currentBB.upper) {
            momentum = 'STRONG_UP';
        } else if (currentRSI > 60 && currentPrice > currentBB.middle) {
            momentum = 'WEAK_UP';
        } else if (currentRSI < 30 && currentPrice < currentBB.lower) {
            momentum = 'STRONG_DOWN';
        } else if (currentRSI < 40 && currentPrice < currentBB.middle) {
            momentum = 'WEAK_DOWN';
        }

        // Calculate support and resistance
        const support = Math.min(...lows.slice(-20));
        const resistance = Math.max(...highs.slice(-20));

        // Key levels (support, resistance, moving averages)
        const keyLevels = [support, resistance, currentSMA20, currentSMA50].filter((level, index, arr) =>
            arr.indexOf(level) === index && level > 0
        ).sort((a, b) => a - b);

        // Breakout probability
        const breakoutProbability = this.calculateBreakoutProbability(currentPrice, support, resistance, currentBB);

        return {
            trend,
            volatility: 'NORMAL', // Will be updated by volatility analysis
            momentum,
            support,
            resistance,
            keyLevels,
            breakoutProbability
        };
    }

    private analyzeVolatility(marketData: MarketData[]): VolatilityAnalysis {
        const prices = marketData.map(d => d.close || 0).filter(p => p > 0);
        const returns: number[] = [];

        // Calculate returns
        for (let i = 1; i < prices.length; i++) {
            const prevPrice = prices[i - 1];
            const currPrice = prices[i];
            if (prevPrice && currPrice && prevPrice > 0) {
                returns.push((currPrice - prevPrice) / prevPrice);
            }
        }

        // Calculate current volatility (20-day rolling)
        const currentIV = this.calculateImpliedVolatility(returns.slice(-20));

        // Calculate historical volatility (252-day)
        const historicalIV = this.calculateImpliedVolatility(returns.slice(-252));

        // Calculate IV percentile and rank
        const ivPercentile = this.calculateIVPercentile(currentIV, returns);
        const ivRank = this.calculateIVRank(currentIV, returns);

        // Calculate volatility skew
        const volatilitySkew = this.calculateVolatilitySkew(marketData);

        // Term structure (simplified)
        const termStructure = [currentIV, currentIV * 0.9, currentIV * 0.8];

        // Determine volatility regime
        let volatilityRegime: VolatilityAnalysis['volatilityRegime'] = 'NORMAL';
        if (currentIV < historicalIV * 0.7) {
            volatilityRegime = 'LOW';
        } else if (currentIV > historicalIV * 1.3) {
            volatilityRegime = 'HIGH';
        } else if (currentIV > historicalIV * 2.0) {
            volatilityRegime = 'EXTREME';
        }

        return {
            currentIV,
            historicalIV,
            ivPercentile,
            ivRank,
            volatilitySkew,
            termStructure,
            volatilityRegime
        };
    }

    private generateCallSignals(
        marketData: MarketData[],
        marketCondition: MarketCondition,
        volatilityAnalysis: VolatilityAnalysis,
        optionsChain: OptionContract[]
    ): OptionsSignal[] {
        const signals: OptionsSignal[] = [];

        // Only generate call signals in bullish or neutral conditions
        if (marketCondition.trend === 'BEARISH' && marketCondition.momentum === 'STRONG_DOWN') {
            return signals;
        }

        const currentPrice = marketData[marketData.length - 1]?.close || 0;
        const callOptions = optionsChain.filter(option => option.optionType === 'CE');

        for (const option of callOptions) {
            // Skip if option is too far out of the money
            if (option.strike > currentPrice * 1.1) continue;

            // Skip if option is too close to expiry
            const daysToExpiry = this.calculateDaysToExpiry(option.expiry);
            if (daysToExpiry < 7) continue;

            // Calculate Greeks
            const greeks = this.calculateGreeks(option, currentPrice, volatilityAnalysis.currentIV, daysToExpiry);

            // Check entry conditions
            const entryConditions = this.checkCallEntryConditions(
                option,
                marketCondition,
                volatilityAnalysis,
                greeks,
                currentPrice
            );

            if (entryConditions.valid) {
                const lastMarketData = marketData[marketData.length - 1];
                if (lastMarketData) {
                    const signal = this.createOptionsSignal(
                        lastMarketData,
                        'BUY',
                        option,
                        greeks,
                        volatilityAnalysis,
                        entryConditions,
                        'CE'
                    );

                    if (signal) {
                        signals.push(signal);
                    }
                }
            }
        }

        return signals;
    }

    private generatePutSignals(
        marketData: MarketData[],
        marketCondition: MarketCondition,
        volatilityAnalysis: VolatilityAnalysis,
        optionsChain: OptionContract[]
    ): OptionsSignal[] {
        const signals: OptionsSignal[] = [];

        // Only generate put signals in bearish or neutral conditions
        if (marketCondition.trend === 'BULLISH' && marketCondition.momentum === 'STRONG_UP') {
            return signals;
        }

        const currentPrice = marketData[marketData.length - 1]?.close || 0;
        const putOptions = optionsChain.filter(option => option.optionType === 'PE');

        for (const option of putOptions) {
            // Skip if option is too far out of the money
            if (option.strike < currentPrice * 0.9) continue;

            // Skip if option is too close to expiry
            const daysToExpiry = this.calculateDaysToExpiry(option.expiry);
            if (daysToExpiry < 7) continue;

            // Calculate Greeks
            const greeks = this.calculateGreeks(option, currentPrice, volatilityAnalysis.currentIV, daysToExpiry);

            // Check entry conditions
            const entryConditions = this.checkPutEntryConditions(
                option,
                marketCondition,
                volatilityAnalysis,
                greeks,
                currentPrice
            );

            if (entryConditions.valid) {
                const lastMarketData = marketData[marketData.length - 1];
                if (lastMarketData) {
                    const signal = this.createOptionsSignal(
                        lastMarketData,
                        'BUY',
                        option,
                        greeks,
                        volatilityAnalysis,
                        entryConditions,
                        'PE'
                    );

                    if (signal) {
                        signals.push(signal);
                    }
                }
            }
        }

        return signals;
    }

    private checkCallEntryConditions(
        option: OptionContract,
        marketCondition: MarketCondition,
        volatilityAnalysis: VolatilityAnalysis,
        greeks: GreeksAnalysis,
        currentPrice: number
    ): { valid: boolean; strength: number; reasoning: string[] } {
        let score = 0;
        let maxScore = 0;
        const reasoning: string[] = [];

        // 1. Market Trend (25%)
        maxScore += 25;
        if (marketCondition.trend === 'BULLISH') {
            score += 25;
            reasoning.push('Strong bullish trend');
        } else if (marketCondition.trend === 'NEUTRAL' && marketCondition.momentum === 'WEAK_UP') {
            score += 15;
            reasoning.push('Neutral trend with weak upward momentum');
        } else if (marketCondition.breakoutProbability > 0.6) {
            score += 20;
            reasoning.push('High breakout probability');
        }

        // 2. Volatility Analysis (20%)
        maxScore += 20;
        if (volatilityAnalysis.volatilityRegime === 'LOW' && volatilityAnalysis.ivPercentile < 30) {
            score += 20; // Low IV is good for buying calls
            reasoning.push('Low volatility regime - good for buying calls');
        } else if (volatilityAnalysis.volatilityRegime === 'NORMAL') {
            score += 15;
            reasoning.push('Normal volatility regime');
        } else if (volatilityAnalysis.volatilityRegime === 'HIGH') {
            score -= 10; // High IV makes calls expensive
            reasoning.push('High volatility - calls may be expensive');
        }

        // 3. Greeks Analysis (25%)
        maxScore += 25;
        if (greeks.delta > 0.3 && greeks.delta < 0.7) {
            score += 10; // Good delta range
            reasoning.push('Optimal delta range');
        }
        if (greeks.gamma > 0.02) {
            score += 5; // Good gamma for movement
            reasoning.push('Good gamma for price movement');
        }
        if (Math.abs(greeks.theta) < 0.01) {
            score += 10; // Low theta decay
            reasoning.push('Low theta decay');
        }

        // 4. Strike Selection (15%)
        maxScore += 15;
        const moneyness = option.strike / currentPrice;
        if (moneyness >= 0.95 && moneyness <= 1.05) {
            score += 15; // Near the money
            reasoning.push('Near-the-money strike');
        } else if (moneyness > 0.9 && moneyness < 0.95) {
            score += 10; // Slightly ITM
            reasoning.push('Slightly in-the-money strike');
        } else if (moneyness > 1.05 && moneyness < 1.1) {
            score += 8; // Slightly OTM
            reasoning.push('Slightly out-of-the-money strike');
        }

        // 5. Liquidity (15%)
        maxScore += 15;
        const liquidityScore = this.calculateLiquidityScore(option);
        if (liquidityScore > 0.8) {
            score += 15;
            reasoning.push('High liquidity');
        } else if (liquidityScore > 0.6) {
            score += 10;
            reasoning.push('Good liquidity');
        } else if (liquidityScore < 0.3) {
            score -= 10;
            reasoning.push('Low liquidity - avoid');
        }

        const strength = score / maxScore;
        const valid = strength >= 0.6; // Require 60% confidence

        return { valid, strength, reasoning };
    }

    private checkPutEntryConditions(
        option: OptionContract,
        marketCondition: MarketCondition,
        volatilityAnalysis: VolatilityAnalysis,
        greeks: GreeksAnalysis,
        currentPrice: number
    ): { valid: boolean; strength: number; reasoning: string[] } {
        let score = 0;
        let maxScore = 0;
        const reasoning: string[] = [];

        // 1. Market Trend (25%)
        maxScore += 25;
        if (marketCondition.trend === 'BEARISH') {
            score += 25;
            reasoning.push('Strong bearish trend');
        } else if (marketCondition.trend === 'NEUTRAL' && marketCondition.momentum === 'WEAK_DOWN') {
            score += 15;
            reasoning.push('Neutral trend with weak downward momentum');
        } else if (marketCondition.breakoutProbability < 0.4) {
            score += 20;
            reasoning.push('Low breakout probability - bearish');
        }

        // 2. Volatility Analysis (20%)
        maxScore += 20;
        if (volatilityAnalysis.volatilityRegime === 'LOW' && volatilityAnalysis.ivPercentile < 30) {
            score += 20; // Low IV is good for buying puts
            reasoning.push('Low volatility regime - good for buying puts');
        } else if (volatilityAnalysis.volatilityRegime === 'NORMAL') {
            score += 15;
            reasoning.push('Normal volatility regime');
        } else if (volatilityAnalysis.volatilityRegime === 'HIGH') {
            score -= 10; // High IV makes puts expensive
            reasoning.push('High volatility - puts may be expensive');
        }

        // 3. Greeks Analysis (25%)
        maxScore += 25;
        if (greeks.delta < -0.3 && greeks.delta > -0.7) {
            score += 10; // Good delta range for puts
            reasoning.push('Optimal delta range for puts');
        }
        if (greeks.gamma > 0.02) {
            score += 5; // Good gamma for movement
            reasoning.push('Good gamma for price movement');
        }
        if (Math.abs(greeks.theta) < 0.01) {
            score += 10; // Low theta decay
            reasoning.push('Low theta decay');
        }

        // 4. Strike Selection (15%)
        maxScore += 15;
        const moneyness = option.strike / currentPrice;
        if (moneyness >= 0.95 && moneyness <= 1.05) {
            score += 15; // Near the money
            reasoning.push('Near-the-money strike');
        } else if (moneyness > 1.05 && moneyness < 1.1) {
            score += 10; // Slightly ITM for puts
            reasoning.push('Slightly in-the-money strike for puts');
        } else if (moneyness > 0.9 && moneyness < 0.95) {
            score += 8; // Slightly OTM for puts
            reasoning.push('Slightly out-of-the-money strike for puts');
        }

        // 5. Liquidity (15%)
        maxScore += 15;
        const liquidityScore = this.calculateLiquidityScore(option);
        if (liquidityScore > 0.8) {
            score += 15;
            reasoning.push('High liquidity');
        } else if (liquidityScore > 0.6) {
            score += 10;
            reasoning.push('Good liquidity');
        } else if (liquidityScore < 0.3) {
            score -= 10;
            reasoning.push('Low liquidity - avoid');
        }

        const strength = score / maxScore;
        const valid = strength >= 0.6; // Require 60% confidence

        return { valid, strength, reasoning };
    }

    private createOptionsSignal(
        marketData: MarketData,
        action: 'BUY' | 'SELL',
        option: OptionContract,
        greeks: GreeksAnalysis,
        volatilityAnalysis: VolatilityAnalysis,
        entryConditions: { valid: boolean; strength: number; reasoning: string[] },
        optionType: 'CE' | 'PE'
    ): OptionsSignal | null {
        if (!entryConditions.valid || !marketData.symbol) return null;

        const currentPrice = marketData.close || 0;
        const daysToExpiry = this.calculateDaysToExpiry(option.expiry);

        // Calculate option metrics
        const timeValue = option.currentPrice - Math.max(0, optionType === 'CE' ?
            currentPrice - option.strike : option.strike - currentPrice);
        const intrinsicValue = option.currentPrice - timeValue;
        const breakEvenPrice = optionType === 'CE' ?
            option.strike + option.currentPrice : option.strike - option.currentPrice;

        // Risk/Reward calculation
        const maxRisk = option.currentPrice * option.lotSize;
        const maxReward = optionType === 'CE' ?
            (currentPrice * 2 - option.strike) * option.lotSize :
            option.strike * option.lotSize;

        // Probability of profit (simplified)
        const probabilityOfProfit = this.calculateProbabilityOfProfit(
            option, currentPrice, volatilityAnalysis.currentIV, daysToExpiry, optionType
        );

        const signal: OptionsSignal = {
            id: `options_${Date.now()}_${Math.random()}`,
            symbol: option.symbol,
            action,
            side: 'LONG',
            quantity: option.lotSize,
            price: option.currentPrice,
            confidence: entryConditions.strength,
            timestamp: new Date(),
            strategyName: this.name,
            stopLoss: option.currentPrice * 0.5, // 50% stop loss
            takeProfit: option.currentPrice * 2, // 100% profit target
            reasoning: entryConditions.reasoning.join(', '),
            metadata: {
                strategyType: this.type,
                version: this.version,
                signalStrength: entryConditions.strength,
                marketCondition: 'bullish', // Will be updated
                volatilityRegime: volatilityAnalysis.volatilityRegime
            },
            optionType,
            strike: option.strike,
            expiry: option.expiry,
            impliedVolatility: option.impliedVolatility,
            delta: greeks.delta,
            gamma: greeks.gamma,
            theta: greeks.theta,
            vega: greeks.vega,
            timeValue,
            intrinsicValue,
            breakEvenPrice,
            maxRisk,
            maxReward,
            probabilityOfProfit,
            daysToExpiry,
            volatilityRank: volatilityAnalysis.ivRank,
            liquidityScore: this.calculateLiquidityScore(option)
        };

        return signal;
    }

    // Helper methods
    private calculateImpliedVolatility(returns: number[]): number {
        if (returns.length === 0) return 0.2; // Default 20% IV
        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        return Math.sqrt(variance * 252); // Annualized
    }

    private calculateIVPercentile(currentIV: number, returns: number[]): number {
        const historicalIVs: number[] = [];
        for (let i = 20; i < returns.length; i++) {
            const windowReturns = returns.slice(i - 20, i);
            historicalIVs.push(this.calculateImpliedVolatility(windowReturns));
        }

        if (historicalIVs.length === 0) return 50;

        const sortedIVs = historicalIVs.sort((a, b) => a - b);
        const rank = sortedIVs.findIndex(iv => iv >= currentIV);
        return rank === -1 ? 100 : (rank / sortedIVs.length) * 100;
    }

    private calculateIVRank(currentIV: number, returns: number[]): number {
        const historicalIVs: number[] = [];
        for (let i = 20; i < returns.length; i++) {
            const windowReturns = returns.slice(i - 20, i);
            historicalIVs.push(this.calculateImpliedVolatility(windowReturns));
        }

        if (historicalIVs.length === 0) return 50;

        const minIV = Math.min(...historicalIVs);
        const maxIV = Math.max(...historicalIVs);
        const range = maxIV - minIV;

        return range > 0 ? ((currentIV - minIV) / range) * 100 : 50;
    }

    private calculateVolatilitySkew(marketData: MarketData[]): number {
        // Simplified volatility skew calculation
        // In practice, this would compare IV of different strikes
        return 0; // Placeholder
    }

    private calculateBreakoutProbability(currentPrice: number, support: number, resistance: number, bb: any): number {
        const range = resistance - support;
        const position = (currentPrice - support) / range;

        // Higher probability if price is near support or resistance
        if (position < 0.1 || position > 0.9) {
            return 0.8;
        } else if (position < 0.2 || position > 0.8) {
            return 0.6;
        } else {
            return 0.4;
        }
    }

    private calculateGreeks(option: OptionContract, currentPrice: number, iv: number, daysToExpiry: number): GreeksAnalysis {
        // Simplified Greeks calculation
        // In practice, use Black-Scholes or more sophisticated models

        const moneyness = Math.log(currentPrice / option.strike);
        const timeToExpiry = daysToExpiry / 365;

        // Simplified delta calculation
        let delta = 0.5;
        if (option.optionType === 'CE') {
            delta = Math.max(0, Math.min(1, 0.5 + moneyness / (iv * Math.sqrt(timeToExpiry))));
        } else {
            delta = Math.max(-1, Math.min(0, -0.5 + moneyness / (iv * Math.sqrt(timeToExpiry))));
        }

        // Simplified gamma calculation
        const gamma = Math.exp(-Math.pow(moneyness, 2) / (2 * Math.pow(iv, 2) * timeToExpiry)) /
            (currentPrice * iv * Math.sqrt(timeToExpiry) * Math.sqrt(2 * Math.PI));

        // Simplified theta calculation
        const theta = -(currentPrice * iv * gamma) / (2 * Math.sqrt(timeToExpiry));

        // Simplified vega calculation
        const vega = currentPrice * Math.sqrt(timeToExpiry) * gamma;

        return {
            delta,
            gamma,
            theta,
            vega,
            deltaExposure: delta * option.lotSize,
            gammaExposure: gamma * option.lotSize,
            thetaDecay: theta * option.lotSize,
            vegaExposure: vega * option.lotSize,
            riskMetrics: {
                deltaRisk: Math.abs(delta) * 0.01,
                gammaRisk: gamma * 0.01,
                thetaRisk: Math.abs(theta) * 0.01,
                vegaRisk: vega * 0.01
            }
        };
    }

    private calculateDaysToExpiry(expiry: Date): number {
        const now = new Date();
        const diffTime = expiry.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    private calculateLiquidityScore(option: OptionContract): number {
        // Simplified liquidity calculation
        // In practice, consider bid-ask spread, volume, open interest
        const bidAskSpread = (option.ask - option.bid) / option.ask;
        const volumeScore = Math.min(1, option.volume / 1000);
        const oiScore = Math.min(1, option.openInterest / 5000);

        return (1 - bidAskSpread) * 0.4 + volumeScore * 0.3 + oiScore * 0.3;
    }

    private calculateProbabilityOfProfit(
        option: OptionContract,
        currentPrice: number,
        iv: number,
        daysToExpiry: number,
        optionType: 'CE' | 'PE'
    ): number {
        // Simplified probability calculation
        const moneyness = Math.log(currentPrice / option.strike);
        const timeToExpiry = daysToExpiry / 365;

        // Use normal distribution approximation
        const z = moneyness / (iv * Math.sqrt(timeToExpiry));

        if (optionType === 'CE') {
            return 1 - this.normalCDF(z);
        } else {
            return this.normalCDF(z);
        }
    }

    private normalCDF(z: number): number {
        // Simplified normal CDF approximation
        return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
    }

    private erf(x: number): number {
        // Simplified error function approximation
        const a1 = 0.254829592;
        const a2 = -0.284496736;
        const a3 = 1.421413741;
        const a4 = -1.453152027;
        const a5 = 1.061405429;
        const p = 0.3275911;

        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);

        const t = 1 / (1 + p * x);
        const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return sign * y;
    }

    private async getOptionsChain(symbol: string): Promise<OptionContract[]> {
        // Simulated options chain data
        // In practice, this would fetch from your broker's API
        const currentPrice = 100; // Simulated underlying price
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30); // 30 days to expiry

        const options: OptionContract[] = [];

        // Generate call options
        for (let strike = currentPrice * 0.9; strike <= currentPrice * 1.1; strike += 5) {
            options.push({
                symbol: `${symbol}${expiry.getDate()}${expiry.getMonth() + 1}${strike}CE`,
                strike,
                expiry: new Date(expiry),
                optionType: 'CE',
                lotSize: 100,
                currentPrice: Math.max(0, currentPrice - strike) + 2, // Intrinsic + time value
                underlyingPrice: currentPrice,
                impliedVolatility: 0.25,
                delta: 0.5,
                gamma: 0.02,
                theta: -0.01,
                vega: 0.1,
                openInterest: 1000,
                volume: 500,
                bid: Math.max(0, currentPrice - strike) + 1.5,
                ask: Math.max(0, currentPrice - strike) + 2.5,
                lastPrice: Math.max(0, currentPrice - strike) + 2
            });
        }

        // Generate put options
        for (let strike = currentPrice * 0.9; strike <= currentPrice * 1.1; strike += 5) {
            options.push({
                symbol: `${symbol}${expiry.getDate()}${expiry.getMonth() + 1}${strike}PE`,
                strike,
                expiry: new Date(expiry),
                optionType: 'PE',
                lotSize: 100,
                currentPrice: Math.max(0, strike - currentPrice) + 2, // Intrinsic + time value
                underlyingPrice: currentPrice,
                impliedVolatility: 0.25,
                delta: -0.5,
                gamma: 0.02,
                theta: -0.01,
                vega: 0.1,
                openInterest: 1000,
                volume: 500,
                bid: Math.max(0, strike - currentPrice) + 1.5,
                ask: Math.max(0, strike - currentPrice) + 2.5,
                lastPrice: Math.max(0, strike - currentPrice) + 2
            });
        }

        return options;
    }

    private applyOptionsRiskManagement(signals: OptionsSignal[]): OptionsSignal[] {
        return signals.filter(signal => {
            // Filter out signals with too high risk
            if (signal.maxRisk > 10000) return false; // Max risk per trade

            // Filter out signals with too low probability of profit
            if (signal.probabilityOfProfit < 0.3) return false;

            // Filter out signals with too high theta decay
            if (Math.abs(signal.theta) > 0.02) return false;

            // Filter out signals with too low liquidity
            if (signal.liquidityScore < 0.4) return false;

            return true;
        });
    }

    validateConfig(config: StrategyConfig): boolean {
        const baseValid = super.validateConfig(config);
        if (!baseValid) return false;

        // Validate options-specific parameters
        const params = config.parameters;

        return !!(
            typeof params.maxRiskPerTrade === 'number' && params.maxRiskPerTrade > 0 &&
            typeof params.maxPositionSize === 'number' && params.maxPositionSize > 0 &&
            typeof params.minDaysToExpiry === 'number' && params.minDaysToExpiry > 0 &&
            typeof params.maxDaysToExpiry === 'number' && params.maxDaysToExpiry > params.minDaysToExpiry &&
            typeof params.minProbabilityOfProfit === 'number' && params.minProbabilityOfProfit > 0 &&
            typeof params.maxThetaDecay === 'number' && params.maxThetaDecay > 0 &&
            typeof params.minLiquidityScore === 'number' && params.minLiquidityScore > 0
        );
    }

    getState(): any {
        return {
            name: this.name,
            type: this.type,
            version: this.version,
            totalSignals: this.performanceMetrics.totalSignals,
            winningSignals: this.performanceMetrics.winningSignals,
            losingSignals: this.performanceMetrics.losingSignals,
            totalPnL: this.performanceMetrics.totalPnL,
            maxDrawdown: this.performanceMetrics.maxDrawdown,
            averageHoldingPeriod: this.performanceMetrics.averageHoldingPeriod,
            volatilityCapture: this.performanceMetrics.volatilityCapture,
            thetaDecayLoss: this.performanceMetrics.thetaDecayLoss,
            activePositions: this.optionsChain.size,
            marketConditions: Object.fromEntries(this.marketConditions)
        };
    }

    getPerformance(): any {
        const winRate = this.performanceMetrics.totalSignals > 0
            ? (this.performanceMetrics.winningSignals / this.performanceMetrics.totalSignals) * 100
            : 0;

        return {
            name: this.name,
            type: this.type,
            version: this.version,
            totalSignals: this.performanceMetrics.totalSignals,
            winningSignals: this.performanceMetrics.winningSignals,
            losingSignals: this.performanceMetrics.losingSignals,
            winRate: winRate.toFixed(2) + '%',
            totalPnL: this.performanceMetrics.totalPnL.toFixed(2),
            maxDrawdown: this.performanceMetrics.maxDrawdown.toFixed(2),
            averageHoldingPeriod: this.performanceMetrics.averageHoldingPeriod.toFixed(1) + ' days',
            volatilityCapture: this.performanceMetrics.volatilityCapture.toFixed(2),
            thetaDecayLoss: this.performanceMetrics.thetaDecayLoss.toFixed(2),
            averagePnL: this.performanceMetrics.totalSignals > 0
                ? (this.performanceMetrics.totalPnL / this.performanceMetrics.totalSignals).toFixed(2)
                : '0.00'
        };
    }

    async cleanup(): Promise<void> {
        this.volatilityHistory.clear();
        this.greeksCache.clear();
        this.marketConditions.clear();
        this.optionsChain.clear();
        this.signalHistory = [];
        await super.cleanup();
    }
} 