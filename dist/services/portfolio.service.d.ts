import { PortfolioMetrics, PortfolioAllocation, RebalanceAction, PortfolioPosition } from '../types/portfolio.types';
export declare class PortfolioService {
    private marketDataService;
    private orderService;
    constructor();
    getPortfolioMetrics(sessionId: string): Promise<PortfolioMetrics>;
    getPositions(sessionId: string): Promise<PortfolioPosition[]>;
    rebalancePortfolio(sessionId: string, targetAllocations: PortfolioAllocation[]): Promise<RebalanceAction[]>;
    private getHistoricalReturns;
    private calculateRiskMetrics;
    private calculateReturns;
}
//# sourceMappingURL=portfolio.service.d.ts.map