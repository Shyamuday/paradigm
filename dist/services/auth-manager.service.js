"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthManagerService = void 0;
const events_1 = require("events");
const easy_auth_1 = require("../auth/easy-auth");
class AuthManagerService extends events_1.EventEmitter {
    constructor() {
        super();
        this.auth = null;
        this.loginStatus = 'idle';
        this.lastError = null;
        this.config = {
            apiKey: process.env.ZERODHA_API_KEY || '',
            apiSecret: process.env.ZERODHA_API_SECRET || '',
            userId: process.env.ZERODHA_USER_ID || '',
            password: process.env.ZERODHA_PASSWORD || '',
            totpSecret: process.env.ZERODHA_TOTP_SECRET || '',
            redirectUri: process.env.ZERODHA_REDIRECT_URI || 'https://127.0.0.1'
        };
    }
    static getInstance() {
        if (!AuthManagerService.instance) {
            AuthManagerService.instance = new AuthManagerService();
        }
        return AuthManagerService.instance;
    }
    getStatus() {
        return {
            status: this.loginStatus,
            error: this.lastError,
            isAuthenticated: this.auth?.getSession() !== null
        };
    }
    async initialize() {
        try {
            this.loginStatus = 'logging_in';
            this.emit('status_change', this.getStatus());
            this.auth = new easy_auth_1.AutoTOTPZerodhaAuth(this.config);
            const session = await this.auth.authenticate();
            this.loginStatus = 'logged_in';
            this.lastError = null;
            this.emit('status_change', this.getStatus());
            this.emit('session_update', session);
        }
        catch (error) {
            this.loginStatus = 'error';
            this.lastError = error.message;
            this.emit('status_change', this.getStatus());
            throw error;
        }
    }
    async makeAuthenticatedRequest(endpoint, method = 'GET', data) {
        if (!this.auth) {
            throw new Error('Auth not initialized');
        }
        return this.auth.apiCall(endpoint, method, data);
    }
    getSession() {
        return this.auth?.getSession() || null;
    }
}
exports.AuthManagerService = AuthManagerService;
//# sourceMappingURL=auth-manager.service.js.map