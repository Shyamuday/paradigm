"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketManager = void 0;
const logger_1 = require("../logger/logger");
const events_1 = require("events");
class WebSocketManager extends events_1.EventEmitter {
    constructor(auth) {
        super();
        this.ws = null;
        this.subscribedTokens = new Set();
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000;
        this.auth = auth;
    }
    async connect() {
        try {
            logger_1.logger.info('🔌 Connecting to Zerodha WebSocket...');
            const KiteTicker = require('kiteconnect').KiteTicker;
            const session = this.auth.getSession();
            if (!session) {
                throw new Error('No active session found');
            }
            this.ws = new KiteTicker({
                api_key: process.env.ZERODHA_API_KEY,
                access_token: session.accessToken
            });
            this.setupEventHandlers();
            this.ws.connect();
        }
        catch (error) {
            logger_1.logger.error('❌ WebSocket connection failed:', error);
            throw error;
        }
    }
    setupEventHandlers() {
        this.ws.on('ticks', (ticks) => {
            const processedTicks = ticks.map(tick => ({
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
            logger_1.logger.info('✅ WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
            if (this.subscribedTokens.size > 0) {
                this.resubscribe();
            }
        });
        this.ws.on('disconnect', (error) => {
            logger_1.logger.warn('⚠️ WebSocket disconnected:', error);
            this.isConnected = false;
            this.emit('disconnected', error);
            this.handleReconnection();
        });
        this.ws.on('error', (error) => {
            logger_1.logger.error('❌ WebSocket error:', error);
            this.emit('error', error);
        });
        this.ws.on('reconnect', (reconnect_count, reconnect_interval) => {
            logger_1.logger.info(`🔄 WebSocket reconnecting... Attempt ${reconnect_count}`);
            this.emit('reconnecting', { count: reconnect_count, interval: reconnect_interval });
        });
        this.ws.on('noreconnect', () => {
            logger_1.logger.error('❌ WebSocket max reconnection attempts reached');
            this.emit('noreconnect');
        });
    }
    subscribe(tokens, mode = 'full') {
        if (!this.isConnected) {
            logger_1.logger.warn('⚠️ WebSocket not connected, storing tokens for later subscription');
        }
        tokens.forEach(token => this.subscribedTokens.add(token));
        if (this.isConnected && this.ws) {
            logger_1.logger.info(`📡 Subscribing to ${tokens.length} tokens in ${mode} mode`);
            this.ws.subscribe(tokens);
            this.ws.setMode(mode, tokens);
        }
    }
    unsubscribe(tokens) {
        tokens.forEach(token => this.subscribedTokens.delete(token));
        if (this.isConnected && this.ws) {
            logger_1.logger.info(`📡 Unsubscribing from ${tokens.length} tokens`);
            this.ws.unsubscribe(tokens);
        }
    }
    resubscribe() {
        if (this.subscribedTokens.size > 0) {
            const tokens = Array.from(this.subscribedTokens);
            logger_1.logger.info(`🔄 Resubscribing to ${tokens.length} tokens`);
            this.ws.subscribe(tokens);
            this.ws.setMode('full', tokens);
        }
    }
    handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            logger_1.logger.info(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectInterval}ms`);
            setTimeout(() => {
                this.connect().catch(error => {
                    logger_1.logger.error('❌ Reconnection failed:', error);
                });
            }, this.reconnectInterval);
        }
        else {
            logger_1.logger.error('❌ Max reconnection attempts reached');
            this.emit('max_reconnection_attempts');
        }
    }
    disconnect() {
        if (this.ws) {
            logger_1.logger.info('🔌 Disconnecting WebSocket...');
            this.ws.disconnect();
            this.isConnected = false;
        }
    }
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            subscribedTokens: Array.from(this.subscribedTokens),
            reconnectAttempts: this.reconnectAttempts
        };
    }
    clearSubscriptions() {
        if (this.isConnected && this.ws && this.subscribedTokens.size > 0) {
            const tokens = Array.from(this.subscribedTokens);
            this.ws.unsubscribe(tokens);
        }
        this.subscribedTokens.clear();
        logger_1.logger.info('🧹 All subscriptions cleared');
    }
}
exports.WebSocketManager = WebSocketManager;
//# sourceMappingURL=websocket-manager.service.js.map