// src/pages/GhostManual.jsx
import React from 'react';
import { Crosshair, Target, Zap, Shield, Skull, Activity, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GhostManual() {
  const navigate = useNavigate();

  const tools = [
    {
      name: "Bubble Glance",
      tag: "MACRO VIEW",
      icon: <Crosshair size={22} />,
      desc: "A live, bird's-eye visualization of the Solana trenches. Bubble size correlates directly to real-time volatility and momentum. Double-tap any bubble to instantly pull up its full diagnostic X-Ray.",
      path: "/"
    },
    {
      name: "Ghost Matrix",
      tag: "$10K - $100K RADAR",
      icon: <Target size={22} />,
      desc: "The sniper's den. This board exclusively filters for micro-cap tokens launched in the last 24 hours sitting in the $10k–$100k market cap sweet spot. It strips out dead liquidity and highlights early volume momentum.",
      path: "/ghost-matrix"
    },
    {
      name: "Ghost Score X-Ray",
      tag: "ON-CHAIN FORENSICS",
      icon: <Shield size={22} />,
      desc: "Your defense mechanism. Paste a token or wallet address to generate an instant trust score. The system scans for wash trading loops, bundled developer wallets, hidden mint authorities, and liquidity locks.",
      path: "/scanner"
    },
    {
      name: "GemBox Alpha",
      tag: "PATTERN RECOGNITION",
      icon: <Zap size={22} />,
      desc: "The automated hunting dog. GemBox tracks tokens that have historically printed 2x to 10x returns, reverse-engineering their initial launch conditions to find repeatable patterns in the current market noise.",
      path: "/gembox"
    },
    {
      name: "Zombie Radar",
      tag: "CTO & REVIVALS",
      icon: <Skull size={22} />,
      desc: "Tracks 'dead' tokens experiencing sudden, inorganic volume spikes. Perfect for spotting Community Takeovers (CTOs) or stealth developer revivals before they break out on the main feeds.",
      path: "/zombies"
    }
  ];

  return (
    <div className="w-full min-h-full p-4 pt-28 sm:p-6 lg:p-12 lg:pt-28 font-sans selection:bg-gold-500/30 selection:text-gold-400">
      
      {/* Header Section */}
      <div className="max-w-5xl mx-auto mb-12 relative z-10">
        <h1 className="text-4xl md:text-6xl font-bold tracking-widest text-offwhite mb-4 font-halloween">
          THE <span className="text-gold-500 drop-shadow-[0_0_12px_rgba(212,175,55,0.4)]">GHOST</span> MANUAL
        </h1>
        <div className="h-[1px] w-32 bg-gold-500/50 mb-6"></div>
        <p className="text-muted text-sm md:text-base max-w-2xl leading-relaxed tracking-wide font-sans">
          Ghost Radar is a high-performance intelligence terminal designed for the Solana micro-cap ecosystem. 
          This suite filters out market noise, detects automated wash trading, and identifies asymmetric 
          liquidity opportunities before they hit mainstream radar.
        </p>
      </div>

      {/* Grid Layout (Bento Box Style) */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10 font-sans">
        {tools.map((tool, idx) => (
          <div 
            key={idx} 
            className={`group relative bg-ghost-bg/90 backdrop-blur-sm border border-ghost-border hover:border-gold-500/60 rounded-xl p-8 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(212,175,55,0.12)] overflow-hidden ${idx === 0 ? 'md:col-span-2' : ''}`}
          >
            {/* Background Glow on Hover */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-gold-500 opacity-0 group-hover:opacity-[0.06] blur-3xl transition-opacity duration-500 pointer-events-none"></div>

            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-gold-500 p-2.5 bg-gold-500/5 rounded-lg border border-gold-500/20 group-hover:bg-gold-500/10 transition-colors">
                    {tool.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-offwhite tracking-widest uppercase">{tool.name}</h3>
                    <span className="text-[9px] text-gold-400 font-mono font-bold tracking-widest uppercase block mt-1">
                      // {tool.tag}
                    </span>
                  </div>
                </div>
                
                <p className="text-muted text-xs md:text-sm leading-loose font-sans pr-4">
                  {tool.desc}
                </p>
              </div>

              <button 
                onClick={() => navigate(tool.path)}
                className="mt-8 flex items-center text-[10px] text-muted group-hover:text-gold-400 transition-colors uppercase tracking-widest font-bold w-max cursor-pointer font-mono"
              >
                Initialize Module <ArrowRight size={12} className="ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Note */}
      <div className="max-w-5xl mx-auto mt-20 pb-10 border-t border-ghost-border pt-6 flex items-center justify-between text-muted text-[10px] font-mono tracking-widest uppercase relative z-10">
        <span className="flex items-center gap-2">
          <Activity size={12} className="text-gold-500" /> 
          Telemetry Online
        </span>
        <span>Build v1.0.0</span>
      </div>
    </div>
  );
}