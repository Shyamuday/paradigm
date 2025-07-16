import { ZerodhaAuth } from '../auth/zerodha-auth';
import { logger } from '../logger/logger';
import { EventEmitter } from 'events';
import { KiteConnect } from 'kiteconnect';

export interface TickData {
    instrument_token: number;
    mode: string;
    tradable: boolean;
    last_price: number;
    last_quantity: number;
    average_price: number;
    volume: number;
    buy_quantity: number;
    sell_quantity: number;
    ohlc: {
        open: number;
        high: number;
        low: number;
        close: number;
    };
    change: number;
    last_trade_time: Date;
    oi?: number;
    oi_day_high?: number;
    oi_day_low?: number;
}

export class WebSocketManager extends EventEmitter {
    private auth: ZerodhaAuth;
    private ws: any = null;
    private subscribedTokens: Set<number> = new Set();
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectInterval: number = 5000;

    constructor(auth: ZerodhaAuth) {
        super();
        this.auth = auth;
    }

    /**
     * Connect to Zerodha WebSocket
     */
    async connect(): Promise<void> {
        try {
            logger.info('🔌 Connecting to Zerodha WebSocket...');

            // Import KiteConnect WebSocket
            const KiteTicker = require('kiteconnect').KiteTicker;
            const kite = this.auth.getKite();

            if (!this.auth.checkSession()) {
                throw new Error('No active session found');
            }

            // Create ticker instance
            this.ws = new KiteTicker({
                api_key: kite.getApiKey(),
                access_token: kite.getAccessToken()
            });

            // Set up event handlers
            this.setupEventHandlers();

            // Connect
            this.ws.connect();

        } catch (error) {
            logger.error('❌ WebSocket connection failed:', error);
            throw error;
        }
    }

    /**
     * Setup WebSocket event handlers
     */
    private setupEventHandlers(): void {
        this.ws.on('ticks', (ticks: any[]) => {
            const processedTicks: TickData[] = ticks.map(tick => ({
                instrument_token: tick.instrument_token,
                mode: tick.mode,
                tradable: tick.tradable,
                last_price: tick.last_price,
                last_quantity: tick.last_quantity,
                average_price: tick.average_price,
                volume: tick.volume,
                buy_quantity: tick.buy_quantity,
                sell_quantity: tick.sell_quantity,
                ohlc: tick.ohlc,
                change: tick.change,
                last_trade_time: new Date(tick.last_trade_time),
                oi: tick.oi,
                oi_day_high: tick.oi_day_high,
                oi_day_low: tick.oi_day_low
            }));

            this.emit('ticks', processedTicks);
        });

        this.ws.on('connect', () => {
            logger.info('✅ WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');

            // Resubscribe to tokens if any
            if (this.subscribedTokens.size > 0) {
                this.resubscribe();
            }
        });

        this.ws.on('disconnect', (error: any) => {
            logger.warn('⚠️ WebSocket disconnected:', error);
            this.isConnected = false;
            this.emit('disconnected', error);
            this.handleReconnection();
        });

        this.ws.on('error', (error: any) => {
            logger.error('❌ WebSocket error:', error);
            this.emit('error', error);
        });

        this.ws.on('reconnect', (reconnect_count: number, reconnect_interval: number) => {
            logger.info(`🔄 WebSocket reconnecting... Attempt ${reconnect_count}`);
            this.emit('reconnecting', { count: reconnect_count, interval: reconnect_interval });
        });

        this.ws.on('noreconnect', () => {
            logger.error('❌ WebSocket max reconnection attempts reached');
            this.emit('noreconnect');
        });
    }

    /**
     * Subscribe to instrument tokens
     */
    subscribe(tokens: number[], mode: 'ltp' | 'quote' | 'full' = 'full'): void {
        if (!this.isConnected) {
            logger.warn('⚠️ WebSocket not connected, storing tokens for later subscription');
        }

        tokens.forEach(token => this.subscribedTokens.add(token));

        if (this.isConnected && this.ws) {
            logger.info(`📡 Subscribing to ${tokens.length} tokens in ${mode} mode`);
            this.ws.subscribe(tokens);
            this.ws.setMode(mode, tokens);
        }
    }

    /**
     * Unsubscribe from instrument tokens
     */
    unsubscribe(tokens: number[]): void {
        tokens.forEach(token => this.subscribedTokens.delete(token));

        if (this.isConnected && this.ws) {
            logger.info(`📡 Unsubscribing from ${tokens.length} tokens`);
            this.ws.unsubscribe(tokens);
        }
    }

    /**
     * Resubscribe to all tokens after reconnection
     */
    private resubscribe(): void {
        if (this.subscribedTokens.size > 0) {
            const tokens = Array.from(this.subscribedTokens);
            logger.info(`🔄 Resubscribing to ${tokens.length} tokens`);
            this.ws.subscribe(tokens);
            this.ws.setMode('full', tokens);
        }
    }

    /**
     * Handle reconnection logic
     */
    private handleReconnection(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            logger.info(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval}ms`);

            setTimeout(() => {
                this.connect().catch(error => {
                    logger.error('❌ Reconnection failed:', error);
                });
            }, this.reconnectInterval);
        } else {
            logger.error('❌ Max reconnection attempts reached');
            this.emit('max_reconnection_attempts');
        }
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect(): void {
        if (this.ws) {
            logger.info('🔌 Disconnecting WebSocket...');
            this.ws.disconnect();
            this.isConnected = false;
        }
    }

    /**
     * Get connection status
     */
    getConnectionStatus(): {
        connected: boolean;
        subscribedTokens: number[];
        reconnectAttempts: number;
    } {
        return {
            connected: this.isConnected,
            subscribedTokens: Array.from(this.subscribedTokens),
            reconnectAttempts: this.reconnectAttempts
        };
    }

    /**
     * Clear all subscriptions
     */
    clearSubscriptions(): void {
        if (this.isConnected && this.ws && this.subscribedTokens.size > 0) {
            const tokens = Array.from(this.subscribedTokens);
            this.ws.unsubscribe(tokens);
        }
        this.subscribedTokens.clear();
        logger.info('🧹 All subscriptions cleared');
    }
}