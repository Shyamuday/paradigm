import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

class TradingSystemSetup {
    private requiredDependencies = [
        'kiteconnect',
        'totp-generator',
        'express',
        'winston',
        'moment',
        'lodash',
        'eventemitter2',
        '@prisma/client',
        'prisma'
    ];

    private requiredDevDependencies = [
        '@types/node',
        '@types/express',
        '@types/lodash',
        'typescript',
        'ts-node',
        'nodemon'
    ];

    private requiredDirectories = [
        'logs',
        'data',
        'config',
        'src/services',
        'src/examples',
        'src/strategies',
        'src/auth',
        'src/types'
    ];

    private requiredFiles = [
        '.env',
        'tsconfig.json',
        'prisma/schema.prisma'
    ];

    async setup(): Promise<void> {
        console.log('🔧 Setting up Trading System...');
        console.log('===============================');

        try {
            // 1. Check Node.js version
            await this.checkNodeVersion();

            // 2. Create required directories
            await this.createDirectories();

            // 3. Check and install dependencies
            await this.checkDependencies();

            // 4. Create required configuration files
            await this.createConfigFiles();

            // 5. Set up environment variables
            await this.setupEnvironment();

            // 6. Initialize database
            await this.initializeDatabase();

            // 7. Create sample configuration
            await this.createSampleConfig();

            // 8. Run initial validation
            await this.runInitialValidation();

            console.log('\n✅ Trading System setup completed successfully!');
            console.log('\n📋 Next Steps:');
            console.log('1. Edit .env file with your Zerodha credentials');
            console.log('2. Run: npm run auth:test to verify authentication');
            console.log('3. Run: npm run trading:simple to start with paper trading');
            console.log('4. Read docs/TRADING_LOGIC_IMPLEMENTATION.md for full guide');

        } catch (error) {
            console.error('❌ Setup failed:', error);
            throw error;
        }
    }

    private async checkNodeVersion(): Promise<void> {
        console.log('\n🔍 Checking Node.js version...');

        try {
            const version = process.version;
            const majorVersion = parseInt(version.split('.')[0].substring(1));

            if (majorVersion < 16) {
                throw new Error(`Node.js version ${version} is too old. Please upgrade to Node.js 16 or higher.`);
            }

            console.log(`   ✓ Node.js version: ${version}`);
        } catch (error) {
            throw new Error(`Failed to check Node.js version: ${error.message}`);
        }
    }

    private async createDirectories(): Promise<void> {
        console.log('\n📁 Creating required directories...');

        for (const dir of this.requiredDirectories) {
            try {
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                    console.log(`   ✓ Created directory: ${dir}`);
                } else {
                    console.log(`   ✓ Directory exists: ${dir}`);
                }
            } catch (error) {
                console.error(`   ❌ Failed to create directory ${dir}:`, error);
            }
        }
    }

    private async checkDependencies(): Promise<void> {
        console.log('\n📦 Checking dependencies...');

        try {
            // Read package.json
            const packageJsonPath = path.join(process.cwd(), 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
                throw new Error('package.json not found');
            }

            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const dependencies = packageJson.dependencies || {};
            const devDependencies = packageJson.devDependencies || {};

            const missingDeps = [];
            const missingDevDeps = [];

            // Check required dependencies
            for (const dep of this.requiredDependencies) {
                if (!dependencies[dep]) {
                    missingDeps.push(dep);
                }
            }

            // Check required dev dependencies
            for (const dep of this.requiredDevDependencies) {
                if (!devDependencies[dep]) {
                    missingDevDeps.push(dep);
                }
            }

            // Install missing dependencies
            if (missingDeps.length > 0) {
                console.log(`   📥 Installing missing dependencies: ${missingDeps.join(', ')}`);
                execSync(`npm install ${missingDeps.join(' ')}`, { stdio: 'inherit' });
            }

            if (missingDevDeps.length > 0) {
                console.log(`   📥 Installing missing dev dependencies: ${missingDevDeps.join(', ')}`);
                execSync(`npm install --save-dev ${missingDevDeps.join(' ')}`, { stdio: 'inherit' });
            }

            console.log('   ✓ All dependencies are installed');

        } catch (error) {
            throw new Error(`Failed to check dependencies: ${error.message}`);
        }
    }

    private async createConfigFiles(): Promise<void> {
        console.log('\n⚙️ Creating configuration files...');

        // Create tsconfig.json if it doesn't exist
        const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
        if (!fs.existsSync(tsconfigPath)) {
            const tsconfigContent = {
                compilerOptions: {
                    target: 'ES2020',
                    module: 'commonjs',
                    lib: ['ES2020'],
                    outDir: './dist',
                    rootDir: './src',
                    strict: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    forceConsistentCasingInFileNames: true,
                    resolveJsonModule: true,
                    declaration: true,
                    declarationMap: true,
                    sourceMap: true
                },
                include: ['src/**/*'],
                exclude: ['node_modules', 'dist']
            };

            fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfigContent, null, 2));
            console.log('   ✓ Created tsconfig.json');
        } else {
            console.log('   ✓ tsconfig.json exists');
        }
    }

    private async setupEnvironment(): Promise<void> {
        console.log('\n🔐 Setting up environment variables...');

        const envPath = path.join(process.cwd(), '.env');
        const envExamplePath = path.join(process.cwd(), 'env.example');

        if (!fs.existsSync(envPath)) {
            if (fs.existsSync(envExamplePath)) {
                fs.copyFileSync(envExamplePath, envPath);
                console.log('   ✓ Created .env from env.example');
            } else {
                // Create basic .env file
                const envContent = `# Zerodha API Configuration
API_KEY=your_api_key_here
API_SECRET=your_api_secret_here
USER_ID=your_user_id_here
PASSWORD=your_password_here
TOTP_SECRET=your_totp_secret_here

# Database Configuration
DATABASE_URL="file:./dev.db"

# Application Configuration
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

# Trading Configuration
ENABLE_PAPER_TRADING=true
ENABLE_LIVE_TRADING=false
MAX_DAILY_LOSS=1000
MAX_POSITIONS=5
`;

                fs.writeFileSync(envPath, envContent);
                console.log('   ✓ Created basic .env file');
            }
        } else {
            console.log('   ✓ .env file exists');
        }

        console.log('   ⚠️ Please edit .env file with your actual credentials');
    }

    private async initializeDatabase(): Promise<void> {
        console.log('\n🗄️ Initializing database...');

        try {
            // Check if Prisma schema exists
            const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
            if (!fs.existsSync(schemaPath)) {
                console.log('   ⚠️ Prisma schema not found, skipping database initialization');
                return;
            }

            // Generate Prisma client
            execSync('npx prisma generate', { stdio: 'inherit' });
            console.log('   ✓ Generated Prisma client');

            // Run migrations
            execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
            console.log('   ✓ Database migrations completed');

        } catch (error) {
            console.log('   ⚠️ Database initialization failed, continuing setup...');
            console.log(`   Error: ${error.message}`);
        }
    }

    private async createSampleConfig(): Promise<void> {
        console.log('\n📋 Creating sample configuration...');

        const configDir = path.join(process.cwd(), 'config');

        // Create sample trading configuration
        const tradingConfigPath = path.join(configDir, 'trading-config.sample.yaml');
        const tradingConfigContent = `# Sample Trading Configuration
trading:
  maxPositions: 3
  maxRiskPerTrade: 2.0
  maxDailyLoss: 1000
  maxDrawdown: 5.0
  autoExecute: false
  simulationMode: true
  
  allowedSymbols:
    - RELIANCE
    - TCS
    - HDFCBANK
    - INFY
    - HINDUNILVR
    - ITC
    - SBIN
    - BAJFINANCE
    - MARUTI
    - KOTAKBANK
  
  tradingHours:
    start: "09:15"
    end: "15:30"
  
  riskManagement:
    stopLoss:
      type: PERCENTAGE
      value: 2
      percentage: 2
    takeProfit:
      type: PERCENTAGE
      value: 4
      percentage: 4
    maxDrawdown: 5
    maxDailyLoss: 1000
    maxOpenPositions: 3

strategies:
  movingAverage:
    enabled: true
    symbols: [RELIANCE, TCS, HDFCBANK]
    parameters:
      shortPeriod: 10
      longPeriod: 20
      volumeThreshold: 100000
  
  rsiMeanReversion:
    enabled: true
    symbols: [INFY, HINDUNILVR, ITC]
    parameters:
      period: 14
      oversoldThreshold: 30
      overboughtThreshold: 70
  
  breakout:
    enabled: true
    symbols: [SBIN, BAJFINANCE, MARUTI]
    parameters:
      lookbackPeriod: 20
      breakoutThreshold: 0.015
      volumeMultiplier: 1.5
`;

        fs.writeFileSync(tradingConfigPath, tradingConfigContent);
        console.log('   ✓ Created sample trading configuration');

        // Create sample timeframe configuration
        const timeframeConfigPath = path.join(configDir, 'timeframe-config.sample.yaml');
        const timeframeConfigContent = `# Sample Timeframe Configuration
timeframes:
  - name: "1min"
    intervalMinutes: 1
    description: "1 minute candles"
    isActive: true
    
  - name: "5min"
    intervalMinutes: 5
    description: "5 minute candles"
    isActive: true
    
  - name: "15min"
    intervalMinutes: 15
    description: "15 minute candles"
    isActive: true
    
  - name: "30min"
    intervalMinutes: 30
    description: "30 minute candles"
    isActive: true
    
  - name: "1hour"
    intervalMinutes: 60
    description: "1 hour candles"
    isActive: true
    
  - name: "1day"
    intervalMinutes: 1440
    description: "Daily candles"
    isActive: true
`;

        fs.writeFileSync(timeframeConfigPath, timeframeConfigContent);
        console.log('   ✓ Created sample timeframe configuration');
    }

    private async runInitialValidation(): Promise<void> {
        console.log('\n✅ Running initial validation...');

        try {
            // Check if TypeScript compiles
            execSync('npx tsc --noEmit', { stdio: 'pipe' });
            console.log('   ✓ TypeScript compilation successful');
        } catch (error) {
            console.log('   ⚠️ TypeScript compilation has errors, but continuing...');
        }

        // Check if main files exist
        const mainFiles = [
            'src/index.ts',
            'src/auth/auto-totp-example.ts',
            'src/services/automated-trading.service.ts'
        ];

        for (const file of mainFiles) {
            if (fs.existsSync(file)) {
                console.log(`   ✓ ${file} exists`);
            } else {
                console.log(`   ⚠️ ${file} missing`);
            }
        }
    }

    // Utility method to check if a command exists
    private commandExists(command: string): boolean {
        try {
            execSync(`which ${command}`, { stdio: 'pipe' });
            return true;
        } catch {
            return false;
        }
    }
}

// Quick setup function for immediate use
export async function quickSetup(): Promise<void> {
    console.log('🚀 Quick Setup for Trading System');
    console.log('==================================');

    try {
        const setup = new TradingSystemSetup();
        await setup.setup();

        console.log('\n🎉 Setup completed successfully!');
        console.log('\n🏁 Ready to start trading:');
        console.log('   npm run trading:simple    # Start with paper trading');
        console.log('   npm run tokens:all        # View available instruments');
        console.log('   npm run auth:test         # Test authentication');

    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    quickSetup();
}

export { TradingSystemSetup }; 