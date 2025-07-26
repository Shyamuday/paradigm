import { IStrategy } from './strategy.interface';
import {
    StrategyConfig,
    TradeSignal,
    MarketData,
    Position,
    StrategyState,
    StrategyPerformance,
    TradeSignalSchema
} from '../../schemas/strategy.schema';
import { logger } from '../../logger/logger';

// ADX Strategy Configuration
export interface ADXStrategyConfig {
    period: number;           // ADX calculation period (default: 14)
    threshold: number;        // ADX threshold for trend strength (default: 25)
    diThreshold: number;      // DI threshold for trend direction (default: 5)
    stopLoss: number;         // Stop loss percentage (default: 2)
    takeProfit: number;       // Take profit percentage (default: 6)
    maxPositionSize: number;  // Maximum position size (default: 100)
    minVolume: number;        // Minimum volume requirement (default: 1000000)
}

// ADX Strategy State
export interface ADXStrategyState {
    adx: number;
    diPlus: number;
    diMinus: number;
    trendStrength: 'WEAK' | 'MODERATE' | 'STRONG';
    trendDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    lastSignal: 'BUY' | 'SELL' | 'HOLD' | null;
    signalStrength: number;
}

export class ADXStrategy implements IStrategy {
    public name = 'ADX Strategy';
    public type = 'TREND_FOLLOWING';
    public version = '1.0.0';
    public description = 'Average Directional Index based trend following strategy';

    private config: ADXStrategyConfig;
    private state: ADXStrategyState;
    private highPrices: number[] = [];
    private lowPrices: number[] = [];
    private closePrices: number[] = [];
    private volumes: number[] = [];

    constructor(config: Partial<ADXStrategyConfig> = {}) {
        this.config = {
            period: 14,
            threshold: 25,
            diThreshold: 5,
            stopLoss: 2,
            takeProfit: 6,
            maxPositionSize: 100,
            minVolume: 1000000,
            ...config
        };

        this.state = {
            adx: 0,
            diPlus: 0,
            diMinus: 0,
            trendStrength: 'WEAK',
            trendDirection: 'NEUTRAL',
            lastSignal: null,
            signalStrength: 0
        };

        logger.info('ADX Strategy initialized', { config: this.config });
    }

    /**
     * Initialize the strategy
     */
    async initialize(config: StrategyConfig): Promise<void> {
        // Implementation for initialization
        logger.info('ADX Strategy initialized with config:', config);
    }

    /**
     * Validate strategy configuration
     */
    validateConfig(config: StrategyConfig): boolean {
        try {
            // Basic validation
            return config.name === this.name;
        } catch (error) {
            logger.error('ADX Strategy config validation failed:', error);
            return false;
        }
    }

    /**
     * Calculate True Range (TR)
     */
    private calculateTrueRange(high: number, low: number, prevClose: number): number {
        const hl = high - low;
        const hc = Math.abs(high - prevClose);
        const lc = Math.abs(low - prevClose);
        return Math.max(hl, hc, lc);
    }

    /**
     * Calculate Directional Movement (DM)
     */
    private calculateDirectionalMovement(
        high: number,
        low: number,
        prevHigh: number,
        prevLow: number
    ): { dmPlus: number; dmMinus: number } {
        const upMove = high - prevHigh;
        const downMove = prevLow - low;

        let dmPlus = 0;
        let dmMinus = 0;

        if (upMove > downMove && upMove > 0) {
            dmPlus = upMove;
        }

        if (downMove > upMove && downMove > 0) {
            dmMinus = downMove;
        }

        return { dmPlus, dmMinus };
    }

    /**
     * Calculate smoothed values using Wilder's smoothing
     */
    private calculateSmoothedValues(
        currentValue: number,
        prevSmoothed: number,
        period: number
    ): number {
        return prevSmoothed - (prevSmoothed / period) + currentValue;
    }

    /**
     * Calculate ADX, DI+ and DI-
     */
    private calculateADX(): { adx: number; diPlus: number; diMinus: number } {
        if (this.highPrices.length < this.config.period + 1) {
            return { adx: 0, diPlus: 0, diMinus: 0 };
        }

        const period = this.config.period;
        let trSum = 0;
        let dmPlusSum = 0;
        let dmMinusSum = 0;

        // Calculate initial sums
        for (let i = 1; i <= period; i++) {
            const high = this.highPrices[this.highPrices.length - i] || 0;
            const low = this.lowPrices[this.lowPrices.length - i] || 0;
            const prevClose = this.closePrices[this.closePrices.length - i - 1] || 0;
            const prevHigh = this.highPrices[this.highPrices.length - i - 1] || 0;
            const prevLow = this.lowPrices[this.lowPrices.length - i - 1] || 0;

            const tr = this.calculateTrueRange(high, low, prevClose);
            const { dmPlus, dmMinus } = this.calculateDirectionalMovement(high, low, prevHigh, prevLow);

            trSum += tr;
            dmPlusSum += dmPlus;
            dmMinusSum += dmMinus;
        }

        // Calculate smoothed values
        let smoothedTR = trSum;
        let smoothedDMPlus = dmPlusSum;
        let smoothedDMMinus = dmMinusSum;

        // Continue smoothing for remaining periods
        for (let i = period + 1; i < this.highPrices.length; i++) {
            const high = this.highPrices[this.highPrices.length - i] || 0;
            const low = this.lowPrices[this.lowPrices.length - i] || 0;
            const prevClose = this.closePrices[this.highPrices.length - i - 1] || 0;
            const prevHigh = this.highPrices[this.highPrices.length - i - 1] || 0;
            const prevLow = this.lowPrices[this.lowPrices.length - i - 1] || 0;

            const tr = this.calculateTrueRange(high, low, prevClose);
            const { dmPlus, dmMinus } = this.calculateDirectionalMovement(high, low, prevHigh, prevLow);

            smoothedTR = this.calculateSmoothedValues(tr, smoothedTR, period);
            smoothedDMPlus = this.calculateSmoothedValues(dmPlus, smoothedDMPlus, period);
            smoothedDMMinus = this.calculateSmoothedValues(dmMinus, smoothedDMMinus, period);
        }

        // Calculate DI+ and DI-
        const diPlus = (smoothedDMPlus / smoothedTR) * 100;
        const diMinus = (smoothedDMMinus / smoothedTR) * 100;

        // Calculate DX
        const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;

        // Calculate ADX (smoothed DX)
        let adx = dx;
        if (this.highPrices.length > period * 2) {
            // For simplicity, we'll use a simple average of recent DX values
            let dxSum = dx;
            let count = 1;

            for (let i = 1; i < period; i++) {
                const high = this.highPrices[this.highPrices.length - i - period] || 0;
                const low = this.lowPrices[this.lowPrices.length - i - period] || 0;
                const prevClose = this.closePrices[this.highPrices.length - i - period - 1] || 0;
                const prevHigh = this.highPrices[this.highPrices.length - i - period - 1] || 0;
                const prevLow = this.lowPrices[this.lowPrices.length - i - period - 1] || 0;

                const tr = this.calculateTrueRange(high, low, prevClose);
                const { dmPlus, dmMinus } = this.calculateDirectionalMovement(high, low, prevHigh, prevLow);

                const diPlusTemp = (dmPlus / tr) * 100;
                const diMinusTemp = (dmMinus / tr) * 100;
                const dxTemp = Math.abs(diPlusTemp - diMinusTemp) / (diPlusTemp + diMinusTemp) * 100;

                dxSum += dxTemp;
                count++;
            }

            adx = dxSum / count;
        }

        return { adx, diPlus, diMinus };
    }

    /**
     * Determine trend strength based on ADX
     */
    private determineTrendStrength(adx: number): 'WEAK' | 'MODERATE' | 'STRONG' {
        if (adx < this.config.threshold) {
            return 'WEAK';
        } else if (adx < this.config.threshold + 10) {
            return 'MODERATE';
        } else {
            return 'STRONG';
        }
    }

    /**
     * Determine trend direction based on DI+ and DI-
     */
    private determineTrendDirection(diPlus: number, diMinus: number): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
        const diff = diPlus - diMinus;

        if (Math.abs(diff) < this.config.diThreshold) {
            return 'NEUTRAL';
        } else if (diff > 0) {
            return 'BULLISH';
        } else {
            return 'BEARISH';
        }
    }

    /**
     * Calculate signal strength based on ADX and DI values
     */
    private calculateSignalStrength(
        adx: number,
        diPlus: number,
        diMinus: number,
        volume: number
    ): number {
        let strength = 0;

        // ADX contribution (0-50 points)
        const adxContribution = Math.min(50, (adx / 50) * 50);
        strength += adxContribution;

        // DI difference contribution (0-30 points)
        const diDiff = Math.abs(diPlus - diMinus);
        const diContribution = Math.min(30, (diDiff / 20) * 30);
        strength += diContribution;

        // Volume contribution (0-20 points)
        const volumeRatio = volume / this.config.minVolume;
        const volumeContribution = Math.min(20, (volumeRatio / 2) * 20);
        strength += volumeContribution;

        return Math.min(100, strength);
    }

    /**
     * Generate trading signals based on ADX analysis
     */
    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        try {
            if (marketData.length < this.config.period + 1) {
                logger.warn('Insufficient data for ADX calculation');
                return [];
            }

            // Update price arrays
            this.highPrices = marketData.map(d => d.high || 0);
            this.lowPrices = marketData.map(d => d.low || 0);
            this.closePrices = marketData.map(d => d.close || 0);
            this.volumes = marketData.map(d => d.volume || 0);

            // Calculate ADX, DI+ and DI-
            const { adx, diPlus, diMinus } = this.calculateADX();

            // Update state
            this.state.adx = adx;
            this.state.diPlus = diPlus;
            this.state.diMinus = diMinus;
            this.state.trendStrength = this.determineTrendStrength(adx);
            this.state.trendDirection = this.determineTrendDirection(diPlus, diMinus);

            const currentPrice = this.closePrices[this.closePrices.length - 1] || 0;
            const currentVolume = this.volumes[this.volumes.length - 1] || 0;
            const currentSymbol = marketData[0]?.symbol || 'UNKNOWN';

            // Calculate signal strength
            const signalStrength = this.calculateSignalStrength(adx, diPlus, diMinus, currentVolume);
            this.state.signalStrength = signalStrength;

            const signals: TradeSignal[] = [];

            // Generate signals based on ADX conditions
            if (adx > this.config.threshold) {
                // Strong trend detected
                if (this.state.trendDirection === 'BULLISH' && diPlus > diMinus + this.config.diThreshold) {
                    // Bullish signal
                    const signal: TradeSignal = {
                        id: `adx_buy_${Date.now()}`,
                        symbol: currentSymbol,
                        action: 'BUY',
                        side: 'LONG',
                        quantity: this.calculatePositionSize({
                            id: `temp_${Date.now()}`,
                            symbol: currentSymbol,
                            action: 'BUY',
                            side: 'LONG',
                            quantity: 1,
                            price: currentPrice,
                            confidence: signalStrength / 100,
                            timestamp: new Date(),
                            strategyName: this.name
                        }, 100000),
                        price: currentPrice,
                        confidence: signalStrength / 100,
                        timestamp: new Date(),
                        strategyName: this.name,
                        reasoning: [
                            `ADX: ${adx.toFixed(2)} (Strong trend)`,
                            `DI+: ${diPlus.toFixed(2)}, DI-: ${diMinus.toFixed(2)}`,
                            `Trend: ${this.state.trendDirection}`,
                            `Volume: ${currentVolume.toLocaleString()}`
                        ].join(', '),
                        stopLoss: currentPrice * (1 - this.config.stopLoss / 100),
                        takeProfit: currentPrice * (1 + this.config.takeProfit / 100)
                    };

                    signals.push(signal);
                    this.state.lastSignal = 'BUY';

                } else if (this.state.trendDirection === 'BEARISH' && diMinus > diPlus + this.config.diThreshold) {
                    // Bearish signal
                    const signal: TradeSignal = {
                        id: `adx_sell_${Date.now()}`,
                        symbol: currentSymbol,
                        action: 'SELL',
                        side: 'SHORT',
                        quantity: this.calculatePositionSize({
                            id: `temp_${Date.now()}`,
                            symbol: currentSymbol,
                            action: 'SELL',
                            side: 'SHORT',
                            quantity: 1,
                            price: currentPrice,
                            confidence: signalStrength / 100,
                            timestamp: new Date(),
                            strategyName: this.name
                        }, 100000),
                        price: currentPrice,
                        confidence: signalStrength / 100,
                        timestamp: new Date(),
                        strategyName: this.name,
                        reasoning: [
                            `ADX: ${adx.toFixed(2)} (Strong trend)`,
                            `DI+: ${diPlus.toFixed(2)}, DI-: ${diMinus.toFixed(2)}`,
                            `Trend: ${this.state.trendDirection}`,
                            `Volume: ${currentVolume.toLocaleString()}`
                        ].join(', '),
                        stopLoss: currentPrice * (1 + this.config.stopLoss / 100),
                        takeProfit: currentPrice * (1 - this.config.takeProfit / 100)
                    };

                    signals.push(signal);
                    this.state.lastSignal = 'SELL';
                }
            }

            // Check for trend reversal signals
            if (this.state.lastSignal && adx < this.config.threshold - 5) {
                // Weak trend - consider exit signals
                const exitSignal: TradeSignal = {
                    id: `adx_exit_${Date.now()}`,
                    symbol: currentSymbol,
                    action: 'HOLD',
                    side: this.state.lastSignal === 'BUY' ? 'LONG' : 'SHORT',
                    quantity: 0,
                    price: currentPrice,
                    confidence: 0.7,
                    timestamp: new Date(),
                    strategyName: this.name,
                    reasoning: [
                        `ADX: ${adx.toFixed(2)} (Weak trend)`,
                        `Trend strength decreasing`,
                        `Consider exiting positions`
                    ].join(', ')
                };

                signals.push(exitSignal);
            }

            logger.info('ADX Strategy signals generated', {
                adx: adx.toFixed(2),
                diPlus: diPlus.toFixed(2),
                diMinus: diMinus.toFixed(2),
                trendStrength: this.state.trendStrength,
                trendDirection: this.state.trendDirection,
                signalCount: signals.length
            });

            return signals;

        } catch (error) {
            logger.error('Error generating ADX signals:', error);
            return [];
        }
    }

    /**
     * Calculate position size based on signal and available capital
     */
    calculatePositionSize(signal: TradeSignal, capital: number): number {
        const baseSize = this.config.maxPositionSize;
        const strengthMultiplier = signal.confidence;
        const riskAdjustedSize = baseSize * strengthMultiplier;

        return Math.floor(riskAdjustedSize);
    }

    /**
     * Apply risk management to a trade signal
     */
    applyRiskManagement(signal: TradeSignal): TradeSignal {
        // Adjust position size based on volatility
        const volatility = this.calculateVolatility();
        const riskMultiplier = Math.max(0.5, 1 - (volatility * 2));

        signal.quantity = Math.floor(signal.quantity * riskMultiplier);

        // Adjust stop loss based on volatility
        const volatilityStopLoss = this.config.stopLoss * (1 + volatility);
        if (signal.action === 'BUY') {
            signal.stopLoss = signal.price * (1 - volatilityStopLoss / 100);
        } else if (signal.action === 'SELL') {
            signal.stopLoss = signal.price * (1 + volatilityStopLoss / 100);
        }

        return signal;
    }

    /**
     * Calculate current volatility
     */
    private calculateVolatility(): number {
        if (this.closePrices.length < 20) return 0.02;

        const returns = [];
        for (let i = 1; i < this.closePrices.length; i++) {
            const currentPrice = this.closePrices[i] || 0;
            const prevPrice = this.closePrices[i - 1] || 0;
            if (prevPrice > 0) {
                returns.push((currentPrice - prevPrice) / prevPrice);
            }
        }

        if (returns.length === 0) return 0.02;

        const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;

        return Math.sqrt(variance);
    }

    /**
     * Check if position should be exited
     */
    async shouldExit(position: Position, currentData: MarketData[]): Promise<boolean> {
        if (currentData.length < this.config.period) return false;

        const { adx, diPlus, diMinus } = this.calculateADX();

        // Exit if trend becomes weak
        if (adx < this.config.threshold - 5) {
            return true;
        }

        // Exit if trend direction changes
        if (position.side === 'LONG' && diMinus > diPlus) {
            return true;
        }

        if (position.side === 'SHORT' && diPlus > diMinus) {
            return true;
        }

        return false;
    }

    /**
     * Get current strategy state
     */
    getState(): StrategyState {
        return {
            isActive: true,
            totalSignals: 0,
            successfulSignals: 0,
            failedSignals: 0,
            currentPositions: 0,
            totalPnL: 0,
            metadata: {
                adx: this.state.adx,
                diPlus: this.state.diPlus,
                diMinus: this.state.diMinus,
                trendStrength: this.state.trendStrength,
                trendDirection: this.state.trendDirection,
                signalStrength: this.state.signalStrength,
                lastSignal: this.state.lastSignal
            }
        };
    }

    /**
     * Get strategy performance metrics
     */
    getPerformance(): StrategyPerformance {
        return {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            winRate: 0,
            totalPnL: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            maxConsecutiveLosses: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 1,
            metadata: {
                adx: this.state.adx,
                diPlus: this.state.diPlus,
                diMinus: this.state.diMinus,
                trendStrength: this.state.trendStrength,
                trendDirection: this.state.trendDirection,
                signalStrength: this.state.signalStrength,
                lastSignal: this.state.lastSignal
            }
        };
    }

    /**
     * Cleanup resources
     */
    async cleanup(): Promise<void> {
        this.highPrices = [];
        this.lowPrices = [];
        this.closePrices = [];
        this.volumes = [];
        logger.info('ADX Strategy cleanup completed');
    }
} 