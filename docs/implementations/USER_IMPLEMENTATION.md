# User Management Implementation Guide

## Overview

The user management system handles user accounts, trading sessions, and user-specific configurations.

## Implementation Details

### 1. User Service

```typescript
// src/services/user.service.ts
export class UserService {
  async createUser(email: string, name?: string): Promise<User> {
    try {
      const user = await db.user.create({
        data: {
          email,
          name: name || null,
        },
      });

      logger.info("User created:", user.id);
      return user;
    } catch (error) {
      logger.error("Failed to create user:", error);
      throw error;
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const user = await db.user.findUnique({
        where: { id },
        include: {
          sessions: true,
        },
      });

      return user;
    } catch (error) {
      logger.error("Failed to get user:", error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await db.user.findUnique({
        where: { email },
        include: {
          sessions: true,
        },
      });

      return user;
    } catch (error) {
      logger.error("Failed to get user:", error);
      throw error;
    }
  }
}
```

### 2. Trading Session Management

```typescript
// src/services/user.service.ts
export class TradingSessionManager {
  async createTradingSession(
    userId: string,
    sessionData: Partial<TradingSession>
  ): Promise<TradingSession> {
    try {
      const session = await db.tradingSession.create({
        data: {
          userId,
          mode: sessionData.mode || "paper",
          capital: sessionData.capital || 100000,
          status: "active",
        },
      });

      logger.info("Trading session created:", session.id);
      return session;
    } catch (error) {
      logger.error("Failed to create session:", error);
      throw error;
    }
  }

  async getTradingSession(sessionId: string): Promise<TradingSession | null> {
    try {
      const session = await db.tradingSession.findUnique({
        where: { id: sessionId },
        include: {
          user: true,
          trades: true,
          positions: true,
        },
      });

      return session;
    } catch (error) {
      logger.error("Failed to get session:", error);
      throw error;
    }
  }

  async getActiveTradingSessions(userId: string): Promise<TradingSession[]> {
    try {
      const sessions = await db.tradingSession.findMany({
        where: {
          userId,
          status: "active",
        },
        include: {
          trades: true,
          positions: true,
        },
      });

      return sessions;
    } catch (error) {
      logger.error("Failed to get sessions:", error);
      throw error;
    }
  }

  async stopTradingSession(sessionId: string): Promise<TradingSession> {
    try {
      const session = await db.tradingSession.update({
        where: { id: sessionId },
        data: {
          status: "stopped",
          endTime: new Date(),
        },
      });

      logger.info("Trading session stopped:", session.id);
      return session;
    } catch (error) {
      logger.error("Failed to stop session:", error);
      throw error;
    }
  }
}
```

### 3. User Preferences

```typescript
// src/services/user-preferences.service.ts
export class UserPreferencesService {
  async updatePreferences(
    userId: string,
    preferences: UserPreferences
  ): Promise<void> {
    try {
      await db.userPreferences.upsert({
        where: { userId },
        update: preferences,
        create: {
          userId,
          ...preferences,
        },
      });

      logger.info("User preferences updated:", userId);
    } catch (error) {
      logger.error("Failed to update preferences:", error);
      throw error;
    }
  }

  async getPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const preferences = await db.userPreferences.findUnique({
        where: { userId },
      });

      return preferences;
    } catch (error) {
      logger.error("Failed to get preferences:", error);
      throw error;
    }
  }
}
```

## Database Schema

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  sessions      TradingSession[]
  preferences   UserPreferences?
  apiKeys       ApiKey[]
  alerts        Alert[]
}

model TradingSession {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  mode          String   // 'paper' or 'live'
  capital       Float
  status        String   // 'active', 'stopped'
  startTime     DateTime @default(now())
  endTime       DateTime?

  trades        Trade[]
  positions     Position[]
}

model UserPreferences {
  id            String   @id @default(cuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id])
  defaultMode   String   @default("paper")
  defaultCapital Float   @default(100000)
  riskPerTrade  Float   @default(0.02)
  maxDrawdown   Float   @default(0.10)
  notifications Boolean  @default(true)
  theme         String   @default("light")
  timezone      String   @default("UTC")
}

model ApiKey {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  name          String
  key           String   @unique
  secret        String
  permissions   String[]
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  lastUsedAt    DateTime?
}
```

## Usage Examples

### 1. User Management

```typescript
const userService = new UserService();

// Create user
const user = await userService.createUser("trader@example.com", "John Doe");

// Get user
const userById = await userService.getUserById(user.id);
const userByEmail = await userService.getUserByEmail("trader@example.com");
```

### 2. Trading Sessions

```typescript
const sessionManager = new TradingSessionManager();

// Create session
const session = await sessionManager.createTradingSession(userId, {
  mode: "paper",
  capital: 100000,
});

// Get active sessions
const activeSessions = await sessionManager.getActiveTradingSessions(userId);

// Stop session
await sessionManager.stopTradingSession(session.id);
```

### 3. User Preferences

```typescript
const preferencesService = new UserPreferencesService();

// Update preferences
await preferencesService.updatePreferences(userId, {
  defaultMode: "paper",
  defaultCapital: 100000,
  riskPerTrade: 0.02,
  maxDrawdown: 0.1,
  notifications: true,
  theme: "dark",
  timezone: "UTC",
});

// Get preferences
const preferences = await preferencesService.getPreferences(userId);
```

## Error Handling

1. **User Operations**

   - Duplicate email
   - Invalid data
   - Not found errors

2. **Session Management**

   - Invalid status
   - Concurrent sessions
   - Session conflicts

3. **Preferences**
   - Validation errors
   - Update conflicts
   - Default handling

## Performance Optimization

1. **Database Queries**

   - Indexed lookups
   - Eager loading
   - Query caching

2. **Session Management**

   - Connection pooling
   - State caching
   - Batch updates

3. **API Keys**
   - Secure storage
   - Key rotation
   - Access control

## Monitoring

1. **User Activity**

   - Login frequency
   - Session duration
   - Feature usage

2. **System Health**

   - Error rates
   - Response times
   - Resource usage

3. **Security**
   - Failed attempts
   - API usage
   - Key rotation
