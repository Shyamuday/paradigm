import { createAutoTOTPAuth } from '../auth/easy-auth';
import { InstrumentsManager } from '../services/instruments-manager.service';
import { OrderManager } from '../services/order-manager.service';
import { WebSocketManager, TickData } from '../services/websocket-manager.service';
import { logger } from '../logger/logger';

/**
 * Complete Trading System Integration Example
 */
class CompleteTradingSystem {
    private auth: any;
    private instrumentsManager: InstrumentsManager;
    private orderManager: OrderManager;
    private webSocketManager: WebSocketManager;
    private isRunning: boolean = false;

    // Trading configuration
    private watchlist: number[] = [];
    private currentPrices: Map<number, number> = new Map();
    private orders: Map<string, any> = new Map();

    async initialize(): Promise<void> {
        try {
            console.log('🚀 Initializing Complete Trading System...\n');

            // 1. Authentication
            console.log('🔐 Step 1: Authenticating with Zerodha...');
            this.auth = await createAutoTOTPAuth();
            console.log('✅ Authentication successful\n');

            // 2. Initialize managers
            console.log('📊 Step 2: Initializing managers...');
            this.instrumentsManager = new InstrumentsManager(this.auth);
            this.orderManager = new OrderManager(this.auth, this.instrumentsManager);
            this.webSocketManager = new WebSocketManager(this.auth);
            console.log('✅ Managers initialized\n');

            // 3. Load instruments
            console.log('📋 Step 3: Loading instruments...');
            await this.instrumentsManager.getAllInstruments();
            console.log('✅ Instruments loaded\n');

            // 4. Setup WebSocket
            console.log('🔌 Step 4: Setting up real-time data...');
            await this.setupWebSocket();
            console.log('✅ Real-time data setup complete\n');

            // 5. Setup watchlist
            console.log('📝 Step 5: Setting up watchlist...');
            await this.setupWatchlist();
            console.log('✅ Watchlist setup complete\n');

            console.log('🎉 Complete Trading System initialized successfully!\n');

        } catch (error) {
            console.error('❌ Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup WebSocket for real-time data
     */
    private async setupWebSocket(): Promise<void> {
        // Setup event handlers
        this.webSocketManager.on('connected', () => {
            console.log('✅ WebSocket connected');
        });

        this.webSocketManager.on('ticks', (ticks: TickData[]) => {
            this.handleTickData(ticks);
        });

        this.webSocketManager.on('disconnected', (error) => {
            console.log('⚠️ WebSocket disconnected:', error);
        });

        this.webSocketManager.on('error', (error) => {
            console.log('❌ WebSocket error:', error);
        });

        // Connect
        await this.webSocketManager.connect();
    }

    /**
     * Setup trading watchlist
     */
    private async setupWatchlist(): Promise<void> {
        // Popular stocks for demonstration
        const symbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];

        for (const symbol of symbols) {
            const results = this.instrumentsManager.searchInstruments(symbol);
            const instrument = results.find(inst =>
                inst.exchange === 'NSE' &&
                inst.instrument_type === 'EQ'
            );

            if (instrument) {
                this.watchlist.push(instrument.instrument_token);
                console.log(`📝 Added to watchlist: ${symbol} (${instrument.instrument_token})`);
            }
        }

        // Subscribe to real-time data
        if (this.watchlist.length > 0) {
            this.webSocketManager.subscribe(this.watchlist, 'full');
            console.log(`📡 Subscribed to ${this.watchlist.length} instruments`);
        }
    }

    /**
     * Handle incoming tick data
     */
    private handleTickData(ticks: TickData[]): void {
        ticks.forEach(tick => {
            const previousPrice = this.currentPrices.get(tick.instrument_token);
            this.currentPrices.set(tick.instrument_token, tick.last_price);

            // Log price updates
            if (previousPrice && Math.abs(tick.last_price - previousPrice) > 0.1) {
                const change = tick.last_price - previousPrice;
                const changePercent = (change / previousPrice) * 100;
                console.log(`📈 Price Update: Token ${tick.instrument_token} = ₹${tick.last_price} (${change > 0 ? '+' : ''}${changePercent.toFixed(2)}%)`);
            }

            // Check for trading opportunities
            this.checkTradingSignals(tick);
        });
    }

    /**
     * Simple trading signal logic (example)
     */
    private checkTradingSignals(tick: TickData): void {
        // Simple example: Buy if price drops 2%, sell if it rises 2%
        const instrument = this.getInstrumentByToken(tick.instrument_token);
        if (!instrument) return;

        const changePercent = tick.change;

        // Example trading logic
        if (changePercent <= -2.0 && !this.hasOpenPosition(instrument.tradingsymbol)) {
            console.log(`🚀 BUY Signal: ${instrument.tradingsymbol} down ${Math.abs(changePercent).toFixed(2)}%`);
            // this.placeBuyOrder(instrument.tradingsymbol, 1); // Uncomment to trade
        } else if (changePercent >= 2.0 && this.hasOpenPosition(instrument.tradingsymbol)) {
            console.log(`💰 SELL Signal: ${instrument.tradingsymbol} up ${changePercent.toFixed(2)}%`);
            // this.placeSellOrder(instrument.tradingsymbol, 1); // Uncomment to trade
        }
    }

    /**
     * Place a buy order
     */
    async placeBuyOrder(tradingsymbol: string, quantity: number): Promise<void> {
        try {
            console.log(`📋 Placing BUY order: ${quantity} ${tradingsymbol}`);

            const result = await this.orderManager.marketOrder(
                tradingsymbol,
                'NSE',
                'BUY',
                quantity,
                'MIS' // Intraday
            );

            console.log(`✅ BUY order placed: ${result.order_id}`);
            this.orders.set(result.order_id, {
                symbol: tradingsymbol,
                type: 'BUY',
                quantity,
                timestamp: new Date()
            });

        } catch (error) {
            console.error(`❌ Failed to place BUY order for ${tradingsymbol}:`, error);
        }
    }

    /**
     * Place a sell order
     */
    async placeSellOrder(tradingsymbol: string, quantity: number): Promise<void> {
        try {
            console.log(`📋 Placing SELL order: ${quantity} ${tradingsymbol}`);

            const result = await this.orderManager.marketOrder(
                tradingsymbol,
                'NSE',
                'SELL',
                quantity,
                'MIS' // Intraday
            );

            console.log(`✅ SELL order placed: ${result.order_id}`);
            this.orders.set(result.order_id, {
                symbol: tradingsymbol,
                type: 'SELL',
                quantity,
                timestamp: new Date()
            });

        } catch (error) {
            console.error(`❌ Failed to place SELL order for ${tradingsymbol}:`, error);
        }
    }

    /**
     * Start trading system
     */
    async startTrading(): Promise<void> {
        console.log('🎯 Starting trading system...\n');
        this.isRunning = true;

        // Monitor orders every 30 seconds
        setInterval(async () => {
            if (this.isRunning) {
                await this.monitorOrders();
                await this.displayPortfolioSummary();
            }
        }, 30000);

        // Display current prices every 10 seconds
        setInterval(() => {
            if (this.isRunning) {
                this.displayCurrentPrices();
            }
        }, 10000);

        console.log('✅ Trading system started');
        console.log('📊 Monitoring prices and orders...\n');
    }

    /**
     * Stop trading system
     */
    stopTrading(): void {
        console.log('⏹️ Stopping trading system...');
        this.isRunning = false;
        this.webSocketManager.disconnect();
        console.log('✅ Trading system stopped');
    }

    /**
     * Monitor order status
     */
    private async monitorOrders(): Promise<void> {
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

        } catch (error) {
            console.error('❌ Failed to monitor orders:', error);
        }
    }

    /**
     * Display portfolio summary
     */
    private async displayPortfolioSummary(): Promise<void> {
        try {
            const summary = await this.orderManager.getPortfolioSummary();
            console.log(`💼 Portfolio: Value ₹${summary.totalValue.toFixed(2)} | P&L ₹${summary.totalPnL.toFixed(2)} | Positions ${summary.positionsCount}`);
        } catch (error) {
            // Portfolio might be empty, that's ok
        }
    }

    /**
     * Display current prices
     */
    private displayCurrentPrices(): void {
        if (this.currentPrices.size > 0) {
            console.log('📊 Current Prices:');
            this.currentPrices.forEach((price, token) => {
                const instrument = this.getInstrumentByToken(token);
                console.log(`   ${instrument?.tradingsymbol || token}: ₹${price}`);
            });
            console.log('');
        }
    }

    /**
     * Helper methods
     */
    private getInstrumentByToken(token: number): any {
        // This would normally query the instruments manager
        // For demo purposes, we'll return a mock
        const symbolMap: any = {
            738561: { tradingsymbol: 'RELIANCE' },
            2885633: { tradingsymbol: 'TCS' },
            // Add more mappings as needed
        };
        return symbolMap[token];
    }

    private hasOpenPosition(tradingsymbol: string): boolean {
        // Check if we have an open position for this symbol
        // This would normally query the order manager
        return false; // For demo purposes
    }

    /**
     * Demo mode - runs for specified duration
     */
    async runDemo(durationMinutes: number = 5): Promise<void> {
        await this.startTrading();

        console.log(`🎯 Running demo for ${durationMinutes} minutes...`);
        console.log('📝 Note: Trading signals are generated but orders are NOT placed');
        console.log('📝 Uncomment the order placement lines to enable actual trading\n');

        // Run for specified duration
        setTimeout(() => {
            this.stopTrading();
            console.log('🎉 Demo completed!');
        }, durationMinutes * 60 * 1000);
    }
}

/**
 * Main function to run the complete integration example
 */
async function runCompleteTradingIntegration(): Promise<void> {
    try {
        const tradingSystem = new CompleteTradingSystem();
        await tradingSystem.initialize();
        await tradingSystem.runDemo(5); // Run for 5 minutes

    } catch (error) {
        console.error('❌ Trading system failed:', error);
    }
}

// Run the complete integration
if (require.main === module) {
    runCompleteTradingIntegration().catch(console.error);
} 