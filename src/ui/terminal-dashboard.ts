// @ts-ignore
import * as blessed from 'blessed';
// @ts-ignore
import * as contrib from 'blessed-contrib';
import { logger } from '../logger/logger';
import { Position, Trade, MarketData } from '../types';
import { EventEmitter } from 'events';
import { AuthManagerService } from '../services/auth-manager.service';

export class TerminalDashboard extends EventEmitter {
    private screen: blessed.Widgets.Screen;
    private grid: any;
    private marketDataTable: any;
    private positionsTable: any;
    private ordersTable: any;
    private logBox: any;
    private pnlGraph: any;
    private strategyStatus: any;
    private systemStatus: any;
    private authStatus: any;
    private authManager: AuthManagerService;

    constructor() {
        super();
        this.screen = blessed.screen({
            smartCSR: true,
            title: '🚀 Paradigm Trading Bot Dashboard'
        });

        // Initialize services
        this.authManager = AuthManagerService.getInstance();

        // Create layout
        this.createLayout();

        // Handle exit
        this.screen.key(['escape', 'q', 'C-c'], () => {
            this.emit('exit');
            process.exit(0);
        });

        // Handle refresh
        this.screen.key(['r'], () => {
            this.refreshData();
        });

        // Set up auth status listener
        this.authManager.on('status_change', (status) => {
            this.updateAuthStatus(status);
        });

        // Initialize auth status
        this.updateAuthStatus(this.authManager.getStatus());
    }

    private createLayout() {
        this.grid = new contrib.grid({
            rows: 3,
            cols: 2,
            screen: this.screen
        });

        // Market Data Table (Top Left)
        this.marketDataTable = this.grid.set(0, 0, 1, 1, contrib.table, {
            keys: true,
            fg: 'white',
            selectedFg: 'white',
            selectedBg: 'blue',
            interactive: true,
            label: 'Market Data',
            columnSpacing: 2,
            columnWidth: [12, 10, 10, 10, 10, 15]
        });

        // Positions Table (Top Right)
        this.positionsTable = this.grid.set(0, 1, 1, 1, contrib.table, {
            keys: true,
            fg: 'white',
            selectedFg: 'white',
            selectedBg: 'blue',
            interactive: true,
            label: 'Positions',
            columnSpacing: 2,
            columnWidth: [12, 8, 10, 10, 10, 10, 10]
        });

        // P&L Graph (Middle Left)
        this.pnlGraph = this.grid.set(1, 0, 1, 1, contrib.line, {
            style: {
                line: "yellow",
                text: "green",
                baseline: "black"
            },
            xLabelPadding: 3,
            xPadding: 5,
            label: 'P&L Graph'
        });

        // Orders Table (Middle Right)
        this.ordersTable = this.grid.set(1, 1, 1, 1, contrib.table, {
            keys: true,
            fg: 'white',
            selectedFg: 'white',
            selectedBg: 'blue',
            interactive: true,
            label: 'Recent Orders',
            columnSpacing: 2,
            columnWidth: [10, 12, 8, 8, 10, 8, 12]
        });

        // Strategy Status (Bottom Left)
        this.strategyStatus = this.grid.set(2, 0, 1, 1, contrib.table, {
            keys: true,
            fg: 'white',
            selectedFg: 'white',
            selectedBg: 'blue',
            interactive: true,
            label: 'Strategy Status',
            columnSpacing: 2,
            columnWidth: [15, 10, 15, 15]
        });

        // System Status (Bottom Right, split for Auth Status)
        this.systemStatus = this.grid.set(2, 1, 0.5, 1, blessed.box, {
            label: 'System Status',
            padding: 1,
            style: {
                fg: 'white'
            }
        });

        // Auth Status (Bottom Right, below System Status)
        this.authStatus = this.grid.set(2.5, 1, 0.5, 1, blessed.box, {
            label: 'Authentication Status',
            padding: 1,
            style: {
                fg: 'white'
            }
        });

        // Handle TOTP input when needed
        this.screen.key(['t'], () => {
            this.showTotpPrompt();
        });

        this.screen.render();
    }

    private showTotpPrompt() {
        const prompt = blessed.prompt({
            parent: this.screen,
            border: 'line',
            height: 'shrink',
            width: 'half',
            top: 'center',
            left: 'center',
            label: ' Enter TOTP ',
            tags: true,
            keys: true,
            vi: true
        });

        prompt.input('Enter your TOTP code:', '', async (err: Error | null, value: string) => {
            if (err || !value) return;

            try {
                // Here you would handle the TOTP value
                // For now, we'll just show a message
                this.showMessage('TOTP entered: ' + value);

                // TODO: Implement TOTP handling
                // await this.authManager.handleTotp(value);
            } catch (error: any) {
                this.showError('TOTP Error: ' + error.message);
            }
        });
    }

    private showMessage(message: string) {
        const msg = blessed.message({
            parent: this.screen,
            border: 'line',
            height: 'shrink',
            width: 'half',
            top: 'center',
            left: 'center',
            label: ' Message ',
            tags: true,
            keys: true,
            hidden: true,
            vi: true
        });

        msg.display(message, 3);
    }

    private showError(error: string) {
        const msg = blessed.message({
            parent: this.screen,
            border: 'line',
            height: 'shrink',
            width: 'half',
            top: 'center',
            left: 'center',
            label: ' Error ',
            tags: true,
            keys: true,
            hidden: true,
            style: {
                fg: 'red'
            },
            vi: true
        });

        msg.display(error, 3);
    }

    private updateAuthStatus(status: any) {
        let content = '';

        switch (status.status) {
            case 'idle':
                content = '{yellow-fg}Status:{/} Waiting for initialization\n';
                break;
            case 'logging_in':
                content = '{yellow-fg}Status:{/} Logging in...\n';
                break;
            case 'logged_in': {
                const session = this.authManager.getSession();
                const userId = session?.userId || 'N/A';
                const loginTime = session?.loginTime ?
                    new Date(session.loginTime).toLocaleTimeString() :
                    'N/A';

                content = '{green-fg}Status:{/} Authenticated\n' +
                    `User ID: ${userId}\n` +
                    `Login Time: ${loginTime}\n` +
                    'Press {bold}t{/bold} to enter TOTP if needed';
                break;
            }
            case 'error':
                content = '{red-fg}Status:{/} Error\n' +
                    `Error: ${status.error || 'Unknown error'}\n` +
                    'Press {bold}t{/bold} to retry with TOTP';
                break;
            default:
                content = '{yellow-fg}Status:{/} Unknown\n';
                break;
        }

        if (this.authStatus) {
            this.authStatus.setContent(content);
            this.screen.render();
        }
    }

    public updateMarketData(data: MarketData[]) {
        const tableData = data.map(item => [
            item.symbol,
            item.ltp?.toString() || '-',
            item.changePercent?.toFixed(2) + '%' || '-',
            item.volume?.toString() || '-',
            new Date(item.timestamp).toLocaleTimeString()
        ]);

        this.marketDataTable.setData({
            headers: ['Symbol', 'LTP', 'Change', 'Volume', 'Time'],
            data: tableData
        });
        this.screen.render();
    }

    public updatePositions(positions: Position[]) {
        const tableData = positions.map(pos => [
            pos.symbol,
            pos.quantity.toString(),
            pos.averagePrice.toFixed(2),
            pos.currentPrice.toFixed(2),
            pos.unrealizedPnL.toFixed(2)
        ]);

        this.positionsTable.setData({
            headers: ['Symbol', 'Qty', 'Avg Price', 'LTP', 'P&L'],
            data: tableData.length ? tableData : [['No positions', '-', '-', '-', '-']]
        });
        this.screen.render();
    }

    public updateOrders(trades: Trade[]) {
        const tableData = trades.map(trade => [
            new Date(trade.orderTime).toLocaleTimeString(),
            trade.instrument.symbol,
            trade.action,
            trade.quantity.toString(),
            trade.status
        ]);

        this.ordersTable.setData({
            headers: ['Time', 'Symbol', 'Type', 'Qty', 'Status'],
            data: tableData.length ? tableData : [['No orders', '-', '-', '-', '-']]
        });
        this.screen.render();
    }

    public updatePnL(data: { time: string, value: number }[]) {
        const x = data.map(d => d.time);
        const y = data.map(d => d.value);

        this.pnlGraph.setData([{
            title: 'P&L',
            x: x,
            y: y,
            style: {
                line: y[y.length - 1] >= 0 ? 'green' : 'red'
            }
        }]);
        this.screen.render();
    }

    public updateStrategyStatus(strategies: any[]) {
        const tableData = strategies.map(strat => [
            strat.name,
            strat.status,
            strat.signals.toString(),
            strat.pnl.toFixed(2)
        ]);

        this.strategyStatus.setData({
            headers: ['Strategy', 'Status', 'Signals', 'P&L'],
            data: tableData.length ? tableData : [['No strategies', '-', '-', '-']]
        });
        this.screen.render();
    }

    public updateSystemStatus(status: any) {
        this.systemStatus.setContent(`System Status: ${status}`);
        this.screen.render();
    }

    private refreshData() {
        this.emit('refresh');
    }
} 