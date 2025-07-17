import { BaseStrategy } from '../strategy-engine.service';
import {
    StrategyConfig,
    TradeSignal,
    MarketData,
    Position,
    StrategyType
} from '../../types';

// Options-specific interfaces
interface OptionContract {
    symbol: string;
    strike: number;
    expiry: Date;
    optionType: 'CE' | 'PE'; // Call or Put
    lotSize: number;
    currentPrice: number;
    underlyingPrice: number;
    impliedVolatility: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
}

interface OptionsPosition {
    id: string;
    strategyId: string;
    underlyingSymbol: string;
    contracts: OptionContract[];
    netDelta: number;
    netGamma: number;
    netTheta: number;
    netVega: number;
    maxProfit: number;
    maxLoss: number;
    breakEvenPoints: number[];
    side: 'LONG' | 'SHORT';
    strategyType: OptionsStrategyType;
}

type OptionsStrategyType =
    | 'COVERED_CALL'
    | 'PROTECTIVE_PUT'
    | 'IRON_CONDOR'
    | 'BUTTERFLY_SPREAD'
    | 'STRADDLE'
    | 'STRANGLE'
    | 'BULL_CALL_SPREAD'
    | 'BEAR_PUT_SPREAD'
    | 'CALENDAR_SPREAD'
    | 'DIAGONAL_SPREAD'
    | 'CUSTOM';

export class OptionsStrategy extends BaseStrategy {
    private optionsPositions: Map<string, OptionsPosition> = new Map();

    constructor() {
        super(
            'Options Strategy',
            'OPTIONS_STRATEGY',
            '1.0.0',
            'Comprehensive options trading strategy for various market conditions'
        );
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        const strategyType = this.config.parameters.strategyType || 'COVERED_CALL';

        switch (strategyType) {
            case 'COVERED_CALL':
                signals.push(...await this.generateCoveredCallSignals(marketData));
                break;
            case 'PROTECTIVE_PUT':
                signals.push(...await this.generateProtectivePutSignals(marketData));
                break;
            case 'IRON_CONDOR':
                signals.push(...await this.generateIronCondorSignals(marketData));
                break;
            case 'BUTTERFLY_SPREAD':
                signals.push(...await this.generateButterflySpreadSignals(marketData));
                break;
            case 'STRADDLE':
                signals.push(...await this.generateStraddleSignals(marketData));
                break;
            case 'STRANGLE':
                signals.push(...await this.generateStrangleSignals(marketData));
                break;
            case 'BULL_CALL_SPREAD':
                signals.push(...await this.generateBullCallSpreadSignals(marketData));
                break;
            case 'BEAR_PUT_SPREAD':
                signals.push(...await this.generateBearPutSpreadSignals(marketData));
                break;
            case 'CALENDAR_SPREAD':
                signals.push(...await this.generateCalendarSpreadSignals(marketData));
                break;
            default:
                logger.warn(`Unknown options strategy type: ${strategyType}`);
        }

        return signals;
    }

    async shouldExit(position: Position, marketData: MarketData[]): Promise<boolean> {
        const optionsPosition = this.optionsPositions.get(position.id);
        if (!optionsPosition) return false;

        const currentPrice = marketData[marketData.length - 1]?.close || marketData[marketData.length - 1]?.ltp;
        if (!currentPrice) return false;

        // Check time decay (theta)
        const daysToExpiry = this.calculateDaysToExpiry(optionsPosition.contracts[0]?.expiry);
        if (daysToExpiry <= 5 && optionsPosition.netTheta < -0.1) {
            return true; // Exit if high time decay and close to expiry
        }

        // Check profit target
        const unrealizedPnL = this.calculateUnrealizedPnL(optionsPosition, currentPrice);
        const maxProfit = optionsPosition.maxProfit;
        if (unrealizedPnL >= maxProfit * 0.8) {
            return true; // Exit at 80% of max profit
        }

        // Check loss limit
        const maxLoss = optionsPosition.maxLoss;
        if (unrealizedPnL <= maxLoss * 0.5) {
            return true; // Exit at 50% of max loss
        }

        // Check delta exposure
        if (Math.abs(optionsPosition.netDelta) > this.config.parameters.maxDelta || 0.5) {
            return true; // Exit if delta exposure too high
        }

        return false;
    }

    private async generateCoveredCallSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (marketData.length < 20) return signals;

        const currentData = marketData[marketData.length - 1];
        if (!currentData) return signals;

        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice) return signals;

        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 30;

        // Find optimal strike for covered call
        const optimalStrike = this.findOptimalCoveredCallStrike(
            underlyingPrice,
            volatility,
            daysToExpiry
        );

        if (optimalStrike) {
            const signal = this.createOptionsSignal(
                currentData,
                'SELL',
                {
                    strategyType: 'COVERED_CALL',
                    underlyingSymbol: currentData.symbol,
                    strike: optimalStrike,
                    optionType: 'CE',
                    daysToExpiry,
                    volatility,
                    maxProfit: optimalStrike - underlyingPrice,
                    maxLoss: -underlyingPrice,
                    breakEvenPoint: optimalStrike
                }
            );

            if (signal) {
                signals.push(signal);
            }
        }

        return signals;
    }

    private async generateProtectivePutSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (marketData.length < 20) return signals;

        const currentData = marketData[marketData.length - 1];
        if (!currentData) return signals;

        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice) return signals;

        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 30;

        // Find optimal strike for protective put
        const optimalStrike = this.findOptimalProtectivePutStrike(
            underlyingPrice,
            volatility,
            daysToExpiry
        );

        if (optimalStrike) {
            const signal = this.createOptionsSignal(
                currentData,
                'BUY',
                {
                    strategyType: 'PROTECTIVE_PUT',
                    underlyingSymbol: currentData.symbol,
                    strike: optimalStrike,
                    optionType: 'PE',
                    daysToExpiry,
                    volatility,
                    maxProfit: Infinity,
                    maxLoss: -optimalStrike,
                    breakEvenPoint: underlyingPrice + optimalStrike
                }
            );

            if (signal) {
                signals.push(signal);
            }
        }

        return signals;
    }

    private async generateIronCondorSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (marketData.length < 20) return signals;

        const currentData = marketData[marketData.length - 1];
        if (!currentData) return signals;

        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice) return signals;

        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 45;

        // Calculate iron condor strikes
        const ironCondorStrikes = this.calculateIronCondorStrikes(
            underlyingPrice,
            volatility,
            daysToExpiry
        );

        if (ironCondorStrikes) {
            const signal = this.createOptionsSignal(
                currentData,
                'SELL',
                {
                    strategyType: 'IRON_CONDOR',
                    underlyingSymbol: currentData.symbol,
                    strikes: ironCondorStrikes,
                    daysToExpiry,
                    volatility,
                    maxProfit: ironCondorStrikes.netCredit,
                    maxLoss: ironCondorStrikes.maxLoss,
                    breakEvenPoints: [ironCondorStrikes.putShort, ironCondorStrikes.callShort]
                }
            );

            if (signal) {
                signals.push(signal);
            }
        }

        return signals;
    }

    private async generateButterflySpreadSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (marketData.length < 20) return signals;

        const currentData = marketData[marketData.length - 1];
        if (!currentData) return signals;

        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice) return signals;

        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 30;

        // Calculate butterfly spread strikes
        const butterflyStrikes = this.calculateButterflySpreadStrikes(
            underlyingPrice,
            volatility,
            daysToExpiry
        );

        if (butterflyStrikes) {
            const signal = this.createOptionsSignal(
                currentData,
                'BUY',
                {
                    strategyType: 'BUTTERFLY_SPREAD',
                    underlyingSymbol: currentData.symbol,
                    strikes: butterflyStrikes,
                    daysToExpiry,
                    volatility,
                    maxProfit: butterflyStrikes.maxProfit,
                    maxLoss: butterflyStrikes.netDebit,
                    breakEvenPoints: [butterflyStrikes.lowerBreakEven, butterflyStrikes.upperBreakEven]
                }
            );

            if (signal) {
                signals.push(signal);
            }
        }

        return signals;
    }

    private async generateStraddleSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (marketData.length < 20) return signals;

        const currentData = marketData[marketData.length - 1];
        if (!currentData) return signals;

        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice) return signals;

        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 30;

        // Check if volatility is expected to increase
        const volatilityExpansion = this.detectVolatilityExpansion(marketData);

        if (volatilityExpansion) {
            const signal = this.createOptionsSignal(
                currentData,
                'BUY',
                {
                    strategyType: 'STRADDLE',
                    underlyingSymbol: currentData.symbol,
                    strike: underlyingPrice,
                    daysToExpiry,
                    volatility,
                    maxProfit: Infinity,
                    maxLoss: -this.calculateStraddleCost(underlyingPrice, volatility, daysToExpiry),
                    breakEvenPoints: [
                        underlyingPrice - this.calculateStraddleCost(underlyingPrice, volatility, daysToExpiry),
                        underlyingPrice + this.calculateStraddleCost(underlyingPrice, volatility, daysToExpiry)
                    ]
                }
            );

            if (signal) {
                signals.push(signal);
            }
        }

        return signals;
    }

    private async generateStrangleSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (marketData.length < 20) return signals;

        const currentData = marketData[marketData.length - 1];
        if (!currentData) return signals;

        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice) return signals;

        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 30;

        // Calculate strangle strikes
        const strangleStrikes = this.calculateStrangleStrikes(
            underlyingPrice,
            volatility,
            daysToExpiry
        );

        if (strangleStrikes) {
            const signal = this.createOptionsSignal(
                currentData,
                'BUY',
                {
                    strategyType: 'STRANGLE',
                    underlyingSymbol: currentData.symbol,
                    strikes: strangleStrikes,
                    daysToExpiry,
                    volatility,
                    maxProfit: Infinity,
                    maxLoss: -strangleStrikes.netDebit,
                    breakEvenPoints: [strangleStrikes.putStrike, strangleStrikes.callStrike]
                }
            );

            if (signal) {
                signals.push(signal);
            }
        }

        return signals;
    }

    private async generateBullCallSpreadSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (marketData.length < 20) return signals;

        const currentData = marketData[marketData.length - 1];
        if (!currentData) return signals;

        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice) return signals;

        // Check for bullish trend
        const isBullish = this.detectBullishTrend(marketData);

        if (isBullish) {
            const volatility = this.calculateVolatility(marketData);
            const daysToExpiry = this.config.parameters.daysToExpiry || 30;

            const bullCallStrikes = this.calculateBullCallSpreadStrikes(
                underlyingPrice,
                volatility,
                daysToExpiry
            );

            if (bullCallStrikes) {
                const signal = this.createOptionsSignal(
                    currentData,
                    'BUY',
                    {
                        strategyType: 'BULL_CALL_SPREAD',
                        underlyingSymbol: currentData.symbol,
                        strikes: bullCallStrikes,
                        daysToExpiry,
                        volatility,
                        maxProfit: bullCallStrikes.maxProfit,
                        maxLoss: bullCallStrikes.netDebit,
                        breakEvenPoint: bullCallStrikes.breakEven
                    }
                );

                if (signal) {
                    signals.push(signal);
                }
            }
        }

        return signals;
    }

    private async generateBearPutSpreadSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (marketData.length < 20) return signals;

        const currentData = marketData[marketData.length - 1];
        if (!currentData) return signals;

        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice) return signals;

        // Check for bearish trend
        const isBearish = this.detectBearishTrend(marketData);

        if (isBearish) {
            const volatility = this.calculateVolatility(marketData);
            const daysToExpiry = this.config.parameters.daysToExpiry || 30;

            const bearPutStrikes = this.calculateBearPutSpreadStrikes(
                underlyingPrice,
                volatility,
                daysToExpiry
            );

            if (bearPutStrikes) {
                const signal = this.createOptionsSignal(
                    currentData,
                    'BUY',
                    {
                        strategyType: 'BEAR_PUT_SPREAD',
                        underlyingSymbol: currentData.symbol,
                        strikes: bearPutStrikes,
                        daysToExpiry,
                        volatility,
                        maxProfit: bearPutStrikes.maxProfit,
                        maxLoss: bearPutStrikes.netDebit,
                        breakEvenPoint: bearPutStrikes.breakEven
                    }
                );

                if (signal) {
                    signals.push(signal);
                }
            }
        }

        return signals;
    }

    private async generateCalendarSpreadSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (marketData.length < 20) return signals;

        const currentData = marketData[marketData.length - 1];
        if (!currentData) return signals;

        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice) return signals;

        const volatility = this.calculateVolatility(marketData);
        const shortExpiry = this.config.parameters.shortExpiry || 30;
        const longExpiry = this.config.parameters.longExpiry || 60;

        // Check for low volatility environment
        const isLowVolatility = volatility < this.config.parameters.volatilityThreshold || 0.2;

        if (isLowVolatility) {
            const calendarStrikes = this.calculateCalendarSpreadStrikes(
                underlyingPrice,
                volatility,
                shortExpiry,
                longExpiry
            );

            if (calendarStrikes) {
                const signal = this.createOptionsSignal(
                    currentData,
                    'BUY',
                    {
                        strategyType: 'CALENDAR_SPREAD',
                        underlyingSymbol: currentData.symbol,
                        strikes: calendarStrikes,
                        shortExpiry,
                        longExpiry,
                        volatility,
                        maxProfit: calendarStrikes.maxProfit,
                        maxLoss: calendarStrikes.netDebit,
                        breakEvenPoint: underlyingPrice
                    }
                );

                if (signal) {
                    signals.push(signal);
                }
            }
        }

        return signals;
    }

    // Helper methods for options calculations
    private findOptimalCoveredCallStrike(underlyingPrice: number, volatility: number, daysToExpiry: number): number | null {
        // Find strike with 30-40 delta for covered call
        const targetDelta = 0.35;
        const strike = underlyingPrice * (1 + targetDelta * volatility * Math.sqrt(daysToExpiry / 365));
        return Math.round(strike / 50) * 50; // Round to nearest 50
    }

    private findOptimalProtectivePutStrike(underlyingPrice: number, volatility: number, daysToExpiry: number): number | null {
        // Find strike with 20-30 delta for protective put
        const targetDelta = -0.25;
        const strike = underlyingPrice * (1 + targetDelta * volatility * Math.sqrt(daysToExpiry / 365));
        return Math.round(strike / 50) * 50; // Round to nearest 50
    }

    private calculateIronCondorStrikes(underlyingPrice: number, volatility: number, daysToExpiry: number): any {
        const putShort = Math.round((underlyingPrice * 0.95) / 50) * 50;
        const putLong = putShort - 100;
        const callShort = Math.round((underlyingPrice * 1.05) / 50) * 50;
        const callLong = callShort + 100;

        // Simplified credit calculation
        const netCredit = 50; // Assume 50 points credit
        const maxLoss = 50; // Width of spread - credit

        return {
            putLong,
            putShort,
            callShort,
            callLong,
            netCredit,
            maxLoss
        };
    }

    private calculateButterflySpreadStrikes(underlyingPrice: number, volatility: number, daysToExpiry: number): any {
        const centerStrike = Math.round(underlyingPrice / 50) * 50;
        const lowerStrike = centerStrike - 100;
        const upperStrike = centerStrike + 100;

        // Simplified profit/loss calculation
        const maxProfit = 50; // Maximum profit at center strike
        const netDebit = 25; // Net cost of butterfly

        return {
            lowerStrike,
            centerStrike,
            upperStrike,
            maxProfit,
            netDebit,
            lowerBreakEven: centerStrike - netDebit,
            upperBreakEven: centerStrike + netDebit
        };
    }

    private calculateStrangleStrikes(underlyingPrice: number, volatility: number, daysToExpiry: number): any {
        const putStrike = Math.round((underlyingPrice * 0.90) / 50) * 50;
        const callStrike = Math.round((underlyingPrice * 1.10) / 50) * 50;
        const netDebit = 30; // Simplified cost calculation

        return {
            putStrike,
            callStrike,
            netDebit
        };
    }

    private calculateBullCallSpreadStrikes(underlyingPrice: number, volatility: number, daysToExpiry: number): any {
        const callLong = Math.round(underlyingPrice / 50) * 50;
        const callShort = callLong + 100;
        const maxProfit = 50;
        const netDebit = 25;

        return {
            callLong,
            callShort,
            maxProfit,
            netDebit,
            breakEven: callLong + netDebit
        };
    }

    private calculateBearPutSpreadStrikes(underlyingPrice: number, volatility: number, daysToExpiry: number): any {
        const putShort = Math.round(underlyingPrice / 50) * 50;
        const putLong = putShort - 100;
        const maxProfit = 50;
        const netDebit = 25;

        return {
            putLong,
            putShort,
            maxProfit,
            netDebit,
            breakEven: putShort - netDebit
        };
    }

    private calculateCalendarSpreadStrikes(underlyingPrice: number, volatility: number, shortExpiry: number, longExpiry: number): any {
        const strike = Math.round(underlyingPrice / 50) * 50;
        const maxProfit = 20;
        const netDebit = 10;

        return {
            strike,
            shortExpiry,
            longExpiry,
            maxProfit,
            netDebit
        };
    }

    private calculateStraddleCost(underlyingPrice: number, volatility: number, daysToExpiry: number): number {
        // Simplified straddle cost calculation
        return underlyingPrice * volatility * Math.sqrt(daysToExpiry / 365) * 2;
    }

    private detectVolatilityExpansion(marketData: MarketData[]): boolean {
        if (marketData.length < 20) return false;

        const recentVolatility = this.calculateVolatility(marketData.slice(-10));
        const historicalVolatility = this.calculateVolatility(marketData.slice(-20, -10));

        return recentVolatility > historicalVolatility * 1.2; // 20% increase
    }

    private detectBullishTrend(marketData: MarketData[]): boolean {
        if (marketData.length < 20) return false;

        const shortMA = this.calculateSMA(marketData, 10);
        const longMA = this.calculateSMA(marketData, 20);

        const currentShortMA = shortMA[shortMA.length - 1];
        const currentLongMA = longMA[longMA.length - 1];

        return currentShortMA && currentLongMA && currentShortMA > currentLongMA;
    }

    private detectBearishTrend(marketData: MarketData[]): boolean {
        if (marketData.length < 20) return false;

        const shortMA = this.calculateSMA(marketData, 10);
        const longMA = this.calculateSMA(marketData, 20);

        const currentShortMA = shortMA[shortMA.length - 1];
        const currentLongMA = longMA[longMA.length - 1];

        return currentShortMA && currentLongMA && currentShortMA < currentLongMA;
    }

    private calculateVolatility(marketData: MarketData[]): number {
        if (marketData.length < 2) return 0;

        const returns = [];
        for (let i = 1; i < marketData.length; i++) {
            const currentPrice = marketData[i]?.close || marketData[i]?.ltp;
            const prevPrice = marketData[i - 1]?.close || marketData[i - 1]?.ltp;

            if (currentPrice && prevPrice) {
                returns.push(Math.log(currentPrice / prevPrice));
            }
        }

        if (returns.length === 0) return 0;

        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;

        return Math.sqrt(variance * 252); // Annualized volatility
    }

    private calculateSMA(data: MarketData[], period: number): (number | null)[] {
        const sma: (number | null)[] = new Array(data.length).fill(null);

        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            let count = 0;

            for (let j = i - period + 1; j <= i; j++) {
                const price = data[j]?.close || data[j]?.ltp;
                if (typeof price === 'number') {
                    sum += price;
                    count++;
                }
            }

            if (count === period) {
                sma[i] = sum / period;
            }
        }

        return sma;
    }

    private calculateDaysToExpiry(expiry: Date): number {
        const now = new Date();
        const diffTime = expiry.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    private calculateUnrealizedPnL(position: OptionsPosition, currentPrice: number): number {
        // Simplified PnL calculation
        return position.maxProfit * 0.5; // Assume 50% of max profit
    }

    private createOptionsSignal(
        data: MarketData,
        action: 'BUY' | 'SELL',
        metadata: any
    ): TradeSignal | null {
        const price = data.close || data.ltp;
        if (!price || !data.symbol) return null;

        return {
            id: `options_signal_${Date.now()}_${Math.random()}`,
            strategy: this.name,
            symbol: data.symbol,
            action,
            quantity: 1, // Will be calculated by position sizing
            price,
            timestamp: new Date(data.timestamp),
            metadata: {
                ...metadata,
                strategyType: this.type,
                version: this.version,
                isOptionsStrategy: true
            }
        };
    }

    validateConfig(config: StrategyConfig): boolean {
        const baseValid = super.validateConfig(config);
        if (!baseValid) return false;

        // Validate options strategy specific parameters
        const { strategyType, daysToExpiry, volatilityThreshold } = config.parameters;

        if (!strategyType) {
            return false;
        }

        if (daysToExpiry && (daysToExpiry < 1 || daysToExpiry > 365)) {
            return false;
        }

        if (volatilityThreshold && (volatilityThreshold < 0 || volatilityThreshold > 1)) {
            return false;
        }

        return true;
    }
} 