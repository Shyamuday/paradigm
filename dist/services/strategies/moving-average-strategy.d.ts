import { BaseStrategy } from '../strategy-engine.service';
import { StrategyConfig, TradeSignal, MarketData, Position } from '../../types';
export declare class MovingAverageStrategy extends BaseStrategy {
    constructor();
    generateSignals(marketData: MarketData[]): Promise<TradeSignal[]>;
    shouldExit(position: Position, marketData: MarketData[]): Promise<boolean>;
    private calculateEMA;
    private createSignal;
    validateConfig(config: StrategyConfig): boolean;
}
//# sourceMappingURL=moving-average-strategy.d.ts.map