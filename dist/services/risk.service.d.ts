import { RiskProfile, RiskMetrics } from '../types';
export declare class RiskService {
    createRiskProfile(userId: string, profile: Omit<RiskProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<RiskProfile>;
    updateRiskProfile(id: string, profile: Partial<Omit<RiskProfile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<RiskProfile>;
    getRiskProfile(userId: string): Promise<RiskProfile | null>;
    updateRiskMetrics(sessionId: string, metrics: Partial<Omit<RiskMetrics, 'id' | 'sessionId' | 'date'>>): Promise<RiskMetrics>;
    getRiskMetrics(sessionId: string, startDate: Date, endDate: Date): Promise<RiskMetrics[]>;
    calculateValueAtRisk(returns: number[], confidenceLevel?: number): number;
    calculateSharpeRatio(returns: number[], riskFreeRate?: number): number;
    checkPositionRisk(userId: string, positionSize: number, currentPositions: number): Promise<boolean>;
    checkDailyLossLimit(userId: string, sessionId: string): Promise<boolean>;
}
//# sourceMappingURL=risk.service.d.ts.map