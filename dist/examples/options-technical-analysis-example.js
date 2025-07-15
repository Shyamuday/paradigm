"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionsTechnicalAnalysisExample = void 0;
const options_technical_analysis_1 = require("../services/options-technical-analysis");
const enhanced_strategy_service_1 = require("../services/enhanced-strategy.service");
const logger_1 = require("../logger/logger");
class OptionsTechnicalAnalysisExample {
    async runOptionsTechnicalAnalysisExample() {
        try {
            logger_1.logger.info('Starting Options Technical Analysis Example');
            await this.demonstrateADXAnalysis();
            await this.demonstrateRSIAnalysis();
            await this.demonstrateMACDAnalysis();
            await this.demonstrateBollingerBandsAnalysis();
            await this.demonstrateMultiTimeframeAnalysis();
            await this.demonstrateOptionsStrategyWithIndicators();
            logger_1.logger.info('Options Technical Analysis Example completed successfully');
        }
        catch (error) {
            logger_1.logger.error('Options Technical Analysis Example failed:', error);
        }
    }
    async demonstrateADXAnalysis() {
        logger_1.logger.info('\n=== ADX Analysis for Options ===');
        const underlyingSymbol = 'NIFTY';
        const timeframes = ['1min', '5min', '15min', '1hour', '1day'];
        for (const timeframe of timeframes) {
            logger_1.logger.info(`\nAnalyzing ADX for ${underlyingSymbol} on ${timeframe} timeframe`);
            const adxResult = await options_technical_analysis_1.optionsTechnicalAnalysis.calculateADXForOptions(underlyingSymbol, timeframe, 14);
            if (adxResult) {
                logger_1.logger.info(`ADX (${timeframe}): ${adxResult.adx.toFixed(2)}`);
                logger_1.logger.info(`+DI (${timeframe}): ${adxResult.plusDI.toFixed(2)}`);
                logger_1.logger.info(`-DI (${timeframe}): ${adxResult.minusDI.toFixed(2)}`);
                this.interpretADX(adxResult, timeframe);
            }
            else {
                logger_1.logger.warn(`Could not calculate ADX for ${timeframe}`);
            }
        }
    }
    async demonstrateRSIAnalysis() {
        logger_1.logger.info('\n=== RSI Analysis for Options ===');
        const underlyingSymbol = 'BANKNIFTY';
        const timeframes = ['5min', '15min', '1hour', '1day'];
        for (const timeframe of timeframes) {
            logger_1.logger.info(`\nAnalyzing RSI for ${underlyingSymbol} on ${timeframe} timeframe`);
            const rsiResult = await options_technical_analysis_1.optionsTechnicalAnalysis.calculateRSIForOptions(underlyingSymbol, timeframe, 14);
            if (rsiResult) {
                logger_1.logger.info(`RSI (${timeframe}): ${rsiResult.rsi.toFixed(2)}`);
                this.interpretRSI(rsiResult, timeframe);
            }
            else {
                logger_1.logger.warn(`Could not calculate RSI for ${timeframe}`);
            }
        }
    }
    async demonstrateMACDAnalysis() {
        logger_1.logger.info('\n=== MACD Analysis for Options ===');
        const underlyingSymbol = 'NIFTY';
        const timeframes = ['15min', '1hour', '1day'];
        for (const timeframe of timeframes) {
            logger_1.logger.info(`\nAnalyzing MACD for ${underlyingSymbol} on ${timeframe} timeframe`);
            const macdResult = await options_technical_analysis_1.optionsTechnicalAnalysis.calculateMACDForOptions(underlyingSymbol, timeframe, 12, 26, 9);
            if (macdResult) {
                logger_1.logger.info(`MACD (${timeframe}): ${macdResult.macd.toFixed(4)}`);
                logger_1.logger.info(`Signal (${timeframe}): ${macdResult.signal.toFixed(4)}`);
                logger_1.logger.info(`Histogram (${timeframe}): ${macdResult.histogram.toFixed(4)}`);
                this.interpretMACD(macdResult, timeframe);
            }
            else {
                logger_1.logger.warn(`Could not calculate MACD for ${timeframe}`);
            }
        }
    }
    async demonstrateBollingerBandsAnalysis() {
        logger_1.logger.info('\n=== Bollinger Bands Analysis for Options ===');
        const underlyingSymbol = 'NIFTY';
        const timeframes = ['5min', '15min', '1hour', '1day'];
        for (const timeframe of timeframes) {
            logger_1.logger.info(`\nAnalyzing Bollinger Bands for ${underlyingSymbol} on ${timeframe} timeframe`);
            const bbResult = await options_technical_analysis_1.optionsTechnicalAnalysis.calculateBollingerBandsForOptions(underlyingSymbol, timeframe, 20, 2);
            if (bbResult) {
                logger_1.logger.info(`Upper Band (${timeframe}): ${bbResult.upper.toFixed(2)}`);
                logger_1.logger.info(`Middle Band (${timeframe}): ${bbResult.middle.toFixed(2)}`);
                logger_1.logger.info(`Lower Band (${timeframe}): ${bbResult.lower.toFixed(2)}`);
                logger_1.logger.info(`Bandwidth (${timeframe}): ${bbResult.bandwidth.toFixed(2)}%`);
                logger_1.logger.info(`%B (${timeframe}): ${bbResult.percentB.toFixed(3)}`);
                this.interpretBollingerBands(bbResult, timeframe);
            }
            else {
                logger_1.logger.warn(`Could not calculate Bollinger Bands for ${timeframe}`);
            }
        }
    }
    async demonstrateMultiTimeframeAnalysis() {
        logger_1.logger.info('\n=== Multi-Timeframe Technical Analysis ===');
        const underlyingSymbol = 'NIFTY';
        const timeframes = ['5min', '15min', '1hour', '1day'];
        const indicators = ['ADX', 'RSI', 'MACD', 'BOLLINGER_BANDS'];
        logger_1.logger.info(`\nPerforming complete technical analysis for ${underlyingSymbol}`);
        for (const timeframe of timeframes) {
            logger_1.logger.info(`\n--- ${timeframe} Timeframe Analysis ---`);
            const analysis = await options_technical_analysis_1.optionsTechnicalAnalysis.performCompleteTechnicalAnalysis(underlyingSymbol, timeframe, indicators);
            if (analysis) {
                this.displayMultiTimeframeResults(analysis, timeframe);
            }
            else {
                logger_1.logger.warn(`Could not perform analysis for ${timeframe}`);
            }
        }
    }
    async demonstrateOptionsStrategyWithIndicators() {
        logger_1.logger.info('\n=== Options Strategy with Technical Indicators ===');
        const strategyConfig = {
            name: 'Options Strategy with ADX and RSI',
            enabled: true,
            description: 'Options strategy using ADX and RSI technical indicators',
            type: 'OPTIONS_STRATEGY',
            version: '1.0.0',
            author: 'Technical Analysis Expert',
            category: 'OPTIONS',
            riskLevel: 'MEDIUM',
            timeframes: ['15min', '1hour'],
            entryRules: [
                {
                    id: 'technical_entry',
                    name: 'Technical Indicator Entry',
                    type: 'ENTRY',
                    condition: 'AND',
                    parameters: {
                        strategyType: 'COVERED_CALL',
                        adxThreshold: 25,
                        rsiOverbought: 70,
                        rsiOversold: 30,
                        timeframe: '15min'
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Enter based on ADX and RSI signals'
                }
            ],
            exitRules: [
                {
                    id: 'technical_exit',
                    name: 'Technical Indicator Exit',
                    type: 'EXIT',
                    condition: 'OR',
                    parameters: {
                        adxThreshold: 20,
                        rsiThreshold: 50,
                        profitTarget: 0.8
                    },
                    priority: 1,
                    isActive: true,
                    description: 'Exit based on technical indicators'
                }
            ],
            positionSizing: {
                method: 'FIXED_AMOUNT',
                fixedAmount: 10000,
                maxPositionSize: 50000,
                minPositionSize: 1000
            },
            riskManagement: {
                stopLoss: {
                    type: 'PERCENTAGE',
                    value: 15,
                    percentage: 15
                },
                takeProfit: {
                    type: 'PERCENTAGE',
                    value: 25,
                    percentage: 25
                },
                maxDrawdown: 10,
                maxDailyLoss: 3,
                maxOpenPositions: 2
            },
            filters: [],
            notifications: [],
            parameters: {
                strategyType: 'COVERED_CALL',
                daysToExpiry: 30,
                deltaTarget: 0.35,
                maxDelta: 0.5,
                adxPeriod: 14,
                rsiPeriod: 14,
                adxThreshold: 25,
                rsiOverbought: 70,
                rsiOversold: 30
            },
            capitalAllocation: 100000,
            instruments: ['NIFTY', 'BANKNIFTY']
        };
        try {
            const strategy = await enhanced_strategy_service_1.enhancedStrategyService.createStrategy(strategyConfig);
            logger_1.logger.info(`Created options strategy with technical indicators: ${strategy.name}`);
            await this.executeStrategyWithTechnicalAnalysis(strategy);
        }
        catch (error) {
            logger_1.logger.error(`Error creating strategy with technical indicators: ${error}`);
        }
    }
    interpretADX(adxResult, timeframe) {
        const { adx, plusDI, minusDI } = adxResult;
        logger_1.logger.info(`\nADX Interpretation (${timeframe}):`);
        if (adx > 25) {
            logger_1.logger.info(`✅ Strong trend detected (ADX: ${adx.toFixed(2)})`);
            if (plusDI > minusDI) {
                logger_1.logger.info(`📈 Bullish trend - Consider call options or bullish spreads`);
            }
            else {
                logger_1.logger.info(`📉 Bearish trend - Consider put options or bearish spreads`);
            }
        }
        else if (adx > 20) {
            logger_1.logger.info(`⚠️ Moderate trend (ADX: ${adx.toFixed(2)}) - Use with caution`);
        }
        else {
            logger_1.logger.info(`🔄 Weak trend (ADX: ${adx.toFixed(2)}) - Consider range-bound strategies like iron condor`);
        }
        if (plusDI > minusDI && plusDI > 25) {
            logger_1.logger.info(`🚀 Strong bullish momentum - Good for covered calls`);
        }
        else if (minusDI > plusDI && minusDI > 25) {
            logger_1.logger.info(`📉 Strong bearish momentum - Good for protective puts`);
        }
    }
    interpretRSI(rsiResult, timeframe) {
        const { rsi } = rsiResult;
        logger_1.logger.info(`\nRSI Interpretation (${timeframe}):`);
        if (rsi > 70) {
            logger_1.logger.info(`🔴 Overbought (RSI: ${rsi.toFixed(2)}) - Consider selling calls or buying puts`);
        }
        else if (rsi < 30) {
            logger_1.logger.info(`🟢 Oversold (RSI: ${rsi.toFixed(2)}) - Consider buying calls or selling puts`);
        }
        else if (rsi > 50) {
            logger_1.logger.info(`📈 Bullish momentum (RSI: ${rsi.toFixed(2)}) - Good for bullish strategies`);
        }
        else {
            logger_1.logger.info(`📉 Bearish momentum (RSI: ${rsi.toFixed(2)}) - Good for bearish strategies`);
        }
    }
    interpretMACD(macdResult, timeframe) {
        const { macd, signal, histogram } = macdResult;
        logger_1.logger.info(`\nMACD Interpretation (${timeframe}):`);
        if (macd > signal && histogram > 0) {
            logger_1.logger.info(`📈 Bullish MACD crossover - Good for call options`);
        }
        else if (macd < signal && histogram < 0) {
            logger_1.logger.info(`📉 Bearish MACD crossover - Good for put options`);
        }
        else if (Math.abs(histogram) < 0.001) {
            logger_1.logger.info(`🔄 MACD convergence - Consider neutral strategies`);
        }
        if (Math.abs(macd) > 0.01) {
            logger_1.logger.info(`💪 Strong MACD signal (${macd.toFixed(4)})`);
        }
    }
    interpretBollingerBands(bbResult, timeframe) {
        const { upper, middle, lower, bandwidth, percentB } = bbResult;
        logger_1.logger.info(`\nBollinger Bands Interpretation (${timeframe}):`);
        if (percentB > 0.8) {
            logger_1.logger.info(`🔴 Near upper band (${percentB.toFixed(3)}) - Consider selling calls`);
        }
        else if (percentB < 0.2) {
            logger_1.logger.info(`🟢 Near lower band (${percentB.toFixed(3)}) - Consider buying calls`);
        }
        else {
            logger_1.logger.info(`🔄 Middle range (${percentB.toFixed(3)}) - Neutral zone`);
        }
        if (bandwidth < 10) {
            logger_1.logger.info(`📊 Low volatility (${bandwidth.toFixed(2)}%) - Good for iron condor`);
        }
        else if (bandwidth > 20) {
            logger_1.logger.info(`📈 High volatility (${bandwidth.toFixed(2)}%) - Good for straddle/strangle`);
        }
    }
    displayMultiTimeframeResults(analysis, timeframe) {
        logger_1.logger.info(`\nTechnical Analysis Results for ${timeframe}:`);
        if (analysis.indicators.adx) {
            logger_1.logger.info(`ADX: ${analysis.indicators.adx.adx.toFixed(2)} (+DI: ${analysis.indicators.adx.plusDI.toFixed(2)}, -DI: ${analysis.indicators.adx.minusDI.toFixed(2)})`);
        }
        if (analysis.indicators.rsi) {
            logger_1.logger.info(`RSI: ${analysis.indicators.rsi.rsi.toFixed(2)}`);
        }
        if (analysis.indicators.macd) {
            logger_1.logger.info(`MACD: ${analysis.indicators.macd.macd.toFixed(4)} (Signal: ${analysis.indicators.macd.signal.toFixed(4)})`);
        }
        if (analysis.indicators.bollingerBands) {
            logger_1.logger.info(`BB: Upper ${analysis.indicators.bollingerBands.upper.toFixed(2)}, Lower ${analysis.indicators.bollingerBands.lower.toFixed(2)}, %B ${analysis.indicators.bollingerBands.percentB.toFixed(3)}`);
        }
        this.generateTradingRecommendations(analysis, timeframe);
    }
    generateTradingRecommendations(analysis, timeframe) {
        logger_1.logger.info(`\n📊 Trading Recommendations for ${timeframe}:`);
        const recommendations = [];
        if (analysis.indicators.adx) {
            const { adx, plusDI, minusDI } = analysis.indicators.adx;
            if (adx > 25) {
                if (plusDI > minusDI) {
                    recommendations.push('📈 Strong bullish trend - Consider covered calls or bull call spreads');
                }
                else {
                    recommendations.push('📉 Strong bearish trend - Consider protective puts or bear put spreads');
                }
            }
            else {
                recommendations.push('🔄 Weak trend - Consider iron condor or butterfly spreads');
            }
        }
        if (analysis.indicators.rsi) {
            const { rsi } = analysis.indicators.rsi;
            if (rsi > 70) {
                recommendations.push('🔴 Overbought - Consider selling calls or buying puts');
            }
            else if (rsi < 30) {
                recommendations.push('🟢 Oversold - Consider buying calls or selling puts');
            }
        }
        if (analysis.indicators.macd) {
            const { macd, signal } = analysis.indicators.macd;
            if (macd > signal) {
                recommendations.push('📈 Bullish MACD - Good for call options');
            }
            else {
                recommendations.push('📉 Bearish MACD - Good for put options');
            }
        }
        if (analysis.indicators.bollingerBands) {
            const { percentB, bandwidth } = analysis.indicators.bollingerBands;
            if (percentB > 0.8) {
                recommendations.push('🔴 Near upper band - Consider selling calls');
            }
            else if (percentB < 0.2) {
                recommendations.push('🟢 Near lower band - Consider buying calls');
            }
            if (bandwidth < 10) {
                recommendations.push('📊 Low volatility - Good for iron condor');
            }
            else if (bandwidth > 20) {
                recommendations.push('📈 High volatility - Good for straddle/strangle');
            }
        }
        recommendations.forEach((rec, index) => {
            logger_1.logger.info(`${index + 1}. ${rec}`);
        });
    }
    async executeStrategyWithTechnicalAnalysis(strategy) {
        logger_1.logger.info('\n=== Executing Strategy with Technical Analysis ===');
        const underlyingSymbol = 'NIFTY';
        const timeframes = ['15min', '1hour'];
        for (const timeframe of timeframes) {
            logger_1.logger.info(`\nAnalyzing ${underlyingSymbol} on ${timeframe} for strategy execution`);
            const analysis = await options_technical_analysis_1.optionsTechnicalAnalysis.performCompleteTechnicalAnalysis(underlyingSymbol, timeframe, ['ADX', 'RSI']);
            if (analysis) {
                const shouldEnter = this.checkStrategyEntryConditions(analysis, strategy);
                if (shouldEnter) {
                    logger_1.logger.info(`✅ Strategy entry conditions met for ${timeframe}`);
                    logger_1.logger.info(`🚀 Executing ${strategy.name} on ${underlyingSymbol}`);
                }
                else {
                    logger_1.logger.info(`❌ Strategy entry conditions not met for ${timeframe}`);
                }
            }
        }
    }
    checkStrategyEntryConditions(analysis, strategy) {
        const { adxThreshold = 25, rsiOverbought = 70, rsiOversold = 30 } = strategy.parameters;
        let conditionsMet = 0;
        let totalConditions = 0;
        if (analysis.indicators.adx) {
            totalConditions++;
            if (analysis.indicators.adx.adx > adxThreshold) {
                conditionsMet++;
            }
        }
        if (analysis.indicators.rsi) {
            totalConditions++;
            const rsi = analysis.indicators.rsi.rsi;
            if (rsi > rsiOverbought || rsi < rsiOversold) {
                conditionsMet++;
            }
        }
        return conditionsMet >= Math.ceil(totalConditions * 0.5);
    }
}
exports.OptionsTechnicalAnalysisExample = OptionsTechnicalAnalysisExample;
async function main() {
    const example = new OptionsTechnicalAnalysisExample();
    await example.runOptionsTechnicalAnalysisExample();
}
if (require.main === module) {
    main().catch(console.error);
}
exports.default = OptionsTechnicalAnalysisExample;
//# sourceMappingURL=options-technical-analysis-example.js.map