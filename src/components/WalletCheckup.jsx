// src/components/WalletCheckup.jsx
import React, { useState, useEffect } from 'react';
import { Search, Crosshair, Activity, Terminal, RefreshCw, Zap, Skull, ShieldCheck } from 'lucide-react';

const LOADING_PHRASES = [
  'Locking forensic target...',
  'Scanning Raydium transaction graph...',
  'Calculating degenerate exposure...',
  'Finalizing on-chain autopsy...'
];

export default function WalletCheckup() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [error, setError] = useState('');
  const [showGlossary, setShowGlossary] = useState(false);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);

  // Cycle through loading phrases
  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoadingTextIndex((prev) => Math.min(prev + 1, LOADING_PHRASES.length - 1));
      }, 700);
    } else {
      setLoadingTextIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleRunCheckup = async (e) => {
    e.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setError('');
    setDiagnosticData(null);

    const animationTimer = new Promise(resolve => setTimeout(resolve, 3000));
    let res, data;

    try {
      res = await fetch(`https://site--ghost-radar--26zc8pyqkn62.code.run/api/wallet/${address.trim()}/checkup`);
    } catch (err) {
      await animationTimer;
      setError("Forensic engine offline. Ensure Node.js server is running on port 3001.");
      setLoading(false);
      return;
    }

    try {
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Forensic engine offline. Ensure Node.js server is running on port 3001.");
      }

      data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to inspect wallet.');
      }

      await animationTimer;
      setDiagnosticData(data);
    } catch (err) {
      await animationTimer;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDiagnosticData(null);
    setAddress('');
    setError('');
  };

  return (
    <div className="w-full flex flex-col items-center pt-8 md:pt-16 px-4 md:px-8 pb-32 animate-[fadeIn_0.4s_ease-out] font-sans">
      
      <header className="mb-12 text-center w-full flex flex-col items-center">
        <p className="font-mono text-[9px] text-gold-500 uppercase tracking-[0.3em] mb-4 drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] font-bold">
          Behavioral Pattern Analysis
        </p>
        <h2 className="text-4xl text-offwhite tracking-[0.2em] font-halloween uppercase drop-shadow-md">
          Wallet Diagnostics
        </h2>
      </header>

      {/* Main Input Interface */}
      {!diagnosticData && !loading && (
        <div className="w-full max-w-2xl bg-ghost-bg/90 border border-ghost-border rounded-2xl p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-[scaleIn_0.3s_ease-out]">
          <h3 className="text-xs text-gold-500 font-mono uppercase tracking-[0.2em] mb-4 flex items-center gap-2 border-b border-ghost-border pb-3 font-bold">
            <Crosshair size={16} /> Forensic Target
          </h3>
          
          <form onSubmit={handleRunCheckup} className="relative flex items-center mt-6">
            <div className="absolute left-4 text-muted">
              <Search size={18} />
            </div>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Paste Solana wallet address (e.g. 7xK...9Pm)"
              className="w-full bg-ghost-black border border-ghost-border hover:border-gold-500/50 focus:border-gold-500 focus:outline-none rounded-xl py-4 pl-12 pr-32 text-offwhite font-mono text-sm transition-all shadow-inner placeholder:text-muted/50"
            />
            <button
              type="submit"
              disabled={!address.trim()}
              className="absolute right-2 top-2 bottom-2 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/40 text-gold-400 disabled:opacity-30 disabled:hover:bg-gold-500/10 disabled:cursor-not-allowed rounded-lg px-6 font-mono text-[10px] uppercase tracking-widest transition-all hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] cursor-pointer font-bold"
            >
              Analyze
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-xs font-mono font-bold flex items-center gap-2 animate-[fadeIn_0.3s_ease-out]">
              <Skull size={14} /> {error}
            </div>
          )}
          
          <p className="mt-6 text-[9px] text-muted font-mono uppercase tracking-widest text-center leading-relaxed">
            Ghost Radar is not a financial advisor. Data represents behavioral history for research purposes only.
          </p>
        </div>
      )}

      {/* Loading Sequence */}
      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ghost-black/90 backdrop-blur-md px-4">
          <div className="bg-ghost-bg border border-gold-500/50 rounded-2xl p-8 flex flex-col items-center justify-center max-w-sm w-full shadow-[0_0_60px_rgba(212,175,55,0.15)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold-500/10 to-transparent w-full h-full animate-[scan_2s_linear_infinite]" style={{ backgroundSize: '100% 200%' }} />
            
            <Activity className="text-gold-500 animate-pulse mb-6 z-10" size={48} />
            
            <div className="w-full bg-ghost-black border border-ghost-border rounded-lg p-4 flex items-center gap-3 z-10">
              <Terminal size={14} className="text-muted" />
              <p className="font-mono text-gold-400 text-[10px] uppercase tracking-widest animate-pulse font-bold">
                {LOADING_PHRASES[loadingTextIndex]}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results Dashboard */}
      {diagnosticData && !loading && (
        <div className="w-full max-w-4xl animate-[fadeIn_0.4s_ease-out]">
          
          <div className="flex flex-col md:flex-row md:justify-between md:items-end mb-6 gap-4">
            <div>
              <h3 className="text-2xl font-bold text-offwhite tracking-[0.1em] font-halloween uppercase mb-1">
                Diagnostic Report
              </h3>
              <p className="text-muted font-mono text-xs tracking-widest flex items-center gap-2">
                <Crosshair size={14} className="text-gold-500" /> {address.substring(0, 6)}...{address.substring(address.length - 4)}
              </p>
            </div>
            <button 
              onClick={handleReset}
              className="flex items-center justify-center gap-2 text-muted hover:text-gold-400 font-mono text-[10px] uppercase tracking-widest transition-colors border border-transparent hover:border-gold-500/30 bg-ghost-bg px-4 py-2 rounded-lg cursor-pointer font-bold"
            >
              <RefreshCw size={14} /> New Target
            </button>
          </div>

          <div className="bg-ghost-bg/90 border border-gold-500/30 rounded-2xl p-6 md:p-8 backdrop-blur-2xl shadow-xl mb-6">
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[9px] text-muted uppercase tracking-[0.2em] block mb-1 font-bold">Personality Archetype</span>
                <h2 className="text-3xl font-bold text-gold-500 uppercase tracking-widest font-halloween">
                  {diagnosticData.personality.archetype}
                </h2>
                {diagnosticData.personality.tagline && (
                  <p className="text-xs text-gold-400/80 italic mt-1 font-mono">
                    "{diagnosticData.personality.tagline}"
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-[9px] text-muted uppercase tracking-[0.2em] block mb-1 font-bold">Confidence</span>
                <span className="text-sm px-3 py-1 bg-safe/10 border border-safe/30 rounded text-safe font-mono font-bold tracking-wider inline-block tabular-nums">
                  {diagnosticData.personality.confidence}
                </span>
              </div>
            </div>

            <p className="text-sm text-offwhite leading-relaxed font-mono bg-ghost-black p-4 rounded-xl border border-ghost-border mb-8 shadow-inner">
              {diagnosticData.personality.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-ghost-black border border-ghost-border p-4 rounded-xl">
                <span className="text-[9px] text-muted uppercase tracking-widest block mb-2 flex items-center gap-1.5 font-bold"><ShieldCheck size={12} className="text-safe"/> Win Rate</span>
                <span className="text-2xl text-offwhite font-mono font-bold tabular-nums">{diagnosticData.diagnostics.winRate}</span>
              </div>
              <div className="bg-ghost-black border border-ghost-border p-4 rounded-xl">
                <span className="text-[9px] text-muted uppercase tracking-widest block mb-2 flex items-center gap-1.5 font-bold"><Activity size={12} className="text-gold-500"/> Median Hold</span>
                <span className="text-2xl text-offwhite font-mono font-bold tabular-nums">{diagnosticData.diagnostics.averageHold}</span>
              </div>
              <div className="bg-ghost-black border border-ghost-border p-4 rounded-xl">
                <span className="text-[9px] text-muted uppercase tracking-widest block mb-2 flex items-center gap-1.5 font-bold"><Zap size={12} className="text-blue-400"/> Scaling Freq</span>
                <span className="text-2xl text-offwhite font-mono font-bold tabular-nums">{diagnosticData.diagnostics.scalingFrequency}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-safe/5 border border-safe/20 p-5 rounded-xl">
                <h3 className="text-[10px] text-safe uppercase tracking-widest mb-4 font-mono font-bold flex items-center gap-2">
                  <Zap size={14} /> Operational Strengths
                </h3>
                <ul className="space-y-3 font-mono text-xs text-muted">
                  {diagnosticData.traits.strengths.map((str, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-safe mt-0.5">›</span> <span className="leading-relaxed text-offwhite">{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-danger/5 border border-danger/20 p-5 rounded-xl">
                <h3 className="text-[10px] text-danger uppercase tracking-widest mb-4 font-mono font-bold flex items-center gap-2">
                  <Skull size={14} /> Fatal Behavioral Leaks
                </h3>
                <ul className="space-y-3 font-mono text-xs text-muted">
                  {diagnosticData.traits.fatalLeaks.map((leak, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-danger mt-0.5">›</span> <span className="leading-relaxed text-offwhite">{leak}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {diagnosticData.recommendation && (
              <div className="bg-gold-500/5 border border-gold-500/40 p-5 rounded-xl mb-6">
                <h3 className="text-[10px] text-gold-500 uppercase tracking-widest mb-3 font-mono font-bold">Recommended Path</h3>
                <p className="text-sm font-mono text-offwhite leading-relaxed">{diagnosticData.recommendation}</p>
              </div>
            )}

            {diagnosticData.glossary && (
              <div className="pt-4 border-t border-ghost-border">
                <button
                  onClick={() => setShowGlossary(!showGlossary)}
                  className="text-[10px] font-mono text-muted uppercase tracking-widest hover:text-gold-400 transition-colors flex items-center gap-2 cursor-pointer font-bold"
                >
                  {showGlossary ? 'Hide' : 'View'} Full Archetype Roster
                </button>
                {showGlossary && (
                  <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 animate-[fadeIn_0.3s_ease-out]">
                    {diagnosticData.glossary.map((entry) => (
                      <li key={entry.name} className={`text-xs font-mono p-3 rounded-lg border ${entry.name === diagnosticData.personality.archetype ? 'bg-gold-500/10 border-gold-500/40 shadow-md' : 'bg-ghost-black border-ghost-border'}`}>
                        <span className={`block font-bold mb-1 ${entry.name === diagnosticData.personality.archetype ? 'text-gold-400' : 'text-offwhite'}`}>{entry.name}</span>
                        <span className="text-muted leading-relaxed text-[10px]">{entry.tagline}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}} />
    </div>
  );
}