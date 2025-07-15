"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptionsStrategy = void 0;
const strategy_engine_service_1 = require("../strategy-engine.service");
class OptionsStrategy extends strategy_engine_service_1.BaseStrategy {
    constructor() {
        super('Options Strategy', 'OPTIONS_STRATEGY', '1.0.0', 'Comprehensive options trading strategy for various market conditions');
        this.optionsPositions = new Map();
    }
    async generateSignals(marketData) {
        const signals = [];
        const strategyType = this.config.parameters.strategyType || 'COVERED_CALL';
        switch (strategyType) {
            case 'COVERED_CALL':
                signals.push(...await this.generateCoveredCallSignals(marketData));
                break;
            case 'PROTECTIVE_PUT':
                signals.push(...await this.generateProtectivePutSignals(marketData));
                break;
            case 'IRON_CONDOR':
                signals.push(...await this.generateIronCondorSignals(marketData));
                break;
            case 'BUTTERFLY_SPREAD':
                signals.push(...await this.generateButterflySpreadSignals(marketData));
                break;
            case 'STRADDLE':
                signals.push(...await this.generateStraddleSignals(marketData));
                break;
            case 'STRANGLE':
                signals.push(...await this.generateStrangleSignals(marketData));
                break;
            case 'BULL_CALL_SPREAD':
                signals.push(...await this.generateBullCallSpreadSignals(marketData));
                break;
            case 'BEAR_PUT_SPREAD':
                signals.push(...await this.generateBearPutSpreadSignals(marketData));
                break;
            case 'CALENDAR_SPREAD':
                signals.push(...await this.generateCalendarSpreadSignals(marketData));
                break;
            default:
                logger.warn(`Unknown options strategy type: ${strategyType}`);
        }
        return signals;
    }
    async shouldExit(position, marketData) {
        const optionsPosition = this.optionsPositions.get(position.id);
        if (!optionsPosition)
            return false;
        const currentPrice = marketData[marketData.length - 1]?.close || marketData[marketData.length - 1]?.ltp;
        if (!currentPrice)
            return false;
        const daysToExpiry = this.calculateDaysToExpiry(optionsPosition.contracts[0]?.expiry);
        if (daysToExpiry <= 5 && optionsPosition.netTheta < -0.1) {
            return true;
        }
        const unrealizedPnL = this.calculateUnrealizedPnL(optionsPosition, currentPrice);
        const maxProfit = optionsPosition.maxProfit;
        if (unrealizedPnL >= maxProfit * 0.8) {
            return true;
        }
        const maxLoss = optionsPosition.maxLoss;
        if (unrealizedPnL <= maxLoss * 0.5) {
            return true;
        }
        if (Math.abs(optionsPosition.netDelta) > this.config.parameters.maxDelta || 0.5) {
            return true;
        }
        return false;
    }
    async generateCoveredCallSignals(marketData) {
        const signals = [];
        if (marketData.length < 20)
            return signals;
        const currentData = marketData[marketData.length - 1];
        if (!currentData)
            return signals;
        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice)
            return signals;
        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 30;
        const optimalStrike = this.findOptimalCoveredCallStrike(underlyingPrice, volatility, daysToExpiry);
        if (optimalStrike) {
            const signal = this.createOptionsSignal(currentData, 'SELL', {
                strategyType: 'COVERED_CALL',
                underlyingSymbol: currentData.symbol,
                strike: optimalStrike,
                optionType: 'CE',
                daysToExpiry,
                volatility,
                maxProfit: optimalStrike - underlyingPrice,
                maxLoss: -underlyingPrice,
                breakEvenPoint: optimalStrike
            });
            if (signal) {
                signals.push(signal);
            }
        }
        return signals;
    }
    async generateProtectivePutSignals(marketData) {
        const signals = [];
        if (marketData.length < 20)
            return signals;
        const currentData = marketData[marketData.length - 1];
        if (!currentData)
            return signals;
        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice)
            return signals;
        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 30;
        const optimalStrike = this.findOptimalProtectivePutStrike(underlyingPrice, volatility, daysToExpiry);
        if (optimalStrike) {
            const signal = this.createOptionsSignal(currentData, 'BUY', {
                strategyType: 'PROTECTIVE_PUT',
                underlyingSymbol: currentData.symbol,
                strike: optimalStrike,
                optionType: 'PE',
                daysToExpiry,
                volatility,
                maxProfit: Infinity,
                maxLoss: -optimalStrike,
                breakEvenPoint: underlyingPrice + optimalStrike
            });
            if (signal) {
                signals.push(signal);
            }
        }
        return signals;
    }
    async generateIronCondorSignals(marketData) {
        const signals = [];
        if (marketData.length < 20)
            return signals;
        const currentData = marketData[marketData.length - 1];
        if (!currentData)
            return signals;
        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice)
            return signals;
        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 45;
        const ironCondorStrikes = this.calculateIronCondorStrikes(underlyingPrice, volatility, daysToExpiry);
        if (ironCondorStrikes) {
            const signal = this.createOptionsSignal(currentData, 'SELL', {
                strategyType: 'IRON_CONDOR',
                underlyingSymbol: currentData.symbol,
                strikes: ironCondorStrikes,
                daysToExpiry,
                volatility,
                maxProfit: ironCondorStrikes.netCredit,
                maxLoss: ironCondorStrikes.maxLoss,
                breakEvenPoints: [ironCondorStrikes.putShort, ironCondorStrikes.callShort]
            });
            if (signal) {
                signals.push(signal);
            }
        }
        return signals;
    }
    async generateButterflySpreadSignals(marketData) {
        const signals = [];
        if (marketData.length < 20)
            return signals;
        const currentData = marketData[marketData.length - 1];
        if (!currentData)
            return signals;
        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice)
            return signals;
        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 30;
        const butterflyStrikes = this.calculateButterflySpreadStrikes(underlyingPrice, volatility, daysToExpiry);
        if (butterflyStrikes) {
            const signal = this.createOptionsSignal(currentData, 'BUY', {
                strategyType: 'BUTTERFLY_SPREAD',
                underlyingSymbol: currentData.symbol,
                strikes: butterflyStrikes,
                daysToExpiry,
                volatility,
                maxProfit: butterflyStrikes.maxProfit,
                maxLoss: butterflyStrikes.netDebit,
                breakEvenPoints: [butterflyStrikes.lowerBreakEven, butterflyStrikes.upperBreakEven]
            });
            if (signal) {
                signals.push(signal);
            }
        }
        return signals;
    }
    async generateStraddleSignals(marketData) {
        const signals = [];
        if (marketData.length < 20)
            return signals;
        const currentData = marketData[marketData.length - 1];
        if (!currentData)
            return signals;
        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice)
            return signals;
        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 30;
        const volatilityExpansion = this.detectVolatilityExpansion(marketData);
        if (volatilityExpansion) {
            const signal = this.createOptionsSignal(currentData, 'BUY', {
                strategyType: 'STRADDLE',
                underlyingSymbol: currentData.symbol,
                strike: underlyingPrice,
                daysToExpiry,
                volatility,
                maxProfit: Infinity,
                maxLoss: -this.calculateStraddleCost(underlyingPrice, volatility, daysToExpiry),
                breakEvenPoints: [
                    underlyingPrice - this.calculateStraddleCost(underlyingPrice, volatility, daysToExpiry),
                    underlyingPrice + this.calculateStraddleCost(underlyingPrice, volatility, daysToExpiry)
                ]
            });
            if (signal) {
                signals.push(signal);
            }
        }
        return signals;
    }
    async generateStrangleSignals(marketData) {
        const signals = [];
        if (marketData.length < 20)
            return signals;
        const currentData = marketData[marketData.length - 1];
        if (!currentData)
            return signals;
        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice)
            return signals;
        const volatility = this.calculateVolatility(marketData);
        const daysToExpiry = this.config.parameters.daysToExpiry || 30;
        const strangleStrikes = this.calculateStrangleStrikes(underlyingPrice, volatility, daysToExpiry);
        if (strangleStrikes) {
            const signal = this.createOptionsSignal(currentData, 'BUY', {
                strategyType: 'STRANGLE',
                underlyingSymbol: currentData.symbol,
                strikes: strangleStrikes,
                daysToExpiry,
                volatility,
                maxProfit: Infinity,
                maxLoss: -strangleStrikes.netDebit,
                breakEvenPoints: [strangleStrikes.putStrike, strangleStrikes.callStrike]
            });
            if (signal) {
                signals.push(signal);
            }
        }
        return signals;
    }
    async generateBullCallSpreadSignals(marketData) {
        const signals = [];
        if (marketData.length < 20)
            return signals;
        const currentData = marketData[marketData.length - 1];
        if (!currentData)
            return signals;
        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice)
            return signals;
        const isBullish = this.detectBullishTrend(marketData);
        if (isBullish) {
            const volatility = this.calculateVolatility(marketData);
            const daysToExpiry = this.config.parameters.daysToExpiry || 30;
            const bullCallStrikes = this.calculateBullCallSpreadStrikes(underlyingPrice, volatility, daysToExpiry);
            if (bullCallStrikes) {
                const signal = this.createOptionsSignal(currentData, 'BUY', {
                    strategyType: 'BULL_CALL_SPREAD',
                    underlyingSymbol: currentData.symbol,
                    strikes: bullCallStrikes,
                    daysToExpiry,
                    volatility,
                    maxProfit: bullCallStrikes.maxProfit,
                    maxLoss: bullCallStrikes.netDebit,
                    breakEvenPoint: bullCallStrikes.breakEven
                });
                if (signal) {
                    signals.push(signal);
                }
            }
        }
        return signals;
    }
    async generateBearPutSpreadSignals(marketData) {
        const signals = [];
        if (marketData.length < 20)
            return signals;
        const currentData = marketData[marketData.length - 1];
        if (!currentData)
            return signals;
        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice)
            return signals;
        const isBearish = this.detectBearishTrend(marketData);
        if (isBearish) {
            const volatility = this.calculateVolatility(marketData);
            const daysToExpiry = this.config.parameters.daysToExpiry || 30;
            const bearPutStrikes = this.calculateBearPutSpreadStrikes(underlyingPrice, volatility, daysToExpiry);
            if (bearPutStrikes) {
                const signal = this.createOptionsSignal(currentData, 'BUY', {
                    strategyType: 'BEAR_PUT_SPREAD',
                    underlyingSymbol: currentData.symbol,
                    strikes: bearPutStrikes,
                    daysToExpiry,
                    volatility,
                    maxProfit: bearPutStrikes.maxProfit,
                    maxLoss: bearPutStrikes.netDebit,
                    breakEvenPoint: bearPutStrikes.breakEven
                });
                if (signal) {
                    signals.push(signal);
                }
            }
        }
        return signals;
    }
    async generateCalendarSpreadSignals(marketData) {
        const signals = [];
        if (marketData.length < 20)
            return signals;
        const currentData = marketData[marketData.length - 1];
        if (!currentData)
            return signals;
        const underlyingPrice = currentData.close || currentData.ltp;
        if (!underlyingPrice)
            return signals;
        const volatility = this.calculateVolatility(marketData);
        const shortExpiry = this.config.parameters.shortExpiry || 30;
        const longExpiry = this.config.parameters.longExpiry || 60;
        const isLowVolatility = volatility < this.config.parameters.volatilityThreshold || 0.2;
        if (isLowVolatility) {
            const calendarStrikes = this.calculateCalendarSpreadStrikes(underlyingPrice, volatility, shortExpiry, longExpiry);
            if (calendarStrikes) {
                const signal = this.createOptionsSignal(currentData, 'BUY', {
                    strategyType: 'CALENDAR_SPREAD',
                    underlyingSymbol: currentData.symbol,
                    strikes: calendarStrikes,
                    shortExpiry,
                    longExpiry,
                    volatility,
                    maxProfit: calendarStrikes.maxProfit,
                    maxLoss: calendarStrikes.netDebit,
                    breakEvenPoint: underlyingPrice
                });
                if (signal) {
                    signals.push(signal);
                }
            }
        }
        return signals;
    }
    findOptimalCoveredCallStrike(underlyingPrice, volatility, daysToExpiry) {
        const targetDelta = 0.35;
        const strike = underlyingPrice * (1 + targetDelta * volatility * Math.sqrt(daysToExpiry / 365));
        return Math.round(strike / 50) * 50;
    }
    findOptimalProtectivePutStrike(underlyingPrice, volatility, daysToExpiry) {
        const targetDelta = -0.25;
        const strike = underlyingPrice * (1 + targetDelta * volatility * Math.sqrt(daysToExpiry / 365));
        return Math.round(strike / 50) * 50;
    }
    calculateIronCondorStrikes(underlyingPrice, volatility, daysToExpiry) {
        const putShort = Math.round((underlyingPrice * 0.95) / 50) * 50;
        const putLong = putShort - 100;
        const callShort = Math.round((underlyingPrice * 1.05) / 50) * 50;
        const callLong = callShort + 100;
        const netCredit = 50;
        const maxLoss = 50;
        return {
            putLong,
            putShort,
            callShort,
            callLong,
            netCredit,
            maxLoss
        };
    }
    calculateButterflySpreadStrikes(underlyingPrice, volatility, daysToExpiry) {
        const centerStrike = Math.round(underlyingPrice / 50) * 50;
        const lowerStrike = centerStrike - 100;
        const upperStrike = centerStrike + 100;
        const maxProfit = 50;
        const netDebit = 25;
        return {
            lowerStrike,
            centerStrike,
            upperStrike,
            maxProfit,
            netDebit,
            lowerBreakEven: centerStrike - netDebit,
            upperBreakEven: centerStrike + netDebit
        };
    }
    calculateStrangleStrikes(underlyingPrice, volatility, daysToExpiry) {
        const putStrike = Math.round((underlyingPrice * 0.90) / 50) * 50;
        const callStrike = Math.round((underlyingPrice * 1.10) / 50) * 50;
        const netDebit = 30;
        return {
            putStrike,
            callStrike,
            netDebit
        };
    }
    calculateBullCallSpreadStrikes(underlyingPrice, volatility, daysToExpiry) {
        const callLong = Math.round(underlyingPrice / 50) * 50;
        const callShort = callLong + 100;
        const maxProfit = 50;
        const netDebit = 25;
        return {
            callLong,
            callShort,
            maxProfit,
            netDebit,
            breakEven: callLong + netDebit
        };
    }
    calculateBearPutSpreadStrikes(underlyingPrice, volatility, daysToExpiry) {
        const putShort = Math.round(underlyingPrice / 50) * 50;
        const putLong = putShort - 100;
        const maxProfit = 50;
        const netDebit = 25;
        return {
            putLong,
            putShort,
            maxProfit,
            netDebit,
            breakEven: putShort - netDebit
        };
    }
    calculateCalendarSpreadStrikes(underlyingPrice, volatility, shortExpiry, longExpiry) {
        const strike = Math.round(underlyingPrice / 50) * 50;
        const maxProfit = 20;
        const netDebit = 10;
        return {
            strike,
            shortExpiry,
            longExpiry,
            maxProfit,
            netDebit
        };
    }
    calculateStraddleCost(underlyingPrice, volatility, daysToExpiry) {
        return underlyingPrice * volatility * Math.sqrt(daysToExpiry / 365) * 2;
    }
    detectVolatilityExpansion(marketData) {
        if (marketData.length < 20)
            return false;
        const recentVolatility = this.calculateVolatility(marketData.slice(-10));
        const historicalVolatility = this.calculateVolatility(marketData.slice(-20, -10));
        return recentVolatility > historicalVolatility * 1.2;
    }
    detectBullishTrend(marketData) {
        if (marketData.length < 20)
            return false;
        const shortMA = this.calculateSMA(marketData, 10);
        const longMA = this.calculateSMA(marketData, 20);
        const currentShortMA = shortMA[shortMA.length - 1];
        const currentLongMA = longMA[longMA.length - 1];
        return currentShortMA && currentLongMA && currentShortMA > currentLongMA;
    }
    detectBearishTrend(marketData) {
        if (marketData.length < 20)
            return false;
        const shortMA = this.calculateSMA(marketData, 10);
        const longMA = this.calculateSMA(marketData, 20);
        const currentShortMA = shortMA[shortMA.length - 1];
        const currentLongMA = longMA[longMA.length - 1];
        return currentShortMA && currentLongMA && currentShortMA < currentLongMA;
    }
    calculateVolatility(marketData) {
        if (marketData.length < 2)
            return 0;
        const returns = [];
        for (let i = 1; i < marketData.length; i++) {
            const currentPrice = marketData[i]?.close || marketData[i]?.ltp;
            const prevPrice = marketData[i - 1]?.close || marketData[i - 1]?.ltp;
            if (currentPrice && prevPrice) {
                returns.push(Math.log(currentPrice / prevPrice));
            }
        }
        if (returns.length === 0)
            return 0;
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        return Math.sqrt(variance * 252);
    }
    calculateSMA(data, period) {
        const sma = new Array(data.length).fill(null);
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = i - period + 1; j <= i; j++) {
                const price = data[j]?.close || data[j]?.ltp;
                if (typeof price === 'number') {
                    sum += price;
                    count++;
                }
            }
            if (count === period) {
                sma[i] = sum / period;
            }
        }
        return sma;
    }
    calculateDaysToExpiry(expiry) {
        const now = new Date();
        const diffTime = expiry.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    calculateUnrealizedPnL(position, currentPrice) {
        return position.maxProfit * 0.5;
    }
    createOptionsSignal(data, action, metadata) {
        const price = data.close || data.ltp;
        if (!price || !data.symbol)
            return null;
        return {
            id: `options_signal_${Date.now()}_${Math.random()}`,
            strategy: this.name,
            symbol: data.symbol,
            action,
            quantity: 1,
            price,
            timestamp: new Date(data.timestamp),
            metadata: {
                ...metadata,
                strategyType: this.type,
                version: this.version,
                isOptionsStrategy: true
            }
        };
    }
    validateConfig(config) {
        const baseValid = super.validateConfig(config);
        if (!baseValid)
            return false;
        const { strategyType, daysToExpiry, volatilityThreshold } = config.parameters;
        if (!strategyType) {
            return false;
        }
        if (daysToExpiry && (daysToExpiry < 1 || daysToExpiry > 365)) {
            return false;
        }
        if (volatilityThreshold && (volatilityThreshold < 0 || volatilityThreshold > 1)) {
            return false;
        }
        return true;
    }
}
exports.OptionsStrategy = OptionsStrategy;
//# sourceMappingURL=options-strategy.js.map