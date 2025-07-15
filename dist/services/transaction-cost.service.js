"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionCostService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
class TransactionCostService {
    constructor() {
        this.defaultFeeConfig = {
            brokerageFeePercent: 0.03,
            transactionTaxPercent: 0.025,
            stampDutyPercent: 0.003,
            exchangeChargesPercent: 0.00325,
            gstPercent: 18,
            sebiChargesPercent: 0.0001
        };
    }
    async getFeeConfig(exchangeId) {
        try {
            if (!exchangeId) {
                return this.defaultFeeConfig;
            }
            const exchangeConfig = await database_1.db.exchangeFeeConfig.findUnique({
                where: { exchangeId }
            });
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
        }
        catch (error) {
            logger_1.logger.error('Failed to get fee config:', error);
            return this.defaultFeeConfig;
        }
    }
    async updateFeeConfig(exchangeId, config) {
        try {
            const updatedConfig = await database_1.db.exchangeFeeConfig.upsert({
                where: { exchangeId },
                update: config,
                create: {
                    exchangeId,
                    ...this.defaultFeeConfig,
                    ...config
                }
            });
            logger_1.logger.info('Fee config updated for exchange:', exchangeId);
            return updatedConfig;
        }
        catch (error) {
            logger_1.logger.error('Failed to update fee config:', error);
            throw error;
        }
    }
    calculateTradingFees(input, config = this.defaultFeeConfig) {
        try {
            const tradeValue = input.price * input.quantity;
            const brokerageFee = (tradeValue * config.brokerageFeePercent) / 100;
            const transactionTax = input.action === 'SELL' ?
                (tradeValue * config.transactionTaxPercent) / 100 : 0;
            const stampDuty = input.action === 'BUY' ?
                (tradeValue * config.stampDutyPercent) / 100 : 0;
            const exchangeCharges = (tradeValue * config.exchangeChargesPercent) / 100;
            const gst = ((brokerageFee + exchangeCharges) * config.gstPercent) / 100;
            const sebiCharges = (tradeValue * config.sebiChargesPercent) / 100;
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
        }
        catch (error) {
            logger_1.logger.error('Failed to calculate trading fees:', error);
            throw error;
        }
    }
    async saveFeeRecord(tradeId, fees, input) {
        try {
            const feeRecord = await database_1.db.tradingFees.create({
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
            });
            logger_1.logger.info('Fee record saved for trade:', tradeId);
            return feeRecord;
        }
        catch (error) {
            logger_1.logger.error('Failed to save fee record:', error);
            throw error;
        }
    }
    async getTradeFees(tradeId) {
        try {
            const feeRecord = await database_1.db.tradingFees.findUnique({
                where: { tradeId }
            });
            return feeRecord;
        }
        catch (error) {
            logger_1.logger.error('Failed to get trade fees:', error);
            throw error;
        }
    }
    async getFeeSummary(sessionId) {
        try {
            const fees = await database_1.db.tradingFees.findMany({
                where: {
                    trade: {
                        sessionId
                    }
                }
            });
            const summary = {
                totalTrades: fees.length,
                totalFees: fees.reduce((sum, fee) => sum + fee.totalFees, 0),
                totalBrokerageFees: fees.reduce((sum, fee) => sum + fee.brokerageFee, 0),
                totalTaxes: fees.reduce((sum, fee) => sum + fee.transactionTax + fee.stampDuty + fee.gst, 0),
                totalExchangeCharges: fees.reduce((sum, fee) => sum + fee.exchangeCharges + fee.sebiCharges, 0)
            };
            return summary;
        }
        catch (error) {
            logger_1.logger.error('Failed to get fee summary:', error);
            throw error;
        }
    }
}
exports.TransactionCostService = TransactionCostService;
//# sourceMappingURL=transaction-cost.service.js.map