import { logger } from '../logger/logger';
import crypto from 'crypto';
import { EventEmitter2 } from 'eventemitter2';

// Security validation types
export enum SecurityLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum ValidationType {
  INPUT = 'INPUT',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  RATE_LIMIT = 'RATE_LIMIT',
  SANITIZATION = 'SANITIZATION',
  ENCRYPTION = 'ENCRYPTION'
}

// Security validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityLevel: SecurityLevel;
  timestamp: Date;
  context: Record<string, any>;
}

// Input validation rules
export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'url' | 'regex';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedValues?: any[];
  customValidator?: (value: any) => boolean | string;
  sanitize?: boolean;
  encrypt?: boolean;
}

// Security configuration
export interface SecurityConfig {
  maxRequestSize: number;
  allowedOrigins: string[];
  rateLimitWindow: number;
  rateLimitMax: number;
  sessionTimeout: number;
  passwordMinLength: number;
  requireSpecialChars: boolean;
  requireNumbers: boolean;
  requireUppercase: boolean;
  maxLoginAttempts: number;
  lockoutDuration: number;
  enableAuditLog: boolean;
  enableEncryption: boolean;
  encryptionKey?: string;
}

// Default security configuration
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxRequestSize: 1024 * 1024, // 1MB
  allowedOrigins: ['http://localhost:3000', 'https://yourdomain.com'],
  rateLimitWindow: 15 * 60 * 1000, // 15 minutes
  rateLimitMax: 100,
  sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
  passwordMinLength: 8,
  requireSpecialChars: true,
  requireNumbers: true,
  requireUppercase: true,
  maxLoginAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  enableAuditLog: true,
  enableEncryption: true,
  encryptionKey: process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
};

// Security validator class
export class SecurityValidator extends EventEmitter2 {
  private config: SecurityConfig;
  private validationRules: Map<string, ValidationRule>;
  private rateLimitStore: Map<string, { count: number; resetTime: number }>;
  private loginAttempts: Map<string, { count: number; lockoutUntil?: number }>;
  private auditLog: Array<{
    timestamp: Date;
    type: ValidationType;
    level: SecurityLevel;
    message: string;
    context: Record<string, any>;
  }>;

  constructor(config: Partial<SecurityConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    this.validationRules = new Map();
    this.rateLimitStore = new Map();
    this.loginAttempts = new Map();
    this.auditLog = [];

    this.initializeDefaultRules();

    logger.info('Security validator initialized', {
      config: this.config,
      rulesCount: this.validationRules.size
    });
  }

  /**
   * Initialize default validation rules
   */
  private initializeDefaultRules(): void {
    // User input validation rules
    this.addValidationRule('email', {
      type: 'email',
      required: true,
      sanitize: true
    });

    this.addValidationRule('password', {
      type: 'string',
      required: true,
      minLength: this.config.passwordMinLength,
      customValidator: (value: string) => this.validatePassword(value)
    });

    this.addValidationRule('username', {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9_]+$/,
      sanitize: true
    });

    this.addValidationRule('symbol', {
      type: 'string',
      required: true,
      pattern: /^[A-Z]{1,20}$/,
      sanitize: true
    });

    this.addValidationRule('quantity', {
      type: 'number',
      required: true,
      min: 1,
      max: 1000000
    });

    this.addValidationRule('price', {
      type: 'number',
      required: true,
      min: 0.01,
      max: 1000000
    });

    this.addValidationRule('orderType', {
      type: 'string',
      required: true,
      allowedValues: ['MARKET', 'LIMIT', 'STOP_LOSS', 'STOP_LOSS_MARKET']
    });

    this.addValidationRule('transactionType', {
      type: 'string',
      required: true,
      allowedValues: ['BUY', 'SELL']
    });
  }

  /**
   * Add custom validation rule
   */
  addValidationRule(name: string, rule: ValidationRule): void {
    this.validationRules.set(name, rule);
    logger.debug(`Validation rule added: ${name}`, rule);
  }

  /**
   * Validate input data
   */
  validateInput(data: any, ruleName: string, context: Record<string, any> = {}): ValidationResult {
    const rule = this.validationRules.get(ruleName);
    if (!rule) {
      return this.createValidationResult(false, [`Unknown validation rule: ${ruleName}`], SecurityLevel.HIGH, context);
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if required
      if (rule.required && (data === undefined || data === null || data === '')) {
        errors.push(`${ruleName} is required`);
        return this.createValidationResult(false, errors, SecurityLevel.HIGH, context);
      }

      // Skip validation if not required and empty
      if (!rule.required && (data === undefined || data === null || data === '')) {
        return this.createValidationResult(true, [], SecurityLevel.LOW, context);
      }

      // Type validation
      const typeValidation = this.validateType(data, rule);
      if (typeof typeValidation === 'string') {
        errors.push(typeValidation);
      }

      // Length validation
      if (rule.minLength !== undefined || rule.maxLength !== undefined) {
        const lengthValidation = this.validateLength(data, rule);
        if (typeof lengthValidation === 'string') {
          errors.push(lengthValidation);
        }
      }

      // Range validation
      if (rule.min !== undefined || rule.max !== undefined) {
        const rangeValidation = this.validateRange(data, rule);
        if (typeof rangeValidation === 'string') {
          errors.push(rangeValidation);
        }
      }

      // Pattern validation
      if (rule.pattern) {
        const patternValidation = this.validatePattern(data, rule);
        if (typeof patternValidation === 'string') {
          errors.push(patternValidation);
        }
      }

      // Allowed values validation
      if (rule.allowedValues) {
        const allowedValuesValidation = this.validateAllowedValues(data, rule);
        if (typeof allowedValuesValidation === 'string') {
          errors.push(allowedValuesValidation);
        }
      }

      // Custom validation
      if (rule.customValidator) {
        const customValidation = rule.customValidator(data);
        if (typeof customValidation === 'string') {
          errors.push(customValidation);
        } else if (!customValidation) {
          errors.push(`${ruleName} failed custom validation`);
        }
      }

      // Sanitization
      let sanitizedData = data;
      if (rule.sanitize && errors.length === 0) {
        sanitizedData = this.sanitizeInput(data, rule);
      }

      // Encryption
      if (rule.encrypt && errors.length === 0) {
        sanitizedData = this.encryptData(sanitizedData);
      }

      const securityLevel = errors.length > 0 ? SecurityLevel.HIGH : SecurityLevel.LOW;
      const result = this.createValidationResult(errors.length === 0, errors, securityLevel, context);

      // Add sanitized data to context
      if (rule.sanitize || rule.encrypt) {
        result.context.sanitizedData = sanitizedData;
      }

      this.emit('validation', {
        type: ValidationType.INPUT,
        ruleName,
        result,
        context
      });

      return result;

    } catch (error) {
      const errorMessage = `Validation error for ${ruleName}: ${(error as Error).message}`;
      logger.error(errorMessage, { ruleName, data, context, error });

      return this.createValidationResult(false, [errorMessage], SecurityLevel.CRITICAL, context);
    }
  }

  /**
   * Validate type
   */
  private validateType(data: any, rule: ValidationRule): string | null {
    switch (rule.type) {
      case 'string':
        if (typeof data !== 'string') {
          return `Expected string, got ${typeof data}`;
        }
        break;
      case 'number':
        if (typeof data !== 'number' || isNaN(data)) {
          return `Expected number, got ${typeof data}`;
        }
        break;
      case 'boolean':
        if (typeof data !== 'boolean') {
          return `Expected boolean, got ${typeof data}`;
        }
        break;
      case 'array':
        if (!Array.isArray(data)) {
          return `Expected array, got ${typeof data}`;
        }
        break;
      case 'object':
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
          return `Expected object, got ${typeof data}`;
        }
        break;
      case 'email':
        if (typeof data !== 'string' || !this.isValidEmail(data)) {
          return 'Invalid email format';
        }
        break;
      case 'url':
        if (typeof data !== 'string' || !this.isValidUrl(data)) {
          return 'Invalid URL format';
        }
        break;
      case 'regex':
        if (rule.pattern && !rule.pattern.test(String(data))) {
          return `Value does not match required pattern`;
        }
        break;
    }
    return null;
  }

  /**
   * Validate length
   */
  private validateLength(data: any, rule: ValidationRule): string | null {
    const length = String(data).length;

    if (rule.minLength !== undefined && length < rule.minLength) {
      return `Minimum length is ${rule.minLength}, got ${length}`;
    }

    if (rule.maxLength !== undefined && length > rule.maxLength) {
      return `Maximum length is ${rule.maxLength}, got ${length}`;
    }

    return null;
  }

  /**
   * Validate range
   */
  private validateRange(data: any, rule: ValidationRule): string | null {
    const num = Number(data);

    if (rule.min !== undefined && num < rule.min) {
      return `Minimum value is ${rule.min}, got ${num}`;
    }

    if (rule.max !== undefined && num > rule.max) {
      return `Maximum value is ${rule.max}, got ${num}`;
    }

    return null;
  }

  /**
   * Validate pattern
   */
  private validatePattern(data: any, rule: ValidationRule): string | null {
    if (rule.pattern && !rule.pattern.test(String(data))) {
      return `Value does not match required pattern`;
    }
    return null;
  }

  /**
   * Validate allowed values
   */
  private validateAllowedValues(data: any, rule: ValidationRule): string | null {
    if (rule.allowedValues && !rule.allowedValues.includes(data)) {
      return `Value must be one of: ${rule.allowedValues.join(', ')}`;
    }
    return null;
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): boolean | string {
    if (password.length < this.config.passwordMinLength) {
      return `Password must be at least ${this.config.passwordMinLength} characters long`;
    }

    if (this.config.requireUppercase && !/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }

    if (this.config.requireNumbers && !/\d/.test(password)) {
      return 'Password must contain at least one number';
    }

    if (this.config.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return 'Password must contain at least one special character';
    }

    return true;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize input
   */
  private sanitizeInput(data: any, rule: ValidationRule): any {
    if (typeof data === 'string') {
      // Remove HTML tags
      data = data.replace(/<[^>]*>/g, '');

      // Remove script tags and content
      data = data.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

      // Remove dangerous characters
      data = data.replace(/[<>\"'&]/g, '');

      // Trim whitespace
      data = data.trim();
    }

    return data;
  }

  /**
   * Encrypt data
   */
  private encryptData(data: any): string {
    if (!this.config.enableEncryption || !this.config.encryptionKey) {
      return String(data);
    }

    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
      let encrypted = cipher.update(String(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      logger.error('Encryption failed', { error });
      return String(data);
    }
  }

  /**
   * Decrypt data
   */
  decryptData(encryptedData: string): string {
    if (!this.config.enableEncryption || !this.config.encryptionKey) {
      return encryptedData;
    }

    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.config.encryptionKey);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error });
      return encryptedData;
    }
  }

  /**
   * Validate authentication
   */
  validateAuthentication(token: string, context: Record<string, any> = {}): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!token) {
        errors.push('Authentication token is required');
        return this.createValidationResult(false, errors, SecurityLevel.CRITICAL, context);
      }

      // Check token format (basic JWT format)
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        errors.push('Invalid token format');
        return this.createValidationResult(false, errors, SecurityLevel.CRITICAL, context);
      }

      // Check token expiration (basic check)
      try {
        const tokenPayload = tokenParts[1];
        if (!tokenPayload) {
          errors.push('Invalid token payload');
          return this.createValidationResult(false, errors, SecurityLevel.CRITICAL, context);
        }
        const payload = JSON.parse(Buffer.from(tokenPayload, 'base64').toString()) as { exp?: number };
        if (payload.exp && Date.now() >= payload.exp * 1000) {
          errors.push('Token has expired');
          return this.createValidationResult(false, errors, SecurityLevel.HIGH, context);
        }
      } catch (error) {
        warnings.push('Could not verify token expiration');
      }

      this.emit('validation', {
        type: ValidationType.AUTHENTICATION,
        result: this.createValidationResult(errors.length === 0, errors, SecurityLevel.HIGH, context),
        context
      });

      return this.createValidationResult(errors.length === 0, errors, SecurityLevel.HIGH, context);

    } catch (error) {
      const errorMessage = `Authentication validation error: ${(error as Error).message}`;
      logger.error(errorMessage, { context, error });

      return this.createValidationResult(false, [errorMessage], SecurityLevel.CRITICAL, context);
    }
  }

  /**
   * Validate authorization
   */
  validateAuthorization(userId: string, resource: string, action: string, context: Record<string, any> = {}): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!userId) {
        errors.push('User ID is required for authorization');
        return this.createValidationResult(false, errors, SecurityLevel.CRITICAL, context);
      }

      if (!resource) {
        errors.push('Resource is required for authorization');
        return this.createValidationResult(false, errors, SecurityLevel.CRITICAL, context);
      }

      if (!action) {
        errors.push('Action is required for authorization');
        return this.createValidationResult(false, errors, SecurityLevel.CRITICAL, context);
      }

      // Check for suspicious patterns
      if (this.isSuspiciousAction(userId, resource, action)) {
        errors.push('Suspicious authorization attempt detected');
        return this.createValidationResult(false, errors, SecurityLevel.CRITICAL, context);
      }

      this.emit('validation', {
        type: ValidationType.AUTHORIZATION,
        result: this.createValidationResult(errors.length === 0, errors, SecurityLevel.HIGH, context),
        context: { ...context, userId, resource, action }
      });

      return this.createValidationResult(errors.length === 0, errors, SecurityLevel.HIGH, context);

    } catch (error) {
      const errorMessage = `Authorization validation error: ${(error as Error).message}`;
      logger.error(errorMessage, { userId, resource, action, context, error });

      return this.createValidationResult(false, [errorMessage], SecurityLevel.CRITICAL, context);
    }
  }

  /**
   * Check rate limiting
   */
  checkRateLimit(identifier: string, context: Record<string, any> = {}): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const now = Date.now();
      const record = this.rateLimitStore.get(identifier);

      if (!record || now > record.resetTime) {
        // Reset or create new record
        this.rateLimitStore.set(identifier, {
          count: 1,
          resetTime: now + this.config.rateLimitWindow
        });
      } else {
        // Increment count
        record.count++;

        if (record.count > this.config.rateLimitMax) {
          errors.push(`Rate limit exceeded. Maximum ${this.config.rateLimitMax} requests per ${this.config.rateLimitWindow / 1000 / 60} minutes`);
          return this.createValidationResult(false, errors, SecurityLevel.HIGH, context);
        }
      }

      this.emit('validation', {
        type: ValidationType.RATE_LIMIT,
        result: this.createValidationResult(true, [], SecurityLevel.MEDIUM, context),
        context: { ...context, identifier, currentCount: record?.count || 1 }
      });

      return this.createValidationResult(true, [], SecurityLevel.MEDIUM, context);

    } catch (error) {
      const errorMessage = `Rate limit check error: ${(error as Error).message}`;
      logger.error(errorMessage, { identifier, context, error });

      return this.createValidationResult(false, [errorMessage], SecurityLevel.CRITICAL, context);
    }
  }

  /**
   * Check login attempts
   */
  checkLoginAttempts(identifier: string, context: Record<string, any> = {}): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const now = Date.now();
      const record = this.loginAttempts.get(identifier);

      if (record && record.lockoutUntil && now < record.lockoutUntil) {
        const remainingTime = Math.ceil((record.lockoutUntil - now) / 1000 / 60);
        errors.push(`Account temporarily locked. Try again in ${remainingTime} minutes`);
        return this.createValidationResult(false, errors, SecurityLevel.HIGH, context);
      }

      // Reset if lockout period has passed
      if (record && record.lockoutUntil && now >= record.lockoutUntil) {
        this.loginAttempts.delete(identifier);
      }

      this.emit('validation', {
        type: ValidationType.AUTHENTICATION,
        result: this.createValidationResult(true, [], SecurityLevel.MEDIUM, context),
        context: { ...context, identifier }
      });

      return this.createValidationResult(true, [], SecurityLevel.MEDIUM, context);

    } catch (error) {
      const errorMessage = `Login attempts check error: ${(error as Error).message}`;
      logger.error(errorMessage, { identifier, context, error });

      return this.createValidationResult(false, [errorMessage], SecurityLevel.CRITICAL, context);
    }
  }

  /**
   * Record failed login attempt
   */
  recordFailedLogin(identifier: string, context: Record<string, any> = {}): void {
    try {
      const record = this.loginAttempts.get(identifier) || { count: 0 };
      record.count++;

      if (record.count >= this.config.maxLoginAttempts) {
        record.lockoutUntil = Date.now() + this.config.lockoutDuration;
        logger.warn(`Account locked due to multiple failed login attempts`, {
          identifier,
          attempts: record.count,
          lockoutUntil: new Date(record.lockoutUntil)
        });
      }

      this.loginAttempts.set(identifier, record);

      this.emit('securityEvent', {
        type: 'failedLogin',
        identifier,
        attempts: record.count,
        context
      });

    } catch (error) {
      logger.error('Failed to record login attempt', { identifier, context, error });
    }
  }

  /**
   * Reset login attempts
   */
  resetLoginAttempts(identifier: string): void {
    this.loginAttempts.delete(identifier);
    logger.debug(`Login attempts reset for ${identifier}`);
  }

  /**
   * Check for suspicious actions
   */
  private isSuspiciousAction(userId: string, resource: string, action: string): boolean {
    // Check for rapid successive actions
    // Check for unusual resource access patterns
    // Check for admin actions from non-admin users
    // This is a basic implementation - enhance based on your security requirements

    const suspiciousPatterns = [
      /admin/i,
      /delete/i,
      /drop/i,
      /exec/i,
      /script/i
    ];

    return suspiciousPatterns.some(pattern =>
      pattern.test(resource) || pattern.test(action)
    );
  }

  /**
   * Create validation result
   */
  private createValidationResult(
    isValid: boolean,
    errors: string[],
    securityLevel: SecurityLevel,
    context: Record<string, any>
  ): ValidationResult {
    const result: ValidationResult = {
      isValid,
      errors,
      warnings: [],
      securityLevel,
      timestamp: new Date(),
      context
    };

    // Log security events
    if (this.config.enableAuditLog) {
      this.auditLog.push({
        timestamp: result.timestamp,
        type: ValidationType.INPUT,
        level: securityLevel,
        message: isValid ? 'Validation passed' : `Validation failed: ${errors.join(', ')}`,
        context
      });

      // Keep only last 1000 audit log entries
      if (this.auditLog.length > 1000) {
        this.auditLog = this.auditLog.slice(-1000);
      }
    }

    return result;
  }

  /**
   * Get audit log
   */
  getAuditLog(limit: number = 100): Array<{
    timestamp: Date;
    type: ValidationType;
    level: SecurityLevel;
    message: string;
    context: Record<string, any>;
  }> {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalValidations: number;
    failedValidations: number;
    securityLevels: Record<SecurityLevel, number>;
    rateLimitBlocks: number;
    loginLockouts: number;
  } {
    const stats = {
      totalValidations: this.auditLog.length,
      failedValidations: this.auditLog.filter(entry => entry.message.includes('failed')).length,
      securityLevels: {
        [SecurityLevel.LOW]: 0,
        [SecurityLevel.MEDIUM]: 0,
        [SecurityLevel.HIGH]: 0,
        [SecurityLevel.CRITICAL]: 0
      },
      rateLimitBlocks: 0,
      loginLockouts: 0
    };

    this.auditLog.forEach(entry => {
      stats.securityLevels[entry.level]++;
      if (entry.message.includes('Rate limit exceeded')) {
        stats.rateLimitBlocks++;
      }
      if (entry.message.includes('Account locked')) {
        stats.loginLockouts++;
      }
    });

    return stats;
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
    logger.info('Audit log cleared');
  }

  /**
   * Get configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Security configuration updated', { newConfig });
  }
}

// Global security validator instance
export const securityValidator = new SecurityValidator();

// Utility functions
export const validateTradingInput = (data: any, context: Record<string, any> = {}): ValidationResult => {
  return securityValidator.validateInput(data, 'symbol', context);
};

export const validateOrderInput = (data: any, context: Record<string, any> = {}): ValidationResult => {
  return securityValidator.validateInput(data, 'orderType', context);
};

export const validateUserInput = (data: any, context: Record<string, any> = {}): ValidationResult => {
  return securityValidator.validateInput(data, 'email', context);
};

export const validatePassword = (password: string, context: Record<string, any> = {}): ValidationResult => {
  return securityValidator.validateInput(password, 'password', context);
};

export const hashPassword = (password: string): string => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const generateApiKey = (): string => {
  return crypto.randomBytes(16).toString('hex');
}; 