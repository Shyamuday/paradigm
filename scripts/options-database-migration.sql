-- Options Database Migration Script
-- This script adds comprehensive options support to the Paradigm Trading System

-- 1. Add options-specific fields to existing Instrument table
ALTER TABLE instruments 
ADD COLUMN IF NOT EXISTS underlying_symbol VARCHAR(50),
ADD COLUMN IF NOT EXISTS strike_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS option_type VARCHAR(2), -- CE, PE
ADD COLUMN IF NOT EXISTS contract_size INTEGER;

-- Add indexes for options queries
CREATE INDEX IF NOT EXISTS idx_instruments_underlying_symbol ON instruments(underlying_symbol);
CREATE INDEX IF NOT EXISTS idx_instruments_strike_price ON instruments(strike_price);
CREATE INDEX IF NOT EXISTS idx_instruments_expiry_date ON instruments(expiry_date);
CREATE INDEX IF NOT EXISTS idx_instruments_option_type ON instruments(option_type);
CREATE INDEX IF NOT EXISTS idx_instruments_options_composite ON instruments(underlying_symbol, expiry_date, strike_price, option_type);

-- 2. Create Options Chain table
CREATE TABLE IF NOT EXISTS options_chains (
    id VARCHAR(50) PRIMARY KEY,
    underlying_symbol VARCHAR(50) NOT NULL,
    expiry_date TIMESTAMP NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Chain metadata
    total_call_contracts INTEGER DEFAULT 0,
    total_put_contracts INTEGER DEFAULT 0,
    total_call_volume INTEGER DEFAULT 0,
    total_put_volume INTEGER DEFAULT 0,
    total_call_oi INTEGER DEFAULT 0,
    total_put_oi INTEGER DEFAULT 0,
    
    UNIQUE(underlying_symbol, expiry_date)
);

-- Add indexes for options chain queries
CREATE INDEX IF NOT EXISTS idx_options_chains_underlying_symbol ON options_chains(underlying_symbol);
CREATE INDEX IF NOT EXISTS idx_options_chains_expiry_date ON options_chains(expiry_date);
CREATE INDEX IF NOT EXISTS idx_options_chains_composite ON options_chains(underlying_symbol, expiry_date);

-- 3. Create Options Contract table
CREATE TABLE IF NOT EXISTS options_contracts (
    id VARCHAR(50) PRIMARY KEY,
    chain_id VARCHAR(50) NOT NULL,
    instrument_id VARCHAR(50) NOT NULL,
    
    -- Contract details
    strike_price DECIMAL(10,2) NOT NULL,
    option_type VARCHAR(2) NOT NULL, -- CE, PE
    expiry_date TIMESTAMP NOT NULL,
    lot_size INTEGER NOT NULL,
    tick_size DECIMAL(10,4) NOT NULL,
    
    -- Market data
    last_price DECIMAL(10,2),
    bid_price DECIMAL(10,2),
    ask_price DECIMAL(10,2),
    bid_size INTEGER,
    ask_size INTEGER,
    volume INTEGER DEFAULT 0,
    open_interest INTEGER DEFAULT 0,
    change DECIMAL(10,2),
    change_percent DECIMAL(10,4),
    
    -- Greeks (real-time)
    delta DECIMAL(10,6),
    gamma DECIMAL(10,6),
    theta DECIMAL(10,6),
    vega DECIMAL(10,6),
    rho DECIMAL(10,6),
    
    -- Volatility
    implied_volatility DECIMAL(10,4),
    historical_volatility DECIMAL(10,4),
    
    -- Additional metrics
    intrinsic_value DECIMAL(10,2),
    time_value DECIMAL(10,2),
    in_the_money BOOLEAN,
    out_of_the_money BOOLEAN,
    at_the_money BOOLEAN,
    
    -- Timestamps
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(chain_id, strike_price, option_type),
    FOREIGN KEY (chain_id) REFERENCES options_chains(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
);

-- Add indexes for options contract queries
CREATE INDEX IF NOT EXISTS idx_options_contracts_chain_id ON options_contracts(chain_id);
CREATE INDEX IF NOT EXISTS idx_options_contracts_strike_price ON options_contracts(strike_price);
CREATE INDEX IF NOT EXISTS idx_options_contracts_option_type ON options_contracts(option_type);
CREATE INDEX IF NOT EXISTS idx_options_contracts_expiry_date ON options_contracts(expiry_date);
CREATE INDEX IF NOT EXISTS idx_options_contracts_implied_volatility ON options_contracts(implied_volatility);
CREATE INDEX IF NOT EXISTS idx_options_contracts_composite ON options_contracts(chain_id, strike_price, option_type);

-- 4. Create Options Greeks table (historical data)
CREATE TABLE IF NOT EXISTS options_greeks (
    id VARCHAR(50) PRIMARY KEY,
    instrument_id VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    underlying_price DECIMAL(10,2) NOT NULL,
    
    -- Greeks
    delta DECIMAL(10,6) NOT NULL,
    gamma DECIMAL(10,6) NOT NULL,
    theta DECIMAL(10,6) NOT NULL,
    vega DECIMAL(10,6) NOT NULL,
    rho DECIMAL(10,6),
    
    -- Volatility
    implied_volatility DECIMAL(10,4) NOT NULL,
    historical_volatility DECIMAL(10,4),
    
    -- Additional metrics
    intrinsic_value DECIMAL(10,2) NOT NULL,
    time_value DECIMAL(10,2) NOT NULL,
    in_the_money BOOLEAN NOT NULL,
    
    UNIQUE(instrument_id, timestamp),
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE
);

-- Add indexes for options greeks queries
CREATE INDEX IF NOT EXISTS idx_options_greeks_instrument_id ON options_greeks(instrument_id);
CREATE INDEX IF NOT EXISTS idx_options_greeks_timestamp ON options_greeks(timestamp);
CREATE INDEX IF NOT EXISTS idx_options_greeks_composite ON options_greeks(instrument_id, timestamp);

-- 5. Create Options Position table
CREATE TABLE IF NOT EXISTS options_positions (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL,
    instrument_id VARCHAR(50) NOT NULL,
    strategy_id VARCHAR(50),
    
    -- Position details
    quantity INTEGER NOT NULL, -- Positive for long, negative for short
    average_price DECIMAL(10,2) NOT NULL,
    current_price DECIMAL(10,2),
    
    -- Options-specific fields
    strike_price DECIMAL(10,2) NOT NULL,
    option_type VARCHAR(2) NOT NULL, -- CE, PE
    expiry_date TIMESTAMP NOT NULL,
    underlying_symbol VARCHAR(50) NOT NULL,
    underlying_price DECIMAL(10,2),
    
    -- Greeks exposure
    delta DECIMAL(10,6),
    gamma DECIMAL(10,6),
    theta DECIMAL(10,6),
    vega DECIMAL(10,6),
    
    -- Risk metrics
    max_profit DECIMAL(10,2),
    max_loss DECIMAL(10,2),
    break_even_points JSONB, -- Array of break-even prices
    
    -- Strategy metadata
    strategy_type VARCHAR(50), -- COVERED_CALL, IRON_CONDOR, etc.
    leg_type VARCHAR(50), -- For multi-leg strategies
    
    -- P&L tracking
    unrealized_pnl DECIMAL(10,2),
    realized_pnl DECIMAL(10,2),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES trading_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (instrument_id) REFERENCES instruments(id) ON DELETE CASCADE,
    FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE SET NULL
);

-- Add indexes for options positions queries
CREATE INDEX IF NOT EXISTS idx_options_positions_session_id ON options_positions(session_id);
CREATE INDEX IF NOT EXISTS idx_options_positions_instrument_id ON options_positions(instrument_id);
CREATE INDEX IF NOT EXISTS idx_options_positions_underlying_symbol ON options_positions(underlying_symbol);
CREATE INDEX IF NOT EXISTS idx_options_positions_expiry_date ON options_positions(expiry_date);
CREATE INDEX IF NOT EXISTS idx_options_positions_strategy_type ON options_positions(strategy_type);
CREATE INDEX IF NOT EXISTS idx_options_positions_composite ON options_positions(session_id, instrument_id);

-- 6. Create Options Strategy Leg table (for multi-leg strategies)
CREATE TABLE IF NOT EXISTS options_strategy_legs (
    id VARCHAR(50) PRIMARY KEY,
    strategy_id VARCHAR(50) NOT NULL,
    position_id VARCHAR(50),
    
    -- Leg details
    leg_type VARCHAR(50) NOT NULL, -- BUY_CALL, SELL_CALL, BUY_PUT, SELL_PUT
    strike_price DECIMAL(10,2) NOT NULL,
    option_type VARCHAR(2) NOT NULL, -- CE, PE
    expiry_date TIMESTAMP NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2),
    
    -- Greeks contribution
    delta DECIMAL(10,6),
    gamma DECIMAL(10,6),
    theta DECIMAL(10,6),
    vega DECIMAL(10,6),
    
    -- Order details
    order_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, FILLED, CANCELLED
    
    FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE,
    FOREIGN KEY (position_id) REFERENCES options_positions(id) ON DELETE SET NULL
);

-- Add indexes for options strategy legs queries
CREATE INDEX IF NOT EXISTS idx_options_strategy_legs_strategy_id ON options_strategy_legs(strategy_id);
CREATE INDEX IF NOT EXISTS idx_options_strategy_legs_position_id ON options_strategy_legs(position_id);

-- 7. Add options-specific fields to Risk Profile table
ALTER TABLE risk_profiles 
ADD COLUMN IF NOT EXISTS risk_tolerance VARCHAR(10), -- LOW, MEDIUM, HIGH
ADD COLUMN IF NOT EXISTS max_open_positions INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS max_delta DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS max_gamma DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS max_theta DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS max_vega DECIMAL(10,6);

-- 8. Add options-specific fields to Risk Metrics table
ALTER TABLE risk_metrics 
ADD COLUMN IF NOT EXISTS total_value DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS total_pnl DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS portfolio_delta DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS portfolio_gamma DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS portfolio_theta DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS portfolio_vega DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS sortino_ratio DECIMAL(10,4);

-- 9. Add options-specific fields to Alert table
ALTER TABLE alerts 
ADD COLUMN IF NOT EXISTS greek_type VARCHAR(10), -- DELTA, GAMMA, THETA, VEGA
ADD COLUMN IF NOT EXISTS strike_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS option_type VARCHAR(2); -- CE, PE

-- 10. Add options-specific fields to Backtest Result table
ALTER TABLE backtest_results 
ADD COLUMN IF NOT EXISTS total_options_trades INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS options_win_rate DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS average_options_pnl DECIMAL(10,2);

-- 11. Add options-specific fields to Backtest Trade table
ALTER TABLE backtest_trades 
ADD COLUMN IF NOT EXISTS strike_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS option_type VARCHAR(2), -- CE, PE
ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP;

-- 12. Create views for common options queries

-- View for options chain summary
CREATE OR REPLACE VIEW options_chain_summary AS
SELECT 
    oc.underlying_symbol,
    oc.expiry_date,
    oc.total_call_contracts,
    oc.total_put_contracts,
    oc.total_call_volume,
    oc.total_put_volume,
    oc.total_call_oi,
    oc.total_put_oi,
    oc.timestamp
FROM options_chains oc
WHERE oc.is_active = TRUE;

-- View for options contracts with greeks
CREATE OR REPLACE VIEW options_contracts_with_greeks AS
SELECT 
    oc.id,
    oc.chain_id,
    oc.instrument_id,
    oc.strike_price,
    oc.option_type,
    oc.expiry_date,
    oc.lot_size,
    oc.tick_size,
    oc.last_price,
    oc.bid_price,
    oc.ask_price,
    oc.volume,
    oc.open_interest,
    oc.delta,
    oc.gamma,
    oc.theta,
    oc.vega,
    oc.rho,
    oc.implied_volatility,
    oc.historical_volatility,
    oc.intrinsic_value,
    oc.time_value,
    oc.in_the_money,
    oc.out_of_the_money,
    oc.at_the_money,
    oc.last_updated
FROM options_contracts oc;

-- View for options positions with risk metrics
CREATE OR REPLACE VIEW options_positions_with_risk AS
SELECT 
    op.id,
    op.session_id,
    op.instrument_id,
    op.strategy_id,
    op.quantity,
    op.average_price,
    op.current_price,
    op.strike_price,
    op.option_type,
    op.expiry_date,
    op.underlying_symbol,
    op.underlying_price,
    op.delta,
    op.gamma,
    op.theta,
    op.vega,
    op.max_profit,
    op.max_loss,
    op.break_even_points,
    op.strategy_type,
    op.leg_type,
    op.unrealized_pnl,
    op.realized_pnl,
    op.created_at,
    op.updated_at
FROM options_positions op;

-- 13. Create functions for options calculations

-- Function to calculate days to expiry
CREATE OR REPLACE FUNCTION calculate_days_to_expiry(expiry_date TIMESTAMP)
RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(EPOCH FROM (expiry_date - CURRENT_TIMESTAMP)) / 86400;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate implied volatility (simplified)
CREATE OR REPLACE FUNCTION calculate_implied_volatility(
    option_price DECIMAL,
    underlying_price DECIMAL,
    strike_price DECIMAL,
    time_to_expiry DECIMAL,
    risk_free_rate DECIMAL DEFAULT 0.05
)
RETURNS DECIMAL AS $$
BEGIN
    -- Simplified IV calculation (in real implementation, use Black-Scholes)
    RETURN SQRT(2 * PI() / time_to_expiry) * (option_price / underlying_price);
END;
$$ LANGUAGE plpgsql;

-- Function to update options chain totals
CREATE OR REPLACE FUNCTION update_options_chain_totals(chain_id_param VARCHAR(50))
RETURNS VOID AS $$
BEGIN
    UPDATE options_chains 
    SET 
        total_call_contracts = (
            SELECT COUNT(*) FROM options_contracts 
            WHERE chain_id = chain_id_param AND option_type = 'CE'
        ),
        total_put_contracts = (
            SELECT COUNT(*) FROM options_contracts 
            WHERE chain_id = chain_id_param AND option_type = 'PE'
        ),
        total_call_volume = (
            SELECT COALESCE(SUM(volume), 0) FROM options_contracts 
            WHERE chain_id = chain_id_param AND option_type = 'CE'
        ),
        total_put_volume = (
            SELECT COALESCE(SUM(volume), 0) FROM options_contracts 
            WHERE chain_id = chain_id_param AND option_type = 'PE'
        ),
        total_call_oi = (
            SELECT COALESCE(SUM(open_interest), 0) FROM options_contracts 
            WHERE chain_id = chain_id_param AND option_type = 'CE'
        ),
        total_put_oi = (
            SELECT COALESCE(SUM(open_interest), 0) FROM options_contracts 
            WHERE chain_id = chain_id_param AND option_type = 'PE'
        )
    WHERE id = chain_id_param;
END;
$$ LANGUAGE plpgsql;

-- 14. Create triggers for automatic updates

-- Trigger to update options chain totals when contracts are modified
CREATE OR REPLACE FUNCTION trigger_update_options_chain_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM update_options_chain_totals(NEW.chain_id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM update_options_chain_totals(NEW.chain_id);
        IF OLD.chain_id != NEW.chain_id THEN
            PERFORM update_options_chain_totals(OLD.chain_id);
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_options_chain_totals(OLD.chain_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_options_contracts_chain_update
    AFTER INSERT OR UPDATE OR DELETE ON options_contracts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_options_chain_totals();

-- 15. Create indexes for performance optimization

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_options_contracts_chain_strike_type ON options_contracts(chain_id, strike_price, option_type);
CREATE INDEX IF NOT EXISTS idx_options_positions_session_strategy ON options_positions(session_id, strategy_id);
CREATE INDEX IF NOT EXISTS idx_options_greeks_instrument_time ON options_greeks(instrument_id, timestamp DESC);

-- Partial indexes for active data
CREATE INDEX IF NOT EXISTS idx_options_chains_active ON options_chains(underlying_symbol, expiry_date) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_options_contracts_active ON options_contracts(chain_id, strike_price) WHERE last_price IS NOT NULL;

-- 16. Add comments for documentation
COMMENT ON TABLE options_chains IS 'Stores options chains for each underlying and expiry';
COMMENT ON TABLE options_contracts IS 'Stores individual options contracts with market data and greeks';
COMMENT ON TABLE options_greeks IS 'Stores historical greeks data for options';
COMMENT ON TABLE options_positions IS 'Stores options-specific positions with risk metrics';
COMMENT ON TABLE options_strategy_legs IS 'Stores individual legs of multi-leg options strategies';

COMMENT ON COLUMN options_contracts.delta IS 'Rate of change of option price with respect to underlying price';
COMMENT ON COLUMN options_contracts.gamma IS 'Rate of change of delta with respect to underlying price';
COMMENT ON COLUMN options_contracts.theta IS 'Rate of change of option price with respect to time';
COMMENT ON COLUMN options_contracts.vega IS 'Rate of change of option price with respect to volatility';

-- 17. Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_user;

-- Migration completed successfully
SELECT 'Options database migration completed successfully!' AS status; 