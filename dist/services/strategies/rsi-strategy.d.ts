import { BaseStrategy } from '../strategy-engine.service';
import { StrategyConfig, TradeSignal, MarketData, Position } from '../../types';
export declare class RSIStrategy extends BaseStrategy {
    constructor();
    generateSignals(marketData: MarketData[]): Promise<TradeSignal[]>;
    shouldExit(position: Position, marketData: MarketData[]): Promise<boolean>;
    private calculateRSIArray;
    private createSignal;
    validateConfig(config: StrategyConfig): boolean;
}
//# sourceMappingURL=rsi-strategy.d.ts.map