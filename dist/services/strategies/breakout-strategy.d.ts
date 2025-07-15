import { BaseStrategy } from '../strategy-engine.service';
import { StrategyConfig, TradeSignal, MarketData, Position } from '../../types';
export declare class BreakoutStrategy extends BaseStrategy {
    constructor();
    generateSignals(marketData: MarketData[]): Promise<TradeSignal[]>;
    shouldExit(position: Position, marketData: MarketData[]): Promise<boolean>;
    private calculateSupportResistanceLevels;
    private checkResistanceBreakout;
    private checkSupportBreakdown;
    private calculateAverageVolume;
    private createSignal;
    validateConfig(config: StrategyConfig): boolean;
}
//# sourceMappingURL=breakout-strategy.d.ts.map