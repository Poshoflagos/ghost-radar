// src/pages/ZombieRadar.jsx
import React, { useState, useEffect } from 'react';
import { 
  Skull, Flame, RefreshCw, ShieldCheck, 
  Search, Crosshair, Copy, Check, Clock, 
  AlertCircle, TrendingUp, TrendingDown, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// -----------------------------------------------------------------------------
// RULES: keep these numbers the same as the ZOMBIE block in radar-engine/server.js
// Change a number here and every label on the page updates by itself.
// -----------------------------------------------------------------------------
const RULES = {
  REBOUND_DUMP_PCT: 30,
  REBOUND_BOUNCE_PCT: 2,
  REBOUND_MIN_LIQ: '$500',
  CTO_SPIKE_PCT: 5,
  CTO_MIN_BUYS: 3,
  CTO_MAX_PRIOR_VOL: '$30K',
  CTO_SURGE_X: 3,
  CTO_MIN_LIQ: '$1K'
};

function formatDormancy(ms) {
  if (!ms || ms <= 0) return '0h';
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const totalMonths = Math.floor(totalDays / 30);
  const totalYears = Math.floor(totalDays / 365);

  if (totalYears > 0) {
    const remMonths = Math.floor((totalDays % 365) / 30);
    return `${totalYears}y ${remMonths > 0 ? `${remMonths}mo` : ''}`.trim();
  }
  if (totalMonths > 0) {
    const remDays = totalDays % 30;
    return `${totalMonths}mo ${remDays > 0 ? `${remDays}d` : ''}`.trim();
  }
  if (totalDays > 0) {
    const remHours = totalHours % 24;
    return `${totalDays}d ${remHours > 0 ? `${remHours}h` : ''}`.trim();
  }
  const remMinutes = totalMinutes % 60;
  return `${totalHours}h ${remMinutes > 0 ? `${remMinutes}m` : ''}`.trim();
}

function ZombieCardSkeleton() {
  return (
    <div className="bg-ghost-black border border-ghost-border rounded-lg flex flex-col justify-between overflow-hidden shadow-md animate-pulse h-[200px]">
      <div className="p-3 bg-ghost-bg border-b border-ghost-border flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 w-full">
          <div className="w-10 h-10 rounded bg-ghost-surface shrink-0"></div>
          <div className="flex flex-col gap-2 w-full">
            <div className="w-24 h-3 bg-ghost-surface rounded"></div>
            <div className="w-12 h-3 bg-ghost-surface rounded"></div>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 bg-ghost-black border-b border-ghost-border flex justify-between">
        <div className="w-20 h-3 bg-ghost-surface rounded"></div>
        <div className="w-12 h-3 bg-ghost-surface rounded"></div>
      </div>
      <div className="px-3 py-2 bg-ghost-bg border-b border-ghost-border">
        <div className="w-full h-3 bg-ghost-surface rounded"></div>
      </div>
      <div className="grid grid-cols-2 p-2 gap-2 bg-ghost-black border-b border-ghost-border">
        <div className="h-6 bg-ghost-surface rounded"></div>
        <div className="h-6 bg-ghost-surface rounded"></div>
      </div>
      <div className="grid grid-cols-2 bg-ghost-bg h-8"></div>
    </div>
  );
}

export default function ZombieRadar() {
  const navigate = useNavigate();
  const [activeMode, setActiveMode] = useState('CTO');
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedAddress, setCopiedAddress] = useState(null);

  const fetchTelemetry = async (mode = activeMode) => {
    setLoading(true);
    try {
      const res = await fetch(`https://site--ghost-radar--26zc8pyqkn62.code.run/api/zombie-radar?mode=${mode}`);
      const json = await res.json();
      if (json.success) {
        setTokens(json.data || []);
      } else {
        setTokens([]);
      }
    } catch (e) {
      console.warn('Zombie backend offline');
      setTokens([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry(activeMode);
    const interval = setInterval(() => fetchTelemetry(activeMode), 30000);
    return () => clearInterval(interval);
  }, [activeMode]);

  const handleModeSwitch = (mode) => {
    setActiveMode(mode);
    fetchTelemetry(mode);
  };

  const copyAddress = (addr, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 1500);
  };

  const formatCompact = (num) => {
    if (!num) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 1
    }).format(Number(num));
  };

  return (
    <div className="h-full bg-transparent text-offwhite font-sans p-4 pt-28 sm:p-6 lg:p-8 lg:pt-28 selection:bg-gold-500/30 selection:text-gold-400">
      <div className="max-w-[1500px] mx-auto w-full">
        
        {/* COMPACT HEADER & INLINE TAB CONTROLS */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-ghost-border pb-4 mb-5 gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Skull className="text-gold-500 w-6 h-6 shrink-0 animate-pulse" />
              <h1 className="text-3xl sm:text-4xl text-gold-500 tracking-wider drop-shadow-[0_0_10px_rgba(212,175,55,0.4)] font-halloween">
                ZOMBIE YARD FORENSICS
              </h1>
            </div>
            <p className="text-[11px] text-muted mt-1 flex items-center gap-1.5 font-bold tracking-wide">
              <Flame className="w-3.5 h-3.5 text-gold-500 shrink-0" />
              {activeMode === 'CTO' 
                ? `24H Horizon: Quiet contracts that wake up with a volume surge (+${RULES.CTO_SPIKE_PCT}% in 1h)`
                : `24H Horizon: Contracts down ${RULES.REBOUND_DUMP_PCT}% or more that bounced ${RULES.REBOUND_BOUNCE_PCT}% or more off the floor`}
            </p>
          </div>

          {/* TABS WITH DIRECT HOVER TOOLTIPS */}
          <div className="flex items-center gap-3">
            <div className="flex bg-ghost-bg border border-ghost-border rounded-lg p-1 text-xs shadow-inner">
              
              {/* CTO TAB */}
              <div className="relative group">
                <button
                  onClick={() => handleModeSwitch('CTO')}
                  className={`px-3.5 py-1.5 font-bold uppercase tracking-widest rounded transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeMode === 'CTO'
                      ? 'bg-gold-500/15 text-gold-500 border border-gold-500/50 shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                      : 'text-muted hover:text-offwhite hover:bg-ghost-surface border border-transparent'
                  }`}
                >
                  <Skull size={13} /> CTO Graveyard
                </button>
                <div className="absolute top-full left-0 mt-2 w-64 bg-ghost-bg border border-gold-500/50 text-muted text-[10px] p-2.5 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-2xl pointer-events-none normal-case leading-relaxed backdrop-blur-md">
                  <strong className="text-gold-500 block mb-0.5 text-xs tracking-wider">CTO Graveyard</strong>
                  Finds Solana tokens that were quiet (under {RULES.CTO_MAX_PRIOR_VOL} volume in the 23 hours before), then jumped {RULES.CTO_SPIKE_PCT}% or more in the last hour with at least {RULES.CTO_MIN_BUYS} buys and {RULES.CTO_SURGE_X}x more volume than usual.
                </div>
              </div>

              {/* LAZARUS TAB */}
              <div className="relative group">
                <button
                  onClick={() => handleModeSwitch('REBOUND')}
                  className={`px-3.5 py-1.5 font-bold uppercase tracking-widest rounded transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeMode === 'REBOUND'
                      ? 'bg-gold-500/15 text-gold-500 border border-gold-500/50 shadow-[0_0_10px_rgba(212,175,55,0.2)]'
                      : 'text-muted hover:text-offwhite hover:bg-ghost-surface border border-transparent'
                  }`}
                >
                  <Zap size={13} /> Lazarus Rebound (-{RULES.REBOUND_DUMP_PCT}% / +{RULES.REBOUND_BOUNCE_PCT}%)
                </button>
                <div className="absolute top-full right-0 mt-2 w-64 bg-ghost-bg border border-gold-500/50 text-muted text-[10px] p-2.5 rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-2xl pointer-events-none normal-case leading-relaxed backdrop-blur-md">
                  <strong className="text-gold-500 block mb-0.5 text-xs tracking-wider">Lazarus Rebound</strong>
                  Finds tokens that dropped {RULES.REBOUND_DUMP_PCT}% or more over 24 hours, but bounced {RULES.REBOUND_BOUNCE_PCT}% or more off the lowest point.
                </div>
              </div>

            </div>

            <button
              onClick={() => fetchTelemetry(activeMode)}
              disabled={loading}
              className="px-3 py-1.5 bg-ghost-bg border border-gold-500/40 hover:border-gold-500 text-gold-500 text-xs font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(212,175,55,0.1)] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </button>
          </div>
        </div>

        {/* METRIC PARAMETER STATUS STRIP */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-ghost-bg border border-ghost-border p-2.5 rounded-lg shadow-sm">
            <span className="text-[8px] text-muted uppercase block font-bold tracking-widest">
              {activeMode === 'CTO' ? 'Quiet Gate' : '24H Flush'}
            </span>
            <span className="text-xs font-black text-gold-500">
              {activeMode === 'CTO' ? `< ${RULES.CTO_MAX_PRIOR_VOL} prior volume` : `Dropped ≥ ${RULES.REBOUND_DUMP_PCT}%`}
            </span>
          </div>
          <div className="bg-ghost-bg border border-ghost-border p-2.5 rounded-lg shadow-sm">
            <span className="text-[8px] text-muted uppercase block font-bold tracking-widest">
              {activeMode === 'CTO' ? '1H Spike Gate' : 'Bounce Reclaim'}
            </span>
            <span className="text-xs font-black text-safe">
              {activeMode === 'CTO' ? `≥ +${RULES.CTO_SPIKE_PCT}% and ${RULES.CTO_MIN_BUYS}+ buys` : `Gained ≥ +${RULES.REBOUND_BOUNCE_PCT}%`}
            </span>
          </div>
          <div className="bg-ghost-bg border border-ghost-border p-2.5 rounded-lg shadow-sm">
            <span className="text-[8px] text-muted uppercase block font-bold tracking-widest">Scope Horizon</span>
            <span className="text-xs font-black text-offwhite">24 Hours Cross-DEX</span>
          </div>
          <div className="bg-ghost-bg border border-ghost-border p-2.5 rounded-lg shadow-sm">
            <span className="text-[8px] text-muted uppercase block font-bold tracking-widest">Liquidity Floor</span>
            <span className="text-xs font-black text-gold-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> {activeMode === 'CTO' ? `≥ ${RULES.CTO_MIN_LIQ}` : `≥ ${RULES.REBOUND_MIN_LIQ}`}
            </span>
          </div>
        </div>

        {/* CARDS GRID */}
        {loading && tokens.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 w-full">
            {Array(8).fill(0).map((_, i) => <ZombieCardSkeleton key={i} />)}
          </div>
        ) : tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 border border-ghost-border bg-ghost-bg rounded-xl text-center shadow-inner">
            <AlertCircle className="w-8 h-8 text-gold-500/60 mb-2" />
            <h2 className="text-xs uppercase tracking-widest text-offwhite font-bold">
              NO TOKENS CURRENTLY FIT INTO THE REQUIRED PARAMETERS
            </h2>
            <p className="text-[11px] text-muted mt-1.5 max-w-md">
              {activeMode === 'CTO' 
                ? `No tokens right now were quiet before and then jumped ${RULES.CTO_SPIKE_PCT}% or more in the last hour with ${RULES.CTO_MIN_BUYS}+ buys.`
                : `No tokens right now dropped ${RULES.REBOUND_DUMP_PCT}% or more in 24h and also bounced ${RULES.REBOUND_BOUNCE_PCT}% or more.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 w-full">
            {tokens.map(token => (
              <div 
                key={token.token_address}
                className="bg-ghost-black border border-ghost-border hover:border-gold-500/50 rounded-lg flex flex-col justify-between overflow-hidden shadow-md transition-all group"
              >
                {/* CARD HEADER WITH FIXED PFP */}
                <div className="p-3 bg-ghost-bg border-b border-ghost-border flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    
                    {/* STRICT 42x42px PFP CONTAINER (IMMUNE TO BLOWOUT) */}
                    <div 
                      className="rounded bg-ghost-black border border-ghost-border shrink-0 overflow-hidden flex items-center justify-center"
                      style={{ width: '42px', height: '42px', minWidth: '42px', maxWidth: '42px' }}
                    >
                      {token.image_url ? (
                        <img 
                          src={token.image_url} 
                          alt={token.token_symbol} 
                          width="42"
                          height="42"
                          style={{ width: '42px', height: '42px', objectFit: 'cover' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-gold-500">CTO</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs font-bold text-offwhite truncate" title={token.token_name}>{token.token_name}</span>
                        <span className="text-[10px] text-gold-500 font-bold shrink-0">${token.token_symbol}</span>
                      </div>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-gold-500/10 text-gold-400 border border-gold-500/30 rounded inline-block uppercase mt-0.5">
                        {token.dex_id}
                      </span>
                    </div>
                  </div>

                  {/* VELOCITY BADGE */}
                  <div className="text-right shrink-0">
                    {activeMode === 'CTO' ? (
                      <span className="text-[10px] text-safe font-mono font-bold block tabular-nums">
                        +{token.resurrection_pct}% 1H
                      </span>
                    ) : (
                      <>
                        <span className="text-[9px] text-danger font-mono font-bold block tabular-nums">
                          {token.dump_24h_pct}%
                        </span>
                        <span className="text-[10px] text-safe font-mono font-bold block tabular-nums">
                          +{token.rebound_pct}%
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* DORMANCY / REBOUND STATUS BAR */}
                <div className="px-3 py-1.5 bg-ghost-black border-b border-ghost-border flex justify-between items-center text-[9px]">
                  <span className="text-muted font-bold flex items-center gap-1 uppercase tracking-widest tabular-nums">
                    <Clock size={10} className="text-gold-500" />
                    {activeMode === 'CTO' 
                      ? `Quiet ${formatDormancy(token.time_without_buy_ms)} before spike` 
                      : `24h Dump: ${token.dump_24h_pct}%`}
                  </span>
                  <span className="text-gold-400 font-bold uppercase tracking-widest tabular-nums">
                    Score: {token.rank_score}/100
                  </span>
                </div>

                {/* CA BAR */}
                <div className="px-3 py-1.5 bg-ghost-bg border-b border-ghost-border flex items-center justify-between text-[9px] font-mono">
                  <div 
                    onClick={(e) => copyAddress(token.token_address, e)}
                    className="flex items-center gap-1.5 cursor-pointer text-muted hover:text-gold-500 truncate flex-1 pr-2 transition-colors"
                  >
                    <span className="text-gold-500 font-bold uppercase tracking-widest">CA:</span>
                    <span className="truncate">{token.token_address}</span>
                    {copiedAddress === token.token_address ? <Check size={11} className="text-safe shrink-0" /> : <Copy size={11} className="shrink-0" />}
                  </div>
                </div>

                {/* METRICS & REAL-TIME BUY/SELL RATIO */}
                <div className="grid grid-cols-2 p-2 bg-ghost-black border-b border-ghost-border text-center gap-1">
                  <div>
                    <span className="text-[7px] text-muted uppercase block font-bold tracking-widest">MCAP</span>
                    <span className="text-xs font-black text-offwhite font-mono tabular-nums">{formatCompact(token.mcap_usd)}</span>
                  </div>
                  <div>
                    <span className="text-[7px] text-muted uppercase block font-bold tracking-widest">Buy / Sell Flow</span>
                    <span className="text-xs font-black text-safe font-mono tabular-nums">
                      {token.buy_ratio_pct}% ({token.buys_1h}B/{token.sells_1h}S)
                    </span>
                  </div>
                </div>

                {/* QUICK ACTION BUTTONS */}
                <div className="grid grid-cols-2 bg-ghost-bg">
                  <button
                    onClick={() => navigate('/', { state: { autoAddress: token.token_address, activeTab: 'xray' } })}
                    className="py-2 text-[9px] uppercase tracking-wider font-bold text-muted hover:text-gold-500 hover:bg-gold-500/10 border-r border-ghost-border flex items-center justify-center gap-1 transition-all cursor-pointer"
                  >
                    <Search size={11} className="text-gold-500" /> X-Ray
                  </button>
                  <a
                    href={`https://photon-sol.tinyastro.io/en/lp/${token.token_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 text-[9px] uppercase tracking-wider font-bold text-muted hover:text-safe hover:bg-safe/10 flex items-center justify-center gap-1 transition-all"
                  >
                    <Crosshair size={11} className="text-safe" /> Photon
                  </a>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}