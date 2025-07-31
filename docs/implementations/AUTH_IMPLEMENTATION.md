# Authentication Implementation Guide

## Overview

The authentication system uses Zerodha's OAuth2 flow with TOTP (Time-based One-Time Password) for enhanced security.

## Implementation Details

### 1. Login Flow Implementation

```typescript
// src/auth/zerodha-auth.ts
export class ZerodhaAuth {
  async generateLoginUrl(): Promise<string> {
    const apiKey = process.env.ZERODHA_API_KEY;
    return `https://kite.zerodha.com/connect/login?api_key=${apiKey}&v=3`;
  }

  async handleLoginCallback(requestToken: string): Promise<AuthSession> {
    const session = await this.exchangeToken(requestToken);
    await this.validateAndStoreSession(session);
    return session;
  }

  private async exchangeToken(requestToken: string): Promise<AuthSession> {
    const response = await axios.post("https://api.kite.trade/session/token", {
      api_key: process.env.ZERODHA_API_KEY,
      request_token: requestToken,
      secret: process.env.ZERODHA_SECRET,
    });
    return this.parseAuthResponse(response.data);
  }
}
```

### 2. Session Management

```typescript
// src/auth/auth-manager.service.ts
export class AuthManagerService {
  private sessions: Map<string, AuthSession> = new Map();

  async createSession(userId: string, authData: AuthSession): Promise<void> {
    const session = {
      userId,
      accessToken: authData.accessToken,
      refreshToken: authData.refreshToken,
      expiresAt: Date.now() + authData.expiresIn * 1000,
    };

    await prisma.user.update({
      where: { id: userId },
      data: { sessions: { create: session } },
    });
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const session = await prisma.tradingSession.findUnique({
      where: { id: sessionId },
    });
    return session && session.expiresAt > Date.now();
  }
}
```

### 3. TOTP Implementation

```typescript
// src/auth/totp.ts
import { authenticator } from "otplib";

export class TOTPManager {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  generateQRCode(secret: string, email: string): string {
    const service = "ParadigmTrading";
    return authenticator.keyuri(email, service, secret);
  }

  verifyToken(token: string, secret: string): boolean {
    return authenticator.verify({ token, secret });
  }
}
```

### 4. API Authentication

```typescript
// src/auth/zerodha-api-auth.ts
export class ZerodhaApiAuth {
  async refreshAccessToken(refreshToken: string): Promise<AuthSession> {
    const response = await axios.post(
      "https://api.kite.trade/session/refresh_token",
      {
        api_key: process.env.ZERODHA_API_KEY,
        refresh_token: refreshToken,
      }
    );
    return this.parseAuthResponse(response.data);
  }

  generateApiSignature(requestBody: string, apiSecret: string): string {
    return crypto
      .createHmac("sha256", apiSecret)
      .update(requestBody)
      .digest("hex");
  }
}
```

### 5. Error Handling

```typescript
// src/auth/auth-error-handler.ts
export class AuthErrorHandler {
  handleLoginError(error: any): AuthError {
    if (error.response?.status === 401) {
      return {
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Invalid login credentials",
      };
    }
    // Handle other error cases
  }

  handleSessionError(error: any): AuthError {
    if (error.code === "SESSION_EXPIRED") {
      return {
        code: "AUTH_SESSION_EXPIRED",
        message: "Session has expired, please login again",
      };
    }
    // Handle other session errors
  }
}
```

## Database Schema

```prisma
// prisma/schema.prisma
model AuthSession {
  id            String   @id @default(cuid())
  userId        String
  accessToken   String
  refreshToken  String
  expiresAt     DateTime
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id])
}

model TOTPSetup {
  id            String   @id @default(cuid())
  userId        String   @unique
  secret        String
  verified      Boolean  @default(false)
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id])
}
```

## Usage Examples

### 1. Initial Login

```typescript
const auth = new ZerodhaAuth();
const loginUrl = await auth.generateLoginUrl();
// Redirect user to loginUrl
```

### 2. Login Callback

```typescript
const requestToken = req.query.request_token;
const session = await auth.handleLoginCallback(requestToken);
await authManager.createSession(userId, session);
```

### 3. TOTP Setup

```typescript
const totp = new TOTPManager();
const secret = totp.generateSecret();
const qrCode = totp.generateQRCode(secret, userEmail);
// Show QR code to user for scanning
```

### 4. API Request Authentication

```typescript
const apiAuth = new ZerodhaApiAuth();
const signature = apiAuth.generateApiSignature(requestBody, apiSecret);
const response = await axios.post(url, requestBody, {
  headers: {
    "X-Kite-Version": "3",
    Authorization: `token ${apiKey}:${signature}`,
  },
});
```

## Security Considerations

1. **Token Storage**

   - Access tokens stored encrypted
   - Refresh tokens in secure storage
   - Session data in database

2. **TOTP Security**

   - Secrets stored using encryption
   - Rate limiting on verification
   - Backup codes for recovery

3. **API Security**

   - Request signing
   - TLS for all requests
   - Token rotation

4. **Session Management**
   - Automatic expiration
   - Forced logout capability
   - Concurrent session handling

## Error Handling

1. **Login Errors**

   - Invalid credentials
   - Network issues
   - Rate limiting

2. **Session Errors**

   - Expired sessions
   - Invalid tokens
   - Concurrent login detection

3. **TOTP Errors**
   - Invalid tokens
   - Time drift issues
   - Setup failures

## Monitoring

1. **Login Attempts**

   - Success/failure tracking
   - IP address logging
   - Time-based analytics

2. **Session Activity**

   - Active session count
   - Session duration metrics
   - Geographic distribution

3. **API Usage**
   - Request volume
   - Error rates
   - Response times
