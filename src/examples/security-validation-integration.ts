#!/usr/bin/env node

import { 
  securityValidator, 
  SecurityValidator, 
  SecurityLevel,
  ValidationType,
  validateTradingInput,
  validateOrderInput,
  validateUserInput,
  validatePassword,
  hashPassword,
  generateSecureToken,
  generateApiKey
} from '../utils/security-validator';
import { 
  securityMiddleware,
  inputValidationMiddleware,
  authenticationMiddleware,
  rateLimitMiddleware,
  tradingValidationMiddleware,
  userRegistrationMiddleware,
  securityMonitoringMiddleware
} from '../middleware/security-validation';
import { logger } from '../logger/logger';

/**
 * Example demonstrating security validation integration
 */
class SecurityValidationIntegrationExample {
  
  /**
   * Example 1: Basic input validation
   */
  async demonstrateInputValidation(): Promise<void> {
    logger.info('🚀 Demonstrating input validation...');
    
    // Test various input types
    const testCases = [
      { name: 'Valid Email', input: 'user@example.com', rule: 'email' },
      { name: 'Invalid Email', input: 'invalid-email', rule: 'email' },
      { name: 'Valid Symbol', input: 'NIFTY', rule: 'symbol' },
      { name: 'Invalid Symbol', input: 'nifty123', rule: 'symbol' },
      { name: 'Valid Quantity', input: 100, rule: 'quantity' },
      { name: 'Invalid Quantity', input: -5, rule: 'quantity' },
      { name: 'Valid Price', input: 19500.50, rule: 'price' },
      { name: 'Invalid Price', input: 0, rule: 'price' },
      { name: 'Valid Order Type', input: 'MARKET', rule: 'orderType' },
      { name: 'Invalid Order Type', input: 'INVALID', rule: 'orderType' }
    ];

    for (const testCase of testCases) {
      const result = securityValidator.validateInput(
        testCase.input,
        testCase.rule,
        { test: testCase.name }
      );

      logger.info(`${testCase.name}:`, {
        input: testCase.input,
        isValid: result.isValid,
        errors: result.errors,
        securityLevel: result.securityLevel
      });
    }
  }

  /**
   * Example 2: Password validation
   */
  async demonstratePasswordValidation(): Promise<void> {
    logger.info('🚀 Demonstrating password validation...');
    
    const passwords = [
      'weak',
      'password123',
      'StrongPass123!',
      'NoSpecialChar123',
      'nouppercase123!',
      'PerfectPassword123!'
    ];

    for (const password of passwords) {
      const result = validatePassword(password, { test: 'password_validation' });
      
      logger.info(`Password validation:`, {
        password: password.replace(/./g, '*'), // Mask password
        isValid: result.isValid,
        errors: result.errors,
        securityLevel: result.securityLevel
      });
    }
  }

  /**
   * Example 3: Trading input validation
   */
  async demonstrateTradingValidation(): Promise<void> {
    logger.info('🚀 Demonstrating trading input validation...');
    
    // Simulate trading order validation
    const tradingOrders = [
      {
        symbol: 'NIFTY',
        quantity: 100,
        price: 19500.50,
        orderType: 'MARKET',
        transactionType: 'BUY'
      },
      {
        symbol: 'invalid-symbol',
        quantity: -50,
        price: 0,
        orderType: 'INVALID',
        transactionType: 'SELL'
      },
      {
        symbol: 'BANKNIFTY',
        quantity: 25,
        price: 45000.75,
        orderType: 'LIMIT',
        transactionType: 'BUY'
      }
    ];

    for (const order of tradingOrders) {
      logger.info(`Validating trading order:`, order);

      // Validate each field
      const symbolResult = validateTradingInput(order.symbol, { order });
      const orderTypeResult = validateOrderInput(order.orderType, { order });
      const quantityResult = securityValidator.validateInput(order.quantity, 'quantity', { order });
      const priceResult = securityValidator.validateInput(order.price, 'price', { order });
      const transactionResult = securityValidator.validateInput(order.transactionType, 'transactionType', { order });

      const allValidations = [
        symbolResult,
        orderTypeResult,
        quantityResult,
        priceResult,
        transactionResult
      ];

      const isValid = allValidations.every(v => v.isValid);
      const errors = allValidations.flatMap(v => v.errors);

      logger.info(`Order validation result:`, {
        isValid,
        errors,
        securityLevel: isValid ? SecurityLevel.LOW : SecurityLevel.HIGH
      });
    }
  }

  /**
   * Example 4: Authentication validation
   */
  async demonstrateAuthenticationValidation(): Promise<void> {
    logger.info('🚀 Demonstrating authentication validation...');
    
    // Simulate JWT tokens
    const tokens = [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      'invalid.token.format',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid_signature',
      ''
    ];

    for (const token of tokens) {
      const result = securityValidator.validateAuthentication(
        token,
        { test: 'authentication_validation' }
      );

      logger.info(`Authentication validation:`, {
        token: token.substring(0, 20) + '...',
        isValid: result.isValid,
        errors: result.errors,
        securityLevel: result.securityLevel
      });
    }
  }

  /**
   * Example 5: Authorization validation
   */
  async demonstrateAuthorizationValidation(): Promise<void> {
    logger.info('🚀 Demonstrating authorization validation...');
    
    const authorizationTests = [
      {
        userId: 'user123',
        resource: '/api/trades',
        action: 'GET',
        description: 'Normal user accessing trades'
      },
      {
        userId: 'user123',
        resource: '/api/admin/users',
        action: 'DELETE',
        description: 'Normal user trying admin action'
      },
      {
        userId: 'admin456',
        resource: '/api/admin/users',
        action: 'DELETE',
        description: 'Admin performing admin action'
      },
      {
        userId: 'user123',
        resource: '/api/script/execute',
        action: 'POST',
        description: 'Suspicious action attempt'
      }
    ];

    for (const test of authorizationTests) {
      const result = securityValidator.validateAuthorization(
        test.userId,
        test.resource,
        test.action,
        { test: test.description }
      );

      logger.info(`Authorization validation:`, {
        description: test.description,
        userId: test.userId,
        resource: test.resource,
        action: test.action,
        isValid: result.isValid,
        errors: result.errors,
        securityLevel: result.securityLevel
      });
    }
  }

  /**
   * Example 6: Rate limiting
   */
  async demonstrateRateLimiting(): Promise<void> {
    logger.info('🚀 Demonstrating rate limiting...');
    
    const clientId = 'test_client_123';
    
    // Simulate multiple requests
    for (let i = 1; i <= 12; i++) {
      const result = securityValidator.checkRateLimit(
        clientId,
        { request: i, test: 'rate_limiting' }
      );

      logger.info(`Rate limit check ${i}:`, {
        clientId,
        isValid: result.isValid,
        errors: result.errors,
        securityLevel: result.securityLevel
      });

      // Small delay between requests
      await this.sleep(100);
    }
  }

  /**
   * Example 7: Login attempt tracking
   */
  async demonstrateLoginAttemptTracking(): Promise<void> {
    logger.info('🚀 Demonstrating login attempt tracking...');
    
    const userId = 'test_user_456';
    
    // Simulate failed login attempts
    for (let i = 1; i <= 7; i++) {
      logger.info(`Login attempt ${i} for user ${userId}`);
      
      // Check if account is locked
      const checkResult = securityValidator.checkLoginAttempts(
        userId,
        { attempt: i }
      );

      if (!checkResult.isValid) {
        logger.warn(`Account locked:`, checkResult.errors);
        break;
      }

      // Record failed attempt
      securityValidator.recordFailedLogin(userId, { attempt: i });
      
      await this.sleep(200);
    }

    // Reset login attempts
    securityValidator.resetLoginAttempts(userId);
    logger.info(`Login attempts reset for user ${userId}`);
  }

  /**
   * Example 8: Security utilities
   */
  async demonstrateSecurityUtilities(): Promise<void> {
    logger.info('🚀 Demonstrating security utilities...');
    
    // Generate secure tokens
    const secureToken = generateSecureToken();
    const apiKey = generateApiKey();
    
    logger.info('Generated security tokens:', {
      secureToken: secureToken.substring(0, 20) + '...',
      apiKey: apiKey.substring(0, 10) + '...'
    });

    // Hash password
    const password = 'MySecurePassword123!';
    const hashedPassword = hashPassword(password);
    
    logger.info('Password hashing:', {
      original: password.replace(/./g, '*'),
      hashed: hashedPassword.substring(0, 20) + '...'
    });

    // Test encryption/decryption
    const sensitiveData = 'sensitive_trading_data';
    const encrypted = securityValidator['encryptData'](sensitiveData);
    const decrypted = securityValidator.decryptData(encrypted);
    
    logger.info('Encryption test:', {
      original: sensitiveData,
      encrypted: encrypted.substring(0, 20) + '...',
      decrypted,
      matches: sensitiveData === decrypted
    });
  }

  /**
   * Example 9: Security monitoring and statistics
   */
  async demonstrateSecurityMonitoring(): Promise<void> {
    logger.info('🚀 Demonstrating security monitoring...');
    
    // Generate some security events
    await this.generateSecurityEvents();
    
    // Get audit log
    const auditLog = securityValidator.getAuditLog(10);
    logger.info('Recent audit log entries:', auditLog);

    // Get security statistics
    const stats = securityValidator.getSecurityStats();
    logger.info('Security statistics:', stats);

    // Monitor security events
    securityValidator.on('validation', (event) => {
      logger.info('Security validation event:', {
        type: event.type,
        ruleName: event.ruleName,
        result: {
          isValid: event.result.isValid,
          securityLevel: event.result.securityLevel,
          errors: event.result.errors
        }
      });
    });
  }

  /**
   * Example 10: Custom validation rules
   */
  async demonstrateCustomValidationRules(): Promise<void> {
    logger.info('🚀 Demonstrating custom validation rules...');
    
    // Add custom validation rule for trading strategy names
    securityValidator.addValidationRule('strategyName', {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9_\s]+$/,
      sanitize: true,
      customValidator: (value: string) => {
        const reservedWords = ['admin', 'system', 'root', 'delete', 'drop'];
        if (reservedWords.some(word => value.toLowerCase().includes(word))) {
          return 'Strategy name contains reserved words';
        }
        return true;
      }
    });

    // Test custom validation
    const strategyNames = [
      'Moving Average Strategy',
      'RSI Strategy',
      'admin strategy',
      'My Strategy 123',
      'delete_all_data'
    ];

    for (const name of strategyNames) {
      const result = securityValidator.validateInput(
        name,
        'strategyName',
        { test: 'custom_validation' }
      );

      logger.info(`Custom validation for "${name}":`, {
        isValid: result.isValid,
        errors: result.errors,
        securityLevel: result.securityLevel
      });
    }
  }

  /**
   * Generate security events for monitoring
   */
  private async generateSecurityEvents(): Promise<void> {
    // Generate various validation events
    const testInputs = [
      { input: 'test@example.com', rule: 'email' },
      { input: 'invalid-email', rule: 'email' },
      { input: 'NIFTY', rule: 'symbol' },
      { input: 'weak', rule: 'password' },
      { input: 'StrongPass123!', rule: 'password' }
    ];

    for (const test of testInputs) {
      securityValidator.validateInput(test.input, test.rule, { generated: true });
      await this.sleep(50);
    }
  }

  /**
   * Utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run all demonstrations
   */
  async runAllDemonstrations(): Promise<void> {
    logger.info('🎯 Starting Security Validation Integration Demonstrations\n');
    
    try {
      await this.demonstrateInputValidation();
      await this.demonstratePasswordValidation();
      await this.demonstrateTradingValidation();
      await this.demonstrateAuthenticationValidation();
      await this.demonstrateAuthorizationValidation();
      await this.demonstrateRateLimiting();
      await this.demonstrateLoginAttemptTracking();
      await this.demonstrateSecurityUtilities();
      await this.demonstrateSecurityMonitoring();
      await this.demonstrateCustomValidationRules();
      
      logger.info('\n🎉 All security validation demonstrations completed successfully!');
    } catch (error) {
      logger.error('❌ Demonstration failed:', error);
    }
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  const example = new SecurityValidationIntegrationExample();
  example.runAllDemonstrations().catch(error => {
    logger.error('❌ Example runner failed:', error);
    process.exit(1);
  });
}

export { SecurityValidationIntegrationExample }; 