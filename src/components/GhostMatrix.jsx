// src/components/GhostMatrix.jsx
import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, ExternalLink, RefreshCw, Copy, Check, Flame, Activity } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const formatAge = (min) => {
  const m = Number(min || 0);
  if (m < 60) return `${m}m old`;
  return `${Math.floor(m / 60)}h ${m % 60}m old`;
};

const formatCompact = (num) => {
  if (!num) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 1
  }).format(Number(num));
};

// Graceful Loading Skeleton
function GhostMatrixSkeleton() {
  return (
    <div className="bg-ghost-bg border border-ghost-border rounded-xl p-4 flex flex-col justify-between animate-pulse h-[160px] w-full">
      <div className="flex items-center justify-between mb-3.5 gap-3">
        <div className="flex items-center gap-3 w-full">
          <div className="w-10 h-10 rounded-full bg-ghost-surface shrink-0"></div>
          <div className="flex flex-col gap-2 w-full">
            <div className="h-4 w-24 bg-ghost-surface rounded"></div>
            <div className="h-3 w-32 bg-ghost-surface rounded"></div>
          </div>
        </div>
        <div className="w-6 h-6 bg-ghost-surface rounded shrink-0"></div>
      </div>
      <div className="mb-4">
        <div className="flex justify-between mb-1.5">
          <div className="h-3 w-20 bg-ghost-surface rounded"></div>
          <div className="h-3 w-12 bg-ghost-surface rounded"></div>
        </div>
        <div className="w-full h-2 bg-ghost-surface rounded-full"></div>
      </div>
      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-ghost-border">
        <div className="h-6 w-full bg-ghost-surface rounded"></div>
        <div className="h-6 w-full bg-ghost-surface rounded"></div>
        <div className="h-6 w-full bg-ghost-surface rounded"></div>
        <div className="h-6 w-full bg-ghost-surface rounded"></div>
      </div>
    </div>
  );
}

export default function GhostMatrix() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [solPrice, setSolPrice] = useState(null);
  const [copiedAddress, setCopiedAddress] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [stale, setStale] = useState(false);
  const [, setTick] = useState(0);

  const fetchMatrixData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/ghost-matrix`);
      const data = await res.json();
      if (data.success) {
        setTokens(data.data || []);
        setSolPrice(data.current_sol_price);
        setUpdatedAt(data.updated_at || 0);
        setStale(Boolean(data.stale));
      }
    } catch (error) {
      console.error("Failed to fetch Ghost Matrix data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatrixData();
    const interval = setInterval(() => {
      if (!document.hidden) fetchMatrixData();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // ticks every second so the "updated Xs ago" label keeps moving
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const handleCopyCA = (e, address) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  return (
    <div className="h-full bg-transparent text-offwhite font-mono p-4 pt-28 sm:p-6 lg:p-8 lg:pt-28 selection:bg-gold-500/20 selection:text-gold-400 overflow-x-hidden">
      
      <div className="max-w-[1600px] mx-auto mb-8 w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-ghost-border pb-4 mb-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Target className="text-gold-500 w-8 h-8 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl text-gold-500 tracking-wider drop-shadow-[0_0_12px_rgba(212,175,55,0.6)] flex items-center gap-3 truncate font-halloween">
                GHOST MATRIX
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded bg-gold-500/10 text-gold-400 border border-gold-500/30 tracking-widest font-sans ml-2">
                  10K - 100K • 24H
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-muted tracking-wide mt-1 font-sans">
                Micro-cap radar tracking tokens post-launch across all major DEXs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs shrink-0 font-sans">
            <div className="flex flex-col items-start sm:items-end">
              <span className="text-muted text-[9px] uppercase tracking-widest font-bold">Active Tokens</span>
              <span className="text-gold-500 font-bold text-base tabular-nums">{tokens.length}</span>
            </div>
            <div className="flex flex-col items-start sm:items-end">
              <span className="text-muted text-[9px] uppercase tracking-widest font-bold">Feed</span>
              <span className={`font-bold text-base flex items-center gap-1.5 tabular-nums ${stale ? 'text-danger' : 'text-safe'}`}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${stale ? 'bg-danger' : 'bg-safe animate-pulse'}`}></span>
                {updatedAt ? `${Math.max(0, Math.round((Date.now() - updatedAt) / 1000))}s ago` : 'WAITING'}
              </span>
            </div>
            {solPrice && (
              <div className="flex flex-col items-start sm:items-end">
                <span className="text-muted text-[9px] uppercase tracking-widest font-bold">SOL Index</span>
                <span className="text-offwhite font-bold text-base tabular-nums font-mono">${solPrice.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 w-full">
          {loading ? (
            Array(6).fill(0).map((_, i) => <GhostMatrixSkeleton key={i} />)
          ) : tokens.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-ghost-bg border border-dashed border-ghost-border rounded-xl text-muted text-xs uppercase tracking-widest font-sans font-bold flex flex-col items-center gap-3">
              <Target className="w-6 h-6 text-ghost-border" />
              No new tokens currently in the 10K - 100K volatility zone.
            </div>
          ) : (
            tokens.map((token) => {
              const isCopied = copiedAddress === token.token_address;
              const priceChange1h = Number(token.price_change_1h || 0);
              const isPositive = priceChange1h >= 0;

              return (
                <div
                  key={token.token_address}
                  className="bg-ghost-bg border border-ghost-border hover:border-gold-500/50 rounded-xl p-4 transition-all duration-300 hover:shadow-lg flex flex-col justify-between overflow-hidden group w-full"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3.5 gap-3 w-full">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        
                        {/* Avatar */}
                        <div className="w-10 h-10 min-w-[40px] max-w-[40px] rounded-full bg-ghost-black border border-ghost-border overflow-hidden shrink-0 flex items-center justify-center">
                          {token.image_url ? (
                            <img
                              src={token.image_url}
                              alt={token.token_symbol}
                              className="w-full h-full object-cover block"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <Activity className="w-4 h-4 text-gold-500" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0 flex-1 overflow-hidden font-sans">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-offwhite tracking-wide truncate max-w-[130px]">
                              {token.token_symbol}
                            </span>
                            <span className="text-[8px] text-gold-400 uppercase bg-gold-500/10 border border-gold-500/30 px-1.5 py-0.5 rounded shrink-0 font-bold">
                              {token.dex_id || 'PUMP'}
                            </span>
                            
                            <button
                              onClick={(e) => handleCopyCA(e, token.token_address)}
                              className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded border transition-all cursor-pointer shrink-0 font-mono ${
                                isCopied
                                  ? 'bg-safe/20 text-safe border-safe/40'
                                  : 'bg-ghost-black hover:bg-ghost-surface text-muted hover:text-offwhite border-ghost-border hover:border-gold-500/40'
                              }`}
                              title="Copy CA"
                            >
                              <span>{token.token_address.slice(0, 4)}...{token.token_address.slice(-4)}</span>
                              {isCopied ? <Check size={10} className="text-safe" /> : <Copy size={10} className="group-hover:text-gold-500 transition-colors" />}
                            </button>
                          </div>
                          <span className="text-[10px] text-muted truncate max-w-full mt-0.5 pr-2">
                            {token.token_name || 'Solana Trench Token'}
                          </span>
                        </div>
                      </div>

                      <a
                        href={`https://dexscreener.com/solana/${token.token_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted hover:text-gold-500 p-1.5 transition-colors shrink-0 bg-ghost-black rounded border border-ghost-border hover:border-gold-500/40 ml-auto"
                        title="DexScreener"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>

                    {/* Progress Bar Area */}
                    <div className="mb-4 font-sans">
                      <div className="flex justify-between items-center text-[10px] mb-1.5 uppercase">
                        <span className="text-muted flex items-center gap-1 font-bold tracking-wider">
                          <Flame size={12} className="text-gold-500" /> MCap Band 10K-100K
                        </span>
                        <span className="text-gold-400 font-bold tabular-nums">
                          {formatAge(token.age_min)}
                        </span>
                      </div>
                      <div className="w-full bg-ghost-black rounded-full h-1.5 overflow-hidden border border-ghost-border">
                        <div
                          className="bg-gradient-to-r from-gold-500/40 via-gold-500 to-gold-400 h-1.5 rounded-full transition-all duration-700 ease-out relative"
                          style={{ width: `${Math.min(100, Math.max(0, token.band_pct))}%` }}
                        >
                          <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/40 blur-[1px]"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-2 pt-3 border-t border-ghost-border text-left font-sans">
                    <div className="min-w-0">
                      <span className="text-muted text-[8px] uppercase tracking-wider font-bold block mb-0.5 truncate">MCap</span>
                      <span className="text-offwhite text-xs font-mono font-bold tabular-nums truncate block">
                        {formatCompact(token.mcap_usd)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted text-[8px] uppercase tracking-wider font-bold block mb-0.5 truncate">Liq</span>
                      <span className="text-safe text-xs font-mono font-bold tabular-nums truncate block">
                        {formatCompact(token.liquidity_usd)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted text-[8px] uppercase tracking-wider font-bold block mb-0.5 truncate">1H Vol</span>
                      <span className="text-gold-400 text-xs font-mono font-bold tabular-nums truncate block">
                        {formatCompact(token.volume_1h)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="text-muted text-[8px] uppercase tracking-wider font-bold block mb-0.5 truncate">1H Gain</span>
                      <span className={`text-xs font-mono font-bold tabular-nums flex items-center gap-0.5 truncate ${isPositive ? 'text-safe' : 'text-danger'}`}>
                        {isPositive ? <TrendingUp size={11} className="shrink-0" /> : <TrendingDown size={11} className="shrink-0" />}
                        {isPositive ? '+' : ''}{priceChange1h.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}