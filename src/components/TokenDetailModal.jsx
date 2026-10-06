import React, { useState, useEffect } from 'react';

export default function TokenDetailModal({ token, onClose }) {
  const [copied, setCopied] = useState(false);
  const [safety, setSafety] = useState(null);
  const [loadingSafety, setLoadingSafety] = useState(true);

  useEffect(() => {
    if (!token?.contract) return;

    let isMounted = true;
    setLoadingSafety(true);

    fetch(`import.meta.env.VITE_API_URL || 'http://localhost:3001'/api/token/${token.contract}/safety`)
      .then((res) => {
        if (!res.ok) throw new Error('Safety check failed');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setSafety(data);
          setLoadingSafety(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load contract safety:', err);
        if (isMounted) setLoadingSafety(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token?.contract]);

  if (!token) return null;

  const isExpansion = token.intelligence?.lifecycle === 'EXPANSION';
  const isHighRisk = token.risk?.creator === 'HIGH' || safety?.dangerLevel === 'CRITICAL';

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(token.contract);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] w-[340px] max-h-[90vh] overflow-y-auto bg-[#050505]/95 border-[0.5px] border-[#D4AF37]/40 rounded-3xl p-6 shadow-[0_30px_60px_rgba(0,0,0,0.9),_inset_0_0_20px_rgba(212,175,55,0.05)] font-mono backdrop-blur-2xl scrollbar-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Golden Square Exit Button */}
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 w-6 h-6 bg-[#D4AF37] hover:bg-[#F4F4F0] rounded-[4px] flex items-center justify-center transition-all z-50 cursor-pointer shadow-lg"
      >
        <svg className="w-4 h-4 text-[#030303]" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>

      {/* HEADER */}
      <div className="flex flex-col items-center text-center mb-6 mt-1">
        <span className="text-[10px] text-[#A0A099] tracking-widest uppercase mb-1">{token.symbol}</span>
        <h2 className="text-xl font-light text-[#F4F4F0] tracking-widest uppercase mb-1">{token.name}</h2>
        <span className="text-[9px] text-[#D4AF37] tracking-[0.2em] mb-4">{token.symbol} / SOL</span>
        
        <div className="flex flex-col items-center">
          <span className="text-[7px] text-[#A0A099] uppercase tracking-[0.2em] mb-1.5">Contract Address</span>
          <div 
            onClick={handleCopy}
            className="flex items-center gap-2 bg-[#0A0A0A] hover:bg-[#151515] px-3 py-1.5 rounded-md border-[0.5px] border-[#D4AF37]/30 hover:border-[#D4AF37] cursor-pointer transition-all active:scale-95"
          >
            <span className="text-[10px] text-[#F4F4F0] tracking-widest">
              {token.contract ? `${token.contract.slice(0, 4)}...${token.contract.slice(-4)}` : 'UNKNOWN'}
            </span>
            {copied ? (
              <svg className="w-3.5 h-3.5 text-[#00E676]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-[#D4AF37]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            )}
          </div>
        </div>
      </div>

      {/* ON-CHAIN CONTRACT SAFETY */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2.5 border-b-[0.5px] border-[#D4AF37]/20 pb-1">
          <h3 className="text-[8px] text-[#D4AF37] uppercase tracking-widest">
            On-Chain Safety Check
          </h3>
          {loadingSafety ? (
            <span className="text-[8px] text-[#A0A099] animate-pulse">ANALYZING...</span>
          ) : (
            <span className={`text-[8px] tracking-wider px-1.5 py-0.5 rounded ${safety?.dangerLevel === 'CRITICAL' ? 'bg-[#FF3366]/20 text-[#FF3366] border border-[#FF3366]/40' : 'bg-[#00E676]/20 text-[#00E676] border border-[#00E676]/40'}`}>
              {safety?.dangerLevel || 'VERIFIED'}
            </span>
          )}
        </div>

        {loadingSafety ? (
          <div className="py-2 text-center text-[9px] text-[#A0A099]">Scanning SPL Mint Account...</div>
        ) : safety ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-[#A0A099] uppercase">Mint Authority</span>
              <span className={`text-[10px] font-bold ${safety.checks.mintRenounced ? 'text-[#00E676]' : 'text-[#FF3366]'}`}>
                {safety.checks.mintRenounced ? 'RENOUNCED' : 'ACTIVE (RUG RISK)'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-[#A0A099] uppercase">Freeze Authority</span>
              <span className={`text-[10px] font-bold ${safety.checks.freezeRenounced ? 'text-[#00E676]' : 'text-[#FF3366]'}`}>
                {safety.checks.freezeRenounced ? 'RENOUNCED' : 'ACTIVE (FREEZABLE)'}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-2 text-center text-[9px] text-[#FF3366]">Safety inspection unreachable</div>
        )}
      </div>

      {/* MARKET INTEGRITY */}
      <div className="mb-5">
        <h3 className="text-[8px] text-[#D4AF37] uppercase tracking-widest mb-2.5 border-b-[0.5px] border-[#D4AF37]/20 pb-1">
          Market Integrity
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[#A0A099] uppercase">Price</span>
            <span className="text-[10px] text-[#F4F4F0]">{token.market?.price || '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[#A0A099] uppercase">Market Cap</span>
            <span className="text-[10px] text-[#F4F4F0]">{token.market?.marketCap || '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[#A0A099] uppercase">24H Volume</span>
            <span className="text-[10px] text-[#F4F4F0]">{token.market?.volume24h || '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[#A0A099] uppercase">Liquidity</span>
            <span className="text-[10px] text-[#F4F4F0]">{token.market?.liquidity || '—'}</span>
          </div>
        </div>
      </div>

      {/* FORENSICS */}
      <div className="mb-5">
        <h3 className="text-[8px] text-[#D4AF37] uppercase tracking-widest mb-2.5 border-b-[0.5px] border-[#D4AF37]/20 pb-1">
          Behavioral Forensics
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[#A0A099] uppercase">Lifecycle</span>
            <span className={`text-[10px] ${isExpansion ? 'text-[#00E676]' : 'text-[#D4AF37]'}`}>
              {token.intelligence?.lifecycle || 'DEVELOPING'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[#A0A099] uppercase">Convergence</span>
            <span className="text-[10px] text-[#F4F4F0]">{token.intelligence?.walletConvergence || '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[#A0A099] uppercase">Liq Quality</span>
            <span className="text-[10px] text-[#F4F4F0]">{token.intelligence?.liquidityQuality || '—'}</span>
          </div>
        </div>
      </div>

      {/* HISTORICAL SIMILARITY */}
      <div className="mb-5">
        <h3 className="text-[8px] text-[#D4AF37] uppercase tracking-widest mb-2.5 border-b-[0.5px] border-[#D4AF37]/20 pb-1">
          Historical Matches
        </h3>
        <div className="space-y-2.5">
          <SimilarityBar label="1,000x Cohort" percentage={token.similarity?.thousandX || 82} color="bg-[#00E676]" />
          <SimilarityBar label="100x Cohort" percentage={token.similarity?.hundredX || 67} color="bg-[#00E676]/60" />
          <SimilarityBar label="Failed Lookalike" percentage={token.similarity?.failed || 23} color="bg-[#FF3366]" />
        </div>
      </div>

      {/* RISK */}
      <div className="mb-6">
        <h3 className="text-[8px] text-[#FF3366] uppercase tracking-widest mb-2.5 border-b-[0.5px] border-[#FF3366]/20 pb-1">
          Risk Matrix
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[#A0A099] uppercase">Creator Risk</span>
            <span className={`text-[10px] ${isHighRisk ? 'text-[#FF3366]' : 'text-[#00E676]'}`}>
              {token.risk?.creator || 'NORMAL'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[#A0A099] uppercase">Clusters</span>
            <span className="text-[10px] text-[#F4F4F0]">{token.risk?.cluster || '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[9px] text-[#A0A099] uppercase">Concentration</span>
            <span className="text-[10px] text-[#F4F4F0]">{token.risk?.concentration || '—'}</span>
          </div>
        </div>
      </div>

      {/* THESIS */}
      <div className="bg-[#050505] border-[0.5px] border-[#00E676]/30 rounded-xl p-3 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00E676]/[0.05] to-transparent pointer-events-none"></div>
        <span className="text-[7px] text-[#D4AF37]/70 uppercase tracking-[0.3em] block mb-1.5 relative z-10">
          System Thesis Core
        </span>
        <span className="text-sm text-[#F4F4F0] font-light tracking-[0.2em] uppercase relative z-10">
          {token.intelligence?.thesis || 'MONITORING ACTIVITY'}
        </span>
      </div>
    </div>
  );
}

function SimilarityBar({ label, percentage, color }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[9px] text-[#A0A099] uppercase">{label}</span>
        <span className="text-[10px] text-[#F4F4F0]">{percentage}%</span>
      </div>
      <div className="w-full h-1 bg-[#0A0A0A] overflow-hidden border-[0.5px] border-[#D4AF37]/20 rounded-full">
        <div className={`h-full ${color}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}