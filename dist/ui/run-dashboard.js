"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardManager = void 0;
const terminal_dashboard_1 = require("./terminal-dashboard");
const market_data_service_1 = require("../services/market-data.service");
const order_service_1 = require("../services/order.service");
const strategy_service_1 = require("../services/strategy.service");
const auth_manager_service_1 = require("../services/auth-manager.service");
const logger_1 = require("../logger/logger");
class DashboardManager {
    constructor() {
        this.updateInterval = null;
        this.dashboard = new terminal_dashboard_1.TerminalDashboard();
        this.marketDataService = new market_data_service_1.MarketDataService();
        this.orderService = new order_service_1.OrderService();
        this.strategyService = new strategy_service_1.StrategyService();
        this.authManager = auth_manager_service_1.AuthManagerService.getInstance();
        this.setupEventListeners();
    }
    setupEventListeners() {
        this.dashboard.on('exit', () => {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            process.exit(0);
        });
        this.dashboard.on('refresh', () => {
            this.refreshData();
        });
        this.dashboard.on('totp_input', async (totp) => {
            try {
                await this.refreshData();
            }
            catch (error) {
                logger_1.logger.error('Failed to handle TOTP:', error);
            }
        });
        this.updateInterval = setInterval(() => {
            this.refreshData();
        }, 5000);
    }
    async refreshData() {
        try {
            const authStatus = this.authManager.getStatus();
            if (authStatus.isAuthenticated) {
                const instruments = await this.marketDataService.getAllInstruments();
                const marketData = [];
                for (const instrument of instruments.slice(0, 10)) {
                    try {
                        const rawMarketData = await this.marketDataService.getLatestMarketData(instrument.symbol);
                        const mappedData = rawMarketData.map(data => ({
                            id: data.id,
                            instrumentId: data.instrumentId,
                            instrument: {
                                ...data.instrument,
                                lotSize: data.instrument.lotSize || 0,
                                tickSize: data.instrument.tickSize || 0
                            },
                            symbol: data.instrument.symbol,
                            timestamp: data.timestamp,
                            open: data.open || null,
                            high: data.high || null,
                            low: data.low || null,
                            close: data.close || null,
                            volume: data.volume || null,
                            ltp: data.ltp || null,
                            change: data.change || null,
                            changePercent: data.changePercent || null
                        }));
                        marketData.push(...mappedData);
                    }
                    catch (error) {
                        logger_1.logger.warn(`Failed to fetch market data for ${instrument.symbol}:`, error);
                    }
                }
                this.dashboard.updateMarketData(marketData);
                const rawPositions = await this.orderService.getOpenPositions('10');
                const positions = rawPositions.map(pos => ({
                    id: pos.id,
                    sessionId: pos.sessionId,
                    instrumentId: pos.instrumentId,
                    instrument: {
                        ...pos.instrument,
                        lotSize: pos.instrument.lotSize || 0,
                        tickSize: pos.instrument.tickSize || 0
                    },
                    symbol: pos.instrument.symbol,
                    quantity: pos.quantity,
                    averagePrice: pos.averagePrice,
                    currentPrice: pos.currentPrice || null,
                    side: pos.side,
                    stopLoss: pos.stopLoss || null,
                    target: pos.target || null,
                    trailingStop: pos.trailingStop,
                    unrealizedPnL: pos.unrealizedPnL || null,
                    realizedPnL: pos.realizedPnL || null,
                    openTime: pos.openTime,
                    closeTime: pos.closeTime || null
                }));
                this.dashboard.updatePositions(positions);
                const rawTrades = await this.orderService.getRecentTrades(10);
                const trades = rawTrades.map(trade => ({
                    id: trade.id,
                    sessionId: trade.sessionId,
                    instrumentId: trade.instrumentId,
                    instrument: {
                        ...trade.instrument,
                        lotSize: trade.instrument.lotSize || 0,
                        tickSize: trade.instrument.tickSize || 0
                    },
                    strategyId: trade.strategyId || null,
                    action: trade.action,
                    quantity: trade.quantity,
                    price: trade.price,
                    orderType: trade.orderType,
                    orderId: trade.orderId || null,
                    status: trade.status,
                    stopLoss: trade.stopLoss || null,
                    target: trade.target || null,
                    trailingStop: trade.trailingStop,
                    orderTime: trade.orderTime,
                    executionTime: trade.executionTime || null,
                    realizedPnL: trade.realizedPnL || null,
                    unrealizedPnL: trade.unrealizedPnL || null
                }));
                this.dashboard.updateOrders(trades);
                const pnlData = [
                    { time: '09:15', value: 0 },
                    { time: '10:15', value: 1000 },
                    { time: '11:15', value: -500 },
                    { time: '12:15', value: 2000 },
                    { time: '13:15', value: 1500 },
                    { time: '14:15', value: 3000 },
                    { time: '15:15', value: 2500 }
                ];
                this.dashboard.updatePnL(pnlData);
                const strategies = await this.strategyService.getActiveStrategies();
                this.dashboard.updateStrategyStatus(strategies);
                this.dashboard.updateSystemStatus('Running');
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to refresh dashboard data:', error);
        }
    }
    async start() {
        try {
            await this.authManager.initialize();
            await this.refreshData();
        }
        catch (error) {
            logger_1.logger.error('Failed to start dashboard:', error);
            throw error;
        }
    }
}
exports.DashboardManager = DashboardManager;
if (require.main === module) {
    const manager = new DashboardManager();
    manager.start().catch(error => {
        logger_1.logger.error('Dashboard startup failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=run-dashboard.js.map