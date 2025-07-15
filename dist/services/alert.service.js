"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertService = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../logger/logger");
const prisma = new client_1.PrismaClient();
class AlertService {
    async createAlert(userId, data) {
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
            return alert;
        }
        catch (error) {
            logger_1.logger.error('Error creating alert:', error);
            throw error;
        }
    }
    async updateAlert(id, data) {
        try {
            const alert = await prisma.alert.update({
                where: { id },
                data,
                include: {
                    notifications: true
                }
            });
            return alert;
        }
        catch (error) {
            logger_1.logger.error('Error updating alert:', error);
            throw error;
        }
    }
    async getActiveAlerts(userId) {
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
            return alerts;
        }
        catch (error) {
            logger_1.logger.error('Error fetching active alerts:', error);
            throw error;
        }
    }
    async checkPriceAlert(instrumentId, currentPrice) {
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
            const triggeredAlerts = [];
            for (const alert of alerts) {
                const isTriggered = this.evaluateCondition(currentPrice, alert.condition, alert.value);
                if (isTriggered) {
                    await this.triggerAlert(alert.id, currentPrice);
                    triggeredAlerts.push(alert);
                }
            }
            return triggeredAlerts;
        }
        catch (error) {
            logger_1.logger.error('Error checking price alerts:', error);
            throw error;
        }
    }
    async createNotification(alertId, data) {
        try {
            const notification = await prisma.alertNotification.create({
                data: {
                    alertId,
                    ...data,
                    status: 'PENDING'
                }
            });
            return notification;
        }
        catch (error) {
            logger_1.logger.error('Error creating notification:', error);
            throw error;
        }
    }
    async sendNotification(notification, alert) {
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
        }
        catch (error) {
            logger_1.logger.error('Error sending notification:', error);
            await prisma.alertNotification.update({
                where: { id: notification.id },
                data: {
                    status: 'FAILED'
                }
            });
            throw error;
        }
    }
    async triggerAlert(alertId, currentValue) {
        try {
            await prisma.alert.update({
                where: { id: alertId },
                data: {
                    isTriggered: true,
                    triggeredAt: new Date(),
                    currentValue
                }
            });
        }
        catch (error) {
            logger_1.logger.error('Error triggering alert:', error);
            throw error;
        }
    }
    evaluateCondition(currentValue, condition, targetValue) {
        switch (condition) {
            case 'ABOVE':
                return currentValue > targetValue;
            case 'BELOW':
                return currentValue < targetValue;
            case 'EQUALS':
                return Math.abs(currentValue - targetValue) < 0.0001;
            case 'CROSSES_ABOVE':
                return currentValue > targetValue;
            case 'CROSSES_BELOW':
                return currentValue < targetValue;
            default:
                return false;
        }
    }
    async sendEmailNotification(destination, alert) {
        logger_1.logger.info(`Sending email notification to ${destination} for alert ${alert.id}`);
    }
    async sendSMSNotification(destination, alert) {
        logger_1.logger.info(`Sending SMS notification to ${destination} for alert ${alert.id}`);
    }
    async sendPushNotification(destination, alert) {
        logger_1.logger.info(`Sending push notification to ${destination} for alert ${alert.id}`);
    }
    async sendWebhookNotification(destination, alert) {
        logger_1.logger.info(`Sending webhook notification to ${destination} for alert ${alert.id}`);
    }
}
exports.AlertService = AlertService;
//# sourceMappingURL=alert.service.js.map