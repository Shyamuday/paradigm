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

interface UpdateConfig {
    symbols: string[];
    timeframes: string[];
    updateInterval: number; // in seconds
    maxUpdates: number; // -1 for unlimited
}

class DynamicLiveUpdater {
    private dbManager: DatabaseManager;
    private isRunning: boolean = false;
    private updateInterval: NodeJS.Timeout | null = null;
    private config: UpdateConfig;
    private updateCount: number = 0;

    constructor(config: UpdateConfig) {
        this.dbManager = DatabaseManager.getInstance();
        this.config = config;
    }

    async start(): Promise<void> {
        try {
            console.log('🚀 Starting Dynamic Live Data Updater...\n');
            console.log(`📊 Symbols: ${this.config.symbols.join(', ')}`);
            console.log(`📊 Timeframes: ${this.config.timeframes.join(', ')}`);
            console.log(`⏱️  Update Interval: ${this.config.updateInterval} seconds`);
            console.log(`🔄 Max Updates: ${this.config.maxUpdates === -1 ? 'Unlimited' : this.config.maxUpdates}\n`);

            // Connect to database
            await this.dbManager.connect();
            console.log('✅ Database connected');

            // Validate symbols and timeframes
            await this.validateConfig();
            console.log('✅ Configuration validated');

            this.isRunning = true;
            console.log('🎯 Dynamic live updater started!');
            console.log('Press Ctrl+C to stop...\n');

            // Start periodic updates
            this.startPeriodicUpdates();

        } catch (error) {
            console.error('❌ Error starting dynamic live updater:', error);
            throw error;
        }
    }

    private async validateConfig(): Promise<void> {
        const db = this.dbManager.getPrisma();

        // Validate symbols
        const instruments = await db.instrument.findMany({
            where: {
                symbol: { in: this.config.symbols },
                exchange: 'NSE'
            }
        });

        if (instruments.length !== this.config.symbols.length) {
            const foundSymbols = instruments.map(i => i.symbol);
            const missingSymbols = this.config.symbols.filter(s => !foundSymbols.includes(s));
            throw new Error(`Missing instruments: ${missingSymbols.join(', ')}`);
        }

        // Validate timeframes
        const timeframes = await db.timeframeConfig.findMany({
            where: { name: { in: this.config.timeframes } }
        });

        if (timeframes.length !== this.config.timeframes.length) {
            const foundTimeframes = timeframes.map(t => t.name);
            const missingTimeframes = this.config.timeframes.filter(t => !foundTimeframes.includes(t));
            throw new Error(`Missing timeframes: ${missingTimeframes.join(', ')}`);
        }

        console.log(`✅ Found ${instruments.length} instruments and ${timeframes.length} timeframes`);
    }

    private startPeriodicUpdates(): void {
        this.updateInterval = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                await this.performUpdate();
                this.updateCount++;

                // Check if max updates reached
                if (this.config.maxUpdates !== -1 && this.updateCount >= this.config.maxUpdates) {
                    console.log(`\n🎯 Reached maximum updates (${this.config.maxUpdates}). Stopping...`);
                    await this.stop();
                }

            } catch (error) {
                console.error('❌ Error during update:', error);
            }
        }, this.config.updateInterval * 1000);
    }

    private async performUpdate(): Promise<void> {
        try {
            const db = this.dbManager.getPrisma();
            const now = new Date();

            console.log(`\n🔄 Update #${this.updateCount + 1} - ${now.toLocaleTimeString()}`);
            console.log(`📊 Updating ${this.config.symbols.length} instruments across ${this.config.timeframes.length} timeframes...`);

            let totalUpdates = 0;

            // Get instruments and timeframes
            const instruments = await db.instrument.findMany({
                where: {
                    symbol: { in: this.config.symbols },
                    exchange: 'NSE'
                }
            });

            const timeframes = await db.timeframeConfig.findMany({
                where: { name: { in: this.config.timeframes } }
            });

            // Update each symbol-timeframe combination
            for (const instrument of instruments) {
                for (const timeframe of timeframes) {
                    try {
                        const liveData = this.generateLiveData(instrument.symbol, timeframe.name);

                        // Check if we need to update (avoid duplicates)
                        const existingData = await db.candleData.findFirst({
                            where: {
                                instrumentId: instrument.id,
                                timeframeId: timeframe.id,
                                timestamp: {
                                    gte: new Date(now.getTime() - 60000) // Last minute
                                }
                            }
                        });

                        if (!existingData) {
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

            // Show data summary
            await this.showDataSummary();

        } catch (error) {
            console.error('❌ Error performing update:', error);
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
        else if (symbol === 'BAJFINANCE') basePrice = 1000;
        else if (symbol === 'CIPLA') basePrice = 1000;
        else if (symbol === 'SBIN') basePrice = 1000;
        else if (symbol === 'TITAN') basePrice = 1000;
        else if (symbol === 'DRREDDY') basePrice = 1000;
        else if (symbol === 'HEROMOTOCO') basePrice = 1000;
        else if (symbol === 'JSWSTEEL') basePrice = 1000;

        // Add some randomness and trend based on timeframe
        const timeframeMultiplier = this.getTimeframeMultiplier(timeframe);
        const change = (Math.random() - 0.5) * 0.02 * timeframeMultiplier; // ±1% change
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

    private getTimeframeMultiplier(timeframe: string): number {
        switch (timeframe) {
            case '1min': return 1;
            case '15min': return 0.8;
            case '30min': return 0.6;
            case '1hour': return 0.4;
            case '1D':
            case '1day': return 0.2;
            default: return 1;
        }
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
            console.log('\n🛑 Stopping dynamic live updater...');

            this.isRunning = false;

            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
                console.log('✅ Update interval cleared');
            }

            await this.dbManager.disconnect();
            console.log('✅ Database disconnected');

            console.log(`✅ Dynamic live updater stopped after ${this.updateCount} updates`);
        } catch (error) {
            console.error('❌ Error stopping dynamic live updater:', error);
        }
    }

    getStatus(): any {
        return {
            isRunning: this.isRunning,
            updateCount: this.updateCount,
            config: this.config,
            lastUpdate: new Date()
        };
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('Usage: npm run live:dynamic -- <symbols> --timeframes <timeframes> --interval <seconds> --max-updates <number>');
        console.log('Example: npm run live:dynamic -- RELIANCE,TCS,INFY --timeframes 1min,15min,30min,1hour --interval 30 --max-updates 100');
        console.log('Example: npm run live:dynamic -- NIFTY50 --timeframes all --interval 60 --max-updates -1');
        process.exit(1);
    }

    // Parse arguments
    let symbols: string[] = [];
    let timeframes: string[] = ['1min', '15min', '30min', '1hour', '1day'];
    let interval = 60; // 60 seconds default
    let maxUpdates = -1; // unlimited default

    let i = 0;
    while (i < args.length) {
        const arg = args[i];

        if (arg === '--timeframes' && i + 1 < args.length) {
            const nextArg = args[i + 1];
            if (nextArg && nextArg === 'all') {
                timeframes = ['1min', '15min', '30min', '1hour', '1D', '1day'];
            } else if (nextArg) {
                timeframes = nextArg.split(',');
            }
            i += 2;
        } else if (arg === '--interval' && i + 1 < args.length) {
            const intervalArg = args[i + 1];
            if (intervalArg) {
                interval = parseInt(intervalArg);
            }
            i += 2;
        } else if (arg === '--max-updates' && i + 1 < args.length) {
            const maxUpdatesArg = args[i + 1];
            if (maxUpdatesArg) {
                maxUpdates = parseInt(maxUpdatesArg);
            }
            i += 2;
        } else if (arg && !arg.startsWith('--')) {
            if (arg === 'NIFTY50') {
                symbols = [
                    'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'BAJFINANCE',
                    'CIPLA', 'SBIN', 'TITAN', 'DRREDDY', 'HEROMOTOCO', 'JSWSTEEL',
                    'AXISBANK', 'KOTAKBANK', 'ITC', 'BHARTIARTL', 'ASIANPAINT', 'MARUTI',
                    'HINDUNILVR', 'SUNPHARMA', 'WIPRO', 'ULTRACEMCO', 'TECHM', 'NESTLEIND',
                    'POWERGRID', 'TATAMOTORS', 'BAJAJFINSV', 'ADANIENT', 'ONGC', 'COALINDIA',
                    'NTPC', 'INDUSINDBK', 'BRITANNIA', 'SHREECEM', 'HCLTECH', 'APOLLOHOSP',
                    'DIVISLAB', 'EICHERMOT', 'ADANIPORTS', 'TATACONSUM', 'BPCL', 'GRASIM',
                    'CIPLA', 'SBILIFE', 'HINDALCO', 'VEDL', 'JSWSTEEL', 'TATASTEEL'
                ];
            } else {
                symbols = arg.split(',');
            }
            i++;
        } else {
            i++;
        }
    }

    if (symbols.length === 0) {
        console.log('Error: No symbols specified');
        process.exit(1);
    }

    const config: UpdateConfig = {
        symbols,
        timeframes,
        updateInterval: interval,
        maxUpdates
    };

    const updater = new DynamicLiveUpdater(config);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await updater.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await updater.stop();
        process.exit(0);
    });

    // Start the updater
    updater.start().catch(console.error);
}

export { DynamicLiveUpdater, UpdateConfig }; 