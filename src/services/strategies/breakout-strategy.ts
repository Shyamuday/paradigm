import { BaseStrategy } from '../strategy-engine.service';
import {
    StrategyConfig,
    TradeSignal,
    MarketData,
    Position,
    StrategyState,
    StrategyPerformance
} from '../../schemas/strategy.schema';
import { logger } from '../../logger/logger';

export class BreakoutStrategy extends BaseStrategy {
    constructor() {
        super('Breakout Strategy', 'BREAKOUT', '1.0.0',
            'A breakout strategy that identifies and trades breakouts from key support/resistance levels.');
    }

    validateConfig(config: StrategyConfig): boolean {
        const requiredParams = ['lookbackPeriod', 'breakoutThreshold'];
        const hasRequiredParams = requiredParams.every(param =>
            config.parameters && config.parameters[param] !== undefined
        );

        if (!hasRequiredParams) {
            logger.error('BreakoutStrategy: Missing required parameters');
            return false;
        }

        return true;
    }

    async generateSignals(marketData: MarketData[]): Promise<TradeSignal[]> {
        const signals: TradeSignal[] = [];

        if (!this.config.parameters) {
            logger.error('BreakoutStrategy: Configuration not initialized');
            return signals;
        }

        const lookbackPeriod = this.config.parameters.lookbackPeriod as number;
        const breakoutThreshold = this.config.parameters.breakoutThreshold as number;

        if (marketData.length < lookbackPeriod) {
            return signals;
        }

        for (let i = lookbackPeriod; i < marketData.length; i++) {
            const currentData = marketData[i];
            if (!currentData) continue;

            const lookbackData = marketData.slice(i - lookbackPeriod, i);
            const resistance = this.calculateResistance(lookbackData);
            const support = this.calculateSupport(lookbackData);
            const currentPrice = currentData.close || 0;

            // Bullish breakout
            if (currentPrice > resistance + breakoutThreshold) {
                const signal: TradeSignal = {
                    id: crypto.randomUUID(),
                    symbol: currentData.symbol,
                    action: 'BUY',
                    side: 'LONG',
                    quantity: 0,
                    price: currentPrice,
                    confidence: 75,
                    timestamp: currentData.timestamp,
                    strategyName: this.name,
                    reasoning: `Price broke above resistance level ${resistance.toFixed(2)}`,
                    metadata: {
                        resistance,
                        support,
                        breakoutType: 'BULLISH'
                    }
                };

                const sizedSignal = { ...signal };
                sizedSignal.quantity = this.calculatePositionSize(signal, 100000);
                const finalSignal = this.applyRiskManagement(sizedSignal);

                signals.push(finalSignal);
            }
            // Bearish breakout
            else if (currentPrice < support - breakoutThreshold) {
                const signal: TradeSignal = {
                    id: crypto.randomUUID(),
                    symbol: currentData.symbol,
                    action: 'SELL',
                    side: 'SHORT',
                    quantity: 0,
                    price: currentPrice,
                    confidence: 75,
                    timestamp: currentData.timestamp,
                    strategyName: this.name,
                    reasoning: `Price broke below support level ${support.toFixed(2)}`,
                    metadata: {
                        resistance,
                        support,
                        breakoutType: 'BEARISH'
                    }
                };

                const sizedSignal = { ...signal };
                sizedSignal.quantity = this.calculatePositionSize(signal, 100000);
                const finalSignal = this.applyRiskManagement(sizedSignal);

                signals.push(finalSignal);
            }
        }

        return signals;
    }

    async shouldExit(position: Position, marketData: MarketData[]): Promise<boolean> {
        if (!this.config.parameters) return false;

        const lookbackPeriod = this.config.parameters.lookbackPeriod as number;
        const breakoutThreshold = this.config.parameters.breakoutThreshold as number;

        if (marketData.length < lookbackPeriod) return false;

        const lookbackData = marketData.slice(-lookbackPeriod);
        const resistance = this.calculateResistance(lookbackData);
        const support = this.calculateSupport(lookbackData);
        const currentPrice = marketData[marketData.length - 1]?.close || 0;

        // Exit long position if price falls below support
        if (position.side === 'LONG' && currentPrice < support - breakoutThreshold) {
            return true;
        }

        // Exit short position if price rises above resistance
        if (position.side === 'SHORT' && currentPrice > resistance + breakoutThreshold) {
            return true;
        }

        return false;
    }

    getState(): StrategyState {
        return this.state;
    }

    getPerformance(): StrategyPerformance {
        const totalTrades = this.state.totalSignals;
        const winningTrades = this.state.successfulSignals;
        const losingTrades = this.state.failedSignals;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

        return {
            totalTrades,
            winningTrades,
            losingTrades,
            winRate,
            totalPnL: this.state.totalPnL,
            maxDrawdown: 0,
            sharpeRatio: 0,
            maxConsecutiveLosses: 0,
            averageWin: 0,
            averageLoss: 0,
            profitFactor: 0,
            metadata: {}
        };
    }

    private calculateResistance(data: MarketData[]): number {
        return Math.max(...data.map(d => d.high || 0));
    }

    private calculateSupport(data: MarketData[]): number {
        return Math.min(...data.map(d => d.low || 0));
    }
} 