import React, { useState } from 'react';
import { Search, ShieldAlert, ShieldCheck, Activity, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export default function RugChecker() {
    const [address, setAddress] = useState('');
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCheck = async (e) => {
        e.preventDefault();
        if (!address || address.trim().length < 32) {
            setError('Invalid Solana contract address');
            return;
        }

        setLoading(true);
        setError('');
        setReport(null);

        try {
            const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${address.trim()}/report`);
            if (!response.ok) throw new Error('Failed to fetch token data. Contract may not exist.');
            
            const data = await response.json();
            setReport(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getSecurityProfile = (risks) => {
        if (!risks) return {};
        const riskNames = risks.map(r => r.name.toLowerCase());
        return {
            mintDisabled: !riskNames.some(name => name.includes('mint')),
            freezeDisabled: !riskNames.some(name => name.includes('freeze')),
            topHoldersSafe: !riskNames.some(name => name.includes('holder')),
            lpLocked: !riskNames.some(name => name.includes('liquidity') || name.includes('lp'))
        };
    };

    const profile = report ? getSecurityProfile(report.risks) : null;
    const tokenName = report?.tokenMeta?.name || report?.fileMeta?.name || report?.token?.name || 'Unknown Token';
    const tokenSymbol = report?.tokenMeta?.symbol || report?.fileMeta?.symbol || report?.token?.symbol || '???';

    return (
        // Outer wrapper centers the content horizontally
        <div className="w-full min-h-full flex justify-center text-[#A0A099] font-mono py-12 px-4">
            
            {/* Inner container locked strictly to 2/3 of the page width */}
            <div className="w-2/3 max-w-[1000px] min-w-[320px] flex flex-col">
                
                <header className="w-full text-center mb-10">
                    <h1 className="text-3xl md:text-4xl font-bold text-[#D4AF37] tracking-widest glow-text uppercase mb-2">
                        GR <span className="text-[#D4AF37]/50">|</span> RugChecker
                    </h1>
                    <p className="text-[9px] md:text-[10px] text-[#D4AF37]/70 uppercase tracking-[0.3em]">
                        Forensic Contract Analysis & Liquidity Diagnostics
                    </p>
                </header>

                <div className="w-full bg-[#050505] border-[0.5px] border-[#D4AF37]/30 rounded-xl p-6 shadow-[0_0_30px_rgba(212,175,55,0.05)] mb-8">
                    <form onSubmit={handleCheck} className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4AF37]/50" size={18} />
                            <input 
                                type="text" 
                                placeholder="Paste Solana Contract Address (CA)..."
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full bg-[#0A0A0A] border-[0.5px] border-[#D4AF37]/40 rounded-lg py-4 pl-12 pr-4 text-[#F4F4F0] focus:outline-none focus:border-[#D4AF37] transition-colors placeholder:text-[#333] font-mono text-sm tracking-wider"
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-[#D4AF37] border-[0.5px] border-[#D4AF37]/50 rounded-lg px-8 py-4 font-bold tracking-widest uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 h-[54px]"
                        >
                            {loading ? <Activity className="animate-spin" size={18} /> : 'Scan'}
                        </button>
                    </form>
                    
                    {error && (
                        <div className="mt-4 p-4 bg-red-500/10 border-[0.5px] border-red-500/30 rounded-lg flex items-center gap-3 text-red-500 text-xs tracking-widest uppercase">
                            <AlertTriangle size={14} className="shrink-0" /> <span className="break-words">{error}</span>
                        </div>
                    )}
                </div>

                {report && (
                    <div className="w-full animate-[fadeIn_0.3s_ease-out] space-y-6">
                        
                        {/* Top Status Banner */}
                        <div className={`p-6 rounded-xl border-[0.5px] flex items-center justify-between gap-4 ${
                            report.riskScore > 5000 ? 'bg-red-500/5 border-red-500/30' : 
                            report.riskScore > 1000 ? 'bg-yellow-500/5 border-yellow-500/30' : 
                            'bg-emerald-500/5 border-emerald-500/30'
                        }`}>
                            <div className="flex items-center gap-4 min-w-0">
                                {report.riskScore > 5000 ? <ShieldAlert className="text-red-500 shrink-0" size={40} /> : <ShieldCheck className="text-emerald-500 shrink-0" size={40} />}
                                <div className="min-w-0">
                                    <h2 className="text-xl font-bold text-[#F4F4F0] tracking-widest uppercase mb-1 truncate">
                                        {tokenName} <span className="text-[#A0A099]">({tokenSymbol})</span>
                                    </h2>
                                    <p className={`text-xs font-bold uppercase tracking-wider ${
                                        report.riskScore > 5000 ? 'text-red-500' : report.riskScore > 1000 ? 'text-yellow-500' : 'text-emerald-500'
                                    }`}>
                                        Status: {report.riskScore > 5000 ? 'DANGER - HIGH RISK' : report.riskScore > 1000 ? 'WARNING - MODERATE RISK' : 'GOOD - LOW RISK'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[10px] text-[#A0A099] uppercase tracking-widest mb-1">Risk Score</p>
                                <p className={`text-3xl font-bold ${report.riskScore > 5000 ? 'text-red-500' : report.riskScore > 1000 ? 'text-yellow-500' : 'text-emerald-500'}`}>
                                    {report.riskScore}
                                </p>
                            </div>
                        </div>

                        {/* Security Profile (2x2 Grid) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#050505] border-[0.5px] border-[#D4AF37]/20 rounded-xl p-4 flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-widest">Mint Authority</span>
                                {profile.mintDisabled ? (
                                    <span className="flex items-center gap-1.5 text-[9px] text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded border-[0.5px] border-emerald-500/20 uppercase tracking-wider"><CheckCircle2 size={12}/> Disabled</span>
                                ) : (
                                    <span className="flex items-center gap-1.5 text-[9px] text-red-500 bg-red-500/10 px-2 py-1 rounded border-[0.5px] border-red-500/20 uppercase tracking-wider"><XCircle size={12}/> Enabled</span>
                                )}
                            </div>
                            <div className="bg-[#050505] border-[0.5px] border-[#D4AF37]/20 rounded-xl p-4 flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-widest">Freeze Authority</span>
                                {profile.freezeDisabled ? (
                                    <span className="flex items-center gap-1.5 text-[9px] text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded border-[0.5px] border-emerald-500/20 uppercase tracking-wider"><CheckCircle2 size={12}/> Disabled</span>
                                ) : (
                                    <span className="flex items-center gap-1.5 text-[9px] text-red-500 bg-red-500/10 px-2 py-1 rounded border-[0.5px] border-red-500/20 uppercase tracking-wider"><XCircle size={12}/> Enabled</span>
                                )}
                            </div>
                            <div className="bg-[#050505] border-[0.5px] border-[#D4AF37]/20 rounded-xl p-4 flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-widest">LP Status</span>
                                {profile.lpLocked ? (
                                    <span className="flex items-center gap-1.5 text-[9px] text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded border-[0.5px] border-emerald-500/20 uppercase tracking-wider"><CheckCircle2 size={12}/> Locked/Burned</span>
                                ) : (
                                    <span className="flex items-center gap-1.5 text-[9px] text-red-500 bg-red-500/10 px-2 py-1 rounded border-[0.5px] border-red-500/20 uppercase tracking-wider"><XCircle size={12}/> Unlocked/Risk</span>
                                )}
                            </div>
                            <div className="bg-[#050505] border-[0.5px] border-[#D4AF37]/20 rounded-xl p-4 flex items-center justify-between">
                                <span className="text-[10px] uppercase tracking-widest">Holder Conc.</span>
                                {profile.topHoldersSafe ? (
                                    <span className="flex items-center gap-1.5 text-[9px] text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded border-[0.5px] border-emerald-500/20 uppercase tracking-wider"><CheckCircle2 size={12}/> Healthy</span>
                                ) : (
                                    <span className="flex items-center gap-1.5 text-[9px] text-red-500 bg-red-500/10 px-2 py-1 rounded border-[0.5px] border-red-500/20 uppercase tracking-wider"><XCircle size={12}/> High Risk</span>
                                )}
                            </div>
                        </div>

                        {/* Threat Breakdown */}
                        <div className="bg-[#050505] border-[0.5px] border-[#D4AF37]/20 rounded-xl p-6">
                            <h3 className="text-[10px] text-[#D4AF37] font-bold tracking-[0.2em] uppercase mb-6 border-b-[0.5px] border-[#D4AF37]/20 pb-4">Threat Vectors Detected</h3>
                            
                            {report.risks && report.risks.length > 0 ? (
                                <div className="grid gap-3">
                                    {report.risks.map((risk, idx) => (
                                        <div key={idx} className="flex items-center gap-4 p-4 bg-[#0A0A0A] border-[0.5px] border-[#333] rounded-lg">
                                            <div className={`mt-0.5 shrink-0 ${risk.level === 'danger' ? 'text-red-500' : 'text-yellow-500'}`}>
                                                <AlertTriangle size={14} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[#F4F4F0] mb-1 truncate">{risk.name}</p>
                                                <p className="text-[10px] text-[#A0A099]">{risk.description}</p>
                                            </div>
                                            <div className="text-right shrink-0 pl-4">
                                                <span className={`text-[9px] px-2 py-1 rounded uppercase tracking-wider ${
                                                    risk.level === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-yellow-500/10 text-yellow-500'
                                                }`}>
                                                    Penalty: +{risk.score}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-emerald-500 text-xs tracking-widest uppercase flex flex-col items-center gap-3">
                                    <div className="bg-emerald-500/10 p-3 rounded-full border-[0.5px] border-emerald-500/30">
                                        <ShieldCheck size={24} />
                                    </div>
                                    No major threats detected by automated scan
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}