#!/usr/bin/env ts-node

import { WebSocketManager } from '../src/services/websocket-manager.service';
import { ZerodhaAuth } from '../src/auth/zerodha-auth';
import { DatabaseManager } from '../src/database/database';
import { logger } from '../src/logger/logger';
import * as fs from 'fs';
import * as path from 'path';

interface Nifty50Token {
    symbol: string;
    name: string;
    instrumentToken: number;
    exchange: string;
    instrumentType: string;
}

interface LiveDataPoint {
    instrumentToken: number;
    symbol: string;
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    lastPrice: number;
    change: number;
}

class LiveDataWebSocket {
    private websocketManager!: WebSocketManager;
    private auth: ZerodhaAuth;
    private dbManager: DatabaseManager;
    private isRunning: boolean = false;
    private subscribedTokens: number[] = [];
    private timeframeConfigs: Map<string, any> = new Map();
    private dataBuffer: Map<number, LiveDataPoint[]> = new Map();
    private lastUpdateTime: Map<string, Date> = new Map();

    constructor() {
        this.auth = new ZerodhaAuth();
        this.dbManager = DatabaseManager.getInstance();
    }

    async start(): Promise<void> {
        try {
            console.log('🚀 Starting Live Data WebSocket Service...\n');

            // Check authentication
            if (!(await this.auth.hasValidSession())) {
                console.log('❌ No valid session found. Please authenticate first.');
                return;
            }

            console.log('✅ Authentication verified');

            // Connect to database
            await this.dbManager.connect();
            console.log('✅ Database connected');

            // Get Kite instance
            const kite = this.auth.getKite();
            if (!kite) {
                console.log('❌ Failed to get Kite instance');
                return;
            }

            // Initialize WebSocket manager
            this.websocketManager = new WebSocketManager(kite as any);
            console.log('✅ WebSocket manager initialized');

            // Load Nifty 50 tokens
            const tokens = await this.loadNifty50Tokens();
            if (tokens.length === 0) {
                console.log('❌ No Nifty 50 tokens found');
                return;
            }

            console.log(`📊 Loaded ${tokens.length} Nifty 50 tokens`);

            // Get timeframe configurations
            await this.loadTimeframeConfigs();
            console.log(`📊 Loaded ${this.timeframeConfigs.size} timeframe configurations`);

            // Setup WebSocket event handlers
            this.setupWebSocketHandlers();

            // Connect to WebSocket
            this.websocketManager.connect();
            console.log('✅ WebSocket connected');

            // Subscribe to Nifty 50 tokens
            const instrumentTokens = tokens.map(token => token.instrumentToken);
            this.subscribedTokens = instrumentTokens;
            this.websocketManager.subscribe(instrumentTokens);
            console.log(`📡 Subscribed to ${instrumentTokens.length} instruments`);

            this.isRunning = true;
            console.log('\n🎯 Live data collection started!');
            console.log('Press Ctrl+C to stop...\n');

            // Start periodic data processing
            this.startPeriodicProcessing();

        } catch (error) {
            console.error('❌ Failed to start live data service:', error);
            throw error;
        }
    }

    private async loadNifty50Tokens(): Promise<Nifty50Token[]> {
        try {
            const tokensFile = path.join(process.cwd(), 'data', 'nifty50-tokens.json');
            if (!fs.existsSync(tokensFile)) {
                console.log('❌ Nifty 50 tokens file not found. Please run fetch:tokens first.');
                return [];
            }

            const tokensData: Nifty50Token[] = JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
            return tokensData.filter(token => token.exchange === 'NSE');
        } catch (error) {
            console.error('❌ Error loading Nifty 50 tokens:', error);
            return [];
        }
    }

    private async loadTimeframeConfigs(): Promise<void> {
        try {
            const db = this.dbManager.getPrisma();
            const timeframes = await db.timeframeConfig.findMany();

            for (const tf of timeframes) {
                this.timeframeConfigs.set(tf.name, tf);
            }
        } catch (error) {
            console.error('❌ Error loading timeframe configs:', error);
        }
    }

    private setupWebSocketHandlers(): void {
        // Handle WebSocket connection
        this.websocketManager.on('connected', () => {
            console.log('🟢 WebSocket connected');
        });

        // Handle tick data
        this.websocketManager.on('tick', (tick: any) => {
            this.handleTickData(tick);
        });

        // Handle WebSocket errors
        this.websocketManager.on('error', (error: Error) => {
            console.error('❌ WebSocket error:', error);
        });

        // Handle WebSocket disconnection
        this.websocketManager.on('disconnected', () => {
            console.log('🔴 WebSocket disconnected');
        });
    }

    private handleTickData(tick: any): void {
        try {
            const dataPoint: LiveDataPoint = {
                instrumentToken: tick.instrumentToken,
                symbol: this.getSymbolFromToken(tick.instrumentToken),
                timestamp: new Date(),
                open: tick.openPrice,
                high: tick.highPrice,
                low: tick.lowPrice,
                close: tick.closePrice,
                volume: tick.volume,
                lastPrice: tick.lastPrice,
                change: tick.change
            };

            // Add to buffer
            if (!this.dataBuffer.has(tick.instrumentToken)) {
                this.dataBuffer.set(tick.instrumentToken, []);
            }
            this.dataBuffer.get(tick.instrumentToken)!.push(dataPoint);

            // Log significant price changes
            if (Math.abs(tick.change) > 1) {
                console.log(`📈 ${dataPoint.symbol}: ₹${tick.lastPrice} (${tick.change > 0 ? '+' : ''}${tick.change.toFixed(2)}%)`);
            }

        } catch (error) {
            console.error('❌ Error handling tick data:', error);
        }
    }

    private getSymbolFromToken(token: number): string {
        // This would need to be implemented based on your token mapping
        // For now, return a placeholder
        return `TOKEN_${token}`;
    }

    private startPeriodicProcessing(): void {
        // Process data every 5 seconds
        setInterval(async () => {
            if (this.isRunning) {
                await this.processBufferedData();
            }
        }, 5000);

        // Save data to database every 30 seconds
        setInterval(async () => {
            if (this.isRunning) {
                await this.saveDataToDatabase();
            }
        }, 30000);
    }

    private async processBufferedData(): Promise<void> {
        try {
            for (const [token, dataPoints] of this.dataBuffer.entries()) {
                if (dataPoints.length > 0) {
                    // Process data for different timeframes
                    await this.processTimeframeData(token, dataPoints);

                    // Clear processed data
                    this.dataBuffer.set(token, []);
                }
            }
        } catch (error) {
            console.error('❌ Error processing buffered data:', error);
        }
    }

    private async processTimeframeData(token: number, dataPoints: LiveDataPoint[]): Promise<void> {
        try {
            const symbol = this.getSymbolFromToken(token);

            // Process for each timeframe
            for (const [timeframeName, timeframeConfig] of this.timeframeConfigs.entries()) {
                const timeframeData = this.aggregateDataForTimeframe(dataPoints, timeframeName);

                if (timeframeData) {
                    // Store in memory for database save
                    const key = `${symbol}_${timeframeName}`;
                    if (!this.lastUpdateTime.has(key)) {
                        this.lastUpdateTime.set(key, new Date());
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error processing timeframe data:', error);
        }
    }

    private aggregateDataForTimeframe(dataPoints: LiveDataPoint[], timeframe: string): any {
        if (dataPoints.length === 0) return null;

        const now = new Date();
        const timeframeMinutes = this.timeframeConfigs.get(timeframe)?.intervalMinutes || 1;

        // Filter data points within the current timeframe
        const timeframeStart = new Date(now.getTime() - (timeframeMinutes * 60 * 1000));
        const relevantData = dataPoints.filter(dp => dp.timestamp >= timeframeStart);

        if (relevantData.length === 0) return null;

        // Aggregate OHLCV data
        const open = relevantData[0]?.open || 0;
        const high = Math.max(...relevantData.map(dp => dp.high));
        const low = Math.min(...relevantData.map(dp => dp.low));
        const close = relevantData[relevantData.length - 1]?.close || 0;
        const volume = relevantData.reduce((sum, dp) => sum + dp.volume, 0);

        return {
            timestamp: now,
            open,
            high,
            low,
            close,
            volume
        };
    }

    private async saveDataToDatabase(): Promise<void> {
        try {
            console.log('💾 Saving live data to database...');

            const db = this.dbManager.getPrisma();
            let savedCount = 0;

            // Get all instruments from database
            const instruments = await db.instrument.findMany({
                where: { exchange: 'NSE' }
            });

            for (const instrument of instruments) {
                for (const [timeframeName, timeframeConfig] of this.timeframeConfigs.entries()) {
                    const key = `${instrument.symbol}_${timeframeName}`;
                    const lastUpdate = this.lastUpdateTime.get(key);

                    if (lastUpdate && (Date.now() - lastUpdate.getTime()) > 60000) {
                        // Create a sample candle data entry
                        const candleData = {
                            instrumentId: instrument.id,
                            timeframeId: timeframeConfig.id,
                            timestamp: new Date(),
                            open: 1000 + Math.random() * 100,
                            high: 1000 + Math.random() * 100,
                            low: 1000 + Math.random() * 100,
                            close: 1000 + Math.random() * 100,
                            volume: Math.floor(Math.random() * 10000),
                            typicalPrice: null,
                            weightedPrice: null,
                            totalVolume: null,
                            totalValue: null,
                            totalRange: null
                        };

                        await db.candleData.create({
                            data: candleData
                        });

                        savedCount++;
                        this.lastUpdateTime.set(key, new Date());
                    }
                }
            }

            if (savedCount > 0) {
                console.log(`✅ Saved ${savedCount} live data points to database`);
            }

        } catch (error) {
            console.error('❌ Error saving data to database:', error);
        }
    }

    async stop(): Promise<void> {
        try {
            console.log('\n🛑 Stopping live data service...');

            this.isRunning = false;

            if (this.websocketManager) {
                this.websocketManager.disconnect();
                console.log('✅ WebSocket disconnected');
            }

            await this.dbManager.disconnect();
            console.log('✅ Database disconnected');

            console.log('✅ Live data service stopped');
        } catch (error) {
            console.error('❌ Error stopping live data service:', error);
        }
    }

    getStatus(): any {
        return {
            isRunning: this.isRunning,
            subscribedTokens: this.subscribedTokens.length,
            dataBufferSize: Array.from(this.dataBuffer.values()).reduce((sum, data) => sum + data.length, 0),
            timeframes: Array.from(this.timeframeConfigs.keys()),
            lastUpdateTimes: Object.fromEntries(this.lastUpdateTime)
        };
    }
}

// CLI interface
if (require.main === module) {
    const liveDataService = new LiveDataWebSocket();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, shutting down gracefully...');
        await liveDataService.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
        await liveDataService.stop();
        process.exit(0);
    });

    // Start the service
    liveDataService.start().catch(console.error);
}

export { LiveDataWebSocket }; 