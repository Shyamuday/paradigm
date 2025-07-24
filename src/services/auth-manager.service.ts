import { EventEmitter } from 'events';
import { ZerodhaAuth } from '../auth/zerodha-auth';
import { logger } from '../logger/logger';

export class AuthManagerService extends EventEmitter {
    private static instance: AuthManagerService;
    private auth: ZerodhaAuth | null = null;
    private loginStatus: 'idle' | 'logging_in' | 'logged_in' | 'error' = 'idle';
    private lastError: string | null = null;

    private constructor() {
        super();
    }

    public static getInstance(): AuthManagerService {
        if (!AuthManagerService.instance) {
            AuthManagerService.instance = new AuthManagerService();
        }
        return AuthManagerService.instance;
    }

    public async getStatus() {
        const isAuthenticated = this.auth ? await this.auth.hasValidSession() : false;
        return {
            status: this.loginStatus,
            error: this.lastError,
            isAuthenticated
        };
    }

    public async initialize(): Promise<void> {
        try {
            this.loginStatus = 'logging_in';
            this.emit('status_change', await this.getStatus());

            this.auth = new ZerodhaAuth();

            // Check if we have a valid session
            if (await this.auth.hasValidSession()) {
                this.loginStatus = 'logged_in';
                this.lastError = null;
                this.emit('status_change', await this.getStatus());
                return;
            }

            // Start OAuth login flow if no valid session
            await this.auth.startOAuthLogin();

            this.loginStatus = 'logged_in';
            this.lastError = null;
            this.emit('status_change', await this.getStatus());

        } catch (error: any) {
            this.loginStatus = 'error';
            this.lastError = error.message;
            this.emit('status_change', await this.getStatus());
            throw error;
        }
    }

    public getKite() {
        if (!this.auth) {
            throw new Error('Auth not initialized');
        }
        return this.auth.getKite();
    }

    public async logout(): Promise<void> {
        if (!this.auth) {
            throw new Error('Auth not initialized');
        }
        await this.auth.logout();
        this.loginStatus = 'idle';
        this.lastError = null;
        this.emit('status_change', await this.getStatus());
    }
} 