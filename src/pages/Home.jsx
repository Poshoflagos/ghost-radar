// src/pages/Home.jsx
import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { forceSimulation, forceCollide, forceX, forceY, forceManyBody } from 'd3-force';
import { LayoutGrid, List, X, Copy, ExternalLink, ShieldCheck, ShieldAlert, Shield, Crosshair, Activity } from 'lucide-react';
import { AppContext } from '../AppContext';
import TokenReportCard from '../components/TokenReportCard';
import GemBox from '../components/GemBox';
import WalletLeaderboard from '../components/WalletLeaderboard'; 
import GhostScoreTool from '../components/GhostScoreTool';
import GhostMatrix from '../components/GhostMatrix'; 
import GhostTooltip from "../components/GhostTooltip";
import { getCardScale } from '../utils/bubbleScale';

const TIMEFRAMES = [
  { id: '15m', label: '15M' }, { id: '1h', label: '1H' }, { id: '4h', label: '4H' },
  { id: '24h', label: '1D' }, { id: '7d', label: '1W' }, { id: '30d', label: '1M' }
];

function passesRugFilter(token) {
  const audit = token.audit || {};
  if (audit.isSus) return false;
  if (audit.mintAuthorityDisabled !== true) return false;
  if (audit.freezeAuthorityDisabled !== true) return false;
  if (token.organicScoreLabel === 'low') return false;
  if (!token.liquidityUsd || token.liquidityUsd < 5000) return false;
  return true;
}

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { rugFilterOn } = useContext(AppContext);
  
  const [timeframe, setTimeframe] = useState('24h');
  const [activePage, setActivePage] = useState('radar'); 
  const [glanceMenu, setGlanceMenu] = useState('tokens');
  const [viewMode, setViewMode] = useState('bubbles');
  
  const [selectedToken, setSelectedToken] = useState(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 }); 
  const [copied, setCopied] = useState(false);
  
  const [tokens, setTokens] = useState([]);
  const [wsStatus, setWsStatus] = useState('INITIALIZING...');
  const [macroTokens, setMacroTokens] = useState([]);
  const [isFetchingMacro, setIsFetchingMacro] = useState(false);

  const bubbleContainerRef = useRef(null);
  const [bubbleAreaHeight, setBubbleAreaHeight] = useState(500);
  const [bubbleAreaWidth, setBubbleAreaWidth] = useState(800);

  useEffect(() => {
    if (location.state?.activeTab === 'xray') {
      setActivePage('xray');
    }
  }, [location.state]);

  const handleCopyCA = (e, address) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTokenClick = (e, token) => {
    e.stopPropagation();
    let x = e.clientX + 15;
    let y = e.clientY - 40;
    
    if (x + 340 > window.innerWidth) x = e.clientX - 340 - 15;
    if (y + 340 > window.innerHeight) y = window.innerHeight - 350;
    if (y < 20) y = 20;

    setPopupPosition({ x, y });
    setSelectedToken(token);
  };

  useEffect(() => {
    if (activePage === 'radar') {
      setIsFetchingMacro(true);
      const fetchGainers = async () => {
        try {
          const urls = [
            'https://lite-api.jup.ag/tokens/v2/toptrending/5m?limit=100',
            'https://lite-api.jup.ag/tokens/v2/toptrending/1h?limit=100',
            'https://lite-api.jup.ag/tokens/v2/toptrending/6h?limit=100',
            'https://lite-api.jup.ag/tokens/v2/toptrending/24h?limit=100',
            'https://lite-api.jup.ag/tokens/v2/recent'
          ];
          const responses = await Promise.all(urls.map(url => fetch(url).then(r => r.json()).catch(() => [])));
          let allTokens = [];
          responses.forEach(res => { if (Array.isArray(res)) allTokens.push(...res); });

          const seen = new Set();
          const uniqueTokens = allTokens.filter(t => {
            if (!t.id || seen.has(t.id)) return false;
            seen.add(t.id);
            return true;
          });

          const formatted = uniqueTokens.map(t => ({
            id: t.id, contract: t.id, name: t.name || 'Unknown', symbol: t.symbol || '???', logo: t.icon || '',
            volatility: { '15m': t.stats5m?.priceChange ?? 0, '1h': t.stats1h?.priceChange ?? 0, '4h': t.stats6h?.priceChange ?? 0, '24h': t.stats24h?.priceChange ?? 0, '7d': 0, '30d': 0 },
            market: { price: t.usdPrice != null ? `$${t.usdPrice.toFixed(6)}` : 'PENDING', marketCap: t.mcap != null ? `$${(t.mcap / 1000000).toFixed(1)}M` : 'PENDING', volume24h: t.stats24h?.buyVolume != null ? `$${((t.stats24h.buyVolume + t.stats24h.sellVolume) / 1000).toFixed(1)}K` : 'PENDING', liquidity: t.liquidity != null ? `$${(t.liquidity / 1000).toFixed(1)}K` : 'PENDING' },
            intelligence: { lifecycle: "EXPANSION", thesis: "SOLANA POOL", walletConvergence: "ESTABLISHED", liquidityQuality: "LOCKED" },
            risk: { creator: "NORMAL", cluster: "LOW", concentration: "MODERATE" },
            bondingCurve: { isGraduated: true, progress: 100, poolType: "SOLANA", postGraduationDump: 0, postDumpRebound: 0 },
            audit: t.audit || {}, organicScore: t.organicScore ?? 0, organicScoreLabel: t.organicScoreLabel || 'low', isVerified: t.isVerified || false, liquidityUsd: t.liquidity ?? 0
          })).filter(t => t.contract);

          setMacroTokens(formatted);
          setIsFetchingMacro(false);
        } catch (err) {
          console.error("Jupiter fetch failed:", err);
          setIsFetchingMacro(false);
        }
      };
      fetchGainers();
    }
  }, [activePage]);

  const displayedTokens = useMemo(() => {
    return macroTokens
      .filter(token => {
        const val = token.volatility?.[timeframe];
        return val !== undefined && val !== null && !isNaN(val) && val > 0;
      })
      .filter(token => !rugFilterOn || passesRugFilter(token))
      .sort((a, b) => (b.volatility?.[timeframe] || 0) - (a.volatility?.[timeframe] || 0))
      .slice(0, 100);
  }, [macroTokens, timeframe, rugFilterOn]);

  useEffect(() => {
    if (glanceMenu !== 'tokens' || activePage !== 'radar') return;
    const updateDimensions = () => {
      if (!bubbleContainerRef.current) return;
      const top = bubbleContainerRef.current.getBoundingClientRect().top;
      setBubbleAreaHeight(Math.max(400, window.innerHeight - top - 40));
      setBubbleAreaWidth(bubbleContainerRef.current.clientWidth || 800);
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [activePage, glanceMenu, viewMode]);

  const packedBubbles = useMemo(() => {
    if (displayedTokens.length === 0 || bubbleAreaWidth === 0 || bubbleAreaHeight === 0 || viewMode === 'list') return [];

    const scales = displayedTokens.map(token => getCardScale(Math.abs(token.volatility?.[timeframe] || 0)));
    const sumScale2 = scales.reduce((sum, s) => sum + s * s, 0);
    const areaBudget = bubbleAreaWidth * bubbleAreaHeight * 0.55;
    const k = Math.sqrt(areaBudget / (Math.PI * sumScale2));

    const nodes = displayedTokens.map((token, i) => ({
      token,
      r: Math.max(25, scales[i] * k),
      x: bubbleAreaWidth / 2 + (Math.random() - 0.5) * bubbleAreaWidth * 0.5,
      y: bubbleAreaHeight / 2 + (Math.random() - 0.5) * bubbleAreaHeight * 0.5
    }));

    const simulation = forceSimulation(nodes)
      .force('collide', forceCollide(d => d.r + 4).iterations(4))
      .force('charge', forceManyBody().strength(-15))
      .force('x', forceX(bubbleAreaWidth / 2).strength(0.01))
      .force('y', forceY(bubbleAreaHeight / 2).strength(0.01))
      .stop();

    for (let i = 0; i < 300; i++) {
      simulation.tick();
      nodes.forEach(n => {
        n.x = Math.max(n.r, Math.min(bubbleAreaWidth - n.r, n.x));
        n.y = Math.max(n.r, Math.min(bubbleAreaHeight - n.r, n.y));
      });
    }

    return nodes.map(n => ({ token: n.token, x: n.x, y: n.y, r: n.r }));
  }, [displayedTokens, timeframe, bubbleAreaWidth, bubbleAreaHeight, viewMode]);

  return (
    <div className="flex-1 flex flex-col pt-6 px-4 md:px-8 w-full relative h-full bg-transparent max-w-[1600px] mx-auto text-offwhite font-sans selection:bg-gold-500/20 selection:text-gold-400">
      
      {/* PRO HEADER */}
      <header className="w-full flex justify-between items-end border-b border-ghost-border pb-4 mb-4 shrink-0">
          <div>
              <h1 className="text-2xl font-bold text-gold-500 tracking-widest uppercase drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] flex items-center gap-3 font-halloween">
                  <Crosshair size={24} className="text-gold-500" />
                  Terminal <span className="text-muted font-sans font-light">| Macro View</span>
              </h1>
              <p className="text-[10px] font-mono text-muted uppercase tracking-[0.3em] mt-2 ml-9">
                  Live Liquidity Surface & Wallet Forensics
              </p>
          </div>

          <button
              onClick={() => navigate('/rugchecker')}
              className="group flex items-center gap-3 bg-ghost-bg border border-ghost-border hover:border-gold-500 hover:bg-gold-500/10 transition-all rounded-lg px-4 py-2 shadow-lg cursor-pointer"
          >
              <div className="bg-gold-500/10 p-1.5 rounded text-gold-500 group-hover:scale-110 transition-transform">
                  <Shield size={14} />
              </div>
              <div className="flex flex-col items-start hidden sm:flex font-mono">
                  <span className="text-offwhite text-[10px] font-bold uppercase tracking-widest leading-tight">GR RugChecker</span>
                  <span className="text-muted text-[8px] uppercase tracking-widest leading-tight">Verify Contracts</span>
              </div>
          </button>
      </header>

      {/* UNIFIED COMMAND STRIP */}
      <div className="w-full bg-ghost-black border border-ghost-border rounded-xl p-2 flex flex-wrap xl:flex-nowrap justify-between items-center gap-4 shadow-xl mb-6 shrink-0 z-20 relative font-sans">
          
          <div className="flex bg-ghost-bg rounded-lg border border-ghost-border p-1 w-full sm:w-auto overflow-x-auto hide-scrollbar">
              <button 
                  onClick={() => setActivePage('radar')} 
                  className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-200 whitespace-nowrap cursor-pointer ${activePage === 'radar' ? 'bg-gold-500/15 text-gold-500 shadow-[0_0_10px_rgba(212,175,55,0.2)]' : 'text-muted hover:text-offwhite hover:bg-ghost-surface'}`}
              >
                  Bubble Glance
              </button>
              <button 
                  onClick={() => setActivePage('curve')} 
                  className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-200 whitespace-nowrap cursor-pointer ${activePage === 'curve' ? 'bg-gold-500/15 text-gold-500 shadow-[0_0_10px_rgba(212,175,55,0.2)]' : 'text-muted hover:text-offwhite hover:bg-ghost-surface'}`}
              >
                  Ghost Matrix
              </button>
              <button 
                  onClick={() => setActivePage('alpha')} 
                  className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-200 whitespace-nowrap cursor-pointer ${activePage === 'alpha' ? 'bg-gold-500/15 text-gold-500 shadow-[0_0_10px_rgba(212,175,55,0.2)]' : 'text-muted hover:text-offwhite hover:bg-ghost-surface'}`}
              >
                  GemBox Alpha
              </button>
              <button 
                  onClick={() => setActivePage('xray')} 
                  className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-200 whitespace-nowrap cursor-pointer ${activePage === 'xray' ? 'bg-gold-500/15 text-gold-500 shadow-[0_0_10px_rgba(212,175,55,0.2)]' : 'text-muted hover:text-offwhite hover:bg-ghost-surface'}`}
              >
                  Ghost Score X-Ray
              </button>
          </div>

          {activePage === 'radar' && (
              <>
                  <div className="flex bg-ghost-bg rounded-lg border border-ghost-border p-1 w-full sm:w-auto overflow-x-auto hide-scrollbar">
                      <button 
                          onClick={() => setGlanceMenu('tokens')} 
                          className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-200 whitespace-nowrap cursor-pointer ${glanceMenu === 'tokens' ? 'bg-gold-500/15 text-gold-500' : 'text-muted hover:text-offwhite hover:bg-ghost-surface'}`}
                      >
                          Top 100 Gainers
                      </button>
                      <button 
                          onClick={() => setGlanceMenu('wallets48')} 
                          className={`px-4 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase transition-all duration-200 whitespace-nowrap cursor-pointer ${glanceMenu === 'wallets48' ? 'bg-gold-500/15 text-gold-500' : 'text-muted hover:text-offwhite hover:bg-ghost-surface'}`}
                      >
                          Top 50 Wallets (24H)
                      </button>
                      
                  </div>

                  {glanceMenu === 'tokens' && (
                      <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
                          <div className="flex bg-ghost-bg rounded-lg border border-ghost-border p-1 overflow-x-auto hide-scrollbar">
                              {TIMEFRAMES.map((tf) => (
                                  <button 
                                      key={tf.id} 
                                      onClick={() => setTimeframe(tf.id)} 
                                      className={`px-3 py-1.5 rounded-md text-[9px] font-bold tracking-widest transition-all duration-200 whitespace-nowrap cursor-pointer ${timeframe === tf.id ? 'bg-gold-500/15 text-gold-500' : 'text-muted hover:text-offwhite hover:bg-ghost-surface'}`}
                                  >
                                      {tf.label}
                                  </button>
                              ))}
                          </div>
                          <div className="flex bg-ghost-bg rounded-lg border border-ghost-border p-1 shrink-0">
                              <button onClick={() => setViewMode('bubbles')} className={`p-1.5 rounded transition-colors cursor-pointer ${viewMode === 'bubbles' ? 'bg-gold-500/15 text-gold-500' : 'text-muted hover:text-offwhite hover:bg-ghost-surface'}`}><LayoutGrid size={14} /></button>
                              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-gold-500/15 text-gold-500' : 'text-muted hover:text-offwhite hover:bg-ghost-surface'}`}><List size={14} /></button>
                          </div>
                      </div>
                  )}
              </>
          )}
      </div>

      {/* MAIN CONTENT DYNAMIC AREA */}
      {activePage === 'radar' && (
        <div className="w-full flex-1 flex flex-col items-center animate-[fadeIn_0.5s_ease-out] min-h-0">
          
          {glanceMenu === 'tokens' ? (
            <div ref={bubbleContainerRef} className="relative w-full flex-1 overflow-hidden rounded-2xl border border-ghost-border bg-ghost-black/80 shadow-inner" style={{ height: `${bubbleAreaHeight}px`, minHeight: '400px' }}>
              {isFetchingMacro ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <Crosshair className="w-8 h-8 text-gold-500 animate-[spin_3s_linear_infinite]" />
                  <span className="text-[10px] text-gold-500 font-mono tracking-widest uppercase animate-pulse">Scanning Live Solana Liquidity...</span>
                </div>
              ) : displayedTokens.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                  <Activity className="w-6 h-6 text-ghost-border" />
                  <span className="text-xs text-muted font-bold tracking-widest uppercase">No active token data for this timeframe.</span>
                </div>
              ) : viewMode === 'bubbles' ? (
                packedBubbles.map(({ token, x, y, r }) => (
                  <div key={token.id} style={{ position: 'absolute', left: x - r, top: y - r, width: r * 2, height: r * 2 }} onDoubleClick={(e) => handleTokenClick(e, token)} className="cursor-pointer hover:scale-105 transition-transform z-10 hover:z-20">
                    <TokenReportCard token={token} timeframe={timeframe} size={r * 2} left={0} top={0} onDoubleClick={(e) => handleTokenClick(e, token)} />
                  </div>
                ))
              ) : (
                <div className="w-full h-full overflow-auto p-4 custom-scrollbar">
                  <table className="w-full text-left font-sans border-collapse table-fixed">
                    <thead>
                      <tr className="bg-ghost-surface border-b border-ghost-border">
                        <th className="py-4 px-6 text-[9px] text-muted font-bold uppercase tracking-[0.2em] w-[20%]">Token</th>
                        <th className="py-4 px-6 text-[9px] text-muted font-bold uppercase tracking-[0.2em] text-right w-[20%]">Price</th>
                        <th className="py-4 px-6 text-[9px] text-muted font-bold uppercase tracking-[0.2em] text-right w-[20%]">Gain ({timeframe})</th>
                        <th className="py-4 px-6 text-[9px] text-muted font-bold uppercase tracking-[0.2em] text-right w-[20%]">Liquidity</th>
                        <th className="py-4 px-6 text-[9px] text-muted font-bold uppercase tracking-[0.2em] text-right w-[20%]">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ghost-border">
                      {displayedTokens.map((t) => (
                        <tr key={t.id} onClick={(e) => handleTokenClick(e, t)} className="hover:bg-ghost-surface/50 transition-colors cursor-pointer group">
                          <td className="py-4 px-6 text-sm text-offwhite font-bold truncate">{t.symbol}</td>
                          <td className="py-4 px-6 text-right text-xs text-muted font-mono tabular-nums">{t.market.price}</td>
                          <td className="py-4 px-6 text-right text-sm text-safe font-mono font-bold tabular-nums">+{t.volatility[timeframe].toFixed(2)}%</td>
                          <td className="py-4 px-6 text-right text-xs text-muted font-mono tabular-nums">{t.market.liquidity}</td>
                          <td className="py-4 px-6 text-right text-xs">
                            <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${t.organicScoreLabel === 'low' || t.isSus ? 'bg-danger/10 text-danger' : 'bg-safe/10 text-safe'}`}>
                              {t.organicScoreLabel === 'low' ? 'WASH' : 'CLEAN'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full max-w-[1200px] px-4 md:px-8 pb-32">
              <WalletLeaderboard timeframe={glanceMenu === 'wallets48' ? '48h' : '7d'} />
            </div>
          )}
        </div>
      )}

      {/* Embedded Tools */}
      {activePage === 'curve' && (
        <div className="w-full flex-1"><GhostMatrix /></div>
      )}
      {activePage === 'alpha' && (
        <div className="w-full max-w-[1200px] mx-auto pb-32"><GemBox /></div>
      )}
      {activePage === 'xray' && (
        <div className="w-full max-w-[800px] mx-auto pb-32"><GhostScoreTool autoAddress={location.state?.autoAddress} /></div>
      )}

      {/* CONTEXTUAL POPOVER TERMINAL (Upgraded to match AlphaZone) */}
      {selectedToken && (
        <div className="fixed inset-0 z-[100]" onClick={() => setSelectedToken(null)}>
          <div className="absolute inset-0 bg-ghost-black/80 backdrop-blur-sm transition-opacity"></div>
          
          <div 
            className="fixed bg-ghost-bg border border-gold-500/40 rounded-2xl p-5 w-[340px] shadow-[0_0_50px_rgba(0,0,0,0.95)] animate-[fadeIn_0.15s_ease-out] font-sans"
            style={{ left: `${popupPosition.x}px`, top: `${popupPosition.y}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setSelectedToken(null)} className="absolute top-4 right-4 text-muted hover:text-gold-400 transition-colors bg-ghost-surface hover:bg-ghost-border rounded-full p-1.5 cursor-pointer z-10">
              <X size={14} />
            </button>
            
            <div className="flex items-center gap-4 mb-5 border-b border-ghost-border pb-4 pr-6">
              <div className="rounded-full border border-gold-500/50 bg-ghost-black flex items-center justify-center overflow-hidden shrink-0" style={{ width: '56px', height: '56px' }}>
                {selectedToken.logo ? (
                  <img src={selectedToken.logo} alt={selectedToken.symbol} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                ) : null}
                <span className="text-gold-500 font-bold text-sm" style={{ display: selectedToken.logo ? 'none' : 'block' }}>
                  {selectedToken.symbol?.substring(0, 3).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col justify-center overflow-hidden">
                <h3 className="text-base font-bold text-offwhite tracking-wide truncate max-w-[170px]">{selectedToken.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-gold-400 text-[9px] font-bold bg-gold-500/10 px-2 py-0.5 rounded border border-gold-500/30 truncate max-w-[80px]">
                    ${selectedToken.symbol}
                  </span>
                  <span className={`flex items-center gap-1 font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded border ${selectedToken.organicScoreLabel !== 'low' && !selectedToken.isSus ? 'bg-safe/10 text-safe border-safe/30' : 'bg-danger/10 text-danger border-danger/30'}`}>
                    {selectedToken.organicScoreLabel !== 'low' && !selectedToken.isSus ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                    {selectedToken.organicScoreLabel !== 'low' && !selectedToken.isSus ? 'Safe' : 'Risk'}
                  </span>
                </div>
              </div>
            </div>

            <div onClick={(e) => handleCopyCA(e, selectedToken.contract)} className="bg-ghost-black border border-ghost-border hover:border-gold-500/40 transition-colors rounded-lg p-3 flex justify-between items-center mb-5 cursor-pointer group shadow-inner" title="Copy Address to Clipboard">
              <div className="flex flex-col overflow-hidden">
                <span className="text-[8px] font-bold text-muted uppercase tracking-widest mb-0.5">Contract Address</span>
                <span className="font-mono text-xs text-offwhite truncate pr-4">{selectedToken.contract}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {copied && <span className="text-safe text-[10px] uppercase font-bold animate-pulse">Copied!</span>}
                <Copy size={14} className="text-muted group-hover:text-gold-500 transition-colors" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-5">
              <div className="bg-ghost-surface p-3 rounded-lg border border-ghost-border flex flex-col justify-center">
                <span className="font-bold text-[8px] text-muted uppercase tracking-widest mb-1">Price</span>
                <span className="font-mono text-offwhite text-xs font-bold truncate tabular-nums">{selectedToken.market.price}</span>
              </div>
              <div className="bg-ghost-surface p-3 rounded-lg border border-ghost-border flex flex-col justify-center">
                <span className="font-bold text-[8px] text-muted uppercase tracking-widest mb-1">Gain ({timeframe})</span>
                <span className={`font-mono text-xs font-bold tabular-nums ${selectedToken.volatility?.[timeframe] >= 0 ? 'text-safe' : 'text-danger'}`}>
                  {selectedToken.volatility?.[timeframe] > 0 ? '+' : ''}{(selectedToken.volatility?.[timeframe] || 0).toFixed(2)}%
                </span>
              </div>
              <div className="bg-ghost-surface p-3 rounded-lg border border-ghost-border flex flex-col justify-center">
                <span className="font-bold text-[8px] text-muted uppercase tracking-widest mb-1">Liquidity</span>
                <span className="font-mono text-blue-400 text-xs font-bold truncate tabular-nums">{selectedToken.market.liquidity}</span>
              </div>
              <div className="bg-ghost-surface p-3 rounded-lg border border-ghost-border flex flex-col justify-center">
                <span className="font-bold text-[8px] text-muted uppercase tracking-widest mb-1">Organic Score</span>
                <span className="font-mono text-offwhite text-xs font-bold tabular-nums">{Math.round(selectedToken.organicScore || 0)}/100</span>
              </div>
            </div>

            <button onClick={() => navigate(`/token/${selectedToken.contract}`, { state: { token: selectedToken } })} className="w-full py-3 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/40 rounded-lg text-gold-400 font-bold text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 transition-all cursor-pointer">
              <ExternalLink size={14} /> Open Full Terminal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}