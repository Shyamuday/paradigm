import { Alert, AlertNotification, AlertType, AlertCondition, NotificationMethod } from '../types';
export declare class AlertService {
    createAlert(userId: string, data: {
        instrumentId?: string;
        type: AlertType;
        condition: AlertCondition;
        value: number;
        message?: string;
    }): Promise<Alert>;
    updateAlert(id: string, data: Partial<Omit<Alert, 'id' | 'userId' | 'notifications' | 'createdAt'>>): Promise<Alert>;
    getActiveAlerts(userId: string): Promise<Alert[]>;
    checkPriceAlert(instrumentId: string, currentPrice: number): Promise<Alert[]>;
    createNotification(alertId: string, data: {
        method: NotificationMethod;
        destination: string;
    }): Promise<AlertNotification>;
    sendNotification(notification: AlertNotification, alert: Alert): Promise<void>;
    private triggerAlert;
    private evaluateCondition;
    private sendEmailNotification;
    private sendSMSNotification;
    private sendPushNotification;
    private sendWebhookNotification;
}
//# sourceMappingURL=alert.service.d.ts.map