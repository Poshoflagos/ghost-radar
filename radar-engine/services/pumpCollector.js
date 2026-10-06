// radar-engine/services/pumpCollector.js
// Step 1 of Ghost Matrix: records EVERY new Pump.fun launch with its exact birth time.
// Uses its own table (gm_tokens) so nothing existing is touched.
// Needs:  npm install ws
import WebSocket from 'ws';
import { pool } from '../db.js';

const WS_URL = 'wss://pumpportal.fun/api/data';
const FLUSH_MS = 5000;               // write to DB in batches, gentle on Neon
const STALE_MS = 60000;              // no message for 60s = dead socket, reconnect
const KEEP_HOURS = 25;               // keep a little over 24h, then delete
const MAX_BUFFER = 5000;             // safety cap if the DB is unreachable

let buffer = [];                     // tokens waiting to be saved
let ws = null;
let retry = 0;
let lastMsgAt = Date.now();
let savedTotal = 0;
let started = false;

async function ensureTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS gm_tokens (
            token_address TEXT PRIMARY KEY,
            symbol        TEXT,
            name          TEXT,
            source        TEXT NOT NULL DEFAULT 'pumpfun',
            born_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS gm_tokens_born_at_idx ON gm_tokens (born_at DESC)`);
}

async function flush() {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    try {
        const r = await pool.query(
            `INSERT INTO gm_tokens (token_address, symbol, name, born_at)
             SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::timestamptz[])
             ON CONFLICT (token_address) DO NOTHING`,
            [batch.map((t) => t.mint), batch.map((t) => t.symbol), batch.map((t) => t.name), batch.map((t) => t.born)]
        );
        savedTotal += r.rowCount || 0;
    } catch (err) {
        console.error('[PumpCollector] DB write failed, will retry:', err.message);
        buffer = batch.concat(buffer).slice(-MAX_BUFFER); // put them back, drop oldest if too many
    }
}

async function cleanup() {
    try {
        const r = await pool.query(`DELETE FROM gm_tokens WHERE born_at < NOW() - ($1 || ' hours')::interval`, [String(KEEP_HOURS)]);
        if (r.rowCount) console.log(`[PumpCollector] cleaned ${r.rowCount} old tokens`);
    } catch (err) {
        console.error('[PumpCollector] cleanup failed:', err.message);
    }
}

function connect() {
    // ONE connection only. Never open a second one.
    ws = new WebSocket(WS_URL);

    ws.on('open', () => {
        retry = 0;
        lastMsgAt = Date.now();
        ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
        console.log('[PumpCollector] connected, listening for new launches');
    });

    ws.on('message', (raw) => {
        lastMsgAt = Date.now();
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        const mint = msg?.mint;
        // ignore the "subscribed" confirmation and anything that isn't a launch
        if (typeof mint !== 'string' || mint.length < 32 || mint.length > 44) return;
        if (buffer.length >= MAX_BUFFER) buffer.shift();
        buffer.push({
            mint,
            symbol: String(msg.symbol || '').slice(0, 32),
            name: String(msg.name || '').slice(0, 64),
            born: new Date().toISOString(), // our receive time = accurate to ~1 second
        });
    });

    ws.on('close', () => scheduleReconnect('closed'));
    ws.on('error', (err) => {
        console.error('[PumpCollector] socket error:', err.message);
        try { ws.terminate(); } catch {}
    });
}

function scheduleReconnect(why) {
    const wait = Math.min(30000, 1000 * 2 ** retry++); // 1s, 2s, 4s ... max 30s
    console.log(`[PumpCollector] ${why}, reconnecting in ${wait / 1000}s`);
    setTimeout(connect, wait);
}

export async function startPumpCollector() {
    if (started) return; // safe against double-start (e.g. dev auto-reload)
    started = true;
    try {
        await ensureTable();
    } catch (err) {
        console.error('[PumpCollector] could not create table:', err.message);
        started = false;
        return;
    }
    connect();
    setInterval(flush, FLUSH_MS);
    setInterval(cleanup, 60 * 60 * 1000);
    cleanup();
    // watchdog: a socket that goes silent without closing never reconnects by itself
    setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN && Date.now() - lastMsgAt > STALE_MS) {
            console.log('[PumpCollector] socket went quiet, forcing reconnect');
            try { ws.terminate(); } catch {}
        }
    }, 15000);
    // heartbeat so you can see it is alive
    setInterval(() => console.log(`[PumpCollector] saved ${savedTotal} new tokens since start`), 60000);
}