import { BaseStrategy } from '../strategy-engine.service';
import { StrategyConfig, TradeSignal, MarketData, Position } from '../../types';
export declare class EnhancedMomentumStrategy extends BaseStrategy {
    private priceHistory;
    private volumeHistory;
    private indicatorCache;
    constructor();
    generateSignals(marketData: MarketData[]): Promise<TradeSignal[]>;
    private checkLongConditions;
    private checkShortConditions;
    shouldExit(position: Position, marketData: MarketData[]): Promise<boolean>;
    private shouldTriggerTrailingStop;
    private calculateRSI;
    private calculateMACD;
    private calculateEMA;
    private calculateEMAFromArray;
    private calculateADX;
    private calculateBollingerBands;
    private calculateMomentum;
    private calculateVolumeProfile;
    private isValidIndicatorSet;
    private createAdvancedSignal;
    validateConfig(config: StrategyConfig): boolean;
}
//# sourceMappingURL=enhanced-momentum-strategy.d.ts.map