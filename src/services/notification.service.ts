import { logger } from '../logger/logger';
import { EventEmitter } from 'events';

export interface NotificationConfig {
  email?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  slack?: {
    webhookUrl: string;
    channel: string;
  };
  telegram?: {
    botToken: string;
    chatId: string;
  };
  discord?: {
    webhookUrl: string;
  };
}

export interface NotificationMessage {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  timestamp: Date;
  metadata?: Record<string, any>;
  channels?: string[];
}

export interface NotificationTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
}

export class NotificationService extends EventEmitter {
  private config: NotificationConfig;
  private templates: Map<string, NotificationTemplate> = new Map();
  private isEnabled = false;

  constructor(config: NotificationConfig = {}) {
    super();
    this.config = config;
    this.setupDefaultTemplates();
  }

  /**
   * Enable/disable notifications
   */
  enable(): void {
    this.isEnabled = true;
    logger.info('Notification service enabled');
  }

  disable(): void {
    this.isEnabled = false;
    logger.info('Notification service disabled');
  }

  /**
   * Send a notification
   */
  async send(notification: NotificationMessage): Promise<void> {
    if (!this.isEnabled) {
      logger.debug('Notifications disabled, skipping', { title: notification.title });
      return;
    }

    try {
      const channels = notification.channels || ['email', 'slack'];
      const promises: Promise<void>[] = [];

      for (const channel of channels) {
        switch (channel) {
          case 'email':
            if (this.config.email) {
              promises.push(this.sendEmail(notification));
            }
            break;
          case 'slack':
            if (this.config.slack) {
              promises.push(this.sendSlack(notification));
            }
            break;
          case 'telegram':
            if (this.config.telegram) {
              promises.push(this.sendTelegram(notification));
            }
            break;
          case 'discord':
            if (this.config.discord) {
              promises.push(this.sendDiscord(notification));
            }
            break;
        }
      }

      await Promise.allSettled(promises);

      this.emit('notification:sent', notification);
      logger.info('Notification sent', {
        title: notification.title,
        channels: notification.channels
      });

    } catch (error) {
      logger.error('Failed to send notification', {
        title: notification.title,
        error
      });
      this.emit('notification:error', notification, error);
    }
  }

  /**
   * Send trading-specific notifications
   */
  async sendTradeNotification(signal: any, action: string): Promise<void> {
    const notification: NotificationMessage = {
      title: `Trade ${action}: ${signal.symbol}`,
      message: this.renderTemplate('trade_notification', {
        symbol: signal.symbol,
        action: action,
        price: signal.price,
        quantity: signal.quantity,
        timestamp: new Date().toISOString()
      }),
      level: 'info',
      timestamp: new Date(),
      metadata: { signal, action },
      channels: ['slack', 'email']
    };

    await this.send(notification);
  }

  async sendPerformanceAlert(alert: any): Promise<void> {
    const notification: NotificationMessage = {
      title: `Performance Alert: ${alert.level.toUpperCase()}`,
      message: this.renderTemplate('performance_alert', {
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        message: alert.message
      }),
      level: alert.level === 'critical' ? 'critical' : 'warning',
      timestamp: new Date(),
      metadata: alert,
      channels: ['slack', 'email']
    };

    await this.send(notification);
  }

  async sendRiskAlert(riskData: any): Promise<void> {
    const notification: NotificationMessage = {
      title: 'Risk Alert: Portfolio Risk Exceeded',
      message: this.renderTemplate('risk_alert', {
        drawdown: riskData.maxDrawdown,
        dailyPnL: riskData.dailyPnL,
        portfolioValue: riskData.portfolioValue,
        openPositions: riskData.openPositions
      }),
      level: 'warning',
      timestamp: new Date(),
      metadata: riskData,
      channels: ['slack', 'email', 'telegram']
    };

    await this.send(notification);
  }

  async sendSystemAlert(alert: any): Promise<void> {
    const notification: NotificationMessage = {
      title: `System Alert: ${alert.type}`,
      message: this.renderTemplate('system_alert', {
        type: alert.type,
        message: alert.message,
        severity: alert.severity
      }),
      level: alert.severity === 'critical' ? 'critical' : 'warning',
      timestamp: new Date(),
      metadata: alert,
      channels: ['slack', 'email']
    };

    await this.send(notification);
  }

  /**
   * Add notification template
   */
  addTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
    logger.debug('Notification template added', { id: template.id });
  }

  /**
   * Render template with variables
   */
  private renderTemplate(templateId: string, variables: Record<string, any>): string {
    const template = this.templates.get(templateId);
    if (!template) {
      return `Template not found: ${templateId}`;
    }

    let message = template.template;
    for (const [key, value] of Object.entries(variables)) {
      message = message.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    return message;
  }

  /**
   * Send email notification
   */
  private async sendEmail(notification: NotificationMessage): Promise<void> {
    try {
      // This would use nodemailer or similar email library
      logger.debug('Email notification would be sent', {
        to: this.config.email?.auth.user,
        subject: notification.title,
        level: notification.level
      });

      // Placeholder for email sending logic
      // const transporter = nodemailer.createTransporter(this.config.email);
      // await transporter.sendMail({
      //   from: this.config.email.auth.user,
      //   to: this.config.email.auth.user,
      //   subject: notification.title,
      //   text: notification.message
      // });

    } catch (error) {
      logger.error('Failed to send email notification', error);
      throw error;
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(notification: NotificationMessage): Promise<void> {
    try {
      const color = this.getColorForLevel(notification.level);
      const payload = {
        channel: this.config.slack?.channel,
        attachments: [{
          color,
          title: notification.title,
          text: notification.message,
          fields: this.formatMetadata(notification.metadata),
          footer: 'Paradigm Trading Bot',
          ts: Math.floor(notification.timestamp.getTime() / 1000)
        }]
      };

      // This would use axios or similar HTTP client
      logger.debug('Slack notification would be sent', {
        channel: this.config.slack?.channel,
        title: notification.title,
        level: notification.level
      });

      // Placeholder for Slack webhook call
      // await axios.post(this.config.slack.webhookUrl, payload);

    } catch (error) {
      logger.error('Failed to send Slack notification', error);
      throw error;
    }
  }

  /**
   * Send Telegram notification
   */
  private async sendTelegram(notification: NotificationMessage): Promise<void> {
    try {
      const message = `*${notification.title}*\n\n${notification.message}`;

      // This would use telegram bot API
      logger.debug('Telegram notification would be sent', {
        chatId: this.config.telegram?.chatId,
        title: notification.title,
        level: notification.level
      });

      // Placeholder for Telegram bot API call
      // const url = `https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`;
      // await axios.post(url, {
      //   chat_id: this.config.telegram.chatId,
      //   text: message,
      //   parse_mode: 'Markdown'
      // });

    } catch (error) {
      logger.error('Failed to send Telegram notification', error);
      throw error;
    }
  }

  /**
   * Send Discord notification
   */
  private async sendDiscord(notification: NotificationMessage): Promise<void> {
    try {
      const color = this.getDiscordColorForLevel(notification.level);
      const payload = {
        embeds: [{
          title: notification.title,
          description: notification.message,
          color,
          fields: this.formatDiscordFields(notification.metadata),
          footer: {
            text: 'Paradigm Trading Bot'
          },
          timestamp: notification.timestamp.toISOString()
        }]
      };

      // This would use axios or similar HTTP client
      logger.debug('Discord notification would be sent', {
        title: notification.title,
        level: notification.level
      });

      // Placeholder for Discord webhook call
      // await axios.post(this.config.discord.webhookUrl, payload);

    } catch (error) {
      logger.error('Failed to send Discord notification', error);
      throw error;
    }
  }

  /**
   * Get color for notification level
   */
  private getColorForLevel(level: string): string {
    switch (level) {
      case 'info': return '#36a64f';
      case 'warning': return '#ffa500';
      case 'error': return '#ff0000';
      case 'critical': return '#8b0000';
      default: return '#000000';
    }
  }

  /**
   * Get Discord color for notification level
   */
  private getDiscordColorForLevel(level: string): number {
    switch (level) {
      case 'info': return 0x36a64f;
      case 'warning': return 0xffa500;
      case 'error': return 0xff0000;
      case 'critical': return 0x8b0000;
      default: return 0x000000;
    }
  }

  /**
   * Format metadata for Slack
   */
  private formatMetadata(metadata?: Record<string, any>): any[] {
    if (!metadata) return [];

    return Object.entries(metadata).map(([key, value]) => ({
      title: key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      short: true
    }));
  }

  /**
   * Format fields for Discord
   */
  private formatDiscordFields(metadata?: Record<string, any>): any[] {
    if (!metadata) return [];

    return Object.entries(metadata).map(([key, value]) => ({
      name: key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      inline: true
    }));
  }

  /**
   * Setup default notification templates
   */
  private setupDefaultTemplates(): void {
    const templates: NotificationTemplate[] = [
      {
        id: 'trade_notification',
        name: 'Trade Notification',
        template: 'Symbol: {{symbol}}\nAction: {{action}}\nPrice: {{price}}\nQuantity: {{quantity}}\nTime: {{timestamp}}',
        variables: ['symbol', 'action', 'price', 'quantity', 'timestamp']
      },
      {
        id: 'performance_alert',
        name: 'Performance Alert',
        template: 'Metric: {{metric}}\nValue: {{value}}\nThreshold: {{threshold}}\nMessage: {{message}}',
        variables: ['metric', 'value', 'threshold', 'message']
      },
      {
        id: 'risk_alert',
        name: 'Risk Alert',
        template: 'Max Drawdown: {{drawdown}}\nDaily P&L: {{dailyPnL}}\nPortfolio Value: {{portfolioValue}}\nOpen Positions: {{openPositions}}',
        variables: ['drawdown', 'dailyPnL', 'portfolioValue', 'openPositions']
      },
      {
        id: 'system_alert',
        name: 'System Alert',
        template: 'Type: {{type}}\nSeverity: {{severity}}\nMessage: {{message}}',
        variables: ['type', 'severity', 'message']
      }
    ];

    templates.forEach(template => this.addTemplate(template));
  }

  /**
   * Get notification service status
   */
  getStatus(): {
    enabled: boolean;
    config: Partial<NotificationConfig>;
    templates: string[];
  } {
    const config: Partial<NotificationConfig> = {};
    if (this.config.email) config.email = this.config.email;
    if (this.config.slack) config.slack = this.config.slack;
    if (this.config.telegram) config.telegram = this.config.telegram;
    if (this.config.discord) config.discord = this.config.discord;
    return {
      enabled: this.isEnabled,
      config,
      templates: Array.from(this.templates.keys())
    };
  }
}

// Export singleton instance
export const notificationService = new NotificationService(); 