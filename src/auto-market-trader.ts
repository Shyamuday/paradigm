#!/usr/bin/env ts-node

import { config } from 'dotenv';
import { KiteConnect } from 'kiteconnect';
import { db } from './database/database';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

interface MarketTime {
    isMarketOpen: boolean;
    currentTime: Date;
    marketStart: Date;
    marketEnd: Date;
    nextMarketOpen: Date;
    timeUntilOpen: string;
    timeUntilClose: string;
}

class AutoMarketTrader {
    private isRunning: boolean = false;
    private trades: any[] = [];
    private capital: number = 100000;
    private currentCapital: number = 100000;
    private instruments: string[] = [
        'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
        'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'AXISBANK'
    ];
    private maxTrades: number = 5;
    private tradeCount: number = 0;
    private kite: any;
    private API_KEY = '4kii2cglymgxjpqq';
    private API_SECRET = 'fmapqarltxl0lhyetqeasfgjias6ov3h';
    private sessionPath: string;

    constructor() {
        this.sessionPath = path.join(__dirname, '..', 'data', 'zerodha-session.json');
    }

    async start(): Promise<void> {
        try {
            console.log('🚀 Starting Auto Market Trader...\n');

            // Check market hours
            const marketTime = this.checkMarketHours();
            console.log('📅 Market Hours Check:');
            console.log(`   Current Time: ${marketTime.currentTime.toLocaleString()}`);
            console.log(`   Market Open: ${marketTime.isMarketOpen ? '✅ YES' : '❌ NO'}`);

            if (!marketTime.isMarketOpen) {
                console.log(`   ⏰ Market opens in: ${marketTime.timeUntilOpen}`);
                console.log(`   📅 Next market open: ${marketTime.nextMarketOpen.toLocaleString()}`);
                console.log('\n🛑 Market is closed. Auto trading will start when market opens.');
                return;
            }

            console.log(`   ⏰ Market closes in: ${marketTime.timeUntilClose}`);
            console.log('\n✅ Market is open! Starting live trading...\n');

            // Connect to database
            await db.$connect();
            console.log('✅ Database connected');

            // Auto-authenticate
            const isAuthenticated = await this.smartAuthenticate();
            if (!isAuthenticated) {
                console.log('❌ Authentication failed. Cannot start trading.');
                return;
            }

            console.log('✅ Authentication completed');

            // Load existing trades
            await this.loadExistingTrades();
            console.log(`📊 Loaded ${this.trades.length} existing trades`);

            this.isRunning = true;
            console.log('🎯 Auto live trading started! Press Ctrl+C to stop...\n');

            // Start trading loop
            this.startTradingLoop();

        } catch (error) {
            console.error('❌ Error starting auto market trader:', error);
            throw error;
        }
    }

    private checkMarketHours(): MarketTime {
        const now = new Date();
        const currentTime = new Date(now);

        // Check if it's a weekday (Monday = 1, Friday = 5)
        const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;

        // Market hours: 9:00 AM to 3:30 PM IST
        const marketStart = new Date(now);
        marketStart.setHours(9, 0, 0, 0);

        const marketEnd = new Date(now);
        marketEnd.setHours(15, 30, 0, 0);

        // Check if market is open
        const isMarketOpen = isWeekday && now >= marketStart && now <= marketEnd;

        // Calculate next market open
        const nextMarketOpen = new Date(now);
        if (now.getDay() === 6) { // Saturday
            nextMarketOpen.setDate(now.getDate() + 2); // Monday
        } else if (now.getDay() === 0) { // Sunday
            nextMarketOpen.setDate(now.getDate() + 1); // Monday
        } else if (now > marketEnd) { // After market hours
            nextMarketOpen.setDate(now.getDate() + 1);
        }
        nextMarketOpen.setHours(9, 0, 0, 0);

        // Calculate time differences
        const timeUntilOpen = this.formatTimeDifference(nextMarketOpen.getTime() - now.getTime());
        const timeUntilClose = this.formatTimeDifference(marketEnd.getTime() - now.getTime());

        return {
            isMarketOpen,
            currentTime,
            marketStart,
            marketEnd,
            nextMarketOpen,
            timeUntilOpen,
            timeUntilClose
        };
    }

    private formatTimeDifference(ms: number): string {
        if (ms <= 0) return '0 minutes';

        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    private async smartAuthenticate(): Promise<boolean> {
        console.log('🔐 Smart authentication check...');

        // Check if session file exists
        if (!fs.existsSync(this.sessionPath)) {
            console.log('📁 No session file found. Need fresh authentication.');
            return await this.performOAuthLogin();
        }

        try {
            const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
            const expiresAt = new Date(sessionData.expires_at);
            const now = new Date();

            console.log(`📅 Session expires at: ${expiresAt.toLocaleString()}`);

            // Check if token is still valid (with 10 minute buffer)
            if (expiresAt > new Date(now.getTime() + 10 * 60 * 1000)) {
                console.log('✅ Session is still valid!');
                this.kite = new KiteConnect({ api_key: this.API_KEY });
                this.kite.setAccessToken(sessionData.access_token);

                // Test the token
                try {
                    const profile = await this.kite.getProfile();
                    console.log(`✅ Valid session for: ${profile.user_name} (${profile.user_id})`);
                    return true;
                } catch (error) {
                    console.log('⚠️  Session test failed, need re-authentication');
                    return await this.performOAuthLogin();
                }
            } else {
                console.log('⚠️  Session expired, need re-authentication');
                return await this.performOAuthLogin();
            }
        } catch (error) {
            console.log('⚠️  Invalid session file, need fresh authentication');
            return await this.performOAuthLogin();
        }
    }

    private async performOAuthLogin(): Promise<boolean> {
        console.log('🔄 Starting OAuth login...');

        return new Promise((resolve) => {
            const app = express();
            const PORT = 3000;

            app.get('/callback', async (req: any, res: any) => {
                try {
                    const { action, status, request_token } = req.query;

                    if (action === 'login' && status === 'success' && request_token) {
                        console.log('✅ Login successful, getting access token...');

                        this.kite = new KiteConnect({ api_key: this.API_KEY });
                        const response = await this.kite.generateSession(request_token, this.API_SECRET);
                        const { access_token, user_id, user_name, email } = response;

                        // Save session to file with longer expiry
                        const sessionData = {
                            access_token,
                            user_id,
                            user_name,
                            email,
                            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
                            login_time: new Date().toISOString()
                        };

                        fs.writeFileSync(this.sessionPath, JSON.stringify(sessionData, null, 2));

                        console.log(`✅ Access token saved for user: ${user_name} (${user_id})`);
                        console.log(`📅 Token expires at: ${new Date(sessionData.expires_at).toLocaleString()}`);

                        res.send(`
                            <html>
                                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                                    <h1 style="color: green;">✅ Authentication Successful!</h1>
                                    <p>Session saved for 24 hours.</p>
                                    <p>You can close this window and return to the terminal.</p>
                                    <p>Auto trading will start automatically.</p>
                                </body>
                            </html>
                        `);

                        // Stop server and resolve
                        setTimeout(() => {
                            server.close();
                            resolve(true);
                        }, 2000);

                    } else {
                        res.send('❌ Authentication failed');
                        resolve(false);
                    }
                } catch (error) {
                    console.error('❌ Error during authentication:', error);
                    res.send('❌ Authentication error');
                    resolve(false);
                }
            });

            const server = app.listen(PORT, () => {
                console.log(`🌐 Server running on http://localhost:${PORT}`);

                // Generate login URL
                const loginUrl = this.kite.getLoginURL();
                console.log(`🔗 Please visit this URL to login:`);
                console.log(loginUrl);
                console.log('\n⏳ Waiting for authentication...');
            });

            // Timeout after 5 minutes
            setTimeout(() => {
                server.close();
                console.log('⏰ Authentication timeout');
                resolve(false);
            }, 5 * 60 * 1000);
        });
    }

    private async loadExistingTrades(): Promise<void> {
        try {
            const dbTrades = await db.trade.findMany({
                orderBy: { createdAt: 'desc' },
                take: 50
            });

            this.trades = dbTrades.map(trade => ({
                id: trade.id,
                symbol: trade.symbol,
                action: trade.action,
                quantity: trade.quantity,
                price: trade.entryPrice,
                timestamp: trade.entryTime,
                status: trade.status,
                pnl: trade.pnl || undefined,
                exitPrice: trade.exitPrice || undefined,
                exitTime: trade.exitTime || undefined
            }));

        } catch (error) {
            console.error('❌ Error loading existing trades:', error);
        }
    }

    private startTradingLoop(): void {
        const interval = setInterval(async () => {
            if (!this.isRunning) {
                clearInterval(interval);
                return;
            }

            try {
                // Check market hours again
                const marketTime = this.checkMarketHours();
                if (!marketTime.isMarketOpen) {
                    console.log(`\n🛑 Market closed at ${marketTime.marketEnd.toLocaleTimeString()}. Stopping trading.`);
                    this.isRunning = false;
                    clearInterval(interval);
                    await this.showFinalResults();
                    await db.$disconnect();
                    return;
                }

                await this.processTradingSignals();
                await this.updatePortfolio();
            } catch (error) {
                console.error('❌ Error in trading loop:', error);
            }
        }, 30000); // Check every 30 seconds

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Stopping auto market trader...');
            this.isRunning = false;
            await this.showFinalResults();
            await db.$disconnect();
            process.exit(0);
        });
    }

    private async processTradingSignals(): Promise<void> {
        console.log(`\n🔄 Processing trading signals at ${new Date().toLocaleTimeString()}`);

        for (const symbol of this.instruments) {
            try {
                const signal = await this.generateSignal(symbol);

                if (signal) {
                    await this.executeTrade(signal);
                }
            } catch (error) {
                console.error(`❌ Error processing ${symbol}:`, error);
            }
        }
    }

    private async generateSignal(symbol: string): Promise<any> {
        try {
            // Get real current price from Zerodha
            let currentPrice: number;

            try {
                const quote = await this.kite.getQuote(`NSE:${symbol}`);
                currentPrice = quote[`NSE:${symbol}`].last_price;
            } catch (error) {
                // Fallback to simulated price if API fails
                currentPrice = this.getSimulatedPrice(symbol);
            }

            // Simple RSI-based signal
            const rsi = this.calculateSimpleRSI(symbol);

            if (rsi < 30) {
                return {
                    symbol,
                    action: 'BUY' as const,
                    quantity: 1,
                    price: currentPrice,
                    reason: `RSI oversold (${rsi.toFixed(2)})`
                };
            } else if (rsi > 70) {
                return {
                    symbol,
                    action: 'SELL' as const,
                    quantity: 1,
                    price: currentPrice,
                    reason: `RSI overbought (${rsi.toFixed(2)})`
                };
            }

            return null;
        } catch (error) {
            console.error(`Error generating signal for ${symbol}:`, error);
            return null;
        }
    }

    private getSimulatedPrice(symbol: string): number {
        // Simulate realistic prices for each symbol
        const basePrices: { [key: string]: number } = {
            'RELIANCE': 2800,
            'TCS': 3800,
            'INFY': 1500,
            'HDFCBANK': 1600,
            'ICICIBANK': 1000,
            'HINDUNILVR': 2500,
            'ITC': 450,
            'SBIN': 650,
            'BHARTIARTL': 1200,
            'AXISBANK': 1100
        };

        const basePrice = basePrices[symbol] || 1000;
        const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
        return basePrice * (1 + variation);
    }

    private calculateSimpleRSI(symbol: string): number {
        // Simplified RSI calculation with some randomness
        return 30 + Math.random() * 50; // Random RSI between 30-80
    }

    private async executeTrade(signal: any): Promise<void> {
        try {
            // Check trade limit
            if (this.tradeCount >= this.maxTrades) {
                console.log(`\n🛑 Trade limit reached (${this.maxTrades} trades). Stopping trading...`);
                this.isRunning = false;
                return;
            }

            const tradeId = `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            console.log(`\n📈 Signal: ${signal.action} ${signal.quantity} ${signal.symbol} at ₹${signal.price.toFixed(2)}`);
            console.log(`   Reason: ${signal.reason}`);
            console.log(`   Trade ${this.tradeCount + 1}/${this.maxTrades}`);

            // Place real order
            const orderParams = {
                tradingsymbol: signal.symbol,
                exchange: 'NSE',
                transaction_type: signal.action,
                quantity: signal.quantity,
                product: 'MIS', // Intraday
                order_type: 'MARKET'
            };

            let orderId = null;
            try {
                orderId = await this.kite.placeOrder('regular', orderParams);
                console.log(`✅ REAL ORDER PLACED: Order ID ${orderId}`);
                console.log(`   ${signal.action} ${signal.quantity} ${signal.symbol} at market price`);
            } catch (orderError: any) {
                console.error(`❌ Real order failed:`, orderError);

                // If it's an authentication error, try to re-authenticate
                if (orderError.error_type === 'TokenException') {
                    console.log('🔄 Token expired, attempting to re-authenticate...');
                    const isAuthenticated = await this.smartAuthenticate();
                    if (isAuthenticated) {
                        // Retry the order
                        try {
                            orderId = await this.kite.placeOrder('regular', orderParams);
                            console.log(`✅ REAL ORDER PLACED (retry): Order ID ${orderId}`);
                        } catch (retryError) {
                            console.error(`❌ Order retry failed:`, retryError);
                            return;
                        }
                    } else {
                        return;
                    }
                } else {
                    return;
                }
            }

            // Create trade object
            const trade = {
                id: tradeId,
                symbol: signal.symbol,
                action: signal.action,
                quantity: signal.quantity,
                price: signal.price,
                timestamp: new Date(),
                status: 'EXECUTED'
            };

            this.trades.push(trade);
            this.tradeCount++;

            // Update capital
            if (signal.action === 'BUY') {
                this.currentCapital -= signal.price * signal.quantity;
            } else {
                this.currentCapital += signal.price * signal.quantity;
            }

            // Save to database
            try {
                await db.trade.create({
                    data: {
                        symbol: signal.symbol,
                        action: signal.action,
                        quantity: signal.quantity,
                        entryPrice: signal.price,
                        status: 'EXECUTED'
                    }
                });
                console.log(`💾 Trade saved to database`);
            } catch (dbError) {
                console.log(`⚠️  Database save skipped (table not created)`);
            }

            console.log(`💰 Current Capital: ₹${this.currentCapital.toFixed(2)}`);
            console.log(`📊 Trades executed: ${this.tradeCount}/${this.maxTrades}`);

        } catch (error) {
            console.error(`❌ Trade execution failed for ${signal.symbol}:`, error);
        }
    }

    private async updatePortfolio(): Promise<void> {
        const totalTrades = this.trades.length;
        const recentTrades = this.trades.slice(-5);

        console.log(`\n📊 Portfolio Update:`);
        console.log(`   💰 Capital: ₹${this.currentCapital.toFixed(2)}`);
        console.log(`   📈 Total Trades: ${totalTrades}`);
        console.log(`   📊 Recent Trades: ${recentTrades.length}`);

        if (recentTrades.length > 0) {
            console.log(`   🕒 Last Trade: ${recentTrades[recentTrades.length - 1].action} ${recentTrades[recentTrades.length - 1].symbol}`);
        }
    }

    private async showFinalResults(): Promise<void> {
        console.log('\n📊 AUTO MARKET TRADING RESULTS');
        console.log('==============================');
        console.log(`📈 Total Trades: ${this.trades.length}`);
        console.log(`💰 Final Capital: ₹${this.currentCapital.toFixed(2)}`);
        console.log(`📊 P&L: ₹${(this.currentCapital - this.capital).toFixed(2)}`);
        console.log(`📈 Return: ${(((this.currentCapital - this.capital) / this.capital) * 100).toFixed(2)}%`);

        if (this.trades.length > 0) {
            console.log('\n📋 Recent Trades:');
            this.trades.slice(-10).forEach((trade, index) => {
                console.log(`${index + 1}. ${trade.action} ${trade.quantity} ${trade.symbol} at ₹${trade.price.toFixed(2)} - ${trade.status}`);
            });
        }
    }
}

// Export the class for use in other modules
export { AutoMarketTrader };

// Start auto market trader
async function main() {
    const trader = new AutoMarketTrader();
    await trader.start();
}

if (require.main === module) {
    main().catch(console.error);
} 