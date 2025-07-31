# Database Improvements Guide

## 🚀 **Performance Optimizations**

### 1. **Index Optimization**

#### **Current Indexes Added:**

```sql
-- TickData indexes
CREATE INDEX idx_tick_data_instrument_timestamp ON tick_data(instrument_id, timestamp);
CREATE INDEX idx_tick_data_timestamp ON tick_data(timestamp);
CREATE INDEX idx_tick_data_instrument_timestamp_desc ON tick_data(instrument_id, timestamp DESC);

-- CandleData indexes
CREATE INDEX idx_candle_data_instrument_timeframe_timestamp ON candle_data(instrument_id, timeframe_id, timestamp);
CREATE INDEX idx_candle_data_instrument_timeframe_timestamp_desc ON candle_data(instrument_id, timeframe_id, timestamp DESC);
CREATE INDEX idx_candle_data_timeframe_timestamp ON candle_data(timeframe_id, timestamp);
CREATE INDEX idx_candle_data_timestamp ON candle_data(timestamp);
```

#### **Additional Indexes to Consider:**

```sql
-- For frequently accessed queries
CREATE INDEX idx_trades_session_status ON trades(session_id, status);
CREATE INDEX idx_positions_session_side ON positions(session_id, side);
CREATE INDEX idx_market_data_instrument_timestamp ON market_data(instrument_id, timestamp);

-- Partial indexes for active data
CREATE INDEX idx_active_instruments ON instruments(is_active) WHERE is_active = true;
CREATE INDEX idx_active_strategies ON strategies(is_active) WHERE is_active = true;
```

### 2. **Table Partitioning**

#### **Partition Large Tables by Date:**

```sql
-- Partition TickData by month
CREATE TABLE tick_data_2024_01 PARTITION OF tick_data
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE tick_data_2024_02 PARTITION OF tick_data
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Partition CandleData by month
CREATE TABLE candle_data_2024_01 PARTITION OF candle_data
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

#### **Benefits:**

- Faster queries on recent data
- Easier data archival
- Better maintenance performance
- Reduced index size

### 3. **Data Compression**

#### **Enable Compression for Historical Data:**

```sql
-- Compress old data using PostgreSQL's built-in compression
ALTER TABLE tick_data SET (compression = 'zstd');

-- Or use external compression tools
-- pg_repack for online table compression
```

## 📊 **Data Management Strategies**

### 1. **Data Retention Policies**

#### **Automated Cleanup:**

```sql
-- Create function for automated cleanup
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Delete old tick data (keep 7 days)
    DELETE FROM tick_data
    WHERE timestamp < NOW() - INTERVAL '7 days';

    -- Archive old candle data (keep 1 year)
    DELETE FROM candle_data
    WHERE timestamp < NOW() - INTERVAL '1 year';

    -- Clean up old system logs (keep 30 days)
    DELETE FROM system_logs
    WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (using pg_cron extension)
SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data();');
```

### 2. **Data Archival Strategy**

#### **Archive Tables:**

```sql
-- Create archive tables
CREATE TABLE tick_data_archive (LIKE tick_data INCLUDING ALL);
CREATE TABLE candle_data_archive (LIKE candle_data INCLUDING ALL);

-- Archive function
CREATE OR REPLACE FUNCTION archive_old_data()
RETURNS void AS $$
BEGIN
    -- Move old data to archive
    INSERT INTO tick_data_archive
    SELECT * FROM tick_data
    WHERE timestamp < NOW() - INTERVAL '30 days';

    DELETE FROM tick_data
    WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

## 🔧 **Performance Monitoring**

### 1. **Query Performance Tracking**

#### **Enable Query Logging:**

```sql
-- Enable slow query logging
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1 second
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_destination = 'csvlog';

-- Reload configuration
SELECT pg_reload_conf();
```

#### **Monitor Slow Queries:**

```sql
-- Find slow queries
SELECT
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC;
```

### 2. **Table Statistics**

#### **Update Statistics Regularly:**

```sql
-- Update table statistics
ANALYZE tick_data;
ANALYZE candle_data;
ANALYZE trades;
ANALYZE positions;

-- Check table sizes
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE tablename IN ('tick_data', 'candle_data');
```

## 🚨 **Connection Pooling**

### 1. **Configure Connection Pool**

#### **Using PgBouncer:**

```ini
# pgbouncer.ini
[databases]
paradigm_trading = host=localhost port=5432 dbname=paradigm_trading

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
```

#### **Update Application Configuration:**

```typescript
// Update DATABASE_URL to use PgBouncer
DATABASE_URL = "postgresql://username:password@localhost:6432/paradigm_trading";
```

### 2. **Connection Monitoring**

#### **Monitor Active Connections:**

```sql
-- Check active connections
SELECT
    datname,
    usename,
    application_name,
    client_addr,
    state,
    query_start
FROM pg_stat_activity
WHERE state = 'active';
```

## 📈 **Caching Strategy**

### 1. **Application-Level Caching**

#### **Redis Integration:**

```typescript
import Redis from "ioredis";

const redis = new Redis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: 3,
});

// Cache frequently accessed data
async function getCachedMarketData(symbol: string, timeframe: string) {
  const cacheKey = `market_data:${symbol}:${timeframe}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch from database
  const data = await db.candleData.findMany({
    where: {
      instrument: { symbol },
      timeframe: { name: timeframe },
    },
    orderBy: { timestamp: "desc" },
    take: 100,
  });

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(data));

  return data;
}
```

### 2. **Database Query Result Caching**

#### **Materialized Views:**

```sql
-- Create materialized view for frequently accessed data
CREATE MATERIALIZED VIEW latest_candles AS
SELECT
    i.symbol,
    tf.name as timeframe,
    cd.timestamp,
    cd.open,
    cd.high,
    cd.low,
    cd.close,
    cd.volume
FROM candle_data cd
JOIN instruments i ON cd.instrument_id = i.id
JOIN timeframe_configs tf ON cd.timeframe_id = tf.id
WHERE cd.timestamp = (
    SELECT MAX(timestamp)
    FROM candle_data cd2
    WHERE cd2.instrument_id = cd.instrument_id
    AND cd2.timeframe_id = cd.timeframe_id
);

-- Refresh materialized view
REFRESH MATERIALIZED VIEW latest_candles;
```

## 🔍 **Data Quality Monitoring**

### 1. **Data Validation**

#### **Check for Data Gaps:**

```sql
-- Find gaps in time series data
WITH time_series AS (
  SELECT
    instrument_id,
    timeframe_id,
    timestamp,
    LAG(timestamp) OVER (
      PARTITION BY instrument_id, timeframe_id
      ORDER BY timestamp
    ) as prev_timestamp
  FROM candle_data
)
SELECT
  instrument_id,
  timeframe_id,
  prev_timestamp,
  timestamp,
  EXTRACT(EPOCH FROM (timestamp - prev_timestamp)) / 60 as gap_minutes
FROM time_series
WHERE timestamp - prev_timestamp > INTERVAL '5 minutes';
```

### 2. **Data Integrity Checks**

#### **Validate OHLC Data:**

```sql
-- Check for invalid OHLC relationships
SELECT
  id,
  instrument_id,
  timestamp,
  open,
  high,
  low,
  close
FROM candle_data
WHERE
  high < low OR
  high < open OR
  high < close OR
  low > open OR
  low > close;
```

## 🛠️ **Maintenance Procedures**

### 1. **Regular Maintenance**

#### **Daily Maintenance:**

```sql
-- Update statistics
ANALYZE;

-- Clean up old data
SELECT cleanup_old_data();

-- Check for data quality issues
SELECT check_data_quality();
```

#### **Weekly Maintenance:**

```sql
-- Reindex tables
REINDEX TABLE tick_data;
REINDEX TABLE candle_data;

-- Vacuum tables
VACUUM ANALYZE tick_data;
VACUUM ANALYZE candle_data;
```

### 2. **Backup Strategy**

#### **Automated Backups:**

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/paradigm_trading"

# Create backup
pg_dump -h localhost -U username -d paradigm_trading > "$BACKUP_DIR/backup_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/backup_$DATE.sql"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete
```

## 📊 **Performance Metrics**

### 1. **Key Performance Indicators**

#### **Monitor These Metrics:**

- **Query Response Time**: Average time for common queries
- **Connection Pool Utilization**: Active vs idle connections
- **Table Growth Rate**: Data volume increase over time
- **Index Usage**: How often indexes are used
- **Cache Hit Rate**: Application cache effectiveness

### 2. **Alerting Setup**

#### **Set Up Alerts For:**

- Slow queries (> 1 second)
- High connection count (> 80% of max)
- Data gaps (> 5 minutes)
- Disk space usage (> 80%)
- Backup failures

## 🎯 **Implementation Priority**

### **Phase 1 (Immediate):**

1. ✅ Add missing indexes
2. ✅ Set up data retention policies
3. ✅ Configure connection pooling
4. ✅ Implement basic caching

### **Phase 2 (Short-term):**

1. 🔄 Set up table partitioning
2. 🔄 Implement data archival
3. 🔄 Add performance monitoring
4. 🔄 Set up automated maintenance

### **Phase 3 (Long-term):**

1. 🔄 Advanced caching strategies
2. 🔄 Data compression
3. 🔄 Advanced monitoring and alerting
4. 🔄 Performance optimization tuning

## 💡 **Best Practices**

### 1. **Query Optimization**

- Use `EXPLAIN ANALYZE` to understand query performance
- Avoid `SELECT *` - specify only needed columns
- Use appropriate WHERE clauses to limit data
- Consider using CTEs for complex queries

### 2. **Index Management**

- Monitor index usage with `pg_stat_user_indexes`
- Remove unused indexes
- Create partial indexes for filtered queries
- Consider covering indexes for frequently accessed data

### 3. **Data Management**

- Implement proper data retention policies
- Archive old data instead of deleting
- Use appropriate data types (avoid TEXT for small strings)
- Consider using JSONB for flexible data structures

### 4. **Monitoring**

- Set up comprehensive monitoring
- Use tools like pgAdmin, Grafana, or custom dashboards
- Monitor both application and database metrics
- Set up alerts for critical issues

This comprehensive database improvement strategy will significantly enhance your system's performance, scalability, and maintainability! 🚀
