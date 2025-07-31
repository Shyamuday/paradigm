import * as blessed from 'blessed';
import * as contrib from 'blessed-contrib';
import { logger } from '../logger/logger';

export interface ChartData {
  symbol: string;
  prices: number[];
  volumes: number[];
  timestamps: Date[];
  indicators?: {
    sma?: number[];
    ema?: number[];
    rsi?: number[];
    macd?: number[];
    bb?: {
      upper: number[];
      middle: number[];
      lower: number[];
    };
  };
}

export interface ChartConfig {
  width: number;
  height: number;
  title: string;
  showVolume: boolean;
  showIndicators: boolean;
  updateInterval: number;
}

export class AdvancedChartingService {
  private screen: any;
  private charts: Map<string, any> = new Map();
  private isRunning = false;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Paradigm Trading Bot - Advanced Charts'
    });

    // Handle exit
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.stop();
      process.exit(0);
    });
  }

  /**
   * Start the charting service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Charting service already running');
      return;
    }

    this.isRunning = true;
    this.screen.render();
    logger.info('Advanced charting service started');
  }

  /**
   * Stop the charting service
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('Charting service not running');
      return;
    }

    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    this.screen.destroy();
    logger.info('Advanced charting service stopped');
  }

  /**
   * Create a candlestick chart
   */
  createCandlestickChart(symbol: string, config: ChartConfig): void {
    try {
      const grid = new contrib.grid({
        rows: config.showVolume ? 12 : 8,
        cols: 12,
        screen: this.screen
      });

      // Create candlestick chart
      const candlestick = (contrib as any).candlestick({
        label: `${symbol} - Price Chart`,
        showLegend: true,
        legend: { width: 10 }
      });

      // Create volume chart if enabled
      let volume: any = null;
      if (config.showVolume) {
        volume = grid.set(8, 0, 4, 12, contrib.bar, {
          label: `${symbol} - Volume`,
          barWidth: 1,
          barSpacing: 1,
          xOffset: 0,
          maxHeight: 9
        });
      }

      // Create RSI chart if indicators enabled
      let rsi: any = null;
      if (config.showIndicators) {
        rsi = grid.set(0, 0, 4, 6, contrib.line, {
          label: `${symbol} - RSI`,
          showLegend: true,
          legend: { width: 10 },
          wholeNumbersOnly: false,
          maxY: 100,
          minY: 0
        });
      }

      this.charts.set(symbol, {
        candlestick,
        volume,
        rsi,
        config
      });

      logger.info(`Candlestick chart created for ${symbol}`);
    } catch (error) {
      logger.error('Error creating candlestick chart', error);
      throw error;
    }
  }

  /**
   * Update chart with new data
   */
  updateChart(symbol: string, data: ChartData): void {
    try {
      const chart = this.charts.get(symbol);
      if (!chart) {
        logger.warn(`Chart not found for symbol: ${symbol}`);
        return;
      }

      // Prepare candlestick data
      const candlestickData = this.prepareCandlestickData(data);
      chart.candlestick.setData(candlestickData);

      // Update volume chart
      if (chart.volume && data.volumes) {
        const volumeData = this.prepareVolumeData(data);
        chart.volume.setData(volumeData);
      }

      // Update RSI chart
      if (chart.rsi && data.indicators?.rsi) {
        const rsiData = this.prepareRSIData(data);
        chart.rsi.setData(rsiData);
      }

      this.screen.render();
      logger.debug(`Chart updated for ${symbol}`);
    } catch (error) {
      logger.error('Error updating chart', error);
    }
  }

  /**
   * Create a line chart
   */
  createLineChart(symbol: string, config: ChartConfig): void {
    try {
      const grid = new contrib.grid({
        rows: 12,
        cols: 12,
        screen: this.screen
      });

      const line = (contrib as any).line({
        label: `${symbol} - Price Line Chart`,
        showLegend: true,
        legend: { width: 10 },
        wholeNumbersOnly: false
      });

      this.charts.set(symbol, {
        line,
        config
      });

      logger.info(`Line chart created for ${symbol}`);
    } catch (error) {
      logger.error('Error creating line chart', error);
      throw error;
    }
  }

  /**
   * Create a bar chart
   */
  createBarChart(symbol: string, config: ChartConfig): void {
    try {
      const grid = new contrib.grid({
        rows: 12,
        cols: 12,
        screen: this.screen
      });

      const bar = (contrib as any).bar({
        label: `${symbol} - Volume Bar Chart`,
        barWidth: 2,
        barSpacing: 1,
        xOffset: 0,
        maxHeight: 9
      });

      this.charts.set(symbol, {
        bar,
        config
      });

      logger.info(`Bar chart created for ${symbol}`);
    } catch (error) {
      logger.error('Error creating bar chart', error);
      throw error;
    }
  }

  /**
   * Create a dashboard with multiple charts
   */
  createDashboard(symbols: string[], config: ChartConfig): void {
    try {
      const grid = new contrib.grid({
        rows: 12,
        cols: 12,
        screen: this.screen
      });

      const chartsPerRow = 2;
      const chartsPerCol = 2;
      const chartWidth = 12 / chartsPerRow;
      const chartHeight = 12 / chartsPerCol;

      symbols.forEach((symbol, index) => {
        const row = Math.floor(index / chartsPerRow);
        const col = index % chartsPerRow;

        const line = grid.set(
          row * chartHeight,
          col * chartWidth,
          chartHeight,
          chartWidth,
          contrib.line,
          {
            label: `${symbol} - Price`,
            showLegend: true,
            legend: { width: 8 },
            wholeNumbersOnly: false
          }
        );

        this.charts.set(symbol, {
          line,
          config
        });
      });

      logger.info(`Dashboard created with ${symbols.length} charts`);
    } catch (error) {
      logger.error('Error creating dashboard', error);
      throw error;
    }
  }

  /**
   * Prepare candlestick data
   */
  private prepareCandlestickData(data: ChartData): any[] {
    if (!data.prices || data.prices.length === 0) {
      return [];
    }

    const candlestickData = [];
    for (let i = 0; i < data.prices.length; i++) {
      const price = data.prices[i];
      const timestamp = data.timestamps[i];
      if (price === undefined || timestamp === undefined) continue;
      const open = price * (0.99 + Math.random() * 0.02);
      const high = price * (1.0 + Math.random() * 0.01);
      const low = price * (0.99 - Math.random() * 0.01);
      const close = price;
      candlestickData.push({
        time: timestamp.getTime(),
        open,
        high,
        low,
        close
      });
    }
    return candlestickData;
  }

  /**
   * Prepare volume data
   */
  private prepareVolumeData(data: ChartData): any[] {
    if (!data.volumes || data.volumes.length === 0) {
      return [];
    }

    return data.volumes.map((volume, index) => ({
      x: index,
      y: volume
    }));
  }

  /**
   * Prepare RSI data
   */
  private prepareRSIData(data: ChartData): any[] {
    if (!data.indicators?.rsi || data.indicators.rsi.length === 0) {
      return [];
    }

    return data.indicators.rsi.map((rsi, index) => ({
      x: index,
      y: rsi
    }));
  }

  /**
   * Add technical indicators to chart
   */
  addIndicators(symbol: string, indicators: any): void {
    try {
      const chart = this.charts.get(symbol);
      if (!chart) {
        logger.warn(`Chart not found for symbol: ${symbol}`);
        return;
      }
      if (indicators.sma && chart.candlestick) {
        const smaData = indicators.sma.map((value: number, index: number) => ({
          time: Date.now() - (indicators.sma.length - index) * 60000,
          value
        }));
        chart.candlestick.setData([
          ...chart.candlestick.getData(),
          {
            title: 'SMA',
            x: smaData.map((d: any) => d.time),
            y: smaData.map((d: any) => d.value),
            style: { line: 'yellow' }
          }
        ]);
      }
      if (indicators.ema && chart.candlestick) {
        const emaData = indicators.ema.map((value: number, index: number) => ({
          time: Date.now() - (indicators.ema.length - index) * 60000,
          value
        }));
        chart.candlestick.setData([
          ...chart.candlestick.getData(),
          {
            title: 'EMA',
            x: emaData.map((d: any) => d.time),
            y: emaData.map((d: any) => d.value),
            style: { line: 'green' }
          }
        ]);
      }
      this.screen.render();
      logger.debug(`Indicators added to chart for ${symbol}`);
    } catch (error) {
      logger.error('Error adding indicators', error);
    }
  }

  /**
   * Create a real-time updating chart
   */
  startRealTimeChart(symbol: string, updateCallback: () => ChartData): void {
    try {
      const chart = this.charts.get(symbol);
      if (!chart) {
        logger.warn(`Chart not found for symbol: ${symbol}`);
        return;
      }

      this.updateInterval = setInterval(() => {
        try {
          const data = updateCallback();
          this.updateChart(symbol, data);
        } catch (error) {
          logger.error('Error in real-time chart update', error);
        }
      }, chart.config.updateInterval || 1000);

      logger.info(`Real-time chart started for ${symbol}`);
    } catch (error) {
      logger.error('Error starting real-time chart', error);
    }
  }

  /**
   * Stop real-time chart updates
   */
  stopRealTimeChart(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      logger.info('Real-time chart updates stopped');
    }
  }

  /**
   * Create a performance metrics chart
   */
  createPerformanceChart(metrics: any): void {
    try {
      const grid = new contrib.grid({
        rows: 12,
        cols: 12,
        screen: this.screen
      });

      // Portfolio value chart
      const portfolioChart = (contrib as any).line({
        label: 'Portfolio Value',
        showLegend: true,
        legend: { width: 10 },
        wholeNumbersOnly: false
      });

      // P&L chart
      const pnlChart = (contrib as any).line({
        label: 'P&L',
        showLegend: true,
        legend: { width: 10 },
        wholeNumbersOnly: false
      });

      // Risk metrics chart
      const riskChart = (contrib as any).bar({
        label: 'Risk Metrics',
        barWidth: 2,
        barSpacing: 1,
        xOffset: 0,
        maxHeight: 9
      });

      // Update charts with metrics
      if (metrics.portfolioValue) {
        portfolioChart.setData([{
          title: 'Portfolio Value',
          x: metrics.timestamps || [],
          y: metrics.portfolioValue,
          style: { line: 'green' }
        }]);
      }

      if (metrics.pnl) {
        pnlChart.setData([{
          title: 'P&L',
          x: metrics.timestamps || [],
          y: metrics.pnl,
          style: { line: metrics.pnl[metrics.pnl.length - 1] >= 0 ? 'green' : 'red' }
        }]);
      }

      if (metrics.riskMetrics) {
        (riskChart as any).setData([
          { title: 'Sharpe Ratio', x: ['Sharpe'], y: [metrics.riskMetrics.sharpeRatio || 0] },
          { title: 'Max Drawdown', x: ['Max DD'], y: [Math.abs(metrics.riskMetrics.maxDrawdown || 0)] },
          { title: 'Volatility', x: ['Vol'], y: [metrics.riskMetrics.volatility || 0] }
        ]);
      }

      this.screen.render();
      logger.info('Performance chart created');
    } catch (error) {
      logger.error('Error creating performance chart', error);
    }
  }

  /**
   * Get chart status
   */
  getStatus(): {
    isRunning: boolean;
    charts: string[];
    realTimeUpdates: boolean;
  } {
    return {
      isRunning: this.isRunning,
      charts: Array.from(this.charts.keys()),
      realTimeUpdates: this.updateInterval !== null
    };
  }

  /**
   * Clear all charts
   */
  clearCharts(): void {
    this.charts.clear();
    this.screen.clearRegion(0, 0, this.screen.width, this.screen.height);
    this.screen.render();
    logger.info('All charts cleared');
  }
}

// Export singleton instance
export const chartingService = new AdvancedChartingService(); 