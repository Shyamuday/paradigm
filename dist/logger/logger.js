"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardLogger = exports.storageLogger = exports.schedulerLogger = exports.riskLogger = exports.positionLogger = exports.orderLogger = exports.strategyLogger = exports.marketDataLogger = exports.authLogger = exports.createCategoryLogger = exports.logStream = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const fs = require('fs');
const logsDir = path_1.default.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}
const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
}), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json());
const consoleFormat = winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({
    format: 'HH:mm:ss'
}), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
}));
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'trading-bot' },
    transports: [
        new winston_1.default.transports.Console({
            format: consoleFormat
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'trading-bot.log'),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
            tailable: true
        }),
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
            tailable: true
        })
    ]
});
exports.logStream = {
    write: (message) => {
        exports.logger.info(message.trim());
    }
};
const createCategoryLogger = (category) => {
    return {
        info: (message, meta) => exports.logger.info(message, { category, ...meta }),
        warn: (message, meta) => exports.logger.warn(message, { category, ...meta }),
        error: (message, meta) => exports.logger.error(message, { category, ...meta }),
        debug: (message, meta) => exports.logger.debug(message, { category, ...meta })
    };
};
exports.createCategoryLogger = createCategoryLogger;
exports.authLogger = (0, exports.createCategoryLogger)('AUTH');
exports.marketDataLogger = (0, exports.createCategoryLogger)('MARKET_DATA');
exports.strategyLogger = (0, exports.createCategoryLogger)('STRATEGY');
exports.orderLogger = (0, exports.createCategoryLogger)('ORDER');
exports.positionLogger = (0, exports.createCategoryLogger)('POSITION');
exports.riskLogger = (0, exports.createCategoryLogger)('RISK');
exports.schedulerLogger = (0, exports.createCategoryLogger)('SCHEDULER');
exports.storageLogger = (0, exports.createCategoryLogger)('STORAGE');
exports.dashboardLogger = (0, exports.createCategoryLogger)('DASHBOARD');
//# sourceMappingURL=logger.js.map