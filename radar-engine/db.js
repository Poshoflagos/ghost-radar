// radar-engine/db.js
import pg from 'pg';
const { Pool } = pg;
import 'dotenv/config';

// 🛡️ SECURITY FIX: Read from .env or Northflank secrets instead of hardcoding
const NEON_URL = process.env.DATABASE_URL;

if (!NEON_URL) {
    console.warn('[Ghost Radar DB] WARNING: DATABASE_URL is missing. Database connection will fail.');
}

export const pool = new Pool({
    connectionString: NEON_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000, // wait up to 20s for a connection (slow London to Ohio link)
    idleTimeoutMillis: 300000,      // keep idle connections for 5 minutes so we don't redo the slow handshake
    keepAlive: true,                // stops long-distance connections from being silently dropped
    max: 10
});

pool.on('error', (err) => {
    console.error('[Ghost Radar DB] Unexpected error on idle client:', err.message);
});

/**
 * Connect with retry to handle Neon waking up from its 5-minute nap cleanly.
 */
export async function connectWithRetry(retries = 3, delayMs = 1500) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const client = await pool.connect();
            return client;
        } catch (err) {
            console.warn(`[Ghost Radar DB] Connection attempt ${attempt} failed. Retrying...`);
            if (attempt === retries) throw err;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
}

export async function initDB() {
    let client;
    try {
        client = await connectWithRetry();
        await client.query('BEGIN');

        await client.query(`
            CREATE TABLE IF NOT EXISTS tracked_wallets (
                address VARCHAR(64) PRIMARY KEY,
                label VARCHAR(64) DEFAULT 'Unknown Degen',
                tier VARCHAR(16) DEFAULT 'Trench',
                total_trades INT DEFAULT 0,
                wins INT DEFAULT 0,
                win_rate NUMERIC(5, 2) DEFAULT 0.0,
                realized_pnl_sol NUMERIC(16, 4) DEFAULT 0.0,
                last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS wallet_trades (
                id SERIAL PRIMARY KEY,
                wallet_address VARCHAR(64) REFERENCES tracked_wallets(address) ON DELETE CASCADE,
                token_address VARCHAR(64) NOT NULL,
                token_symbol VARCHAR(32) DEFAULT 'UNKNOWN',
                trade_type VARCHAR(8) NOT NULL,
                capital_sol NUMERIC(16, 4) NOT NULL,
                token_amount NUMERIC(38, 6), 
                price_sol NUMERIC(28, 12),
                tx_signature VARCHAR(128) UNIQUE NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS deployer_history (
                deployer_address VARCHAR(64) PRIMARY KEY,
                total_launches INT DEFAULT 1,
                rugs_detected INT DEFAULT 0,
                last_launch_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS alert_feedback_loop (
                token_address VARCHAR(64) PRIMARY KEY,
                token_name VARCHAR(64),
                initial_mcap NUMERIC(20, 2),
                peak_mcap NUMERIC(20, 2),
                status VARCHAR(16) DEFAULT 'PENDING',
                alerted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                last_evaluated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS alpha_zone_feed (
                token_address VARCHAR(64) PRIMARY KEY,
                token_symbol VARCHAR(32) DEFAULT 'UNKNOWN',
                token_name VARCHAR(128) DEFAULT 'Unknown Token',
                image_url TEXT,
                pair_address VARCHAR(64),
                dex_id VARCHAR(32) NOT NULL,
                lane VARCHAR(16) NOT NULL, 
                signal_tag VARCHAR(32),    
                price_usd NUMERIC(28, 12) DEFAULT 0.0,
                mcap_usd NUMERIC(20, 2) DEFAULT 0.0,
                liquidity_usd NUMERIC(20, 2) DEFAULT 0.0,
                volume_5m NUMERIC(20, 2) DEFAULT 0.0,
                volume_1h NUMERIC(20, 2) DEFAULT 0.0,
                price_change_5m NUMERIC(10, 2) DEFAULT 0.0,
                price_change_1h NUMERIC(10, 2) DEFAULT 0.0,
                buy_ratio_5m NUMERIC(5, 2) DEFAULT 0.50,
                buy_ratio_1h NUMERIC(5, 2) DEFAULT 0.50,
                rank_score NUMERIC(8, 2) DEFAULT 0.0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_alpha_zone_lane_rank 
                ON alpha_zone_feed (lane, rank_score DESC);
            CREATE INDEX IF NOT EXISTS idx_alpha_zone_updated 
                ON alpha_zone_feed (updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_wallet_trades_token
                ON wallet_trades (token_address);
        `);

        // Phase 3 Schema Additions for Ghost Lens and GemBox tracking
        await client.query(`
            ALTER TABLE alpha_zone_feed 
            ADD COLUMN IF NOT EXISTS p_hash VARCHAR(64);

            CREATE TABLE IF NOT EXISTS gembox_picks (
                id SERIAL PRIMARY KEY,
                token_address VARCHAR(64) UNIQUE NOT NULL,
                token_symbol VARCHAR(32),
                picked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                entry_mcap NUMERIC(20, 2),
                entry_price_usd NUMERIC(28, 12),
                current_mcap NUMERIC(20, 2),
                peak_mcap NUMERIC(20, 2),
                lowest_mcap NUMERIC(20, 2),
                current_roi_multiplier NUMERIC(10, 2) DEFAULT 1.0,
                peak_roi_multiplier NUMERIC(10, 2) DEFAULT 1.0,
                max_drawdown_percent NUMERIC(5, 2) DEFAULT 0.0,
                hit_1_5x BOOLEAN DEFAULT FALSE,
                hit_2x BOOLEAN DEFAULT FALSE,
                hit_5x BOOLEAN DEFAULT FALSE,
                hit_10x BOOLEAN DEFAULT FALSE,
                score_composite INT,
                score_cabal INT,
                score_deployer INT,
                score_smart_money INT,
                score_velocity INT,
                score_safety INT,
                score_opportunity INT,
                status VARCHAR(16) DEFAULT 'ACTIVE',
                params_version VARCHAR(16)
            );

            CREATE TABLE IF NOT EXISTS gembox_rejections (
                token_address VARCHAR(64) PRIMARY KEY,
                token_symbol VARCHAR(32),
                mcap NUMERIC(20, 2),
                liquidity NUMERIC(20, 2),
                reject_reason VARCHAR(64),
                rejected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS gembox_performance_ledger (
                period_type VARCHAR(16) NOT NULL, 
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                total_picks INT DEFAULT 0,
                win_count_2x INT DEFAULT 0,
                win_rate_2x NUMERIC(5, 2) DEFAULT 0.0,
                p50_roi_multiplier NUMERIC(10, 2) DEFAULT 0.0,
                p90_roi_multiplier NUMERIC(10, 2) DEFAULT 0.0,
                avg_max_drawdown NUMERIC(5, 2) DEFAULT 0.0,
                is_winning_period BOOLEAN,
                PRIMARY KEY (period_type, period_start)
            );
        `);

        await client.query('COMMIT');
        console.log('[Ghost Radar] Database tables verified and patched.');
    } catch (err) {
        if (client) await client.query('ROLLBACK');
        console.warn('[Ghost Radar Warning] PostgreSQL init failed:', err.message);
    } finally {
        if (client) client.release();
    }
}

export async function pruneStaleAlphaZone() {
    try {
        const res = await pool.query(`DELETE FROM alpha_zone_feed WHERE updated_at < NOW() - INTERVAL '48 hours';`);
        if (res.rowCount > 0) console.log(`[Ghost Radar Alpha Zone] Pruned ${res.rowCount} stale tokens.`);
    } catch (err) {
        console.error('[Ghost Radar Alpha Zone] Prune Error:', err.message);
    }
}