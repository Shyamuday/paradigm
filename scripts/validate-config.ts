#!/usr/bin/env ts-node

import { logger } from '../src/logger/logger';
import { ConfigManager } from '../src/config/config-manager';
import { config } from 'dotenv';

/**
 * Configuration Validation Script
 * Validates all configuration files and environment variables
 */

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    summary: {
        totalChecks: number;
        passed: number;
        failed: number;
        warnings: number;
    };
}

class ConfigValidator {
    private errors: string[] = [];
    private warnings: string[] = [];
    private totalChecks: number = 0;
    private passedChecks: number = 0;

    async validateAll(): Promise<ValidationResult> {
        logger.info('🔍 Starting configuration validation...');

        // Load environment variables
        config();

        // Reset counters
        this.errors = [];
        this.warnings = [];
        this.totalChecks = 0;
        this.passedChecks = 0;

        // Run all validations
        await this.validateEnvironmentVariables();
        await this.validateConfigFiles();
        await this.validateDatabaseConfig();
        await this.validateTradingConfig();
        await this.validateSecurityConfig();
        await this.validateNotificationConfig();

        const result: ValidationResult = {
            isValid: this.errors.length === 0,
            errors: this.errors,
            warnings: this.warnings,
            summary: {
                totalChecks: this.totalChecks,
                passed: this.passedChecks,
                failed: this.errors.length,
                warnings: this.warnings.length
            }
        };

        this.displayResults(result);
        return result;
    }

    private async validateEnvironmentVariables(): Promise<void> {
        logger.info('Validating environment variables...');

        const requiredEnvVars = [
            'KITE_API_KEY',
            'KITE_API_SECRET',
            'KITE_ACCESS_TOKEN',
            'DATABASE_URL',
            'TELEGRAM_BOT_TOKEN',
            'TELEGRAM_CHAT_ID'
        ];

        const optionalEnvVars = [
            'TRADING_MODE',
            'TRADING_CAPITAL',
            'MAX_RISK_PER_TRADE',
            'MAX_DAILY_LOSS',
            'LOG_LEVEL',
            'NODE_ENV'
        ];

        // Check required environment variables
        for (const envVar of requiredEnvVars) {
            this.totalChecks++;
            if (!process.env[envVar]) {
                this.errors.push(`Missing required environment variable: ${envVar}`);
            } else {
                this.passedChecks++;
            }
        }

        // Check optional environment variables
        for (const envVar of optionalEnvVars) {
            this.totalChecks++;
            if (!process.env[envVar]) {
                this.warnings.push(`Missing optional environment variable: ${envVar}`);
            } else {
                this.passedChecks++;
            }
        }

        // Validate specific environment variables
        this.validateEnvVarFormat('KITE_API_KEY', /^[A-Za-z0-9]+$/);
        this.validateEnvVarFormat('KITE_ACCESS_TOKEN', /^[A-Za-z0-9]+$/);
        this.validateEnvVarFormat('DATABASE_URL', /^postgresql:\/\//);
        this.validateEnvVarFormat('TRADING_MODE', /^(PAPER|LIVE|DEMO)$/);
    }

    private async validateConfigFiles(): Promise<void> {
        logger.info('Validating configuration files...');

        try {
            const configManager = new ConfigManager();
            const config = await configManager.getConfig();

            this.totalChecks++;
            if (config) {
                this.passedChecks++;
                logger.info('✅ Configuration files loaded successfully');
            } else {
                this.errors.push('Failed to load configuration files');
            }
        } catch (error) {
            this.totalChecks++;
            this.errors.push(`Configuration file error: ${error}`);
        }
    }

    private async validateDatabaseConfig(): Promise<void> {
        logger.info('Validating database configuration...');

        const dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            this.totalChecks++;
            this.errors.push('Database URL not configured');
            return;
        }

        this.totalChecks++;
        try {
            // Test database connection
            const { DatabaseManager } = require('../src/database/database');
            const dbManager = DatabaseManager.getInstance();
            await dbManager.connect();

            // Test a simple query - use executeQuery instead of query
            await dbManager.executeQuery('SELECT 1 as test');

            this.passedChecks++;
            logger.info('✅ Database connection successful');
        } catch (error) {
            this.errors.push(`Database connection failed: ${error}`);
        }
    }

    private async validateTradingConfig(): Promise<void> {
        logger.info('Validating trading configuration...');

        // Validate API credentials
        const apiKey = process.env.KITE_API_KEY;
        const apiSecret = process.env.KITE_API_SECRET;
        const accessToken = process.env.KITE_ACCESS_TOKEN;

        this.totalChecks++;
        if (!apiKey || !apiSecret || !accessToken) {
            this.errors.push('Missing Zerodha API credentials');
        } else {
            this.passedChecks++;
        }

        // Validate trading parameters
        const capital = process.env.TRADING_CAPITAL;
        const maxRisk = process.env.MAX_RISK_PER_TRADE;
        const maxLoss = process.env.MAX_DAILY_LOSS;

        this.totalChecks++;
        if (capital && isNaN(Number(capital))) {
            this.errors.push('TRADING_CAPITAL must be a number');
        } else {
            this.passedChecks++;
        }

        this.totalChecks++;
        if (maxRisk && (isNaN(Number(maxRisk)) || Number(maxRisk) <= 0 || Number(maxRisk) > 1)) {
            this.errors.push('MAX_RISK_PER_TRADE must be between 0 and 1');
        } else {
            this.passedChecks++;
        }

        this.totalChecks++;
        if (maxLoss && isNaN(Number(maxLoss))) {
            this.errors.push('MAX_DAILY_LOSS must be a number');
        } else {
            this.passedChecks++;
        }
    }

    private async validateSecurityConfig(): Promise<void> {
        logger.info('Validating security configuration...');

        // Check for sensitive data in environment
        const sensitiveVars = ['KITE_API_SECRET', 'DATABASE_URL'];

        for (const varName of sensitiveVars) {
            this.totalChecks++;
            const value = process.env[varName];
            if (value && value.length < 10) {
                this.warnings.push(`${varName} seems too short for a secure value`);
            } else {
                this.passedChecks++;
            }
        }

        // Check NODE_ENV
        this.totalChecks++;
        const nodeEnv = process.env.NODE_ENV;
        if (!nodeEnv) {
            this.warnings.push('NODE_ENV not set (recommended: production)');
        } else if (nodeEnv === 'development') {
            this.warnings.push('Running in development mode (not recommended for production)');
        } else {
            this.passedChecks++;
        }
    }

    private async validateNotificationConfig(): Promise<void> {
        logger.info('Validating notification configuration...');

        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        this.totalChecks++;
        if (!botToken || !chatId) {
            this.warnings.push('Telegram notifications not configured');
        } else {
            this.passedChecks++;

            // Validate bot token format
            this.totalChecks++;
            if (!botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) {
                this.errors.push('Invalid Telegram bot token format');
            } else {
                this.passedChecks++;
            }

            // Validate chat ID format
            this.totalChecks++;
            if (!chatId.match(/^-?\d+$/)) {
                this.errors.push('Invalid Telegram chat ID format');
            } else {
                this.passedChecks++;
            }
        }
    }

    private validateEnvVarFormat(varName: string, pattern: RegExp): void {
        const value = process.env[varName];
        if (value) {
            this.totalChecks++;
            if (!pattern.test(value)) {
                this.errors.push(`Invalid format for ${varName}`);
            } else {
                this.passedChecks++;
            }
        }
    }

    private displayResults(result: ValidationResult): void {
        console.log('\n📋 CONFIGURATION VALIDATION RESULTS');
        console.log('===================================');
        console.log(`✅ Passed: ${result.summary.passed}`);
        console.log(`❌ Failed: ${result.summary.failed}`);
        console.log(`⚠️  Warnings: ${result.summary.warnings}`);
        console.log(`📊 Total Checks: ${result.summary.totalChecks}`);
        console.log('');

        if (result.errors.length > 0) {
            console.log('❌ ERRORS:');
            result.errors.forEach((error, index) => {
                console.log(`   ${index + 1}. ${error}`);
            });
            console.log('');
        }

        if (result.warnings.length > 0) {
            console.log('⚠️  WARNINGS:');
            result.warnings.forEach((warning, index) => {
                console.log(`   ${index + 1}. ${warning}`);
            });
            console.log('');
        }

        if (result.isValid) {
            console.log('🎉 Configuration is valid!');
        } else {
            console.log('❌ Configuration has errors that need to be fixed.');
        }
    }
}

// Main execution
async function main() {
    const validator = new ConfigValidator();

    try {
        const result = await validator.validateAll();

        if (!result.isValid) {
            process.exit(1);
        }
    } catch (error) {
        logger.error('Validation failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

export { ConfigValidator }; 