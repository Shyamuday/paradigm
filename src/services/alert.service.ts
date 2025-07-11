import { PrismaClient } from '@prisma/client';
import { Alert, AlertNotification, AlertType, AlertCondition, NotificationMethod } from '../types';
import { logger } from '../logger/logger';

const prisma = new PrismaClient();

export class AlertService {
    // Alert Management
    async createAlert(userId: string, data: {
        instrumentId?: string;
        type: AlertType;
        condition: AlertCondition;
        value: number;
        message?: string;
    }): Promise<Alert> {
        try {
            const alert = await prisma.alert.create({
                data: {
                    userId,
                    ...data,
                    isActive: true,
                    isTriggered: false
                },
                include: {
                    notifications: true
                }
            });

            return alert as Alert;
        } catch (error) {
            logger.error('Error creating alert:', error);
            throw error;
        }
    }

    async updateAlert(id: string, data: Partial<Omit<Alert, 'id' | 'userId' | 'notifications' | 'createdAt'>>): Promise<Alert> {
        try {
            const alert = await prisma.alert.update({
                where: { id },
                data,
                include: {
                    notifications: true
                }
            });

            return alert as Alert;
        } catch (error) {
            logger.error('Error updating alert:', error);
            throw error;
        }
    }

    async getActiveAlerts(userId: string): Promise<Alert[]> {
        try {
            const alerts = await prisma.alert.findMany({
                where: {
                    userId,
                    isActive: true,
                    isTriggered: false
                },
                include: {
                    notifications: true
                }
            });

            return alerts as Alert[];
        } catch (error) {
            logger.error('Error fetching active alerts:', error);
            throw error;
        }
    }

    // Alert Checking
    async checkPriceAlert(instrumentId: string, currentPrice: number): Promise<Alert[]> {
        try {
            const alerts = await prisma.alert.findMany({
                where: {
                    instrumentId,
                    isActive: true,
                    isTriggered: false,
                    type: 'PRICE'
                },
                include: {
                    notifications: true
                }
            });

            const triggeredAlerts: Alert[] = [];

            for (const alert of alerts) {
                const isTriggered = this.evaluateCondition(currentPrice, alert.condition as AlertCondition, alert.value);
                if (isTriggered) {
                    await this.triggerAlert(alert.id, currentPrice);
                    triggeredAlerts.push(alert as Alert);
                }
            }

            return triggeredAlerts;
        } catch (error) {
            logger.error('Error checking price alerts:', error);
            throw error;
        }
    }

    // Alert Notification
    async createNotification(alertId: string, data: {
        method: NotificationMethod;
        destination: string;
    }): Promise<AlertNotification> {
        try {
            const notification = await prisma.alertNotification.create({
                data: {
                    alertId,
                    ...data,
                    status: 'PENDING'
                }
            });

            return notification as AlertNotification;
        } catch (error) {
            logger.error('Error creating notification:', error);
            throw error;
        }
    }

    async sendNotification(notification: AlertNotification, alert: Alert): Promise<void> {
        try {
            switch (notification.method) {
                case 'EMAIL':
                    await this.sendEmailNotification(notification.destination, alert);
                    break;
                case 'SMS':
                    await this.sendSMSNotification(notification.destination, alert);
                    break;
                case 'PUSH':
                    await this.sendPushNotification(notification.destination, alert);
                    break;
                case 'WEBHOOK':
                    await this.sendWebhookNotification(notification.destination, alert);
                    break;
            }

            await prisma.alertNotification.update({
                where: { id: notification.id },
                data: {
                    status: 'SENT',
                    sentAt: new Date()
                }
            });
        } catch (error) {
            logger.error('Error sending notification:', error);
            await prisma.alertNotification.update({
                where: { id: notification.id },
                data: {
                    status: 'FAILED'
                }
            });
            throw error;
        }
    }

    // Helper Methods
    private async triggerAlert(alertId: string, currentValue: number): Promise<void> {
        try {
            await prisma.alert.update({
                where: { id: alertId },
                data: {
                    isTriggered: true,
                    triggeredAt: new Date(),
                    currentValue
                }
            });
        } catch (error) {
            logger.error('Error triggering alert:', error);
            throw error;
        }
    }

    private evaluateCondition(currentValue: number, condition: AlertCondition, targetValue: number): boolean {
        switch (condition) {
            case 'ABOVE':
                return currentValue > targetValue;
            case 'BELOW':
                return currentValue < targetValue;
            case 'EQUALS':
                return Math.abs(currentValue - targetValue) < 0.0001; // For floating point comparison
            case 'CROSSES_ABOVE':
                // This would need historical data to determine crossing
                return currentValue > targetValue;
            case 'CROSSES_BELOW':
                // This would need historical data to determine crossing
                return currentValue < targetValue;
            default:
                return false;
        }
    }

    // Notification Methods (to be implemented based on your notification providers)
    private async sendEmailNotification(destination: string, alert: Alert): Promise<void> {
        // Implement email notification using your email service provider
        logger.info(`Sending email notification to ${destination} for alert ${alert.id}`);
    }

    private async sendSMSNotification(destination: string, alert: Alert): Promise<void> {
        // Implement SMS notification using your SMS service provider
        logger.info(`Sending SMS notification to ${destination} for alert ${alert.id}`);
    }

    private async sendPushNotification(destination: string, alert: Alert): Promise<void> {
        // Implement push notification using your push notification service
        logger.info(`Sending push notification to ${destination} for alert ${alert.id}`);
    }

    private async sendWebhookNotification(destination: string, alert: Alert): Promise<void> {
        // Implement webhook notification
        logger.info(`Sending webhook notification to ${destination} for alert ${alert.id}`);
    }
} 