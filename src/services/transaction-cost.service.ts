import { db } from '../database/database';
import { logger } from '../logger/logger';

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

export class TransactionCostService {
    private defaultFeeConfig: FeeConfig = {
        brokerageFeePercent: 0.03, // 0.03% of trade value
        transactionTaxPercent: 0.025, // 0.025% for sell trades
        stampDutyPercent: 0.003, // 0.003% for buy trades
        exchangeChargesPercent: 0.00325, // 0.00325% of trade value
        gstPercent: 18, // 18% on brokerage and exchange charges
        sebiChargesPercent: 0.0001 // 0.0001% of trade value
    };

    async getFeeConfig(exchangeId?: string): Promise<FeeConfig> {
        try {
            if (!exchangeId) {
                return this.defaultFeeConfig;
            }

            const exchangeConfig = await db.exchangeFeeConfig.findUnique({
                where: { exchangeId }
            }) as ExchangeFeeConfig | null;

            if (!exchangeConfig) {
                return this.defaultFeeConfig;
            }

            return {
                brokerageFeePercent: exchangeConfig.brokerageFeePercent,
                transactionTaxPercent: exchangeConfig.transactionTaxPercent,
                stampDutyPercent: exchangeConfig.stampDutyPercent,
                exchangeChargesPercent: exchangeConfig.exchangeChargesPercent,
                gstPercent: exchangeConfig.gstPercent,
                sebiChargesPercent: exchangeConfig.sebiChargesPercent
            };
        } catch (error) {
            logger.error('Failed to get fee config:', error);
            return this.defaultFeeConfig;
        }
    }

    async updateFeeConfig(exchangeId: string, config: Partial<FeeConfig>) {
        try {
            const updatedConfig = await db.exchangeFeeConfig.upsert({
                where: { exchangeId },
                update: config,
                create: {
                    exchangeId,
                    ...this.defaultFeeConfig,
                    ...config
                }
            }) as ExchangeFeeConfig;

            logger.info('Fee config updated for exchange:', exchangeId);
            return updatedConfig;
        } catch (error) {
            logger.error('Failed to update fee config:', error);
            throw error;
        }
    }

    calculateTradingFees(input: FeeCalculationInput, config: FeeConfig = this.defaultFeeConfig): FeeBreakdown {
        try {
            const tradeValue = input.price * input.quantity;

            // Calculate individual fees
            const brokerageFee = (tradeValue * config.brokerageFeePercent) / 100;

            // Transaction tax applies only on sell trades
            const transactionTax = input.action === 'SELL' ?
                (tradeValue * config.transactionTaxPercent) / 100 : 0;

            // Stamp duty applies only on buy trades
            const stampDuty = input.action === 'BUY' ?
                (tradeValue * config.stampDutyPercent) / 100 : 0;

            const exchangeCharges = (tradeValue * config.exchangeChargesPercent) / 100;

            // GST applies on brokerage and exchange charges
            const gst = ((brokerageFee + exchangeCharges) * config.gstPercent) / 100;

            const sebiCharges = (tradeValue * config.sebiChargesPercent) / 100;

            // Calculate total fees
            const totalFees = brokerageFee + transactionTax + stampDuty +
                exchangeCharges + gst + sebiCharges;

            return {
                brokerageFee,
                transactionTax,
                stampDuty,
                exchangeCharges,
                gst,
                sebiCharges,
                totalFees
            };
        } catch (error) {
            logger.error('Failed to calculate trading fees:', error);
            throw error;
        }
    }

    async saveFeeRecord(
        tradeId: string,
        fees: FeeBreakdown,
        input: FeeCalculationInput
    ) {
        try {
            const feeRecord = await db.tradingFees.create({
                data: {
                    tradeId,
                    tradeValue: input.price * input.quantity,
                    action: input.action,
                    brokerageFee: fees.brokerageFee,
                    transactionTax: fees.transactionTax,
                    stampDuty: fees.stampDuty,
                    exchangeCharges: fees.exchangeCharges,
                    gst: fees.gst,
                    sebiCharges: fees.sebiCharges,
                    totalFees: fees.totalFees
                }
            }) as TradingFees;

            logger.info('Fee record saved for trade:', tradeId);
            return feeRecord;
        } catch (error) {
            logger.error('Failed to save fee record:', error);
            throw error;
        }
    }

    async getTradeFees(tradeId: string) {
        try {
            const feeRecord = await db.tradingFees.findUnique({
                where: { tradeId }
            }) as TradingFees | null;

            return feeRecord;
        } catch (error) {
            logger.error('Failed to get trade fees:', error);
            throw error;
        }
    }

    async getFeeSummary(sessionId: string) {
        try {
            const fees = await db.tradingFees.findMany({
                where: {
                    trade: {
                        sessionId
                    }
                }
            }) as TradingFees[];

            const summary = {
                totalTrades: fees.length,
                totalFees: fees.reduce((sum: number, fee: TradingFees) => sum + fee.totalFees, 0),
                totalBrokerageFees: fees.reduce((sum: number, fee: TradingFees) => sum + fee.brokerageFee, 0),
                totalTaxes: fees.reduce((sum: number, fee: TradingFees) =>
                    sum + fee.transactionTax + fee.stampDuty + fee.gst, 0),
                totalExchangeCharges: fees.reduce((sum: number, fee: TradingFees) =>
                    sum + fee.exchangeCharges + fee.sebiCharges, 0)
            };

            return summary;
        } catch (error) {
            logger.error('Failed to get fee summary:', error);
            throw error;
        }
    }
} 