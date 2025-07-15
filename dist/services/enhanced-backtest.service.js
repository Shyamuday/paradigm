"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedBacktestService = void 0;
const database_1 = require("../database/database");
const logger_1 = require("../logger/logger");
const market_data_service_1 = require("./market-data.service");
const enhanced_strategy_service_1 = require("./enhanced-strategy.service");
const order_service_1 = require("./order.service");
const transaction_cost_service_1 = require("./transaction-cost.service");
const options_technical_analysis_1 = require("./options-technical-analysis");
const timeframe_manager_service_1 = require("./timeframe-manager.service");
class EnhancedBacktestService {
    constructor() {
        this.marketDataService = new market_data_service_1.MarketDataService();
        this.strategyService = new enhanced_strategy_service_1.EnhancedStrategyService();
        this.orderService = new order_service_1.OrderService();
        this.transactionCostService = new transaction_cost_service_1.TransactionCostService();
        this.optionsTechnicalService = new options_technical_analysis_1.OptionsTechnicalAnalysisService();
        this.timeframeService = new timeframe_manager_service_1.TimeframeManagerService();
    }
    async runBacktest(config) {
        try {
            logger_1.logger.info('Starting enhanced backtest with options support', { config });
            const strategy = await this.strategyService.getStrategy(config.strategyId);
            if (!strategy) {
                throw new Error('Strategy not found');
            }
            const result = {
                strategyId: config.strategyId,
                startDate: config.startDate,
                endDate: config.endDate,
                initialCapital: config.initialCapital,
                finalCapital: config.initialCapital,
                totalReturn: 0,
                annualizedReturn: 0,
                sharpeRatio: 0,
                sortinoRatio: 0,
                maxDrawdown: 0,
                volatility: 0,
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                avgWin: 0,
                avgLoss: 0,
                profitFactor: 0,
                totalOptionsTrades: 0,
                optionsWinRate: 0,
                averageOptionsPnL: 0,
                greeksExposure: { avgDelta: 0, avgGamma: 0, avgTheta: 0, avgVega: 0 },
                trades: [],
                dailyReturns: [],
                monthlyReturns: [],
                recommendations: [],
                riskMetrics: this.initializeRiskMetrics()
            };
            const historicalData = await this.getEnhancedHistoricalData(config.symbols, config.startDate, config.endDate, config.timeframe);
            if (!historicalData.length) {
                throw new Error('No historical data available for the specified period');
            }
            const sortedData = this.sortAndGroupHistoricalData(historicalData);
            let currentCapital = config.initialCapital;
            let highWaterMark = currentCapital;
            const openPositions = new Map();
            const dailyReturns = [];
            const greeksTracking = [];
            for (const [timestamp, periodData] of sortedData) {
                const currentDate = new Date(timestamp);
                const technicalAnalysis = await this.getTechnicalAnalysisForPeriod(periodData, config.timeframe);
                const signals = await this.strategyService.generateSignals(strategy.name, periodData, technicalAnalysis);
                if (!signals.success || !signals.signals.length) {
                    continue;
                }
                for (const signal of signals.signals) {
                    const instrument = periodData.find(d => d.symbol === signal.symbol);
                    if (!instrument)
                        continue;
                    const currentPrice = instrument.close;
                    const positionSize = this.calculateEnhancedPositionSize(currentCapital, currentPrice, signal.quantity, config.riskParameters);
                    if (signal.action === 'BUY' && !openPositions.has(signal.symbol)) {
                        const trade = await this.createBacktestTrade(signal, instrument, currentDate, currentPrice, positionSize, technicalAnalysis[signal.symbol], config);
                        if (trade) {
                            openPositions.set(signal.symbol, trade);
                            currentCapital -= (currentPrice * positionSize) + trade.fees;
                        }
                    }
                    else if (signal.action === 'SELL' && openPositions.has(signal.symbol)) {
                        const trade = openPositions.get(signal.symbol);
                        await this.closeBacktestTrade(trade, currentDate, currentPrice, technicalAnalysis[signal.symbol], config);
                        currentCapital += (currentPrice * trade.quantity) - trade.fees;
                        result.trades.push(trade);
                        this.updateTradeStatistics(result, trade);
                        if (trade.instrumentType === 'OPTION' && trade.exitGreeks) {
                            greeksTracking.push(trade.exitGreeks);
                        }
                        openPositions.delete(signal.symbol);
                    }
                }
                const dailyReturn = (currentCapital - config.initialCapital) / config.initialCapital;
                const dailyPnL = currentCapital - config.initialCapital;
                result.dailyReturns.push({
                    date: currentDate,
                    return: dailyReturn,
                    pnl: dailyPnL
                });
                dailyReturns.push(dailyReturn);
                if (currentCapital > highWaterMark) {
                    highWaterMark = currentCapital;
                }
                const currentDrawdown = (highWaterMark - currentCapital) / highWaterMark;
                result.maxDrawdown = Math.max(result.maxDrawdown, currentDrawdown);
            }
            await this.closeRemainingPositions(openPositions, config.endDate, sortedData, result, config);
            result.finalCapital = currentCapital;
            result.totalReturn = (currentCapital - config.initialCapital) / config.initialCapital;
            this.calculateAdvancedMetrics(result, dailyReturns, greeksTracking);
            result.recommendations = await this.generateTradeRecommendations(result, config.symbols, config.timeframe);
            result.riskMetrics = await this.calculateRiskMetrics(result, config);
            logger_1.logger.info('Enhanced backtest completed', {
                strategy: strategy.name,
                totalReturn: (result.totalReturn * 100).toFixed(2) + '%',
                trades: result.totalTrades,
                optionsTrades: result.totalOptionsTrades,
                winRate: (result.winRate * 100).toFixed(2) + '%',
                sharpeRatio: result.sharpeRatio.toFixed(2)
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Enhanced backtest failed:', error);
            throw error;
        }
    }
    async getEnhancedHistoricalData(symbols, startDate, endDate, timeframe) {
        const allData = [];
        for (const symbol of symbols) {
            const equityData = await this.timeframeService.getHistoricalData(symbol, timeframe, startDate, endDate);
            const optionsData = await this.getOptionsHistoricalData(symbol, startDate, endDate);
            allData.push(...equityData, ...optionsData);
        }
        return allData;
    }
    async getOptionsHistoricalData(symbol, startDate, endDate) {
        try {
            const optionsChain = await database_1.db.optionsChain.findMany({
                where: {
                    underlyingSymbol: symbol,
                    timestamp: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                include: {
                    contracts: {
                        include: {
                            instrument: true
                        }
                    }
                }
            });
            return optionsChain.flatMap(chain => chain.contracts.map(contract => ({
                symbol: contract.instrument.symbol,
                timestamp: chain.timestamp,
                open: contract.open,
                high: contract.high,
                low: contract.low,
                close: contract.close,
                volume: contract.volume,
                instrumentType: 'OPTION',
                strikePrice: contract.strikePrice,
                optionType: contract.optionType,
                expiryDate: contract.expiryDate,
                impliedVolatility: contract.impliedVolatility
            })));
        }
        catch (error) {
            logger_1.logger.warn('Failed to get options historical data:', error);
            return [];
        }
    }
    async getTechnicalAnalysisForPeriod(periodData, timeframe) {
        const analysis = {};
        for (const instrument of periodData) {
            try {
                if (instrument.instrumentType === 'OPTION') {
                    const optionsAnalysis = await this.optionsTechnicalService.analyzeOptionsData(instrument.symbol, timeframe, 'ALL');
                    analysis[instrument.symbol] = optionsAnalysis;
                }
                else {
                    const technicalData = await this.optionsTechnicalService.calculateTechnicalIndicators([instrument], timeframe);
                    analysis[instrument.symbol] = technicalData;
                }
            }
            catch (error) {
                logger_1.logger.warn(`Failed to get technical analysis for ${instrument.symbol}:`, error);
                analysis[instrument.symbol] = null;
            }
        }
        return analysis;
    }
    calculateEnhancedPositionSize(availableCapital, currentPrice, suggestedQuantity, riskParams) {
        if (!riskParams) {
            return Math.min(suggestedQuantity, Math.floor(availableCapital / currentPrice));
        }
        const maxPositionValue = availableCapital * riskParams.maxPositionSize;
        const maxQuantityByRisk = Math.floor(maxPositionValue / currentPrice);
        const maxQuantityByCapital = Math.floor(availableCapital / currentPrice);
        return Math.min(suggestedQuantity, maxQuantityByRisk, maxQuantityByCapital);
    }
    async createBacktestTrade(signal, instrument, date, price, quantity, technicalAnalysis, config) {
        const fees = config.includeFees ?
            this.transactionCostService.calculateTradingFees({
                price,
                quantity,
                action: 'BUY'
            }).totalFees : 0;
        const trade = {
            symbol: signal.symbol,
            entryDate: date,
            exitDate: date,
            entryPrice: price,
            exitPrice: price,
            quantity,
            side: 'LONG',
            pnl: 0,
            fees,
            instrumentType: instrument.instrumentType || 'EQUITY',
            strikePrice: instrument.strikePrice,
            optionType: instrument.optionType,
            expiryDate: instrument.expiryDate,
            technicalSignals: this.extractTechnicalSignals(technicalAnalysis)
        };
        if (trade.instrumentType === 'OPTION') {
            trade.entryGreeks = await this.calculateGreeks(instrument, price, date);
        }
        return trade;
    }
    async closeBacktestTrade(trade, date, price, technicalAnalysis, config) {
        const exitFees = config.includeFees ?
            this.transactionCostService.calculateTradingFees({
                price,
                quantity: trade.quantity,
                action: 'SELL'
            }).totalFees : 0;
        trade.exitDate = date;
        trade.exitPrice = price;
        trade.fees += exitFees;
        const grossPnl = (price - trade.entryPrice) * trade.quantity;
        trade.pnl = grossPnl - trade.fees;
        if (trade.instrumentType === 'OPTION') {
            trade.exitGreeks = await this.calculateGreeks({
                symbol: trade.symbol,
                strikePrice: trade.strikePrice,
                optionType: trade.optionType,
                expiryDate: trade.expiryDate
            }, price, date);
        }
    }
    async calculateGreeks(instrument, price, date) {
        try {
            const timeToExpiry = instrument.expiryDate ?
                (new Date(instrument.expiryDate).getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365) : 0;
            return {
                delta: Math.random() * 0.8 + 0.1,
                gamma: Math.random() * 0.1,
                theta: -Math.random() * 0.05,
                vega: Math.random() * 0.3,
                iv: Math.random() * 0.5 + 0.1
            };
        }
        catch (error) {
            logger_1.logger.warn('Failed to calculate Greeks:', error);
            return {
                delta: 0,
                gamma: 0,
                theta: 0,
                vega: 0,
                iv: 0
            };
        }
    }
    extractTechnicalSignals(analysis) {
        if (!analysis) {
            return {
                adx: 0,
                rsi: 50,
                macd: { macd: 0, signal: 0, histogram: 0 },
                bollinger: { upper: 0, middle: 0, lower: 0 }
            };
        }
        return {
            adx: analysis.adx?.adx || 0,
            rsi: analysis.rsi?.rsi || 50,
            macd: analysis.macd || { macd: 0, signal: 0, histogram: 0 },
            bollinger: analysis.bollinger || { upper: 0, middle: 0, lower: 0 }
        };
    }
    sortAndGroupHistoricalData(data) {
        const groupedData = new Map();
        for (const point of data) {
            const timestamp = new Date(point.timestamp).toISOString();
            if (!groupedData.has(timestamp)) {
                groupedData.set(timestamp, []);
            }
            groupedData.get(timestamp).push(point);
        }
        return new Map([...groupedData.entries()].sort());
    }
    updateTradeStatistics(result, trade) {
        result.totalTrades++;
        if (trade.instrumentType === 'OPTION') {
            result.totalOptionsTrades++;
        }
        if (trade.pnl > 0) {
            result.winningTrades++;
        }
        else if (trade.pnl < 0) {
            result.losingTrades++;
        }
        result.winRate = result.totalTrades > 0 ? result.winningTrades / result.totalTrades : 0;
        if (result.totalOptionsTrades > 0) {
            const optionsTrades = result.trades.filter(t => t.instrumentType === 'OPTION');
            const optionsWins = optionsTrades.filter(t => t.pnl > 0).length;
            result.optionsWinRate = optionsWins / result.totalOptionsTrades;
            result.averageOptionsPnL = optionsTrades.reduce((sum, t) => sum + t.pnl, 0) / result.totalOptionsTrades;
        }
    }
    calculateAdvancedMetrics(result, dailyReturns, greeksTracking) {
        if (dailyReturns.length === 0)
            return;
        const totalDays = dailyReturns.length;
        const annualizedReturn = Math.pow(1 + result.totalReturn, 365 / totalDays) - 1;
        result.annualizedReturn = annualizedReturn;
        const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
        result.volatility = Math.sqrt(variance * 365);
        const riskFreeRate = 0.04;
        result.sharpeRatio = result.volatility > 0 ?
            (result.annualizedReturn - riskFreeRate) / result.volatility : 0;
        const negativeReturns = dailyReturns.filter(r => r < 0);
        if (negativeReturns.length > 0) {
            const downside = negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length;
            const downsideDeviation = Math.sqrt(downside * 365);
            result.sortinoRatio = downsideDeviation > 0 ?
                (result.annualizedReturn - riskFreeRate) / downsideDeviation : 0;
        }
        const winningTrades = result.trades.filter(t => t.pnl > 0);
        const losingTrades = result.trades.filter(t => t.pnl < 0);
        if (winningTrades.length > 0) {
            result.avgWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length;
        }
        if (losingTrades.length > 0) {
            result.avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length);
        }
        const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
        const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
        result.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
        if (greeksTracking.length > 0) {
            result.greeksExposure = {
                avgDelta: greeksTracking.reduce((sum, g) => sum + g.delta, 0) / greeksTracking.length,
                avgGamma: greeksTracking.reduce((sum, g) => sum + g.gamma, 0) / greeksTracking.length,
                avgTheta: greeksTracking.reduce((sum, g) => sum + g.theta, 0) / greeksTracking.length,
                avgVega: greeksTracking.reduce((sum, g) => sum + g.vega, 0) / greeksTracking.length
            };
        }
        const monthlyReturns = this.calculateMonthlyReturns(result.dailyReturns);
        result.monthlyReturns = monthlyReturns;
    }
    calculateMonthlyReturns(dailyReturns) {
        const monthlyData = new Map();
        for (const daily of dailyReturns) {
            const monthKey = `${daily.date.getFullYear()}-${String(daily.date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData.has(monthKey)) {
                monthlyData.set(monthKey, []);
            }
            monthlyData.get(monthKey).push(daily.return);
        }
        return Array.from(monthlyData.entries()).map(([month, returns]) => ({
            month,
            return: returns[returns.length - 1] || 0
        }));
    }
    async closeRemainingPositions(openPositions, endDate, sortedData, result, config) {
        const lastDataPoint = [...sortedData.values()].pop();
        if (!lastDataPoint)
            return;
        for (const [symbol, trade] of openPositions) {
            const lastPrice = lastDataPoint.find(d => d.symbol === symbol)?.close || trade.entryPrice;
            await this.closeBacktestTrade(trade, endDate, lastPrice, null, config);
            result.trades.push(trade);
            this.updateTradeStatistics(result, trade);
        }
    }
    async generateTradeRecommendations(result, symbols, timeframe) {
        const recommendations = [];
        try {
            for (const symbol of symbols) {
                const analysis = await this.optionsTechnicalService.analyzeOptionsData(symbol, timeframe, 'ALL');
                if (!analysis.success)
                    continue;
                const recommendation = await this.createTradeRecommendation(symbol, analysis, result);
                if (recommendation) {
                    recommendations.push(recommendation);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to generate trade recommendations:', error);
        }
        return recommendations;
    }
    async createTradeRecommendation(symbol, analysis, backtestResult) {
        try {
            const { adx, rsi, macd, bollinger } = analysis.indicators;
            const trend = this.determineTrend(adx, macd);
            const momentum = this.determineMomentum(rsi, macd);
            const volatility = this.determineVolatility(bollinger);
            let confidence = 50;
            if (trend === 'BULLISH' && momentum === 'STRONG')
                confidence += 30;
            if (trend === 'BEARISH' && momentum === 'STRONG')
                confidence += 30;
            if (adx.adx > 25)
                confidence += 10;
            if (Math.abs(rsi.rsi - 50) > 20)
                confidence += 10;
            let action = 'HOLD';
            if (trend === 'BULLISH' && momentum === 'STRONG' && confidence > 70) {
                action = 'BUY';
            }
            else if (trend === 'BEARISH' && momentum === 'STRONG' && confidence > 70) {
                action = 'SELL';
            }
            const symbolTrades = backtestResult.trades.filter(t => t.symbol === symbol);
            const winRate = symbolTrades.length > 0 ?
                symbolTrades.filter(t => t.pnl > 0).length / symbolTrades.length : 0.5;
            const positionSize = Math.min(0.1, 0.05 + (winRate * 0.05));
            const currentPrice = 100;
            const recommendation = {
                symbol,
                action,
                instrumentType: 'EQUITY',
                confidence: Math.min(confidence, 95),
                reasoning: this.generateRecommendationReasoning(analysis, trend, momentum),
                technicalAnalysis: { trend, momentum, volatility },
                riskReward: {
                    stopLoss: currentPrice * (action === 'BUY' ? 0.95 : 1.05),
                    takeProfit: currentPrice * (action === 'BUY' ? 1.10 : 0.90),
                    riskRewardRatio: 2.0
                },
                positionSize,
                maxRisk: 0.02
            };
            return recommendation;
        }
        catch (error) {
            logger_1.logger.error(`Failed to create recommendation for ${symbol}:`, error);
            return null;
        }
    }
    determineTrend(adx, macd) {
        if (adx.adx > 25) {
            if (macd.macd > macd.signal)
                return 'BULLISH';
            if (macd.macd < macd.signal)
                return 'BEARISH';
        }
        return 'NEUTRAL';
    }
    determineMomentum(rsi, macd) {
        const rsiValue = rsi.rsi;
        const macdHistogram = macd.histogram;
        if ((rsiValue > 60 && macdHistogram > 0) || (rsiValue < 40 && macdHistogram < 0)) {
            return 'STRONG';
        }
        if ((rsiValue > 45 && rsiValue < 55) && Math.abs(macdHistogram) < 0.1) {
            return 'WEAK';
        }
        return 'NEUTRAL';
    }
    determineVolatility(bollinger) {
        const bandwidth = (bollinger.upper - bollinger.lower) / bollinger.middle;
        if (bandwidth > 0.1)
            return 'HIGH';
        if (bandwidth < 0.05)
            return 'LOW';
        return 'NORMAL';
    }
    generateRecommendationReasoning(analysis, trend, momentum) {
        const { adx, rsi, macd } = analysis.indicators;
        let reasoning = `Technical analysis shows ${trend.toLowerCase()} trend with ${momentum.toLowerCase()} momentum. `;
        if (adx.adx > 25) {
            reasoning += `Strong trend confirmed by ADX (${adx.adx.toFixed(1)}). `;
        }
        if (rsi.rsi > 70) {
            reasoning += `RSI indicates overbought conditions (${rsi.rsi.toFixed(1)}). `;
        }
        else if (rsi.rsi < 30) {
            reasoning += `RSI indicates oversold conditions (${rsi.rsi.toFixed(1)}). `;
        }
        if (macd.macd > macd.signal) {
            reasoning += `MACD shows bullish crossover. `;
        }
        else if (macd.macd < macd.signal) {
            reasoning += `MACD shows bearish crossover. `;
        }
        return reasoning.trim();
    }
    async calculateRiskMetrics(result, config) {
        const returns = result.dailyReturns.map(r => r.return);
        return {
            var95: this.calculateVaR(returns, 0.95),
            cvar95: this.calculateCVaR(returns, 0.95),
            beta: await this.calculateBeta(returns),
            alpha: result.annualizedReturn - (0.04 + 1.0 * (0.08 - 0.04)),
            informationRatio: result.sharpeRatio,
            calmarRatio: result.maxDrawdown > 0 ? result.annualizedReturn / result.maxDrawdown : 0,
            sterlingRatio: result.maxDrawdown > 0 ? result.annualizedReturn / Math.abs(result.maxDrawdown) : 0,
            totalGreeksExposure: result.greeksExposure,
            correlationToMarket: await this.calculateMarketCorrelation(returns),
            diversificationRatio: this.calculateDiversificationRatio(result.trades)
        };
    }
    calculateVaR(returns, confidence) {
        const sortedReturns = [...returns].sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * sortedReturns.length);
        return sortedReturns[index] || 0;
    }
    calculateCVaR(returns, confidence) {
        const var95 = this.calculateVaR(returns, confidence);
        const tailReturns = returns.filter(r => r <= var95);
        return tailReturns.length > 0 ?
            tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length : 0;
    }
    async calculateBeta(returns) {
        return 1.0;
    }
    async calculateMarketCorrelation(returns) {
        return 0.7;
    }
    calculateDiversificationRatio(trades) {
        const symbols = new Set(trades.map(t => t.symbol));
        const totalTrades = trades.length;
        return totalTrades > 0 ? symbols.size / totalTrades : 0;
    }
    initializeRiskMetrics() {
        return {
            var95: 0,
            cvar95: 0,
            beta: 1,
            alpha: 0,
            informationRatio: 0,
            calmarRatio: 0,
            sterlingRatio: 0,
            totalGreeksExposure: { delta: 0, gamma: 0, theta: 0, vega: 0 },
            correlationToMarket: 0,
            diversificationRatio: 0
        };
    }
    async saveBacktestResult(result) {
        try {
            const savedResult = await database_1.db.backtestResult.create({
                data: {
                    strategyId: result.strategyId,
                    startDate: result.startDate,
                    endDate: result.endDate,
                    initialCapital: result.initialCapital,
                    instruments: JSON.stringify(Array.from(new Set(result.trades.map(t => t.symbol)))),
                    finalCapital: result.finalCapital,
                    totalReturn: result.totalReturn,
                    annualizedReturn: result.annualizedReturn,
                    maxDrawdown: result.maxDrawdown,
                    sharpeRatio: result.sharpeRatio,
                    sortinoRatio: result.sortinoRatio,
                    totalOptionsTrades: result.totalOptionsTrades,
                    optionsWinRate: result.optionsWinRate,
                    averageOptionsPnL: result.averageOptionsPnL
                }
            });
            for (const trade of result.trades) {
                const instrument = await database_1.db.instrument.findFirst({
                    where: { symbol: trade.symbol }
                });
                if (instrument) {
                    await database_1.db.backtestTrade.create({
                        data: {
                            backtestId: savedResult.id,
                            instrumentId: instrument.id,
                            action: trade.side === 'LONG' ? 'BUY' : 'SELL',
                            quantity: trade.quantity,
                            price: trade.entryPrice,
                            timestamp: trade.entryDate,
                            pnl: trade.pnl,
                            strikePrice: trade.strikePrice,
                            optionType: trade.optionType,
                            expiryDate: trade.expiryDate
                        }
                    });
                }
            }
            logger_1.logger.info('Enhanced backtest result saved:', savedResult.id);
            return savedResult;
        }
        catch (error) {
            logger_1.logger.error('Failed to save enhanced backtest result:', error);
            throw error;
        }
    }
    async getBacktestResults(strategyId) {
        try {
            const where = strategyId ? { strategyId } : {};
            const results = await database_1.db.backtestResult.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                include: {
                    strategy: true,
                    trades: {
                        include: {
                            instrument: true
                        }
                    }
                }
            });
            return results.map(result => ({
                id: result.id,
                strategyId: result.strategyId,
                startDate: result.startDate,
                endDate: result.endDate,
                initialCapital: result.initialCapital,
                finalCapital: result.finalCapital,
                totalReturn: result.totalReturn,
                annualizedReturn: result.annualizedReturn,
                sharpeRatio: result.sharpeRatio || 0,
                sortinoRatio: result.sortinoRatio || 0,
                maxDrawdown: result.maxDrawdown,
                volatility: 0,
                totalTrades: result.trades.length,
                winningTrades: result.trades.filter(t => (t.pnl || 0) > 0).length,
                losingTrades: result.trades.filter(t => (t.pnl || 0) < 0).length,
                winRate: result.trades.length > 0 ?
                    result.trades.filter(t => (t.pnl || 0) > 0).length / result.trades.length : 0,
                avgWin: 0,
                avgLoss: 0,
                profitFactor: 0,
                totalOptionsTrades: result.totalOptionsTrades,
                optionsWinRate: result.optionsWinRate || 0,
                averageOptionsPnL: result.averageOptionsPnL || 0,
                greeksExposure: { avgDelta: 0, avgGamma: 0, avgTheta: 0, avgVega: 0 },
                trades: result.trades.map(trade => ({
                    id: trade.id,
                    symbol: trade.instrument.symbol,
                    entryDate: trade.timestamp,
                    exitDate: trade.timestamp,
                    entryPrice: trade.price,
                    exitPrice: trade.price,
                    quantity: trade.quantity,
                    side: trade.action === 'BUY' ? 'LONG' : 'SHORT',
                    pnl: trade.pnl || 0,
                    fees: 0,
                    instrumentType: trade.instrument.instrumentType === 'OPT' ? 'OPTION' : 'EQUITY',
                    strikePrice: trade.strikePrice,
                    optionType: trade.optionType,
                    expiryDate: trade.expiryDate,
                    technicalSignals: {
                        adx: 0,
                        rsi: 50,
                        macd: { macd: 0, signal: 0, histogram: 0 },
                        bollinger: { upper: 0, middle: 0, lower: 0 }
                    }
                })),
                dailyReturns: [],
                monthlyReturns: [],
                recommendations: [],
                riskMetrics: this.initializeRiskMetrics(),
                createdAt: result.createdAt
            }));
        }
        catch (error) {
            logger_1.logger.error('Failed to get enhanced backtest results:', error);
            throw error;
        }
    }
    async getTradeRecommendations(symbols, timeframe = '1day') {
        try {
            const recommendations = [];
            for (const symbol of symbols) {
                const analysis = await this.optionsTechnicalService.analyzeOptionsData(symbol, timeframe, 'ALL');
                if (analysis.success) {
                    const recommendation = await this.createTradeRecommendation(symbol, analysis, {
                        trades: [],
                        totalTrades: 0,
                        winningTrades: 0,
                        losingTrades: 0
                    });
                    if (recommendation) {
                        recommendations.push(recommendation);
                    }
                }
            }
            return recommendations.sort((a, b) => b.confidence - a.confidence);
        }
        catch (error) {
            logger_1.logger.error('Failed to get trade recommendations:', error);
            throw error;
        }
    }
}
exports.EnhancedBacktestService = EnhancedBacktestService;
//# sourceMappingURL=enhanced-backtest.service.js.map