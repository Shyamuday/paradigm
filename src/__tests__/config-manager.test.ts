import { ConfigManager } from '../config/config-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as YAML from 'yamljs';

jest.mock('fs/promises');
jest.mock('yamljs', () => ({
    parse: jest.fn(),
    stringify: jest.fn(),
}));

describe('ConfigManager', () => {
    let configManager: ConfigManager;
    const mockFs = fs as jest.Mocked<typeof fs>;
    const mockYaml = YAML as jest.Mocked<typeof YAML>;

    beforeEach(() => {
        configManager = new ConfigManager();
        jest.resetAllMocks();
        process.env.NODE_ENV = 'test';
    });

    afterEach(() => {
        delete process.env.NODE_ENV;
    });

    it('should load the default configuration if no YAML file is found', async () => {
        mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });
        await configManager.loadConfig();
        const config = configManager.getConfig();
        expect(config.trading.mode).toBe('paper');
    });

    it('should load and merge the YAML configuration', async () => {
        const yamlConfig = { trading: { mode: 'live' } };
        mockFs.readFile.mockResolvedValue(YAML.stringify(yamlConfig));
        mockYaml.parse.mockReturnValue(yamlConfig);
        await configManager.loadConfig();
        const config = configManager.getConfig();
        expect(config.trading.mode).toBe('live');
    });

    it('should override the configuration with environment variables', async () => {
        process.env.TRADING_MODE = 'backtest';
        await configManager.loadConfig();
        const config = configManager.getConfig();
        expect(config.trading.mode).toBe('backtest');
        delete process.env.TRADING_MODE;
    });

    it('should throw an error if the configuration is invalid', async () => {
        const invalidConfig = { trading: { mode: 'invalid' } };
        mockFs.readFile.mockResolvedValue(YAML.stringify(invalidConfig));
        mockYaml.parse.mockReturnValue(invalidConfig);
        await expect(configManager.loadConfig()).rejects.toThrow();
    });
});