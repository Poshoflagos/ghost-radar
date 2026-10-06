// src/pages/AlphaZone.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  RefreshCw, Zap, TrendingUp, TrendingDown, Activity, TerminalSquare,
  Crosshair, Info, Copy, Check, X, Shield, Search, ExternalLink, 
  Filter, ArrowUpDown, AlertTriangle, ChevronDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LANE_CONFIG = [
  { id: 'ALL', label: 'ALL', desc: 'Omnichannel stream of all detected anomalies.' },
  { id: 'BLUECHIPS', label: 'BLUECHIPS', desc: 'Established protocols ($10M+ MC). Institutional volume.' },
  { id: 'MID_CAP', label: 'MID CAP', desc: 'Scaling tokens ($1M-$10M MC). Expansion setups.' },
  { id: 'LOW_CAP', label: 'LOW CAP', desc: 'High volatility ($100K-$1M MC). Rapid volume surges.' },
  { id: 'TRENCH', label: 'TRENCH', desc: 'Bonding curve migrations. Maximum volatility and risk.' }
];

// Each section is fetched on its own so one busy section can never push out the others
const LANES_TO_FETCH = ['BLUECHIPS', 'MID_CAP', 'LOW_CAP', 'TRENCH'];

const SORT_OPTIONS = [
  { id: 'score', label: 'SCORE', tooltip: 'Ranks by the composite Ghost Score (Quality + Timing).' },
  { id: 'mcap', label: 'MCAP', tooltip: 'Total Market Capitalization in USD.' },
  { id: 'vol_5m', label: 'VOL (5M)', tooltip: 'Trading volume over the last 5 minutes. Spot instant momentum.' },
  { id: 'vol_1h', label: 'VOL (1H)', tooltip: 'Trading volume over the last hour. Spot macro trends.' },
  { id: 'delta_5m', label: '5M %', tooltip: 'Price percentage change in the last 5 minutes.' },
  { id: 'delta_1h', label: '1H %', tooltip: 'Price percentage change in the last hour.' }
];

const TAG_EXPLANATIONS = {
  "POST-BOND RALLY": "Price is surging rapidly right after graduating to a decentralized exchange.",
  "GRADUATION DUMP": "Early buyers are selling off heavily immediately after the token hit the open market.",
  "EARLY DISCOVERY": "Price is stabilizing normally after its initial launch volatility.",
  "MOMENTUM EXPANSION": "High trading volume is pushing the price up significantly.",
  "DISTRIBUTION BLEED": "Traders are steadily selling off their bags, slowly dropping the price.",
  "LOW CAP CONSOLIDATION": "Trading sideways with normal volume as it establishes a reliable price floor.",
  "HEAVY ACCUMULATION": "Massive buying volume is consistently pushing the price higher.",
  "MID-CAP BREAKOUT": "Sudden, sharp upward movement for an established mid-sized token.",
  "MACRO PULLBACK": "A sharp, temporary price drop after a strong upward run.",
  "ESTABLISHED MID-CAP": "Holding a strong, steady value without extreme short-term swings.",
  "WHALE ACCUMULATING": "Major institutional-sized buyers are actively loading up on this token.",
  "BLUECHIP UPTICK": "Solid, healthy upward movement for a major heavy-weight asset.",
  "INSTITUTIONAL HOLD": "Trading in a highly stable, low-volatility range typical of massive protocols.",
  "DEAD CONTRACT": "Volume and liquidity have evaporated post-launch. Extreme risk of abandonment or rug.",
  "ACTIVE TELEMETRY": "Live monitoring is active, waiting for a definitive pattern to form."
};

function getDexMeta(dexId) {
  const id = (dexId || 'PUMP.FUN').toUpperCase();
  if (id.includes('PUMP.FUN') || id === 'PUMP') return { name: 'PUMP.FUN', type: 'CURVE', style: 'text-green-400 bg-green-400/10 border-green-400/30' };
  if (id.includes('MOONSHOT')) return { name: 'MOONSHOT', type: 'CURVE', style: 'text-purple-400 bg-purple-400/10 border-purple-400/30' };
  if (id.includes('STONK')) return { name: 'STONK.FUN', type: 'CURVE', style: 'text-orange-400 bg-orange-400/10 border-orange-400/30' };
  if (id.includes('PUMPSWAP')) return { name: 'PUMPSWAP', type: 'CURVE', style: 'text-pink-400 bg-pink-400/10 border-pink-400/30' };
  if (id.includes('DAOS.FUN')) return { name: 'DAOS.FUN', type: 'CURVE', style: 'text-rose-400 bg-rose-400/10 border-rose-400/30' };
  if (id.includes('APE.STORE')) return { name: 'APE.STORE', type: 'CURVE', style: 'text-blue-500 bg-blue-500/10 border-blue-500/30' };
  
  if (id.includes('RAYDIUM')) return { name: 'RAYDIUM', type: 'AMM', style: 'text-blue-400 bg-blue-400/10 border-blue-400/30' };
  if (id.includes('METEORA')) return { name: 'METEORA', type: 'AMM', style: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' };
  if (id.includes('ORCA')) return { name: 'ORCA', type: 'AMM', style: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30' };
  
  return { name: id.substring(0, 10), type: 'UNKNOWN', style: 'text-muted bg-ghost-surface border-ghost-border' };
}

function deriveSignalTag(token) {
  const mcap = Number(token.mcap_usd) || 0;
  const vol1h = Number(token.volume_1h) || 0;
  const delta1h = Number(token.price_change_1h) || 0;
  const liq = Number(token.liquidity_usd) || 0;
  const dexMeta = getDexMeta(token.dex_id);
  
  let backendTag = token.signal_tag ? token.signal_tag.replace(/[\[\]]/g, '').trim().toUpperCase() : '';

  const isLaunchpad = dexMeta.type === 'CURVE';
  const hasVirtualLiquidity = liq >= 3000;
  
  let isBonding = false;
  if (isLaunchpad && hasVirtualLiquidity) {
    if (dexMeta.name === 'PUMP.FUN' && mcap <= 85000) isBonding = true;
    else if (dexMeta.name === 'MOONSHOT' && mcap <= 100000) isBonding = true;
    else if (dexMeta.name === 'STONK.FUN' && mcap <= 150000) isBonding = true;
    else if (dexMeta.name === 'PUMPSWAP' && mcap <= 120000) isBonding = true;
    else if (mcap <= 150000) isBonding = true;
  }

  if (backendTag.includes('BONDING') && !isBonding) {
    backendTag = ''; 
  }

  if (isBonding) {
    return `${dexMeta.name} BONDING ACTIVE`;
  }

  if (mcap < 50000 && !isBonding) {
    if (delta1h < -10 || liq < 5000) return "DEAD CONTRACT";
    return "DISTRIBUTION BLEED";
  }

  if (backendTag) {
    return backendTag;
  }

  if (mcap >= 50000 && mcap < 250000) {
    if (delta1h > 15) return "POST-BOND RALLY";
    if (delta1h < -15) return "GRADUATION DUMP";
    return "EARLY DISCOVERY";
  }
  
  if (mcap >= 250000 && mcap < 1000000) {
    if (vol1h > 50000 && delta1h > 15) return "MOMENTUM EXPANSION";
    if (delta1h < -15) return "DISTRIBUTION BLEED";
    return "LOW CAP CONSOLIDATION";
  }
  
  if (mcap >= 1000000 && mcap < 10000000) {
    if (vol1h > 200000 && delta1h > 10) return "HEAVY ACCUMULATION";
    if (delta1h > 15) return "MID-CAP BREAKOUT";
    if (delta1h < -15) return "MACRO PULLBACK";
    return "ESTABLISHED MID-CAP";
  }
  
  if (mcap >= 10000000) {
    if (vol1h > 500000 && delta1h > 5) return "WHALE ACCUMULATING";
    if (delta1h > 10) return "BLUECHIP UPTICK";
    return "INSTITUTIONAL HOLD";
  }

  return "ACTIVE TELEMETRY";
}

function getTooltipText(tag, dexName) {
  if (tag.includes('BONDING ACTIVE')) {
    return `Token is actively trading on the ${dexName} curve. It has not reached public AMM liquidity yet.`;
  }
  return TAG_EXPLANATIONS[tag] || TAG_EXPLANATIONS["ACTIVE TELEMETRY"];
}

function TokenAvatar({ url, symbol }) {
  const [imgError, setImgError] = useState(false);

  const strictDimensions = {
    width: '40px', height: '40px',
    minWidth: '40px', minHeight: '40px',
    maxWidth: '40px', maxHeight: '40px'
  };

  if (!url || imgError) {
    return (
      <div 
        style={strictDimensions}
        className="rounded-lg border border-gold-500/40 bg-ghost-bg flex items-center justify-center font-black text-xs text-gold-400 shrink-0 shadow-inner overflow-hidden font-sans"
      >
        {symbol?.slice(0, 3).toUpperCase() || '???'}
      </div>
    );
  }

  return (
    <div 
      style={strictDimensions} 
      className="shrink-0 rounded-lg overflow-hidden border border-ghost-border bg-ghost-black shadow-md flex items-center justify-center"
    >
      <img 
        src={url} 
        alt={symbol} 
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

// Loading Skeleton for Graceful States
function TokenCardSkeleton() {
  return (
    <div className="bg-ghost-bg border border-ghost-border rounded-xl p-4 w-full flex flex-col justify-between animate-pulse h-[240px]">
      <div className="flex justify-between items-start mb-3 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-ghost-surface shrink-0"></div>
          <div className="flex flex-col gap-2">
            <div className="w-20 h-4 bg-ghost-surface rounded"></div>
            <div className="w-32 h-3 bg-ghost-surface rounded"></div>
          </div>
        </div>
        <div className="w-10 h-10 bg-ghost-surface rounded-md"></div>
      </div>
      <div className="w-full h-8 bg-ghost-surface rounded mb-3"></div>
      <div className="w-3/4 h-5 bg-ghost-surface rounded mb-3"></div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="w-full h-10 bg-ghost-surface rounded"></div>
        <div className="w-full h-10 bg-ghost-surface rounded"></div>
        <div className="w-full h-10 bg-ghost-surface rounded"></div>
        <div className="w-full h-10 bg-ghost-surface rounded"></div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-ghost-border">
        <div className="w-full h-8 bg-ghost-surface rounded"></div>
        <div className="w-full h-8 bg-ghost-surface rounded"></div>
      </div>
    </div>
  );
}

export default function AlphaZone() {
  const [feed, setFeed] = useState([]);
  const [activeLane, setActiveLane] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  
  const [error, setError] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  
  const [sortBy, setSortBy] = useState(null); 
  const [sortDesc, setSortDesc] = useState(true);
  const [activeTagFilter, setActiveTagFilter] = useState('ALL');

  const [volTf, setVolTf] = useState('1h');
  const [gainTf, setGainTf] = useState('1h');

  const pollingRef = useRef(null);

  const fetchAlphaFeed = useCallback(async (isBackground = false) => {
    if (!isBackground && feed.length === 0) {
      setIsLoading(true);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); 

    try {
      // Ask for each section separately so every section gets its own full list
      const results = await Promise.allSettled(
        LANES_TO_FETCH.map(async (lane) => {
          const response = await fetch(`import.meta.env.VITE_API_URL || 'http://localhost:3001'/api/alpha-zone?lane=${lane}`, {
            signal: controller.signal
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const json = await response.json();
          return json.data || [];
        })
      );
      clearTimeout(timeoutId);

      const succeeded = results.filter(r => r.status === 'fulfilled');
      if (succeeded.length === 0) {
        throw new Error('All section requests failed');
      }

      const merged = succeeded.flatMap(r => r.value);
      setFeed(merged);
      setLastRefreshed(new Date());
      setError(false); 
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Alpha Zone Telemetry Error:", err);
      setError(true); 
    } finally {
      setIsLoading(false);
    }
  }, [feed.length]);

  useEffect(() => {
    fetchAlphaFeed();
    pollingRef.current = setInterval(() => fetchAlphaFeed(true), 15000);
    return () => clearInterval(pollingRef.current);
  }, [fetchAlphaFeed]);

  const availableTags = Array.from(new Set(feed.map(t => deriveSignalTag(t)))).filter(Boolean).sort();

  let processedFeed = feed.filter(token => 
    activeLane === 'ALL' || token.lane === activeLane
  );

  if (activeTagFilter !== 'ALL') {
    processedFeed = processedFeed.filter(token => deriveSignalTag(token) === activeTagFilter);
  }

  const handleSortClick = (baseType, tf = null) => {
    const newSortBy = tf ? `${baseType}_${tf}` : baseType;
    if (sortBy === newSortBy) {
      setSortBy(null); 
    } else {
      setSortBy(newSortBy); 
      setSortDesc(true);
    }
  };

  processedFeed.sort((a, b) => {
    let valA = 0, valB = 0;
    const activeSort = sortBy || 'score';

    if (activeSort === 'score') { 
      valA = Number(a.rank_score) || 0; 
      valB = Number(b.rank_score) || 0; 
    }
    else if (activeSort === 'mcap') { 
      valA = Number(a.mcap_usd) || 0; 
      valB = Number(b.mcap_usd) || 0; 
    }
    else if (activeSort.startsWith('vol_')) {
      const tf = activeSort.split('_')[1];
      valA = Number(a[`volume_${tf}`]) || 0; 
      valB = Number(b[`volume_${tf}`]) || 0;
    }
    else if (activeSort.startsWith('delta_')) {
      const tf = activeSort.split('_')[1];
      valA = Number(a[`price_change_${tf}`]) || 0; 
      valB = Number(b[`price_change_${tf}`]) || 0;
    }
    
    return sortDesc ? valB - valA : valA - valB;
  });

  return (
    <div className="h-full bg-transparent text-offwhite font-mono selection:bg-gold-500/20 selection:text-gold-400 overflow-x-hidden">
      
      <div className="max-w-[1600px] mx-auto mb-8 w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-ghost-border pb-4 mb-6 gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl sm:text-4xl text-gold-500 tracking-wider drop-shadow-[0_0_12px_rgba(212,175,55,0.6)] flex items-center gap-3 truncate font-halloween">
              <TerminalSquare className="text-gold-500 w-8 h-8 shrink-0" />
              GHOST ALPHA_ZONE
            </h1>
            
            <div className="relative group w-fit mt-2">
              <p className="text-xs sm:text-sm text-muted flex items-center gap-2 cursor-help font-sans">
                <Activity className="w-4 h-4 text-safe shrink-0" />
                <span className="border-b border-dashed border-muted/50 hover:text-offwhite transition-colors pb-0.5">
                  Institutional-grade multi-DEX telemetry & behavioral parsing
                </span>
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 shrink-0 font-sans">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs text-muted font-medium flex items-center gap-2 tabular-nums tracking-widest uppercase">
                {isLoading && feed.length > 0 && <RefreshCw className="w-3 h-3 animate-spin text-gold-500" />}
                LAST_SYNC: {lastRefreshed ? lastRefreshed.toLocaleTimeString() : 'AWAITING...'}
              </span>
              
              {error && (
                <span className="bg-danger/10 text-danger border border-danger/20 px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider animate-pulse">
                  <AlertTriangle size={10} /> Offline
                </span>
              )}
            </div>
            
            <button 
              onClick={() => fetchAlphaFeed(false)}
              disabled={isLoading && feed.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-ghost-bg border border-ghost-border hover:border-gold-500/50 hover:text-gold-400 transition-all text-xs font-bold tracking-widest rounded-md cursor-pointer disabled:opacity-50 w-full sm:w-auto shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading && feed.length === 0 ? 'animate-spin text-gold-500' : ''}`} />
              FORCE_SYNC
            </button>
          </div>
        </div>

        {/* Top Lanes (Tabs) */}
        <div className="flex flex-wrap gap-2 mb-4 font-sans">
          {LANE_CONFIG.map(lane => (
            <div key={lane.id} className="relative group">
              <button
                onClick={() => { 
                  setActiveLane(lane.id); 
                  setActiveTagFilter('ALL'); 
                }}
                className={`px-4 py-1.5 text-xs font-bold tracking-widest transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                  activeLane === lane.id 
                  ? 'border-gold-500 text-gold-400 bg-gold-500/10' 
                  : 'border-transparent text-muted hover:text-offwhite hover:bg-ghost-surface'
                }`}
              >
                {lane.label}
              </button>
              
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2.5 bg-ghost-bg border border-gold-500/30 text-muted text-[10px] leading-relaxed rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-[0_10px_30px_rgba(0,0,0,0.9)] text-center flex flex-col items-center gap-1.5 backdrop-blur-md">
                <Info className="w-3.5 h-3.5 text-gold-500" />
                {lane.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Command Bar (Filters & Sorting) */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-ghost-bg border border-ghost-border rounded-lg p-3 mb-6 relative z-40">
          
          <div className="relative group flex items-center">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-ghost-black border border-ghost-border hover:border-gold-500/50 rounded text-muted transition-all cursor-pointer">
              <Filter className={`w-4 h-4 ${activeTagFilter !== 'ALL' ? 'text-gold-500' : ''}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${activeTagFilter !== 'ALL' ? 'text-gold-500' : ''}`}>
                {activeTagFilter === 'ALL' ? 'FILTER TAGS' : activeTagFilter}
              </span>
            </button>
            
            <div className="absolute top-full left-0 mt-2 w-64 bg-ghost-bg border border-gold-500/30 rounded-md shadow-[0_10px_40px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 flex flex-col py-1 backdrop-blur-md">
              <button 
                onClick={() => setActiveTagFilter('ALL')}
                className={`text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider hover:bg-ghost-surface transition-colors ${
                  activeTagFilter === 'ALL' ? 'text-gold-500 bg-gold-500/5' : 'text-muted'
                }`}
              >
                ALL ARCHETYPES
              </button>
              {availableTags.map(tag => (
                <button 
                  key={tag}
                  onClick={() => setActiveTagFilter(tag)}
                  className={`text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider hover:bg-ghost-surface transition-colors ${
                    activeTagFilter === tag ? 'text-gold-500 bg-gold-500/5' : 'text-muted'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full xl:w-auto overflow-x-auto pb-1 xl:pb-0">
            <span className="text-[10px] text-muted uppercase tracking-widest shrink-0 font-sans font-bold">SORT BY:</span>
            <div className="flex bg-ghost-black border border-ghost-border rounded shrink-0">
              
              {/* SCORE */}
              <div className="relative group flex">
                <button 
                  onClick={() => handleSortClick('score')} 
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-r border-ghost-border ${
                    sortBy === 'score' ? 'bg-gold-500/20 text-gold-400' : 'text-muted hover:bg-ghost-surface'
                  }`}
                >
                  SCORE
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 p-2.5 bg-ghost-bg border border-gold-500/30 text-muted text-[10px] leading-relaxed rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center whitespace-normal font-sans backdrop-blur-md">
                  Ranks by the composite Ghost Score (Quality + Timing).
                </div>
              </div>

              {/* MCAP */}
              <div className="relative group flex">
                <button 
                  onClick={() => handleSortClick('mcap')} 
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-r border-ghost-border ${
                    sortBy === 'mcap' ? 'bg-gold-500/20 text-gold-400' : 'text-muted hover:bg-ghost-surface'
                  }`}
                >
                  MCAP
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-48 p-2.5 bg-ghost-bg border border-gold-500/30 text-muted text-[10px] leading-relaxed rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-center whitespace-normal font-sans backdrop-blur-md">
                  Total Market Capitalization in USD.
                </div>
              </div>

              {/* RETRACTABLE VOLUME */}
              <div className="relative group flex">
                <button 
                  onClick={() => handleSortClick('vol', volTf)} 
                  className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-r border-ghost-border ${
                    sortBy?.startsWith('vol') ? 'bg-gold-500/20 text-gold-400' : 'text-muted hover:bg-ghost-surface'
                  }`}
                >
                  VOL ({volTf}) <ChevronDown size={10} className="opacity-50"/>
                </button>
                
                <div className="absolute top-full left-0 mt-2 w-24 bg-ghost-bg border border-gold-500/30 rounded-md shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 flex flex-col py-1 backdrop-blur-md">
                  {['5m', '1h', '4h', '24h'].map(tf => (
                    <button 
                      key={tf}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setVolTf(tf); 
                        handleSortClick('vol', tf); 
                      }}
                      className={`text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-ghost-surface transition-colors ${
                        volTf === tf ? 'text-gold-500' : 'text-muted'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* RETRACTABLE GAIN % */}
              <div className="relative group flex">
                <button 
                  onClick={() => handleSortClick('delta', gainTf)} 
                  className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    sortBy?.startsWith('delta') ? 'bg-gold-500/20 text-gold-400' : 'text-muted hover:bg-ghost-surface'
                  }`}
                >
                  GAIN % ({gainTf}) <ChevronDown size={10} className="opacity-50"/>
                </button>
                
                <div className="absolute top-full right-0 mt-2 w-24 bg-ghost-bg border border-gold-500/30 rounded-md shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 flex flex-col py-1 backdrop-blur-md">
                  {['5m', '1h', '4h', '24h'].map(tf => (
                    <button 
                      key={tf}
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setGainTf(tf); 
                        handleSortClick('delta', tf); 
                      }}
                      className={`text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-ghost-surface transition-colors ${
                        gainTf === tf ? 'text-gold-500' : 'text-muted'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* DIRECTION TOGGLE */}
            <div className="relative group flex shrink-0">
              <button 
                onClick={() => setSortDesc(!sortDesc)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-ghost-black border border-ghost-border hover:border-gold-500/50 rounded transition-all text-muted hover:text-gold-400 cursor-pointer"
              >
                <ArrowUpDown className={`w-4 h-4 transition-transform duration-300 ${sortDesc ? '' : 'rotate-180'}`} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{sortDesc ? 'DESC' : 'ASC'}</span>
              </button>
              
              <div className="absolute top-full right-0 mt-2 w-56 p-3 bg-ghost-bg border border-gold-500/30 text-muted text-[10px] leading-relaxed rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-[0_10px_30px_rgba(0,0,0,0.9)] text-center font-sans backdrop-blur-md">
                <span className="text-gold-500 font-bold block mb-1">Sort Direction</span>
                Flips the display order. Defaults to composite Ghost Score if no metric is selected.
              </div>
            </div>
          </div>
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5 w-full items-start">
          
          {isLoading && feed.length === 0 ? (
            Array(6).fill(0).map((_, i) => <TokenCardSkeleton key={i} />)
          ) : (
            processedFeed.map(token => (
              <TokenCard 
                key={token.token_address} 
                token={token} 
                onSelect={() => setSelectedToken(token)} 
                activeVolTf={volTf}
                activeGainTf={gainTf}
              />
            ))
          )}
          
          {!isLoading && processedFeed.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted border border-dashed border-ghost-border rounded-lg flex flex-col items-center gap-3">
              <Activity className="w-6 h-6 text-ghost-border" />
              <span className="text-xs tracking-widest uppercase font-sans font-bold">
                NO TACTICAL SIGNALS DETECTED. RADAR IS SWEEPING.
              </span>
            </div>
          )}
        </div>
      </div>

      {selectedToken && (
        <TokenDetailModal 
          token={selectedToken} 
          onClose={() => setSelectedToken(null)} 
          activeVolTf={volTf}
          activeGainTf={gainTf}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// TOKEN CARD (Upgraded for Terminal UI)
// -----------------------------------------------------------------------------
function TokenCard({ token, onSelect, activeVolTf, activeGainTf }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const formatCompact = (num) => {
    if (!num) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 1
    }).format(Number(num));
  };

  const copyAddress = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(token.token_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const cleanTag = deriveSignalTag(token);
  const displayVol = Number(token[`volume_${activeVolTf}`]) || Number(token.volume_1h) || 0;
  const displayDelta = Number(token[`price_change_${activeGainTf}`]) || Number(token.price_change_1h) || 0;
  const isPositive = displayDelta >= 0;
  const dexMeta = getDexMeta(token.dex_id);

  const handleXRayRouting = (e) => {
    e.stopPropagation();
    navigate('/', { 
      state: { 
        autoAddress: token.token_address, 
        activeTab: 'xray',
        prefillData: {
          name: token.token_name, symbol: token.token_symbol, image_url: token.image_url,
          mcap_usd: token.mcap_usd, liquidity_usd: token.liquidity_usd
        }
      } 
    });
  };

  return (
    <div 
      onClick={onSelect} 
      className="bg-ghost-bg border border-ghost-border hover:border-gold-500/50 rounded-xl p-4 transition-all duration-300 group relative overflow-hidden cursor-pointer shadow-lg flex flex-col justify-between w-full min-w-0"
    >
      <div className="flex justify-between items-start mb-3 gap-3 w-full min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <TokenAvatar url={token.image_url} symbol={token.token_symbol} />
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <h3 className="text-sm font-bold text-offwhite font-sans truncate shrink-0 max-w-[100px]">
                {token.token_symbol}
              </h3>
              
              <span className={`text-[7px] font-bold px-1.5 py-0.5 border rounded shrink-0 uppercase tracking-widest font-sans ${dexMeta.style}`}>
                {dexMeta.name}
              </span>
              
              <span className="text-[7px] font-bold px-1.5 py-0.5 bg-gold-500/10 text-gold-400 border border-gold-500/30 rounded shrink-0 uppercase tracking-widest font-sans">
                {token.lane.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[10px] text-muted font-sans truncate w-full mt-0.5" title={token.token_name}>
              {token.token_name}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end shrink-0 bg-ghost-black px-2.5 py-1 rounded-md border border-ghost-border shadow-inner font-sans">
          <span className="text-[7px] text-muted tracking-widest mb-0.5 font-bold">SCORE</span>
          <span className={`text-base font-black leading-none tabular-nums ${
            token.rank_score >= 70 ? 'text-safe' : 
            token.rank_score >= 40 ? 'text-gold-400' : 'text-danger'
          }`}>
            {Number(token.rank_score || 0).toFixed(0)}
          </span>
        </div>
      </div>

      <div 
        onClick={copyAddress} 
        className="mb-3 bg-ghost-black hover:bg-ghost-surface border border-ghost-border hover:border-gold-500/40 rounded px-2.5 py-1.5 flex items-center justify-between w-full transition-all group/ca cursor-pointer overflow-hidden" 
        title="Click to copy Contract Address"
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <span className="text-[9px] font-bold text-gold-500 shrink-0 font-sans uppercase">CA:</span>
          <span className="text-[10px] text-muted truncate">{token.token_address}</span>
        </div>
        <span className="text-[9px] font-bold text-gold-400 shrink-0 flex items-center gap-1">
          {copied ? <Check className="w-3 h-3 text-safe" /> : <Copy className="w-3 h-3 text-muted group-hover/ca:text-gold-500" />}
        </span>
      </div>

      <div className="mb-3 min-h-[22px] flex items-center w-full min-w-0 font-sans">
        {cleanTag ? (
          <div className="relative group flex items-center max-w-full">
            <span className={`text-[8px] font-bold px-1.5 py-0.5 border rounded uppercase tracking-wider flex items-center gap-1.5 cursor-help truncate ${
              cleanTag === 'DEAD CONTRACT' ? 'bg-danger/10 text-danger border-danger/30' : 'bg-gold-500/10 text-gold-400 border-gold-500/30'
            }`}>
              <Zap className={`w-3 h-3 shrink-0 ${cleanTag === 'DEAD CONTRACT' ? 'text-danger' : 'text-gold-500'}`} />
              <span className="truncate">{cleanTag}</span>
            </span>
            <div className="absolute top-full left-0 mt-2 w-56 p-2.5 bg-ghost-bg border border-gold-500/30 text-muted text-[10px] leading-relaxed rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-[0_10px_30px_rgba(0,0,0,0.9)] whitespace-normal backdrop-blur-md">
              <span className="text-gold-500 font-bold block mb-1">What this means:</span>
              {getTooltipText(cleanTag, dexMeta.name)}
            </div>
          </div>
        ) : (
          <span className="text-[9px] text-muted italic uppercase tracking-wider truncate">Active telemetry scan</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 w-full font-sans">
        <div className="bg-ghost-black p-1.5 rounded border border-ghost-border flex flex-col gap-0.5 w-full min-w-0">
          <span className="text-[7px] text-muted uppercase tracking-wider font-bold truncate">Mkt Cap</span>
          <span className="text-[11px] font-mono font-bold text-offwhite truncate tabular-nums">
            {formatCompact(token.mcap_usd)}
          </span>
        </div>
        <div className="bg-ghost-black p-1.5 rounded border border-ghost-border flex flex-col gap-0.5 w-full min-w-0">
          <span className="text-[7px] text-muted uppercase tracking-wider font-bold truncate">Liquidity</span>
          <span className="text-[11px] font-mono font-bold text-safe truncate tabular-nums">
            {formatCompact(token.liquidity_usd)}
          </span>
        </div>
        <div className="bg-ghost-black p-1.5 rounded border border-ghost-border flex flex-col gap-0.5 w-full min-w-0">
          <span className="text-[7px] text-muted uppercase tracking-wider font-bold truncate">VOL ({activeVolTf})</span>
          <span className="text-[11px] font-mono font-bold text-gold-400 truncate tabular-nums">
            {formatCompact(displayVol)}
          </span>
        </div>
        <div className="bg-ghost-black p-1.5 rounded border border-ghost-border flex flex-col gap-0.5 w-full min-w-0">
          <span className="text-[7px] text-muted uppercase tracking-wider font-bold truncate">DELTA ({activeGainTf})</span>
          <span className={`text-[11px] font-mono font-bold flex items-center gap-1 truncate tabular-nums ${
            isPositive ? 'text-safe' : 'text-danger'
          }`}>
            {isPositive ? <TrendingUp className="w-2.5 h-2.5 shrink-0" /> : <TrendingDown className="w-2.5 h-2.5 shrink-0" />}
            {Math.abs(displayDelta).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-ghost-border w-full min-w-0 font-sans">
        <button 
          onClick={(e) => { e.stopPropagation(); navigate('/rugchecker', { state: { autoAddress: token.token_address } }); }} 
          className="flex items-center justify-center gap-1 py-2 px-1 bg-ghost-black hover:bg-ghost-surface border border-ghost-border hover:border-gold-500/40 text-muted hover:text-gold-400 text-[8px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer min-w-0"
        >
          <Shield className="w-3 h-3 text-gold-500 shrink-0" />
          <span className="truncate">RugCheck</span>
        </button>

        <button 
          onClick={handleXRayRouting} 
          className="flex items-center justify-center gap-1 py-2 px-1 bg-ghost-black hover:bg-ghost-surface border border-ghost-border hover:border-gold-500/40 text-muted hover:text-gold-400 text-[8px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer min-w-0"
        >
          <Search className="w-3 h-3 text-safe shrink-0" />
          <span className="truncate">X-Ray</span>
        </button>

        <a 
          href={`https://photon-sol.tinyastro.io/en/lp/${token.token_address}`} 
          target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} 
          className="flex items-center justify-center gap-1 py-2 px-1 bg-ghost-black hover:bg-safe/10 border border-ghost-border hover:border-safe/50 text-muted hover:text-safe text-[8px] font-bold uppercase tracking-wider rounded transition-all min-w-0"
        >
          <Crosshair className="w-3 h-3 text-safe shrink-0" />
          <span className="truncate">Photon</span>
        </a>

        <a 
          href={`https://jup.ag/swap/SOL-${token.token_address}`} 
          target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} 
          className="flex items-center justify-center gap-1 py-2 px-1 bg-ghost-black hover:bg-orange-950/30 border border-ghost-border hover:border-orange-500/50 text-muted hover:text-orange-400 text-[8px] font-bold uppercase tracking-wider rounded transition-all min-w-0"
        >
          <ExternalLink className="w-3 h-3 text-orange-400 shrink-0" />
          <span className="truncate">Jupiter</span>
        </a>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// TOKEN DETAIL MODAL CARD (Upgraded for Terminal UI)
// -----------------------------------------------------------------------------
function TokenDetailModal({ token, onClose, activeVolTf, activeGainTf }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const copyAddress = () => { navigator.clipboard.writeText(token.token_address); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  
  const formatUsd = (num) => { 
    if (!num) return '$0.00'; const val = Number(num); 
    if (val < 0.00001) return `$${val.toFixed(8)}`; if (val < 0.01) return `$${val.toFixed(6)}`; 
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val); 
  };
  const formatCompact = (num) => { 
    if (!num) return '$0'; return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 2 }).format(Number(num)); 
  };

  const cleanTag = deriveSignalTag(token);
  const dexMeta = getDexMeta(token.dex_id);
  const displayVol = Number(token[`volume_${activeVolTf}`]) || Number(token.volume_1h) || 0;
  const displayDelta = Number(token[`price_change_${activeGainTf}`]) || Number(token.price_change_1h) || 0;
  const isPositive = displayDelta >= 0;

  const handleXRayRouting = (e) => {
    e.stopPropagation(); onClose();
    navigate('/', { 
      state: { 
        autoAddress: token.token_address, activeTab: 'xray',
        prefillData: { name: token.token_name, symbol: token.token_symbol, image_url: token.image_url, mcap_usd: token.mcap_usd, liquidity_usd: token.liquidity_usd }
      } 
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-ghost-bg border border-gold-500/40 rounded-xl max-w-lg w-full p-6 shadow-[0_0_50px_rgba(0,0,0,0.95)] relative text-offwhite flex flex-col max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-gold-400 transition-colors p-1 bg-ghost-surface hover:bg-ghost-border rounded-full cursor-pointer">
          <X size={18} />
        </button>
        
        <div className="flex items-center gap-4 border-b border-ghost-border pb-5 mb-5 w-full min-w-0">
          <TokenAvatar url={token.image_url} symbol={token.token_symbol} />
          <div className="flex flex-col min-w-0 flex-1 font-sans">
            <div className="flex items-center gap-2.5 min-w-0 mb-1 flex-wrap">
              <h2 className="text-xl font-bold text-white tracking-wide truncate">{token.token_name}</h2>
              <span className={`text-[8px] px-1.5 py-0.5 border rounded font-black uppercase tracking-widest ${dexMeta.style}`}>
                {dexMeta.name}
              </span>
              <span className="text-[9px] px-2 py-0.5 bg-gold-500/15 text-gold-400 border border-gold-500/30 rounded shrink-0 uppercase tracking-widest font-bold">
                {token.lane.replace('_', ' ')}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-muted min-w-0">
              <span className="font-bold text-safe truncate max-w-[100px]">{token.token_symbol}</span>
              <span className="text-ghost-border">•</span>
              <span className="truncate text-[10px] tracking-wider uppercase font-bold tabular-nums">
                SCORE: <span className="text-gold-400">{Number(token.rank_score || 0).toFixed(1)}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="mb-6 bg-ghost-black border border-ghost-border rounded-md p-3 flex items-center justify-between w-full shadow-inner overflow-hidden font-sans">
          <div className="flex flex-col min-w-0 pr-3 flex-1">
            <span className="text-[8px] text-muted uppercase tracking-widest font-bold mb-0.5">Contract Address (Mint)</span>
            <span className="text-xs font-mono text-offwhite truncate select-all">{token.token_address}</span>
          </div>
          <button onClick={copyAddress} className="flex items-center gap-1.5 px-3 py-2 bg-ghost-bg hover:bg-ghost-surface border border-gold-500/30 text-[10px] font-bold uppercase tracking-wider text-gold-400 rounded transition-all shrink-0 cursor-pointer">
            {copied ? <Check className="w-3.5 h-3.5 text-safe" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 text-xs w-full font-sans">
          {[
            { label: 'PRICE', val: formatUsd(token.price_usd), color: 'text-offwhite' },
            { label: 'MARKET CAP', val: formatCompact(token.mcap_usd), color: 'text-safe' },
            { label: 'LIQUIDITY', val: formatCompact(token.liquidity_usd), color: 'text-blue-400' },
            { label: `VOL (${activeVolTf})`, val: formatCompact(displayVol), color: 'text-gold-400' },
            { label: '1H BUY RATIO', val: `${(Number(token.buy_ratio_1h || 0.5) * 100).toFixed(0)}%`, color: 'text-offwhite' },
            { label: `DELTA (${activeGainTf})`, val: `${isPositive ? '+' : ''}${Math.abs(displayDelta).toFixed(2)}%`, color: isPositive ? 'text-safe' : 'text-danger' }
          ].map((stat, i) => (
            <div key={i} className="bg-ghost-surface p-3.5 rounded-md border border-ghost-border flex flex-col gap-1 w-full min-w-0">
              <span className="text-[9px] text-muted uppercase tracking-widest font-bold truncate">{stat.label}</span>
              <span className={`font-mono font-bold truncate tabular-nums ${stat.color}`}>{stat.val}</span>
            </div>
          ))}
        </div>

        {cleanTag && (
          <div className={`mb-6 p-3 border rounded-md flex items-center justify-between text-xs w-full relative group cursor-help font-sans ${
            cleanTag === 'DEAD CONTRACT' ? 'bg-danger/5 border-danger/30' : 'bg-gold-500/5 border-gold-500/20'
          }`}>
            <span className="text-muted flex items-center gap-2 font-medium tracking-wide">
              <Shield className={`w-4 h-4 ${cleanTag === 'DEAD CONTRACT' ? 'text-danger' : 'text-gold-500'}`} /> Archetype:
            </span>
            <span className={`font-black uppercase tracking-wider truncate ${cleanTag === 'DEAD CONTRACT' ? 'text-danger' : 'text-gold-400'}`}>
              {cleanTag}
            </span>
            <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-ghost-bg border border-gold-500/30 text-muted text-[10px] leading-relaxed rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-[0_10px_30px_rgba(0,0,0,0.9)] text-right backdrop-blur-md">
              <span className="text-gold-500 font-bold block mb-1">What this means:</span>
              {getTooltipText(cleanTag, dexMeta.name)}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full mt-auto font-sans">
          <button onClick={() => { onClose(); navigate('/rugchecker', { state: { autoAddress: token.token_address } }); }} className="flex flex-col items-center justify-center gap-1 py-2.5 bg-ghost-black hover:bg-ghost-surface border border-ghost-border hover:border-gold-500/40 text-muted hover:text-gold-400 text-[9px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer min-w-0">
            <Shield className="w-4 h-4 text-gold-500" /> RugCheck
          </button>
          <button onClick={handleXRayRouting} className="flex flex-col items-center justify-center gap-1 py-2.5 bg-ghost-black hover:bg-ghost-surface border border-ghost-border hover:border-gold-500/40 text-muted hover:text-gold-400 text-[9px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer min-w-0">
            <Search className="w-4 h-4 text-safe" /> X-Ray Scan
          </button>
          <a href={`https://photon-sol.tinyastro.io/en/lp/${token.token_address}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-1 py-2.5 bg-ghost-black hover:bg-safe/10 border border-ghost-border hover:border-safe/50 text-muted hover:text-safe text-[9px] font-bold uppercase tracking-wider rounded transition-all min-w-0">
            <Crosshair className="w-4 h-4 text-safe" /> Photon
          </a>
          <a href={`https://jup.ag/swap/SOL-${token.token_address}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center gap-1.5 py-2.5 bg-ghost-black hover:bg-orange-950/30 border border-ghost-border hover:border-orange-500/50 text-muted hover:text-orange-400 text-[9px] font-bold uppercase tracking-wider rounded transition-all min-w-0">
            <ExternalLink className="w-4 h-4 text-orange-500" /> Jupiter
          </a>
        </div>
      </div>
    </div>
  );
}