# Monitoring and Alerts Implementation Guide

## Overview

The monitoring system handles API usage tracking, system alerts, and performance monitoring across all components.

## Implementation Details

### 1. API Monitoring Service

```typescript
// src/services/api-monitor.service.ts
export class ApiMonitorService {
  private quotaManager: QuotaManager;
  private errorTracker: ErrorTracker;

  async trackApiCall(
    userId: string,
    endpoint: string,
    method: string
  ): Promise<void> {
    const startTime = Date.now();

    try {
      await this.checkQuota(userId, endpoint);
      await this.updateUsage(userId, endpoint, method);

      const responseTime = Date.now() - startTime;
      await this.updateMetrics(userId, endpoint, responseTime);
    } catch (error) {
      await this.handleApiError(userId, endpoint, error);
      throw error;
    }
  }

  private async updateUsage(
    userId: string,
    endpoint: string,
    method: string
  ): Promise<void> {
    const date = new Date();
    const hour = date.getHours();

    await prisma.apiUsage.upsert({
      where: {
        userId_endpoint_method_date_hour: {
          userId,
          endpoint,
          method,
          date,
          hour,
        },
      },
      update: {
        requestCount: { increment: 1 },
      },
      create: {
        userId,
        endpoint,
        method,
        date,
        hour,
        requestCount: 1,
      },
    });
  }
}
```

### 2. Quota Management

```typescript
// src/services/quota-manager.ts
export class QuotaManager {
  async checkQuota(userId: string, endpoint: string): Promise<boolean> {
    const quota = await prisma.apiQuota.findUnique({
      where: {
        userId_endpoint: { userId, endpoint },
      },
    });

    if (!quota) return true;

    if (quota.currentUsage >= quota.dailyLimit) {
      await this.handleQuotaExceeded(quota);
      return false;
    }

    return true;
  }

  private async handleQuotaExceeded(quota: ApiQuota): Promise<void> {
    await prisma.apiQuota.update({
      where: { id: quota.id },
      data: {
        isExceeded: true,
        resetTime: this.getNextResetTime(),
      },
    });

    await this.alertService.createAlert({
      userId: quota.userId,
      type: "API_QUOTA",
      message: `API quota exceeded for ${quota.endpoint}`,
    });
  }
}
```

### 3. Error Tracking

```typescript
// src/services/error-tracker.ts
export class ErrorTracker {
  async trackError(
    userId: string,
    endpoint: string,
    error: any
  ): Promise<void> {
    await prisma.apiError.create({
      data: {
        userId,
        endpoint,
        errorCode: error.code || "UNKNOWN",
        errorMessage: error.message,
        requestData: error.requestData,
        responseData: error.responseData,
      },
    });

    if (this.isAlertableError(error)) {
      await this.alertService.createAlert({
        userId,
        type: "API_ERROR",
        message: `API error: ${error.message}`,
      });
    }
  }

  private isAlertableError(error: any): boolean {
    return (
      error.code === "AUTH_FAILED" ||
      error.code === "RATE_LIMIT" ||
      error.code === "SYSTEM_ERROR"
    );
  }
}
```

### 4. Alert System

```typescript
// src/services/alert.service.ts
export class AlertService {
  async createAlert(data: AlertData): Promise<Alert> {
    const alert = await prisma.alert.create({
      data: {
        userId: data.userId,
        instrumentId: data.instrumentId,
        type: data.type,
        condition: data.condition,
        value: data.value,
        message: data.message,
        isActive: true,
      },
    });

    await this.sendNotifications(alert);
    return alert;
  }

  async sendNotifications(alert: Alert): Promise<void> {
    const notifications = await this.getNotificationSettings(alert.userId);

    for (const notification of notifications) {
      await prisma.alertNotification.create({
        data: {
          alertId: alert.id,
          method: notification.method,
          destination: notification.destination,
          status: "PENDING",
        },
      });
    }

    await this.processNotificationQueue();
  }
}
```

### 5. System Logging

```typescript
// src/services/system-logger.ts
export class SystemLogger {
  async logSystemEvent(data: SystemLogData): Promise<void> {
    await prisma.systemLog.create({
      data: {
        level: data.level,
        category: data.category,
        message: data.message,
        data: data.additionalData,
      },
    });

    if (data.level === "ERROR") {
      await this.handleErrorEvent(data);
    }
  }

  private async handleErrorEvent(data: SystemLogData): Promise<void> {
    if (this.isSystemCritical(data)) {
      await this.alertService.createAlert({
        type: "SYSTEM_ERROR",
        message: `Critical system error: ${data.message}`,
      });
    }
  }
}
```

## Database Schema

```prisma
model ApiUsage {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  endpoint      String
  method        String
  requestCount  Int      @default(0)
  errorCount    Int      @default(0)
  avgResponseTime Float?
  date          DateTime @db.Date
  hour          Int

  @@unique([userId, endpoint, method, date, hour])
}

model ApiQuota {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  endpoint      String
  dailyLimit    Int
  currentUsage  Int      @default(0)
  resetTime     DateTime
  isExceeded    Boolean  @default(false)

  @@unique([userId, endpoint])
}

model Alert {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  instrumentId String?
  instrument   Instrument? @relation(fields: [instrumentId], references: [id])
  type         String
  condition    String
  value        Float
  message      String?
  isActive     Boolean  @default(true)
  isTriggered  Boolean  @default(false)
  triggeredAt  DateTime?
  createdAt    DateTime @default(now())

  notifications AlertNotification[]
}
```

## Usage Examples

### 1. API Monitoring

```typescript
const apiMonitor = new ApiMonitorService();

// Track API call
await apiMonitor.trackApiCall(userId, "/api/market-data", "GET");

// Check quota
const hasQuota = await quotaManager.checkQuota(userId, "market-data");
```

### 2. Alert Creation

```typescript
const alertService = new AlertService();

// Create price alert
await alertService.createAlert({
  userId: "user123",
  instrumentId: "NIFTY50",
  type: "PRICE",
  condition: "ABOVE",
  value: 21500,
  message: "NIFTY50 above 21500",
});

// Create risk alert
await alertService.createAlert({
  userId: "user123",
  type: "RISK",
  condition: "ABOVE",
  value: 5000,
  message: "Daily loss limit reached",
});
```

### 3. System Logging

```typescript
const logger = new SystemLogger();

// Log system event
await logger.logSystemEvent({
  level: "ERROR",
  category: "MARKET_DATA",
  message: "Feed disconnected",
  additionalData: { lastUpdate: new Date() },
});
```

## Error Handling

1. **API Errors**

   - Rate limiting
   - Authentication failures
   - Network issues

2. **Quota Errors**

   - Limit exceeded
   - Reset handling
   - Grace period

3. **Alert Errors**
   - Delivery failures
   - Invalid conditions
   - Trigger failures

## Performance Optimization

1. **API Monitoring**

   - Batch updates
   - Cached quotas
   - Efficient tracking

2. **Alert Processing**

   - Queue management
   - Batch notifications
   - Priority handling

3. **System Logging**
   - Log rotation
   - Compression
   - Archival

## Monitoring

1. **API Usage**

   - Request volume
   - Error rates
   - Response times

2. **Alert System**

   - Trigger rates
   - Delivery success
   - Processing time

3. **System Health**
   - Resource usage
   - Error frequency
   - Service status
