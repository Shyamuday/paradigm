import { TerminalDashboard } from './terminal-dashboard';
import { MarketDataService } from '../services/market-data.service';
import { OrderService } from '../services/order.service';
import { StrategyService } from '../services/strategy.service';
import { AuthManagerService } from '../services/auth-manager.service';
import { logger } from '../logger/logger';
import { MarketData, Position, Trade } from '../types';

export class DashboardManager {
    private dashboard: TerminalDashboard;
    private marketDataService: MarketDataService;
    private orderService: OrderService;
    private strategyService: StrategyService;
    private authManager: AuthManagerService;
    private updateInterval: NodeJS.Timeout | null = null;

    constructor() {
        this.dashboard = new TerminalDashboard();
        this.marketDataService = new MarketDataService();
        this.orderService = new OrderService();
        this.strategyService = new StrategyService();
        this.authManager = AuthManagerService.getInstance();

        // Setup event listeners
        this.setupEventListeners();
    }

    private setupEventListeners() {
        // Handle dashboard exit
        this.dashboard.on('exit', () => {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
            process.exit(0);
        });

        // Handle refresh request
        this.dashboard.on('refresh', () => {
            this.refreshData();
        });

        // Handle TOTP input
        this.dashboard.on('totp_input', async (totp: string) => {
            try {
                // TODO: Implement TOTP handling in AuthManagerService
                // await this.authManager.handleTotp(totp);
                await this.refreshData();
            } catch (error) {
                logger.error('Failed to handle TOTP:', error);
            }
        });

        // Start auto-refresh
        this.updateInterval = setInterval(() => {
            this.refreshData();
        }, 5000); // Refresh every 5 seconds
    }

    private async refreshData() {
        try {
            // Only fetch data if authenticated
            const authStatus = this.authManager.getStatus();
            if (authStatus.isAuthenticated) {
                // Fetch market data
                const rawMarketData = await this.marketDataService.getLatestMarketData();
                const marketData: MarketData[] = rawMarketData.map(data => ({
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
                this.dashboard.updateMarketData(marketData);

                // Fetch positions
                const rawPositions = await this.orderService.getOpenPositions('10'); // Limit to 10 positions
                const positions: Position[] = rawPositions.map(pos => ({
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
                    side: pos.side as 'LONG' | 'SHORT',
                    stopLoss: pos.stopLoss || null,
                    target: pos.target || null,
                    trailingStop: pos.trailingStop,
                    unrealizedPnL: pos.unrealizedPnL || null,
                    realizedPnL: pos.realizedPnL || null,
                    openTime: pos.openTime,
                    closeTime: pos.closeTime || null
                }));
                this.dashboard.updatePositions(positions);

                // Fetch recent orders
                const rawTrades = await this.orderService.getRecentTrades(10);
                const trades: Trade[] = rawTrades.map(trade => ({
                    id: trade.id,
                    sessionId: trade.sessionId,
                    instrumentId: trade.instrumentId,
                    instrument: {
                        ...trade.instrument,
                        lotSize: trade.instrument.lotSize || 0,
                        tickSize: trade.instrument.tickSize || 0
                    },
                    strategyId: trade.strategyId || null,
                    action: trade.action as 'BUY' | 'SELL',
                    quantity: trade.quantity,
                    price: trade.price,
                    orderType: trade.orderType as 'MARKET' | 'LIMIT' | 'SL' | 'SL-M',
                    orderId: trade.orderId || null,
                    status: trade.status as 'PENDING' | 'COMPLETE' | 'CANCELLED' | 'REJECTED',
                    stopLoss: trade.stopLoss || null,
                    target: trade.target || null,
                    trailingStop: trade.trailingStop,
                    orderTime: trade.orderTime,
                    executionTime: trade.executionTime || null,
                    realizedPnL: trade.realizedPnL || null,
                    unrealizedPnL: trade.unrealizedPnL || null
                }));
                this.dashboard.updateOrders(trades);

                // Fetch P&L data
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

                // Fetch strategy status
                const strategies = await this.strategyService.getActiveStrategies();
                this.dashboard.updateStrategyStatus(strategies);

                // Update system status
                this.dashboard.updateSystemStatus('Running');
            }
        } catch (error) {
            logger.error('Failed to refresh dashboard data:', error);
        }
    }

    public async start() {
        try {
            // Initialize authentication
            await this.authManager.initialize();

            // Start data refresh
            await this.refreshData();

        } catch (error) {
            logger.error('Failed to start dashboard:', error);
            throw error;
        }
    }
}

// Run the dashboard if this file is executed directly
if (require.main === module) {
    const manager = new DashboardManager();
    manager.start().catch(error => {
        logger.error('Dashboard startup failed:', error);
        process.exit(1);
    });
} 