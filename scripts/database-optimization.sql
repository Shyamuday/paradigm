-- Database Optimization Script for Paradigm Trading System
-- Run this script to implement performance improvements

-- =====================================================
-- 1. CREATE ADDITIONAL INDEXES FOR BETTER PERFORMANCE
-- =====================================================

-- Indexes for frequently accessed queries
CREATE INDEX IF NOT EXISTS idx_trades_session_status ON trades(session_id, status);
CREATE INDEX IF NOT EXISTS idx_positions_session_side ON positions(session_id, side);
CREATE INDEX IF NOT EXISTS idx_market_data_instrument_timestamp ON market_data(instrument_id, timestamp);

-- Partial indexes for active data
CREATE INDEX IF NOT EXISTS idx_active_instruments ON instruments(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_active_strategies ON strategies(is_active) WHERE is_active = true;

-- Indexes for time-based queries
CREATE INDEX IF NOT EXISTS idx_trades_order_time ON trades(order_time);
CREATE INDEX IF NOT EXISTS idx_positions_open_time ON positions(open_time);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_trades_instrument_status_time ON trades(instrument_id, status, order_time);
CREATE INDEX IF NOT EXISTS idx_positions_instrument_side ON positions(instrument_id, side);

-- =====================================================
-- 2. CREATE DATA CLEANUP FUNCTIONS
-- =====================================================

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete old tick data (keep 7 days)
    DELETE FROM tick_data 
    WHERE timestamp < NOW() - INTERVAL '7 days';
    
    -- Delete old system logs (keep 30 days)
    DELETE FROM system_logs 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    -- Delete old API usage data (keep 90 days)
    DELETE FROM api_usage 
    WHERE date < NOW() - INTERVAL '90 days';
    
    -- Delete old API errors (keep 30 days)
    DELETE FROM api_errors 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    RAISE NOTICE 'Cleanup completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to check data quality
CREATE OR REPLACE FUNCTION check_data_quality()
RETURNS TABLE (
    table_name text,
    issue_type text,
    issue_count bigint,
    details text
) AS $$
BEGIN
    -- Check for data gaps in candle data
    RETURN QUERY
    SELECT 
        'candle_data'::text as table_name,
        'data_gaps'::text as issue_type,
        COUNT(*)::bigint as issue_count,
        'Gaps found in time series data'::text as details
    FROM (
        SELECT 
            instrument_id,
            timeframe_id,
            timestamp,
            LAG(timestamp) OVER (
                PARTITION BY instrument_id, timeframe_id 
                ORDER BY timestamp
            ) as prev_timestamp
        FROM candle_data
    ) gaps
    WHERE timestamp - prev_timestamp > INTERVAL '5 minutes';
    
    -- Check for invalid OHLC data
    RETURN QUERY
    SELECT 
        'candle_data'::text as table_name,
        'invalid_ohlc'::text as issue_type,
        COUNT(*)::bigint as issue_count,
        'Invalid OHLC relationships found'::text as details
    FROM candle_data
    WHERE 
        high < low OR
        high < open OR
        high < close OR
        low > open OR
        low > close;
        
    -- Check for duplicate timestamps
    RETURN QUERY
    SELECT 
        'tick_data'::text as table_name,
        'duplicates'::text as issue_type,
        COUNT(*)::bigint as issue_count,
        'Duplicate timestamps found'::text as details
    FROM (
        SELECT instrument_id, timestamp, COUNT(*)
        FROM tick_data
        GROUP BY instrument_id, timestamp
        HAVING COUNT(*) > 1
    ) duplicates;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. CREATE MAINTENANCE FUNCTIONS
-- =====================================================

-- Function to update table statistics
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
    ANALYZE tick_data;
    ANALYZE candle_data;
    ANALYZE trades;
    ANALYZE positions;
    ANALYZE instruments;
    ANALYZE strategies;
    ANALYZE system_logs;
    
    RAISE NOTICE 'Table statistics updated successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to get database size information
CREATE OR REPLACE FUNCTION get_database_stats()
RETURNS TABLE (
    table_name text,
    row_count bigint,
    table_size text,
    index_size text,
    total_size text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        n_tup_ins + n_tup_upd + n_tup_del as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. CREATE PERFORMANCE MONITORING VIEWS
-- =====================================================

-- View for slow queries
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    shared_blks_hit,
    shared_blks_read
FROM pg_stat_statements 
WHERE mean_time > 1000
ORDER BY mean_time DESC;

-- View for table access statistics
CREATE OR REPLACE VIEW table_access_stats AS
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- View for index usage statistics
CREATE OR REPLACE VIEW index_usage_stats AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- =====================================================
-- 5. CREATE DATA RETENTION POLICIES
-- =====================================================

-- Create retention policy table if it doesn't exist
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) UNIQUE NOT NULL,
    retention_days INTEGER NOT NULL,
    archival_days INTEGER,
    compression_days INTEGER,
    is_active BOOLEAN DEFAULT true,
    last_cleanup TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default retention policies
INSERT INTO data_retention_policies (table_name, retention_days, archival_days, compression_days) VALUES
    ('tick_data', 7, 3, 1),
    ('candle_data', 365, 90, 30),
    ('market_data', 180, 60, 15),
    ('system_logs', 30, 7, 1),
    ('api_usage', 90, 30, 7),
    ('api_errors', 30, 7, 1)
ON CONFLICT (table_name) DO UPDATE SET
    retention_days = EXCLUDED.retention_days,
    archival_days = EXCLUDED.archival_days,
    compression_days = EXCLUDED.compression_days,
    updated_at = NOW();

-- =====================================================
-- 6. CREATE CACHE MANAGEMENT
-- =====================================================

-- Create cache table for frequently accessed data
CREATE TABLE IF NOT EXISTS data_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    cache_value JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    last_accessed TIMESTAMP DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for cache table
CREATE INDEX IF NOT EXISTS idx_data_cache_expires ON data_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_data_cache_last_accessed ON data_cache(last_accessed);

-- Function to cleanup expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM data_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. CREATE CONNECTION MONITORING
-- =====================================================

-- Create connection metrics table
CREATE TABLE IF NOT EXISTS connection_metrics (
    id SERIAL PRIMARY KEY,
    total_connections INTEGER,
    active_connections INTEGER,
    idle_connections INTEGER,
    waiting_connections INTEGER,
    max_connections INTEGER,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Function to record connection metrics
CREATE OR REPLACE FUNCTION record_connection_metrics()
RETURNS void AS $$
DECLARE
    total_conn INTEGER;
    active_conn INTEGER;
    idle_conn INTEGER;
    waiting_conn INTEGER;
    max_conn INTEGER;
BEGIN
    -- Get connection statistics
    SELECT 
        count(*) INTO total_conn
    FROM pg_stat_activity;
    
    SELECT 
        count(*) INTO active_conn
    FROM pg_stat_activity 
    WHERE state = 'active';
    
    SELECT 
        count(*) INTO idle_conn
    FROM pg_stat_activity 
    WHERE state = 'idle';
    
    SELECT 
        count(*) INTO waiting_conn
    FROM pg_stat_activity 
    WHERE state = 'idle in transaction';
    
    SELECT 
        setting::INTEGER INTO max_conn
    FROM pg_settings 
    WHERE name = 'max_connections';
    
    -- Insert metrics
    INSERT INTO connection_metrics (
        total_connections,
        active_connections,
        idle_connections,
        waiting_connections,
        max_connections
    ) VALUES (
        total_conn,
        active_conn,
        idle_conn,
        waiting_conn,
        max_conn
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. CREATE SCHEDULED MAINTENANCE
-- =====================================================

-- Function to run daily maintenance
CREATE OR REPLACE FUNCTION daily_maintenance()
RETURNS void AS $$
BEGIN
    -- Update statistics
    PERFORM update_table_statistics();
    
    -- Cleanup old data
    PERFORM cleanup_old_data();
    
    -- Cleanup expired cache
    PERFORM cleanup_expired_cache();
    
    -- Record connection metrics
    PERFORM record_connection_metrics();
    
    RAISE NOTICE 'Daily maintenance completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to run weekly maintenance
CREATE OR REPLACE FUNCTION weekly_maintenance()
RETURNS void AS $$
BEGIN
    -- Run daily maintenance
    PERFORM daily_maintenance();
    
    -- Additional weekly tasks
    -- Note: REINDEX and VACUUM should be run manually or with proper scheduling
    
    RAISE NOTICE 'Weekly maintenance completed successfully';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. CREATE USEFUL QUERIES FOR MONITORING
-- =====================================================

-- Query to check database health
CREATE OR REPLACE VIEW database_health AS
SELECT 
    'Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value
UNION ALL
SELECT 
    'Active Connections',
    count(*)::text
FROM pg_stat_activity 
WHERE state = 'active'
UNION ALL
SELECT 
    'Cache Hit Ratio',
    CASE 
        WHEN sum(heap_blks_hit + heap_blks_read) = 0 THEN '0%'
        ELSE round(100.0 * sum(heap_blks_hit) / sum(heap_blks_hit + heap_blks_read), 2) || '%'
    END
FROM pg_statio_user_tables
UNION ALL
SELECT 
    'Slow Queries (>1s)',
    count(*)::text
FROM pg_stat_statements 
WHERE mean_time > 1000;

-- =====================================================
-- 10. FINAL SETUP COMMANDS
-- =====================================================

-- Grant necessary permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_app_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO your_app_user;

-- Create a maintenance user (optional)
-- CREATE USER maintenance_user WITH PASSWORD 'secure_password';
-- GRANT EXECUTE ON FUNCTION daily_maintenance() TO maintenance_user;
-- GRANT EXECUTE ON FUNCTION weekly_maintenance() TO maintenance_user;

-- Enable pg_stat_statements extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Set up logging for performance monitoring
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_statement = 'none';
ALTER SYSTEM SET log_destination = 'stderr';

-- Reload configuration
SELECT pg_reload_conf();

-- Run initial statistics update
SELECT update_table_statistics();

-- Display current database stats
SELECT * FROM get_database_stats();

-- Display database health
SELECT * FROM database_health;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Database optimization script completed successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Monitor performance using the created views';
    RAISE NOTICE '2. Set up scheduled maintenance using cron or pg_cron';
    RAISE NOTICE '3. Configure connection pooling with PgBouncer';
    RAISE NOTICE '4. Set up automated backups';
    RAISE NOTICE '5. Monitor disk space and plan for partitioning if needed';
END $$; 