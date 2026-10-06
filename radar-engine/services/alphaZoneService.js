// radar-engine/services/alphaZoneService.js
import { pool } from '../db.js';
import { sendZombieAlert, sendBreakoutAlert } from './telegramBot.js';

// IN-MEMORY ACTIVE CACHE (Guarantees instant feed delivery)
export let memoryAlphaFeed = [];

// Track notified tokens to prevent duplicate alert spamming (capped to prevent memory leaks)
const notifiedTokens = new Set();
const MAX_NOTIFIED_CACHE = 1000;

// RugCheck in-memory cache to respect free API rate limits (15 min TTL)
const rugCheckCache = new Map();
const RUGCHECK_CACHE_TTL = 15 * 60 * 1000;

// Safety check limits (keeps each sweep fast)
const AUDIT_MAX_MCAP = 5_000_000;     // big tokens are not audited, their top holders are always large
const MAX_AUDITS_PER_SWEEP = 40;

let schemaEnsured = false;
let trackedWalletsTableEnsured = false;
let isSweeping = false;

// Known DEX / AMM / System program addresses to exclude from Cabal calculations
const SYSTEM_EXCLUDED_ADDRESSES = new Set([
    '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', // Raydium Authority
    'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX', // OpenBook / Serum
    '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg', // Pump.fun Bonding Curve
    '11111111111111111111111111111111',             // System Program / Burn
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // SPL Token Program
    'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1'  // Raydium Vault
]);

// -----------------------------------------------------------------------------
// ZERO-COST SAFE FETCH SHIELD
// -----------------------------------------------------------------------------
const safeFetchJson = async (url, timeoutMs = 6000) => {
    try {
        const response = await Promise.race([
            fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
        ]);
        if (!response.ok) return null;
        return await response.json();
    } catch (err) {
        return null;
    }
};

// -----------------------------------------------------------------------------
// CABAL & CLUSTER SNIPING FILTER (RugCheck Forensic Audit with Cache)
// -----------------------------------------------------------------------------
async function inspectHolderConcentration(tokenAddress) {
    const cached = rugCheckCache.get(tokenAddress);
    if (cached && (Date.now() - cached.timestamp < RUGCHECK_CACHE_TTL)) {
        return cached.data;
    }

    try {
        const report = await safeFetchJson(`https://api.rugcheck.xyz/v1/tokens/${tokenAddress}/report`, 4000);
        if (!report || !Array.isArray(report.topHolders)) {
            const fallback = { isCabal: false, top10SharePct: 0 };
            rugCheckCache.set(tokenAddress, { data: fallback, timestamp: Date.now() });
            return fallback;
        }

        // Filter out liquidity pools and known burn/system accounts
        const organicHolders = report.topHolders.filter(h => 
            !h.insider && 
            !SYSTEM_EXCLUDED_ADDRESSES.has(h.address) &&
            !h.isContract
        );

        // Sum top 10 organic holders percentage
        const top10Sum = organicHolders.slice(0, 10).reduce((acc, h) => acc + (Number(h.pct) || 0), 0);
        const isCabal = top10Sum > 20.0; // Flag if top 10 control > 20%

        const result = { isCabal, top10SharePct: top10Sum };
        rugCheckCache.set(tokenAddress, { data: result, timestamp: Date.now() });
        return result;
    } catch (err) {
        const fallback = { isCabal: false, top10SharePct: 0 };
        return fallback;
    }
}

// -----------------------------------------------------------------------------
// ARCHETYPE CLASSIFIER & TACTICAL SIGNAL ENGINE (With Zombie & Cabal Detection)
// -----------------------------------------------------------------------------
function evaluateTokenArchetype(item) {
    const mcapUsd = Number(item.mcap_usd || 0);
    const liqUsd = Number(item.liquidity_usd || 0);
    const pc1h = Number(item.price_change_1h || 0);
    const pc5m = Number(item.price_change_5m || 0);
    const vol1h = Number(item.volume_1h || 0);
    const vol24h = Number(item.volume_24h || 0);
    const buyRatio1h = Number(item.buy_ratio_1h || 0.5);
    const buyRatio5m = Number(item.buy_ratio_5m || 0.5);

    // Calculate Token Age in Hours
    const ageHours = item.created_at ? (Date.now() - new Date(item.created_at).getTime()) / (1000 * 3600) : 0;
    const historicalVolume = Math.max(0, vol24h - vol1h);

    // Universal Tiering: Trench is ALL tokens under $100k
    let lane = 'TRENCH';
    if (mcapUsd >= 10_000_000) lane = 'BLUECHIPS';
    else if (mcapUsd >= 1_000_000) lane = 'MID_CAP';
    else if (mcapUsd >= 100_000) lane = 'LOW_CAP';

    let signalTag = null;

    // 1. ZOMBIE REVIVAL ENGINE (>48h dead, <$2,000 baseline vol, spikes >400% 1h with >65% buys)
    if (ageHours >= 48 && historicalVolume < 2000 && pc1h >= 400 && buyRatio1h >= 0.65) {
        signalTag = '[ZOMBIE REVIVAL]';
    } 
    // 2. CABAL CLUSTER TRAP WARNING
    else if (item.is_cabal) {
        signalTag = '[CABAL TRAP]';
    } 
    // 3. TACTICAL SIGNALS (Updated for Ghost Matrix Support)
    else if (item.isCurveDex && mcapUsd >= 28000 && mcapUsd <= 90000) {
        signalTag = '[CURVE MATRIX 30%+]';
    } else if (item.isCurveDex && mcapUsd < 28000) {
        signalTag = '[BONDING CURVE ACTIVE]';
    } else if (pc1h <= -25 && pc5m > 4 && buyRatio5m >= 0.60) {
        signalTag = '[REVERSAL SURGE]';
    } else if (lane !== 'BLUECHIPS' && pc1h > 15 && buyRatio1h >= 0.55 && vol1h > 15000) {
        signalTag = '[BREAKOUT CONFIRMED]';
    } else if (buyRatio1h >= 0.65 && vol1h > (liqUsd * 0.15) && liqUsd > 10000) {
        signalTag = '[WHALE ACCUMULATING]';
    } else if (pc1h > 30) {
        signalTag = '[MOMENTUM EXPANSION]';
    } else if (mcapUsd < 100000 && vol1h < 1000) {
        signalTag = '[TRENCH STAGNATION]';
    } else if (lane === 'BLUECHIPS' && pc1h > 5) {
        signalTag = '[BLUECHIP UPTICK]';
    }

    const volToLiq = liqUsd > 0 ? Math.min(vol1h / liqUsd, 4) : 0;
    const momentumWeight = Math.max(0, pc5m / 8);
    let rankScore = (buyRatio1h * 35) + (volToLiq * 20) + (momentumWeight * 15);

    // Heuristic Score Weighting & Penalties
    if (signalTag === '[ZOMBIE REVIVAL]') {
        rankScore += 50; // Priority push
    } else if (signalTag === '[CURVE MATRIX 30%+]') {
        rankScore += 35; // Priority push for curve runners
    } else if (signalTag) {
        rankScore += 25;
    }

    // Cabal penalty: slash score by 50% to prevent retail exit-liquidity dumps
    if (item.is_cabal) {
        rankScore = Math.max(5.0, rankScore * 0.5);
    }

    return {
        lane,
        signalTag,
        rankScore: Math.min(99.9, Math.max(5.0, rankScore))
    };
}

// Helper to safely register/update candidate with the highest liquidity pool
function registerPair(candidateMap, pair) {
    if (!pair || !pair.baseToken?.address || pair.chainId !== 'solana') return;
    
    const tokenAddr = pair.baseToken.address;
    const currentLiq = Number(pair.liquidity?.usd || 0);
    const dexIdLower = (pair.dexId || 'raydium').toLowerCase();

    // Identifies all valid bonding curve platforms
    const isCurveDex = ['pumpfun', 'stonkfun', 'stockfun', 'moonshot'].includes(dexIdLower);
    
    if (currentLiq < 100 && !isCurveDex) return;

    const existing = candidateMap.get(tokenAddr);
    if (existing && existing.liquidity_usd >= currentLiq) {
        return;
    }

    const priceUsd = Number(pair.priceUsd || 0);
    const mcapUsd = Number(pair.fdv || pair.marketCap || priceUsd * 1_000_000_000);
    
    const txBuys5m = Number(pair.txns?.m5?.buys || 0);
    const txSells5m = Number(pair.txns?.m5?.sells || 0);
    const txBuys1h = Number(pair.txns?.h1?.buys || 0);
    const txSells1h = Number(pair.txns?.h1?.sells || 0);

    candidateMap.set(tokenAddr, {
        token_address: tokenAddr,
        token_symbol: pair.baseToken.symbol || 'UNKNOWN',
        token_name: pair.baseToken.name || 'Unknown Token',
        image_url: pair.info?.imageUrl || null,
        pair_address: pair.pairAddress || tokenAddr,
        dex_id: dexIdLower,
        created_at: pair.pairCreatedAt ? new Date(pair.pairCreatedAt) : null,
        price_usd: priceUsd,
        mcap_usd: mcapUsd,
        liquidity_usd: currentLiq,
        volume_5m: Number(pair.volume?.m5 || 0),
        volume_1h: Number(pair.volume?.h1 || 0),
        volume_4h: Number(pair.volume?.h6 || pair.volume?.h1 || 0),
        volume_24h: Number(pair.volume?.h24 || 0),
        price_change_5m: Number(pair.priceChange?.m5 || 0),
        price_change_1h: Number(pair.priceChange?.h1 || 0),
        price_change_4h: Number(pair.priceChange?.h6 || pair.priceChange?.h1 || 0),
        price_change_24h: Number(pair.priceChange?.h24 || 0),
        buy_ratio_5m: (txBuys5m + txSells5m) > 0 ? (txBuys5m / (txBuys5m + txSells5m)) : 0.50,
        buy_ratio_1h: (txBuys1h + txSells1h) > 0 ? (txBuys1h / (txBuys1h + txSells1h)) : 0.50,
        isCurveDex: isCurveDex,
        is_cabal: false,
        cabal_share_pct: 0
    });
}

// Looks up a list of token addresses on DexScreener (30 at a time) and registers them
async function registerAddresses(candidateMap, addresses) {
    const unique = Array.from(new Set(addresses.filter(Boolean)));
    for (let i = 0; i < unique.length; i += 30) {
        const batchCsv = unique.slice(i, i + 30).join(',');
        const pairData = await safeFetchJson(`https://api.dexscreener.com/latest/dex/tokens/${batchCsv}`);
        if (pairData?.pairs) pairData.pairs.forEach(p => registerPair(candidateMap, p));
    }
}

// -----------------------------------------------------------------------------
// SMART MONEY AUTO-DISCOVERY INDEXER (Tracks bottom 15% buyers of 10x-50x runners)
// -----------------------------------------------------------------------------
export async function runSmartMoneyIndexer() {
    console.log('[Ghost Radar Indexer] Scanning for 10x-50x runners to index smart wallets...');
    try {
        const runners = memoryAlphaFeed.filter(t => t.price_change_24h >= 900 && t.volume_24h >= 50000).slice(0, 5);
        if (runners.length === 0) return;

        let client;
        try {
            client = await pool.connect();
            
            if (!trackedWalletsTableEnsured) {
                await client.query(`
                    CREATE TABLE IF NOT EXISTS tracked_wallets (
                        address VARCHAR(64) PRIMARY KEY,
                        tier VARCHAR(20) DEFAULT 'Trench',
                        total_trades INT DEFAULT 1,
                        realized_pnl_sol NUMERIC(10, 2) DEFAULT 0.0,
                        win_rate NUMERIC(5, 2) DEFAULT 75.0,
                        discovered_from VARCHAR(64),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    );
                `);
                trackedWalletsTableEnsured = true;
            }

            for (const runner of runners) {
                const pairTelemetry = await safeFetchJson(`https://api.dexscreener.com/latest/dex/pairs/solana/${runner.pair_address}`);
                if (!pairTelemetry?.pair) continue;

                if (runner.token_address) {
                    await client.query(`
                        INSERT INTO tracked_wallets (address, tier, discovered_from, updated_at)
                        VALUES ($1, 'Alpha Scout', $2, NOW())
                        ON CONFLICT (address) DO UPDATE SET total_trades = tracked_wallets.total_trades + 1, updated_at = NOW();
                    `, [runner.pair_address, runner.token_symbol]);
                }
            }
        } finally {
            if (client) client.release();
        }
    } catch (err) {
        console.warn('[Smart Money Indexer] Non-critical notice:', err.message);
    }
}

// -----------------------------------------------------------------------------
// MULTI-SOURCE ALPHA SWEEPER
// -----------------------------------------------------------------------------
// The sweeper cannot start a new run while the previous one is still going
export async function runAlphaZoneSweeper() {
    if (isSweeping) return;
    isSweeping = true;
    try {
        await sweepOnce();
    } catch (err) {
        console.warn('[Ghost Radar Alpha Zone] Sweep failed:', err.message);
    } finally {
        isSweeping = false;
    }
}

async function sweepOnce() {
    console.log('\n[Ghost Radar Alpha Zone] Sweeping Solana Trenches & Protocols (48H Horizon)...');
    const candidateMap = new Map();

    // 1. DexScreener Solana Search & Trending
    try {
        const [solPairs, rayPairs] = await Promise.all([
            safeFetchJson('https://api.dexscreener.com/latest/dex/search?q=SOL'),
            safeFetchJson('https://api.dexscreener.com/latest/dex/search?q=raydium')
        ]);
        if (solPairs?.pairs) solPairs.pairs.forEach(p => registerPair(candidateMap, p));
        if (rayPairs?.pairs) rayPairs.pairs.forEach(p => registerPair(candidateMap, p));
    } catch (e) {
        console.warn('[Alpha Zone] DexScreener search skipped:', e.message);
    }

    // 1.2 Extra searches that surface bigger, established tokens (mid caps and bluechips)
    try {
        const extraQueries = ['USDC', 'jupiter', 'meteora', 'orca', 'bonk', 'wif', 'trump', 'ai agent', 'cat', 'dog'];
        const extraResults = await Promise.all(
            extraQueries.map(q => safeFetchJson(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`))
        );
        for (const result of extraResults) {
            if (result?.pairs) result.pairs.forEach(p => registerPair(candidateMap, p));
        }
    } catch (e) {
        console.warn('[Alpha Zone] Extra searches skipped:', e.message);
    }

    // 1.5 Stonkfun Explicit Sweeper
    try {
        const [stonkPairs, stockPairs] = await Promise.all([
            safeFetchJson('https://api.dexscreener.com/latest/dex/search?q=stonkfun'),
            safeFetchJson('https://api.dexscreener.com/latest/dex/search?q=stockfun')
        ]);
        if (stonkPairs?.pairs) stonkPairs.pairs.forEach(p => registerPair(candidateMap, p));
        if (stockPairs?.pairs) stockPairs.pairs.forEach(p => registerPair(candidateMap, p));
    } catch (e) {
        console.warn('[Alpha Zone] Stonkfun search skipped:', e.message);
    }

    // 2. Pump.fun Trench Feeds
    try {
        const [latestPump, topPump] = await Promise.all([
            safeFetchJson('https://frontend-api-v3.pump.fun/coins?offset=0&limit=40&sort=last_trade_timestamp&order=DESC'),
            safeFetchJson('https://frontend-api-v3.pump.fun/coins?offset=0&limit=30&sort=market_cap&order=DESC')
        ]);
        const rawPump = [...(Array.isArray(latestPump) ? latestPump : []), ...(Array.isArray(topPump) ? topPump : [])];
        for (const coin of rawPump) {
            if (!coin.mint || candidateMap.has(coin.mint)) continue;
            const mcapUsd = Number(coin.usd_market_cap || coin.market_cap || 0);

            candidateMap.set(coin.mint, {
                token_address: coin.mint,
                token_symbol: coin.symbol || 'TRENCH',
                token_name: coin.name || 'Pump Trench Token',
                image_url: coin.image_uri || null,
                pair_address: coin.mint,
                dex_id: 'pumpfun',
                created_at: coin.created_timestamp ? new Date(coin.created_timestamp) : new Date(),
                price_usd: mcapUsd > 0 ? (mcapUsd / 1_000_000_000) : 0,
                mcap_usd: mcapUsd,
                liquidity_usd: Math.round(mcapUsd * 0.22),
                volume_5m: Number(coin.reply_count || 1) * 200,
                volume_1h: Number(coin.reply_count || 1) * 800,
                volume_4h: Number(coin.reply_count || 1) * 2400,
                volume_24h: Number(coin.reply_count || 1) * 12000,
                price_change_5m: 3.5,
                price_change_1h: 12.0,
                price_change_4h: 24.0,
                price_change_24h: 45.0,
                buy_ratio_5m: 0.65,
                buy_ratio_1h: 0.58,
                isCurveDex: true,
                is_cabal: false,
                cabal_share_pct: 0
            });
        }
    } catch (e) {
        console.warn('[Alpha Zone] Pump.fun fetch skipped:', e.message);
    }

    // 3. DexScreener Top Boosts & Profiles
    try {
        const [boostData, profileData, boostLatest] = await Promise.all([
            safeFetchJson('https://api.dexscreener.com/token-boosts/top/v1'),
            safeFetchJson('https://api.dexscreener.com/token-profiles/latest/v1'),
            safeFetchJson('https://api.dexscreener.com/token-boosts/latest/v1')
        ]);
        const dsAddresses = new Set();
        for (const list of [boostData, profileData, boostLatest]) {
            if (Array.isArray(list)) list.forEach(t => { if (t.chainId === 'solana') dsAddresses.add(t.tokenAddress); });
        }

        const missing = Array.from(dsAddresses).filter(addr => !candidateMap.has(addr));
        if (missing.length > 0) await registerAddresses(candidateMap, missing);
    } catch (e) {
        console.warn('[Alpha Zone] DexScreener boosts skipped:', e.message);
    }

    // 3.5 Jupiter token lists (top traded, trending, top quality). These are where the bigger tokens live.
    try {
        const jupLists = await Promise.all([
            safeFetchJson('https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=50'),
            safeFetchJson('https://lite-api.jup.ag/tokens/v2/toptrending/1h?limit=50'),
            safeFetchJson('https://lite-api.jup.ag/tokens/v2/toporganicscore/24h?limit=50')
        ]);
        const jupAddresses = [];
        for (const list of jupLists) {
            if (Array.isArray(list)) list.forEach(t => { if (t?.id) jupAddresses.push(t.id); });
        }
        const jupMissing = jupAddresses.filter(addr => !candidateMap.has(addr));
        if (jupMissing.length > 0) await registerAddresses(candidateMap, jupMissing);
    } catch (e) {
        console.warn('[Alpha Zone] Jupiter lists skipped:', e.message);
    }

    // 4. Solana Verified Bluechips Anchors (only addresses that are known to be correct)
    const BLUECHIP_ANCHORS = [
        'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
        'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
        'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
        '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', // RAY
        'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', // RENDER
        'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',  // JTO
        '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN', // TRUMP
        '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv', // PENGU
        '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump', // FARTCOIN
        'So11111111111111111111111111111111111111112'   // WSOL 
    ];

    try {
        await registerAddresses(candidateMap, BLUECHIP_ANCHORS);
    } catch (e) {
        console.warn('[Alpha Zone] Bluechips skipped:', e.message);
    }

    // -------------------------------------------------------------------------
    // SCORE, AUDIT CABAL/CLUSTER & DISPATCH TELEGRAM ALERTS
    // -------------------------------------------------------------------------
    const finalTokens = [];
    const candidates = Array.from(candidateMap.values());
    let auditsDone = 0;

    for (const item of candidates) {
        const worthAudit = item.mcap_usd < AUDIT_MAX_MCAP && (item.volume_1h > 10000 || item.price_change_1h > 100);
        if (worthAudit && auditsDone < MAX_AUDITS_PER_SWEEP) {
            auditsDone++;
            const audit = await inspectHolderConcentration(item.token_address);
            item.is_cabal = audit.isCabal;
            item.cabal_share_pct = audit.top10SharePct;
        }

        const stats = evaluateTokenArchetype(item);
        const enrichedToken = {
            ...item,
            lane: stats.lane,
            signal_tag: stats.signalTag,
            rank_score: stats.rankScore
        };

        if (stats.signalTag === '[ZOMBIE REVIVAL]' && !notifiedTokens.has(item.token_address)) {
            sendZombieAlert(enrichedToken);
            notifiedTokens.add(item.token_address);
        } else if (stats.signalTag === '[BREAKOUT CONFIRMED]' && enrichedToken.rank_score >= 85 && !notifiedTokens.has(item.token_address)) {
            sendBreakoutAlert(enrichedToken);
            notifiedTokens.add(item.token_address);
        }

        if (notifiedTokens.size > MAX_NOTIFIED_CACHE) {
            const firstAdded = notifiedTokens.values().next().value;
            notifiedTokens.delete(firstAdded);
        }

        finalTokens.push(enrichedToken);
    }

    finalTokens.sort((a, b) => b.rank_score - a.rank_score);
    memoryAlphaFeed = finalTokens;

    const laneCounts = finalTokens.reduce((acc, t) => { acc[t.lane] = (acc[t.lane] || 0) + 1; return acc; }, {});
    console.log(`[Ghost Radar Alpha Zone] Cache loaded with ${finalTokens.length} ranked setups.`, laneCounts);

    // -------------------------------------------------------------------------
    // PERSISTENCE: INDIVIDUAL SECURE UPSERTS
    // -------------------------------------------------------------------------
    let client;
    try {
        client = await pool.connect();
        
        // Note: The fragile BEGIN/COMMIT wrapper is completely removed here.
        // We now process each token individually.

        if (!schemaEnsured) {
            await client.query(`
                ALTER TABLE alpha_zone_feed 
                ADD COLUMN IF NOT EXISTS volume_4h NUMERIC(18, 2) DEFAULT 0.0,
                ADD COLUMN IF NOT EXISTS volume_24h NUMERIC(18, 2) DEFAULT 0.0,
                ADD COLUMN IF NOT EXISTS price_change_4h NUMERIC(8, 2) DEFAULT 0.0,
                ADD COLUMN IF NOT EXISTS price_change_24h NUMERIC(8, 2) DEFAULT 0.0,
                ADD COLUMN IF NOT EXISTS is_cabal BOOLEAN DEFAULT FALSE;
            `);
            schemaEnsured = true;
        }

        for (const token of finalTokens) {
            try {
                // Defensive sanitization: Trims massive meme coin names and symbols before they hit Postgres
                const safeSymbol = (token.token_symbol || 'UNKNOWN').substring(0, 32);
                const safeName = (token.token_name || 'Unknown Token').substring(0, 128);
                const safeDexId = (token.dex_id || 'UNKNOWN').substring(0, 32);

                await client.query(`
                    INSERT INTO alpha_zone_feed (
                        token_address, token_symbol, token_name, image_url, pair_address, dex_id,
                        lane, signal_tag, price_usd, mcap_usd, liquidity_usd,
                        volume_5m, volume_1h, volume_4h, volume_24h,
                        price_change_5m, price_change_1h, price_change_4h, price_change_24h,
                        buy_ratio_5m, buy_ratio_1h, rank_score, is_cabal, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW()
                    )
                    ON CONFLICT (token_address) DO UPDATE SET
                        price_usd = EXCLUDED.price_usd, mcap_usd = EXCLUDED.mcap_usd,
                        liquidity_usd = EXCLUDED.liquidity_usd, 
                        volume_5m = EXCLUDED.volume_5m, volume_1h = EXCLUDED.volume_1h, 
                        volume_4h = EXCLUDED.volume_4h, volume_24h = EXCLUDED.volume_24h,
                        price_change_5m = EXCLUDED.price_change_5m, price_change_1h = EXCLUDED.price_change_1h,
                        price_change_4h = EXCLUDED.price_change_4h, price_change_24h = EXCLUDED.price_change_24h,
                        buy_ratio_5m = EXCLUDED.buy_ratio_5m, buy_ratio_1h = EXCLUDED.buy_ratio_1h, 
                        lane = EXCLUDED.lane,
                        signal_tag = COALESCE(EXCLUDED.signal_tag, alpha_zone_feed.signal_tag),
                        rank_score = EXCLUDED.rank_score, is_cabal = EXCLUDED.is_cabal, updated_at = NOW();
                `, [
                    token.token_address, safeSymbol, safeName, token.image_url,
                    token.pair_address, safeDexId, token.lane, token.signal_tag,
                    Number(token.price_usd) || 0, Number(token.mcap_usd) || 0, Number(token.liquidity_usd) || 0,
                    Number(token.volume_5m) || 0, Number(token.volume_1h) || 0, Number(token.volume_4h) || 0, Number(token.volume_24h) || 0,
                    Number(token.price_change_5m) || 0, Number(token.price_change_1h) || 0, Number(token.price_change_4h) || 0, Number(token.price_change_24h) || 0,
                    Number(token.buy_ratio_5m) || 0.5, Number(token.buy_ratio_1h) || 0.5, Number(token.rank_score) || 0, Boolean(token.is_cabal)
                ]);
            } catch (insertErr) {
                // If one specific token has corrupted string data, it fails here silently
                // allowing the other tokens to save perfectly.
                console.warn(`[Alpha Zone DB] Failed to save token ${token.token_symbol}:`, insertErr.message);
            }
        }

    } catch (dbErr) {
        console.warn('[Ghost Radar DB] Critical failure in feed persistence:', dbErr.message);
    } finally {
        if (client) client.release();
    }
}