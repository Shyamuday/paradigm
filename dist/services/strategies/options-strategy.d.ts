import { BaseStrategy } from '../strategy-engine.service';
import { StrategyConfig, TradeSignal, MarketData, Position } from '../../types';
export declare class OptionsStrategy extends BaseStrategy {
    private optionsPositions;
    constructor();
    generateSignals(marketData: MarketData[]): Promise<TradeSignal[]>;
    shouldExit(position: Position, marketData: MarketData[]): Promise<boolean>;
    private generateCoveredCallSignals;
    private generateProtectivePutSignals;
    private generateIronCondorSignals;
    private generateButterflySpreadSignals;
    private generateStraddleSignals;
    private generateStrangleSignals;
    private generateBullCallSpreadSignals;
    private generateBearPutSpreadSignals;
    private generateCalendarSpreadSignals;
    private findOptimalCoveredCallStrike;
    private findOptimalProtectivePutStrike;
    private calculateIronCondorStrikes;
    private calculateButterflySpreadStrikes;
    private calculateStrangleStrikes;
    private calculateBullCallSpreadStrikes;
    private calculateBearPutSpreadStrikes;
    private calculateCalendarSpreadStrikes;
    private calculateStraddleCost;
    private detectVolatilityExpansion;
    private detectBullishTrend;
    private detectBearishTrend;
    private calculateVolatility;
    private calculateSMA;
    private calculateDaysToExpiry;
    private calculateUnrealizedPnL;
    private createOptionsSignal;
    validateConfig(config: StrategyConfig): boolean;
}
//# sourceMappingURL=options-strategy.d.ts.map