import { EventEmitter } from 'events';
import { SavedSession } from '../auth/easy-auth';
export declare class AuthManagerService extends EventEmitter {
    private static instance;
    private auth;
    private config;
    private loginStatus;
    private lastError;
    private constructor();
    static getInstance(): AuthManagerService;
    getStatus(): {
        status: "error" | "idle" | "logging_in" | "logged_in";
        error: string | null;
        isAuthenticated: boolean;
    };
    initialize(): Promise<void>;
    makeAuthenticatedRequest(endpoint: string, method?: 'GET' | 'POST' | 'DELETE', data?: any): Promise<any>;
    getSession(): SavedSession | null;
}
//# sourceMappingURL=auth-manager.service.d.ts.map