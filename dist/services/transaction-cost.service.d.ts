interface FeeConfig {
    brokerageFeePercent: number;
    transactionTaxPercent: number;
    stampDutyPercent: number;
    exchangeChargesPercent: number;
    gstPercent: number;
    sebiChargesPercent: number;
}
interface FeeCalculationInput {
    price: number;
    quantity: number;
    action: 'BUY' | 'SELL';
}
interface FeeBreakdown {
    brokerageFee: number;
    transactionTax: number;
    stampDuty: number;
    exchangeCharges: number;
    gst: number;
    sebiCharges: number;
    totalFees: number;
}
interface TradingFees {
    id: string;
    tradeId: string;
    tradeValue: number;
    action: 'BUY' | 'SELL';
    brokerageFee: number;
    transactionTax: number;
    stampDuty: number;
    exchangeCharges: number;
    gst: number;
    sebiCharges: number;
    totalFees: number;
    createdAt: Date;
    updatedAt: Date;
}
interface ExchangeFeeConfig {
    id: string;
    exchangeId: string;
    brokerageFeePercent: number;
    transactionTaxPercent: number;
    stampDutyPercent: number;
    exchangeChargesPercent: number;
    gstPercent: number;
    sebiChargesPercent: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class TransactionCostService {
    private defaultFeeConfig;
    getFeeConfig(exchangeId?: string): Promise<FeeConfig>;
    updateFeeConfig(exchangeId: string, config: Partial<FeeConfig>): Promise<ExchangeFeeConfig>;
    calculateTradingFees(input: FeeCalculationInput, config?: FeeConfig): FeeBreakdown;
    saveFeeRecord(tradeId: string, fees: FeeBreakdown, input: FeeCalculationInput): Promise<TradingFees>;
    getTradeFees(tradeId: string): Promise<TradingFees | null>;
    getFeeSummary(sessionId: string): Promise<{
        totalTrades: number;
        totalFees: number;
        totalBrokerageFees: number;
        totalTaxes: number;
        totalExchangeCharges: number;
    }>;
}
export {};
//# sourceMappingURL=transaction-cost.service.d.ts.map