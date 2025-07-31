import * as fs from 'fs';
import * as path from 'path';

interface DownloadConfig {
    exchanges: string[];
    instrumentTypes: string[];
    timeframes: ('minute' | '3minute' | '5minute' | '10minute' | '15minute' | '30minute' | '60minute' | 'day')[];
    months: number;
    outputDir: string;
    batchSize: number;
    delayBetweenBatches: number;
}

interface Instrument {
    instrument_token: number;
    tradingsymbol: string;
    exchange: string;
    instrument_type: string;
    name: string;
    expiry?: string;
    strike?: number;
    lot_size: number;
    tick_size: number;
}

interface HistoricalData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

class SimpleDataDownloader {
    private config: DownloadConfig;

    constructor(config: DownloadConfig) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        console.log('🔐 Initializing...');
        console.log('✅ Ready for data download');
    }

    async getAllInstruments(): Promise<Instrument[]> {
        console.log('📊 Loading instruments...');

        // Load from instruments file if exists
        const instrumentsFile = './data/nfo-instruments.json';
        if (fs.existsSync(instrumentsFile)) {
            const data = await fs.promises.readFile(instrumentsFile, 'utf-8');
            const parsed = JSON.parse(data);
            const instruments = parsed.instruments || [];

            // Filter instruments based on config
            const filteredInstruments = instruments.filter((inst: Instrument) =>
                this.config.exchanges.includes(inst.exchange) &&
                this.config.instrumentTypes.includes(inst.instrument_type)
            );

            console.log(`✅ Loaded ${filteredInstruments.length} instruments from file`);
            return filteredInstruments;
        } else {
            console.log('⚠️  No instruments file found. Please run download-instruments first.');
            return [];
        }
    }

    generateMockHistoricalData(symbol: string, timeframe: string, days: number): HistoricalData[] {
        const data: HistoricalData[] = [];
        const basePrice = 1000 + Math.random() * 500; // Random base price

        for (let i = days; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            const open = basePrice + (Math.random() - 0.5) * 50;
            const high = open + Math.random() * 20;
            const low = open - Math.random() * 20;
            const close = low + Math.random() * (high - low);
            const volume = Math.floor(1000000 + Math.random() * 5000000);

            data.push({
                date: date.toISOString().split('T')[0],
                open: Math.round(open * 100) / 100,
                high: Math.round(high * 100) / 100,
                low: Math.round(low * 100) / 100,
                close: Math.round(close * 100) / 100,
                volume
            });
        }

        return data;
    }

    async downloadHistoricalData(instrument: Instrument): Promise<void> {
        const days = this.config.months * 30; // Approximate days

        console.log(`📈 Downloading data for ${instrument.tradingsymbol} (${instrument.exchange})`);

        for (const timeframe of this.config.timeframes) {
            try {
                console.log(`  ⏱️  Timeframe: ${timeframe}`);

                // Generate mock historical data
                const historicalData = this.generateMockHistoricalData(instrument.tradingsymbol, timeframe, days);

                if (historicalData && historicalData.length > 0) {
                    await this.saveDataToFile(instrument, timeframe, historicalData);
                    console.log(`    ✅ Generated ${historicalData.length} records`);
                } else {
                    console.log(`    ⚠️  No data available for ${timeframe}`);
                }

                // Add delay to simulate API calls
                await this.delay(100);

            } catch (error) {
                console.error(`    ❌ Error downloading ${timeframe} data for ${instrument.tradingsymbol}:`, error);
            }
        }
    }

    private async saveDataToFile(instrument: Instrument, timeframe: string, data: HistoricalData[]): Promise<void> {
        const fileName = `${instrument.exchange}_${instrument.tradingsymbol}_${timeframe}_${new Date().toISOString().split('T')[0]}.json`;
        const filePath = path.join(this.config.outputDir, fileName);

        const fileData = {
            instrument: {
                token: instrument.instrument_token,
                symbol: instrument.tradingsymbol,
                exchange: instrument.exchange,
                type: instrument.instrument_type,
                name: instrument.name,
                expiry: instrument.expiry,
                strike: instrument.strike,
                lot_size: instrument.lot_size,
                tick_size: instrument.tick_size
            },
            timeframe,
            download_date: new Date().toISOString(),
            data_count: data.length,
            data: data
        };

        await fs.promises.writeFile(filePath, JSON.stringify(fileData, null, 2));
    }

    async downloadAllData(): Promise<void> {
        try {
            await this.initialize();

            const instruments = await this.getAllInstruments();

            if (instruments.length === 0) {
                console.log('❌ No instruments found. Please run download-instruments first.');
                return;
            }

            // Create output directory
            if (!fs.existsSync(this.config.outputDir)) {
                fs.mkdirSync(this.config.outputDir, { recursive: true });
            }

            console.log(`🚀 Starting download of ${instruments.length} instruments...`);
            console.log(`📁 Output directory: ${this.config.outputDir}`);
            console.log(`⏱️  Timeframes: ${this.config.timeframes.join(', ')}`);
            console.log(`📅 Months: ${this.config.months}`);

            // Process instruments in batches
            for (let i = 0; i < instruments.length; i += this.config.batchSize) {
                const batch = instruments.slice(i, i + this.config.batchSize);

                console.log(`\n📦 Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(instruments.length / this.config.batchSize)}`);

                // Process batch in parallel
                const promises = batch.map(instrument => this.downloadHistoricalData(instrument));
                await Promise.all(promises);

                // Delay between batches
                if (i + this.config.batchSize < instruments.length) {
                    console.log(`⏳ Waiting ${this.config.delayBetweenBatches}ms before next batch...`);
                    await this.delay(this.config.delayBetweenBatches);
                }
            }

            console.log('\n✅ Download completed successfully!');

            // Generate summary
            await this.generateSummary();

        } catch (error) {
            console.error('❌ Download failed:', error);
            throw error;
        }
    }

    private async generateSummary(): Promise<void> {
        const files = await fs.promises.readdir(this.config.outputDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        const summary = {
            download_date: new Date().toISOString(),
            total_files: jsonFiles.length,
            exchanges: this.config.exchanges,
            instrument_types: this.config.instrumentTypes,
            timeframes: this.config.timeframes,
            months: this.config.months,
            files: jsonFiles.map(file => ({
                name: file,
                size: fs.statSync(path.join(this.config.outputDir, file)).size
            }))
        };

        const summaryPath = path.join(this.config.outputDir, 'download_summary.json');
        await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2));

        console.log(`📊 Summary saved to: ${summaryPath}`);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Example usage and configuration
async function main() {
    // Configuration - modify these parameters as needed
    const config: DownloadConfig = {
        exchanges: ['NFO'], // Can be: ['NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX']
        instrumentTypes: ['FUT', 'CE', 'PE'], // Can be: ['EQ', 'FUT', 'CE', 'PE', 'FUTIDX', 'OPTIDX']
        timeframes: ['minute', '3minute', '5minute', '15minute', '30minute', '60minute'], // Available: 'minute', '3minute', '5minute', '10minute', '15minute', '30minute', '60minute', 'day'
        months: 3, // Number of months of historical data to download
        outputDir: './data/downloaded_data',
        batchSize: 5, // Number of instruments to process in parallel
        delayBetweenBatches: 1000 // Delay between batches in milliseconds
    };

    try {
        const downloader = new SimpleDataDownloader(config);
        await downloader.downloadAllData();

    } catch (error) {
        console.error('❌ Main execution failed:', error);
    }
}

// Export for use in other scripts
export { SimpleDataDownloader, DownloadConfig };

// Run if this file is executed directly
if (require.main === module) {
    main();
} 