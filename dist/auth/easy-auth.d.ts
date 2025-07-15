export interface AutoTOTPConfig {
    apiKey: string;
    apiSecret: string;
    userId: string;
    password: string;
    totpSecret: string;
    redirectUri?: string;
}
export interface SavedSession {
    accessToken: string;
    publicToken: string;
    userId: string;
    loginTime: string;
    expiryTime: string;
}
export declare class AutoTOTPZerodhaAuth {
    private config;
    private session;
    private sessionFilePath;
    private httpClient;
    constructor(config: AutoTOTPConfig);
    authenticate(): Promise<SavedSession>;
    getSession(): SavedSession | null;
    apiCall(endpoint: string, method?: 'GET' | 'POST' | 'DELETE', data?: any): Promise<any>;
    clearSession(): void;
    private performAutomaticLogin;
    private generateTOTP;
    private extractRequestToken;
    private generateAccessToken;
    private loadSavedSession;
    private saveSession;
    private isSessionValid;
}
export declare function createAutoTOTPAuth(): Promise<AutoTOTPZerodhaAuth>;
//# sourceMappingURL=easy-auth.d.ts.map