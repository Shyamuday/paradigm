import { ApiUsage, ApiQuota, ApiError } from '../types';
export declare class ApiMonitorService {
    trackApiCall(userId: string, endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', responseTime: number, isError?: boolean): Promise<void>;
    checkQuota(userId: string, endpoint: string): Promise<boolean>;
    incrementQuotaUsage(userId: string, endpoint: string): Promise<void>;
    setQuota(userId: string, endpoint: string, dailyLimit: number): Promise<ApiQuota>;
    logApiError(userId: string, endpoint: string, errorCode: string, errorMessage: string, requestData?: any, responseData?: any): Promise<ApiError>;
    getApiUsageStats(userId: string, startDate: Date, endDate: Date): Promise<ApiUsage[]>;
    getErrorStats(userId: string, startDate: Date, endDate: Date): Promise<ApiError[]>;
    private getNextResetTime;
}
//# sourceMappingURL=api-monitor.service.d.ts.map