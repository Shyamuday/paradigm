import { BaseStrategy } from '../strategy-engine.service';
import { logger } from '../../logger/logger';
import { StrategyConfig, Position, StrategyState, StrategyPerformance, MarketData, TradeSignal, StrategyType } from '../../schemas/strategy.schema';

interface RsiConfig {
    period: number;
    overbought: number;
    oversold: number;
}

export class RsiStrategy extends BaseStrategy {
    private rsiConfig!: RsiConfig;
    private performance: StrategyPerformance = {
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
        profitFactor: 1
    };

    constructor() {
        super('RSI Strategy', 'MEAN_REVERSION' as StrategyType, '1.0.0', 'A Relative Strength Index (RSI) based strategy.');
    }

    async initialize(config: StrategyConfig): Promise<void> {
        await super.initialize(config);
        const { period, overbought, oversold } = config.parameters;
        if (!period || !overbought || !oversold) {
            throw new Error('Missing required configuration for RsiStrategy.');
        }
        this.rsiConfig = { period, overbought, oversold };
        logger.info('RsiStrategy initialized with config:', this.rsiConfig);
    }

    validateConfig(config: StrategyConfig): boolean {
        const { period, overbought, oversold } = config.parameters;
        return !!(period && overbought && oversold);
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];
        if (marketData.length < this.rsiConfig.period) {
            return signals;
        }

        const rsiValues = this.calculateRSIValues(marketData, this.rsiConfig.period);

        for (let i = this.rsiConfig.period; i < marketData.length; i++) {
            const currentData = marketData[i];
            if (!currentData) continue;

            const currentRsi = rsiValues[i];
            const prevRsi = rsiValues[i - 1];

            if (currentRsi !== null && prevRsi !== null) {
                if (prevRsi! <= this.rsiConfig.oversold && currentRsi! > this.rsiConfig.oversold) {
                    signals.push({
                        id: crypto.randomUUID(),
                        symbol: currentData.symbol,
                        action: 'BUY',
                        side: 'LONG',
                        quantity: 1,
                        price: currentData.close || 0,
                        confidence: 70,
                        timestamp: currentData.timestamp,
                        strategyName: this.name,
                        metadata: {
                            rsi: currentRsi,
                        },
                    });
                } else if (prevRsi! >= this.rsiConfig.overbought && currentRsi! < this.rsiConfig.overbought) {
                    signals.push({
                        id: crypto.randomUUID(),
                        symbol: currentData.symbol,
                        action: 'SELL',
                        side: 'SHORT',
                        quantity: 1,
                        price: currentData.close || 0,
                        confidence: 70,
                        timestamp: currentData.timestamp,
                        strategyName: this.name,
                        metadata: {
                            rsi: currentRsi,
                        },
                    });
                }
            }
        }

        this.state.totalSignals += signals.length;
        this.state.lastExecution = new Date();

        return signals;
    }

    calculatePositionSize(signal: TradeSignal, capital: number): number {
        // Simple position sizing: use 10% of capital per trade
        return Math.floor(capital * 0.1 / signal.price);
    }

    applyRiskManagement(signal: TradeSignal): TradeSignal {
        // Add basic risk management - stop loss at 2% below entry for buys
        if (signal.action === 'BUY') {
            const stopLoss = signal.price * 0.98;
            return {
                ...signal,
                stopLoss,
                takeProfit: signal.price * 1.06 // 6% take profit
            };
        }
        return signal;
    }

    async shouldExit(position: Position, marketData: MarketData[]): Promise<boolean> {
        if (marketData.length < this.rsiConfig.period) return false;

        const rsiValues = this.calculateRSIValues(marketData, this.rsiConfig.period);
        const currentRsi = rsiValues[marketData.length - 1];

        if (currentRsi === null || currentRsi === undefined) return false;

        // Exit if RSI reaches extreme levels
        if (position.side === 'LONG' && currentRsi >= this.rsiConfig.overbought) {
            return true;
        }
        if (position.side === 'SHORT' && currentRsi <= this.rsiConfig.oversold) {
            return true;
        }

        return false;
    }

    getState(): StrategyState {
        return { ...this.state };
    }

    getPerformance(): StrategyPerformance {
        return { ...this.performance };
    }

    async cleanup(): Promise<void> {
        this.state.isActive = false;
        logger.info('RsiStrategy cleanup completed');
    }

    private calculateRSIValues(data: MarketData[], period: number): (number | null)[] {
        const rsi: (number | null)[] = [];
        for (let i = 0; i < data.length; i++) {
            rsi.push(null);
        }

        let gains = 0;
        let losses = 0;

        // Calculate initial average gain and loss
        for (let i = 1; i <= period; i++) {
            const current = data[i];
            const previous = data[i - 1];
            if (!current || !previous || current.close === null || previous.close === null) continue;
            const change = current.close - previous.close;
            if (change > 0) {
                gains += change;
            } else {
                losses -= change;
            }
        }

        let avgGain = gains / period;
        let avgLoss = losses / period;

        if (avgLoss === 0) {
            rsi[period] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsi[period] = 100 - (100 / (1 + rs));
        }

        // Calculate subsequent RSI values
        for (let i = period + 1; i < data.length; i++) {
            const current = data[i];
            const previous = data[i - 1];
            if (!current || !previous || current.close === null || previous.close === null) continue;
            const change = current.close - previous.close;
            let currentGain = 0;
            let currentLoss = 0;

            if (change > 0) {
                currentGain = change;
            } else {
                currentLoss = -change;
            }

            avgGain = (avgGain * (period - 1) + currentGain) / period;
            avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

            if (avgLoss === 0) {
                rsi[i] = 100;
            } else {
                const rs = avgGain / avgLoss;
                rsi[i] = 100 - (100 / (1 + rs));
            }
        }

        return rsi;
    }
}