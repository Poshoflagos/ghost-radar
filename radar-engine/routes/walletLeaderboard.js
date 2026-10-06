// radar-engine/routes/walletLeaderboard.js
import express from 'express';
import { getCachedData, setCachedData } from '../utils/cache.js';

const router = express.Router();

// -----------------------------------------------------------------------------
// 1. SPECIFIC TOKEN CA LEADERBOARD
// -----------------------------------------------------------------------------
router.get('/token/:address', async (req, res) => {
    const { address } = req.params;

    if (!address || address.length < 32) {
        return res.status(400).json({ success: false, error: 'Invalid Token CA.' });
    }

    const cacheKey = `leaderboard_token_${address}`;
    const cached = getCachedData(cacheKey);
    if (cached) return res.json(cached);

    try {
        const apiKey = process.env.SOLANATRACKER_API_KEY;
        if (!apiKey) {
            console.warn("[Wallet Leaderboard] SOLANATRACKER_API_KEY missing in .env");
            return res.status(500).json({ success: false, error: 'API key configuration missing on server.' });
        }

        // Fetch top traders from SolanaTracker
        const response = await fetch(`https://api.solanatracker.io/tokens/${address}/top-traders`, {
            headers: {
                'x-api-key': apiKey,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(6000)
        });

        if (!response.ok) throw new Error('Failed to fetch from SolanaTracker');

        const data = await response.json();
        const rawTraders = Array.isArray(data) ? data : (data.traders || []);

        // Map to the EXACT format WalletLeaderboard.jsx expects
        const formattedWallets = rawTraders.slice(0, 20).map(t => {
            const pnl = Number(t.pnl || t.realized || 0);
            return {
                address: t.wallet || t.account || t.address,
                pnl_usd: pnl,
                trades: Number(t.total_trades || t.trades || 1),
                roi_pct: Number(t.roi || (pnl > 0 ? 150 : -50)) // Fallback if ROI isn't provided
            };
        });

        // Filter out tiny dust wallets to keep the UI clean
        const filteredWallets = formattedWallets.filter(w => Math.abs(w.pnl_usd) > 5);

        const payload = { success: true, count: filteredWallets.length, data: filteredWallets };
        setCachedData(cacheKey, payload, 60000); // 1-minute cache
        return res.json(payload);

    } catch (error) {
        console.error('[Wallet Leaderboard] Token Fetch Error:', error.message);
        return res.status(500).json({ success: false, error: 'Wallet data is unavailable right now.' });
    }
});

// -----------------------------------------------------------------------------
// 2. GLOBAL 24H TOP GAINERS AGGREGATOR (The "Top" Feed)
// -----------------------------------------------------------------------------
router.get('/top', async (req, res) => {
    const cacheKey = `leaderboard_global_top`;
    const cached = getCachedData(cacheKey);
    if (cached) return res.json(cached);

    try {
        const apiKey = process.env.SOLANATRACKER_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, error: 'API key configuration missing.' });
        }

        // 1. Fetch Trending/Top Tokens first to get the battleground
        const trendRes = await fetch(`https://api.solanatracker.io/tokens/trending/24h`, {
            headers: { 'x-api-key': apiKey, 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
        });
        
        if (!trendRes.ok) throw new Error('Trending fetch failed');
        
        const trendData = await trendRes.json();
        const tokens = Array.isArray(trendData) ? trendData.slice(0, 3) : []; // Just grab top 3 to prevent API timeout
        
        if (tokens.length === 0) {
            return res.json({ success: true, warning: true, data: [] });
        }

        let allTraders = [];

        // 2. Fetch traders for those top tokens
        for (const t of tokens) {
            const tokenAddr = t.address || t.mint;
            if (!tokenAddr) continue;

            try {
                const traderRes = await fetch(`https://api.solanatracker.io/tokens/${tokenAddr}/top-traders`, {
                    headers: { 'x-api-key': apiKey, 'Accept': 'application/json' },
                    signal: AbortSignal.timeout(3000)
                });
                if (traderRes.ok) {
                    const traderData = await traderRes.json();
                    const rawList = Array.isArray(traderData) ? traderData : (traderData.traders || []);
                    allTraders.push(...rawList);
                }
            } catch (e) {
                // Silently skip if one token fails
            }
        }

        // 3. Deduplicate, aggregate, and map to UI format
        const walletMap = new Map();
        for (const t of allTraders) {
            const addr = t.wallet || t.account || t.address;
            const pnl = Number(t.pnl || t.realized || 0);
            const trades = Number(t.total_trades || t.trades || 1);
            
            if (walletMap.has(addr)) {
                const existing = walletMap.get(addr);
                existing.pnl_usd += pnl;
                existing.trades += trades;
            } else {
                walletMap.set(addr, {
                    address: addr,
                    pnl_usd: pnl,
                    trades: trades,
                    roi_pct: Number(t.roi || 0)
                });
            }
        }

        // Sort by massive profit and take top 20
        const sortedWallets = Array.from(walletMap.values())
            .filter(w => w.pnl_usd > 50) // Only show actual winners in global
            .sort((a, b) => b.pnl_usd - a.pnl_usd)
            .slice(0, 20);

        const payload = { 
            success: true, 
            data: sortedWallets,
            ranked_by: 'profit',
            tokens: tokens.map(t => t.address || t.mint)
        };

        setCachedData(cacheKey, payload, 180000); // 3-minute cache for global
        return res.json(payload);

    } catch (error) {
        console.error('[Wallet Leaderboard] Global Fetch Error:', error.message);
        // Fallback gracefully so the UI doesn't crash
        return res.status(500).json({ success: false, error: 'Global wallet data is unavailable right now.' });
    }
});

export default router;