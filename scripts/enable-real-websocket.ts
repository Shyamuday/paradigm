#!/usr/bin/env ts-node

import { db } from '../src/database/database';
import { logger } from '../src/logger/logger';
import { ZerodhaAuth } from '../src/auth/zerodha-auth';
import { InstrumentsManager } from '../src/services/instruments-manager.service';
import { LiveDataIntegrationService } from '../src/services/live-data-integration.service';
import { WebSocketManager } from '../src/services/websocket-manager.service';
import { KiteConnect } from 'kiteconnect';

class RealWebsocketEnabler {
    private auth: ZerodhaAuth;
    private instrumentsManager: InstrumentsManager;
    private liveDataService: LiveDataIntegrationService;
    private wsManager: WebSocketManager;
    private symbols = [
        'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
        'BHARTIARTL', 'KOTAKBANK', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'SUNPHARMA'
    ];

    constructor() {
        this.auth = new ZerodhaAuth();
        this.instrumentsManager = new InstrumentsManager(this.auth);
        this.liveDataService = new LiveDataIntegrationService(this.instrumentsManager, this.auth.getKite());
        this.wsManager = new WebSocketManager(this.auth.getKite());
    }

    async enableRealWebsocket(): Promise<void> {
        console.log('🚀 Enabling Real Websocket Data...\n');

        try {
            // 1. Check authentication
            await this.checkAuthentication();

            // 2. Setup websocket connection
            await this.setupWebsocket();

            // 3. Subscribe to symbols
            await this.subscribeToSymbols();

            // 4. Start live monitoring
            await this.startLiveMonitoring();

            console.log('✅ Real websocket data enabled successfully!');
            console.log('📊 Now receiving live data from Zerodha...');

        } catch (error) {
            console.error('❌ Failed to enable real websocket:', error);
            throw error;
        }
    }

    private async checkAuthentication(): Promise<void> {
        console.log('🔐 Checking authentication...');

        try {
            const hasValidSession = await this.auth.hasValidSession();
            if (!hasValidSession) {
                console.log('⚠️  Not authenticated. Please run authentication first.');
                console.log('   Run: npx ts-node scripts/authenticate.ts');
                throw new Error('Authentication required');
            }

            console.log('✅ Authentication verified');
        } catch (error) {
            console.error('❌ Authentication check failed:', error);
            throw error;
        }
    }

    private async setupWebsocket(): Promise<void> {
        console.log('🔌 Setting up websocket connection...');

        return new Promise((resolve, reject) => {
            // Setup event handlers
            this.wsManager.on('connected', () => {
                console.log('✅ Websocket connected to Zerodha');
                resolve();
            });

            this.wsManager.on('error', (error) => {
                console.error('❌ Websocket error:', error);
                reject(error);
            });

            this.wsManager.on('disconnected', () => {
                console.log('⚠️  Websocket disconnected');
            });

            this.wsManager.on('ticks', (ticks) => {
                console.log(`📊 Received ${ticks.length} ticks from Zerodha`);
                // Process real tick data
                ticks.forEach(tick => {
                    this.liveDataService.processLiveTickData(tick);
                });
            });

            // Connect to websocket
            this.wsManager.connect();
        });
    }

    private async subscribeToSymbols(): Promise<void> {
        console.log('📡 Subscribing to symbols...');

        try {
            const tokens: number[] = [];

            for (const symbol of this.symbols) {
                try {
                    // Get instrument token from Zerodha
                    const instrument = await this.instrumentsManager.getInstrumentBySymbol(symbol);
                    if (instrument && instrument.instrument_token) {
                        tokens.push(instrument.instrument_token);
                        console.log(`   ✅ ${symbol}: ${instrument.instrument_token}`);
                    } else {
                        console.log(`   ⚠️  ${symbol}: Token not found`);
                    }
                } catch (error) {
                    console.log(`   ❌ ${symbol}: Error getting token`);
                }
            }

            if (tokens.length > 0) {
                await this.wsManager.subscribe(tokens);
                console.log(`✅ Subscribed to ${tokens.length} instruments`);
            } else {
                console.log('⚠️  No valid tokens found for subscription');
            }

        } catch (error) {
            console.error('❌ Failed to subscribe to symbols:', error);
            throw error;
        }
    }

    private async startLiveMonitoring(): Promise<void> {
        console.log('📊 Starting live monitoring...');

        try {
            await this.liveDataService.startLiveMonitoring(this.symbols);
            console.log('✅ Live monitoring started');

            // Monitor data quality
            setInterval(async () => {
                for (const symbol of this.symbols.slice(0, 3)) { // Check first 3 symbols
                    try {
                        const quality = await this.liveDataService.monitorDataQuality(symbol);
                        console.log(`📈 ${symbol} data quality:`, {
                            lastUpdate: quality.lastUpdate,
                            latency: quality.latency,
                            dataGaps: quality.dataGaps.length
                        });
                    } catch (error) {
                        // Continue monitoring other symbols
                    }
                }
            }, 30000); // Check every 30 seconds

        } catch (error) {
            console.error('❌ Failed to start live monitoring:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        console.log('🛑 Stopping real websocket...');

        try {
            await this.liveDataService.stopLiveMonitoring();
            this.wsManager.disconnect();
            console.log('✅ Real websocket stopped');
        } catch (error) {
            console.error('❌ Error stopping websocket:', error);
        }
    }
}

// Main execution
async function main() {
    const enabler = new RealWebsocketEnabler();

    try {
        await enabler.enableRealWebsocket();

        // Keep running
        console.log('\n🔄 Real websocket is running. Press Ctrl+C to stop...');

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down...');
            await enabler.stop();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Failed to enable real websocket:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
} 