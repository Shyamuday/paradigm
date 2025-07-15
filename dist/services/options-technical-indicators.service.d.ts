import { OptionsContract } from '../types';
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
interface OptionsTechnicalAnalysis {
    contractId: string;
    underlyingSymbol: string;
    strikePrice: number;
    optionType: string;
    expiryDate: Date;
    timeframe: string;
    indicators: {
        adx?: ADXResult;
        rsi?: RSIResult;
        macd?: MACDResult;
        bollingerBands?: BollingerBandsResult;
        [key: string]: any;
    };
    timestamp: Date;
}
export declare class OptionsTechnicalIndicatorsService {
    private supportedTimeframes;
    private supportedIndicators;
    constructor();
    calculateADXForOptions(optionsContract: OptionsContract, timeframe: string, period?: number): Promise<ADXResult | null>;
    calculateRSIForOptions(optionsContract: OptionsContract, timeframe: string, period?: number): Promise<RSIResult | null>;
    calculateMACDForOptions(optionsContract: OptionsContract, timeframe: string, fastPeriod?: number, slowPeriod?: number, signalPeriod?: number): Promise<MACDResult | null>;
    calculateBollingerBandsForOptions(optionsContract: OptionsContract, timeframe: string, period?: number, standardDeviations?: number): Promise<BollingerBandsResult | null>;
    performTechnicalAnalysisForOptions(optionsContract: OptionsContract, timeframe: string, indicators?: string[]): Promise<OptionsTechnicalAnalysis | null>;
    private getUnderlyingDataForTimeframe;
    private calculateADX;
    private calculateRSI;
    private calculateMACD;
    private calculateBollingerBands;
    private smooth;
    private calculateEMA;
    private generateMockCandleData;
    getSupportedTimeframes(): string[];
    getSupportedIndicators(): string[];
    isValidTimeframe(timeframe: string): boolean;
    isValidIndicator(indicator: string): boolean;
}
export declare const optionsTechnicalIndicators: OptionsTechnicalIndicatorsService;
export {};
//# sourceMappingURL=options-technical-indicators.service.d.ts.map