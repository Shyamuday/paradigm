import { optionsTechnicalAnalysis } from '../services/options-technical-analysis';
import { enhancedStrategyService } from '../services/enhanced-strategy.service';
import { logger } from '../logger/logger';
import { StrategyConfig, StrategyType } from '../types';

export class OptionsTechnicalAnalysisExample {

    async runOptionsTechnicalAnalysisExample(): Promise<void> {
        try {
            logger.info('Starting Options Technical Analysis Example');

            // 1. ADX Analysis for Options
            await this.demonstrateADXAnalysis();

            // 2. RSI Analysis for Options
            await this.demonstrateRSIAnalysis();

            // 3. MACD Analysis for Options
            await this.demonstrateMACDAnalysis();

            // 4. Bollinger Bands Analysis for Options
            await this.demonstrateBollingerBandsAnalysis();

            // 5. Multi-Timeframe Analysis
            await this.demonstrateMultiTimeframeAnalysis();

            // 6. Options Strategy with Technical Indicators
            await this.demonstrateOptionsStrategyWithIndicators();

            logger.info('Options Technical Analysis Example completed successfully');
        } catch (error) {
            logger.error('Options Technical Analysis Example failed:', error);
        }
    }

    private async demonstrateADXAnalysis(): Promise<void> {
        logger.info('\n=== ADX Analysis for Options ===');

        const underlyingSymbol = 'NIFTY';
        const timeframes = ['1min', '5min', '15min', '1hour', '1day'];

        for (const timeframe of timeframes) {
            logger.info(`\nAnalyzing ADX for ${underlyingSymbol} on ${timeframe} timeframe`);

            const adxResult = await optionsTechnicalAnalysis.calculateADXForOptions(
                underlyingSymbol,
                timeframe,
                14 // ADX period
            );

            if (adxResult) {
                logger.info(`ADX (${timeframe}): ${adxResult.adx.toFixed(2)}`);
                logger.info(`+DI (${timeframe}): ${adxResult.plusDI.toFixed(2)}`);
                logger.info(`-DI (${timeframe}): ${adxResult.minusDI.toFixed(2)}`);

                // Interpret ADX values
                this.interpretADX(adxResult, timeframe);
            } else {
                logger.warn(`Could not calculate ADX for ${timeframe}`);
            }
        }
    }

    private async demonstrateRSIAnalysis(): Promise<void> {
        logger.info('\n=== RSI Analysis for Options ===');

        const underlyingSymbol = 'BANKNIFTY';
        const timeframes = ['5min', '15min', '1hour', '1day'];

        for (const timeframe of timeframes) {
            logger.info(`\nAnalyzing RSI for ${underlyingSymbol} on ${timeframe} timeframe`);

            const rsiResult = await optionsTechnicalAnalysis.calculateRSIForOptions(
                underlyingSymbol,
                timeframe,
                14 // RSI period
            );

            if (rsiResult) {
                logger.info(`RSI (${timeframe}): ${rsiResult.rsi.toFixed(2)}`);

                // Interpret RSI values
                this.interpretRSI(rsiResult, timeframe);
            } else {
                logger.warn(`Could not calculate RSI for ${timeframe}`);
            }
        }
    }

    private async demonstrateMACDAnalysis(): Promise<void> {
        logger.info('\n=== MACD Analysis for Options ===');

        const underlyingSymbol = 'NIFTY';
        const timeframes = ['15min', '1hour', '1day'];

        for (const timeframe of timeframes) {
            logger.info(`\nAnalyzing MACD for ${underlyingSymbol} on ${timeframe} timeframe`);

            const macdResult = await optionsTechnicalAnalysis.calculateMACDForOptions(
                underlyingSymbol,
                timeframe,
                12, // Fast period
                26, // Slow period
                9   // Signal period
            );

            if (macdResult) {
                logger.info(`MACD (${timeframe}): ${macdResult.macd.toFixed(4)}`);
                logger.info(`Signal (${timeframe}): ${macdResult.signal.toFixed(4)}`);
                logger.info(`Histogram (${timeframe}): ${macdResult.histogram.toFixed(4)}`);

                // Interpret MACD values
                this.interpretMACD(macdResult, timeframe);
            } else {
                logger.warn(`Could not calculate MACD for ${timeframe}`);
            }
        }
    }

    private async demonstrateBollingerBandsAnalysis(): Promise<void> {
        logger.info('\n=== Bollinger Bands Analysis for Options ===');

        const underlyingSymbol = 'NIFTY';
        const timeframes = ['5min', '15min', '1hour', '1day'];

        for (const timeframe of timeframes) {
            logger.info(`\nAnalyzing Bollinger Bands for ${underlyingSymbol} on ${timeframe} timeframe`);

            const bbResult = await optionsTechnicalAnalysis.calculateBollingerBandsForOptions(
                underlyingSymbol,
                timeframe,
                20, // Period
                2   // Standard deviations
            );

            if (bbResult) {
                logger.info(`Upper Band (${timeframe}): ${bbResult.upper.toFixed(2)}`);
                logger.info(`Middle Band (${timeframe}): ${bbResult.middle.toFixed(2)}`);
                logger.info(`Lower Band (${timeframe}): ${bbResult.lower.toFixed(2)}`);
                logger.info(`Bandwidth (${timeframe}): ${bbResult.bandwidth.toFixed(2)}%`);
                logger.info(`%B (${timeframe}): ${bbResult.percentB.toFixed(3)}`);

                // Interpret Bollinger Bands values
                this.interpretBollingerBands(bbResult, timeframe);
            } else {
                logger.warn(`Could not calculate Bollinger Bands for ${timeframe}`);
            }
        }
    }

    private async demonstrateMultiTimeframeAnalysis(): Promise<void> {
        logger.info('\n=== Multi-Timeframe Technical Analysis ===');

        const underlyingSymbol = 'NIFTY';
        const timeframes = ['5min', '15min', '1hour', '1day'];
        const indicators = ['ADX', 'RSI', 'MACD', 'BOLLINGER_BANDS'];

        logger.info(`\nPerforming complete technical analysis for ${underlyingSymbol}`);

        for (const timeframe of timeframes) {
            logger.info(`\n--- ${timeframe} Timeframe Analysis ---`);

            const analysis = await optionsTechnicalAnalysis.performCompleteTechnicalAnalysis(
                underlyingSymbol,
                timeframe,
                indicators
            );

            if (analysis) {
                this.displayMultiTimeframeResults(analysis, timeframe);
            } else {
                logger.warn(`Could not perform analysis for ${timeframe}`);
            }
        }
    }

    private async demonstrateOptionsStrategyWithIndicators(): Promise<void> {
        logger.info('\n=== Options Strategy with Technical Indicators ===');

        // Create an options strategy that uses technical indicators
        const strategyConfig: StrategyConfig = {
            name: 'Options Strategy with ADX and RSI',
            enabled: true,
            description: 'Options strategy using ADX and RSI technical indicators',
            type: 'OPTIONS_STRATEGY' as StrategyType,
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
                // Technical indicator parameters
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
            const strategy = await enhancedStrategyService.createStrategy(strategyConfig);
            logger.info(`Created options strategy with technical indicators: ${strategy.name}`);

            // Demonstrate strategy execution with technical analysis
            await this.executeStrategyWithTechnicalAnalysis(strategy);

        } catch (error) {
            logger.error(`Error creating strategy with technical indicators: ${error}`);
        }
    }

    private interpretADX(adxResult: any, timeframe: string): void {
        const { adx, plusDI, minusDI } = adxResult;

        logger.info(`\nADX Interpretation (${timeframe}):`);

        if (adx > 25) {
            logger.info(`✅ Strong trend detected (ADX: ${adx.toFixed(2)})`);

            if (plusDI > minusDI) {
                logger.info(`📈 Bullish trend - Consider call options or bullish spreads`);
            } else {
                logger.info(`📉 Bearish trend - Consider put options or bearish spreads`);
            }
        } else if (adx > 20) {
            logger.info(`⚠️ Moderate trend (ADX: ${adx.toFixed(2)}) - Use with caution`);
        } else {
            logger.info(`🔄 Weak trend (ADX: ${adx.toFixed(2)}) - Consider range-bound strategies like iron condor`);
        }

        // DI crossover analysis
        if (plusDI > minusDI && plusDI > 25) {
            logger.info(`🚀 Strong bullish momentum - Good for covered calls`);
        } else if (minusDI > plusDI && minusDI > 25) {
            logger.info(`📉 Strong bearish momentum - Good for protective puts`);
        }
    }

    private interpretRSI(rsiResult: any, timeframe: string): void {
        const { rsi } = rsiResult;

        logger.info(`\nRSI Interpretation (${timeframe}):`);

        if (rsi > 70) {
            logger.info(`🔴 Overbought (RSI: ${rsi.toFixed(2)}) - Consider selling calls or buying puts`);
        } else if (rsi < 30) {
            logger.info(`🟢 Oversold (RSI: ${rsi.toFixed(2)}) - Consider buying calls or selling puts`);
        } else if (rsi > 50) {
            logger.info(`📈 Bullish momentum (RSI: ${rsi.toFixed(2)}) - Good for bullish strategies`);
        } else {
            logger.info(`📉 Bearish momentum (RSI: ${rsi.toFixed(2)}) - Good for bearish strategies`);
        }
    }

    private interpretMACD(macdResult: any, timeframe: string): void {
        const { macd, signal, histogram } = macdResult;

        logger.info(`\nMACD Interpretation (${timeframe}):`);

        if (macd > signal && histogram > 0) {
            logger.info(`📈 Bullish MACD crossover - Good for call options`);
        } else if (macd < signal && histogram < 0) {
            logger.info(`📉 Bearish MACD crossover - Good for put options`);
        } else if (Math.abs(histogram) < 0.001) {
            logger.info(`🔄 MACD convergence - Consider neutral strategies`);
        }

        // MACD divergence analysis
        if (Math.abs(macd) > 0.01) {
            logger.info(`💪 Strong MACD signal (${macd.toFixed(4)})`);
        }
    }

    private interpretBollingerBands(bbResult: any, timeframe: string): void {
        const { upper, middle, lower, bandwidth, percentB } = bbResult;

        logger.info(`\nBollinger Bands Interpretation (${timeframe}):`);

        if (percentB > 0.8) {
            logger.info(`🔴 Near upper band (${percentB.toFixed(3)}) - Consider selling calls`);
        } else if (percentB < 0.2) {
            logger.info(`🟢 Near lower band (${percentB.toFixed(3)}) - Consider buying calls`);
        } else {
            logger.info(`🔄 Middle range (${percentB.toFixed(3)}) - Neutral zone`);
        }

        if (bandwidth < 10) {
            logger.info(`📊 Low volatility (${bandwidth.toFixed(2)}%) - Good for iron condor`);
        } else if (bandwidth > 20) {
            logger.info(`📈 High volatility (${bandwidth.toFixed(2)}%) - Good for straddle/strangle`);
        }
    }

    private displayMultiTimeframeResults(analysis: any, timeframe: string): void {
        logger.info(`\nTechnical Analysis Results for ${timeframe}:`);

        if (analysis.indicators.adx) {
            logger.info(`ADX: ${analysis.indicators.adx.adx.toFixed(2)} (+DI: ${analysis.indicators.adx.plusDI.toFixed(2)}, -DI: ${analysis.indicators.adx.minusDI.toFixed(2)})`);
        }

        if (analysis.indicators.rsi) {
            logger.info(`RSI: ${analysis.indicators.rsi.rsi.toFixed(2)}`);
        }

        if (analysis.indicators.macd) {
            logger.info(`MACD: ${analysis.indicators.macd.macd.toFixed(4)} (Signal: ${analysis.indicators.macd.signal.toFixed(4)})`);
        }

        if (analysis.indicators.bollingerBands) {
            logger.info(`BB: Upper ${analysis.indicators.bollingerBands.upper.toFixed(2)}, Lower ${analysis.indicators.bollingerBands.lower.toFixed(2)}, %B ${analysis.indicators.bollingerBands.percentB.toFixed(3)}`);
        }

        // Generate trading recommendations
        this.generateTradingRecommendations(analysis, timeframe);
    }

    private generateTradingRecommendations(analysis: any, timeframe: string): void {
        logger.info(`\n📊 Trading Recommendations for ${timeframe}:`);

        const recommendations: string[] = [];

        // ADX-based recommendations
        if (analysis.indicators.adx) {
            const { adx, plusDI, minusDI } = analysis.indicators.adx;

            if (adx > 25) {
                if (plusDI > minusDI) {
                    recommendations.push('📈 Strong bullish trend - Consider covered calls or bull call spreads');
                } else {
                    recommendations.push('📉 Strong bearish trend - Consider protective puts or bear put spreads');
                }
            } else {
                recommendations.push('🔄 Weak trend - Consider iron condor or butterfly spreads');
            }
        }

        // RSI-based recommendations
        if (analysis.indicators.rsi) {
            const { rsi } = analysis.indicators.rsi;

            if (rsi > 70) {
                recommendations.push('🔴 Overbought - Consider selling calls or buying puts');
            } else if (rsi < 30) {
                recommendations.push('🟢 Oversold - Consider buying calls or selling puts');
            }
        }

        // MACD-based recommendations
        if (analysis.indicators.macd) {
            const { macd, signal } = analysis.indicators.macd;

            if (macd > signal) {
                recommendations.push('📈 Bullish MACD - Good for call options');
            } else {
                recommendations.push('📉 Bearish MACD - Good for put options');
            }
        }

        // Bollinger Bands-based recommendations
        if (analysis.indicators.bollingerBands) {
            const { percentB, bandwidth } = analysis.indicators.bollingerBands;

            if (percentB > 0.8) {
                recommendations.push('🔴 Near upper band - Consider selling calls');
            } else if (percentB < 0.2) {
                recommendations.push('🟢 Near lower band - Consider buying calls');
            }

            if (bandwidth < 10) {
                recommendations.push('📊 Low volatility - Good for iron condor');
            } else if (bandwidth > 20) {
                recommendations.push('📈 High volatility - Good for straddle/strangle');
            }
        }

        // Display recommendations
        recommendations.forEach((rec, index) => {
            logger.info(`${index + 1}. ${rec}`);
        });
    }

    private async executeStrategyWithTechnicalAnalysis(strategy: any): Promise<void> {
        logger.info('\n=== Executing Strategy with Technical Analysis ===');

        const underlyingSymbol = 'NIFTY';
        const timeframes = ['15min', '1hour'];

        for (const timeframe of timeframes) {
            logger.info(`\nAnalyzing ${underlyingSymbol} on ${timeframe} for strategy execution`);

            // Get technical analysis
            const analysis = await optionsTechnicalAnalysis.performCompleteTechnicalAnalysis(
                underlyingSymbol,
                timeframe,
                ['ADX', 'RSI']
            );

            if (analysis) {
                // Check if conditions are met for strategy entry
                const shouldEnter = this.checkStrategyEntryConditions(analysis, strategy);

                if (shouldEnter) {
                    logger.info(`✅ Strategy entry conditions met for ${timeframe}`);
                    logger.info(`🚀 Executing ${strategy.name} on ${underlyingSymbol}`);

                    // Here you would execute the actual options strategy
                    // await enhancedStrategyService.executeStrategy(strategy.id, underlyingSymbol, timeframe);
                } else {
                    logger.info(`❌ Strategy entry conditions not met for ${timeframe}`);
                }
            }
        }
    }

    private checkStrategyEntryConditions(analysis: any, strategy: any): boolean {
        const { adxThreshold = 25, rsiOverbought = 70, rsiOversold = 30 } = strategy.parameters;

        let conditionsMet = 0;
        let totalConditions = 0;

        // Check ADX condition
        if (analysis.indicators.adx) {
            totalConditions++;
            if (analysis.indicators.adx.adx > adxThreshold) {
                conditionsMet++;
            }
        }

        // Check RSI condition
        if (analysis.indicators.rsi) {
            totalConditions++;
            const rsi = analysis.indicators.rsi.rsi;
            if (rsi > rsiOverbought || rsi < rsiOversold) {
                conditionsMet++;
            }
        }

        // Require at least 50% of conditions to be met
        return conditionsMet >= Math.ceil(totalConditions * 0.5);
    }
}

// Example usage
async function main() {
    const example = new OptionsTechnicalAnalysisExample();
    await example.runOptionsTechnicalAnalysisExample();
}

// Run the example if this file is executed directly
if (require.main === module) {
    main().catch(console.error);
}

export default OptionsTechnicalAnalysisExample; 