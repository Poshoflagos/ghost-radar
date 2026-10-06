// radar-engine/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Connection, PublicKey } from '@solana/web3.js';
import walletRoutes from './routes/wallet.js'; 
import ghostMatrixRoutes from './routes/ghostMatrix.js';
import walletLeaderboardRoutes from './routes/walletLeaderboard.js';
import { startPumpCollector } from './services/pumpCollector.js';
import { runContractSafetyCheck } from './scripts/contractSafety.js';
import { initDB, pool, pruneStaleAlphaZone } from './db.js'; 
import { startSolanaStream, incubationTokens } from './services/solanaStream.js'; 
import { score, defaultParams } from './score/ghostScore.js';
import { xray } from './score/ghostXray.js'; 
import { runAlphaZoneSweeper, memoryAlphaFeed } from './services/alphaZoneService.js'; 
import { getCachedData, setCachedData } from './utils/cache.js';
import { createGhostLens } from './services/ghostLens.js';

const safeFetchJson = async (url, timeoutMs = 3500) => {
    try {
        return await Promise.race([
            fetch(url, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 GhostRadar/1.0',
                    'Accept': 'application/json'
                }
            }).then(res => res.ok ? res.json() : null),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch Timeout')), timeoutMs))
        ]);
    } catch (err) {
        return null;
    }
};

const safeDbQuery = async (text, params = []) => {
    try {
        return await Promise.race([
            pool.query(text, params),
            new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 10000))
        ]);
    } catch (err) {
        console.warn(`[Ghost Radar DB Error]: ${err.message}`);
        return { rows: [] };
    }
};

// -----------------------------------------------------------------------------
// GHOST LENS ENGINE (see services/ghostLens.js)
// -----------------------------------------------------------------------------
const ghostLens = createGhostLens({ pool, safeFetchJson, fetchPairsBatch });

// -----------------------------------------------------------------------------
// REAL-TIME CABAL, CLUSTER & JITO BUNDLE FORENSICS ENGINE
// -----------------------------------------------------------------------------
const SYSTEM_EXCLUDED_ADDRESSES = new Set([
    '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', 'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX', 
    '39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg', '11111111111111111111111111111111',              
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1'  
]);

function analyzeCabalAndClusters(holdersRaw, rugMarkets = [], pairAddress = '') {
    if (!Array.isArray(holdersRaw) || holdersRaw.length === 0) {
        return {
            isCabal: false, threatLevel: 'CLEAN', top10SharePct: 0.0,
            controlledSupplyPct: 0.0, clusterCount: 0, equalSplitDetected: false,
            bundledSupplyPct: 0.0, insiderCount: 0, insiderSupplyPct: 0.0,
            flaggedReasons: ['No holder distribution data available'],
            verdict: 'Insufficient on-chain holder depth to perform graph parsing.'
        };
    }

    const poolExclusions = new Set(SYSTEM_EXCLUDED_ADDRESSES);
    if (pairAddress) poolExclusions.add(pairAddress);
    if (Array.isArray(rugMarkets)) {
        rugMarkets.forEach(m => { if (m.pubkey) poolExclusions.add(m.pubkey); });
    }

    const organicHolders = holdersRaw
        .filter(h => h.address && !poolExclusions.has(h.address) && !h.isContract)
        .map(h => ({ address: h.address, pct: Number(h.pct || 0), isInsider: Boolean(h.insider) }))
        .sort((a, b) => b.pct - a.pct);

    const top10SharePct = organicHolders.slice(0, 10).reduce((acc, h) => acc + h.pct, 0);

    let bundledSupplyPct = 0;
    let clusterWallets = new Set();
    const tolerance = 0.12; 

    for (let i = 0; i < organicHolders.length; i++) {
        const base = organicHolders[i];
        if (base.pct < 0.4) continue; 
        const matchingGroup = organicHolders.filter(h => Math.abs(h.pct - base.pct) / base.pct <= tolerance);
        if (matchingGroup.length >= 3) {
            const groupSum = matchingGroup.reduce((sum, h) => sum + h.pct, 0);
            if (groupSum >= 5.0 && groupSum > bundledSupplyPct) {
                bundledSupplyPct = groupSum;
                matchingGroup.forEach(h => clusterWallets.add(h.address));
            }
        }
    }

    const equalSplitDetected = clusterWallets.size >= 3 && bundledSupplyPct >= 6.0;
    const insiderHolders = organicHolders.filter(h => h.isInsider);
    const insiderCount = insiderHolders.length;
    const insiderSupplyPct = insiderHolders.reduce((acc, h) => acc + h.pct, 0);

    const allFlaggedWallets = new Set([...clusterWallets, ...insiderHolders.map(h => h.address)]);
    const controlledSupplyPct = organicHolders.filter(h => allFlaggedWallets.has(h.address)).reduce((acc, h) => acc + h.pct, 0);

    const flaggedReasons = [];
    if (top10SharePct > 20.0) flaggedReasons.push(`Top 10 hold ${top10SharePct.toFixed(1)}% (exceeds 20% institutional ceiling)`);
    if (equalSplitDetected) flaggedReasons.push(`Jito bundle detected: ${clusterWallets.size} synthetic equal-split wallets controlling ${bundledSupplyPct.toFixed(1)}%`);
    if (insiderSupplyPct > 8.0) flaggedReasons.push(`Verified insider network holds ${insiderSupplyPct.toFixed(1)}% across ${insiderCount} addresses`);

    const isCabal = top10SharePct > 20.0 || equalSplitDetected || insiderSupplyPct > 12.0;

    let threatLevel = 'CLEAN';
    let verdict = 'Organic holder dispersal confirmed. Zero synthetic clusters or Jito bundle footprints detected.';

    if (isCabal) {
        threatLevel = 'CRITICAL';
        verdict = `High Cabal Cluster Risk: Coordinated actors control ${Math.max(top10SharePct, controlledSupplyPct).toFixed(1)}% of circulating supply. Extreme exit-liquidity dump threat.`;
    } else if (top10SharePct > 14.0 || clusterWallets.size >= 2) {
        threatLevel = 'ELEVATED';
        verdict = `Moderate supply concentration (${top10SharePct.toFixed(1)}% in top 10). Monitor for coordinated distribution.`;
    }

    return {
        isCabal, threatLevel, top10SharePct: Number(top10SharePct.toFixed(1)),
        controlledSupplyPct: Number(controlledSupplyPct.toFixed(1)), clusterCount: clusterWallets.size,
        equalSplitDetected, bundledSupplyPct: Number(bundledSupplyPct.toFixed(1)),
        insiderCount, insiderSupplyPct: Number(insiderSupplyPct.toFixed(1)), flaggedReasons, verdict
    };
}

const app = express();

app.use(cors({
    origin: process.env.FRONTEND_URL || '*', 
    methods: ['GET', 'POST']
}));

app.use(express.json({ limit: '10mb' }));
app.use('/api/wallet', walletRoutes);
app.use('/api/ghost-matrix', ghostMatrixRoutes);
app.use('/api/wallet-leaderboard', walletLeaderboardRoutes);

app.get('/api/token/:address/safety', async (req, res) => {
    const { address } = req.params;
    if (address.length < 32 || address.length > 44) return res.status(400).json({ error: "Invalid Solana address length" });
    const safetyData = await runContractSafetyCheck(address);
    if (!safetyData) return res.status(500).json({ error: "Failed to analyze contract safety" });
    res.json(safetyData);
});

// -----------------------------------------------------------------------------
// V2 ADVANCED GHOST SCORE X-RAY TOOL
// -----------------------------------------------------------------------------
app.get('/api/ghost-score/:address', async (req, res) => {
    const { address } = req.params;

    if (address.length < 32 || address.length > 44) {
        return res.status(400).json({ success: false, error: "Invalid Solana address length" });
    }

    try {
        const [dexData, rugData] = await Promise.all([
            safeFetchJson(`https://api.dexscreener.com/latest/dex/tokens/${address}`),
            safeFetchJson(`https://api.rugcheck.xyz/v1/tokens/${address}/report`)
        ]);

        let price = 0, mcap = 0, liq = 0, symbol = 'UNKNOWN', name = 'Unknown Token', image = null;
        let pairDexId = '', pairCreatedAt = Date.now() - 3600000; 
        let pair = null;

        if (dexData && dexData.pairs && dexData.pairs.length > 0) {
            const validPairs = dexData.pairs.filter(p => p.quoteToken?.symbol === 'SOL' || p.chainId === 'solana');
            pair = validPairs.length > 0 
                ? validPairs.sort((a,b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0]
                : dexData.pairs.sort((a,b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

            price = Number(pair.priceUsd || 0);
            mcap = Number(pair.fdv || pair.marketCap || price * 1_000_000_000);
            liq = Number(pair.liquidity?.usd || mcap * 0.15);
            symbol = pair.baseToken?.symbol || 'UNKNOWN';
            name = pair.baseToken?.name || 'Unknown Token';
            image = pair.info?.imageUrl || null;
            pairDexId = pair.dexId || '';
            if (pair.pairCreatedAt) pairCreatedAt = pair.pairCreatedAt;
        }

        if (price === 0) {
            const jupData = await safeFetchJson(`https://api.jup.ag/price/v3?ids=${address}`);
            if (jupData && jupData[address] && jupData[address].usdPrice) {
                price = Number(jupData[address].usdPrice);
                mcap = price * 1_000_000_000;
                liq = mcap * 0.15;
            } else {
                return res.json({ success: false, error: "Token lacks liquidity on DexScreener & Jupiter." });
            }
        }

        let isMintRevoked = true, isFreezeRevoked = true, isLpLocked = true;
        let creatorAddress = null;
        if (rugData) {
            creatorAddress = rugData.creator || null;
            const risks = rugData.risks || [];
            isMintRevoked = !(rugData.mintAuthority ?? rugData.token?.mintAuthority ?? null);
            isFreezeRevoked = !(rugData.freezeAuthority ?? rugData.token?.freezeAuthority ?? null);
            isLpLocked = risks.some(r => r.name === 'Low Liquidity Locked' || r.name === 'Single LP Provider') === false;
        }

        const [drRes, smRes, velRes, retRes, extRes, slopeRes] = await Promise.all([
            creatorAddress 
                ? safeDbQuery('SELECT total_launches, rugs_detected FROM deployer_history WHERE deployer_address = $1', [creatorAddress]) 
                : Promise.resolve({ rows: [] }),
            safeDbQuery(`
                SELECT w.realized_pnl_sol, w.win_rate, EXTRACT(EPOCH FROM (NOW() - t.timestamp))/60 as minutes_ago 
                FROM wallet_trades t 
                JOIN tracked_wallets w ON t.wallet_address = w.address 
                WHERE t.token_address = $1 AND t.trade_type = 'BUY' AND w.realized_pnl_sol > 0
            `, [address]),
            safeDbQuery(`
                WITH recent_trades AS (
                    SELECT wallet_address, trade_type, capital_sol 
                    FROM wallet_trades 
                    WHERE token_address = $1 AND timestamp >= NOW() - INTERVAL '15 minutes'
                ), 
                wallet_stats AS (
                    SELECT wallet_address, COUNT(DISTINCT trade_type) as types_count 
                    FROM recent_trades 
                    GROUP BY wallet_address
                ) 
                SELECT 
                    COUNT(DISTINCT r.wallet_address) as unique_wallets, 
                    COALESCE(SUM(r.capital_sol), 0) as raw_volume, 
                    COALESCE(SUM(CASE WHEN w.types_count > 1 THEN r.capital_sol ELSE 0 END), 0) as wash_volume 
                FROM recent_trades r 
                JOIN wallet_stats w ON r.wallet_address = w.wallet_address;
            `, [address]),
            safeDbQuery(`
                WITH cohort AS (
                    SELECT DISTINCT wallet_address 
                    FROM wallet_trades 
                    WHERE token_address = $1 AND trade_type = 'BUY' 
                      AND timestamp BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() - INTERVAL '5 minutes'
                ), 
                recent_sellers AS (
                    SELECT DISTINCT wallet_address 
                    FROM wallet_trades 
                    WHERE token_address = $1 AND trade_type = 'SELL' 
                      AND timestamp >= NOW() - INTERVAL '5 minutes'
                ) 
                SELECT 
                    (SELECT COUNT(*) FROM cohort) as total_buyers, 
                    (SELECT COUNT(*) FROM cohort c LEFT JOIN recent_sellers s ON c.wallet_address = s.wallet_address WHERE s.wallet_address IS NULL) as retained_buyers
            `, [address]),
            safeDbQuery(`
                SELECT MAX(price_sol) as peak_price 
                FROM wallet_trades 
                WHERE token_address = $1 AND price_sol > 0
            `, [address]),
            safeDbQuery(`
                SELECT 
                    COUNT(DISTINCT CASE WHEN timestamp BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() - INTERVAL '5 minutes' THEN wallet_address END) as old_buyers, 
                    COUNT(DISTINCT CASE WHEN timestamp >= NOW() - INTERVAL '5 minutes' THEN wallet_address END) as recent_buyers 
                FROM wallet_trades 
                WHERE token_address = $1 AND trade_type = 'BUY'
            `, [address])
        ]);

        let deployerRaw = drRes.rows?.length > 0 ? drRes.rows[0] : null;

        let smartConfluence = 0, washRatio = 0.50, organicVelocity = 0.10, buyQuality = 0.50, entryExtension = 0.50, holderSlopeNet = 0.50, dbHadData = false;

        if (smRes.rows?.length > 0) {
            let scRaw = 0;
            for (const row of smRes.rows) scRaw += (Math.min(1.0, Math.max(0.1, row.realized_pnl_sol / 10)) * Math.exp(-Math.max(0, row.minutes_ago) / 60));
            smartConfluence = Math.min(1.0, scRaw / 5);
        }

        if (velRes.rows?.length > 0) {
            const rawVol = Number(velRes.rows[0].raw_volume || 0), washVol = Number(velRes.rows[0].wash_volume || 0), uniqueWallets = Number(velRes.rows[0].unique_wallets || 0);
            if (rawVol > 0) {
                dbHadData = true; washRatio = 1 - (Math.max(0, rawVol - washVol) / rawVol); organicVelocity = Math.min(1.0, uniqueWallets / 75); 
            }
        }

        if (retRes.rows?.length > 0) {
            const total = Number(retRes.rows[0].total_buyers || 0), retained = Number(retRes.rows[0].retained_buyers || 0);
            if (total >= 3) buyQuality = retained / total;
        }

        if (extRes.rows?.length > 0 && extRes.rows[0].peak_price) {
            const peakPrice = Number(extRes.rows[0].peak_price || 0);
            entryExtension = Math.max(0.1, Math.min(1.0, 1.0 - (peakPrice > 0 ? (price / (peakPrice * 200)) : 0.5)));
        }

        if (slopeRes.rows?.length > 0) {
            const oldB = Number(slopeRes.rows[0].old_buyers || 0), recentB = Number(slopeRes.rows[0].recent_buyers || 0);
            if (oldB === 0 && recentB > 0) holderSlopeNet = 1.0; 
            else if (oldB > 0) {
                const growth = (recentB - oldB) / oldB; 
                holderSlopeNet = Math.max(0.1, Math.min(1.0, 0.5 + (growth * 0.5)));
            }
        }

        let devEdge = 0.20;
        if (deployerRaw) {
            const launches = Number(deployerRaw.total_launches || 0), rugs = Number(deployerRaw.rugs_detected || 0);
            if (rugs === 0 && launches >= 2) devEdge = Math.min(1.0, launches / 5);
            else if (rugs > 0) devEdge = 0.0;
        }

        let dexBuys = 0, dexSells = 0, dexVol = 0, priceChangeH1 = 0, totalTxns = 0, buyRatioFinal = 0.5;
        if (!dbHadData) {
            dexBuys = Number(pair?.txns?.h1?.buys || 0);
            dexSells = Number(pair?.txns?.h1?.sells || 0);
            dexVol = Number(pair?.volume?.h1 || 0);
            priceChangeH1 = Number(pair?.priceChange?.h1 || 0);
            totalTxns = dexBuys + dexSells;
            buyRatioFinal = totalTxns > 0 ? dexBuys / totalTxns : 0.5;
            const avgTxnSize = totalTxns > 0 ? dexVol / totalTxns : 0;
            const volumeToLiqRatio = liq > 0 ? dexVol / liq : 0;

            if (totalTxns > 0) {
                const baseVelocity = Math.min(0.95, Math.log10(Math.max(10, totalTxns)) / 3.2);
                const botNoisePenalty = avgTxnSize < 15 ? 0.60 : 1.0; 
                organicVelocity = Math.max(0.10, baseVelocity * botNoisePenalty);
            } else { organicVelocity = 0.05; }

            buyQuality = Math.max(0.05, Math.min(0.95, buyRatioFinal));

            if (avgTxnSize > 1500) washRatio = 0.55; 
            else if (avgTxnSize < 20) washRatio = 0.50; 
            else washRatio = 0.20; 

            if (buyRatioFinal >= 0.60 && priceChangeH1 > 0) holderSlopeNet = Math.min(0.90, 0.50 + (priceChangeH1 / 200));
            else if (buyRatioFinal < 0.40 || priceChangeH1 < -15) holderSlopeNet = Math.max(0.10, 0.40 + (priceChangeH1 / 100));
            else holderSlopeNet = 0.50;

            smartConfluence = Math.min(1.0, (volumeToLiqRatio / 5.0) * 0.45);

            if (priceChangeH1 > 80) entryExtension = 0.15; 
            else if (priceChangeH1 > 35) entryExtension = 0.40; 
            else if (priceChangeH1 < -25) entryExtension = 0.85; 
            else entryExtension = 0.60; 
        }

        const cabalForensics = analyzeCabalAndClusters(
            rugData?.topHolders, 
            rugData?.markets, 
            pair?.pairAddress
        );

        let trackedWalletsCount = 0;
        let avgHistoricalWinRate = 0;
        if (smRes?.rows?.length > 0) {
            trackedWalletsCount = smRes.rows.length;
            const totalWinRate = smRes.rows.reduce((sum, row) => sum + Number(row.win_rate || 75.0), 0);
            avgHistoricalWinRate = (totalWinRate / trackedWalletsCount).toFixed(1);
        }

        const ageHours = (Date.now() - pairCreatedAt) / 3600000;
        const zombieDormancyDays = (ageHours / 24).toFixed(1);
        const uniqueWallets = Number(velRes?.rows?.[0]?.unique_wallets || 0);
        const historicalVol = Math.max(0, (Number(pair?.volume?.h24 || 0) - Number(pair?.volume?.h1 || 0)));
        
        const isZombieRevival = 
            ageHours >= 48 && 
            historicalVol < 2000 && 
            priceChangeH1 >= 400 && 
            buyRatioFinal >= 0.65 &&
            liq >= 5000 &&
            uniqueWallets > 5 &&
            isMintRevoked && isFreezeRevoked;

        const telemetrySignals = {
            isZombieRevival,
            zombieDormancyDays,
            cabalRisk: { isFlagged: cabalForensics.isCabal, top10ControlledPct: cabalForensics.top10SharePct },
            cabalForensics, 
            smartMoneyConvergence: { trackedWalletsCount, avgHistoricalWinRate }
        };

        const baseO = (organicVelocity * 0.40) + (smartConfluence * 0.30) + (buyQuality * 0.30);
        const isPumpAddress = address.toLowerCase().endsWith('pump');
        const dexId = (pairDexId || '').toLowerCase();
        const venue = (isPumpAddress && (dexId === 'pumpfun' || dexId === 'stockfun') && mcap <= 85000) ? 'curve' : 'amm';
        
        const holders = (rugData?.topHolders || []).map(h => ({
            addr: h.address, pct: (Number(h.pct) || 0) / 100, isPool: h.address === pair?.pairAddress, isInsider: Boolean(h.insider)
        }));
        
        const creatorPct = (rugData?.topHolders || []).find(h => h.address === creatorAddress)?.pct / 100 || 0;

        const snapshot = {
            ageMin: (Date.now() - pairCreatedAt) / 60000,
            venue, price, mcap, liqUsd: liq,
            pc: { m5: Number(pair?.priceChange?.m5 || 0), h1: priceChangeH1, h6: Number(pair?.priceChange?.h6 || 0), h24: Number(pair?.priceChange?.h24 || 0) },
            vol: { m5: Number(pair?.volume?.m5 || 0), h1: dexVol, h6: Number(pair?.volume?.h6 || 0) },
            tx: {
                m5: { b: Number(pair?.txns?.m5?.buys || 0), s: Number(pair?.txns?.m5?.sells || 0) },
                h1: { b: dexBuys, s: dexSells }
            },
            holders,
            creator: {
                pct: creatorPct,
                rugs: deployerRaw ? Number(deployerRaw.rugs_detected || 0) : 0,
                launches: deployerRaw ? Math.max(1, Number(deployerRaw.total_launches || 1)) : 1
            },
            authorities: { mintActive: !isMintRevoked, freezeActive: !isFreezeRevoked },
            lp: { unlockedPct: isLpLocked ? 0 : 1 },
            sellImpactPct: 0,
            telemetrySignals
        };

        const xrayResult = xray(snapshot, { O: baseO });
        
        let finalCompositeScore = xrayResult.entryScore || 0;
        if (cabalForensics.isCabal) finalCompositeScore = Math.max(0, Math.floor(finalCompositeScore * 0.5));
        if (isZombieRevival) finalCompositeScore = Math.min(100, finalCompositeScore + 50);

        let uiStatus = 'warning';
        if (['ENTER', 'ENTER_SMALL', 'PRIME'].includes(xrayResult.verdict.tag)) uiStatus = 'active';
        if (['AVOID', 'DANGER'].includes(xrayResult.verdict.tag) || cabalForensics.isCabal) uiStatus = 'danger';

        const uiContractHealth = xrayResult.gates.some(g => g.cat === 'STRUCTURAL') ? 'FLAGGED' : 'PASSED';

        return res.json({
            success: true,
            token: { address, symbol, name, mcap, liquidity: liq, price, image },
            scores: { 
                composite: finalCompositeScore, 
                safety: Math.floor(xrayResult.S * 100), 
                opportunity: Math.floor(xrayResult.O * 100), 
                velocity: Math.floor(organicVelocity * 100), 
                smartMoney: Math.floor(smartConfluence * 100), 
                contractHealth: uiContractHealth
            },
            gates: xrayResult.gates.map(g => ({ type: g.cat || 'FATAL', msg: g.msg })), 
            analysis: { 
                verdict: xrayResult.verdict.title, 
                entryRating: xrayResult.verdict.tag, 
                feedback: xrayResult.verdict.advice, 
                status: uiStatus,
                contractHealth: uiContractHealth 
            },
            telemetrySignals
        });

    } catch (error) {
        console.error('[Ghost X-Ray V2 Error]:', error.message);
        return res.status(500).json({ success: false, error: 'Analysis failed or timed out.' });
    }
});

// -----------------------------------------------------------------------------
// ALPHA ZONE API ENDPOINT WITH CACHE SHIELD
// -----------------------------------------------------------------------------
app.get('/api/alpha-zone', async (req, res) => {
    const { lane = 'ALL' } = req.query;
    const cacheKey = `alpha_zone_${lane}`;

    const cached = getCachedData(cacheKey);
    if (cached) return res.json(cached);

    try {
        let query = `SELECT * FROM alpha_zone_feed`;
        let params = [];
        
        if (lane !== 'ALL') {
            query += ` WHERE lane = $1`;
            params.push(lane.toUpperCase());
        }
        query += ` ORDER BY rank_score DESC, updated_at DESC LIMIT 400;`;
        
        const result = await safeDbQuery(query, params);
        
        if (result.rows && result.rows.length > 0) {
            const responsePayload = { success: true, count: result.rows.length, data: result.rows };
            setCachedData(cacheKey, responsePayload, 60000);
            return res.json(responsePayload);
        }

        let fallbackData = memoryAlphaFeed;
        if (lane !== 'ALL') fallbackData = fallbackData.filter(t => t.lane === lane.toUpperCase());
        
        const responsePayload = { success: true, count: fallbackData.length, data: fallbackData, source: 'memory_stream' };
        setCachedData(cacheKey, responsePayload, 60000);
        return res.json(responsePayload);

    } catch (err) {
        console.error('[Ghost Radar Alpha Zone] API Error:', err.message);
        res.status(500).json({ success: false, error: 'Failed to fetch Alpha Zone' });
    }
});

// -----------------------------------------------------------------------------
// BIRDEYE RAW OHLCV FETCHER
// -----------------------------------------------------------------------------
async function fetchRawOHLCV(tokenAddress) {
    try {
        const apiKey = process.env.BIRDEYE_API_KEY;
        if (!apiKey) return null;

        const timeTo = Math.floor(Date.now() / 1000);
        const timeFrom = timeTo - (24 * 3600); 
        
        const res = await fetch(`https://public-api.birdeye.so/defi/ohlcv?address=${tokenAddress}&type=15m&time_from=${timeFrom}&time_to=${timeTo}`, {
            headers: { 
                'X-API-KEY': apiKey,
                'Accept': 'application/json',
                'x-chain': 'solana'
            },
            signal: AbortSignal.timeout(3500)
        });
        const data = await res.json();
        
        if (data?.success && data?.data?.items) {
            return data.data.items; 
        }
        return null;
    } catch (e) {
        return null; 
    }
}

// -----------------------------------------------------------------------------
// ZOMBIE RADAR: WIDE CANDIDATE POOL + DEXSCREENER BATCH FILTER
// All the tuning numbers live in this one block. Change them here.
// -----------------------------------------------------------------------------
const ZOMBIE = {
    // Lazarus Rebound (token dumped hard, then bounced)
    REBOUND_MIN_DUMP_PCT: 30,    // must have fallen at least this much (testing value, final goal is 90)
    REBOUND_MIN_BOUNCE_PCT: 2,   // must have bounced at least this much off the bottom (final goal is 50)
    REBOUND_MIN_LIQ: 500,

    // CTO Graveyard (quiet token that suddenly wakes up)
    CTO_MIN_1H_PCT: 5,           // price must be up at least this much in the last hour
    CTO_MIN_BUYS_1H: 3,          // at least this many buys in the last hour
    CTO_MIN_LIQ: 1000,
    CTO_MAX_PRIOR_VOL_USD: 30000, // volume in the 23 hours before the last hour must be under this
    CTO_SURGE_MULTIPLE: 3,       // last hour volume must be this many times the earlier hourly average

    MIN_MCAP: 1000,
    MAX_CANDIDATES: 240,
    CACHE_MS: 45000,
    MAX_OHLCV_REFINES: 8
};

async function gatherZombieCandidates() {
    const found = new Map();

    const add = (address, extra = {}) => {
        if (!address || typeof address !== 'string') return;
        if (found.has(address) || found.size >= ZOMBIE.MAX_CANDIDATES) return;
        found.set(address, { token_address: address, ...extra });
    };

    const [dbRes, profiles, boostsLatest, boostsTop, s1, s2, s3, s4] = await Promise.all([
        safeDbQuery(`
            SELECT token_address, token_name, token_symbol, image_url, dex_id, rank_score
            FROM alpha_zone_feed
            ORDER BY updated_at DESC
            LIMIT 150;
        `),
        safeFetchJson('https://api.dexscreener.com/token-profiles/latest/v1', 5000),
        safeFetchJson('https://api.dexscreener.com/token-boosts/latest/v1', 5000),
        safeFetchJson('https://api.dexscreener.com/token-boosts/top/v1', 5000),
        safeFetchJson('https://api.dexscreener.com/latest/dex/search?q=sol', 5000),
        safeFetchJson('https://api.dexscreener.com/latest/dex/search?q=raydium', 5000),
        safeFetchJson('https://api.dexscreener.com/latest/dex/search?q=pumpswap', 5000),
        safeFetchJson('https://api.dexscreener.com/latest/dex/search?q=pump', 5000)
    ]);

    // 1) Your own database
    for (const r of (dbRes.rows || [])) {
        add(r.token_address, {
            token_name: r.token_name, token_symbol: r.token_symbol,
            image_url: r.image_url, dex_id: r.dex_id, rank_score: r.rank_score
        });
    }

    // 2) Your in-memory feed
    if (Array.isArray(memoryAlphaFeed)) {
        for (const r of memoryAlphaFeed.slice(0, 100)) {
            add(r.token_address, {
                token_name: r.token_name, token_symbol: r.token_symbol,
                image_url: r.image_url, dex_id: r.dex_id, rank_score: r.rank_score
            });
        }
    }

    // 3) DexScreener profile and boost lists
    for (const list of [profiles, boostsLatest, boostsTop]) {
        if (!Array.isArray(list)) continue;
        for (const t of list) {
            if (t.chainId === 'solana') add(t.tokenAddress, { image_url: t.icon || null });
        }
    }

    // 4) DexScreener searches
    for (const s of [s1, s2, s3, s4]) {
        if (!s || !Array.isArray(s.pairs)) continue;
        for (const p of s.pairs) {
            if (p.chainId === 'solana' && p.baseToken?.address) {
                add(p.baseToken.address, {
                    token_name: p.baseToken.name, token_symbol: p.baseToken.symbol,
                    image_url: p.info?.imageUrl || null, dex_id: p.dexId
                });
            }
        }
    }

    return [...found.values()];
}

function checkZombieMatch(mode, row, pair) {
    const mcap = Number(pair.fdv || pair.marketCap || 0);
    const liq = Number(pair.liquidity?.usd || 0);
    if (mcap < ZOMBIE.MIN_MCAP) return null;

    const buys1h = Number(pair.txns?.h1?.buys || 0);
    const sells1h = Number(pair.txns?.h1?.sells || 0);
    const totalTxns1h = buys1h + sells1h;
    const buyRatioPct = totalTxns1h > 0 ? Math.round((buys1h / totalTxns1h) * 100) : 0;

    const pc24 = Number(pair.priceChange?.h24 || 0);
    const pc1 = Number(pair.priceChange?.h1 || 0);
    const pc5 = Number(pair.priceChange?.m5 || 0);

    const vol1 = Number(pair.volume?.h1 || 0);
    const vol24 = Number(pair.volume?.h24 || 0);
    const priorVol = Math.max(0, vol24 - vol1);
    const avgPriorHourly = priorVol / 23;

    const ageMs = pair.pairCreatedAt ? Math.max(0, Date.now() - Number(pair.pairCreatedAt)) : 86400000;

    const base = {
        token_address: row.token_address,
        token_name: row.token_name || pair.baseToken?.name || 'Unknown',
        token_symbol: row.token_symbol || pair.baseToken?.symbol || 'SOL',
        image_url: row.image_url || pair.info?.imageUrl || null,
        dex_id: (pair.dexId || row.dex_id || 'UNKNOWN').toUpperCase(),
        mcap_usd: mcap,
        liquidity_usd: liq,
        buys_1h: buys1h,
        sells_1h: sells1h,
        buy_ratio_pct: buyRatioPct
    };

    if (mode === 'REBOUND') {
        // Estimate: the bottom was about (current price / bounce factor).
        // Dump is measured against the price 24 hours ago.
        const bounce = Math.max(pc1, pc5, 0);
        const factor24 = Math.max(0.0001, 1 + pc24 / 100);
        const dumpPct = (factor24 / (1 + bounce / 100) - 1) * 100;

        if (
            dumpPct <= -ZOMBIE.REBOUND_MIN_DUMP_PCT &&
            bounce >= ZOMBIE.REBOUND_MIN_BOUNCE_PCT &&
            buys1h >= 1 &&
            liq >= ZOMBIE.REBOUND_MIN_LIQ
        ) {
            return {
                ...base,
                mode: 'REBOUND',
                dump_24h_pct: Math.round(dumpPct <= -99 ? -99 : dumpPct),
                rebound_pct: Math.round(bounce),
                time_without_buy_ms: buys1h > 0 ? 0 : ageMs,
                rank_score: Number(row.rank_score) || 75
            };
        }
        return null;
    }

    // CTO mode
    const quietBefore = priorVol < ZOMBIE.CTO_MAX_PRIOR_VOL_USD;
    const surge = vol1 >= Math.max(avgPriorHourly * ZOMBIE.CTO_SURGE_MULTIPLE, 200);

    if (
        pc1 >= ZOMBIE.CTO_MIN_1H_PCT &&
        buys1h >= ZOMBIE.CTO_MIN_BUYS_1H &&
        liq >= ZOMBIE.CTO_MIN_LIQ &&
        quietBefore &&
        surge
    ) {
        return {
            ...base,
            mode: 'CTO',
            resurrection_pct: Math.round(pc1),
            time_without_buy_ms: Math.min(ageMs, 23 * 3600 * 1000),
            rank_score: Number(row.rank_score) || 80
        };
    }
    return null;
}

// Uses Birdeye candles (if you have a key) to double check the best matches
async function refineZombieWithOHLCV(mode, token) {
    const ohlcv = await fetchRawOHLCV(token.token_address);
    if (!ohlcv || ohlcv.length === 0) return token; // no extra data, keep the estimate

    let high24h = 0;
    let low24h = Infinity;
    for (const candle of ohlcv) {
        if (candle.h > high24h) high24h = candle.h;
        if (candle.l < low24h) low24h = candle.l;
    }
    const currentPrice = ohlcv[ohlcv.length - 1].c;

    if (mode === 'REBOUND') {
        if (high24h > 0 && low24h > 0 && low24h !== Infinity) {
            const dumpPct = ((low24h - high24h) / high24h) * 100;
            const reboundPct = ((currentPrice - low24h) / low24h) * 100;
            if (dumpPct > -ZOMBIE.REBOUND_MIN_DUMP_PCT || reboundPct < ZOMBIE.REBOUND_MIN_BOUNCE_PCT) {
                return null; // real candles say it does not qualify
            }
            return {
                ...token,
                dump_24h_pct: Math.round(dumpPct <= -99 ? -99 : dumpPct),
                rebound_pct: Math.round(reboundPct)
            };
        }
        return token;
    }

    // CTO: count quiet candles before the latest one
    let dormantCandles = 0;
    for (let i = ohlcv.length - 2; i >= 0; i--) {
        const candleVol = Number(ohlcv[i].vUSD ?? ohlcv[i].v ?? 0);
        if (candleVol < 20) dormantCandles++;
        else break;
    }
    return { ...token, time_without_buy_ms: dormantCandles * 15 * 60 * 1000 };
}

app.get('/api/zombie-radar', async (req, res) => {
    const mode = String(req.query.mode || 'CTO').toUpperCase() === 'REBOUND' ? 'REBOUND' : 'CTO';
    const cacheKey = `zombie_radar_${mode}`;

    const cached = getCachedData(cacheKey);
    if (cached) return res.json(cached);

    try {
        const candidates = await gatherZombieCandidates();
        if (candidates.length === 0) {
            return res.json({ success: true, count: 0, data: [] });
        }

        const pairs = await fetchPairsBatch(candidates.map(c => c.token_address));

        let matches = [];
        for (const row of candidates) {
            const pair = pairs.get(row.token_address);
            if (!pair) continue;
            const m = checkZombieMatch(mode, row, pair);
            if (m) matches.push(m);
        }

        matches.sort((a, b) => (b.buy_ratio_pct * b.buys_1h) - (a.buy_ratio_pct * a.buys_1h));

        // Double check the top matches with Birdeye candles (skipped if no key)
        if (process.env.BIRDEYE_API_KEY && matches.length > 0) {
            const refined = [];
            for (let i = 0; i < matches.length; i++) {
                if (i < ZOMBIE.MAX_OHLCV_REFINES) {
                    const r = await refineZombieWithOHLCV(mode, matches[i]);
                    if (r) refined.push(r);
                } else {
                    refined.push(matches[i]);
                }
            }
            matches = refined;
        }

        const payload = {
            success: true,
            count: matches.length,
            scanned: pairs.size,
            data: matches
        };

        if (pairs.size > 0) setCachedData(cacheKey, payload, ZOMBIE.CACHE_MS);
        console.log(`[Zombie Radar] mode=${mode} candidates=${candidates.length} priced=${pairs.size} matches=${matches.length}`);
        return res.json(payload);

    } catch (err) {
        console.error('[Zombie Radar API Error]:', err.message);
        return res.status(500).json({ success: false, error: 'Failed to fetch Zombie telemetry', data: [] });
    }
});

// -----------------------------------------------------------------------------
// GHOST LENS SEARCH API
// -----------------------------------------------------------------------------
app.post('/api/ghost-lens/scan', async (req, res) => {
    const { image } = req.body;
    if (!image) return res.status(400).json({ success: false, error: 'No image provided.' });
    try {
        return res.json(await ghostLens.scan(image));
    } catch (err) {
        console.error('[Ghost Lens] Scan error:', err.message);
        return res.status(400).json({ success: false, error: err.message });
    }
});

// -----------------------------------------------------------------------------
// REAL-TIME WALLET LEADERBOARD WITH CACHE SHIELD & ON-CHAIN WALLET FORENSICS
// -----------------------------------------------------------------------------
app.get('/api/leaderboard', async (req, res) => {
    const { timeframe = '48h', tier = 'ALL', token } = req.query;

    if (token) {
        try {
            const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
            console.log(`[Ghost Radar] Extracting wallets for Token CA: ${token}`);
            
            let tokenPubKey;
            try {
                tokenPubKey = new PublicKey(token);
            } catch (err) {
                return res.status(400).json({ success: false, error: 'Invalid Token CA format.' });
            }

            const signatures = await connection.getSignaturesForAddress(tokenPubKey, { limit: 100 });
            
            if (signatures.length === 0) {
                return res.json({ success: true, count: 0, data: [] });
            }

            const sigList = signatures.map(sig => sig.signature);
            const parsedTxs = await connection.getParsedTransactions(sigList, { maxSupportedTransactionVersion: 0 });

            const walletStats = {};

            parsedTxs.forEach(tx => {
                if (!tx || tx.meta?.err) return; 

                const signer = tx.transaction.message.accountKeys.find(key => key.signer);
                if (!signer) return;
                const walletAddress = signer.pubkey.toString();

                const preBalance = tx.meta.preBalances[0]; 
                const postBalance = tx.meta.postBalances[0];
                const solDifference = (postBalance - preBalance) / 1e9; 

                if (!walletStats[walletAddress]) {
                    walletStats[walletAddress] = {
                        address: walletAddress,
                        total_trades: 0,
                        realized_pnl_sol: 0,
                        winning_trades: 0
                    };
                }

                walletStats[walletAddress].total_trades += 1;
                walletStats[walletAddress].realized_pnl_sol += solDifference;

                if (solDifference > 0) {
                    walletStats[walletAddress].winning_trades += 1;
                }
            });

            const formattedWallets = Object.values(walletStats)
                .filter(w => w.total_trades > 1) 
                .map(w => {
                    const winRate = (w.winning_trades / w.total_trades) * 100;
                    
                    let currentTier = 'Trench';
                    if (w.realized_pnl_sol > 50) currentTier = 'Whale';
                    else if (w.realized_pnl_sol > 10) currentTier = 'Mid-Weight';

                    return {
                        address: w.address,
                        tier: currentTier,
                        total_trades: w.total_trades,
                        realized_pnl_sol: w.realized_pnl_sol,
                        win_rate: winRate,
                        roi_pct: (w.realized_pnl_sol > 0) ? (winRate * 1.5) : 0 
                    };
                })
                .sort((a, b) => b.realized_pnl_sol - a.realized_pnl_sol) 
                .slice(0, 20); 

            return res.json({ success: true, count: formattedWallets.length, data: formattedWallets });

        } catch (error) {
            console.error('[Ghost Radar] Error parsing token swaps:', error);
            return res.status(500).json({ success: false, error: 'Failed to process on-chain data' });
        }
    }

    const cacheKey = `leaderboard_${timeframe}_${tier}`;
    const cached = getCachedData(cacheKey);
    if (cached) return res.json(cached);

    const intervalStr = timeframe === '7d' ? '7 days' : '48 hours';
    try {
        const qParams = [];
        let tierFilter = '';
        if (tier !== 'ALL') {
            tierFilter = 'AND w.tier = $1';
            qParams.push(String(tier));
        }
        
        const query = `
            SELECT 
                w.address, w.label, w.tier, 
                COALESCE(recent.period_trades, w.total_trades, 0) AS total_trades, 
                COALESCE(recent.period_pnl, w.realized_pnl_sol, 0.00) AS realized_pnl_sol, 
                COALESCE(w.win_rate, 0.00) AS win_rate
            FROM tracked_wallets w
            LEFT JOIN (
                SELECT 
                    wallet_address, 
                    COUNT(id) AS period_trades, 
                    ROUND(SUM(CASE WHEN trade_type = 'SELL' THEN capital_sol ELSE -capital_sol END)::numeric, 4) AS period_pnl
                FROM wallet_trades 
                WHERE created_at >= NOW() - INTERVAL '${intervalStr}' OR (created_at IS NULL) 
                GROUP BY wallet_address
            ) recent ON w.address = recent.wallet_address
            WHERE 1=1 ${tierFilter} 
            ORDER BY realized_pnl_sol DESC, total_trades DESC 
            LIMIT 50;
        `;
        const result = await safeDbQuery(query, qParams);
        const responsePayload = { success: true, count: result.rows?.length || 0, data: result.rows || [] };
        
        setCachedData(cacheKey, responsePayload, 120000); 
        res.json(responsePayload);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// -----------------------------------------------------------------------------
// GEMBOX API WITH CACHE SHIELD
// -----------------------------------------------------------------------------
app.get('/api/gembox', async (req, res) => {
    const cacheKey = 'gembox_main';
    const cached = getCachedData(cacheKey);
    if (cached) return res.json(cached);

    try {
        const [picksResult, summaryResult, dailyResult] = await Promise.all([
            safeDbQuery(`
                SELECT id, token_address, token_symbol, picked_at,
                       entry_mcap, entry_price_usd, current_mcap, peak_mcap,
                       peak_roi_multiplier, current_roi_multiplier, max_drawdown_percent,
                       hit_2x, hit_5x, hit_10x,
                       score_composite, score_cabal, score_deployer, score_smart_money, score_velocity,
                       score_safety, score_opportunity, status
                FROM gembox_picks
                ORDER BY picked_at DESC
                LIMIT 5;
            `),
            safeDbQuery(`
                SELECT 'ROLLING_30D' AS period_type,
                       COUNT(*)::int AS total_picks,
                       (COUNT(*) FILTER (WHERE hit_2x))::int AS win_count_2x,
                       ROUND(100.0 * COUNT(*) FILTER (WHERE hit_2x) / NULLIF(COUNT(*), 0), 2) AS win_rate_2x,
                       ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY peak_roi_multiplier))::numeric, 2) AS p50_roi_multiplier,
                       ROUND((PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY peak_roi_multiplier))::numeric, 2) AS p90_roi_multiplier,
                       ROUND(AVG(max_drawdown_percent), 2) AS avg_max_drawdown
                FROM gembox_picks
                WHERE picked_at >= NOW() - INTERVAL '30 days';
            `),
            safeDbQuery(`
                SELECT period_type, period_start, period_end, total_picks,
                       win_count_2x, win_rate_2x, p50_roi_multiplier, p90_roi_multiplier,
                       avg_max_drawdown, is_winning_period
                FROM gembox_performance_ledger
                ORDER BY period_start DESC
                LIMIT 30;
            `)
        ]);

        const summary = summaryResult.rows?.[0];
        const daily = dailyResult.rows || [];
        const ledger = summary && Number(summary.total_picks) > 0 ? [summary, ...daily] : daily;

        const responsePayload = { success: true, picks: picksResult.rows || [], ledger };
        setCachedData(cacheKey, responsePayload, 60000);
        res.json(responsePayload);
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch GemBox data' });
    }
});

// -----------------------------------------------------------------------------
// GEMBOX V3: FIVE DAILY DROP SLOTS
// -----------------------------------------------------------------------------
const SOL_USD = Number(process.env.SOL_USD || 200); 
const MILESTONES = [3, 6, 10, 20, 40];             
const MAX_MONITOR_MIN = 45;
const PASSES_REQUIRED = 2;                          
const DROP_HOURS_UTC = [4, 8, 12, 16, 20];          
const DAILY_MAX = DROP_HOURS_UTC.length;
const POOL_TTL_MS = 6 * 60 * 60 * 1000;             
const POOL_MAX = 60;
const FRESH_CANDIDATES = 8;                         
const DROP_RETRY_MS = 5 * 60 * 1000;                
const MIN_LIQ_USD = 2000;
const DEFAULT_MIN_SCORE = 40;
const MAX_STAGE2_PER_CYCLE = 12;                    

const activeMonitors = new Map();
const qualifiedPool = new Map();
const rugCache = new Map();
let lastDropAttempt = 0;
let scannerBusy = false;
let minScoreCache = { value: DEFAULT_MIN_SCORE, at: 0 };

const getSlotsDue = () => DROP_HOURS_UTC.filter((h) => h <= new Date().getUTCHours()).length;

async function fetchPairsBatch(addresses) {
    const out = new Map();
    for (let i = 0; i < addresses.length; i += 30) {
        const chunk = addresses.slice(i, i + 30).join(',');
        const data = await safeFetchJson(`https://api.dexscreener.com/tokens/v1/solana/${chunk}`, 5000);
        if (!Array.isArray(data)) continue;
        for (const p of data) {
            const a = p.baseToken?.address;
            if (!a) continue;
            const prev = out.get(a);
            if (!prev || Number(p.liquidity?.usd || 0) > Number(prev.liquidity?.usd || 0)) out.set(a, p);
        }
    }
    return out;
}

async function getRugData(address) {
    const hit = rugCache.get(address);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.data;
    const data = await safeFetchJson(`https://api.rugcheck.xyz/v1/tokens/${address}/report`, 6000);
    if (data) {
        rugCache.set(address, { data, at: Date.now() });
        if (rugCache.size > 300) rugCache.delete(rugCache.keys().next().value);
    }
    return data;
}

async function getMinScore() {
    if (Date.now() - minScoreCache.at < 10 * 60 * 1000) return minScoreCache.value;
    let value = DEFAULT_MIN_SCORE;
    const r = await safeDbQuery(`
        SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE hit_2x) AS wins
        FROM gembox_picks
        WHERE picked_at >= NOW() - INTERVAL '14 days' AND picked_at < NOW() - INTERVAL '6 hours'
    `);
    const n = Number(r.rows?.[0]?.n || 0), wins = Number(r.rows?.[0]?.wins || 0);
    if (n >= 10) {
        const rate = wins / n;
        if (rate < 0.10) value = DEFAULT_MIN_SCORE + 8;
        else if (rate > 0.25) value = DEFAULT_MIN_SCORE - 4;
    }
    minScoreCache = { value, at: Date.now() };
    return value;
}

function logRejection(address, symbol, mcap, liq, reason) {
    return safeDbQuery(`
        INSERT INTO gembox_rejections (token_address, token_symbol, mcap, liquidity, reject_reason)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (token_address) DO UPDATE SET reject_reason = EXCLUDED.reject_reason, rejected_at = NOW()
    `, [address, symbol || 'UNKNOWN', mcap || 0, liq || 0, String(reason).slice(0, 60)]);
}

function retire(state, reason) {
    activeMonitors.delete(state.address);
    if (reason) logRejection(state.address, state.symbol, state.mcap, state.liq, reason);
}

function advance(state) {
    state.milestoneIdx += 1;
    if (state.milestoneIdx >= MILESTONES.length) retire(state, state.lastReason);
}

async function computeSignals(address, creatorAddress, pair) {
    const price = Number(pair.priceUsd || 0);
    const liq = Number(pair.liquidity?.usd || 0);
    const buys = Number(pair.txns?.h1?.buys || pair.txns?.m5?.buys || 0);
    const sells = Number(pair.txns?.h1?.sells || pair.txns?.m5?.sells || 0);
    const vol = Number(pair.volume?.h1 || pair.volume?.m5 || 0);
    const pc1h = Number(pair.priceChange?.h1 || 0);

    const [drRes, smRes, velRes, retRes, extRes, slopeRes] = await Promise.all([
        creatorAddress
            ? safeDbQuery('SELECT total_launches, rugs_detected FROM deployer_history WHERE deployer_address = $1', [creatorAddress])
            : Promise.resolve({ rows: [] }),
        safeDbQuery(`
            SELECT w.realized_pnl_sol, w.win_rate, EXTRACT(EPOCH FROM (NOW() - t.timestamp))/60 AS minutes_ago
            FROM wallet_trades t JOIN tracked_wallets w ON t.wallet_address = w.address
            WHERE t.token_address = $1 AND t.trade_type = 'BUY' AND w.realized_pnl_sol > 0
        `, [address]),
        safeDbQuery(`
            WITH recent_trades AS (
                SELECT wallet_address, trade_type, capital_sol FROM wallet_trades
                WHERE token_address = $1 AND timestamp >= NOW() - INTERVAL '15 minutes'
            ), wallet_stats AS (
                SELECT wallet_address, COUNT(DISTINCT trade_type) AS types_count FROM recent_trades GROUP BY wallet_address
            )
            SELECT COUNT(DISTINCT r.wallet_address) AS unique_wallets,
                   COALESCE(SUM(r.capital_sol), 0) AS raw_volume,
                   COALESCE(SUM(CASE WHEN w.types_count > 1 THEN r.capital_sol ELSE 0 END), 0) AS wash_volume
            FROM recent_trades r JOIN wallet_stats w ON r.wallet_address = w.wallet_address
        `, [address]),
        safeDbQuery(`
            WITH cohort AS (
                SELECT DISTINCT wallet_address FROM wallet_trades
                WHERE token_address = $1 AND trade_type = 'BUY'
                  AND timestamp BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() - INTERVAL '5 minutes'
            ), recent_sellers AS (
                SELECT DISTINCT wallet_address FROM wallet_trades
                WHERE token_address = $1 AND trade_type = 'SELL' AND timestamp >= NOW() - INTERVAL '5 minutes'
            )
            SELECT (SELECT COUNT(*) FROM cohort) AS total_buyers,
                   (SELECT COUNT(*) FROM cohort c LEFT JOIN recent_sellers s ON c.wallet_address = s.wallet_address
                    WHERE s.wallet_address IS NULL) AS retained_buyers
        `, [address]),
        safeDbQuery(`SELECT MAX(price_sol) AS peak_price FROM wallet_trades WHERE token_address = $1 AND price_sol > 0`, [address]),
        safeDbQuery(`
            SELECT COUNT(DISTINCT CASE WHEN timestamp BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() - INTERVAL '5 minutes' THEN wallet_address END) AS old_buyers,
                   COUNT(DISTINCT CASE WHEN timestamp >= NOW() - INTERVAL '5 minutes' THEN wallet_address END) AS recent_buyers
            FROM wallet_trades WHERE token_address = $1 AND trade_type = 'BUY'
        `, [address])
    ]);

    let smartConfluence = 0, washRatio = 0.50, organicVelocity = 0.10, buyQuality = 0.50;
    let entryExtension = 0.50, holderSlopeNet = 0.50, devEdge = 0.20, dbHadData = false;

    if (smRes.rows?.length > 0) {
        let raw = 0;
        for (const row of smRes.rows) {
            raw += Math.min(1, Math.max(0.1, row.realized_pnl_sol / 10)) * Math.exp(-Math.max(0, row.minutes_ago) / 60);
        }
        smartConfluence = Math.min(1, raw / 5);
    }
    if (velRes.rows?.length > 0) {
        const rawVol = Number(velRes.rows[0].raw_volume || 0);
        const washVol = Number(velRes.rows[0].wash_volume || 0);
        const uniq = Number(velRes.rows[0].unique_wallets || 0);
        if (rawVol > 0) {
            dbHadData = true;
            washRatio = 1 - (Math.max(0, rawVol - washVol) / rawVol);
            organicVelocity = Math.min(1, uniq / 75);
        }
    }
    if (retRes.rows?.length > 0) {
        const total = Number(retRes.rows[0].total_buyers || 0), kept = Number(retRes.rows[0].retained_buyers || 0);
        if (total >= 3) buyQuality = kept / total;
    }
    if (extRes.rows?.[0]?.peak_price) {
        const peak = Number(extRes.rows[0].peak_price);
        entryExtension = Math.max(0.1, Math.min(1, 1 - (peak > 0 ? price / (peak * SOL_USD) : 0.5)));
    }
    if (slopeRes.rows?.length > 0) {
        const oldB = Number(slopeRes.rows[0].old_buyers || 0), newB = Number(slopeRes.rows[0].recent_buyers || 0);
        if (oldB === 0 && newB > 0) holderSlopeNet = 1;
        else if (oldB > 0) holderSlopeNet = Math.max(0.1, Math.min(1, 0.5 + ((newB - oldB) / oldB) * 0.5));
    }
    const deployer = drRes.rows?.[0] || null;
    if (deployer) {
        const launches = Number(deployer.total_launches || 0), rugs = Number(deployer.rugs_detected || 0);
        if (rugs === 0 && launches >= 2) devEdge = Math.min(1, launches / 5);
        else if (rugs > 0) devEdge = 0;
    }

    if (!dbHadData) {
        const total = buys + sells;
        const buyRatio = total > 0 ? buys / total : 0.5;
        const avgTxn = total > 0 ? vol / total : 0;
        const volToLiq = liq > 0 ? vol / liq : 0;
        organicVelocity = total > 0
            ? Math.max(0.10, Math.min(0.95, Math.log10(Math.max(10, total)) / 3.2) * (avgTxn < 15 ? 0.60 : 1))
            : 0.05;
        buyQuality = Math.max(0.05, Math.min(0.95, buyRatio));
        washRatio = avgTxn > 1500 ? 0.55 : avgTxn < 20 ? 0.50 : 0.20;
        if (buyRatio >= 0.60 && pc1h > 0) holderSlopeNet = Math.min(0.90, 0.50 + pc1h / 200);
        else if (buyRatio < 0.40 || pc1h < -15) holderSlopeNet = Math.max(0.10, 0.40 + pc1h / 100);
        else holderSlopeNet = 0.50;
        smartConfluence = Math.min(1, (volToLiq / 5) * 0.45);
        entryExtension = pc1h > 80 ? 0.15 : pc1h > 35 ? 0.40 : pc1h < -25 ? 0.85 : 0.60;
    }

    return { smartConfluence, washRatio, organicVelocity, buyQuality, entryExtension, holderSlopeNet, devEdge, deployer };
}

function buildFeatures(address, pair, rugData, sig) {
    const mcap = Number(pair.fdv || pair.marketCap || 0);
    const liq = Number(pair.liquidity?.usd || 0);
    const dexId = (pair.dexId || '').toLowerCase();

    const mintAuth = rugData.mintAuthority ?? rugData.token?.mintAuthority ?? null;
    const freezeAuth = rugData.freezeAuthority ?? rugData.token?.freezeAuthority ?? null;

    const cabal = analyzeCabalAndClusters(rugData.topHolders, rugData.markets, pair.pairAddress);

    const isPumpAddress = address.toLowerCase().endsWith('pump');
    const isGraduated = dexId !== 'pumpfun' && (mcap > 80_000 || !isPumpAddress);
    const isPumpCurve = isPumpAddress && dexId === 'pumpfun' && mcap <= 80_000;

    const exitQualityRisk = liq < 5000 ? 0.70 : liq < 10000 ? 0.45 : liq < 20000 ? 0.25 : 0.10;

    const f = {
        isGraduated, isPumpCurve, sellSimulationFailed: false,
        mintActive: Boolean(mintAuth), freezeActive: Boolean(freezeAuth),
        lpUnlocked: false, 
        devClusterLaunches: sig.deployer ? Math.max(1, Number(sig.deployer.total_launches) || 1) : 1,
        devClusterRugs: sig.deployer ? Number(sig.deployer.rugs_detected || 0) : 0,
        mcap, realLiqToMcap: mcap > 0 ? liq / mcap : 0,
        smartConfluence: sig.smartConfluence, washRatio: sig.washRatio, organicVelocity: sig.organicVelocity,
        buyQuality: sig.buyQuality, entryExtension: sig.entryExtension, devEdge: sig.devEdge,
        holderSlopeNet: sig.holderSlopeNet,
        topClusterPct: cabal.top10SharePct / 100,
        bundledSupplyPct: cabal.bundledSupplyPct / 100,
        exitQualityRisk,
        isCabal: cabal.equalSplitDetected || cabal.insiderSupplyPct > 12,
        confidenceFlags: []
    };
    return { f, cabal };
}

async function evaluateToken(address, pair) {
    const rugData = await getRugData(address);
    if (!rugData) return { error: 'NO_RUGCHECK_DATA' }; 
    const sig = await computeSignals(address, rugData.creator || null, pair);
    const { f } = buildFeatures(address, pair, rugData, sig);
    return { result: score(f), sig };
}

function makePoolEntry(address, pair, result, sig) {
    return {
        address,
        symbol: pair.baseToken?.symbol || 'UNKNOWN',
        score: result.score,
        price: Number(pair.priceUsd || 0),
        qualifiedAt: Date.now(),
        version: result.version,
        scoreCabal: Math.round((1 - Math.max(result.r.conc, result.r.bundle)) * 100),
        scoreDeployer: Math.round(sig.devEdge * 100),
        scoreSmartMoney: Math.round(sig.smartConfluence * 100),
        scoreVelocity: Math.round(sig.organicVelocity * 100),
        scoreSafety: Math.round(result.S * 100),
        scoreOpportunity: Math.round(result.O * 100)
    };
}

async function runGemBoxAlphaScanner() {
    if (scannerBusy) return;
    scannerBusy = true;
    try {
        const todayRes = await safeDbQuery(`SELECT COUNT(*) AS count FROM gembox_picks WHERE picked_at::date = CURRENT_DATE`);
        const todayCount = parseInt(todayRes.rows?.[0]?.count || 0, 10);
        if (todayCount >= DAILY_MAX) {
            incubationTokens.length = 0;
            activeMonitors.clear();
            qualifiedPool.clear();
            return;
        }

        while (incubationTokens.length > 0) {
            const t = incubationTokens.shift();
            if (t?.address && !activeMonitors.has(t.address)) {
                activeMonitors.set(t.address, {
                    address: t.address, addedAt: t.addedAt || Date.now(),
                    milestoneIdx: 0, passes: 0, lastReason: null
                });
            }
        }

        const minScore = await getMinScore();
        const now = Date.now();
        const due = [];
        for (const state of activeMonitors.values()) {
            const ageMin = (now - state.addedAt) / 60000;
            if (ageMin > MAX_MONITOR_MIN) { retire(state, state.lastReason); continue; }
            if (ageMin >= MILESTONES[state.milestoneIdx]) due.push(state);
        }

        const batch = due.slice(0, 90);
        const pairs = batch.length ? await fetchPairsBatch(batch.map((s) => s.address)) : new Map();
        let stage2 = 0, evaluated = 0, best = 0;

        for (const state of batch) {
            const pair = pairs.get(state.address);
            if (!pair) { advance(state); continue; } 

            const mcap = Number(pair.fdv || pair.marketCap || 0);
            const liq = Number(pair.liquidity?.usd || 0);
            state.symbol = pair.baseToken?.symbol; state.mcap = mcap; state.liq = liq;

            if (mcap > defaultParams.mcapMax) { retire(state, null); continue; }
            const txns = Number(pair.txns?.h1?.buys || 0) + Number(pair.txns?.h1?.sells || 0);
            if (mcap < defaultParams.mcapMin || liq < MIN_LIQ_USD || txns < 10) { advance(state); continue; }

            if (stage2 >= MAX_STAGE2_PER_CYCLE) continue;
            stage2++;

            const ev = await evaluateToken(state.address, pair);
            if (ev.error) { state.lastReason = ev.error; advance(state); continue; }
            const { result, sig } = ev;
            evaluated++;
            best = Math.max(best, result.score);
            console.log(`[GemBox] ${state.symbol || state.address.slice(0, 6)} score=${result.score} ${result.gateFailed || 'OK'}`);

            if (result.hard) { retire(state, result.gateFailed); continue; }
            if (result.score < minScore) {
                state.lastReason = result.score === 0 ? result.gateFailed : `SCORE ${result.score} < ${minScore}`;
                advance(state);
                continue;
            }

            state.passes += 1;
            if (state.passes >= PASSES_REQUIRED) {
                activeMonitors.delete(state.address);
                qualifiedPool.set(state.address, makePoolEntry(state.address, pair, result, sig));
                if (qualifiedPool.size > POOL_MAX) {
                    const worst = [...qualifiedPool.values()].sort((a, b) => a.score - b.score)[0];
                    qualifiedPool.delete(worst.address);
                }
            } else {
                advance(state);
            }
        }

        console.log(`[GemBox] slots=${todayCount}/${getSlotsDue()} monitors=${activeMonitors.size} due=${due.length} evaluated=${evaluated} pool=${qualifiedPool.size} best=${best} minScore=${minScore}`);
        await dropBestPick(todayCount);
    } catch (error) {
        console.error('[GemBox] Scanner error:', error.message);
    } finally {
        scannerBusy = false;
    }
}

async function dropBestPick(todayCount) {
    const now = Date.now();
    for (const [addr, c] of qualifiedPool) if (now - c.qualifiedAt > POOL_TTL_MS) qualifiedPool.delete(addr);

    if (todayCount >= getSlotsDue() || qualifiedPool.size === 0) return;
    if (now - lastDropAttempt < DROP_RETRY_MS) return;
    lastDropAttempt = now;

    const minScore = await getMinScore();
    const shortlist = [...qualifiedPool.values()].sort((a, b) => b.score - a.score).slice(0, FRESH_CANDIDATES);
    const fresh = await fetchPairsBatch(shortlist.map((c) => c.address));
    if (fresh.size === 0) return; 

    const finalists = [];
    for (const c of shortlist) {
        const pair = fresh.get(c.address);
        const mcap = Number(pair?.fdv || pair?.marketCap || 0);
        const liq = Number(pair?.liquidity?.usd || 0);
        const price = Number(pair?.priceUsd || 0);

        const unfit = !pair || !price
            || mcap < defaultParams.mcapMin || mcap > defaultParams.mcapMax
            || liq < MIN_LIQ_USD
            || price < c.price * 0.75 || price > c.price * 2.5; 
        if (unfit) { qualifiedPool.delete(c.address); continue; }

        const ev = await evaluateToken(c.address, pair);
        if (ev.error) continue;
        if (ev.result.hard) { qualifiedPool.delete(c.address); continue; }
        if (ev.result.score < minScore) continue; 

        finalists.push({ entry: makePoolEntry(c.address, pair, ev.result, ev.sig), pair, mcap, price });
    }

    finalists.sort((a, b) => b.entry.score - a.entry.score);

    for (const fin of finalists) {
        const c = fin.entry;
        const ins = await safeDbQuery(`
            INSERT INTO gembox_picks
            (token_address, token_symbol, entry_mcap, entry_price_usd, current_mcap, peak_mcap, lowest_mcap,
             score_composite, score_cabal, score_deployer, score_smart_money, score_velocity,
             score_safety, score_opportunity, status, params_version)
            VALUES ($1, $2, $3, $4, $3, $3, $3, $5, $6, $7, $8, $9, $10, $11, 'ACTIVE', $12)
            ON CONFLICT (token_address) DO NOTHING
            RETURNING id;
        `, [c.address, fin.pair.baseToken?.symbol || c.symbol, fin.mcap, fin.price, c.score,
            c.scoreCabal, c.scoreDeployer, c.scoreSmartMoney, c.scoreVelocity,
            c.scoreSafety, c.scoreOpportunity, c.version || 'v1.2.0']);

        qualifiedPool.delete(c.address);
        if (ins.rows?.length) {
            console.log(`[GemBox] DROP ${c.symbol} score=${c.score} mcap=${Math.round(fin.mcap)}`);
            return;
        }
    }
}

// -----------------------------------------------------------------------------
// PERFORMANCE LEDGER ROLLUP & TRACKERS
// -----------------------------------------------------------------------------
async function generateDailyLedger() {
    try {
        await safeDbQuery(`
            INSERT INTO gembox_performance_ledger (
                period_type, period_start, period_end, total_picks, win_count_2x, win_rate_2x,
                p50_roi_multiplier, p90_roi_multiplier, avg_max_drawdown, is_winning_period
            )
            SELECT 
                'DAILY', CURRENT_DATE - INTERVAL '1 day', CURRENT_DATE, COUNT(*), 
                COUNT(*) FILTER (WHERE hit_2x = TRUE), 
                ROUND((COUNT(*) FILTER (WHERE hit_2x = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) * 100, 2), 
                PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY peak_roi_multiplier), 
                PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY peak_roi_multiplier), 
                ROUND(AVG(max_drawdown_percent), 2), 
                (PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY peak_roi_multiplier) >= 1.50)
            FROM gembox_picks 
            WHERE picked_at >= CURRENT_DATE - INTERVAL '1 day' AND picked_at < CURRENT_DATE
            ON CONFLICT (period_type, period_start) DO UPDATE SET 
                total_picks = EXCLUDED.total_picks, win_rate_2x = EXCLUDED.win_rate_2x, 
                p50_roi_multiplier = EXCLUDED.p50_roi_multiplier, p90_roi_multiplier = EXCLUDED.p90_roi_multiplier;
        `);
    } catch(e) {}
}

const pickMisses = new Map();

async function updateGemboxActivePicks() {
    try {
        const active = await safeDbQuery(`
            SELECT id, token_address, entry_mcap, entry_price_usd, peak_mcap, lowest_mcap, picked_at
            FROM gembox_picks
            WHERE status = 'ACTIVE' AND picked_at >= NOW() - INTERVAL '7 days'
        `);
        if (!active.rows?.length) return;

        const pairs = await fetchPairsBatch(active.rows.map((r) => r.token_address));
        if (pairs.size === 0) return; 

        const markDead = (id) => safeDbQuery(
            `UPDATE gembox_picks SET status = 'DEAD', current_mcap = 0, current_roi_multiplier = 0, max_drawdown_percent = 100 WHERE id = $1`, [id]
        );

        for (const pick of active.rows) {
            const pair = pairs.get(pick.token_address);
            const ageMin = (Date.now() - new Date(pick.picked_at).getTime()) / 60000;

            if (!pair) {
                const n = (pickMisses.get(pick.id) || 0) + 1;
                pickMisses.set(pick.id, n);
                if (n >= 5 && ageMin > 60) await markDead(pick.id);
                continue;
            }
            pickMisses.delete(pick.id);

            const price = Number(pair.priceUsd || 0);
            const liq = Number(pair.liquidity?.usd || 0);
            const entryMcap = Number(pick.entry_mcap), entryPrice = Number(pick.entry_price_usd);
            if (!price || !entryPrice || !entryMcap) continue;

            if (liq < 300 && price < entryPrice * 0.05 && ageMin > 60) { await markDead(pick.id); continue; }

            const ratio = price / entryPrice;
            const currentMcap = entryMcap * ratio;
            const peakMcap = Math.max(Number(pick.peak_mcap || 0), currentMcap);
            const lowestMcap = Math.min(Number(pick.lowest_mcap || entryMcap), currentMcap);
            const currentRoi = Number(ratio.toFixed(2));
            const peakRoi = Number((peakMcap / entryMcap).toFixed(2));
            const maxDrawdown = Number((((entryMcap - lowestMcap) / entryMcap) * 100).toFixed(2));

            await safeDbQuery(`
                UPDATE gembox_picks SET current_mcap = $1, peak_mcap = $2, lowest_mcap = $3,
                    current_roi_multiplier = $4, peak_roi_multiplier = $5, max_drawdown_percent = $6,
                    hit_1_5x = $7, hit_2x = $8, hit_5x = $9, hit_10x = $10
                WHERE id = $11;
            `, [currentMcap, peakMcap, lowestMcap, currentRoi, peakRoi, maxDrawdown,
                peakRoi >= 1.5, peakRoi >= 2, peakRoi >= 5, peakRoi >= 10, pick.id]);
        }
    } catch (err) {
        console.warn('[GemBox] Tracker error:', err.message);
    }
}

async function pruneGemboxRejections() {
    await safeDbQuery(`DELETE FROM gembox_rejections WHERE rejected_at < NOW() - INTERVAL '14 days'`);
}

// -----------------------------------------------------------------------------
// BACKGROUND WORKER INTERVALS
// -----------------------------------------------------------------------------
setInterval(runGemBoxAlphaScanner, 60 * 1000); 
setInterval(runAlphaZoneSweeper, 60 * 1000);       
setInterval(pruneStaleAlphaZone, 15 * 60 * 1000);  
setInterval(generateDailyLedger, 60 * 60 * 1000);   
setInterval(updateGemboxActivePicks, 60000);        
setInterval(() => ghostLens.harvest(), 5 * 60 * 1000);
setInterval(pruneGemboxRejections, 6 * 60 * 60 * 1000);

const PORT = process.env.PORT || 3001;
async function bootstrap() {
    // Open the port FIRST so Northflank can always reach the server.
    app.listen(PORT, '0.0.0.0', () => console.log(`[Ghost Radar] Core Engine running on port ${PORT}`));

    // Slow setup steps run afterwards. A failure here will no longer stop the server.
    try {
        await initDB();
    } catch (err) {
        console.error('[Ghost Radar] initDB failed:', err.message);
    }

    try {
        await ghostLens.init();
    } catch (err) {
        console.error('[Ghost Radar] ghostLens init failed:', err.message);
    }

    try {
        startSolanaStream();
        startPumpCollector();
    } catch (err) {
        console.error('[Ghost Radar] Stream start failed:', err.message);
    }

    runGemBoxAlphaScanner();
    runAlphaZoneSweeper().catch((err) => console.error('[Ghost Radar] Alpha Zone first sweep failed:', err.message));
}
bootstrap();