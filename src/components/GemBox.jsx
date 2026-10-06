// src/components/GemBox.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { Target, TrendingUp, Zap, Activity, ExternalLink, X, Copy, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';

// Set VITE_API_URL in the frontend .env only when the backend leaves localhost.
const API_BASE = import.meta.env?.VITE_API_URL || 'http://localhost:3001';
const MAX_PICKS = 5;
const REFRESH_MS = 60000;
const DROP_HOURS_UTC = [4, 8, 12, 16, 20]; // keep in sync with DROP_HOURS_UTC in server.js

const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};
const hasVal = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const fmtMoney = (n) => {
    n = num(n);
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`;
    return `$${n.toFixed(0)}`;
};

// Next drop window in the viewer's local time
function nextDropWindow() {
    const now = new Date();
    const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
    for (const h of DROP_HOURS_UTC) {
        const t = new Date(Date.UTC(y, m, d, h));
        if (t > now) return t;
    }
    return new Date(Date.UTC(y, m, d + 1, DROP_HOURS_UTC[0]));
}

const normalizePayload = (json) => {
    const body = json?.data && !Array.isArray(json.data) ? json.data : json;
    const picks = Array.isArray(body) ? body : body?.picks ?? [];
    const ledger = body?.ledger ?? [];
    return {
        picks: Array.isArray(picks) ? picks : [],
        ledger: Array.isArray(ledger) ? ledger : ledger ? [ledger] : [],
    };
};

// Live market data: one batched DexScreener call per 30 tokens. Fails soft.
async function fetchLive(addresses, signal) {
    const out = {};
    for (let i = 0; i < addresses.length; i += 30) {
        const chunk = addresses.slice(i, i + 30).join(',');
        const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${chunk}`, { signal });
        if (!res.ok) continue;
        const pairs = await res.json();
        if (!Array.isArray(pairs)) continue;
        for (const p of pairs) {
            const addr = p.baseToken?.address;
            if (!addr) continue;
            const liquidity = num(p.liquidity?.usd);
            if (!out[addr] || liquidity > out[addr].liquidity) {
                out[addr] = {
                    price: num(p.priceUsd),
                    liquidity,
                    volume24h: num(p.volume?.h24),
                    image: p.info?.imageUrl || null,
                };
            }
        }
    }
    return out;
}

// Builds the board from the published picks. Nothing is hidden, losers stay visible.
function buildBoard(rawPicks, live) {
    const seen = new Set();
    const board = [];

    for (const p of rawPicks) {
        const addr = p?.token_address;
        if (!addr || seen.has(addr)) continue;
        seen.add(addr);

        const l = live[addr];
        const dead = p.status === 'DEAD';
        const entryMcap = num(p.entry_mcap);
        const entryPrice = num(p.entry_price_usd);
        const peak = num(p.peak_roi_multiplier);

        // ROI by price ratio, the same method the backend tracker uses
        let roi = num(p.current_roi_multiplier);
        if (!dead && l?.price && entryPrice) roi = l.price / entryPrice;
        const mcap = dead ? 0 : (entryMcap && roi ? entryMcap * roi : num(p.current_mcap));

        const flags = [];
        if (dead) {
            flags.push('Dead or rugged');
        } else {
            if (l && mcap && l.liquidity / mcap < 0.06) flags.push('Thin liquidity');
            if (l && l.liquidity && l.volume24h < l.liquidity * 0.5) flags.push('Low volume');
            if (roi > 4) flags.push('Extended run');
            if (peak > 0 && roi / peak < 0.5) flags.push('Off peak');
            if (roi < 0.5) flags.push('Breaking down');
        }

        board.push({ ...p, current_mcap: mcap, current_roi_multiplier: roi, _flags: flags, _live: l || null });
    }

    return board.sort((a, b) => num(b.score_composite) - num(a.score_composite)).slice(0, MAX_PICKS);
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch {
            return false;
        }
    }
}

const Gem = memo(function Gem({ pick, onSelect }) {
    const roi = Number(pick.current_roi_multiplier);
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect(pick)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(pick)}
            className="flex flex-col items-center gap-5 cursor-pointer group gem-container mt-4 outline-none focus-visible:ring-2 focus-visible:ring-gold-500/60 rounded-lg"
        >
            <div className="w-20 h-20 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-gold-400 via-gold-500 to-[#997A15] border-2 border-white/40 shadow-[0_0_40px_rgba(212,175,55,0.6)] group-hover:shadow-[0_0_60px_rgba(212,175,55,1)] transition-shadow duration-300 gem-3d flex items-center justify-center">
                    <div className="w-10 h-10 border border-white/20"></div>
                </div>
            </div>
            <div className="flex flex-col items-center text-center">
                <span className="text-sm font-bold text-offwhite uppercase tracking-widest group-hover:text-gold-500 transition-colors">{pick.token_symbol}</span>
                <span className={`text-[10px] font-mono font-bold mt-1 px-2 py-0.5 rounded border tabular-nums ${roi >= 1 ? 'bg-safe/10 text-safe border-safe/30' : 'bg-danger/10 text-danger border-danger/30'}`}>
                    {roi.toFixed(2)}x
                </span>
                <span className="text-[8px] font-bold text-muted uppercase tracking-widest mt-1.5">Score {pick.score_composite}</span>
            </div>
        </div>
    );
});

export default function GemBox() {
    const [raw, setRaw] = useState({ picks: [], ledger: [] });
    const [live, setLive] = useState({});
    const [status, setStatus] = useState('loading'); // loading | ready | error
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [selectedAddr, setSelectedAddr] = useState(null);
    const [copied, setCopied] = useState(false);
    const [logos, setLogos] = useState({});
    const abortRef = useRef(null);

    const load = useCallback(async (silent = false) => {
        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const timeout = setTimeout(() => ctrl.abort(), 12000);
        if (!silent) setStatus('loading');

        try {
            const res = await fetch(`${API_BASE}/api/gembox`, { signal: ctrl.signal });
            if (!res.ok) throw new Error(`Backend responded with status ${res.status}`);
            const json = await res.json();
            if (json?.success === false) throw new Error(json.error || 'Backend reported a failure');

            const payload = normalizePayload(json);
            setRaw(payload);
            setStatus('ready');
            setError(null);

            try {
                const addrs = payload.picks.map((p) => p?.token_address).filter(Boolean);
                if (addrs.length) setLive(await fetchLive(addrs, ctrl.signal));
            } catch { /* live data is optional */ }

            setLastUpdated(new Date());
        } catch (err) {
            if (abortRef.current !== ctrl) return;
            setError(err.name === 'AbortError' ? `Request to ${API_BASE} timed out` : err.message);
            if (!silent) setStatus('error');
        } finally {
            clearTimeout(timeout);
        }
    }, []);

    useEffect(() => {
        load();
        const id = setInterval(() => { if (!document.hidden) load(true); }, REFRESH_MS);
        return () => {
            clearInterval(id);
            abortRef.current?.abort();
            abortRef.current = null;
        };
    }, [load]);

    useEffect(() => {
        if (!selectedAddr) return;
        const onKey = (e) => e.key === 'Escape' && setSelectedAddr(null);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedAddr]);

    const picks = useMemo(() => buildBoard(raw.picks, live), [raw.picks, live]);
    const ledger = raw.ledger;
    const selectedPick = useMemo(() => picks.find((p) => p.token_address === selectedAddr) || null, [picks, selectedAddr]);
    const nextDrop = nextDropWindow();

    const displayPicks = useMemo(() => {
        const slots = [...picks];
        while (slots.length < MAX_PICKS) slots.push(null);
        return slots;
    }, [picks]);

    const fetchLogo = useCallback(async (address) => {
        if (logos[address] || live[address]?.image) return;
        try {
            const res = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${address}`);
            const data = await res.json();
            const t = Array.isArray(data) ? data[0] : data;
            const url = t?.icon || t?.logoURI;
            if (url) setLogos((prev) => ({ ...prev, [address]: url }));
        } catch { /* fall back to ticker initials */ }
    }, [logos, live]);

    const handleGemClick = useCallback((pick) => {
        setSelectedAddr(pick.token_address);
        fetchLogo(pick.token_address);
    }, [fetchLogo]);

    const handleCopyCA = async (e, address) => {
        e.stopPropagation();
        const ok = await copyText(address);
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const stat = (key, fmt) => {
        if (status === 'loading') return '--';
        const v = ledger[0]?.[key];
        return hasVal(v) ? fmt(Number(v)) : '--';
    };

    const logoFor = (p) => live[p.token_address]?.image || logos[p.token_address];

    return (
        <div className="w-full flex flex-col gap-6 font-sans text-muted relative">

            <style>
                {`
                @keyframes spin-y {
                    0% { transform: rotateY(0deg) rotateZ(45deg); }
                    100% { transform: rotateY(360deg) rotateZ(45deg); }
                }
                @keyframes float-gem {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-15px); }
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                .gem-container { perspective: 1000px; }
                .gem-3d {
                    animation: float-gem 4s ease-in-out infinite, spin-y 6s linear infinite;
                    transform-style: preserve-3d;
                }
                @media (prefers-reduced-motion: reduce) {
                    .gem-3d { animation: none; transform: rotateZ(45deg); }
                }
                `}
            </style>

            {/* Header Data Strip */}
            <div className="w-full bg-ghost-bg/90 backdrop-blur-sm border border-ghost-border rounded-xl p-5 shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-ghost-border gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Target size={18} className="text-gold-500" />
                            <h2 className="text-base font-bold text-offwhite uppercase tracking-widest font-halloween mt-1">
                                GemBox Alpha <span className="font-sans text-muted font-normal text-sm">| Top 5 Daily Low-MC Plays</span>
                            </h2>
                        </div>
                        <p className="text-[9px] text-muted uppercase tracking-[0.2em] mt-1 font-bold">
                            $5K - $150K MCAP • Max Favorable Excursion (MFE) Continuous Tracking
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[9px] text-muted font-bold uppercase tracking-wider tabular-nums">
                            Next drop window {nextDrop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {lastUpdated && (
                            <span className="text-[9px] text-muted font-bold uppercase tracking-wider tabular-nums">
                                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                        <button
                            onClick={() => load()}
                            aria-label="Refresh picks"
                            className="text-muted hover:text-gold-400 transition-colors bg-ghost-surface hover:bg-ghost-border rounded-full p-1.5 cursor-pointer"
                        >
                            <RefreshCw size={12} className={status === 'loading' ? 'animate-spin' : ''} />
                        </button>
                        {Object.keys(live).length > 0 && (
                            <span className="text-[9px] text-safe font-bold uppercase tracking-wider bg-safe/10 px-3 py-1.5 rounded border border-safe/30 flex items-center gap-1.5">
                                <ShieldCheck size={12} /> Live Verified
                            </span>
                        )}
                        <span className="text-[9px] text-gold-500 font-bold uppercase tracking-wider bg-gold-500/10 px-3 py-1.5 rounded border border-gold-500/30 flex items-center gap-1.5">
                            <Zap size={12} /> Adaptive Threshold
                        </span>
                    </div>
                </div>

                {/* Ledger Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    <div className="bg-ghost-black p-3 rounded-lg border border-ghost-border shadow-inner">
                        <span className="text-[8px] text-muted font-bold uppercase tracking-widest block mb-1">Median Peak ROI</span>
                        <span className="text-base font-bold text-offwhite font-mono tabular-nums">
                            {stat('p50_roi_multiplier', (v) => `${v}x`)}
                        </span>
                    </div>
                    <div className="bg-ghost-black p-3 rounded-lg border border-ghost-border shadow-inner">
                        <span className="text-[8px] text-muted font-bold uppercase tracking-widest block mb-1">Top Decile (P90)</span>
                        <span className="text-base font-bold text-safe font-mono tabular-nums">
                            {stat('p90_roi_multiplier', (v) => `${v}x`)}
                        </span>
                    </div>
                    <div className="bg-ghost-black p-3 rounded-lg border border-ghost-border shadow-inner">
                        <span className="text-[8px] text-muted font-bold uppercase tracking-widest block mb-1">2X+ Hit Rate</span>
                        <span className="text-base font-bold text-gold-500 font-mono tabular-nums">
                            {stat('win_rate_2x', (v) => `${v}%`)}
                        </span>
                    </div>
                    <div className="bg-ghost-black p-3 rounded-lg border border-ghost-border shadow-inner">
                        <span className="text-[8px] text-muted font-bold uppercase tracking-widest block mb-1">Avg Max Drawdown</span>
                        <span className="text-base font-bold text-danger font-mono tabular-nums">
                            {stat('avg_max_drawdown', (v) => `-${Math.abs(v)}%`)}
                        </span>
                    </div>
                </div>

                {error && status === 'ready' && (
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-danger font-bold bg-danger/10 border border-danger/30 rounded px-3 py-2">
                        <AlertTriangle size={12} /> Showing last known data. Refresh failed: {error}
                    </div>
                )}
            </div>

            {/* The Gem Display Area */}
            <div className="w-full bg-ghost-black border border-ghost-border rounded-xl p-10 min-h-[300px] flex flex-col items-center justify-center gap-8 relative overflow-hidden shadow-inner">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold-500/5 via-transparent to-transparent pointer-events-none"></div>

                {status === 'loading' && (
                    <div className="flex flex-col items-center gap-3 z-10">
                        <Activity className="animate-spin text-gold-500" size={24} />
                        <span className="text-[10px] uppercase tracking-widest text-gold-500 font-bold animate-pulse">Scanning the trenches...</span>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col items-center gap-3 z-10 text-center max-w-md">
                        <AlertTriangle className="text-danger" size={24} />
                        <span className="text-[11px] uppercase tracking-widest text-danger font-bold">Could not load today's picks</span>
                        <span className="text-xs text-muted font-mono break-all">{error}</span>
                        <span className="text-[10px] text-muted font-mono break-all">Tried: {API_BASE}/api/gembox</span>
                        <button
                            onClick={() => load()}
                            className="mt-1 px-4 py-2 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/40 rounded-lg text-gold-400 font-bold text-[10px] uppercase tracking-widest cursor-pointer transition-all"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {status === 'ready' && (
                    <>
                        <div className="w-full max-w-4xl mx-auto flex flex-wrap justify-center gap-12 sm:gap-16 z-10">
                            {displayPicks.map((pick, idx) =>
                                pick ? (
                                    <Gem key={pick.id ?? pick.token_address} pick={pick} onSelect={handleGemClick} />
                                ) : (
                                    <div key={`empty-${idx}`} className="flex flex-col items-center gap-4 opacity-20">
                                        <div className="w-16 h-16 border border-dashed border-muted rotate-45 flex items-center justify-center"></div>
                                        <span className="text-[9px] uppercase tracking-widest text-muted font-bold">Awaiting Data</span>
                                    </div>
                                )
                            )}
                        </div>

                        {picks.length === 0 && (
                            <p className="z-10 text-[10px] text-muted font-bold uppercase tracking-widest text-center max-w-md">
                                No picks yet. The scanner publishes the best qualified token in each daily drop window.
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* Daily Performance Ledger Table */}
            {ledger && ledger.filter(l => l.period_type === 'DAILY').length > 0 && (
                <div className="w-full bg-ghost-bg/90 backdrop-blur-sm border border-ghost-border rounded-xl p-5 shadow-lg">
                    <h3 className="text-sm font-bold text-offwhite uppercase tracking-widest font-halloween mb-4 flex items-center gap-2">
                        <Activity size={16} className="text-gold-500" /> Daily Performance Ledger
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs font-mono">
                            <thead>
                                <tr className="border-b border-ghost-border text-[9px] text-gold-500 uppercase tracking-[0.2em] bg-ghost-black/50 font-bold">
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4 text-center">Drops</th>
                                    <th className="py-3 px-4 text-center">2x Hit Rate</th>
                                    <th className="py-3 px-4 text-right">Median Peak MFE</th>
                                    <th className="py-3 px-4 text-right">Top Decile MFE</th>
                                    <th className="py-3 px-4 text-right">Avg Drawdown</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-ghost-border">
                                {ledger.filter(l => l.period_type === 'DAILY').map((row, idx) => {
                                    const d = new Date(row.period_start);
                                    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
                                    return (
                                        <tr key={idx} className="hover:bg-gold-500/[0.03] transition-colors">
                                            <td className={`py-3 px-4 font-bold ${row.is_winning_period ? 'text-safe' : 'text-offwhite'}`}>{dateStr}</td>
                                            <td className="py-3 px-4 text-muted text-center tabular-nums">{row.total_picks}</td>
                                            <td className="py-3 px-4 text-center tabular-nums font-bold text-gold-400">{Number(row.win_rate_2x).toFixed(1)}%</td>
                                            <td className="py-3 px-4 text-right text-safe font-bold tabular-nums">{Number(row.p50_roi_multiplier).toFixed(2)}x</td>
                                            <td className="py-3 px-4 text-right text-safe tabular-nums">{Number(row.p90_roi_multiplier).toFixed(2)}x</td>
                                            <td className="py-3 px-4 text-right text-danger tabular-nums">-{Math.abs(Number(row.avg_max_drawdown)).toFixed(1)}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* The Gem Detail Modal Popover */}
            {selectedPick && (
                <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-ghost-black/80 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]" onClick={() => setSelectedAddr(null)}>
                    <div className="bg-ghost-bg border border-gold-500/40 rounded-2xl p-6 w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.9)] relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setSelectedAddr(null)} aria-label="Close" className="absolute top-4 right-4 text-muted hover:text-gold-400 transition-colors bg-ghost-surface hover:bg-ghost-border rounded-full p-1.5 cursor-pointer z-10">
                            <X size={14} />
                        </button>

                        <div className="flex items-center gap-4 mb-5 border-b border-ghost-border pb-4 pr-6">
                            <div className="rounded-full border border-gold-500/50 bg-ghost-black flex items-center justify-center overflow-hidden shrink-0 shadow-[0_0_15px_rgba(212,175,55,0.3)]" style={{ width: '64px', height: '64px' }}>
                                {logoFor(selectedPick) ? (
                                    <img src={logoFor(selectedPick)} alt={selectedPick.token_symbol} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <span className="text-gold-500 font-sans text-xl font-bold">{selectedPick.token_symbol?.substring(0, 3).toUpperCase()}</span>
                                )}
                            </div>
                            <div className="flex flex-col justify-center overflow-hidden">
                                <h3 className="text-xl font-bold text-offwhite tracking-wide truncate">{selectedPick.token_symbol}</h3>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-gold-400 font-bold font-mono text-[10px] bg-gold-500/10 px-2 py-0.5 rounded border border-gold-500/30 flex items-center gap-1 tabular-nums">
                                        <ShieldCheck size={10} /> Score: {selectedPick.score_composite}/100
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div onClick={(e) => handleCopyCA(e, selectedPick.token_address)} className="bg-ghost-black border border-ghost-border hover:border-gold-500/50 transition-colors rounded-lg p-3 flex justify-between items-center mb-5 cursor-pointer group shadow-inner" title="Copy Address to Clipboard">
                            <div className="flex flex-col overflow-hidden">
                                <span className="font-bold text-[8px] text-muted uppercase tracking-widest mb-1">Contract Address</span>
                                <span className="font-mono text-xs text-offwhite truncate pr-4">{selectedPick.token_address}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {copied && <span className="text-safe text-[10px] uppercase font-bold animate-pulse">Copied!</span>}
                                <Copy size={14} className="text-muted group-hover:text-gold-500 transition-colors" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-ghost-surface p-3 rounded-lg border border-ghost-border flex flex-col justify-center">
                                <span className="font-bold text-[8px] text-muted uppercase tracking-widest mb-1">Entry / Current Cap</span>
                                <span className="font-mono text-offwhite text-xs font-bold tabular-nums">
                                    {fmtMoney(selectedPick.entry_mcap)} <span className="text-muted font-sans font-normal">→</span> {fmtMoney(selectedPick.current_mcap)}
                                </span>
                            </div>
                            <div className="bg-ghost-surface p-3 rounded-lg border border-ghost-border flex flex-col justify-center">
                                <span className="font-bold text-[8px] text-muted uppercase tracking-widest mb-1">Peak MFE trajec.</span>
                                <span className="font-mono text-xs font-bold text-safe flex items-center gap-1 tabular-nums">
                                    <TrendingUp size={12} /> {num(selectedPick.peak_roi_multiplier).toFixed(2)}x
                                </span>
                            </div>
                        </div>

                        {selectedPick._live && (
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="bg-ghost-surface p-3 rounded-lg border border-ghost-border flex flex-col justify-center">
                                    <span className="font-bold text-[8px] text-muted uppercase tracking-widest mb-1">Liquidity</span>
                                    <span className="font-mono text-offwhite text-xs font-bold tabular-nums">{fmtMoney(selectedPick._live.liquidity)}</span>
                                </div>
                                <div className="bg-ghost-surface p-3 rounded-lg border border-ghost-border flex flex-col justify-center">
                                    <span className="font-bold text-[8px] text-muted uppercase tracking-widest mb-1">24h Volume</span>
                                    <span className="font-mono text-offwhite text-xs font-bold tabular-nums">{fmtMoney(selectedPick._live.volume24h)}</span>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-4 gap-2 mb-5">
                            <div className="bg-ghost-surface p-2 rounded-lg border border-ghost-border text-center">
                                <span className="font-bold text-[7px] text-muted uppercase block mb-1">Cabal</span>
                                <span className="font-mono font-bold text-offwhite text-[10px] tabular-nums">{selectedPick.score_cabal}</span>
                            </div>
                            <div className="bg-ghost-surface p-2 rounded-lg border border-ghost-border text-center">
                                <span className="font-bold text-[7px] text-muted uppercase block mb-1">S.Money</span>
                                <span className="font-mono font-bold text-gold-500 text-[10px] tabular-nums">{selectedPick.score_smart_money}</span>
                            </div>
                            <div className="bg-ghost-surface p-2 rounded-lg border border-ghost-border text-center">
                                <span className="font-bold text-[7px] text-muted uppercase block mb-1">Dev</span>
                                <span className="font-mono font-bold text-offwhite text-[10px] tabular-nums">{selectedPick.score_deployer}</span>
                            </div>
                            <div className="bg-ghost-surface p-2 rounded-lg border border-ghost-border text-center">
                                <span className="font-bold text-[7px] text-muted uppercase block mb-1">Velocity</span>
                                <span className="font-mono font-bold text-offwhite text-[10px] tabular-nums">{selectedPick.score_velocity}</span>
                            </div>
                        </div>

                        {selectedPick._flags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-5">
                                {selectedPick._flags.map((f) => (
                                    <span key={f} className="text-[9px] font-bold uppercase tracking-wider text-danger bg-danger/10 border border-danger/30 rounded px-2 py-1 flex items-center gap-1">
                                        <AlertTriangle size={10} /> {f}
                                    </span>
                                ))}
                            </div>
                        )}

                        <a href={`https://dexscreener.com/solana/${selectedPick.token_address}`} target="_blank" rel="noreferrer" className="w-full py-3 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/40 rounded-lg text-gold-400 font-bold text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 transition-all cursor-pointer">
                            <ExternalLink size={14} /> Open DexScreener
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}