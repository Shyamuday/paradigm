import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { 
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

describe('Security Validator', () => {
  let validator: SecurityValidator;

  beforeEach(() => {
    validator = new SecurityValidator();
  });

  afterEach(() => {
    validator.clearAuditLog();
  });

  describe('Input Validation', () => {
    it('should validate email correctly', () => {
      const validEmail = 'test@example.com';
      const invalidEmail = 'invalid-email';

      const validResult = validator.validateInput(validEmail, 'email');
      const invalidResult = validator.validateInput(invalidEmail, 'email');

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Invalid email format');
    });

    it('should validate password strength', () => {
      const weakPassword = 'weak';
      const strongPassword = 'StrongPass123!';

      const weakResult = validator.validateInput(weakPassword, 'password');
      const strongResult = validator.validateInput(strongPassword, 'password');

      expect(weakResult.isValid).toBe(false);
      expect(strongResult.isValid).toBe(true);
    });

    it('should validate trading symbols', () => {
      const validSymbol = 'NIFTY';
      const invalidSymbol = 'nifty123';

      const validResult = validator.validateInput(validSymbol, 'symbol');
      const invalidResult = validator.validateInput(invalidSymbol, 'symbol');

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    it('should validate quantities', () => {
      const validQuantity = 100;
      const invalidQuantity = -5;

      const validResult = validator.validateInput(validQuantity, 'quantity');
      const invalidResult = validator.validateInput(invalidQuantity, 'quantity');

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    it('should validate prices', () => {
      const validPrice = 19500.50;
      const invalidPrice = 0;

      const validResult = validator.validateInput(validPrice, 'price');
      const invalidResult = validator.validateInput(invalidPrice, 'price');

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    it('should validate order types', () => {
      const validOrderType = 'MARKET';
      const invalidOrderType = 'INVALID';

      const validResult = validator.validateInput(validOrderType, 'orderType');
      const invalidResult = validator.validateInput(invalidOrderType, 'orderType');

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    it('should validate required fields', () => {
      const result = validator.validateInput('', 'email');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('email is required');
    });

    it('should validate string length', () => {
      const shortUsername = 'ab';
      const longUsername = 'a'.repeat(51);

      const shortResult = validator.validateInput(shortUsername, 'username');
      const longResult = validator.validateInput(longUsername, 'username');

      expect(shortResult.isValid).toBe(false);
      expect(longResult.isValid).toBe(false);
    });

    it('should validate number ranges', () => {
      const lowQuantity = 0;
      const highQuantity = 2000000;

      const lowResult = validator.validateInput(lowQuantity, 'quantity');
      const highResult = validator.validateInput(highQuantity, 'quantity');

      expect(lowResult.isValid).toBe(false);
      expect(highResult.isValid).toBe(false);
    });
  });

  describe('Authentication Validation', () => {
    it('should validate JWT token format', () => {
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const invalidToken = 'invalid.token.format';

      const validResult = validator.validateAuthentication(validToken);
      const invalidResult = validator.validateAuthentication(invalidToken);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    it('should reject empty tokens', () => {
      const result = validator.validateAuthentication('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Authentication token is required');
    });
  });

  describe('Authorization Validation', () => {
    it('should validate authorization requests', () => {
      const result = validator.validateAuthorization(
        'user123',
        '/api/trades',
        'GET'
      );

      expect(result.isValid).toBe(true);
    });

    it('should detect suspicious actions', () => {
      const result = validator.validateAuthorization(
        'user123',
        '/api/admin/delete',
        'DELETE'
      );

      expect(result.isValid).toBe(false);
    });

    it('should require user ID', () => {
      const result = validator.validateAuthorization('', '/api/trades', 'GET');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('User ID is required for authorization');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', () => {
      const clientId = 'test_client';
      
      for (let i = 0; i < 5; i++) {
        const result = validator.checkRateLimit(clientId);
        expect(result.isValid).toBe(true);
      }
    });

    it('should block requests over limit', () => {
      const clientId = 'test_client_limit';
      
      // Make many requests to exceed limit
      for (let i = 0; i < 150; i++) {
        const result = validator.checkRateLimit(clientId);
        if (!result.isValid) {
          expect(result.errors).toContain('Rate limit exceeded');
          break;
        }
      }
    });
  });

  describe('Login Attempt Tracking', () => {
    it('should track failed login attempts', () => {
      const userId = 'test_user';
      
      // Record failed attempts
      for (let i = 0; i < 3; i++) {
        validator.recordFailedLogin(userId);
      }

      // Check if account is locked
      const result = validator.checkLoginAttempts(userId);
      expect(result.isValid).toBe(true); // Not locked yet
    });

    it('should lock account after max attempts', () => {
      const userId = 'test_user_lock';
      
      // Record failed attempts up to limit
      for (let i = 0; i < 6; i++) {
        validator.recordFailedLogin(userId);
      }

      // Check if account is locked
      const result = validator.checkLoginAttempts(userId);
      expect(result.isValid).toBe(false);
    });

    it('should reset login attempts', () => {
      const userId = 'test_user_reset';
      
      // Record some failed attempts
      validator.recordFailedLogin(userId);
      validator.recordFailedLogin(userId);

      // Reset attempts
      validator.resetLoginAttempts(userId);

      // Check if reset worked
      const result = validator.checkLoginAttempts(userId);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize HTML content', () => {
      validator.addValidationRule('testSanitize', {
        type: 'string',
        sanitize: true
      });

      const input = '<script>alert("xss")</script>Hello World';
      const result = validator.validateInput(input, 'testSanitize');

      expect(result.isValid).toBe(true);
      expect(result.context.sanitizedData).toBe('Hello World');
    });

    it('should sanitize dangerous characters', () => {
      validator.addValidationRule('testSanitize', {
        type: 'string',
        sanitize: true
      });

      const input = 'Hello<script>alert("xss")</script>World';
      const result = validator.validateInput(input, 'testSanitize');

      expect(result.isValid).toBe(true);
      expect(result.context.sanitizedData).toBe('HelloWorld');
    });
  });

  describe('Encryption', () => {
    it('should encrypt and decrypt data', () => {
      validator.addValidationRule('testEncrypt', {
        type: 'string',
        encrypt: true
      });

      const originalData = 'sensitive_data';
      const result = validator.validateInput(originalData, 'testEncrypt');

      expect(result.isValid).toBe(true);
      expect(result.context.sanitizedData).not.toBe(originalData);

      // Decrypt the data
      const decrypted = validator.decryptData(result.context.sanitizedData);
      expect(decrypted).toBe(originalData);
    });
  });

  describe('Custom Validation Rules', () => {
    it('should support custom validation functions', () => {
      validator.addValidationRule('customTest', {
        type: 'string',
        customValidator: (value: string) => {
          if (value.length < 5) {
            return 'Value must be at least 5 characters long';
          }
          return true;
        }
      });

      const shortResult = validator.validateInput('abc', 'customTest');
      const longResult = validator.validateInput('abcdef', 'customTest');

      expect(shortResult.isValid).toBe(false);
      expect(shortResult.errors).toContain('Value must be at least 5 characters long');
      expect(longResult.isValid).toBe(true);
    });

    it('should support pattern validation', () => {
      validator.addValidationRule('patternTest', {
        type: 'string',
        pattern: /^[A-Z]+$/
      });

      const validResult = validator.validateInput('ABC', 'patternTest');
      const invalidResult = validator.validateInput('abc123', 'patternTest');

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });

    it('should support allowed values validation', () => {
      validator.addValidationRule('allowedTest', {
        type: 'string',
        allowedValues: ['option1', 'option2', 'option3']
      });

      const validResult = validator.validateInput('option1', 'allowedTest');
      const invalidResult = validator.validateInput('invalid', 'allowedTest');

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('Audit Logging', () => {
    it('should log validation events', () => {
      validator.validateInput('test@example.com', 'email');
      validator.validateInput('invalid-email', 'email');

      const auditLog = validator.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);
    });

    it('should provide security statistics', () => {
      // Generate some validation events
      validator.validateInput('test@example.com', 'email');
      validator.validateInput('invalid-email', 'email');
      validator.validateInput('NIFTY', 'symbol');

      const stats = validator.getSecurityStats();
      expect(stats.totalValidations).toBeGreaterThan(0);
      expect(stats.failedValidations).toBeGreaterThan(0);
    });

    it('should limit audit log size', () => {
      // Generate many validation events
      for (let i = 0; i < 1100; i++) {
        validator.validateInput(`test${i}@example.com`, 'email');
      }

      const auditLog = validator.getAuditLog();
      expect(auditLog.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const config = validator.getConfig();
      expect(config.passwordMinLength).toBe(8);
      expect(config.maxLoginAttempts).toBe(5);
      expect(config.rateLimitMax).toBe(100);
    });

    it('should allow configuration updates', () => {
      validator.updateConfig({
        passwordMinLength: 12,
        maxLoginAttempts: 3
      });

      const config = validator.getConfig();
      expect(config.passwordMinLength).toBe(12);
      expect(config.maxLoginAttempts).toBe(3);
    });
  });

  describe('Event Emission', () => {
    it('should emit validation events', (done) => {
      validator.on('validation', (event) => {
        expect(event.type).toBe(ValidationType.INPUT);
        expect(event.result.isValid).toBe(true);
        done();
      });

      validator.validateInput('test@example.com', 'email');
    });

    it('should emit security events', (done) => {
      validator.on('securityEvent', (event) => {
        expect(event.type).toBe('failedLogin');
        expect(event.identifier).toBe('test_user');
        done();
      });

      validator.recordFailedLogin('test_user');
    });
  });
});

describe('Utility Functions', () => {
  describe('validateTradingInput', () => {
    it('should validate trading symbols', () => {
      const validResult = validateTradingInput('NIFTY');
      const invalidResult = validateTradingInput('invalid-symbol');

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('validateOrderInput', () => {
    it('should validate order types', () => {
      const validResult = validateOrderInput('MARKET');
      const invalidResult = validateOrderInput('INVALID');

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('validateUserInput', () => {
    it('should validate email addresses', () => {
      const validResult = validateUserInput('test@example.com');
      const invalidResult = validateUserInput('invalid-email');

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate password strength', () => {
      const weakResult = validatePassword('weak');
      const strongResult = validatePassword('StrongPass123!');

      expect(weakResult.isValid).toBe(false);
      expect(strongResult.isValid).toBe(true);
    });
  });

  describe('hashPassword', () => {
    it('should hash passwords consistently', () => {
      const password = 'testpassword';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(password);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate unique tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();

      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex characters
    });
  });

  describe('generateApiKey', () => {
    it('should generate unique API keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();

      expect(key1).not.toBe(key2);
      expect(key1.length).toBe(32); // 16 bytes = 32 hex characters
    });
  });
}); 