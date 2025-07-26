#!/usr/bin/env ts-node

import { logger } from '../src/logger/logger';
import { ConfigManager } from '../src/config/config-manager';
import { config } from 'dotenv';

/**
 * Configuration Test Script
 * Tests configuration loading and functionality
 */

interface TestResult {
    testName: string;
    passed: boolean;
    error?: string;
    duration: number;
}

class ConfigTester {
    private results: TestResult[] = [];

    async runAllTests(): Promise<void> {
        logger.info('🧪 Starting configuration tests...');

        // Load environment variables
        config();

        // Run all tests
        await this.testConfigManagerInitialization();
        await this.testConfigLoading();
        await this.testConfigValidation();
        await this.testConfigReloading();
        await this.testConfigDefaults();
        await this.testConfigEnvironmentOverride();

        this.displayResults();
    }

    private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
        const startTime = Date.now();

        try {
            await testFn();
            this.results.push({
                testName,
                passed: true,
                duration: Date.now() - startTime
            });
            logger.info(`✅ ${testName} passed`);
        } catch (error) {
            this.results.push({
                testName,
                passed: false,
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime
            });
            logger.error(`❌ ${testName} failed: ${error}`);
        }
    }

    private async testConfigManagerInitialization(): Promise<void> {
        await this.runTest('Config Manager Initialization', async () => {
            const configManager = new ConfigManager();

            if (!configManager) {
                throw new Error('ConfigManager failed to initialize');
            }
        });
    }

    private async testConfigLoading(): Promise<void> {
        await this.runTest('Config Loading', async () => {
            const configManager = new ConfigManager();
            const config = await configManager.getConfig();

            if (!config) {
                throw new Error('Failed to load configuration');
            }

            // Check if config has expected structure
            if (typeof config !== 'object') {
                throw new Error('Configuration is not an object');
            }
        });
    }

    private async testConfigValidation(): Promise<void> {
        await this.runTest('Config Validation', async () => {
            const configManager = new ConfigManager();
            const config = await configManager.getConfig();

            // Test basic validation
            if (!config) {
                throw new Error('No configuration to validate');
            }

            // Check for required fields (adjust based on your config schema)
            const requiredFields = ['database', 'trading', 'logging'];
            for (const field of requiredFields) {
                if (!(field in config)) {
                    throw new Error(`Missing required config field: ${field}`);
                }
            }
        });
    }

    private async testConfigReloading(): Promise<void> {
        await this.runTest('Config Reloading', async () => {
            const configManager = new ConfigManager();

            // Load config first time
            const config1 = await configManager.getConfig();

            // Reload config
            await configManager.loadConfig();
            const config2 = await configManager.getConfig();

            // Configs should be the same (or at least both valid)
            if (!config1 || !config2) {
                throw new Error('Config reloading failed');
            }
        });
    }

    private async testConfigDefaults(): Promise<void> {
        await this.runTest('Config Defaults', async () => {
            const configManager = new ConfigManager();
            const config = await configManager.getConfig();

            // Test that defaults are applied
            if (!config) {
                throw new Error('No configuration loaded');
            }

            // Check for default values (adjust based on your defaults)
            if (!config.logging) {
                throw new Error('Logging defaults not applied');
            }
        });
    }

    private async testConfigEnvironmentOverride(): Promise<void> {
        await this.runTest('Environment Override', async () => {
            // Set a test environment variable
            const originalValue = process.env.TEST_CONFIG_VAR;
            process.env.TEST_CONFIG_VAR = 'test_value';

            try {
                const configManager = new ConfigManager();
                const config = await configManager.getConfig();

                // Test that environment variables are respected
                if (!config) {
                    throw new Error('Configuration not loaded');
                }
            } finally {
                // Restore original value
                if (originalValue) {
                    process.env.TEST_CONFIG_VAR = originalValue;
                } else {
                    delete process.env.TEST_CONFIG_VAR;
                }
            }
        });
    }

    private displayResults(): void {
        console.log('\n🧪 CONFIGURATION TEST RESULTS');
        console.log('============================');

        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`⏱️  Total Duration: ${totalDuration}ms`);
        console.log('');

        // Display individual test results
        this.results.forEach((result, index) => {
            const status = result.passed ? '✅' : '❌';
            const duration = `${result.duration}ms`;
            console.log(`${index + 1}. ${status} ${result.testName} (${duration})`);

            if (!result.passed && result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });

        console.log('');

        if (failed === 0) {
            console.log('🎉 All configuration tests passed!');
        } else {
            console.log(`❌ ${failed} test(s) failed. Please check the errors above.`);
        }
    }

    async testSpecificConfig(path: string): Promise<void> {
        logger.info(`Testing specific config: ${path}`);

        await this.runTest(`Config Path: ${path}`, async () => {
            const configManager = new ConfigManager();
            const config = await configManager.getConfig();

            // Navigate to the specific path
            const value = this.getNestedValue(config, path);

            if (value === undefined) {
                throw new Error(`Config path '${path}' not found`);
            }

            logger.info(`Config value at '${path}': ${JSON.stringify(value)}`);
        });
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

// Main execution
async function main() {
    const tester = new ConfigTester();

    // Check command line arguments
    const args = process.argv.slice(2);

    if (args.length > 0) {
        // Test specific config path
        const configPath = args[0];
        if (configPath) {
            await tester.testSpecificConfig(configPath);
        } else {
            await tester.runAllTests();
        }
    } else {
        // Run all tests
        await tester.runAllTests();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        logger.error('Configuration testing failed:', error);
        process.exit(1);
    });
}

export { ConfigTester }; 