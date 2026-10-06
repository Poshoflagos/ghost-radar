import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, Image as ImageIcon, Search, Copy, Check, Shield, 
  ExternalLink, Crosshair, AlertTriangle, Zap, Clock, TerminalSquare, 
  RefreshCw, X, ArrowUpDown, Filter, Sparkles, Layers, ShieldCheck, 
  Flame, HelpCircle, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// -----------------------------------------------------------------------------
// PLATFORM META FORMATTER
// -----------------------------------------------------------------------------
function getDexMeta(dexId) {
  const id = (dexId || 'PUMP.FUN').toUpperCase();
  if (id.includes('PUMP.FUN') || id === 'PUMP') return { name: 'PUMP.FUN', style: 'text-safe bg-safe/10 border-safe/30' };
  if (id.includes('MOONSHOT')) return { name: 'MOONSHOT', style: 'text-purple-400 bg-purple-400/10 border-purple-400/30' };
  if (id.includes('STONK')) return { name: 'STONK.FUN', style: 'text-orange-400 bg-orange-400/10 border-orange-400/30' };
  if (id.includes('RAYDIUM')) return { name: 'RAYDIUM', style: 'text-blue-400 bg-blue-400/10 border-blue-400/30' };
  if (id.includes('METEORA')) return { name: 'METEORA', style: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30' };
  return { name: id.substring(0, 10), style: 'text-muted bg-ghost-surface border-ghost-border' };
}

const LANE_CONFIG = [
  { id: 'ALL', label: 'ALL', desc: 'Omnichannel stream of all detected anomalies.' },
  { id: 'BLUECHIPS', label: 'BLUECHIPS', desc: 'Established protocols ($10M+ MC). Institutional volume.' },
  { id: 'MID_CAP', label: 'MID CAP', desc: 'Scaling tokens ($1M-$10M MC). Expansion setups.' },
  { id: 'LOW_CAP', label: 'LOW CAP', desc: 'High volatility ($100K-$1M MC). Rapid volume surges.' },
  { id: 'TRENCH', label: 'TRENCH', desc: 'Bonding curve migrations. Maximum volatility and risk.' }
];

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

  if (backendTag.includes('BONDING') && !isBonding) backendTag = ''; 
  if (isBonding) return `${dexMeta.name} BONDING ACTIVE`;
  if (mcap < 50000 && !isBonding) {
    if (delta1h < -10 || liq < 5000) return "DEAD CONTRACT";
    return "DISTRIBUTION BLEED";
  }
  if (backendTag) return backendTag;
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
  if (tag.includes('BONDING ACTIVE')) return `Token is actively trading on the ${dexName} curve. It has not reached public AMM liquidity yet.`;
  return TAG_EXPLANATIONS[tag] || TAG_EXPLANATIONS["ACTIVE TELEMETRY"];
}

// -----------------------------------------------------------------------------
// STRICTLY BOUNDED PFP COMPONENT
// -----------------------------------------------------------------------------
function TokenAvatar({ url, symbol, size = 42 }) {
  const [imgError, setImgError] = useState(false);

  const strictDimensions = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
    maxWidth: `${size}px`,
    maxHeight: `${size}px`
  };

  if (!url || imgError) {
    return (
      <div 
        style={strictDimensions}
        className="rounded-md border border-gold-500/30 bg-ghost-black flex items-center justify-center font-black text-[10px] text-gold-400 shrink-0 shadow-inner overflow-hidden font-sans"
      >
        {symbol?.slice(0, 3).toUpperCase() || '???'}
      </div>
    );
  }

  return (
    <div 
      style={strictDimensions} 
      className="shrink-0 rounded-md overflow-hidden border border-ghost-border bg-ghost-black shadow-sm flex items-center justify-center"
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

export default function GhostLens() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [inputUrl, setInputUrl] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [sortBy, setSortBy] = useState('age'); 
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [copiedAddress, setCopiedAddress] = useState(null);

  // ---------------------------------------------------------------------------
  // GLOBAL CLIPBOARD PASTE LISTENER 
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // ---------------------------------------------------------------------------
  // PROCESS LOCAL FILE
  // ---------------------------------------------------------------------------
  const handleImageFile = (file) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Invalid file type. Please upload a PNG, JPG, or WebP image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setPreviewImage(dataUrl);
      setInputUrl('');
      setErrorMsg('');
      executeLensScan(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // ---------------------------------------------------------------------------
  // PROCESS SUBMITTED URL OR MANUAL QUERY
  // ---------------------------------------------------------------------------
  const handleUrlSubmit = (e) => {
    e.preventDefault();
    const cleanUrl = inputUrl.trim();
    if (!cleanUrl) return;

    setPreviewImage(cleanUrl);
    setErrorMsg('');
    executeLensScan(cleanUrl);
  };

  // ---------------------------------------------------------------------------
  // EXECUTE GHOST LENS SCAN SEQUENCE
  // ---------------------------------------------------------------------------
  const executeLensScan = async (sourceImage) => {
    setScanning(true);
    setResults(null);
    setErrorMsg('');

    try {
      setScanStep('Computing multi-signature fingerprint (dHash + pHash + color)...');
      await new Promise(r => setTimeout(r, 600));

      setScanStep('Comparing against the live Ghost Lens index...');
      await new Promise(r => setTimeout(r, 800));

      setScanStep('Indexing block timestamps & chronological genesis hierarchy...');
      await new Promise(r => setTimeout(r, 600));

     const res = await fetch('https://site--ghost-radar--26zc8pyqkn62.code.run/api/ghost-lens/scan', {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: sourceImage })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Scan failed.');
      setResults(data);
    } catch (err) {
      console.error('Ghost Lens Scan Error:', err);
      setErrorMsg(err instanceof TypeError
        ? 'Ghost Lens engine is offline. Start the radar-engine server.'
        : err.message);
    } finally {
      setScanning(false);
      setScanStep('');
    }
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

  const clearScan = () => {
    setPreviewImage(null);
    setInputUrl('');
    setResults(null);
    setErrorMsg('');
  };

  const processedTokens = results?.tokens ? [...results.tokens]
    .filter(t => platformFilter === 'ALL' || t.dex_id.toUpperCase().includes(platformFilter))
    .sort((a, b) => {
      if (sortBy === 'age') return new Date(a.deployed_at) - new Date(b.deployed_at);
      if (sortBy === 'mcap') return b.mcap_usd - a.mcap_usd;
      if (sortBy === 'similarity') return b.similarity - a.similarity;
      return 0;
    }) : [];

  const genesisToken = results?.tokens?.find(t => t.is_genesis);

  // ---------------------------------------------------------------------------
  // MAIN UI RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="h-full bg-transparent text-offwhite font-sans p-4 pt-28 sm:p-6 lg:p-8 lg:pt-28 selection:bg-gold-500/20 selection:text-gold-400 overflow-x-hidden">
      
      <div className="max-w-[1600px] mx-auto mb-8 w-full min-w-0">
        {/* HEADER COMMAND STRIP */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-ghost-border pb-4 mb-6 gap-4 min-w-0 w-full">
          <div className="min-w-0 flex-1 w-full">
            <h1 className="text-3xl sm:text-4xl text-gold-500 tracking-wider drop-shadow-[0_0_12px_rgba(212,175,55,0.6)] flex items-center gap-3 truncate font-halloween">
              <TerminalSquare className="text-gold-500 w-8 h-8 shrink-0" />
              GHOST LENS X-RAY
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-2 flex items-center gap-2 truncate font-sans">
              <Sparkles className="w-4 h-4 text-safe shrink-0" />
              <span className="border-b border-dashed border-muted/50 hover:text-offwhite transition-colors pb-0.5 truncate">
                Image-to-CA Reverse Vector Discovery Engine
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] text-muted uppercase tracking-wider bg-ghost-bg px-3 py-1.5 border border-ghost-border rounded shadow-sm font-sans font-bold">
              Input mode: <strong className="text-safe">Ctrl+V / Drag / URL</strong>
            </span>
          </div>
        </div>

        {/* UNIVERSAL INPUT BAY */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 w-full min-w-0">
          
          {/* DRAG & DROP / PASTE ZONE */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`lg:col-span-7 bg-ghost-bg border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 relative group overflow-hidden ${
              isDragging ? 'border-gold-500 bg-gold-500/5 scale-[1.01]' : 'border-ghost-border hover:border-gold-500/50 shadow-sm'
            }`}
            style={{ minHeight: '180px' }}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => e.target.files?.[0] && handleImageFile(e.target.files[0])} 
              accept="image/*" 
              className="hidden" 
            />

            {previewImage ? (
              <div className="flex items-center gap-4 w-full max-w-md bg-ghost-black p-3 rounded-lg border border-ghost-border relative z-10 shadow-md min-w-0" onClick={(e) => e.stopPropagation()}>
                <TokenAvatar url={previewImage} symbol="TRGT" size={64} />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-xs font-bold text-offwhite truncate flex items-center gap-1.5 min-w-0 font-sans">
                    <ShieldCheck className="w-3.5 h-3.5 text-safe shrink-0" /> Target Cached
                  </span>
                  <p className="text-[10px] text-muted mt-0.5 truncate font-sans">Ready for perceptual hash comparison</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3 font-sans">
                    <button 
                      onClick={() => executeLensScan(previewImage)}
                      disabled={scanning}
                      className="px-3 py-1 bg-ghost-bg border border-gold-500/40 hover:border-gold-500 hover:bg-gold-500/10 text-gold-400 font-bold text-[9px] uppercase tracking-widest rounded transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      {scanning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                      {scanning ? 'Scanning...' : 'Re-Scan'}
                    </button>
                    <button 
                      onClick={clearScan}
                      className="px-2.5 py-1 bg-ghost-bg border border-danger/50 hover:border-danger hover:bg-danger/10 text-danger text-[9px] font-bold uppercase tracking-widest rounded transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" /> Clear
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-ghost-black border border-ghost-border group-hover:border-gold-500/40 flex items-center justify-center transition-all shadow-inner">
                  <UploadCloud className="w-5 h-5 text-muted group-hover:text-gold-500 transition-colors" />
                </div>
                <div className="text-center px-4 w-full min-w-0 font-sans">
                  <span className="text-xs font-bold text-offwhite tracking-wide block truncate">
                    Drop Image, Click, or Press <kbd className="bg-ghost-surface border border-ghost-border px-1.5 py-0.5 rounded text-[10px] text-gold-500 ml-1 font-mono">Ctrl+V</kbd>
                  </span>
                  <p className="text-[9px] text-muted mt-1.5 uppercase tracking-widest truncate font-bold">Matches against the live Ghost Lens index.</p>
                </div>
              </>
            )}
          </div>

          {/* URL & KEYWORD SEARCH BAY */}
          <div className="lg:col-span-5 bg-ghost-bg border border-ghost-border rounded-xl p-5 flex flex-col justify-between shadow-sm min-w-0 font-sans">
            <div>
              <span className="text-[10px] font-bold text-offwhite uppercase tracking-widest block mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-gold-500" /> Remote URL Hash
              </span>
              <p className="text-[10px] text-muted mb-4 leading-relaxed font-bold">Paste an image link from X, Telegram, or DexScreener to run a deep forensic visual scan.</p>
              
              <form onSubmit={handleUrlSubmit} className="flex flex-col gap-3">
                <input 
                  type="text" 
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://pbs.twimg.com/media/...jpg" 
                  className="w-full bg-ghost-black border border-ghost-border focus:border-gold-500/50 rounded-lg px-3 py-2 text-xs text-offwhite outline-none transition-all font-mono shadow-inner min-w-0"
                />
                <button 
                  type="submit"
                  disabled={!inputUrl.trim() || scanning}
                  className="w-full py-2 bg-ghost-black border border-gold-500/30 hover:border-gold-500 hover:bg-gold-500/10 text-gold-400 text-[10px] font-bold tracking-widest uppercase rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  <Search className="w-3.5 h-3.5" />
                  Analyze URL
                </button>
              </form>
            </div>

            <div className="mt-4 pt-3 border-t border-ghost-border flex flex-wrap items-center justify-between text-[9px] uppercase tracking-widest text-muted font-bold gap-2 min-w-0">
              <span className="truncate">Hash: <strong>dHash + pHash Matrix</strong></span>
              <span className="text-safe truncate">Zero-Loss Sync</span>
            </div>
          </div>
        </div>

        {/* SCANNING RADAR OVERLAY */}
        {scanning && (
          <div className="bg-ghost-bg border border-gold-500/30 rounded-xl p-6 mb-8 flex flex-col items-center justify-center gap-3 animate-pulse shadow-md w-full min-w-0 font-sans">
            <Activity className="w-6 h-6 text-gold-500 animate-spin" />
            <span className="text-[10px] font-bold text-gold-400 tracking-widest uppercase text-center w-full truncate">Executing Forensic Match</span>
            <p className="text-[9px] text-muted font-mono text-center w-full truncate">{scanStep}</p>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 mb-6 bg-danger/10 border border-danger/30 text-danger text-xs font-mono font-bold rounded-lg flex items-center gap-2 w-full min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}

        {/* RESULTS DOSSIER */}
        {results && !scanning && (
          <div className="flex flex-col gap-6 w-full min-w-0">
            
            {/* SCAN SUMMARY BANNER */}
            <div className="bg-ghost-bg border border-gold-500/20 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 w-full min-w-0 shadow-sm font-sans">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-lg border border-gold-500/30 bg-ghost-black flex items-center justify-center shrink-0 shadow-inner">
                  <Flame className="w-5 h-5 text-gold-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-offwhite uppercase tracking-wider truncate">
                    Found {results.totalMatches} Tokens With Matching Visual Fingerprints
                  </h3>
                  <p className="text-[10px] text-muted font-bold tracking-wider truncate mt-0.5 tabular-nums">
                    Cross-referenced against {results.totalScanned.toLocaleString()} recent launchpad signatures
                  </p>
                </div>
              </div>

              {/* SORT & FILTER TOOLBAR */}
              <div className="flex items-center gap-3 flex-wrap shrink-0">
                <div className="flex items-center gap-2 bg-ghost-black border border-ghost-border rounded px-2.5 py-1.5 text-xs shadow-inner">
                  <Filter className="w-3 h-3 text-muted" />
                  <select 
                    value={platformFilter} 
                    onChange={(e) => setPlatformFilter(e.target.value)}
                    className="bg-transparent text-muted text-[9px] outline-none uppercase font-bold tracking-wider cursor-pointer"
                  >
                    <option value="ALL">All DEXs</option>
                    <option value="PUMP">Pump.fun</option>
                    <option value="MOONSHOT">Moonshot</option>
                    <option value="STONK">Stonk.fun</option>
                    <option value="RAYDIUM">Raydium</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-ghost-black border border-ghost-border rounded px-2.5 py-1.5 text-xs shadow-inner">
                  <ArrowUpDown className="w-3 h-3 text-muted" />
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-transparent text-muted text-[9px] outline-none uppercase font-bold tracking-wider cursor-pointer"
                  >
                    <option value="age">Genesis (Oldest)</option>
                    <option value="mcap">Market Cap</option>
                    <option value="similarity">Match %</option>
                  </select>
                </div>
              </div>
            </div>

            {/* GENESIS HIGHLIGHT CARD (Unaffected by grid size, spans full width safely) */}
            {genesisToken && (
              <div className="bg-ghost-black border border-gold-500/50 rounded-xl p-5 shadow-[0_0_20px_rgba(212,175,55,0.1)] relative overflow-hidden w-full min-w-0 font-sans">
                <div className="absolute top-0 right-0 bg-gold-500/10 border-b border-l border-gold-500/40 text-gold-400 font-black text-[8px] uppercase tracking-widest px-3 py-1 rounded-bl">
                  True Genesis Deployer
                </div>

                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 border-b border-ghost-border pb-4 mb-4 min-w-0">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <TokenAvatar url={genesisToken.image_url} symbol={genesisToken.token_symbol} size={56} />
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap mb-1">
                        <h2 className="text-lg font-black text-offwhite truncate">{genesisToken.token_name}</h2>
                        <span className="text-[10px] text-safe font-bold truncate">${genesisToken.token_symbol}</span>
                        <span className={`text-[7px] font-bold px-1.5 py-0.5 border rounded uppercase shrink-0 ${getDexMeta(genesisToken.dex_id).style}`}>
                          {genesisToken.dex_id}
                        </span>
                      </div>
                      <p className="text-[9px] text-muted mt-1 flex flex-wrap items-center gap-2 min-w-0">
                        <span className="truncate max-w-[150px] font-bold tracking-wider">Deployer: <strong className="text-offwhite font-mono">{genesisToken.deployer}</strong></span>
                        <span className="text-ghost-border hidden sm:inline">•</span>
                        <span className="text-gold-400 font-bold truncate tracking-wider tabular-nums">First Seen: {new Date(genesisToken.deployed_at).toLocaleTimeString()}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 bg-ghost-bg p-2.5 rounded border border-ghost-border">
                    <div className="text-right">
                      <span className="text-[7px] text-muted uppercase tracking-widest block font-bold mb-0.5">Market Cap</span>
                      <span className="text-sm font-black text-offwhite font-mono tabular-nums">{formatCompact(genesisToken.mcap_usd)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[7px] text-muted uppercase tracking-widest block font-bold mb-0.5">Liquidity</span>
                      <span className="text-sm font-black text-safe font-mono tabular-nums">{formatCompact(genesisToken.liquidity_usd)}</span>
                    </div>
                    <div className="text-right border-l border-ghost-border pl-4">
                      <span className="text-[7px] text-muted uppercase tracking-widest block font-bold mb-0.5">Ghost Score</span>
                      <span className="text-sm font-black text-gold-500 font-mono tabular-nums">{genesisToken.ghost_score}</span>
                    </div>
                  </div>
                </div>

                {/* ACTION BAR */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 w-full min-w-0">
                  <div 
                    onClick={(e) => copyAddress(genesisToken.token_address, e)}
                    className="bg-ghost-bg hover:bg-ghost-surface border border-ghost-border rounded px-2.5 py-2 flex items-center gap-2 cursor-pointer transition-all min-w-0 max-w-full group"
                  >
                    <span className="text-[9px] text-gold-500 font-bold shrink-0 uppercase tracking-widest">CA:</span>
                    <span className="text-[10px] text-muted group-hover:text-gold-500 font-mono truncate transition-colors">{genesisToken.token_address}</span>
                    <div className="shrink-0 ml-1">
                      {copiedAddress === genesisToken.token_address ? <Check className="w-3.5 h-3.5 text-safe" /> : <Copy className="w-3.5 h-3.5 text-muted group-hover:text-gold-500" />}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                    <button 
                      onClick={() => navigate('/', { state: { autoAddress: genesisToken.token_address, activeTab: 'xray' } })}
                      className="px-3 py-2 bg-ghost-bg hover:bg-gold-500/10 border border-ghost-border hover:border-gold-500/50 text-[9px] uppercase tracking-widest font-bold text-gold-400 rounded transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Search className="w-3 h-3 text-safe" /> X-Ray
                    </button>
                    <button 
                      onClick={() => navigate('/rugchecker', { state: { autoAddress: genesisToken.token_address } })}
                      className="px-3 py-2 bg-ghost-bg hover:bg-gold-500/10 border border-ghost-border hover:border-gold-500/50 text-[9px] uppercase tracking-widest font-bold text-muted hover:text-offwhite rounded transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <Shield className="w-3 h-3 text-gold-500" /> Audit
                    </button>
                    <a 
                      href={`https://photon-sol.tinyastro.io/en/lp/${genesisToken.token_address}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-ghost-bg hover:bg-safe/10 border border-ghost-border hover:border-safe/50 text-[9px] uppercase tracking-widest font-bold text-muted hover:text-safe rounded transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <Crosshair className="w-3 h-3 text-safe" /> Photon
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* FULL DERIVATIVE MATRIX - STRICT 3 COLUMNS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5 w-full min-w-0 items-start font-sans">
              {processedTokens.map((token) => (
                <div 
                  key={token.token_address}
                  className={`bg-ghost-black border rounded-xl flex flex-col justify-between w-full min-w-0 relative overflow-hidden transition-colors ${
                    token.is_genesis ? 'border-gold-500/40 shadow-lg shadow-gold-500/5' : 'border-ghost-border hover:border-gold-500/30 shadow-md'
                  }`}
                >
                  {/* ABSOLUTE SIMILARITY BADGE */}
                  <div className="absolute top-0 right-0 z-10">
                    <div className={`px-2 py-1 text-[8px] font-black uppercase tracking-widest rounded-bl-lg border-b border-l ${
                      token.similarity >= 95 ? 'bg-gold-500/10 border-gold-500/30 text-gold-400' : 'bg-ghost-surface border-ghost-border text-muted'
                    }`}>
                      {token.similarity}% MATCH
                    </div>
                  </div>

                  {/* Header */}
                  <div className="flex justify-between items-start p-3.5 border-b border-ghost-border w-full min-w-0 bg-ghost-bg">
                     <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <TokenAvatar url={token.image_url} symbol={token.token_symbol} size={42} />
                        <div className="flex flex-col min-w-0 flex-1 pr-16">
                           <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                             <span className="text-offwhite font-bold text-[13px] truncate shrink-0 max-w-[100px]">{token.token_name}</span>
                           </div>
                           <div className="flex items-center gap-1.5 mt-1 min-w-0">
                             <span className="text-[10px] text-safe font-bold truncate">${token.token_symbol}</span>
                             <span className={`text-[6px] font-bold px-1 py-0.5 border rounded-sm uppercase shrink-0 ${getDexMeta(token.dex_id).style}`}>{token.dex_id}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Time Offset Strip */}
                  <div className="bg-ghost-black border-b border-ghost-border px-3 py-1.5 flex items-center justify-between w-full min-w-0">
                    <span className="text-[8px] text-muted uppercase tracking-widest font-bold">Timeline:</span>
                    <span className={`text-[9px] font-bold truncate max-w-[150px] ${token.is_genesis ? 'text-gold-500' : 'text-muted'}`}>
                      {token.time_offset}
                    </span>
                  </div>

                  {/* CA Bar */}
                  <div className="p-3 bg-ghost-bg w-full min-w-0">
                    <div 
                      onClick={(e) => copyAddress(token.token_address, e)}
                      className="bg-ghost-black hover:bg-ghost-surface border border-ghost-border rounded px-2 py-1.5 flex items-center justify-between w-full min-w-0 cursor-pointer transition-colors group/ca"
                    >
                      <span className="text-[9px] font-bold text-gold-500 shrink-0 mr-1.5 uppercase tracking-widest">CA:</span>
                      <span className="font-mono text-muted group-hover/ca:text-gold-500 truncate transition-colors text-[9px]">{token.token_address}</span>
                      <div className="shrink-0 ml-1.5">
                        {copiedAddress === token.token_address ? <Check className="w-3 h-3 text-safe" /> : <Copy className="w-3 h-3 text-muted" />}
                      </div>
                    </div>
                  </div>

                  {/* Stats Matrix */}
                  <div className="grid grid-cols-3 w-full min-w-0 bg-ghost-black border-t border-b border-ghost-border">
                    <div className="p-2 border-r border-ghost-border flex flex-col items-center justify-center text-center min-w-0">
                      <span className="text-[7px] text-muted uppercase tracking-widest font-bold mb-0.5">MCAP</span>
                      <span className="text-[11px] font-black text-offwhite font-mono tabular-nums truncate w-full">{formatCompact(token.mcap_usd)}</span>
                    </div>
                    <div className="p-2 border-r border-ghost-border flex flex-col items-center justify-center text-center min-w-0">
                      <span className="text-[7px] text-muted uppercase tracking-widest font-bold mb-0.5">LIQ</span>
                      <span className="text-[11px] font-black text-safe font-mono tabular-nums truncate w-full">{formatCompact(token.liquidity_usd)}</span>
                    </div>
                    <div className="p-2 flex flex-col items-center justify-center text-center min-w-0">
                      <span className="text-[7px] text-muted uppercase tracking-widest font-bold mb-0.5">SCORE</span>
                      <span className="text-[11px] font-black text-gold-500 font-mono tabular-nums truncate w-full">{token.ghost_score}</span>
                    </div>
                  </div>

                  {/* Action Strip */}
                  <div className="grid grid-cols-3 w-full min-w-0 bg-ghost-bg">
                    <button 
                      onClick={() => navigate('/', { state: { autoAddress: token.token_address, activeTab: 'xray' } })}
                      className="py-2.5 px-1 border-r border-ghost-border hover:bg-gold-500/10 text-[8px] font-bold uppercase tracking-widest text-muted hover:text-gold-400 transition-colors truncate min-w-0 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Search size={10} className="text-gold-500 shrink-0 hidden sm:block" /> X-Ray
                    </button>
                    <button 
                      onClick={() => navigate('/rugchecker', { state: { autoAddress: token.token_address } })}
                      className="py-2.5 px-1 border-r border-ghost-border hover:bg-gold-500/10 text-[8px] font-bold uppercase tracking-widest text-muted hover:text-gold-400 transition-colors truncate min-w-0 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Shield size={10} className="text-gold-500 shrink-0 hidden sm:block" /> Audit
                    </button>
                    <a 
                      href={`https://photon-sol.tinyastro.io/en/lp/${token.token_address}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="py-2.5 px-1 hover:bg-safe/10 text-[8px] font-bold uppercase tracking-widest text-muted hover:text-safe transition-colors truncate min-w-0 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Crosshair size={10} className="text-safe shrink-0 hidden sm:block" /> Trade
                    </a>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}