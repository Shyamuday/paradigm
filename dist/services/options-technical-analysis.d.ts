interface ADXResult {
    adx: number;
    plusDI: number;
    minusDI: number;
    timestamp: Date;
    timeframe: string;
}
interface RSIResult {
    rsi: number;
    timestamp: Date;
    timeframe: string;
}
interface MACDResult {
    macd: number;
    signal: number;
    histogram: number;
    timestamp: Date;
    timeframe: string;
}
interface BollingerBandsResult {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
    percentB: number;
    timestamp: Date;
    timeframe: string;
}
export declare class OptionsTechnicalAnalysisService {
    calculateADXForOptions(underlyingSymbol: string, timeframe: string, period?: number): Promise<ADXResult | null>;
    calculateRSIForOptions(underlyingSymbol: string, timeframe: string, period?: number): Promise<RSIResult | null>;
    calculateMACDForOptions(underlyingSymbol: string, timeframe: string, fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): Promise<MACDResult | null>;
    calculateBollingerBandsForOptions(underlyingSymbol: string, timeframe: string, period?: number, standardDeviations?: number): Promise<BollingerBandsResult | null>;
    performCompleteTechnicalAnalysis(underlyingSymbol: string, timeframe: string, indicators?: string[]): Promise<any>;
    private getUnderlyingPriceData;
    private calculateADX;
    private calculateRSI;
    private calculateMACD;
    private calculateBollingerBands;
    private smooth;
    private calculateEMA;
    private generateMockPriceData;
}
export declare const optionsTechnicalAnalysis: OptionsTechnicalAnalysisService;
export {};
//# sourceMappingURL=options-technical-analysis.d.ts.map