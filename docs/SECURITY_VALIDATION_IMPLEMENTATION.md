# Security Validation Implementation

## Overview

The security validation system provides comprehensive input validation, authentication, authorization, and security monitoring for the Paradigm Trading System. It ensures data integrity, prevents security vulnerabilities, and maintains compliance with security best practices.

## Features

### 🔒 **Core Security Features**
- **Input Validation**: Comprehensive validation for all data types
- **Authentication**: JWT token validation and session management
- **Authorization**: Role-based access control and permission checking
- **Rate Limiting**: Protection against abuse and DDoS attacks
- **Input Sanitization**: XSS and injection attack prevention
- **Data Encryption**: Sensitive data encryption and decryption
- **Audit Logging**: Comprehensive security event tracking

### 🛡️ **Security Levels**
- **LOW**: Basic validation, minimal security risk
- **MEDIUM**: Standard validation, moderate security risk
- **HIGH**: Strict validation, high security risk
- **CRITICAL**: Maximum validation, critical security risk

### 📊 **Monitoring & Compliance**
- **Real-time Validation**: Immediate security checks
- **Security Statistics**: Comprehensive security metrics
- **Audit Trail**: Complete event logging and tracking
- **Compliance Reporting**: Security compliance documentation
- **Event Emission**: Real-time security event notifications

## Architecture

### Security Validation Flow

```
Input → Validation → Sanitization → Encryption → Storage
  ↓
Security Check → Authorization → Rate Limit → Audit Log
```

### Validation Types

1. **INPUT**: Data format and content validation
2. **AUTHENTICATION**: User identity verification
3. **AUTHORIZATION**: Permission and access control
4. **RATE_LIMIT**: Request frequency control
5. **SANITIZATION**: Data cleaning and normalization
6. **ENCRYPTION**: Data protection and security

## Quick Start

### Basic Input Validation

```typescript
import { securityValidator, validateTradingInput } from '../utils/security-validator';

// Validate trading symbol
const result = validateTradingInput('NIFTY');
if (!result.isValid) {
  console.log('Validation errors:', result.errors);
}

// Validate email
const emailResult = securityValidator.validateInput('user@example.com', 'email');
if (emailResult.isValid) {
  console.log('Email is valid');
}
```

### Password Validation

```typescript
import { validatePassword } from '../utils/security-validator';

const password = 'MySecurePassword123!';
const result = validatePassword(password);

if (result.isValid) {
  console.log('Password meets security requirements');
} else {
  console.log('Password issues:', result.errors);
}
```

### Express Integration

```typescript
import { securityMiddleware, tradingValidationMiddleware } from '../middleware/security-validation';

// Apply security middleware to all routes
app.use(securityMiddleware({
  enableInputValidation: true,
  enableAuthentication: true,
  enableRateLimit: true,
  enableSecurityHeaders: true
}));

// Apply trading-specific validation
app.post('/api/trades', tradingValidationMiddleware, (req, res) => {
  // Handle trading request
});
```

## Configuration

### Security Configuration

```typescript
interface SecurityConfig {
  maxRequestSize: number;           // Maximum request size in bytes
  allowedOrigins: string[];         // CORS allowed origins
  rateLimitWindow: number;          // Rate limit window in ms
  rateLimitMax: number;             // Maximum requests per window
  sessionTimeout: number;           // Session timeout in ms
  passwordMinLength: number;        // Minimum password length
  requireSpecialChars: boolean;     // Require special characters
  requireNumbers: boolean;          // Require numbers in password
  requireUppercase: boolean;        // Require uppercase letters
  maxLoginAttempts: number;         // Max failed login attempts
  lockoutDuration: number;          // Account lockout duration
  enableAuditLog: boolean;          // Enable audit logging
  enableEncryption: boolean;        // Enable data encryption
  encryptionKey?: string;           // Encryption key
}
```

### Default Configuration

```typescript
const DEFAULT_SECURITY_CONFIG = {
  maxRequestSize: 1024 * 1024,      // 1MB
  allowedOrigins: ['http://localhost:3000'],
  rateLimitWindow: 15 * 60 * 1000,  // 15 minutes
  rateLimitMax: 100,                // 100 requests per window
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  passwordMinLength: 8,
  requireSpecialChars: true,
  requireNumbers: true,
  requireUppercase: true,
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000,  // 15 minutes
  enableAuditLog: true,
  enableEncryption: true
};
```

## Validation Rules

### Pre-configured Rules

#### Email Validation
```typescript
{
  type: 'email',
  required: true,
  sanitize: true
}
```

#### Password Validation
```typescript
{
  type: 'string',
  required: true,
  minLength: 8,
  customValidator: (value: string) => validatePasswordStrength(value)
}
```

#### Trading Symbol Validation
```typescript
{
  type: 'string',
  required: true,
  pattern: /^[A-Z]{1,20}$/,
  sanitize: true
}
```

#### Quantity Validation
```typescript
{
  type: 'number',
  required: true,
  min: 1,
  max: 1000000
}
```

#### Price Validation
```typescript
{
  type: 'number',
  required: true,
  min: 0.01,
  max: 1000000
}
```

### Custom Validation Rules

```typescript
// Add custom validation rule
securityValidator.addValidationRule('customField', {
  type: 'string',
  required: true,
  minLength: 3,
  maxLength: 50,
  pattern: /^[a-zA-Z0-9_]+$/,
  sanitize: true,
  customValidator: (value: string) => {
    // Custom validation logic
    if (value.includes('admin')) {
      return 'Value cannot contain "admin"';
    }
    return true;
  }
});

// Use custom rule
const result = securityValidator.validateInput('test123', 'customField');
```

## Integration Patterns

### 1. Trading Order Validation

```typescript
import { tradingValidationMiddleware } from '../middleware/security-validation';

class TradingService {
  async placeOrder(orderData: any): Promise<any> {
    // Validate order data
    const symbolResult = validateTradingInput(orderData.symbol);
    const quantityResult = securityValidator.validateInput(orderData.quantity, 'quantity');
    const priceResult = securityValidator.validateInput(orderData.price, 'price');
    const orderTypeResult = validateOrderInput(orderData.orderType);

    // Check all validations
    const allValidations = [symbolResult, quantityResult, priceResult, orderTypeResult];
    const isValid = allValidations.every(v => v.isValid);
    const errors = allValidations.flatMap(v => v.errors);

    if (!isValid) {
      throw new Error(`Order validation failed: ${errors.join(', ')}`);
    }

    // Process order
    return await this.processOrder(orderData);
  }
}
```

### 2. User Registration Validation

```typescript
import { userRegistrationMiddleware } from '../middleware/security-validation';

class UserService {
  async registerUser(userData: any): Promise<any> {
    // Validate user data
    const emailResult = validateUserInput(userData.email);
    const passwordResult = validatePassword(userData.password);
    const usernameResult = securityValidator.validateInput(userData.username, 'username');

    // Check validations
    const allValidations = [emailResult, passwordResult, usernameResult];
    const isValid = allValidations.every(v => v.isValid);
    const errors = allValidations.flatMap(v => v.errors);

    if (!isValid) {
      throw new Error(`Registration validation failed: ${errors.join(', ')}`);
    }

    // Hash password
    const hashedPassword = hashPassword(userData.password);

    // Create user
    return await this.createUser({
      ...userData,
      password: hashedPassword
    });
  }
}
```

### 3. API Authentication

```typescript
import { authenticationMiddleware } from '../middleware/security-validation';

// Protected route with authentication
app.get('/api/trades', 
  authenticationMiddleware({ requireAuth: true }),
  (req, res) => {
    // Handle authenticated request
    res.json({ trades: [] });
  }
);

// Admin route with role-based access
app.delete('/api/users/:id',
  authenticationMiddleware({ 
    requireAuth: true, 
    roles: ['admin'] 
  }),
  (req, res) => {
    // Handle admin request
    res.json({ message: 'User deleted' });
  }
);
```

### 4. Rate Limiting

```typescript
import { rateLimitMiddleware } from '../middleware/security-validation';

// Apply rate limiting to specific routes
app.post('/api/trades',
  rateLimitMiddleware({ 
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50 // 50 requests per window
  }),
  (req, res) => {
    // Handle trading request
  }
);

// Custom rate limiting key
app.get('/api/market-data',
  rateLimitMiddleware({
    keyGenerator: (req) => `${req.ip}_${req.headers['user-agent']}`
  }),
  (req, res) => {
    // Handle market data request
  }
);
```

## Security Headers

### Automatic Security Headers

The security middleware automatically sets the following headers:

```typescript
// Security headers set by middleware
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('X-Frame-Options', 'DENY');
res.setHeader('X-XSS-Protection', '1; mode=block');
res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'");
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
```

### Custom Security Headers

```typescript
import { securityHeadersMiddleware } from '../middleware/security-validation';

// Apply security headers to all routes
app.use(securityHeadersMiddleware);

// Or apply to specific routes
app.get('/api/sensitive-data', securityHeadersMiddleware, (req, res) => {
  // Handle sensitive data request
});
```

## Monitoring & Auditing

### Audit Logging

```typescript
import { auditLogMiddleware } from '../middleware/security-validation';

// Enable audit logging
app.use(auditLogMiddleware);

// Get audit log
const auditLog = securityValidator.getAuditLog(100);
console.log('Recent security events:', auditLog);
```

### Security Statistics

```typescript
// Get security statistics
const stats = securityValidator.getSecurityStats();
console.log('Security statistics:', {
  totalValidations: stats.totalValidations,
  failedValidations: stats.failedValidations,
  securityLevels: stats.securityLevels,
  rateLimitBlocks: stats.rateLimitBlocks,
  loginLockouts: stats.loginLockouts
});
```

### Event Monitoring

```typescript
// Listen for security events
securityValidator.on('validation', (event) => {
  console.log('Validation event:', {
    type: event.type,
    ruleName: event.ruleName,
    isValid: event.result.isValid,
    securityLevel: event.result.securityLevel
  });
});

securityValidator.on('securityEvent', (event) => {
  console.log('Security event:', {
    type: event.type,
    identifier: event.identifier,
    context: event.context
  });
});
```

## Security Utilities

### Password Hashing

```typescript
import { hashPassword } from '../utils/security-validator';

const password = 'MySecurePassword123!';
const hashedPassword = hashPassword(password);

// Store hashed password in database
await userRepository.create({
  email: 'user@example.com',
  password: hashedPassword
});
```

### Token Generation

```typescript
import { generateSecureToken, generateApiKey } from '../utils/security-validator';

// Generate secure token for sessions
const sessionToken = generateSecureToken();

// Generate API key for external access
const apiKey = generateApiKey();

console.log('Generated tokens:', {
  sessionToken: sessionToken.substring(0, 20) + '...',
  apiKey: apiKey.substring(0, 10) + '...'
});
```

### Data Encryption

```typescript
// Encrypt sensitive data
const sensitiveData = 'sensitive_trading_data';
const encrypted = securityValidator['encryptData'](sensitiveData);

// Decrypt data when needed
const decrypted = securityValidator.decryptData(encrypted);
console.log('Decrypted data:', decrypted);
```

## Best Practices

### 1. Input Validation

```typescript
// Always validate user input
const validateUserInput = (data: any) => {
  const validations = [
    securityValidator.validateInput(data.email, 'email'),
    securityValidator.validateInput(data.username, 'username'),
    validatePassword(data.password)
  ];

  const isValid = validations.every(v => v.isValid);
  const errors = validations.flatMap(v => v.errors);

  return { isValid, errors };
};
```

### 2. Authentication

```typescript
// Validate authentication tokens
const validateAuth = (token: string) => {
  const result = securityValidator.validateAuthentication(token);
  
  if (!result.isValid) {
    throw new Error('Authentication failed');
  }
  
  return result;
};
```

### 3. Authorization

```typescript
// Check user permissions
const checkPermission = (userId: string, resource: string, action: string) => {
  const result = securityValidator.validateAuthorization(userId, resource, action);
  
  if (!result.isValid) {
    throw new Error('Insufficient permissions');
  }
  
  return result;
};
```

### 4. Rate Limiting

```typescript
// Apply rate limiting to prevent abuse
const checkRateLimit = (clientId: string) => {
  const result = securityValidator.checkRateLimit(clientId);
  
  if (!result.isValid) {
    throw new Error('Rate limit exceeded');
  }
  
  return result;
};
```

### 5. Security Monitoring

```typescript
// Monitor security events
const setupSecurityMonitoring = () => {
  securityValidator.on('validation', (event) => {
    if (event.result.securityLevel === SecurityLevel.CRITICAL) {
      // Send alert to security team
      alertSecurityTeam(event);
    }
  });

  securityValidator.on('securityEvent', (event) => {
    if (event.type === 'failedLogin') {
      // Log failed login attempt
      logFailedLogin(event);
    }
  });
};
```

## Testing

### Unit Tests

```typescript
import { SecurityValidator } from '../utils/security-validator';

describe('Security Validator', () => {
  let validator: SecurityValidator;

  beforeEach(() => {
    validator = new SecurityValidator();
  });

  it('should validate email correctly', () => {
    const result = validator.validateInput('test@example.com', 'email');
    expect(result.isValid).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = validator.validateInput('invalid-email', 'email');
    expect(result.isValid).toBe(false);
  });
});
```

### Integration Tests

```typescript
import { securityMiddleware } from '../middleware/security-validation';

describe('Security Middleware', () => {
  it('should block suspicious requests', async () => {
    const response = await request(app)
      .post('/api/trades')
      .send({
        symbol: '<script>alert("xss")</script>',
        quantity: -100
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Input validation failed');
  });
});
```

## Performance Considerations

### 1. Validation Performance
- Input validation is lightweight and fast
- Complex validations are cached when possible
- Rate limiting uses efficient in-memory storage

### 2. Memory Usage
- Audit logs are limited to prevent memory leaks
- Security statistics are computed on-demand
- Event listeners are properly managed

### 3. Network Impact
- Security headers add minimal overhead
- Validation failures are handled gracefully
- Rate limiting prevents resource exhaustion

## Troubleshooting

### Common Issues

1. **Validation Always Fails**
   - Check validation rule configuration
   - Verify input data format
   - Review custom validation functions

2. **Rate Limiting Too Strict**
   - Adjust rate limit configuration
   - Check client identification logic
   - Review rate limit window settings

3. **Authentication Issues**
   - Verify token format and expiration
   - Check encryption key configuration
   - Review authentication middleware setup

4. **Performance Problems**
   - Monitor validation performance
   - Check audit log size
   - Review event listener management

### Debug Mode

```typescript
// Enable debug logging
const validator = new SecurityValidator({
  enableAuditLog: true
});

// Monitor all validation events
validator.on('validation', (event) => {
  console.log('Validation event:', {
    type: event.type,
    ruleName: event.ruleName,
    result: event.result,
    context: event.context
  });
});
```

## Migration Guide

### From Basic Validation

```typescript
// Before: Basic validation
function validateEmail(email: string): boolean {
  return email.includes('@');
}

// After: Comprehensive validation
const result = securityValidator.validateInput(email, 'email');
if (!result.isValid) {
  console.log('Email validation errors:', result.errors);
}
```

### From Manual Security Checks

```typescript
// Before: Manual security checks
function checkSecurity(req: Request, res: Response) {
  if (req.body.symbol.includes('<script>')) {
    return res.status(400).json({ error: 'Invalid input' });
  }
}

// After: Automated security validation
app.use(securityMiddleware({
  enableInputValidation: true,
  enableSecurityHeaders: true
}));
```

## Conclusion

The security validation implementation provides a robust foundation for securing the Paradigm Trading System. By implementing comprehensive input validation, authentication, authorization, and monitoring, it ensures that the trading platform remains secure and compliant with industry standards.

Key benefits:
- **Enhanced Security**: Comprehensive protection against common vulnerabilities
- **Data Integrity**: Ensures all data meets quality and security standards
- **Compliance**: Meets regulatory and industry security requirements
- **Monitoring**: Real-time security event tracking and alerting
- **Flexibility**: Configurable validation rules and security policies
- **Performance**: Efficient validation with minimal overhead

For production deployment, ensure proper configuration of security parameters, regular monitoring of security events, and periodic review of validation rules based on evolving security requirements. 