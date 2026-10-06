import sharp from 'sharp';
import dns from 'node:dns/promises';
import net from 'node:net';
import { lensHub } from './lensHub.js';

const MIN_SCORE = 80;          // below this, a result is not shown
const GENESIS_MIN = 90;        // only strong matches can be "genesis"
const KEEP_DAYS = 14;          // auto-prune: indexed tokens older than this are deleted
const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_META_BYTES = 1024 * 1024;
const WORKERS = 6;
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,application/json,*/*;q=0.8'
};

// ---------------------------------------------------------------------------
// bit helpers
// ---------------------------------------------------------------------------
const POPCOUNT = new Uint8Array(256);
for (let i = 0; i < 256; i++) { let n = i, c = 0; while (n) { c += n & 1; n >>= 1; } POPCOUNT[i] = c; }

function hamming(a, b) {
    let d = 0;
    for (let i = 0; i < a.length; i++) d += POPCOUNT[a[i] ^ b[i]];
    return d;
}

function bitsToBuffer(bits) {
    const buf = Buffer.alloc(bits.length / 8);
    for (let i = 0; i < bits.length; i++) if (bits[i]) buf[i >> 3] |= 1 << (7 - (i & 7));
    return buf;
}

// ---------------------------------------------------------------------------
// safe downloads (blocks private/internal addresses, re-checks every redirect)
// ---------------------------------------------------------------------------
function isPrivateIp(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
               (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
    }
    const l = ip.toLowerCase();
    return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80');
}

async function assertPublicUrl(raw) {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol');
    const { address } = await dns.lookup(u.hostname);
    if (isPrivateIp(address)) throw new Error('private address');
}

async function safeGet(startUrl, maxBytes, timeoutMs = 5000) {
    let url = startUrl;
    for (let hop = 0; hop < 4; hop++) {
        await assertPublicUrl(url);
        const res = await fetch(url, { headers: HEADERS, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get('location');
            if (!loc) return null;
            url = new URL(loc, url).toString();
            continue;
        }
        if (!res.ok) return null;
        if (Number(res.headers.get('content-length') || 0) > maxBytes) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return buf.length > maxBytes ? null : buf;
    }
    return null;
}

function ipfsCandidates(rawUrl) {
    const url = rawUrl.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${rawUrl.slice(7)}` : rawUrl;
    const list = [url];
    const i = url.indexOf('/ipfs/');
    if (i !== -1) {
        const cid = url.slice(i + 6).split('?')[0];
        list.push(
            `https://cf-ipfs.com/ipfs/${cid}`,
            `https://ipfs.io/ipfs/${cid}`,
            `https://gateway.pinata.cloud/ipfs/${cid}`,
            `https://4everland.io/ipfs/${cid}`
        );
    }
    return [...new Set(list)];
}

async function fetchImageBuffer(rawUrl) {
    for (const u of ipfsCandidates(rawUrl)) {
        try {
            const buf = await safeGet(u, MAX_IMAGE_BYTES);
            if (buf && buf.length >= 100) return buf;
        } catch { /* try next */ }
    }
    return null;
}

// token metadata JSON (from PumpPortal "uri") -> image link
async function fetchMetadataImage(uri) {
    for (const u of ipfsCandidates(uri)) {
        try {
            const buf = await safeGet(u, MAX_META_BYTES);
            if (!buf) continue;
            const meta = JSON.parse(buf.toString('utf8'));
            const img = meta?.image || meta?.image_uri || meta?.imageUri;
            if (typeof img === 'string' && img.length > 5) return img;
        } catch { /* try next */ }
    }
    return null;
}

// ---------------------------------------------------------------------------
// signatures: dHash(256) + pHash(64) + color(48 bytes)
// ---------------------------------------------------------------------------
const DCT = Array.from({ length: 8 }, (_, u) =>
    Array.from({ length: 32 }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / 64)));

function pHashBits(g) { // g = 32x32 grayscale bytes
    const tmp = new Float64Array(32 * 8);
    for (let y = 0; y < 32; y++)
        for (let u = 0; u < 8; u++) {
            let s = 0;
            for (let x = 0; x < 32; x++) s += g[y * 32 + x] * DCT[u][x];
            tmp[y * 8 + u] = s;
        }
    const coef = [];
    for (let v = 0; v < 8; v++)
        for (let u = 0; u < 8; u++) {
            let s = 0;
            for (let y = 0; y < 32; y++) s += tmp[y * 8 + u] * DCT[v][y];
            coef.push(s);
        }
    const sorted = coef.slice(1).sort((a, b) => a - b);
    const median = sorted[31];
    return coef.map((c, i) => (i === 0 ? 0 : c > median ? 1 : 0));
}

async function toBaseRaw(buf) {
    return sharp(buf, { failOn: 'none' })
        .flatten({ background: '#808080' })   // transparent PNGs behave the same everywhere
        .resize(256, 256, { fit: 'cover' })
        .removeAlpha()
        .toColourspace('srgb')
        .raw()
        .toBuffer();
}

async function signatureFromRaw(raw) {
    const src = () => sharp(raw, { raw: { width: 256, height: 256, channels: 3 } });

    const g1 = await src().resize(17, 16, { fit: 'fill' }).grayscale().raw().toBuffer();
    const dBits = [];
    for (let r = 0; r < 16; r++)
        for (let c = 0; c < 16; c++) dBits.push(g1[r * 17 + c] > g1[r * 17 + c + 1] ? 1 : 0);

    const g2 = await src().resize(32, 32, { fit: 'fill' }).grayscale().raw().toBuffer();
    const c3 = await src().resize(4, 4, { fit: 'fill' }).raw().toBuffer();

    return { d: bitsToBuffer(dBits), p: bitsToBuffer(pHashBits(g2)), c: Buffer.from(c3) };
}

async function computeSignature(buf) {
    return signatureFromRaw(await toBaseRaw(buf));
}

// full image + center crop (handles circle-masked / slightly cropped PFPs)
async function computeQuerySignatures(buf) {
    const raw = await toBaseRaw(buf);
    const full = await signatureFromRaw(raw);
    const cropRaw = await sharp(raw, { raw: { width: 256, height: 256, channels: 3 } })
        .extract({ left: 26, top: 26, width: 204, height: 204 })
        .resize(256, 256, { fit: 'fill' })
        .raw()
        .toBuffer();
    return [full, await signatureFromRaw(cropRaw)];
}

function scoreAgainst(q, e) {
    const dSim = 100 * (1 - hamming(q.d, e.d) / 256);
    const pSim = 100 * (1 - hamming(q.p, e.p) / 64);
    let diff = 0;
    for (let i = 0; i < 48; i++) diff += Math.abs(q.c[i] - e.c[i]);
    const cSim = Math.max(0, 100 * (1 - (diff / 48) / 100));
    return 0.45 * dSim + 0.35 * pSim + 0.20 * cSim;
}

// ---------------------------------------------------------------------------
// engine
// ---------------------------------------------------------------------------
export function createGhostLens({ pool, safeFetchJson, fetchPairsBatch }) {
    const index = new Map();          // address -> { meta, d, p, c }
    const queue = [];
    const queued = new Set();
    const failures = new Map();
    let active = 0;

    const addToIndex = (meta, sig) => index.set(meta.token_address, { meta, ...sig });

    async function processOne(t) {
        const addr = t.token_address;
        try {
            let imageUrl = t.image_url;
            if (!imageUrl && t.uri) imageUrl = await fetchMetadataImage(t.uri);
            if (!imageUrl) throw new Error('no image link');

            const buf = await fetchImageBuffer(imageUrl);
            if (!buf) throw new Error('download failed');
            const sig = await computeSignature(buf);
            const createdAt = t.created_at ? new Date(t.created_at) : null;
            await pool.query(`
                INSERT INTO lens_index (token_address, token_name, token_symbol, image_url, dex_id, created_at, d_hash, p_hash, c_sig)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                ON CONFLICT (token_address) DO NOTHING
            `, [addr, t.token_name || null, t.token_symbol || null, imageUrl, t.dex_id || null,
                createdAt, sig.d.toString('hex'), sig.p.toString('hex'), sig.c.toString('hex')]);
            addToIndex({
                token_address: addr, token_name: t.token_name, token_symbol: t.token_symbol,
                image_url: imageUrl, dex_id: t.dex_id, created_at: createdAt
            }, sig);
        } catch {
            if (failures.size > 20000) failures.clear();
            const n = (failures.get(addr) || 0) + 1;
            failures.set(addr, n);
            // IPFS is often slow right after a launch, so try again a bit later
            if (n < 3) setTimeout(() => enqueue(t), 15000 * n);
        }
    }

    function pump() {
        while (active < WORKERS && queue.length) {
            const t = queue.shift();
            active++;
            processOne(t).finally(() => { active--; queued.delete(t.token_address); pump(); });
        }
    }

    // accepts either a direct image_url or a metadata uri
    function enqueue(t) {
        const addr = t?.token_address;
        if (!addr || (!t.image_url && !t.uri)) return;
        if (index.has(addr) || queued.has(addr)) return;
        if ((failures.get(addr) || 0) >= 3) return;
        if (queue.length > 5000) return;
        queued.add(addr);
        queue.push(t);
        pump();
    }

    // AUTO-PRUNE: deletes tokens that were indexed more than KEEP_DAYS ago
    // (database + in-memory index). Age counts from when we indexed it.
    async function prune() {
        try {
            const { rows } = await pool.query(
                `DELETE FROM lens_index WHERE indexed_at < NOW() - ($1 || ' days')::interval RETURNING token_address`,
                [String(KEEP_DAYS)]
            );
            for (const r of rows) index.delete(r.token_address);
            if (rows.length) console.log(`[Ghost Lens] Pruned ${rows.length} tokens older than ${KEEP_DAYS} days. Index size ${index.size}.`);
        } catch (e) {
            console.warn('[Ghost Lens] prune failed:', e.message);
        }
    }

    async function init() {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS lens_index (
                token_address TEXT PRIMARY KEY,
                token_name TEXT, token_symbol TEXT, image_url TEXT, dex_id TEXT,
                created_at TIMESTAMPTZ,
                d_hash TEXT NOT NULL, p_hash TEXT NOT NULL, c_sig TEXT NOT NULL,
                indexed_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await prune(); // clean old rows BEFORE loading the index into memory

        const { rows } = await pool.query(`SELECT * FROM lens_index`);
        for (const r of rows) {
            addToIndex({
                token_address: r.token_address, token_name: r.token_name, token_symbol: r.token_symbol,
                image_url: r.image_url, dex_id: r.dex_id, created_at: r.created_at || r.indexed_at
            }, { d: Buffer.from(r.d_hash, 'hex'), p: Buffer.from(r.p_hash, 'hex'), c: Buffer.from(r.c_sig, 'hex') });
        }
        console.log(`[Ghost Lens] Loaded ${index.size} indexed token images (keeping ${KEEP_DAYS} days).`);

        setInterval(prune, PRUNE_EVERY_MS);

        // live feed: every new Pump.fun launch announced by pumpCollector.js
        lensHub.on('token', (t) => enqueue({
            token_address: t.mint,
            token_name: t.name,
            token_symbol: t.symbol,
            uri: t.uri,
            dex_id: 'pumpfun',
            created_at: t.born
        }));

        await harvest();
    }

    // Pulls token images from your own feed + a wide set of DexScreener searches
    async function harvest() {
        try {
            const { rows } = await pool.query(`
                SELECT token_address, token_name, token_symbol, image_url, dex_id, updated_at AS created_at
                FROM alpha_zone_feed WHERE image_url IS NOT NULL
                ORDER BY updated_at DESC LIMIT 3000
            `);
            rows.forEach(enqueue);
        } catch (e) { console.warn('[Ghost Lens] feed harvest failed:', e.message); }

        const terms = ['sol', 'pump', 'pumpswap', 'raydium', 'meteora', 'bonk', 'cat', 'dog', 'pepe', 'ai', 'trump', 'frog'];
        const results = await Promise.all(
            terms.map(q => safeFetchJson(`https://api.dexscreener.com/latest/dex/search?q=${q}`, 6000))
        );
        for (const r of results) {
            for (const p of (r?.pairs || [])) {
                if (p.chainId !== 'solana' || !p.baseToken?.address || !p.info?.imageUrl) continue;
                enqueue({
                    token_address: p.baseToken.address, token_name: p.baseToken.name,
                    token_symbol: p.baseToken.symbol, image_url: p.info.imageUrl,
                    dex_id: p.dexId, created_at: p.pairCreatedAt
                });
            }
        }
        const profiles = await safeFetchJson('https://api.dexscreener.com/token-profiles/latest/v1', 6000);
        for (const t of (Array.isArray(profiles) ? profiles : [])) {
            if (t.chainId === 'solana' && t.icon) enqueue({ token_address: t.tokenAddress, image_url: t.icon });
        }
        console.log(`[Ghost Lens] Index size ${index.size}, queue ${queue.length}`);
    }

    async function loadInput(input) {
        if (Buffer.isBuffer(input)) return input;
        if (typeof input !== 'string') throw new Error('Unsupported image input.');
        if (input.startsWith('data:image')) return Buffer.from(input.split(',')[1] || '', 'base64');
        if (/^https?:\/\//i.test(input) || input.startsWith('ipfs://')) {
            const b = await fetchImageBuffer(input);
            if (!b) throw new Error('Could not download that image URL.');
            return b;
        }
        throw new Error('Unsupported image input.');
    }

    async function scan(input) {
        const buf = await loadInput(input);
        let sigs;
        try { sigs = await computeQuerySignatures(buf); }
        catch { throw new Error('That file is not a readable image.'); }

        const hits = [];
        for (const e of index.values()) {
            let best = 0;
            for (const s of sigs) best = Math.max(best, scoreAgainst(s, e));
            if (best >= MIN_SCORE) hits.push({ e, sim: best });
        }
        hits.sort((a, b) => b.sim - a.sim);
        const top = hits.slice(0, 60);
        const queryHash = sigs[0].d.toString('hex').slice(0, 16);

        if (top.length === 0) {
            return { success: true, queryHash, totalScanned: index.size, totalMatches: 0, tokens: [] };
        }

        const addrs = top.map(h => h.e.meta.token_address);
        const [pairs, scoreRes] = await Promise.all([
            fetchPairsBatch(addrs),
            pool.query(`SELECT token_address, rank_score FROM alpha_zone_feed WHERE token_address = ANY($1)`, [addrs])
                .catch(() => ({ rows: [] }))
        ]);
        const rank = new Map(scoreRes.rows.map(r => [r.token_address, Number(r.rank_score) || 0]));

        const tokens = top.map(({ e, sim }) => {
            const pair = pairs.get(e.meta.token_address);
            const created = pair?.pairCreatedAt ? new Date(pair.pairCreatedAt) : (e.meta.created_at ? new Date(e.meta.created_at) : new Date());
            return {
                token_address: e.meta.token_address,
                token_name: e.meta.token_name || pair?.baseToken?.name || 'Unknown',
                token_symbol: e.meta.token_symbol || pair?.baseToken?.symbol || '???',
                image_url: e.meta.image_url,
                dex_id: (pair?.dexId || e.meta.dex_id || 'PUMP.FUN'),
                deployed_at: created.toISOString(),
                mcap_usd: Number(pair?.fdv || pair?.marketCap || 0),
                liquidity_usd: Number(pair?.liquidity?.usd || 0),
                volume_1h: Number(pair?.volume?.h1 || 0),
                ghost_score: rank.get(e.meta.token_address) || 0,
                deployer: 'Unknown',
                similarity: Math.round(sim * 10) / 10,
                tier: sim >= 97 ? 'EXACT' : sim >= 90 ? 'NEAR' : 'LOOSE'
            };
        });

        const strong = tokens.filter(t => t.similarity >= GENESIS_MIN);
        const pool_ = strong.length ? strong : tokens;
        const genesis = pool_.reduce((a, b) => (new Date(a.deployed_at) <= new Date(b.deployed_at) ? a : b));
        const t0 = new Date(genesis.deployed_at).getTime();

        const enriched = tokens
            .map(t => {
                const isG = t.token_address === genesis.token_address;
                const mins = Math.round((new Date(t.deployed_at).getTime() - t0) / 60000);
                return { ...t, is_genesis: isG, time_offset: isG ? 'GENESIS (0m)' : (mins >= 0 ? `+${mins}m later` : `${Math.abs(mins)}m earlier`) };
            })
            .sort((a, b) => new Date(a.deployed_at) - new Date(b.deployed_at));

        return { success: true, queryHash, totalScanned: index.size, totalMatches: enriched.length, tokens: enriched };
    }

    return { init, scan, enqueue, harvest, prune, size: () => index.size };
}