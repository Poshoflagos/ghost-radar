import React, { useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { Copy, ShieldCheck, ShieldAlert, Droplets, Activity, BarChart2, Coins } from 'lucide-react';

export default function TokenDetails() {
  const location = useLocation();
  const token = location.state?.token;
  const [copied, setCopied] = useState(false);

  if (!token) return <Navigate to="/" />;

  const handleCopy = () => {
    navigator.clipboard.writeText(token.contract);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clean up the organic score decimal
  const organicScore = Math.round(Number(token.organicScore) || 0);
  const isSafe = token.organicScoreLabel !== 'low' && !token.isSus;

  return (
    <div className="w-full max-w-[1200px] mx-auto pt-8 pb-16 animate-[fadeIn_0.3s_ease-out]">
      {/* Main Dashboard Card */}
      <div className="bg-[#050505]/90 border-[0.5px] border-[#D4AF37]/30 rounded-2xl overflow-hidden backdrop-blur-2xl shadow-[0_0_40px_rgba(0,0,0,0.8),_inset_0_0_20px_rgba(212,175,55,0.05)]">
        
        {/* Header Section */}
        <div className="p-8 border-b-[0.5px] border-[#D4AF37]/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-gradient-to-r from-[#D4AF37]/5 to-transparent">
          <div className="flex items-center gap-6">
            
            {/* Token Logo */}
            <div className="relative w-24 h-24 rounded-full border-[0.5px] border-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.2)] bg-[#0A0A0A] flex items-center justify-center overflow-hidden shrink-0">
              {token.logo ? (
                <img 
                  src={token.logo} 
                  alt={token.symbol} 
                  className="w-full h-full object-cover" 
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} 
                />
              ) : null}
              {/* Fallback if image breaks or is missing */}
              <span className="text-[#D4AF37] font-mono text-3xl font-bold" style={{ display: token.logo ? 'none' : 'block' }}>
                {token.symbol?.substring(0, 2).toUpperCase()}
              </span>
            </div>
            
            {/* Title & Address */}
            <div>
              <h1 className="text-4xl font-black text-[#F4F4F0] tracking-wider mb-2 flex items-center gap-3">
                {token.name} 
                <span className="text-[#D4AF37] text-xl font-mono bg-[#D4AF37]/10 px-3 py-1 rounded border-[0.5px] border-[#D4AF37]/30">
                  ${token.symbol}
                </span>
              </h1>
              <div className="flex items-center gap-2 text-[#A0A099] font-mono text-sm bg-[#0A0A0A] px-3 py-1.5 rounded-lg border-[0.5px] border-[#333] w-fit">
                <span>{token.contract}</span>
                <button onClick={handleCopy} className="hover:text-[#D4AF37] transition-colors ml-2" title="Copy Address">
                  <Copy size={14} />
                </button>
                {copied && <span className="text-emerald-500 text-[10px] uppercase ml-1 animate-pulse">Copied!</span>}
              </div>
            </div>
          </div>

          {/* Quick Status */}
          <div className="flex flex-col md:items-end gap-3 mt-4 md:mt-0">
            <div className={`px-4 py-2 rounded-lg border-[0.5px] flex items-center gap-2 font-mono text-xs uppercase tracking-widest shadow-[0_0_10px_rgba(0,0,0,0.5)] ${isSafe ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
              {isSafe ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
              {isSafe ? 'Audit Passed' : 'High Risk'}
            </div>
            <div className="md:text-right">
              <p className="text-[10px] text-[#A0A099] font-mono uppercase tracking-[0.2em] mb-1">Current Price</p>
              <p className="text-3xl font-mono text-[#F4F4F0] tracking-tight">{token.market.price}</p>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1: Market Intelligence */}
          <div className="space-y-6">
            <h2 className="text-sm text-[#D4AF37] font-mono uppercase tracking-[0.3em] flex items-center gap-2 border-b-[0.5px] border-[#D4AF37]/20 pb-2">
              <Activity size={16} /> Market Intelligence
            </h2>
            
            <div className="grid gap-3">
              <div className="bg-[#0A0A0A] p-4 rounded-xl border-[0.5px] border-white/5 flex justify-between items-center group hover:border-[#D4AF37]/30 transition-colors">
                <div className="flex items-center gap-3 text-[#A0A099]">
                  <Droplets size={16} /> <span className="font-mono text-xs uppercase tracking-widest">Liquidity</span>
                </div>
                <span className="font-mono text-[#F4F4F0] text-lg">{token.market.liquidity}</span>
              </div>
              
              <div className="bg-[#0A0A0A] p-4 rounded-xl border-[0.5px] border-white/5 flex justify-between items-center group hover:border-[#D4AF37]/30 transition-colors">
                <div className="flex items-center gap-3 text-[#A0A099]">
                  <BarChart2 size={16} /> <span className="font-mono text-xs uppercase tracking-widest">24H Volume</span>
                </div>
                <span className="font-mono text-[#F4F4F0] text-lg">{token.market.volume24h}</span>
              </div>
              
              <div className="bg-[#0A0A0A] p-4 rounded-xl border-[0.5px] border-white/5 flex justify-between items-center group hover:border-[#D4AF37]/30 transition-colors">
                <div className="flex items-center gap-3 text-[#A0A099]">
                  <Coins size={16} /> <span className="font-mono text-xs uppercase tracking-widest">Market Cap</span>
                </div>
                <span className="font-mono text-[#F4F4F0] text-lg">{token.market.marketCap}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Threat Forensics */}
          <div className="space-y-6">
            <h2 className="text-sm text-[#D4AF37] font-mono uppercase tracking-[0.3em] flex items-center gap-2 border-b-[0.5px] border-[#D4AF37]/20 pb-2">
              <ShieldAlert size={16} /> Threat Forensics
            </h2>
            
            <div className="grid gap-3">
              {/* Score Progress Bar */}
              <div className="bg-[#0A0A0A] p-4 rounded-xl border-[0.5px] border-white/5 flex flex-col justify-center gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-[#A0A099] uppercase tracking-widest">Organic Score</span>
                  <span className="font-mono text-[#F4F4F0]">{organicScore}/100</span>
                </div>
                <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${organicScore > 70 ? 'bg-emerald-500' : organicScore > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                    style={{ width: `${organicScore}%` }} 
                  />
                </div>
              </div>

              <div className="bg-[#0A0A0A] p-4 rounded-xl border-[0.5px] border-white/5 flex justify-between items-center">
                <span className="font-mono text-xs text-[#A0A099] uppercase tracking-widest">Mint Authority</span>
                <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-[#111] border-[0.5px] ${token.audit?.mintAuthorityDisabled ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'}`}>
                  {token.audit?.mintAuthorityDisabled ? 'Disabled (Safe)' : 'Active (Risk)'}
                </span>
              </div>

              <div className="bg-[#0A0A0A] p-4 rounded-xl border-[0.5px] border-white/5 flex justify-between items-center">
                <span className="font-mono text-xs text-[#A0A099] uppercase tracking-widest">Freeze Authority</span>
                <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-[#111] border-[0.5px] ${token.audit?.freezeAuthorityDisabled ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'}`}>
                  {token.audit?.freezeAuthorityDisabled ? 'Disabled (Safe)' : 'Active (Risk)'}
                </span>
              </div>
            </div>
          </div>

          {/* Column 3: Trading Terminal Placeholder */}
          <div className="space-y-6 lg:col-span-1 h-full">
            <h2 className="text-sm text-[#D4AF37] font-mono uppercase tracking-[0.3em] flex items-center gap-2 border-b-[0.5px] border-[#D4AF37]/20 pb-2">
              <Activity size={16} /> Live Feed
            </h2>
            <div className="bg-[#0A0A0A] border-[0.5px] border-white/5 rounded-xl h-[calc(100%-2.5rem)] min-h-[200px] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden group cursor-not-allowed">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#D4AF37]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Activity size={32} className="text-[#333] mb-4 group-hover:text-[#D4AF37]/50 transition-colors" />
              <p className="text-[#D4AF37] font-mono text-sm tracking-widest mb-2">CHARTING MODULE</p>
              <p className="text-[#A0A099] font-mono text-[10px] uppercase leading-relaxed max-w-[200px]">
                Orderbook & TradingView integration pending next sprint.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}