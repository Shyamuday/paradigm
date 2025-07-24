import { KiteConnect } from 'kiteconnect';
import { EventEmitter } from 'events';
import { logger } from '../logger/logger';

export type TickData = {
    instrumentToken: number;
    lastPrice: number;
    volume: number;
    buyQuantity: number;
    sellQuantity: number;
    lastTradeTime: Date;
    averageTradePrice: number;
    openPrice: number;
    highPrice: number;
    lowPrice: number;
    closePrice: number;
    change: number;
};

export class WebSocketManager extends EventEmitter {
    private ws: any; // KiteTicker instance
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 5000; // 5 seconds
    private subscribedTokens: Set<number> = new Set();
    private isConnected: boolean = false;

    constructor(private kite: KiteConnect) {
        super();
        this.setupWebSocket();
    }

    private setupWebSocket(): void {
        try {
            // Import KiteConnect WebSocket
            const KiteTicker = require('kiteconnect').KiteTicker;

            // Get API key and access token from KiteConnect instance
            const apiKey = (this.kite as any).options.api_key;
            const accessToken = (this.kite as any).access_token;

            if (!apiKey || !accessToken) {
                throw new Error('Missing API key or access token');
            }

            // Initialize WebSocket connection
            this.ws = new KiteTicker({
                api_key: apiKey,
                access_token: accessToken
            });

            // Setup event handlers
            this.setupEventHandlers();
        } catch (error) {
            logger.error('Failed to setup WebSocket:', error);
            throw error;
        }
    }

    private setupEventHandlers(): void {
        this.ws.on('connect', () => {
            logger.info('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;

            // Resubscribe to tokens if any
            if (this.subscribedTokens.size > 0) {
                this.subscribe(Array.from(this.subscribedTokens));
            }

            this.emit('connected');
        });

        this.ws.on('ticks', (ticks: any[]) => {
            ticks.forEach(tick => {
                const formattedTick: TickData = {
                    instrumentToken: tick.instrument_token,
                    lastPrice: tick.last_price,
                    volume: tick.volume,
                    buyQuantity: tick.buy_quantity,
                    sellQuantity: tick.sell_quantity,
                    lastTradeTime: new Date(tick.last_trade_time),
                    averageTradePrice: tick.average_trade_price,
                    openPrice: tick.ohlc.open,
                    highPrice: tick.ohlc.high,
                    lowPrice: tick.ohlc.low,
                    closePrice: tick.ohlc.close,
                    change: tick.change
                };

                this.emit('tick', formattedTick);
            });
        });

        this.ws.on('error', (error: Error) => {
            logger.error('WebSocket error:', error);
            this.emit('error', error);
        });

        this.ws.on('close', () => {
            logger.warn('WebSocket connection closed');
            this.isConnected = false;
            this.handleReconnect();
            this.emit('disconnected');
        });

        this.ws.on('noreconnect', () => {
            logger.error('WebSocket reconnection failed');
            this.emit('reconnect_failed');
        });

        this.ws.on('order_update', (order: any) => {
            logger.info('Order update received:', order);
            this.emit('order_update', order);
        });
    }

    private handleReconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            setTimeout(() => {
                try {
                    this.connect();
                } catch (error) {
                    logger.error('Reconnection attempt failed:', error);
                }
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            logger.error('Max reconnection attempts reached');
            this.emit('max_reconnects_reached');
        }
    }

    public connect(): void {
        try {
            this.ws.connect();
            this.ws.enableReconnect();
        } catch (error) {
            logger.error('Failed to connect WebSocket:', error);
            throw error;
        }
    }

    public disconnect(): void {
        try {
            this.ws.disconnect();
            this.isConnected = false;
            this.subscribedTokens.clear();
        } catch (error) {
            logger.error('Failed to disconnect WebSocket:', error);
            throw error;
        }
    }

    public subscribe(tokens: number[]): void {
        try {
            if (!this.isConnected) {
                throw new Error('WebSocket is not connected');
            }

            // Add tokens to tracking set
            tokens.forEach(token => this.subscribedTokens.add(token));

            // Subscribe to tokens
            this.ws.subscribe(tokens);
            this.ws.setMode('full', tokens); // Set mode to full for OHLC data

            logger.info(`Subscribed to tokens: ${tokens.join(', ')}`);
        } catch (error) {
            logger.error('Failed to subscribe to tokens:', error);
            throw error;
        }
    }

    public unsubscribe(tokens: number[]): void {
        try {
            if (!this.isConnected) {
                throw new Error('WebSocket is not connected');
            }

            // Remove tokens from tracking set
            tokens.forEach(token => this.subscribedTokens.delete(token));

            // Unsubscribe from tokens
            this.ws.unsubscribe(tokens);

            logger.info(`Unsubscribed from tokens: ${tokens.join(', ')}`);
        } catch (error) {
            logger.error('Failed to unsubscribe from tokens:', error);
            throw error;
        }
    }

    public isWebSocketConnected(): boolean {
        return this.isConnected;
    }

    public getSubscribedTokens(): number[] {
        return Array.from(this.subscribedTokens);
    }
}