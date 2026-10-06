import React, { useState, useEffect } from 'react';
import { 
    Target, Search, ShieldAlert, Zap, AlertTriangle, ShieldCheck, 
    Activity, Info, TerminalSquare, Skull, Users, Wallet, PieChart, 
    Network, CheckCircle2, ChevronRight, Fingerprint
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

// -----------------------------------------------------------------------------
// REUSABLE UI COMPONENTS
// -----------------------------------------------------------------------------

// Tooltip for basic metric rows
const MetricRow = ({ label, value, tooltip, highlight, isDanger }) => (
    <div className="flex justify-between items-center text-[11px] relative group py-1.5 border-b border-[#222]/50 last:border-0">
        <div className="flex items-center gap-1.5 cursor-help">
            <span className="text-[#A0A099] tracking-wide">{label}</span>
            <Info size={10} className="text-[#555] group-hover:text-[#D4AF37] transition-colors" />
        </div>
        <span className={`font-mono font-bold px-2 py-0.5 rounded-sm ${
            isDanger ? 'bg-red-500/10 text-red-400' : 
            highlight ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 
            'text-[#F4F4F0]'
        }`}>
            {value}
        </span>
        
        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-52 bg-[#050505] border border-[#333] text-[#A0A099] text-[10px] p-3 rounded-lg z-50 shadow-[0_10px_40px_rgba(0,0,0,0.8)] pointer-events-none leading-relaxed font-sans tracking-wide">
            {tooltip}
        </div>
    </div>
);

// Layman Tooltip specifically for headers and complex data points
const LaymanTooltip = ({ label, explanation, icon: Icon }) => (
    <div className="relative group flex items-center gap-1.5 cursor-help w-fit">
        {Icon && <Icon size={10} className="text-[#666] group-hover:text-[#D4AF37] transition-colors" />}
        <span className="text-[9px] text-[#666] uppercase tracking-widest font-bold group-hover:text-[#D4AF37] transition-colors">{label}</span>
        <Info size={10} className="text-[#444] group-hover:text-[#D4AF37] transition-colors" />
        
        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-60 bg-[#050505] border border-[#D4AF37]/30 text-[#C0C0C0] text-[10px] p-3 rounded-lg z-50 shadow-[0_10px_40px_rgba(0,0,0,0.9)] pointer-events-none leading-relaxed font-sans normal-case tracking-wide">
            <span className="block text-[#D4AF37] font-bold mb-1 uppercase tracking-widest text-[9px]">What this means:</span>
            {explanation}
        </div>
    </div>
);

export default function GhostScoreTool({ autoAddress, prefillData }) {
    const location = useLocation();
    
    const initialAddress = autoAddress || location.state?.autoAddress;
    const activePrefill = prefillData || location.state?.prefillData;

    const [address, setAddress] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (initialAddress) {
            setAddress(initialAddress);
            executeScan(initialAddress);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialAddress]);

    const executeScan = async (targetAddress) => {
        const cleanAddress = targetAddress.trim().replace(/\s+/g, '');
        
        if (cleanAddress.length < 32 || cleanAddress.length > 44) {
            setErrorMsg('Invalid CA format.');
            return;
        }

        setLoading(true);
        setErrorMsg('');
        setResult(null);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const res = await fetch(`https://site--ghost-radar--26zc8pyqkn62.code.run/api/ghost-score/${encodeURIComponent(cleanAddress)}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            const data = await res.json();

            if (data.success) {
                setResult(data);
            } else {
                setErrorMsg(data.error || 'Analysis failed.');
            }
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                setErrorMsg('Request Timed Out: Backend is not responding.');
            } else {
                setErrorMsg('Engine Offline: Check backend terminal for crashes.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleScan = (e) => {
        e.preventDefault();
        executeScan(address);
    };

    const getBadgeStyle = (rating) => {
        if (['PRIME', 'ENTER'].includes(rating)) return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        if (rating === 'ENTER_SMALL') return 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20';
        if (rating === 'WATCH') return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
        if (['EXTENDED', 'WAIT'].includes(rating)) return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
        if (rating === 'AVOID') return 'bg-red-500/10 text-red-400 border border-red-500/20';
        return 'bg-[#111] text-[#888] border border-[#333]';
    };

    let displayData = result;
    if (!result && loading && activePrefill) {
        displayData = {
            isPlaceholder: true,
            token: {
                symbol: activePrefill.symbol || 'UNKNOWN',
                name: activePrefill.name || 'Unknown Token',
                mcap: activePrefill.mcap_usd || 0,
                liquidity: activePrefill.liquidity_usd || 0,
                image: activePrefill.image_url || null
            },
            scores: { composite: '...', safety: '...', opportunity: '...', velocity: '...', smartMoney: '...', contractHealth: '...' },
            analysis: { 
                verdict: 'SCANNING ON-CHAIN DATA...', 
                status: 'warning', 
                feedback: 'Executing Ghost heuristics, structural contract analysis, and wallet forensics...',
                entryRating: 'ANALYZING'
            },
            telemetrySignals: {
                isZombieRevival: false,
                zombieDormancyDays: '...',
                cabalRisk: { isFlagged: false, top10ControlledPct: '...' },
                cabalForensics: {
                    isCabal: false,
                    threatLevel: 'ANALYZING',
                    top10SharePct: 0.0,
                    controlledSupplyPct: 0.0,
                    clusterCount: 0,
                    equalSplitDetected: false,
                    bundledSupplyPct: 0.0,
                    insiderCount: 0,
                    insiderSupplyPct: 0.0,
                    flaggedReasons: ['Scanning holder graph...'],
                    verdict: 'Graph Analysis in progress...'
                },
                smartMoneyConvergence: { trackedWalletsCount: '...', avgHistoricalWinRate: '...' }
            },
            gates: []
        };
    }

    const telemetry = displayData?.telemetrySignals || {};
    const forensics = telemetry.cabalForensics || {
        isCabal: Boolean(telemetry.cabalRisk?.isFlagged),
        threatLevel: telemetry.cabalRisk?.isFlagged ? 'CRITICAL' : 'CLEAN',
        top10SharePct: Number(telemetry.cabalRisk?.top10ControlledPct || 0.0),
        controlledSupplyPct: Number(telemetry.cabalRisk?.top10ControlledPct || 0.0),
        clusterCount: 0,
        equalSplitDetected: false,
        bundledSupplyPct: 0.0,
        insiderCount: 0,
        insiderSupplyPct: 0.0,
        flaggedReasons: [],
        verdict: telemetry.cabalRisk?.isFlagged ? 'Cabal supply concentration detected in top holders.' : 'Organic supply dispersal confirmed.'
    };

    return (
        <div className="w-full flex flex-col gap-4 font-sans text-[#A0A099]">
            
            {/* Header & Command Input */}
            <div className="w-full bg-[#050505]/80 backdrop-blur-md border border-[#333]/60 rounded-2xl p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent"></div>
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-[#D4AF37]/10 rounded-xl border border-[#D4AF37]/20 shadow-[0_0_15px_rgba(212,175,55,0.15)]">
                        <Target size={20} className="text-[#D4AF37]" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-[#F4F4F0] tracking-wide font-mono">X-RAY TERMINAL</h2>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#666] font-bold mt-0.5">Institutional Diagnostics</p>
                    </div>
                </div>

                <form onSubmit={handleScan} className="flex gap-2 flex-1 max-w-lg w-full">
                    <div className="relative flex-1 group">
                        <Fingerprint size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] group-focus-within:text-[#D4AF37] transition-colors" />
                        <input 
                            type="text" 
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Target Contract Address..." 
                            className="w-full bg-[#0A0A0A] border border-[#222] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#F4F4F0] font-mono outline-none focus:border-[#D4AF37]/50 focus:bg-[#0F0F0F] transition-all shadow-inner"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading || !address.trim()}
                        className="bg-[#D4AF37] hover:bg-[#F0D775] text-black font-black px-6 rounded-xl uppercase text-[10px] tracking-widest flex items-center transition-all disabled:opacity-50 cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                    >
                        {loading ? <Activity size={16} className="animate-spin" /> : 'Execute'}
                    </button>
                </form>
            </div>

            {errorMsg && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-red-400 text-xs flex items-center gap-3 backdrop-blur-sm font-mono">
                    <AlertTriangle size={16} /> <span className="tracking-wide">{errorMsg}</span>
                </div>
            )}

            {/* Main Forensic Dossier */}
            {displayData && (
                <div className={`w-full flex flex-col gap-4 transition-opacity duration-300 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    
                    {/* Token Identity & Ghost Score Banner */}
                    <div className="w-full bg-[#050505] border border-[#222] rounded-2xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
                        
                        <div className="flex items-center gap-5 z-10">
                            {/* FIXED PFP CONTAINER: Strict inline sizing to prevent blowouts */}
                            <div 
                                style={{ width: '60px', height: '60px', minWidth: '60px', minHeight: '60px', flexShrink: 0 }} 
                                className="rounded-full border-2 border-[#111] bg-[#0A0A0A] overflow-hidden flex items-center justify-center shadow-lg"
                            >
                                {displayData.token.image ? 
                                    <img 
                                        src={displayData.token.image} 
                                        alt={displayData.token.symbol} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    /> : 
                                    <span className="text-[#D4AF37] text-xl font-black font-mono tracking-tighter">
                                        {displayData.token.symbol?.substring(0,2)}
                                    </span>
                                }
                            </div>
                            <div className="flex flex-col gap-1">
                                <h3 className="text-2xl font-black text-[#F4F4F0] tracking-tight">{displayData.token.symbol}</h3>
                                <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider font-mono flex-wrap">
                                    <span className="text-[#777]">{displayData.token.name}</span>
                                    <span className="text-[#333]">•</span>
                                    <span className="text-[#A0A099]">MC: <span className="text-[#F4F4F0]">${(displayData.token.mcap / 1000).toFixed(1)}K</span></span>
                                    <span className="text-[#333]">•</span>
                                    <span className="text-[#A0A099]">LIQ: <span className="text-[#D4AF37]">${(displayData.token.liquidity / 1000).toFixed(1)}K</span></span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="text-left md:text-right z-10 w-full md:w-auto p-4 md:p-0 bg-[#0A0A0A] md:bg-transparent rounded-xl border md:border-0 border-[#222]">
                            <LaymanTooltip 
                                label="Composite Ghost Score" 
                                explanation="The final safety and opportunity score (0-100). It measures if the token is structurally safe, while checking if the buying volume is actually real. Scores are heavily penalized if insider manipulation is found." 
                            />
                            <div className="flex items-baseline justify-start md:justify-end gap-1 font-mono mt-1">
                                <span className={`text-4xl font-black tracking-tighter drop-shadow-md ${
                                    displayData.isPlaceholder ? 'text-[#333]' :
                                    displayData.scores.composite === 0 || forensics.isCabal ? 'text-red-500 opacity-90 relative' : 
                                    displayData.scores.composite >= 60 ? 'text-emerald-400' : 'text-[#D4AF37]'
                                }`}>
                                    {displayData.scores.composite ?? 0}
                                    {/* Slashed strike-through effect for zeroed scores */}
                                    {(displayData.scores.composite === 0 || forensics.isCabal) && !displayData.isPlaceholder && (
                                        <div className="absolute top-1/2 left-0 w-full h-1 bg-red-500/50 -rotate-6 transform -translate-y-1/2"></div>
                                    )}
                                </span>
                                <span className="text-sm font-bold text-[#555]">/100</span>
                            </div>
                        </div>
                    </div>

                    {/* DYNAMIC SIGNAL BANNERS */}
                    {(telemetry.isZombieRevival || forensics.isCabal || telemetry.smartMoneyConvergence?.trackedWalletsCount > 0) && (
                        <div className="flex flex-wrap gap-3">
                            {telemetry.isZombieRevival && (
                                <div className="flex-1 min-w-[250px] bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3 relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50"></div>
                                    <Skull size={18} className="text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-0.5">Zombie Revival</span>
                                        <span className="text-[11px] text-[#A0A099] leading-tight block">Dormant for {telemetry.zombieDormancyDays} days. Suspected CTO.</span>
                                    </div>
                                </div>
                            )}
                            
                            {forensics.isCabal && (
                                <div className="flex-1 min-w-[250px] bg-red-500/5 border border-red-500/20 rounded-xl p-3.5 flex items-start gap-3 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50"></div>
                                    <ShieldAlert size={18} className="text-red-400 shrink-0 mt-0.5 animate-pulse" />
                                    <div>
                                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest block mb-0.5">Cabal Trap Detected</span>
                                        <span className="text-[11px] text-[#A0A099] leading-tight block">Extreme exit-liquidity threat. Score slashed.</span>
                                    </div>
                                </div>
                            )}

                            {telemetry.smartMoneyConvergence?.trackedWalletsCount > 0 && (
                                <div className="flex-1 min-w-[250px] bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5 flex items-start gap-3 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
                                    <Wallet size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-0.5">Alpha Convergence</span>
                                        <span className="text-[11px] text-[#A0A099] leading-tight block">{telemetry.smartMoneyConvergence.trackedWalletsCount} tracked institutional wallets entered.</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* DEDICATED CABAL & CLUSTER FORENSICS TERMINAL */}
                    <div className={`w-full rounded-2xl p-5 border backdrop-blur-sm transition-all shadow-lg ${
                        forensics.threatLevel === 'CRITICAL' ? 'bg-red-950/5 border-red-500/30' :
                        forensics.threatLevel === 'ELEVATED' ? 'bg-amber-950/5 border-amber-500/30' :
                        'bg-emerald-950/5 border-emerald-500/20'
                    }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#ffffff10] gap-3">
                            <div className="flex items-center gap-2.5">
                                <Network size={18} className={
                                    forensics.threatLevel === 'CRITICAL' ? 'text-red-400' :
                                    forensics.threatLevel === 'ELEVATED' ? 'text-amber-400' :
                                    'text-emerald-400'
                                } />
                                <span className="text-xs font-black text-[#F4F4F0] tracking-[0.15em] uppercase font-mono">
                                    Graph Forensics <span className="text-[#666] font-normal tracking-wide">| Jito & Clusters</span>
                                </span>
                            </div>

                            <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                forensics.threatLevel === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                forensics.threatLevel === 'ELEVATED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                                {forensics.threatLevel === 'CRITICAL' ? 'CABAL DETECTED' :
                                 forensics.threatLevel === 'ELEVATED' ? 'ELEVATED RISK' :
                                 'CLEAN DISPERSAL'}
                            </span>
                        </div>

                        {/* 4-Stat Graph Breakdown with Layman Tooltips */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                            <div className="flex flex-col gap-1">
                                <LaymanTooltip 
                                    label="Top 10 Supply" 
                                    explanation="The percentage of all tokens held by the top 10 largest wallets (excluding the liquidity pool). High numbers mean a few people can crash the price at any moment." 
                                />
                                <div className="flex items-baseline gap-2 mt-1.5">
                                    <span className={`text-xl font-black font-mono ${forensics.top10SharePct > 20.0 ? 'text-red-400' : 'text-[#F4F4F0]'}`}>
                                        {forensics.top10SharePct.toFixed(1)}%
                                    </span>
                                    <span className="text-[9px] font-mono text-[#555] uppercase">Max 20%</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 border-l border-[#ffffff08] pl-4">
                                <LaymanTooltip 
                                    label="Bundle Footprint" 
                                    explanation="Tokens bought by 'sniper' bots in the exact same second the coin launched. High percentages indicate the developer artificially bought up the supply before retail traders could." 
                                />
                                <div className="flex items-baseline gap-2 mt-1.5">
                                    <span className={`text-xl font-black font-mono ${forensics.equalSplitDetected ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {forensics.equalSplitDetected ? `${forensics.bundledSupplyPct.toFixed(1)}%` : '0.0%'}
                                    </span>
                                    <span className="text-[9px] font-mono text-[#555] uppercase">Jito Split</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 border-l border-[#ffffff08] pl-4">
                                <LaymanTooltip 
                                    label="Coordinated Nodes" 
                                    explanation="The number of distinct wallets that bought exact equal amounts of the token. This strongly reveals they are actually controlled by a single person attempting to hide their balance." 
                                />
                                <div className="flex items-baseline gap-2 mt-1.5">
                                    <span className={`text-xl font-black font-mono ${forensics.clusterCount >= 3 ? 'text-amber-400' : 'text-[#F4F4F0]'}`}>
                                        {forensics.clusterCount}
                                    </span>
                                    <span className="text-[9px] font-mono text-[#555] uppercase">Wallets</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 border-l border-[#ffffff08] pl-4">
                                <LaymanTooltip 
                                    label="Insider Network" 
                                    explanation="Percentage of the supply held by wallets flagged by RugCheck as known scammers, serial ruggers, or developer-linked insiders." 
                                />
                                <div className="flex items-baseline gap-2 mt-1.5">
                                    <span className={`text-xl font-black font-mono ${forensics.insiderCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {forensics.insiderSupplyPct.toFixed(1)}%
                                    </span>
                                    <span className="text-[9px] font-mono text-[#555] uppercase">{forensics.insiderCount} Nodes</span>
                                </div>
                            </div>
                        </div>

                        {/* Plain English Forensic Narrative */}
                        <div className={`border-l-2 p-3.5 text-[11px] leading-relaxed font-mono ${
                            forensics.threatLevel === 'CRITICAL' ? 'border-red-500/50 bg-red-500/5 text-[#F4F4F0]' : 
                            forensics.threatLevel === 'ELEVATED' ? 'border-amber-500/50 bg-amber-500/5 text-[#F4F4F0]' : 
                            'border-emerald-500/50 bg-emerald-500/5 text-[#A0A099]'
                        }`}>
                            <span className="font-bold opacity-80 block mb-1 uppercase tracking-widest text-[9px]">Topological Verdict</span>
                            {forensics.verdict}
                            {forensics.flaggedReasons && forensics.flaggedReasons.length > 0 && (
                                <ul className="mt-2 space-y-1 opacity-80">
                                    {forensics.flaggedReasons.map((r, i) => (
                                        <li key={i} className="flex items-start gap-1.5"><ChevronRight size={12} className="shrink-0 mt-0.5"/> {r}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* 2-Column Core Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Sub-Score Diagnostics (Col 1) */}
                        <div className="flex flex-col gap-4">
                            <div className="bg-[#050505] border border-[#222] rounded-2xl p-5 shadow-sm">
                                <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#111]">
                                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#F4F4F0] font-mono">
                                        <ShieldCheck size={14} className="text-[#D4AF37]"/> Safety Profile
                                    </span>
                                    <span className="text-lg font-black font-mono text-[#D4AF37]">{displayData.scores.safety ?? 0}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <MetricRow 
                                        label="Survival Multiplier (S)" 
                                        value={`${displayData.scores.safety ?? 0}/100`} 
                                        tooltip="Penalty-based score evaluating the developer's history of rug-pulling and how much supply they currently control."
                                    />
                                    <MetricRow 
                                        label="Contract Health" 
                                        value={displayData.analysis?.contractHealth || 'UNKNOWN'} 
                                        highlight={displayData.analysis?.contractHealth === 'PASSED'}
                                        isDanger={displayData.analysis?.contractHealth === 'FLAGGED'}
                                        tooltip="Checks if the contract is structurally safe. 'Passed' means the developer cannot mint new tokens, freeze your wallet, or steal the liquidity pool."
                                    />
                                </div>
                            </div>

                            <div className="bg-[#050505] border border-[#222] rounded-2xl p-5 shadow-sm">
                                <div className="flex justify-between items-center mb-4 pb-3 border-b border-[#111]">
                                    <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-[#F4F4F0] font-mono">
                                        <Zap size={14} className="text-emerald-400"/> Opportunity Profile
                                    </span>
                                    <span className="text-lg font-black font-mono text-emerald-400">{displayData.scores.opportunity ?? 0}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <MetricRow 
                                        label="Velocity Quality" 
                                        value={`${displayData.scores.velocity ?? 0}/100`} 
                                        tooltip="Measures if the buying volume is real. It penalizes 'wash trading' where bots buy and sell rapidly to fake high volume."
                                    />
                                    <MetricRow 
                                        label="Smart Confluence" 
                                        value={`${displayData.scores.smartMoney ?? 0}/100`} 
                                        tooltip="Scores how much conviction highly profitable wallets (Smart Money) are showing by measuring the size and age of their buys."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Analysis & Kill Switches (Col 2) */}
                        <div className="flex flex-col gap-4 h-full">
                            
                            {/* Diagnostic Review Block */}
                            <div className={`border rounded-2xl p-5 flex flex-col justify-center shadow-sm ${
                                displayData.analysis.status === 'danger' ? 'bg-red-950/5 border-red-500/30' : 
                                displayData.analysis.status === 'warning' ? 'bg-[#D4AF37]/5 border-[#D4AF37]/30' : 
                                'bg-emerald-950/5 border-emerald-500/20'
                            }`}>
                                <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#ffffff10]">
                                    <div className="flex items-center gap-2">
                                        <TerminalSquare size={14} className={
                                            displayData.analysis.status === 'danger' ? 'text-red-400' : 
                                            displayData.analysis.status === 'warning' ? 'text-[#D4AF37]' : 
                                            'text-emerald-400'
                                        } />
                                        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#F4F4F0] font-mono">Tactical Verdict</span>
                                    </div>
                                    {displayData.analysis.entryRating && (
                                        <span className={`text-[9px] px-2 py-0.5 rounded-sm font-black font-mono tracking-widest ${getBadgeStyle(displayData.analysis.entryRating)}`}>
                                            {displayData.analysis.entryRating}
                                        </span>
                                    )}
                                </div>
                                
                                <span className={`text-sm font-black uppercase tracking-wide block mb-2 font-mono ${
                                    displayData.isPlaceholder ? 'animate-pulse text-[#D4AF37]' :
                                    displayData.analysis.status === 'danger' ? 'text-red-400' : 
                                    displayData.analysis.status === 'warning' ? 'text-[#D4AF37]' : 
                                    'text-emerald-400'
                                }`}>{displayData.analysis.verdict}</span>
                                
                                <p className="text-[11px] leading-relaxed text-[#A0A099]">{displayData.analysis.feedback}</p>
                            </div>

                            {/* Hard Gates Panel */}
                            <div className="bg-[#050505] border border-[#222] rounded-2xl p-5 flex-1 shadow-sm">
                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#F4F4F0] mb-4 flex items-center gap-2 border-b border-[#111] pb-3 font-mono">
                                    <ShieldAlert size={14} className="text-[#777]" /> Hard Gates Filter
                                </span>
                                
                                {displayData.isPlaceholder ? (
                                    <div className="flex flex-col items-center justify-center py-6 opacity-50 animate-pulse">
                                        <Search size={24} className="text-[#555] mb-2"/>
                                        <span className="text-[10px] text-[#777] font-bold uppercase tracking-widest font-mono">Awaiting Scan...</span>
                                    </div>
                                ) : (!displayData.gates || displayData.gates.length === 0) ? (
                                    <div className="flex flex-col items-center justify-center py-6 opacity-70">
                                        <ShieldCheck size={24} className="text-emerald-500 mb-2"/>
                                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest font-mono">Passed All Gates</span>
                                    </div>
                                ) : (
                                    <ul className="flex flex-col gap-2">
                                        {displayData.gates.map((gate, i) => (
                                            <li key={i} className="text-[11px] bg-red-950/10 border-l-2 border-red-500/50 rounded-r-lg p-2.5 flex items-start gap-2.5 text-[#C0C0C0]">
                                                <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" /> 
                                                <div>
                                                    <strong className="text-red-400 tracking-wider block mb-0.5 uppercase font-mono text-[10px]">
                                                        {gate.type} BLOCK
                                                    </strong>
                                                    <span className="opacity-90 leading-tight block">{gate.msg}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* HUD Mini-Cards with Layman Tooltips */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        <div className="bg-[#050505] border border-[#222] rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-[#333] transition-colors">
                            <LaymanTooltip 
                                icon={Activity}
                                label="Genesis & Dormancy" 
                                explanation="How many days the token sat completely dead with zero volume before suddenly waking up. Long idle times combined with huge sudden volume often signal a Community Takeover (CTO)." 
                            />
                            <div className="flex items-baseline justify-between mt-auto pt-4">
                                <span className="text-[11px] text-[#A0A099]">Idle Time</span>
                                <span className="text-sm font-black font-mono text-[#F4F4F0]">{telemetry.zombieDormancyDays ?? '0.0'} D</span>
                            </div>
                        </div>

                        <div className="bg-[#050505] border border-[#222] rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-[#333] transition-colors">
                            <LaymanTooltip 
                                icon={PieChart}
                                label="Top 10 Risk" 
                                explanation="If the top 10 wallets hold more than 20%, it is a 'Cabal Trap'. This means insiders hold enough power to drain the entire liquidity pool and crash the price at their discretion." 
                            />
                            <div className="flex items-baseline justify-between mt-auto pt-4">
                                <span className="text-[11px] text-[#A0A099]">Concentration</span>
                                <span className={`text-sm font-black font-mono ${forensics.top10SharePct > 20.0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {forensics.top10SharePct.toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        <div className="bg-[#050505] border border-[#222] rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-[#333] transition-colors">
                            <LaymanTooltip 
                                icon={Users}
                                label="Smart Money" 
                                explanation="The number of highly profitable 'Alpha' wallets that have secretly bought this token. These wallets have been verified by our indexer to have made 10x-50x returns on previous trades." 
                            />
                            <div className="flex items-baseline justify-between mt-auto pt-4">
                                <span className="text-[11px] text-[#A0A099]">Tracked Buyers</span>
                                <span className={`text-sm font-black font-mono ${telemetry?.smartMoneyConvergence?.trackedWalletsCount > 0 ? 'text-[#D4AF37]' : 'text-[#F4F4F0]'}`}>
                                    {telemetry?.smartMoneyConvergence?.trackedWalletsCount ?? 0} Hits
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Legal Disclaimer */}
                    <div className="mt-2 flex items-start gap-2.5 text-[#555] opacity-60 hover:opacity-100 transition-opacity">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5 text-[#555]" />
                        <p className="text-[9px] uppercase tracking-wider leading-relaxed font-mono">
                            <strong className="text-[#666]">NFA DISCLAIMER:</strong> Ghost Radar is a raw data analytics engine. Scores and verdicts are algorithmic proxies generated from public on-chain data. They do NOT constitute financial advice. Execute entirely at your own risk.
                        </p>
                    </div>
                    
                </div>
            )}
        </div>
    );
}