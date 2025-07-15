"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const easy_auth_1 = require("../auth/easy-auth");
const instruments_manager_service_1 = require("../services/instruments-manager.service");
const order_manager_service_1 = require("../services/order-manager.service");
const websocket_manager_service_1 = require("../services/websocket-manager.service");
class CompleteTradingSystem {
    constructor() {
        this.isRunning = false;
        this.watchlist = [];
        this.currentPrices = new Map();
        this.orders = new Map();
    }
    async initialize() {
        try {
            console.log('🚀 Initializing Complete Trading System...\n');
            console.log('🔐 Step 1: Authenticating with Zerodha...');
            this.auth = await (0, easy_auth_1.createAutoTOTPAuth)();
            console.log('✅ Authentication successful\n');
            console.log('📊 Step 2: Initializing managers...');
            this.instrumentsManager = new instruments_manager_service_1.InstrumentsManager(this.auth);
            this.orderManager = new order_manager_service_1.OrderManager(this.auth, this.instrumentsManager);
            this.webSocketManager = new websocket_manager_service_1.WebSocketManager(this.auth);
            console.log('✅ Managers initialized\n');
            console.log('📋 Step 3: Loading instruments...');
            await this.instrumentsManager.getAllInstruments();
            console.log('✅ Instruments loaded\n');
            console.log('🔌 Step 4: Setting up real-time data...');
            await this.setupWebSocket();
            console.log('✅ Real-time data setup complete\n');
            console.log('📝 Step 5: Setting up watchlist...');
            await this.setupWatchlist();
            console.log('✅ Watchlist setup complete\n');
            console.log('🎉 Complete Trading System initialized successfully!\n');
        }
        catch (error) {
            console.error('❌ Initialization failed:', error);
            throw error;
        }
    }
    async setupWebSocket() {
        this.webSocketManager.on('connected', () => {
            console.log('✅ WebSocket connected');
        });
        this.webSocketManager.on('ticks', (ticks) => {
            this.handleTickData(ticks);
        });
        this.webSocketManager.on('disconnected', (error) => {
            console.log('⚠️ WebSocket disconnected:', error);
        });
        this.webSocketManager.on('error', (error) => {
            console.log('❌ WebSocket error:', error);
        });
        await this.webSocketManager.connect();
    }
    async setupWatchlist() {
        const symbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];
        for (const symbol of symbols) {
            const results = this.instrumentsManager.searchInstruments(symbol);
            const instrument = results.find(inst => inst.exchange === 'NSE' &&
                inst.instrument_type === 'EQ');
            if (instrument) {
                this.watchlist.push(instrument.instrument_token);
                console.log(`📝 Added to watchlist: ${symbol} (${instrument.instrument_token})`);
            }
        }
        if (this.watchlist.length > 0) {
            this.webSocketManager.subscribe(this.watchlist, 'full');
            console.log(`📡 Subscribed to ${this.watchlist.length} instruments`);
        }
    }
    handleTickData(ticks) {
        ticks.forEach(tick => {
            const previousPrice = this.currentPrices.get(tick.instrument_token);
            this.currentPrices.set(tick.instrument_token, tick.last_price);
            if (previousPrice && Math.abs(tick.last_price - previousPrice) > 0.1) {
                const change = tick.last_price - previousPrice;
                const changePercent = (change / previousPrice) * 100;
                console.log(`📈 Price Update: Token ${tick.instrument_token} = ₹${tick.last_price} (${change > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);
            }
            this.checkTradingSignals(tick);
        });
    }
    checkTradingSignals(tick) {
        const instrument = this.getInstrumentByToken(tick.instrument_token);
        if (!instrument)
            return;
        const changePercent = tick.change;
        if (changePercent <= -2.0 && !this.hasOpenPosition(instrument.tradingsymbol)) {
            console.log(`🚀 BUY Signal: ${instrument.tradingsymbol} down ${Math.abs(changePercent).toFixed(2)}%`);
        }
        else if (changePercent >= 2.0 && this.hasOpenPosition(instrument.tradingsymbol)) {
            console.log(`💰 SELL Signal: ${instrument.tradingsymbol} up ${changePercent.toFixed(2)}%`);
        }
    }
    async placeBuyOrder(tradingsymbol, quantity) {
        try {
            console.log(`📋 Placing BUY order: ${quantity} ${tradingsymbol}`);
            const result = await this.orderManager.marketOrder(tradingsymbol, 'NSE', 'BUY', quantity, 'MIS');
            console.log(`✅ BUY order placed: ${result.order_id}`);
            this.orders.set(result.order_id, {
                symbol: tradingsymbol,
                type: 'BUY',
                quantity,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error(`❌ Failed to place BUY order for ${tradingsymbol}:`, error);
        }
    }
    async placeSellOrder(tradingsymbol, quantity) {
        try {
            console.log(`📋 Placing SELL order: ${quantity} ${tradingsymbol}`);
            const result = await this.orderManager.marketOrder(tradingsymbol, 'NSE', 'SELL', quantity, 'MIS');
            console.log(`✅ SELL order placed: ${result.order_id}`);
            this.orders.set(result.order_id, {
                symbol: tradingsymbol,
                type: 'SELL',
                quantity,
                timestamp: new Date()
            });
        }
        catch (error) {
            console.error(`❌ Failed to place SELL order for ${tradingsymbol}:`, error);
        }
    }
    async startTrading() {
        console.log('🎯 Starting trading system...\n');
        this.isRunning = true;
        setInterval(async () => {
            if (this.isRunning) {
                await this.monitorOrders();
                await this.displayPortfolioSummary();
            }
        }, 30000);
        setInterval(() => {
            if (this.isRunning) {
                this.displayCurrentPrices();
            }
        }, 10000);
        console.log('✅ Trading system started');
        console.log('📊 Monitoring prices and orders...\n');
    }
    stopTrading() {
        console.log('⏹️ Stopping trading system...');
        this.isRunning = false;
        this.webSocketManager.disconnect();
        console.log('✅ Trading system stopped');
    }
    async monitorOrders() {
        try {
            const orders = await this.orderManager.getAllOrders();
            const todayOrders = orders.filter(order => {
                const orderDate = new Date(order.order_timestamp);
                const today = new Date();
                return orderDate.toDateString() === today.toDateString();
            });
            if (todayOrders.length > 0) {
                console.log(`📋 Today's Orders: ${todayOrders.length}`);
                todayOrders.slice(-5).forEach(order => {
                    console.log(`   ${order.tradingsymbol} ${order.transaction_type} ${order.quantity} - ${order.status}`);
                });
            }
        }
        catch (error) {
            console.error('❌ Failed to monitor orders:', error);
        }
    }
    async displayPortfolioSummary() {
        try {
            const summary = await this.orderManager.getPortfolioSummary();
            console.log(`💼 Portfolio: Value ₹${summary.totalValue.toFixed(2)} | P&L ₹${summary.totalPnL.toFixed(2)} | Positions ${summary.positionsCount}`);
        }
        catch (error) {
        }
    }
    displayCurrentPrices() {
        if (this.currentPrices.size > 0) {
            console.log('📊 Current Prices:');
            this.currentPrices.forEach((price, token) => {
                const instrument = this.getInstrumentByToken(token);
                console.log(`   ${instrument?.tradingsymbol || token}: ₹${price}`);
            });
            console.log('');
        }
    }
    getInstrumentByToken(token) {
        const symbolMap = {
            738561: { tradingsymbol: 'RELIANCE' },
            2885633: { tradingsymbol: 'TCS' },
        };
        return symbolMap[token];
    }
    hasOpenPosition(tradingsymbol) {
        return false;
    }
    async runDemo(durationMinutes = 5) {
        await this.startTrading();
        console.log(`🎯 Running demo for ${durationMinutes} minutes...`);
        console.log('📝 Note: Trading signals are generated but orders are NOT placed');
        console.log('📝 Uncomment the order placement lines to enable actual trading\n');
        setTimeout(() => {
            this.stopTrading();
            console.log('🎉 Demo completed!');
        }, durationMinutes * 60 * 1000);
    }
}
async function runCompleteTradingIntegration() {
    try {
        const tradingSystem = new CompleteTradingSystem();
        await tradingSystem.initialize();
        await tradingSystem.runDemo(5);
    }
    catch (error) {
        console.error('❌ Trading system failed:', error);
    }
}
if (require.main === module) {
    runCompleteTradingIntegration().catch(console.error);
}
//# sourceMappingURL=complete-trading-integration.js.map