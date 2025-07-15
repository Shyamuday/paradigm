"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalDashboard = void 0;
const blessed = __importStar(require("blessed"));
const contrib = __importStar(require("blessed-contrib"));
const events_1 = require("events");
const auth_manager_service_1 = require("../services/auth-manager.service");
class TerminalDashboard extends events_1.EventEmitter {
    constructor() {
        super();
        this.screen = blessed.screen({
            smartCSR: true,
            title: '🚀 Paradigm Trading Bot Dashboard'
        });
        this.authManager = auth_manager_service_1.AuthManagerService.getInstance();
        this.createLayout();
        this.screen.key(['escape', 'q', 'C-c'], () => {
            this.emit('exit');
            process.exit(0);
        });
        this.screen.key(['r'], () => {
            this.refreshData();
        });
        this.authManager.on('status_change', (status) => {
            this.updateAuthStatus(status);
        });
        this.updateAuthStatus(this.authManager.getStatus());
    }
    createLayout() {
        this.grid = new contrib.grid({
            rows: 3,
            cols: 2,
            screen: this.screen
        });
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
        this.systemStatus = this.grid.set(2, 1, 0.5, 1, blessed.box, {
            label: 'System Status',
            padding: 1,
            style: {
                fg: 'white'
            }
        });
        this.authStatus = this.grid.set(2.5, 1, 0.5, 1, blessed.box, {
            label: 'Authentication Status',
            padding: 1,
            style: {
                fg: 'white'
            }
        });
        this.screen.key(['t'], () => {
            this.showTotpPrompt();
        });
        this.screen.render();
    }
    showTotpPrompt() {
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
        prompt.input('Enter your TOTP code:', '', async (err, value) => {
            if (err || !value)
                return;
            try {
                this.showMessage('TOTP entered: ' + value);
            }
            catch (error) {
                this.showError('TOTP Error: ' + error.message);
            }
        });
    }
    showMessage(message) {
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
    showError(error) {
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
    updateAuthStatus(status) {
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
    updateMarketData(data) {
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
    updatePositions(positions) {
        const tableData = positions.map(pos => [
            pos.symbol,
            pos.quantity.toString(),
            pos.averagePrice.toFixed(2),
            pos.currentPrice?.toFixed(2) ?? 'N/A',
            pos.unrealizedPnL?.toFixed(2) ?? 'N/A'
        ]);
        this.positionsTable.setData({
            headers: ['Symbol', 'Qty', 'Avg Price', 'LTP', 'P&L'],
            data: tableData.length ? tableData : [['No positions', '-', '-', '-', '-']]
        });
        this.screen.render();
    }
    updateOrders(trades) {
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
    updatePnL(data) {
        const x = data.map(d => d.time);
        const y = data.map(d => d.value);
        this.pnlGraph.setData([{
                title: 'P&L',
                x: x,
                y: y,
                style: {
                    line: (y.length > 0 && y[y.length - 1] >= 0) ? 'green' : 'red'
                }
            }]);
        this.screen.render();
    }
    updateStrategyStatus(strategies) {
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
    updateSystemStatus(status) {
        this.systemStatus.setContent(`System Status: ${status}`);
        this.screen.render();
    }
    refreshData() {
        this.emit('refresh');
    }
}
exports.TerminalDashboard = TerminalDashboard;
//# sourceMappingURL=terminal-dashboard.js.map