import { Position, Trade, MarketData } from '../types';
import { EventEmitter } from 'events';
export declare class TerminalDashboard extends EventEmitter {
    private screen;
    private grid;
    private marketDataTable;
    private positionsTable;
    private ordersTable;
    private logBox;
    private pnlGraph;
    private strategyStatus;
    private systemStatus;
    private authStatus;
    private authManager;
    constructor();
    private createLayout;
    private showTotpPrompt;
    private showMessage;
    private showError;
    private updateAuthStatus;
    updateMarketData(data: MarketData[]): void;
    updatePositions(positions: Position[]): void;
    updateOrders(trades: Trade[]): void;
    updatePnL(data: {
        time: string;
        value: number;
    }[]): void;
    updateStrategyStatus(strategies: any[]): void;
    updateSystemStatus(status: any): void;
    private refreshData;
}
//# sourceMappingURL=terminal-dashboard.d.ts.map