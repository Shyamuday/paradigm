import winston from 'winston';
export declare const logger: winston.Logger;
export declare const logStream: {
    write: (message: string) => void;
};
export declare const createCategoryLogger: (category: string) => {
    info: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, meta?: any) => winston.Logger;
    error: (message: string, meta?: any) => winston.Logger;
    debug: (message: string, meta?: any) => winston.Logger;
};
export declare const authLogger: {
    info: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, meta?: any) => winston.Logger;
    error: (message: string, meta?: any) => winston.Logger;
    debug: (message: string, meta?: any) => winston.Logger;
};
export declare const marketDataLogger: {
    info: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, meta?: any) => winston.Logger;
    error: (message: string, meta?: any) => winston.Logger;
    debug: (message: string, meta?: any) => winston.Logger;
};
export declare const strategyLogger: {
    info: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, meta?: any) => winston.Logger;
    error: (message: string, meta?: any) => winston.Logger;
    debug: (message: string, meta?: any) => winston.Logger;
};
export declare const orderLogger: {
    info: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, meta?: any) => winston.Logger;
    error: (message: string, meta?: any) => winston.Logger;
    debug: (message: string, meta?: any) => winston.Logger;
};
export declare const positionLogger: {
    info: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, meta?: any) => winston.Logger;
    error: (message: string, meta?: any) => winston.Logger;
    debug: (message: string, meta?: any) => winston.Logger;
};
export declare const riskLogger: {
    info: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, meta?: any) => winston.Logger;
    error: (message: string, meta?: any) => winston.Logger;
    debug: (message: string, meta?: any) => winston.Logger;
};
export declare const schedulerLogger: {
    info: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, meta?: any) => winston.Logger;
    error: (message: string, meta?: any) => winston.Logger;
    debug: (message: string, meta?: any) => winston.Logger;
};
export declare const storageLogger: {
    info: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, meta?: any) => winston.Logger;
    error: (message: string, meta?: any) => winston.Logger;
    debug: (message: string, meta?: any) => winston.Logger;
};
export declare const dashboardLogger: {
    info: (message: string, meta?: any) => winston.Logger;
    warn: (message: string, meta?: any) => winston.Logger;
    error: (message: string, meta?: any) => winston.Logger;
    debug: (message: string, meta?: any) => winston.Logger;
};
//# sourceMappingURL=logger.d.ts.map