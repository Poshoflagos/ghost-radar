// radar-engine/routes/ghostMatrix.js  (full replacement, v4)
// Rule: launched in the last 24h (any DEX), currently between 10K and 100K market cap.
// Source of new tokens: gm_tokens (filled live by pumpCollector.js).
// A background loop refreshes the list every ~15s on its own, whether or not anyone is watching.
import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// ---- Tweak these without touching the logic ----
const MAX_AGE_MS = 24 * 3600 * 1000;
const MIN_MCAP = 10000;
const MAX_MCAP = 100000;
const MIN_LIQ_USD = 1000;        // hides dead/rugged tokens (set 0 to disable)
const MIN_VOL_1H = 500;          // hides tokens nobody trades (set 0 to disable)
const CYCLE_MS = 15000;          // how often the list refreshes
const MAX_CALLS_PER_CYCLE = 15;  // DexScreener calls per cycle (15 x 30 tokens). Limit is 300/min, this uses ~60/min
const BATCH = 30;

const tracked = new Map();       // address -> latest known data for that token
let cursor = new Date(Date.now() - MAX_AGE_MS);
let latest = { success: true, count: 0, current_sol_price: null, updated_at: 0, stale: true, data: [], debug: {} };
let running = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function safeFetchJson(url) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (!res.ok) return null;
        return await res.json();
    } catch (err) {
        return null;
    }
}

// How often each token is re-checked (hot tokens often, dead ones rarely)
function intervalFor(t) {
    if (!t.seen) return 30000;       // brand new, waiting for DexScreener to list it
    if (t.mcap >= 5000) return 15000; // hot
    if (t.mcap >= 2500) return 60000; // warm
    return 300000;                    // cold
}

async function cycle() {
    if (running) return; // never overlap
    running = true;
    const now = Date.now();
    const debug = {
        tracked: 0, due: 0, checked: 0, calls: 0, failed_batches: 0,
        dropped_cold: 0, dropped_no_pairs: 0, hidden_low_liq: 0, hidden_low_vol: 0, in_zone: 0,
    };
    try {
        // 1) pick up newly collected launches (small overlap so late-flushed rows are never missed)
        const r = await pool.query(
            `SELECT token_address, symbol, name, born_at FROM gm_tokens
             WHERE born_at >= $1 ORDER BY born_at ASC LIMIT 20000`,
            [cursor]
        );
        for (const row of r.rows) {
            if (!tracked.has(row.token_address)) {
                tracked.set(row.token_address, {
                    address: row.token_address, symbol: row.symbol, name: row.name,
                    born: new Date(row.born_at).getTime(),
                    seen: false, mcap: 0, liq: 0, vol1h: 0, chg1h: 0, dex: '', image: null, checkedAt: 0,
                });
            }
        }
        if (r.rows.length) cursor = new Date(new Date(r.rows[r.rows.length - 1].born_at).getTime() - 15000);

        // 2) decide who is due for a check; drop tokens that are too old or clearly dead
        const due = [];
        for (const [addr, t] of tracked) {
            const age = now - t.born;
            if (age > MAX_AGE_MS) { tracked.delete(addr); continue; }
            if (!t.seen && t.checkedAt && age > 30 * 60000) { tracked.delete(addr); debug.dropped_no_pairs++; continue; }
            if (t.seen && t.mcap < 2500 && age > 2 * 3600000) { tracked.delete(addr); debug.dropped_cold++; continue; }
            const overdue = now - t.checkedAt - intervalFor(t);
            if (overdue >= 0) due.push([overdue, t]);
        }
        debug.tracked = tracked.size;
        debug.due = due.length;
        due.sort((a, b) => b[0] - a[0]); // most overdue first
        const todo = due.slice(0, MAX_CALLS_PER_CYCLE * BATCH).map((x) => x[1]);

        // 3) DexScreener: 30 per call, one after another
        for (let i = 0; i < todo.length; i += BATCH) {
            const chunk = todo.slice(i, i + BATCH);
            const data = await safeFetchJson(`https://api.dexscreener.com/latest/dex/tokens/${chunk.map((t) => t.address).join(',')}`);
            debug.calls++;
            if (!data) { debug.failed_batches++; await sleep(150); continue; } // stay overdue, retried next cycle
            const byToken = {};
            for (const p of data.pairs || []) {
                const a = p.baseToken?.address;
                if (a && p.chainId === 'solana') (byToken[a] = byToken[a] || []).push(p);
            }
            for (const t of chunk) {
                t.checkedAt = Date.now();
                debug.checked++;
                const pairs = byToken[t.address];
                if (!pairs) continue;
                const pair = [...pairs].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
                t.seen = true;
                t.mcap = Number(pair.marketCap || pair.fdv || 0);
                t.liq = pair.liquidity?.usd || 0;
                t.vol1h = pair.volume?.h1 || 0;
                t.chg1h = pair.priceChange?.h1 || 0;
                t.dex = (pair.dexId || 'unknown').toUpperCase();
                t.image = pair.info?.imageUrl || t.image;
                if (pair.baseToken?.symbol) t.symbol = pair.baseToken.symbol;
                if (pair.baseToken?.name) t.name = pair.baseToken.name;
            }
            await sleep(150);
        }

        // 4) build the visible list from what we know
        const out = [];
        for (const t of tracked.values()) {
            if (!t.seen) continue;
            if (t.mcap < MIN_MCAP || t.mcap > MAX_MCAP) continue;
            if (t.liq < MIN_LIQ_USD) { debug.hidden_low_liq++; continue; }
            if (t.vol1h < MIN_VOL_1H) { debug.hidden_low_vol++; continue; }
            debug.in_zone++;
            out.push({
                token_address: t.address,
                token_symbol: t.symbol || '???',
                token_name: t.name || 'Unknown',
                image_url: t.image,
                dex_id: t.dex,
                mcap_usd: t.mcap,
                liquidity_usd: t.liq,
                volume_1h: t.vol1h,
                price_change_1h: t.chg1h,
                band_pct: Math.round(((t.mcap - MIN_MCAP) / (MAX_MCAP - MIN_MCAP)) * 1000) / 10,
                age_min: Math.round((now - t.born) / 60000),
            });
        }
        out.sort((a, b) => b.volume_1h - a.volume_1h); // most actively traded first
        const data = out.slice(0, 100);
        latest = { success: true, count: data.length, current_sol_price: null, updated_at: Date.now(), stale: debug.failed_batches > 0, data, debug };
    } catch (err) {
        console.error('[Ghost Matrix] cycle failed:', err.message);
        debug.error = err.message;
        latest = { ...latest, stale: true, debug };
    } finally {
        running = false;
    }
}

// Background loop: the list keeps updating on its own
setTimeout(cycle, 3000);
setInterval(cycle, CYCLE_MS);

router.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=5');
    res.json(latest); // instant, from memory, same for 1 user or 100
});

export default router;