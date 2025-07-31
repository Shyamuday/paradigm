-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "mode" TEXT NOT NULL,
    "capital" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "trading_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "instrumentType" TEXT NOT NULL,
    "lotSize" INTEGER,
    "tickSize" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "underlyingSymbol" TEXT,
    "strikePrice" DOUBLE PRECISION,
    "expiryDate" TIMESTAMP(3),
    "optionType" TEXT,
    "contractSize" INTEGER,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options_chains" (
    "id" TEXT NOT NULL,
    "underlyingSymbol" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalCallContracts" INTEGER NOT NULL DEFAULT 0,
    "totalPutContracts" INTEGER NOT NULL DEFAULT 0,
    "totalCallVolume" INTEGER NOT NULL DEFAULT 0,
    "totalPutVolume" INTEGER NOT NULL DEFAULT 0,
    "totalCallOI" INTEGER NOT NULL DEFAULT 0,
    "totalPutOI" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "options_chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options_contracts" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "strikePrice" DOUBLE PRECISION NOT NULL,
    "optionType" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "lotSize" INTEGER NOT NULL,
    "tickSize" DOUBLE PRECISION NOT NULL,
    "lastPrice" DOUBLE PRECISION,
    "bidPrice" DOUBLE PRECISION,
    "askPrice" DOUBLE PRECISION,
    "bidSize" INTEGER,
    "askSize" INTEGER,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "openInterest" INTEGER NOT NULL DEFAULT 0,
    "change" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,
    "delta" DOUBLE PRECISION,
    "gamma" DOUBLE PRECISION,
    "theta" DOUBLE PRECISION,
    "vega" DOUBLE PRECISION,
    "rho" DOUBLE PRECISION,
    "impliedVolatility" DOUBLE PRECISION,
    "historicalVolatility" DOUBLE PRECISION,
    "intrinsicValue" DOUBLE PRECISION,
    "timeValue" DOUBLE PRECISION,
    "inTheMoney" BOOLEAN,
    "outOfTheMoney" BOOLEAN,
    "atTheMoney" BOOLEAN,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "options_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options_greeks" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "underlyingPrice" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "gamma" DOUBLE PRECISION NOT NULL,
    "theta" DOUBLE PRECISION NOT NULL,
    "vega" DOUBLE PRECISION NOT NULL,
    "rho" DOUBLE PRECISION,
    "impliedVolatility" DOUBLE PRECISION NOT NULL,
    "historicalVolatility" DOUBLE PRECISION,
    "intrinsicValue" DOUBLE PRECISION NOT NULL,
    "timeValue" DOUBLE PRECISION NOT NULL,
    "inTheMoney" BOOLEAN NOT NULL,

    CONSTRAINT "options_greeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options_positions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "strategyId" TEXT,
    "quantity" INTEGER NOT NULL,
    "averagePrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "strikePrice" DOUBLE PRECISION NOT NULL,
    "optionType" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "underlyingSymbol" TEXT NOT NULL,
    "underlyingPrice" DOUBLE PRECISION,
    "delta" DOUBLE PRECISION,
    "gamma" DOUBLE PRECISION,
    "theta" DOUBLE PRECISION,
    "vega" DOUBLE PRECISION,
    "maxProfit" DOUBLE PRECISION,
    "maxLoss" DOUBLE PRECISION,
    "breakEvenPoints" JSONB,
    "strategyType" TEXT,
    "legType" TEXT,
    "unrealizedPnL" DOUBLE PRECISION,
    "realizedPnL" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "options_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options_strategy_legs" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "positionId" TEXT,
    "legType" TEXT NOT NULL,
    "strikePrice" DOUBLE PRECISION NOT NULL,
    "optionType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "deltaContribution" DOUBLE PRECISION,
    "gammaContribution" DOUBLE PRECISION,
    "thetaContribution" DOUBLE PRECISION,
    "vegaContribution" DOUBLE PRECISION,
    "pnlContribution" DOUBLE PRECISION,

    CONSTRAINT "options_strategy_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_data" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION,
    "high" DOUBLE PRECISION,
    "low" DOUBLE PRECISION,
    "close" DOUBLE PRECISION,
    "volume" INTEGER,

    CONSTRAINT "market_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timeframe_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "intervalMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timeframe_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candle_data" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "timeframeId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" INTEGER NOT NULL,
    "typicalPrice" DOUBLE PRECISION,
    "weightedPrice" DOUBLE PRECISION,
    "priceChange" DOUBLE PRECISION,
    "priceChangePercent" DOUBLE PRECISION,
    "upperShadow" DOUBLE PRECISION,
    "lowerShadow" DOUBLE PRECISION,
    "bodySize" DOUBLE PRECISION,
    "totalRange" DOUBLE PRECISION,

    CONSTRAINT "candle_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tick_data" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "ltp" DOUBLE PRECISION NOT NULL,
    "volume" INTEGER NOT NULL,
    "change" DOUBLE PRECISION,
    "changePercent" DOUBLE PRECISION,

    CONSTRAINT "tick_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volume_profiles" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "timeframeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "priceLevel" DOUBLE PRECISION NOT NULL,
    "volume" INTEGER NOT NULL,
    "poc" BOOLEAN NOT NULL,

    CONSTRAINT "volume_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "strategyId" TEXT,
    "action" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "orderType" TEXT NOT NULL,
    "orderId" TEXT,
    "status" TEXT NOT NULL,
    "stopLoss" DOUBLE PRECISION,
    "target" DOUBLE PRECISION,
    "trailingStop" BOOLEAN NOT NULL DEFAULT false,
    "orderTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executionTime" TIMESTAMP(3),
    "realizedPnL" DOUBLE PRECISION,
    "unrealizedPnL" DOUBLE PRECISION,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "tradeId" TEXT,
    "quantity" INTEGER NOT NULL,
    "averagePrice" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "unrealizedPnL" DOUBLE PRECISION,
    "realizedPnL" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskTolerance" TEXT NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "maxDailyLoss" DOUBLE PRECISION NOT NULL,
    "maxPositionSize" DOUBLE PRECISION NOT NULL,
    "maxOpenPositions" INTEGER NOT NULL,
    "maxDelta" DOUBLE PRECISION,
    "maxGamma" DOUBLE PRECISION,
    "maxTheta" DOUBLE PRECISION,
    "maxVega" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_metrics" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "totalPnL" DOUBLE PRECISION NOT NULL,
    "dailyPnL" DOUBLE PRECISION NOT NULL,
    "drawdown" DOUBLE PRECISION NOT NULL,
    "portfolioDelta" DOUBLE PRECISION,
    "portfolioGamma" DOUBLE PRECISION,
    "portfolioTheta" DOUBLE PRECISION,
    "portfolioVega" DOUBLE PRECISION,
    "sharpeRatio" DOUBLE PRECISION,
    "sortinoRatio" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,

    CONSTRAINT "risk_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instrumentId" TEXT,
    "type" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "greekType" TEXT,
    "strikePrice" DOUBLE PRECISION,
    "optionType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_notifications" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "alert_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backtest_results" (
    "id" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "initialCapital" DOUBLE PRECISION NOT NULL,
    "instruments" JSONB NOT NULL,
    "finalCapital" DOUBLE PRECISION NOT NULL,
    "totalReturn" DOUBLE PRECISION NOT NULL,
    "annualizedReturn" DOUBLE PRECISION NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "sharpeRatio" DOUBLE PRECISION,
    "sortinoRatio" DOUBLE PRECISION,
    "totalOptionsTrades" INTEGER NOT NULL DEFAULT 0,
    "optionsWinRate" DOUBLE PRECISION,
    "averageOptionsPnL" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backtest_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backtest_trades" (
    "id" TEXT NOT NULL,
    "backtestId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "pnl" DOUBLE PRECISION,
    "strikePrice" DOUBLE PRECISION,
    "optionType" TEXT,
    "expiryDate" TIMESTAMP(3),

    CONSTRAINT "backtest_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_costs" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "brokerage" DOUBLE PRECISION NOT NULL,
    "stt" DOUBLE PRECISION NOT NULL,
    "exchangeFee" DOUBLE PRECISION NOT NULL,
    "gst" DOUBLE PRECISION NOT NULL,
    "sebiCharges" DOUBLE PRECISION NOT NULL,
    "stampDuty" DOUBLE PRECISION NOT NULL,
    "sebiTurnover" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "costPercentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "transaction_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brokerage_plans" (
    "id" TEXT NOT NULL,
    "brokerName" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "equityDelivery" DOUBLE PRECISION NOT NULL,
    "equityIntraday" DOUBLE PRECISION NOT NULL,
    "equityFutures" DOUBLE PRECISION NOT NULL,
    "equityOptions" DOUBLE PRECISION NOT NULL,
    "currencyFutures" DOUBLE PRECISION NOT NULL,
    "currencyOptions" DOUBLE PRECISION NOT NULL,
    "commodityFutures" DOUBLE PRECISION NOT NULL,
    "commodityOptions" DOUBLE PRECISION NOT NULL,
    "dpCharges" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brokerage_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION,
    "date" DATE NOT NULL,
    "hour" INTEGER NOT NULL,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_quotas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "dailyLimit" INTEGER NOT NULL,
    "currentUsage" INTEGER NOT NULL DEFAULT 0,
    "resetTime" TIMESTAMP(3) NOT NULL,
    "isExceeded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "api_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_errors" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "errorCode" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "requestData" JSONB,
    "responseData" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeFeeConfig" (
    "id" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "brokerageFeePercent" DOUBLE PRECISION NOT NULL,
    "transactionTaxPercent" DOUBLE PRECISION NOT NULL,
    "stampDutyPercent" DOUBLE PRECISION NOT NULL,
    "exchangeChargesPercent" DOUBLE PRECISION NOT NULL,
    "gstPercent" DOUBLE PRECISION NOT NULL,
    "sebiChargesPercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeFeeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingFees" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "tradeValue" DOUBLE PRECISION NOT NULL,
    "action" TEXT NOT NULL,
    "brokerageFee" DOUBLE PRECISION NOT NULL,
    "transactionTax" DOUBLE PRECISION NOT NULL,
    "stampDuty" DOUBLE PRECISION NOT NULL,
    "exchangeCharges" DOUBLE PRECISION NOT NULL,
    "gst" DOUBLE PRECISION NOT NULL,
    "sebiCharges" DOUBLE PRECISION NOT NULL,
    "totalFees" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradingFees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_performance" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "executionTime" DOUBLE PRECISION NOT NULL,
    "rowsAffected" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queryHash" TEXT,

    CONSTRAINT "database_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_quality_metrics" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "isViolated" BOOLEAN NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_quality_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_policies" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "archivalDays" INTEGER NOT NULL,
    "compressionDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCleanup" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_cache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "cacheValue" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connection_pool_metrics" (
    "id" TEXT NOT NULL,
    "totalConnections" INTEGER NOT NULL,
    "activeConnections" INTEGER NOT NULL,
    "idleConnections" INTEGER NOT NULL,
    "waitingConnections" INTEGER NOT NULL,
    "maxConnections" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connection_pool_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_symbol_key" ON "instruments"("symbol");

-- CreateIndex
CREATE INDEX "options_chain_underlying_expiry_idx" ON "options_chains"("underlyingSymbol", "expiryDate");

-- CreateIndex
CREATE INDEX "options_chain_expiry_idx" ON "options_chains"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "options_chains_underlyingSymbol_expiryDate_key" ON "options_chains"("underlyingSymbol", "expiryDate");

-- CreateIndex
CREATE INDEX "options_contract_chain_strike_idx" ON "options_contracts"("chainId", "strikePrice");

-- CreateIndex
CREATE INDEX "options_contract_strike_type_idx" ON "options_contracts"("strikePrice", "optionType");

-- CreateIndex
CREATE INDEX "options_contract_expiry_idx" ON "options_contracts"("expiryDate");

-- CreateIndex
CREATE INDEX "options_contract_iv_idx" ON "options_contracts"("impliedVolatility");

-- CreateIndex
CREATE UNIQUE INDEX "options_contracts_chainId_strikePrice_optionType_key" ON "options_contracts"("chainId", "strikePrice", "optionType");

-- CreateIndex
CREATE INDEX "options_greeks_instrument_time_idx" ON "options_greeks"("instrumentId", "timestamp");

-- CreateIndex
CREATE INDEX "options_greeks_time_idx" ON "options_greeks"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "options_greeks_instrumentId_timestamp_key" ON "options_greeks"("instrumentId", "timestamp");

-- CreateIndex
CREATE INDEX "options_position_session_instrument_idx" ON "options_positions"("sessionId", "instrumentId");

-- CreateIndex
CREATE INDEX "options_strategy_leg_strategy_idx" ON "options_strategy_legs"("strategyId");

-- CreateIndex
CREATE INDEX "market_data_instrument_time_idx" ON "market_data"("instrumentId", "timestamp");

-- CreateIndex
CREATE INDEX "market_data_time_idx" ON "market_data"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "market_data_instrumentId_timestamp_key" ON "market_data"("instrumentId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "timeframe_config_name_key" ON "timeframe_config"("name");

-- CreateIndex
CREATE INDEX "candle_data_instrument_timeframe_time_idx" ON "candle_data"("instrumentId", "timeframeId", "timestamp");

-- CreateIndex
CREATE INDEX "candle_data_latest_idx" ON "candle_data"("instrumentId", "timeframeId", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "candle_data_instrumentId_timeframeId_timestamp_key" ON "candle_data"("instrumentId", "timeframeId", "timestamp");

-- CreateIndex
CREATE INDEX "tick_data_instrument_time_idx" ON "tick_data"("instrumentId", "timestamp");

-- CreateIndex
CREATE INDEX "tick_data_time_idx" ON "tick_data"("timestamp");

-- CreateIndex
CREATE INDEX "tick_data_latest_idx" ON "tick_data"("instrumentId", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "tick_data_instrumentId_timestamp_key" ON "tick_data"("instrumentId", "timestamp");

-- CreateIndex
CREATE INDEX "volume_profile_instrument_timeframe_date_idx" ON "volume_profiles"("instrumentId", "timeframeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "volume_profiles_instrumentId_timeframeId_date_priceLevel_key" ON "volume_profiles"("instrumentId", "timeframeId", "date", "priceLevel");

-- CreateIndex
CREATE UNIQUE INDEX "strategies_name_key" ON "strategies"("name");

-- CreateIndex
CREATE INDEX "positions_sessionId_instrumentId_idx" ON "positions"("sessionId", "instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "risk_profiles_userId_key" ON "risk_profiles"("userId");

-- CreateIndex
CREATE INDEX "risk_metrics_sessionId_timestamp_idx" ON "risk_metrics"("sessionId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_costs_tradeId_key" ON "transaction_costs"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "brokerage_plans_brokerName_planName_key" ON "brokerage_plans"("brokerName", "planName");

-- CreateIndex
CREATE UNIQUE INDEX "api_usage_userId_endpoint_method_date_hour_key" ON "api_usage"("userId", "endpoint", "method", "date", "hour");

-- CreateIndex
CREATE UNIQUE INDEX "api_quotas_userId_endpoint_key" ON "api_quotas"("userId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "configs_key_key" ON "configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeFeeConfig_exchangeId_key" ON "ExchangeFeeConfig"("exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "TradingFees_tradeId_key" ON "TradingFees"("tradeId");

-- CreateIndex
CREATE INDEX "database_performance_tableName_timestamp_idx" ON "database_performance"("tableName", "timestamp");

-- CreateIndex
CREATE INDEX "database_performance_operation_timestamp_idx" ON "database_performance"("operation", "timestamp");

-- CreateIndex
CREATE INDEX "data_quality_metrics_tableName_metricType_timestamp_idx" ON "data_quality_metrics"("tableName", "metricType", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "data_retention_policies_tableName_key" ON "data_retention_policies"("tableName");

-- CreateIndex
CREATE UNIQUE INDEX "data_cache_cacheKey_key" ON "data_cache"("cacheKey");

-- CreateIndex
CREATE INDEX "data_cache_expiresAt_idx" ON "data_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "data_cache_lastAccessed_idx" ON "data_cache"("lastAccessed");

-- CreateIndex
CREATE INDEX "connection_pool_metrics_timestamp_idx" ON "connection_pool_metrics"("timestamp");

-- AddForeignKey
ALTER TABLE "trading_sessions" ADD CONSTRAINT "trading_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_chains" ADD CONSTRAINT "options_chains_underlyingSymbol_fkey" FOREIGN KEY ("underlyingSymbol") REFERENCES "instruments"("symbol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_contracts" ADD CONSTRAINT "options_contracts_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "options_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_contracts" ADD CONSTRAINT "options_contracts_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_greeks" ADD CONSTRAINT "options_greeks_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_positions" ADD CONSTRAINT "options_positions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "trading_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_positions" ADD CONSTRAINT "options_positions_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_positions" ADD CONSTRAINT "options_positions_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_strategy_legs" ADD CONSTRAINT "options_strategy_legs_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options_strategy_legs" ADD CONSTRAINT "options_strategy_legs_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "options_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_data" ADD CONSTRAINT "market_data_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candle_data" ADD CONSTRAINT "candle_data_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candle_data" ADD CONSTRAINT "candle_data_timeframeId_fkey" FOREIGN KEY ("timeframeId") REFERENCES "timeframe_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tick_data" ADD CONSTRAINT "tick_data_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volume_profiles" ADD CONSTRAINT "volume_profiles_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volume_profiles" ADD CONSTRAINT "volume_profiles_timeframeId_fkey" FOREIGN KEY ("timeframeId") REFERENCES "timeframe_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "trading_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "trading_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_profiles" ADD CONSTRAINT "risk_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_metrics" ADD CONSTRAINT "risk_metrics_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "trading_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_notifications" ADD CONSTRAINT "alert_notifications_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtest_results" ADD CONSTRAINT "backtest_results_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_backtestId_fkey" FOREIGN KEY ("backtestId") REFERENCES "backtest_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtest_trades" ADD CONSTRAINT "backtest_trades_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "instruments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_costs" ADD CONSTRAINT "transaction_costs_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_quotas" ADD CONSTRAINT "api_quotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_errors" ADD CONSTRAINT "api_errors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradingFees" ADD CONSTRAINT "TradingFees_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
