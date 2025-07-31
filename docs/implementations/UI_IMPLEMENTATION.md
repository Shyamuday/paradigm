# Terminal UI Implementation Guide

## Overview

The terminal-based user interface provides real-time monitoring of trading activities, market data, and system status using the blessed and blessed-contrib libraries.

## Implementation Details

### 1. Dashboard Layout

```typescript
// src/ui/terminal-dashboard.ts
export class TerminalDashboard {
  private screen: blessed.screen;
  private grid: Contrib.grid;
  private components: Map<string, blessed.widget.Node>;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: "Paradigm Trading Dashboard",
    });

    this.grid = new Contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen,
    });

    this.initializeComponents();
    this.setupEventHandlers();
  }

  private initializeComponents(): void {
    // Market Data Panel
    this.components.set(
      "marketData",
      this.grid.set(0, 0, 4, 6, Contrib.line, {
        label: "Market Data",
        showLegend: true,
        legend: { width: 10 },
      })
    );

    // Position Panel
    this.components.set(
      "positions",
      this.grid.set(4, 0, 4, 6, Contrib.table, {
        label: "Open Positions",
        columnWidth: [12, 10, 10, 10, 10],
      })
    );

    // Strategy Panel
    this.components.set(
      "strategy",
      this.grid.set(0, 6, 4, 6, Contrib.line, {
        label: "Strategy Signals",
        showLegend: true,
      })
    );

    // Additional components...
  }
}
```

### 2. Data Display Components

```typescript
// src/ui/components/market-data-panel.ts
export class MarketDataPanel {
  private chart: Contrib.line;
  private data: MarketData[];

  updatePriceChart(data: MarketData[]): void {
    this.chart.setData([
      {
        title: "Price",
        x: data.map((d) => d.timestamp),
        y: data.map((d) => d.close),
        style: { line: "yellow" },
      },
    ]);
  }

  updateVolumeBar(data: MarketData[]): void {
    this.volumeBar.setData({
      titles: data.map((d) => d.timestamp),
      data: data.map((d) => d.volume),
    });
  }
}

// src/ui/components/position-panel.ts
export class PositionPanel {
  private table: Contrib.table;

  updatePositions(positions: Position[]): void {
    this.table.setData({
      headers: ["Symbol", "Side", "Qty", "Avg Price", "P&L"],
      data: positions.map((p) => [
        p.symbol,
        p.side,
        p.quantity.toString(),
        p.averagePrice.toFixed(2),
        this.formatPnL(p.unrealizedPnL),
      ]),
    });
  }
}
```

### 3. Real-time Updates

```typescript
// src/ui/terminal-dashboard.ts
export class DataUpdateManager {
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  startUpdates(): void {
    // Market Data Updates (1 second)
    this.updateIntervals.set(
      "market",
      setInterval(() => {
        this.updateMarketData();
      }, 1000)
    );

    // Position Updates (2 seconds)
    this.updateIntervals.set(
      "positions",
      setInterval(() => {
        this.updatePositions();
      }, 2000)
    );

    // Strategy Updates (5 seconds)
    this.updateIntervals.set(
      "strategy",
      setInterval(() => {
        this.updateStrategy();
      }, 5000)
    );
  }

  private async updateMarketData(): Promise<void> {
    const data = await this.marketDataService.getLatestData();
    this.marketDataPanel.updatePriceChart(data);
    this.marketDataPanel.updateVolumeBar(data);
  }
}
```

### 4. User Input Handling

```typescript
// src/ui/input-handler.ts
export class InputHandler {
  setupKeyBindings(): void {
    this.screen.key(["escape", "q", "C-c"], () => {
      this.cleanup();
      process.exit(0);
    });

    this.screen.key("p", () => {
      this.togglePause();
    });

    this.screen.key("r", () => {
      this.refreshData();
    });

    // Additional key bindings...
  }

  private togglePause(): void {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.pauseUpdates();
    } else {
      this.resumeUpdates();
    }
    this.showNotification(`Updates ${this.isPaused ? "Paused" : "Resumed"}`);
  }
}
```

### 5. Alert System

```typescript
// src/ui/alert-manager.ts
export class AlertManager {
  private alertBox: blessed.Widgets.BoxElement;

  showAlert(message: string, type: "info" | "warning" | "error"): void {
    this.alertBox.setContent(message);
    this.alertBox.style.bg = this.getAlertColor(type);
    this.alertBox.show();

    setTimeout(() => {
      this.alertBox.hide();
    }, 3000);
  }

  private getAlertColor(type: string): string {
    switch (type) {
      case "error":
        return "red";
      case "warning":
        return "yellow";
      case "info":
        return "blue";
      default:
        return "white";
    }
  }
}
```

## Dashboard Layout

### 1. Market Data Panel

```
+------------------------+
|      NIFTY50          |
| Price: 21550 (+1.2%)  |
| Volume: 1.5M          |
| Time: 15:30:45        |
+------------------------+
```

### 2. Position Panel

```
+--------------------------------+
| Symbol  Side  Qty   Avg   P&L  |
| NIFTY   LONG  50   21500 +2.5K |
| BANKNIF SHORT 25   46750 -1.2K |
+--------------------------------+
```

### 3. Strategy Panel

```
+------------------------+
| MA Crossover          |
| Short MA: 21545       |
| Long MA:  21532       |
| Signal:   BUY         |
+------------------------+
```

## Update Frequencies

1. **Real-time Updates**

   - Market Data: 1 second
   - Positions: 2 seconds
   - Orders: 2 seconds
   - Strategy: 5 seconds

2. **Batch Updates**
   - P&L Calculations: 5 seconds
   - Risk Metrics: 10 seconds
   - System Stats: 30 seconds

## User Controls

### 1. Navigation

- `Arrow Keys`: Navigate panels
- `Tab`: Switch focus
- `Enter`: Select/Expand

### 2. Actions

- `P`: Pause/Resume updates
- `R`: Refresh data
- `S`: Show system stats
- `L`: Show logs
- `Q`: Quit application

### 3. Trading Controls

- `T`: New trade entry
- `M`: Modify position
- `C`: Cancel order
- `X`: Close position

## Error Handling

1. **Display Errors**

   - Connection loss
   - Data feed issues
   - System alerts

2. **Recovery Actions**

   - Auto-reconnect
   - Data refresh
   - State recovery

3. **User Notifications**
   - Alert messages
   - Status updates
   - Error logs

## Performance Optimization

1. **Render Optimization**

   - Partial updates
   - Buffer management
   - Throttled rendering

2. **Memory Management**

   - Data cleanup
   - Cache limits
   - Resource monitoring

3. **Update Efficiency**
   - Batched updates
   - Delta changes
   - Priority queue

## Monitoring

1. **UI Performance**

   - Render times
   - Update latency
   - Memory usage

2. **Data Quality**

   - Update frequency
   - Data accuracy
   - Display errors

3. **User Experience**
   - Response time
   - Error rates
   - Feature usage
