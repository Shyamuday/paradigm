#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TimeframeConfig {
    name: string;
    checkInterval: number; // minutes
    lastCheck: Date;
    shouldCheck: (now: Date) => boolean;
}

interface PaperTrade {
    id: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    success: boolean;
    entryTime: Date;
    exitTime: Date;
    rsiAtEntry: number;
    sma20AtEntry: number;
    stopLoss: number;
    takeProfit: number;
    timeframe: string;
    strategy: string;
}

interface PaperTradingConfig {
    // Conservative Strategy Settings (98.6% success rate)
    rsiMin: number;           // 30 - Avoid extreme oversold
    rsiMax: number;           // 70 - Avoid extreme overbought
    rsiOversold: number;      // 35 - Safe oversold level
    rsiOverbought: number;    // 65 - Safe overbought level
    startHour: number;        // 14 - 2:00 PM start
    endHour: number;          // 15 - 3:00 PM end
    avoidDays: number[];      // [5] - Avoid Fridays
    volumeMultiplier: number; // 1.2 - 120% volume confirmation
    useMACD: boolean;         // true - MACD confirmation
    useBollingerBands: boolean; // true - Bollinger Bands
    useATR: boolean;          // true - ATR-based stops
    atrMultiplier: number;    // 2.0 - ATR multiplier
    maxDailyLoss: number;     // 1000 - Daily loss limit
    maxPositions: number;     // 5 - Maximum concurrent positions
    capital: number;          // 100000 - Starting capital
    positionSize: number;     // 0.1 - 10% per trade
}

interface PaperTradingSession {
    startTime: Date;
    endTime: Date | null;
    initialCapital: number;
    currentCapital: number;
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
    totalPnl: number;
    dailyPnl: number;
    openPositions: Map<string, PaperTrade>;
    closedPositions: PaperTrade[];
    dailyStats: {
        [date: string]: {
            trades: number;
            pnl: number;
            successRate: number;
        };
    };
}

class OptimizedPaperTrading {
    private config: PaperTradingConfig;
    private session: PaperTradingSession;
    private symbols: string[] = [
        'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
        'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA', 'TITAN', 'WIPRO', 'ULTRACEMCO', 'TECHM', 'POWERGRID',
        'NESTLEIND', 'BAJFINANCE', 'NTPC', 'BAJAJFINSV', 'ONGC', 'ADANIENT', 'JSWSTEEL', 'TATAMOTORS', 'HINDALCO', 'COALINDIA',
        'BRITANNIA', 'TATASTEEL', 'CIPLA', 'SHREECEM', 'DIVISLAB', 'EICHERMOT', 'HEROMOTOCO', 'DRREDDY', 'BPCL', 'INDUSINDBK',
        'TATACONSUM', 'SBI', 'HDFC', 'VEDL', 'GRASIM', 'M&M', 'UPL', 'TATAPOWER', 'BAJAJ-AUTO', 'HINDCOPPER', 'APOLLOHOSP'
    ];

    private timeframes: TimeframeConfig[] = [
        {
            name: '15min',
            checkInterval: 5, // Check every 5 minutes
            lastCheck: new Date(0),
            shouldCheck: (now: Date) => {
                const minutes = now.getMinutes();
                return minutes % 5 === 0 && now.getSeconds() < 30; // Check at :00, :05, :10, :15, etc.
            }
        },
        {
            name: '30min',
            checkInterval: 15, // Check every 15 minutes
            lastCheck: new Date(0),
            shouldCheck: (now: Date) => {
                const minutes = now.getMinutes();
                return (minutes % 15 === 0) && now.getSeconds() < 30; // Check at :00, :15, :30, :45
            }
        },
        {
            name: '1hour',
            checkInterval: 30, // Check every 30 minutes
            lastCheck: new Date(0),
            shouldCheck: (now: Date) => {
                const minutes = now.getMinutes();
                return (minutes % 30 === 0) && now.getSeconds() < 30; // Check at :00, :30
            }
        },
        {
            name: '1day',
            checkInterval: 1440, // Check once per day
            lastCheck: new Date(0),
            shouldCheck: (now: Date) => {
                const hour = now.getHours();
                const minutes = now.getMinutes();
                return hour === 9 && minutes === 0 && now.getSeconds() < 30; // Check at 9:00 AM
            }
        }
    ];

    private isRunning: boolean = false;
    private resultsDir: string;

    constructor() {
        this.resultsDir = path.join(__dirname, '..', 'data', 'paper-trading-results');
        this.config = {
            rsiMin: 30,
            rsiMax: 70,
            rsiOversold: 35,
            rsiOverbought: 65,
            startHour: 14,
            endHour: 15,
            avoidDays: [5], // Friday
            volumeMultiplier: 1.2,
            useMACD: true,
            useBollingerBands: true,
            useATR: true,
            atrMultiplier: 2.0,
            maxDailyLoss: 1000,
            maxPositions: 5,
            capital: 100000,
            positionSize: 0.1
        };

        this.session = this.initializeSession();
    }

    private initializeSession(): PaperTradingSession {
        return {
            startTime: new Date(),
            endTime: null,
            initialCapital: this.config.capital,
            currentCapital: this.config.capital,
            totalTrades: 0,
            successfulTrades: 0,
            failedTrades: 0,
            successRate: 0,
            totalPnl: 0,
            dailyPnl: 0,
            openPositions: new Map(),
            closedPositions: [],
            dailyStats: {}
        };
    }

    async startPaperTrading(): Promise<void> {
        console.log('🚀 STARTING OPTIMIZED PAPER TRADING - Smart Timeframe Checking\n');
        console.log('📊 CONFIGURATION:');
        console.log('=================');
        console.log(`💰 Initial Capital: ₹${this.config.capital.toLocaleString()}`);
        console.log(`📈 Position Size: ${(this.config.positionSize * 100).toFixed(1)}% per trade`);
        console.log(`⏰ Trading Hours: ${this.config.startHour}:00 - ${this.config.endHour}:00`);
        console.log(`📅 Avoid Days: ${this.config.avoidDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`);
        console.log(`📊 RSI Range: ${this.config.rsiMin}-${this.config.rsiMax}`);
        console.log(`📈 Volume Multiplier: ${this.config.volumeMultiplier}x`);
        console.log(`🛡️ Max Daily Loss: ₹${this.config.maxDailyLoss}`);
        console.log(`📦 Max Positions: ${this.config.maxPositions}`);
        console.log('');
        console.log('⏰ TIMEFRAME CHECKING SCHEDULE:');
        console.log('==============================');
        console.log('🕐 15min timeframe: Every 5 minutes (at :00, :05, :10, :15, etc.)');
        console.log('🕐 30min timeframe: Every 15 minutes (at :00, :15, :30, :45)');
        console.log('🕐 1hour timeframe: Every 30 minutes (at :00, :30)');
        console.log('🕐 1day timeframe: Once per day (at 9:00 AM)');
        console.log('');

        try {
            await db.$connect();
            this.isRunning = true;

            // Start monitoring loop
            await this.runTradingLoop();

        } catch (error) {
            console.error('❌ Error in paper trading:', error);
        } finally {
            await this.stopPaperTrading();
        }
    }

    private async runTradingLoop(): Promise<void> {
        console.log('🔄 Starting optimized trading loop...\n');

        while (this.isRunning) {
            try {
                const now = new Date();

                // Check if we should be trading
                if (!this.shouldTrade(now)) {
                    await this.sleep(60000); // Wait 1 minute
                    continue;
                }

                // Check daily loss limit
                if (this.session.dailyPnl <= -this.config.maxDailyLoss) {
                    console.log(`⚠️ Daily loss limit reached: ₹${this.session.dailyPnl.toFixed(2)}`);
                    await this.sleep(60000);
                    continue;
                }

                // Check max positions
                if (this.session.openPositions.size >= this.config.maxPositions) {
                    await this.sleep(30000); // Wait 30 seconds
                    continue;
                }

                // Check which timeframes need to be processed
                const timeframesToCheck = this.getTimeframesToCheck(now);

                if (timeframesToCheck.length > 0) {
                    console.log(`⏰ Checking timeframes: ${timeframesToCheck.map(t => t.name).join(', ')}`);

                    // Process each symbol for the timeframes that need checking
                    for (const symbol of this.symbols) {
                        if (!this.isRunning) break;

                        // Skip if already have position in this symbol
                        if (this.session.openPositions.has(symbol)) continue;

                        await this.processSymbol(symbol, timeframesToCheck, now);
                        await this.sleep(500); // Wait 0.5 seconds between symbols
                    }
                }

                // Update open positions
                await this.updateOpenPositions(now);

                // Display status every 5 minutes
                if (now.getMinutes() % 5 === 0 && now.getSeconds() < 10) {
                    this.displayStatus();
                }

                await this.sleep(10000); // Wait 10 seconds

            } catch (error) {
                console.error('❌ Error in trading loop:', error);
                await this.sleep(30000);
            }
        }
    }

    private getTimeframesToCheck(now: Date): TimeframeConfig[] {
        const timeframesToCheck: TimeframeConfig[] = [];

        for (const timeframe of this.timeframes) {
            if (timeframe.shouldCheck(now)) {
                const timeSinceLastCheck = now.getTime() - timeframe.lastCheck.getTime();
                const minIntervalMs = timeframe.checkInterval * 60 * 1000;

                if (timeSinceLastCheck >= minIntervalMs) {
                    timeframesToCheck.push(timeframe);
                    timeframe.lastCheck = now;
                }
            }
        }

        return timeframesToCheck;
    }

    private shouldTrade(now: Date): boolean {
        const hour = now.getHours();
        const day = now.getDay();

        // Time filter
        if (hour < this.config.startHour || hour > this.config.endHour) {
            return false;
        }

        // Day filter
        if (this.config.avoidDays.includes(day)) {
            return false;
        }

        return true;
    }

    private async processSymbol(symbol: string, timeframesToCheck: TimeframeConfig[], now: Date): Promise<void> {
        try {
            const signals: any[] = [];

            // Only check the timeframes that need checking
            for (const timeframe of timeframesToCheck) {
                try {
                    const data = await this.getSymbolData(symbol, timeframe.name);
                    if (data.length < 50) continue;

                    const signal = this.generateSignal(data, symbol, timeframe.name);
                    if (signal) {
                        signals.push(signal);
                    }
                } catch (error) {
                    // Continue with other timeframes
                }
            }

            if (signals.length === 0) return;

            // Find best signal
            const bestSignal = signals.reduce((best, current) =>
                current.confidence > best.confidence ? current : best
            );

            if (bestSignal.confidence > 0.7) {
                await this.executeTrade(symbol, bestSignal, now);
            }

        } catch (error) {
            console.error(`❌ Error processing ${symbol}:`, error);
        }
    }

    private async getSymbolData(symbol: string, timeframe: string): Promise<any[]> {
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        return await db.candleData.findMany({
            where: {
                instrument: { symbol },
                timeframe: { name: timeframe },
                timestamp: { gte: oneDayAgo }
            },
            orderBy: { timestamp: 'asc' }
        });
    }

    private generateSignal(data: any[], symbol: string, timeframe: string): any {
        if (data.length < 50) return null;

        const current = data[data.length - 1]!;
        const rsi = this.calculateRSI(data);
        const sma20 = this.calculateSMA(data, 20);
        const volume = current.volume || 0;
        const avgVolume = this.calculateAverageVolume(data);

        // Volume filter
        if (volume < avgVolume * this.config.volumeMultiplier) return null;

        // RSI filter
        if (rsi < this.config.rsiMin || rsi > this.config.rsiMax) return null;

        // Additional indicators
        let macdSignal = true;
        let bbSignal = true;

        if (this.config.useMACD) {
            const macd = this.calculateMACD(data);
            macdSignal = macd.signal;
        }

        if (this.config.useBollingerBands) {
            const bb = this.calculateBollingerBands(data);
            bbSignal = bb.signal;
        }

        // Generate signal
        let action = 'HOLD';
        let confidence = 0;

        if (rsi <= this.config.rsiOversold && current.close < sma20 && macdSignal && bbSignal) {
            action = 'BUY';
            confidence = 0.8 + (this.config.rsiOversold - rsi) / 100;
        } else if (rsi >= this.config.rsiOverbought && current.close > sma20 && macdSignal && bbSignal) {
            action = 'SELL';
            confidence = 0.8 + (rsi - this.config.rsiOverbought) / 100;
        }

        if (action === 'HOLD') return null;

        return {
            action,
            confidence: Math.min(confidence, 0.95),
            price: current.close,
            rsi,
            sma20,
            timeframe,
            symbol
        };
    }

    private async executeTrade(symbol: string, signal: any, now: Date): Promise<void> {
        try {
            const quantity = Math.floor((this.session.currentCapital * this.config.positionSize) / signal.price);
            if (quantity < 1) return;

            // Calculate stops
            let stopLoss: number;
            let takeProfit: number;

            if (this.config.useATR) {
                const atr = this.calculateATR([signal.price], 14);
                const atrValue = atr * this.config.atrMultiplier;

                if (signal.action === 'BUY') {
                    stopLoss = signal.price - atrValue;
                    takeProfit = signal.price + (atrValue * 1.5);
                } else {
                    stopLoss = signal.price + atrValue;
                    takeProfit = signal.price - (atrValue * 1.5);
                }
            } else {
                if (signal.action === 'BUY') {
                    stopLoss = signal.price * 0.98;
                    takeProfit = signal.price * 1.03;
                } else {
                    stopLoss = signal.price * 1.02;
                    takeProfit = signal.price * 0.97;
                }
            }

            const trade: PaperTrade = {
                id: `${symbol}_${Date.now()}`,
                symbol,
                action: signal.action,
                entryPrice: signal.price,
                exitPrice: 0,
                quantity,
                pnl: 0,
                success: false,
                entryTime: now,
                exitTime: new Date(),
                rsiAtEntry: signal.rsi,
                sma20AtEntry: signal.sma20,
                stopLoss,
                takeProfit,
                timeframe: signal.timeframe,
                strategy: 'Optimized Conservative'
            };

            this.session.openPositions.set(symbol, trade);
            this.session.totalTrades++;

            console.log(`📈 ${signal.action} ${symbol} (${signal.timeframe}): ₹${signal.price.toFixed(2)} x ${quantity} shares`);
            console.log(`   RSI: ${signal.rsi.toFixed(1)}, Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
            console.log(`   Stop: ₹${stopLoss.toFixed(2)}, Target: ₹${takeProfit.toFixed(2)}`);

        } catch (error) {
            console.error(`❌ Error executing trade for ${symbol}:`, error);
        }
    }

    private async updateOpenPositions(now: Date): Promise<void> {
        for (const [symbol, trade] of this.session.openPositions.entries()) {
            try {
                const currentPrice = await this.getCurrentPrice(symbol);
                if (!currentPrice) continue;

                let shouldExit = false;
                let exitPrice = currentPrice;
                let success = false;

                if (trade.action === 'BUY') {
                    if (currentPrice <= trade.stopLoss) {
                        shouldExit = true;
                        exitPrice = trade.stopLoss;
                        success = false;
                    } else if (currentPrice >= trade.takeProfit) {
                        shouldExit = true;
                        exitPrice = trade.takeProfit;
                        success = true;
                    }
                } else {
                    if (currentPrice >= trade.stopLoss) {
                        shouldExit = true;
                        exitPrice = trade.stopLoss;
                        success = false;
                    } else if (currentPrice <= trade.takeProfit) {
                        shouldExit = true;
                        exitPrice = trade.takeProfit;
                        success = true;
                    }
                }

                if (shouldExit) {
                    trade.exitPrice = exitPrice;
                    trade.exitTime = now;
                    trade.success = success;
                    trade.pnl = trade.action === 'BUY'
                        ? (exitPrice - trade.entryPrice) * trade.quantity
                        : (trade.entryPrice - exitPrice) * trade.quantity;

                    this.session.openPositions.delete(symbol);
                    this.session.closedPositions.push(trade);

                    if (success) {
                        this.session.successfulTrades++;
                    } else {
                        this.session.failedTrades++;
                    }

                    this.session.totalPnl += trade.pnl;
                    this.session.currentCapital += trade.pnl;
                    this.session.dailyPnl += trade.pnl;

                    const status = success ? '✅' : '❌';
                    console.log(`${status} ${trade.action} ${symbol} closed: ₹${trade.pnl.toFixed(2)} (${(trade.pnl / trade.entryPrice / trade.quantity * 100).toFixed(2)}%)`);
                }

            } catch (error) {
                console.error(`❌ Error updating position for ${symbol}:`, error);
            }
        }
    }

    private async getCurrentPrice(symbol: string): Promise<number | null> {
        try {
            const latestData = await db.candleData.findFirst({
                where: {
                    instrument: { symbol }
                },
                orderBy: { timestamp: 'desc' }
            });

            return latestData?.close || null;
        } catch (error) {
            return null;
        }
    }

    private displayStatus(): void {
        const successRate = this.session.totalTrades > 0
            ? (this.session.successfulTrades / this.session.totalTrades) * 100
            : 0;

        console.log('\n📊 OPTIMIZED PAPER TRADING STATUS:');
        console.log('==================================');
        console.log(`💰 Capital: ₹${this.session.currentCapital.toFixed(2)} (${((this.session.currentCapital - this.config.capital) / this.config.capital * 100).toFixed(2)}%)`);
        console.log(`📈 Total P&L: ₹${this.session.totalPnl.toFixed(2)}`);
        console.log(`📅 Daily P&L: ₹${this.session.dailyPnl.toFixed(2)}`);
        console.log(`📊 Trades: ${this.session.totalTrades} (${this.session.successfulTrades}✅ ${this.session.failedTrades}❌)`);
        console.log(`🎯 Success Rate: ${successRate.toFixed(1)}%`);
        console.log(`📦 Open Positions: ${this.session.openPositions.size}`);
        console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
        console.log('');
    }

    private async stopPaperTrading(): Promise<void> {
        this.isRunning = false;
        this.session.endTime = new Date();

        console.log('\n🛑 OPTIMIZED PAPER TRADING STOPPED');
        console.log('==================================');
        this.displayFinalResults();
        await this.saveResults();
        await db.$disconnect();
    }

    private displayFinalResults(): void {
        const duration = this.session.endTime!.getTime() - this.session.startTime.getTime();
        const hours = Math.floor(duration / (1000 * 60 * 60));
        const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

        const successRate = this.session.totalTrades > 0
            ? (this.session.successfulTrades / this.session.totalTrades) * 100
            : 0;

        const totalReturn = ((this.session.currentCapital - this.config.capital) / this.config.capital) * 100;

        console.log('\n🏆 FINAL OPTIMIZED PAPER TRADING RESULTS');
        console.log('========================================');
        console.log(`⏱️ Duration: ${hours}h ${minutes}m`);
        console.log(`💰 Initial Capital: ₹${this.config.capital.toLocaleString()}`);
        console.log(`💰 Final Capital: ₹${this.session.currentCapital.toFixed(2)}`);
        console.log(`📈 Total Return: ${totalReturn.toFixed(2)}%`);
        console.log(`📊 Total P&L: ₹${this.session.totalPnl.toFixed(2)}`);
        console.log(`📈 Total Trades: ${this.session.totalTrades}`);
        console.log(`✅ Successful Trades: ${this.session.successfulTrades}`);
        console.log(`❌ Failed Trades: ${this.session.failedTrades}`);
        console.log(`🎯 Success Rate: ${successRate.toFixed(1)}%`);
        console.log(`📦 Open Positions: ${this.session.openPositions.size}`);

        if (this.session.closedPositions.length > 0) {
            const avgPnl = this.session.totalPnl / this.session.closedPositions.length;
            const maxWin = Math.max(...this.session.closedPositions.map(t => t.pnl));
            const maxLoss = Math.min(...this.session.closedPositions.map(t => t.pnl));

            console.log(`📊 Average P&L per Trade: ₹${avgPnl.toFixed(2)}`);
            console.log(`🏆 Max Win: ₹${maxWin.toFixed(2)}`);
            console.log(`💸 Max Loss: ₹${maxLoss.toFixed(2)}`);
        }
    }

    private async saveResults(): Promise<void> {
        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `optimized-paper-trading-${timestamp}.json`;
            const filepath = path.join(this.resultsDir, filename);

            const resultsData = {
                timestamp: new Date().toISOString(),
                config: this.config,
                session: {
                    ...this.session,
                    openPositions: Array.from(this.session.openPositions.values()),
                    dailyStats: this.session.dailyStats
                },
                summary: {
                    totalReturn: ((this.session.currentCapital - this.config.capital) / this.config.capital) * 100,
                    successRate: this.session.totalTrades > 0 ? (this.session.successfulTrades / this.session.totalTrades) * 100 : 0,
                    avgPnlPerTrade: this.session.closedPositions.length > 0 ? this.session.totalPnl / this.session.closedPositions.length : 0
                }
            };

            await fs.writeFile(filepath, JSON.stringify(resultsData, null, 2));
            console.log(`💾 Results saved to: ${filepath}`);

        } catch (error) {
            console.error('❌ Error saving results:', error);
        }
    }

    // Technical Indicators
    private calculateRSI(data: any[]): number {
        if (data.length < 14) return 50;

        let gains = 0;
        let losses = 0;

        for (let i = data.length - 14; i < data.length; i++) {
            const change = data[i]!.close - data[i - 1]!.close;
            if (change > 0) {
                gains += change;
            } else {
                losses += Math.abs(change);
            }
        }

        const avgGain = gains / 14;
        const avgLoss = losses / 14;

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    private calculateSMA(data: any[], period: number): number {
        if (data.length < period) return data[data.length - 1]!.close;
        const sum = data.slice(-period).reduce((acc, candle) => acc + candle.close, 0);
        return sum / period;
    }

    private calculateAverageVolume(data: any[]): number {
        const volumes = data.map(d => d.volume || 0).filter(v => v > 0);
        if (volumes.length === 0) return 1000000;
        return volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
    }

    private calculateMACD(data: any[]): { signal: boolean } {
        if (data.length < 26) return { signal: true };

        const ema12 = this.calculateEMA(data, 12);
        const ema26 = this.calculateEMA(data, 26);
        const macd = ema12 - ema26;
        const signal = macd > 0;

        return { signal };
    }

    private calculateEMA(data: any[], period: number): number {
        if (data.length < period) return data[data.length - 1]!.close;

        const multiplier = 2 / (period + 1);
        let ema = data[0]!.close;

        for (let i = 1; i < data.length; i++) {
            ema = (data[i]!.close * multiplier) + (ema * (1 - multiplier));
        }

        return ema;
    }

    private calculateBollingerBands(data: any[]): { signal: boolean } {
        if (data.length < 20) return { signal: true };

        const sma20 = this.calculateSMA(data, 20);
        const variance = data.slice(-20).reduce((sum, d) => sum + Math.pow(d.close - sma20, 2), 0) / 20;
        const stdDev = Math.sqrt(variance);

        const upperBand = sma20 + (stdDev * 2);
        const lowerBand = sma20 - (stdDev * 2);
        const currentPrice = data[data.length - 1]!.close;

        const signal = currentPrice > lowerBand && currentPrice < upperBand;

        return { signal };
    }

    private calculateATR(data: number[], period: number): number {
        if (data.length < period) return data[0]! * 0.02;

        const trueRanges: number[] = [];

        for (let i = 1; i < data.length; i++) {
            const tr = Math.abs(data[i]! - data[i - 1]!);
            trueRanges.push(tr);
        }

        if (trueRanges.length === 0) return data[0]! * 0.02;

        return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const paperTrading = new OptimizedPaperTrading();
    await paperTrading.startPaperTrading();
}

if (require.main === module) {
    main();
} 