import axios from 'axios';
import { logger } from '../logger/logger';

export interface TelegramConfig {
    botToken: string;
    chatId: string;
    enabled: boolean;
    notifications: {
        tradeSignals: boolean;
        tradeExecutions: boolean;
        positionUpdates: boolean;
        performanceUpdates: boolean;
        systemAlerts: boolean;
        dailyReports: boolean;
        errorAlerts: boolean;
    };
    updateInterval: number; // minutes
}

export interface TradeSignal {
    symbol: string;
    action: 'BUY' | 'SELL' | 'HOLD';
    price: number;
    confidence: number;
    reasoning: string;
    strategy: string;
}

export interface TradeExecution {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    orderId: string;
    status: 'SUCCESS' | 'FAILED';
}

export interface PositionUpdate {
    symbol: string;
    side: 'LONG' | 'SHORT';
    quantity: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
}

export interface PerformanceUpdate {
    totalPnL: number;
    dailyPnL: number;
    winRate: number;
    totalTrades: number;
    openPositions: number;
    capital: number;
}

export interface SystemAlert {
    type: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
    message: string;
    timestamp: Date;
}

export class TelegramNotificationService {
    private config: TelegramConfig;
    private baseUrl: string;
    private lastPerformanceUpdate: Date = new Date(0);
    private messageQueue: string[] = [];
    private isProcessingQueue: boolean = false;

    constructor(config: TelegramConfig) {
        this.config = config;
        this.baseUrl = `https://api.telegram.org/bot${config.botToken}`;
    }

    async initialize(): Promise<void> {
        if (!this.config.enabled) {
            logger.info('Telegram notifications disabled');
            return;
        }

        try {
            // Test bot connection
            const response = await axios.get(`${this.baseUrl}/getMe`);
            if (response.data.ok) {
                logger.info(`Telegram bot connected: ${response.data.result.username}`);
                await this.sendMessage('🤖 Trading Bot Started\n\nSystem initialized and ready for trading!');
            } else {
                throw new Error('Failed to connect to Telegram bot');
            }
        } catch (error) {
            logger.error('Failed to initialize Telegram notifications:', error);
            throw error;
        }
    }

    async sendTradeSignal(signal: TradeSignal): Promise<void> {
        if (!this.config.enabled || !this.config.notifications.tradeSignals) return;

        const emoji = signal.action === 'BUY' ? '🟢' : signal.action === 'SELL' ? '🔴' : '🟡';
        const confidenceBar = this.getConfidenceBar(signal.confidence);

        const message = `
${emoji} **TRADE SIGNAL** ${emoji}

📊 **Symbol**: ${signal.symbol}
🎯 **Action**: ${signal.action}
💰 **Price**: ₹${signal.price.toFixed(2)}
📈 **Confidence**: ${confidenceBar} (${signal.confidence}%)
🤖 **Strategy**: ${signal.strategy}
💭 **Reasoning**: ${signal.reasoning}

⏰ ${new Date().toLocaleTimeString()}
        `.trim();

        await this.sendMessage(message);
    }

    async sendTradeExecution(execution: TradeExecution): Promise<void> {
        if (!this.config.enabled || !this.config.notifications.tradeExecutions) return;

        const emoji = execution.status === 'SUCCESS' ? '✅' : '❌';
        const statusText = execution.status === 'SUCCESS' ? 'EXECUTED' : 'FAILED';

        const message = `
${emoji} **TRADE ${statusText}** ${emoji}

📊 **Symbol**: ${execution.symbol}
🎯 **Action**: ${execution.action}
📦 **Quantity**: ${execution.quantity}
💰 **Price**: ₹${execution.price.toFixed(2)}
🆔 **Order ID**: ${execution.orderId}
📊 **Status**: ${execution.status}

⏰ ${new Date().toLocaleTimeString()}
        `.trim();

        await this.sendMessage(message);
    }

    async sendPositionUpdate(positions: PositionUpdate[]): Promise<void> {
        if (!this.config.enabled || !this.config.notifications.positionUpdates || positions.length === 0) return;

        let message = '📊 **POSITION UPDATE** 📊\n\n';

        for (const position of positions) {
            const pnlEmoji = position.unrealizedPnL >= 0 ? '📈' : '📉';
            const sideEmoji = position.side === 'LONG' ? '🟢' : '🔴';

            message += `
${sideEmoji} **${position.symbol}** (${position.side})
📦 Quantity: ${position.quantity}
💰 Entry: ₹${position.entryPrice.toFixed(2)}
📊 Current: ₹${position.currentPrice.toFixed(2)}
${pnlEmoji} P&L: ₹${position.unrealizedPnL.toFixed(2)} (${position.unrealizedPnLPercent.toFixed(2)}%)
            `.trim() + '\n\n';
        }

        message += `⏰ ${new Date().toLocaleTimeString()}`;
        await this.sendMessage(message);
    }

    async sendPerformanceUpdate(performance: PerformanceUpdate): Promise<void> {
        if (!this.config.enabled || !this.config.notifications.performanceUpdates) return;

        // Check if enough time has passed since last update
        const now = new Date();
        const timeDiff = now.getTime() - this.lastPerformanceUpdate.getTime();
        const minutesDiff = timeDiff / (1000 * 60);

        if (minutesDiff < this.config.updateInterval) return;

        this.lastPerformanceUpdate = now;

        const totalPnLEmoji = performance.totalPnL >= 0 ? '📈' : '📉';
        const dailyPnLEmoji = performance.dailyPnL >= 0 ? '📈' : '📉';

        const message = `
📊 **PERFORMANCE UPDATE** 📊

${totalPnLEmoji} **Total P&L**: ₹${performance.totalPnL.toFixed(2)}
${dailyPnLEmoji} **Daily P&L**: ₹${performance.dailyPnL.toFixed(2)}
📈 **Win Rate**: ${performance.winRate.toFixed(1)}%
📊 **Total Trades**: ${performance.totalTrades}
🔓 **Open Positions**: ${performance.openPositions}
💰 **Capital**: ₹${performance.capital.toFixed(2)}

⏰ ${new Date().toLocaleTimeString()}
        `.trim();

        await this.sendMessage(message);
    }

    async sendSystemAlert(alert: SystemAlert): Promise<void> {
        if (!this.config.enabled || !this.config.notifications.systemAlerts) return;

        const alertEmoji = this.getAlertEmoji(alert.type);
        const alertType = alert.type.toUpperCase();

        const message = `
${alertEmoji} **${alertType} ALERT** ${alertEmoji}

⚠️ **Message**: ${alert.message}
⏰ **Time**: ${alert.timestamp.toLocaleString()}

🚨 **Action Required**: ${this.getActionRequired(alert.type)}
        `.trim();

        await this.sendMessage(message);
    }

    async sendDailyReport(report: any): Promise<void> {
        if (!this.config.enabled || !this.config.notifications.dailyReports) return;

        const message = `
📅 **DAILY TRADING REPORT** 📅

📊 **Date**: ${new Date().toLocaleDateString()}
💰 **Total P&L**: ₹${report.totalPnL.toFixed(2)}
📈 **Win Rate**: ${report.winRate.toFixed(1)}%
📊 **Total Trades**: ${report.totalTrades}
📈 **Winning Trades**: ${report.winningTrades}
📉 **Losing Trades**: ${report.losingTrades}
📊 **Average Win**: ₹${report.averageWin.toFixed(2)}
📊 **Average Loss**: ₹${report.averageLoss.toFixed(2)}
📊 **Largest Win**: ₹${report.largestWin.toFixed(2)}
📊 **Largest Loss**: ₹${report.largestLoss.toFixed(2)}
📊 **Sharpe Ratio**: ${report.sharpeRatio.toFixed(2)}
📊 **Max Drawdown**: ${report.maxDrawdown.toFixed(2)}%

🎯 **Best Strategy**: ${report.bestStrategy}
📊 **Best Strategy P&L**: ₹${report.bestStrategyPnL.toFixed(2)}

⏰ Generated at ${new Date().toLocaleTimeString()}
        `.trim();

        await this.sendMessage(message);
    }

    async sendErrorAlert(error: Error, context?: string): Promise<void> {
        if (!this.config.enabled || !this.config.notifications.errorAlerts) return;

        const message = `
🚨 **ERROR ALERT** 🚨

❌ **Error**: ${error.message}
📝 **Context**: ${context || 'No context provided'}
⏰ **Time**: ${new Date().toLocaleString()}
📊 **Stack**: ${error.stack?.split('\n')[1] || 'No stack trace'}

🔧 **Action**: Please check system logs and take necessary action.
        `.trim();

        await this.sendMessage(message);
    }

    async sendMarketUpdate(marketData: any[]): Promise<void> {
        if (!this.config.enabled) return;

        let message = '📊 **MARKET UPDATE** 📊\n\n';

        for (const data of marketData) {
            const change = data.close - data.open;
            const changePercent = (change / data.open) * 100;
            const changeEmoji = change >= 0 ? '📈' : '📉';

            message += `
${changeEmoji} **${data.symbol}**
💰 Price: ₹${data.close.toFixed(2)}
📊 Change: ${change >= 0 ? '+' : ''}₹${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)
📈 High: ₹${data.high.toFixed(2)}
📉 Low: ₹${data.low.toFixed(2)}
📊 Volume: ${data.volume?.toLocaleString() || 'N/A'}
            `.trim() + '\n\n';
        }

        message += `⏰ ${new Date().toLocaleTimeString()}`;
        await this.sendMessage(message);
    }

    async sendStrategyStatus(strategies: any[]): Promise<void> {
        if (!this.config.enabled) return;

        let message = '🤖 **STRATEGY STATUS** 🤖\n\n';

        for (const strategy of strategies) {
            const statusEmoji = strategy.isHealthy ? '🟢' : '🔴';
            const performanceEmoji = strategy.performance >= 0 ? '📈' : '📉';

            message += `
${statusEmoji} **${strategy.name}**
📊 Status: ${strategy.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}
📈 Performance: ${performanceEmoji} ₹${strategy.performance.toFixed(2)}
📊 Signals: ${strategy.signals}
❌ Errors: ${strategy.errors}
⏰ Last Execution: ${strategy.lastExecution}
            `.trim() + '\n\n';
        }

        message += `⏰ ${new Date().toLocaleTimeString()}`;
        await this.sendMessage(message);
    }

    private async sendMessage(text: string): Promise<void> {
        try {
            // Add to queue to prevent rate limiting
            this.messageQueue.push(text);

            if (!this.isProcessingQueue) {
                await this.processMessageQueue();
            }
        } catch (error) {
            logger.error('Failed to send Telegram message:', error);
        }
    }

    private async processMessageQueue(): Promise<void> {
        if (this.isProcessingQueue || this.messageQueue.length === 0) return;

        this.isProcessingQueue = true;

        try {
            while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                if (!message) continue;

                await axios.post(`${this.baseUrl}/sendMessage`, {
                    chat_id: this.config.chatId,
                    text: message,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                });

                // Rate limiting: wait 1 second between messages
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            logger.error('Failed to process message queue:', error);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    private getConfidenceBar(confidence: number): string {
        const bars = Math.round(confidence / 10);
        return '█'.repeat(bars) + '░'.repeat(10 - bars);
    }

    private getAlertEmoji(type: string): string {
        switch (type) {
            case 'INFO': return 'ℹ️';
            case 'WARNING': return '⚠️';
            case 'ERROR': return '❌';
            case 'CRITICAL': return '🚨';
            default: return '📢';
        }
    }

    private getActionRequired(type: string): string {
        switch (type) {
            case 'INFO': return 'Monitor the situation';
            case 'WARNING': return 'Review and take preventive action';
            case 'ERROR': return 'Investigate and fix the issue';
            case 'CRITICAL': return 'Immediate action required - stop trading if necessary';
            default: return 'Monitor the situation';
        }
    }

    // Utility method to send custom messages
    async sendCustomMessage(message: string): Promise<void> {
        await this.sendMessage(message);
    }

    // Method to test bot connection
    async testConnection(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.baseUrl}/getMe`);
            return response.data.ok;
        } catch (error) {
            logger.error('Telegram bot connection test failed:', error);
            return false;
        }
    }
} 