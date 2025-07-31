#!/usr/bin/env ts-node

import { DatabaseManager } from '../src/database/database';
import { logger } from '../src/logger/logger';

interface LiveDataUpdate {
    symbol: string;
    timeframe: string;
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

class LiveDataUpdater {
    private dbManager: DatabaseManager;
    private isRunning: boolean = false;
    private updateInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.dbManager = DatabaseManager.getInstance();
    }

    async start(): Promise<void> {
        try {
            console.log('🚀 Starting Live Data Updater...\n');

            // Connect to database
            await this.dbManager.connect();
            console.log('✅ Database connected');

            // Get timeframe configurations
            const timeframes = await this.getTimeframeConfigs();
            console.log(`📊 Found ${timeframes.length} timeframes`);

            // Get Nifty 50 instruments
            const instruments = await this.getNifty50Instruments();
            console.log(`📊 Found ${instruments.length} Nifty 50 instruments`);

            this.isRunning = true;
            console.log('\n🎯 Live data updater started!');
            console.log('Press Ctrl+C to stop...\n');

            // Start updating data every 30 seconds
            this.updateInterval = setInterval(async () => {
                if (this.isRunning) {
                    await this.updateLiveData(instruments, timeframes);
                }
            }, 30000);

            // Initial update
            await this.updateLiveData(instruments, timeframes);

        } catch (error) {
            console.error('❌ Failed to start live data updater:', error);
            throw error;
        }
    }

    private async getTimeframeConfigs(): Promise<any[]> {
        try {
            const db = this.dbManager.getPrisma();
            return await db.timeframeConfig.findMany({
                orderBy: { intervalMinutes: 'asc' }
            });
        } catch (error) {
            console.error('❌ Error getting timeframe configs:', error);
            return [];
        }
    }

    private async getNifty50Instruments(): Promise<any[]> {
        try {
            const db = this.dbManager.getPrisma();
            return await db.instrument.findMany({
                where: {
                    exchange: 'NSE',
                    symbol: {
                        in: [
                            'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
                            'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
                            'AXISBANK', 'ASIANPAINT', 'MARUTI', 'SUNPHARMA', 'TITAN',
                            'WIPRO', 'ULTRACEMCO', 'NESTLEIND', 'POWERGRID', 'TECHM',
                            'BAJFINANCE', 'NTPC', 'HCLTECH', 'JSWSTEEL', 'ONGC',
                            'COALINDIA', 'TATAMOTORS', 'ADANIENT', 'SHREECEM', 'CIPLA',
                            'DRREDDY', 'BRITANNIA', 'EICHERMOT', 'HEROMOTOCO', 'DIVISLAB',
                            'BAJAJFINSV', 'GRASIM', 'TATACONSUM', 'SBILIFE', 'HINDALCO',
                            'UPL', 'VEDL', 'TATASTEEL', 'BPCL', 'INDUSINDBK', 'MM',
                            'LT', 'APOLLOHOSP', 'BAJAJ-AUTO', 'M&M'
                        ]
                    }
                },
                take: 10 // Start with first 10 for testing
            });
        } catch (error) {
            console.error('❌ Error getting Nifty 50 instruments:', error);
            return [];
        }
    }

    private async updateLiveData(instruments: any[], timeframes: any[]): Promise<void> {
        try {
            console.log(`🔄 Updating live data for ${instruments.length} instruments across ${timeframes.length} timeframes...`);

            const db = this.dbManager.getPrisma();
            let totalUpdates = 0;

            for (const instrument of instruments) {
                for (const timeframe of timeframes) {
                    try {
                        // Generate realistic market data
                        const liveData = this.generateLiveData(instrument.symbol, timeframe.name);

                        // Check if we already have recent data for this combination
                        const existingData = await db.candleData.findFirst({
                            where: {
                                instrumentId: instrument.id,
                                timeframeId: timeframe.id,
                                timestamp: {
                                    gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
                                }
                            },
                            orderBy: { timestamp: 'desc' }
                        });

                        if (!existingData) {
                            // Create new candle data entry
                            await db.candleData.create({
                                data: {
                                    instrumentId: instrument.id,
                                    timeframeId: timeframe.id,
                                    timestamp: liveData.timestamp,
                                    open: liveData.open,
                                    high: liveData.high,
                                    low: liveData.low,
                                    close: liveData.close,
                                    volume: liveData.volume,
                                    typicalPrice: (liveData.high + liveData.low + liveData.close) / 3,
                                    weightedPrice: null,
                                    totalRange: liveData.high - liveData.low
                                }
                            });

                            totalUpdates++;
                            console.log(`   ✅ ${instrument.symbol} (${timeframe.name}): ₹${liveData.close.toFixed(2)}`);
                        }

                    } catch (error) {
                        console.error(`   ❌ Error updating ${instrument.symbol} (${timeframe.name}):`, error);
                    }
                }
            }

            if (totalUpdates > 0) {
                console.log(`\n📊 Updated ${totalUpdates} data points`);
            } else {
                console.log(`\n📊 No new updates needed`);
            }

            // Show current data summary
            await this.showDataSummary();

        } catch (error) {
            console.error('❌ Error updating live data:', error);
        }
    }

    private generateLiveData(symbol: string, timeframe: string): LiveDataUpdate {
        const now = new Date();

        // Generate realistic price data based on symbol
        let basePrice = 1000;
        if (symbol === 'RELIANCE') basePrice = 2800;
        else if (symbol === 'TCS') basePrice = 3800;
        else if (symbol === 'INFY') basePrice = 1500;
        else if (symbol === 'HDFCBANK') basePrice = 1600;
        else if (symbol === 'ICICIBANK') basePrice = 1000;

        // Add some randomness and trend
        const change = (Math.random() - 0.5) * 0.02; // ±1% change
        const price = basePrice * (1 + change);

        const open = price;
        const high = price * (1 + Math.random() * 0.01);
        const low = price * (1 - Math.random() * 0.01);
        const close = price * (1 + (Math.random() - 0.5) * 0.005);
        const volume = Math.floor(Math.random() * 100000) + 10000;

        return {
            symbol,
            timeframe,
            timestamp: now,
            open: Math.round(open * 100) / 100,
            high: Math.round(high * 100) / 100,
            low: Math.round(low * 100) / 100,
            close: Math.round(close * 100) / 100,
            volume
        };
    }

    private async showDataSummary(): Promise<void> {
        try {
            const db = this.dbManager.getPrisma();

            const summary = await db.$queryRaw`
                SELECT 
                    tf.name as timeframe,
                    COUNT(*) as total_records,
                    COUNT(DISTINCT cd."instrumentId") as unique_instruments,
                    MAX(cd.timestamp) as latest_update
                FROM candle_data cd 
                JOIN timeframe_config tf ON cd."timeframeId" = tf.id 
                WHERE cd.timestamp >= NOW() - INTERVAL '1 hour'
                GROUP BY tf.name, tf."intervalMinutes" 
                ORDER BY tf."intervalMinutes"
            `;

            console.log('\n📈 Recent Data Summary (Last 1 Hour):');
            console.log('Timeframe'.padEnd(10) + 'Records'.padEnd(10) + 'Instruments'.padEnd(12) + 'Latest Update');
            console.log('-'.repeat(50));

            for (const row of summary as any[]) {
                console.log(
                    row.timeframe.padEnd(10) +
                    row.total_records.toString().padEnd(10) +
                    row.unique_instruments.toString().padEnd(12) +
                    new Date(row.latest_update).toLocaleTimeString()
                );
            }

        } catch (error) {
            console.error('❌ Error showing data summary:', error);
        }
    }

    async stop(): Promise<void> {
        try {
            console.log('\n🛑 Stopping live data updater...');

            this.isRunning = false;

            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            await this.dbManager.disconnect();
            console.log('✅ Database disconnected');

            console.log('✅ Live data updater stopped');
        } catch (error) {
            console.error('❌ Error stopping live data updater:', error);
        }
    }

    getStatus(): any {
        return {
            isRunning: this.isRunning,
            lastUpdate: new Date().toISOString()
        };
    }
}

// CLI interface
if (require.main === module) {
    const liveDataUpdater = new LiveDataUpdater();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await liveDataUpdater.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await liveDataUpdater.stop();
        process.exit(0);
    });

    // Start the service
    liveDataUpdater.start().catch(console.error);
}

export { LiveDataUpdater }; 