import { logger } from '../logger/logger';

// Risk metrics and calculations
export interface RiskMetrics {
    var95: number;           // 95% Value at Risk
    var99: number;           // 99% Value at Risk
    maxDrawdown: number;     // Maximum drawdown
    sharpeRatio: number;     // Sharpe ratio
    sortinoRatio: number;    // Sortino ratio
    calmarRatio: number;     // Calmar ratio
    volatility: number;      // Portfolio volatility
    beta: number;           // Market beta
    correlation: number;     // Market correlation
    expectedReturn: number;  // Expected return
    downsideDeviation: number; // Downside deviation
}

// Position risk assessment
export interface PositionRisk {
    symbol: string;
    side: 'LONG' | 'SHORT';
    quantity: number;
    currentPrice: number;
    entryPrice: number;
    unrealizedPnL: number;
    marketValue: number;
    riskExposure: number;
    varContribution: number;
    betaContribution: number;
    correlationRisk: number;
    liquidityRisk: number;
    concentrationRisk: number;
    leverageRisk: number;
    overallRiskScore: number; // 0-100
}

// Portfolio risk limits
export interface RiskLimits {
    maxPortfolioVar: number;      // Maximum portfolio VaR
    maxPositionVar: number;       // Maximum position VaR
    maxDrawdownLimit: number;     // Maximum drawdown limit
    maxLeverage: number;          // Maximum leverage
    maxConcentration: number;     // Maximum position concentration
    maxCorrelation: number;       // Maximum correlation between positions
    minSharpeRatio: number;       // Minimum Sharpe ratio
    maxVolatility: number;        // Maximum portfolio volatility
    maxBeta: number;              // Maximum portfolio beta
    maxDailyLoss: number;         // Maximum daily loss
    maxWeeklyLoss: number;        // Maximum weekly loss
    maxMonthlyLoss: number;       // Maximum monthly loss
}

// Risk alerts and notifications
export interface RiskAlert {
    type: 'WARNING' | 'CRITICAL' | 'EMERGENCY';
    message: string;
    metric: string;
    currentValue: number;
    limit: number;
    timestamp: Date;
    action: string;
}

export class AdvancedRiskService {
    private riskLimits: RiskLimits;
    private historicalReturns: number[] = [];
    private positionHistory: PositionRisk[] = [];
    private alerts: RiskAlert[] = [];

    constructor(limits: Partial<RiskLimits> = {}) {
        this.riskLimits = {
            maxPortfolioVar: 0.02,        // 2% portfolio VaR
            maxPositionVar: 0.005,        // 0.5% position VaR
            maxDrawdownLimit: 0.15,       // 15% max drawdown
            maxLeverage: 2.0,             // 2x leverage
            maxConcentration: 0.25,       // 25% max concentration
            maxCorrelation: 0.7,          // 70% max correlation
            minSharpeRatio: 1.0,          // Minimum Sharpe ratio
            maxVolatility: 0.25,          // 25% max volatility
            maxBeta: 1.5,                 // 1.5 max beta
            maxDailyLoss: 0.05,           // 5% max daily loss
            maxWeeklyLoss: 0.15,          // 15% max weekly loss
            maxMonthlyLoss: 0.30,         // 30% max monthly loss
            ...limits
        };

        logger.info('Advanced Risk Service initialized', { limits: this.riskLimits });
    }

    /**
     * Calculate Value at Risk (VaR) using historical simulation
     */
    calculateVaR(returns: number[], confidence: number = 0.95): number {
        if (returns.length === 0) return 0;

        const sortedReturns = [...returns].sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * sortedReturns.length);
        return Math.abs(sortedReturns[index] || 0);
    }

    /**
     * Calculate portfolio risk metrics
     */
    calculatePortfolioRisk(
        positions: PositionRisk[],
        marketData: any[],
        riskFreeRate: number = 0.05
    ): RiskMetrics {
        if (positions.length === 0) {
            return this.getDefaultRiskMetrics();
        }

        // Calculate portfolio returns
        const portfolioReturns = this.calculatePortfolioReturns(positions, marketData);

        // Calculate metrics
        const meanReturn = portfolioReturns.reduce((sum, ret) => sum + ret, 0) / portfolioReturns.length;
        const variance = portfolioReturns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / portfolioReturns.length;
        const volatility = Math.sqrt(variance);

        // Calculate downside deviation
        const downsideReturns = portfolioReturns.filter(ret => ret < meanReturn);
        const downsideDeviation = downsideReturns.length > 0
            ? Math.sqrt(downsideReturns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / downsideReturns.length)
            : 0;

        // Calculate VaR
        const var95 = this.calculateVaR(portfolioReturns, 0.95);
        const var99 = this.calculateVaR(portfolioReturns, 0.99);

        // Calculate ratios
        const sharpeRatio = volatility > 0 ? (meanReturn - riskFreeRate) / volatility : 0;
        const sortinoRatio = downsideDeviation > 0 ? (meanReturn - riskFreeRate) / downsideDeviation : 0;

        // Calculate max drawdown
        const maxDrawdown = this.calculateMaxDrawdown(portfolioReturns);
        const calmarRatio = maxDrawdown > 0 ? meanReturn / maxDrawdown : 0;

        // Calculate beta and correlation
        const { beta, correlation } = this.calculateBetaAndCorrelation(portfolioReturns, marketData);

        return {
            var95,
            var99,
            maxDrawdown,
            sharpeRatio,
            sortinoRatio,
            calmarRatio,
            volatility,
            beta,
            correlation,
            expectedReturn: meanReturn,
            downsideDeviation
        };
    }

    /**
     * Assess risk for a new position
     */
    assessPositionRisk(
        symbol: string,
        side: 'LONG' | 'SHORT',
        quantity: number,
        currentPrice: number,
        portfolio: PositionRisk[],
        marketData: any[]
    ): PositionRisk {
        const marketValue = quantity * currentPrice;

        // Calculate various risk metrics
        const riskExposure = this.calculateRiskExposure(marketValue, portfolio);
        const varContribution = this.calculateVaRContribution(symbol, quantity, currentPrice, portfolio);
        const betaContribution = this.calculateBetaContribution(symbol, marketValue, portfolio);
        const correlationRisk = this.calculateCorrelationRisk(symbol, portfolio);
        const liquidityRisk = this.calculateLiquidityRisk(symbol, quantity, currentPrice);
        const concentrationRisk = this.calculateConcentrationRisk(marketValue, portfolio);
        const leverageRisk = this.calculateLeverageRisk(marketValue, portfolio);

        // Calculate overall risk score (0-100)
        const overallRiskScore = this.calculateOverallRiskScore({
            riskExposure,
            varContribution,
            betaContribution,
            correlationRisk,
            liquidityRisk,
            concentrationRisk,
            leverageRisk
        });

        return {
            symbol,
            side,
            quantity,
            currentPrice,
            entryPrice: currentPrice,
            unrealizedPnL: 0,
            marketValue,
            riskExposure,
            varContribution,
            betaContribution,
            correlationRisk,
            liquidityRisk,
            concentrationRisk,
            leverageRisk,
            overallRiskScore
        };
    }

    /**
     * Check if a trade meets risk requirements
     */
    validateTrade(
        position: PositionRisk,
        portfolio: PositionRisk[],
        marketData: any[]
    ): { isValid: boolean; alerts: RiskAlert[] } {
        const alerts: RiskAlert[] = [];

        // Check VaR limits
        if (position.varContribution > this.riskLimits.maxPositionVar) {
            alerts.push({
                type: 'CRITICAL',
                message: `Position VaR exceeds limit`,
                metric: 'VaR',
                currentValue: position.varContribution,
                limit: this.riskLimits.maxPositionVar,
                timestamp: new Date(),
                action: 'Reduce position size or choose different instrument'
            });
        }

        // Check concentration limits
        if (position.concentrationRisk > this.riskLimits.maxConcentration) {
            alerts.push({
                type: 'WARNING',
                message: `Position concentration too high`,
                metric: 'Concentration',
                currentValue: position.concentrationRisk,
                limit: this.riskLimits.maxConcentration,
                timestamp: new Date(),
                action: 'Consider diversifying portfolio'
            });
        }

        // Check correlation limits
        if (position.correlationRisk > this.riskLimits.maxCorrelation) {
            alerts.push({
                type: 'WARNING',
                message: `High correlation with existing positions`,
                metric: 'Correlation',
                currentValue: position.correlationRisk,
                limit: this.riskLimits.maxCorrelation,
                timestamp: new Date(),
                action: 'Consider uncorrelated instruments'
            });
        }

        // Check overall risk score
        if (position.overallRiskScore > 80) {
            alerts.push({
                type: 'CRITICAL',
                message: `Overall risk score too high`,
                metric: 'Risk Score',
                currentValue: position.overallRiskScore,
                limit: 80,
                timestamp: new Date(),
                action: 'Reconsider trade or reduce size'
            });
        }

        // Check portfolio-level limits
        const newPortfolio = [...portfolio, position];
        const portfolioRisk = this.calculatePortfolioRisk(newPortfolio, marketData);

        if (portfolioRisk.var95 > this.riskLimits.maxPortfolioVar) {
            alerts.push({
                type: 'EMERGENCY',
                message: `Portfolio VaR exceeds limit`,
                metric: 'Portfolio VaR',
                currentValue: portfolioRisk.var95,
                limit: this.riskLimits.maxPortfolioVar,
                timestamp: new Date(),
                action: 'Close some positions immediately'
            });
        }

        if (portfolioRisk.volatility > this.riskLimits.maxVolatility) {
            alerts.push({
                type: 'WARNING',
                message: `Portfolio volatility too high`,
                metric: 'Volatility',
                currentValue: portfolioRisk.volatility,
                limit: this.riskLimits.maxVolatility,
                timestamp: new Date(),
                action: 'Reduce portfolio risk'
            });
        }

        const isValid = alerts.filter(alert => alert.type === 'EMERGENCY').length === 0;
        return { isValid, alerts };
    }

    /**
     * Calculate optimal position size based on risk
     */
    calculateOptimalPositionSize(
        symbol: string,
        currentPrice: number,
        portfolio: PositionRisk[],
        availableCapital: number,
        maxRiskPerTrade: number
    ): { quantity: number; riskScore: number } {
        // Start with maximum possible quantity
        let maxQuantity = Math.floor(availableCapital / currentPrice);
        let optimalQuantity = 0;
        let optimalRiskScore = 100;

        // Binary search for optimal quantity
        let low = 0;
        let high = maxQuantity;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);

            if (mid === 0) break;

            const position = this.assessPositionRisk(symbol, 'LONG', mid, currentPrice, portfolio, []);

            if (position.overallRiskScore <= 70 && position.riskExposure <= maxRiskPerTrade) {
                optimalQuantity = mid;
                optimalRiskScore = position.overallRiskScore;
                low = mid + 1; // Try larger quantity
            } else {
                high = mid - 1; // Try smaller quantity
            }
        }

        return { quantity: optimalQuantity, riskScore: optimalRiskScore };
    }

    /**
     * Generate risk report
     */
    generateRiskReport(
        portfolio: PositionRisk[],
        marketData: any[]
    ): {
        portfolioRisk: RiskMetrics;
        positionRisks: PositionRisk[];
        alerts: RiskAlert[];
        recommendations: string[];
    } {
        const portfolioRisk = this.calculatePortfolioRisk(portfolio, marketData);
        const alerts = this.generateAlerts(portfolioRisk, portfolio);
        const recommendations = this.generateRecommendations(portfolioRisk, portfolio);

        return {
            portfolioRisk,
            positionRisks: portfolio,
            alerts,
            recommendations
        };
    }

    // Private helper methods
    private calculatePortfolioReturns(positions: PositionRisk[], marketData: any[]): number[] {
        // Simplified calculation - in real implementation, use actual price data
        return positions.map(() => (Math.random() - 0.5) * 0.1); // Mock returns
    }

    private calculateMaxDrawdown(returns: number[]): number {
        let maxDrawdown = 0;
        let peak = 1;
        let cumulative = 1;

        for (const ret of returns) {
            cumulative *= (1 + ret);
            if (cumulative > peak) {
                peak = cumulative;
            }
            const drawdown = (peak - cumulative) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        }

        return maxDrawdown;
    }

    private calculateBetaAndCorrelation(portfolioReturns: number[], marketData: any[]): { beta: number; correlation: number } {
        // Simplified calculation
        return { beta: 1.0, correlation: 0.5 };
    }

    private calculateRiskExposure(marketValue: number, portfolio: PositionRisk[]): number {
        const totalValue = portfolio.reduce((sum, pos) => sum + pos.marketValue, 0) + marketValue;
        return marketValue / totalValue;
    }

    private calculateVaRContribution(symbol: string, quantity: number, price: number, portfolio: PositionRisk[]): number {
        // Simplified VaR contribution calculation
        return (quantity * price * 0.02) / 100; // 2% VaR assumption
    }

    private calculateBetaContribution(symbol: string, marketValue: number, portfolio: PositionRisk[]): number {
        // Simplified beta contribution
        return marketValue * 1.0; // Assume beta of 1.0
    }

    private calculateCorrelationRisk(symbol: string, portfolio: PositionRisk[]): number {
        // Simplified correlation risk
        return portfolio.length > 0 ? 0.3 : 0; // 30% correlation assumption
    }

    private calculateLiquidityRisk(symbol: string, quantity: number, price: number): number {
        // Simplified liquidity risk based on position size
        const positionValue = quantity * price;
        return positionValue > 1000000 ? 0.8 : 0.2; // High risk for large positions
    }

    private calculateConcentrationRisk(marketValue: number, portfolio: PositionRisk[]): number {
        const totalValue = portfolio.reduce((sum, pos) => sum + pos.marketValue, 0) + marketValue;
        return marketValue / totalValue;
    }

    private calculateLeverageRisk(marketValue: number, portfolio: PositionRisk[]): number {
        const totalValue = portfolio.reduce((sum, pos) => sum + pos.marketValue, 0) + marketValue;
        // Simplified leverage calculation
        return totalValue > 1000000 ? 0.6 : 0.2;
    }

    private calculateOverallRiskScore(risks: {
        riskExposure: number;
        varContribution: number;
        betaContribution: number;
        correlationRisk: number;
        liquidityRisk: number;
        concentrationRisk: number;
        leverageRisk: number;
    }): number {
        const weights = {
            riskExposure: 0.2,
            varContribution: 0.25,
            betaContribution: 0.15,
            correlationRisk: 0.1,
            liquidityRisk: 0.1,
            concentrationRisk: 0.1,
            leverageRisk: 0.1
        };

        return Object.entries(risks).reduce((score, [key, value]) => {
            return score + (value * weights[key as keyof typeof weights] * 100);
        }, 0);
    }

    private generateAlerts(portfolioRisk: RiskMetrics, portfolio: PositionRisk[]): RiskAlert[] {
        const alerts: RiskAlert[] = [];

        if (portfolioRisk.var95 > this.riskLimits.maxPortfolioVar) {
            alerts.push({
                type: 'CRITICAL',
                message: 'Portfolio VaR exceeds limit',
                metric: 'VaR',
                currentValue: portfolioRisk.var95,
                limit: this.riskLimits.maxPortfolioVar,
                timestamp: new Date(),
                action: 'Reduce portfolio risk'
            });
        }

        if (portfolioRisk.volatility > this.riskLimits.maxVolatility) {
            alerts.push({
                type: 'WARNING',
                message: 'Portfolio volatility too high',
                metric: 'Volatility',
                currentValue: portfolioRisk.volatility,
                limit: this.riskLimits.maxVolatility,
                timestamp: new Date(),
                action: 'Diversify portfolio'
            });
        }

        return alerts;
    }

    private generateRecommendations(portfolioRisk: RiskMetrics, portfolio: PositionRisk[]): string[] {
        const recommendations: string[] = [];

        if (portfolioRisk.sharpeRatio < this.riskLimits.minSharpeRatio) {
            recommendations.push('Consider improving risk-adjusted returns by optimizing position sizing');
        }

        if (portfolioRisk.correlation > this.riskLimits.maxCorrelation) {
            recommendations.push('Add uncorrelated instruments to reduce portfolio correlation');
        }

        if (portfolio.length < 5) {
            recommendations.push('Consider diversifying with more instruments');
        }

        return recommendations;
    }

    private getDefaultRiskMetrics(): RiskMetrics {
        return {
            var95: 0,
            var99: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            sortinoRatio: 0,
            calmarRatio: 0,
            volatility: 0,
            beta: 0,
            correlation: 0,
            expectedReturn: 0,
            downsideDeviation: 0
        };
    }
} 