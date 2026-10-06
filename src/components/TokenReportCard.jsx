import React, { useState, useEffect, useRef, useMemo } from 'react';

export default function TokenReportCard({ token, timeframe, onDoubleClick, size, left, top }) {
  const change = token?.priceChange?.[timeframe] || token?.volatility?.[timeframe] || 0;
  const absChange = Math.abs(change);
  const isPositive = change >= 0;

  let glowEffect = 'shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8),_inset_0_0_20px_rgba(212,175,55,0.04)]';
  let borderGlow = 'border-[#D4AF37]/20';

  if (absChange >= 200) {
    glowEffect = 'shadow-[0_0_80px_-15px_rgba(212,175,55,0.3)]';
    borderGlow = 'border-[#D4AF37]/60';
  } else if (absChange >= 100) {
    glowEffect = isPositive ? 'shadow-[0_0_50px_-15px_rgba(0,230,118,0.15)]' : 'shadow-[0_0_50px_-15px_rgba(255,51,102,0.15)]';
    borderGlow = isPositive ? 'border-[#00E676]/40' : 'border-[#FF3366]/40';
  } else if (absChange >= 50) {
    glowEffect = isPositive ? 'shadow-[0_0_35px_-15px_rgba(0,230,118,0.1)]' : 'shadow-[0_0_35px_-15px_rgba(255,51,102,0.1)]';
  }

  const trendText = isPositive ? 'text-[#00E676]' : 'text-[#FF3366]';
  const renderedSize = size;

  // Detail levels: small bubbles show only ticker + %, bigger ones add more
  const compact = renderedSize < 120;
  const showStats = renderedSize >= 120;
  const showThesis = renderedSize >= 150;

  const fontSizes = useMemo(() => ({
    ticker: compact ? Math.min(20, Math.max(9, renderedSize * 0.2)) : Math.max(8, renderedSize * 0.085),
    change: compact ? Math.min(16, Math.max(9, renderedSize * 0.17)) : Math.max(10, renderedSize * 0.13),
    statLabel: Math.max(5, renderedSize * 0.028),
    statValue: Math.max(6, renderedSize * 0.038),
    thesisLabel: Math.max(5, renderedSize * 0.026),
    thesisValue: Math.max(6, renderedSize * 0.034),
    padding: Math.max(4, renderedSize * 0.035)
  }), [renderedSize, compact]);

  const wobbleStyle = useMemo(() => ({
    animationDuration: `${18 + Math.random() * 22}s`,
    animationDelay: `${Math.random() * -20}s`
  }), []);

  const spinStyle = useMemo(() => ({
    animationDuration: `${50 + Math.random() * 60}s`,
    animationDelay: `${Math.random() * -40}s`,
    animationDirection: Math.random() > 0.5 ? 'normal' : 'reverse'
  }), []);

  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef(null);
  const dragRef = useRef({ 
    startX: 0, 
    startY: 0, 
    currentX: 0, 
    currentY: 0, 
    hasMoved: false 
  });

  const handlePointerDown = (e) => {
    setIsDragging(true);
    dragRef.current.startX = e.clientX - dragRef.current.currentX;
    dragRef.current.startY = e.clientY - dragRef.current.currentY;
    dragRef.current.hasMoved = false;
    e.target.setPointerCapture(e.pointerId);
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDragging || !cardRef.current) return;
      
      const newX = e.clientX - dragRef.current.startX;
      const newY = e.clientY - dragRef.current.startY;
      
      if (Math.abs(newX - dragRef.current.currentX) > 5 || Math.abs(newY - dragRef.current.currentY) > 5) {
        dragRef.current.hasMoved = true;
      }
      
      dragRef.current.currentX = newX;
      dragRef.current.currentY = newY;
      
      cardRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
    };

    const handlePointerUp = () => {
      if (isDragging) setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging]);

  const handlePointerUpLocal = () => {
    // Only handles clearing drag state now
  };

  return (
    <div
      className="absolute"
      style={{
        width: `${size}px`, height: `${size}px`,
        left: `${left}px`, top: `${top}px`,
        zIndex: isDragging ? 50 : 1
      }}
    >
      <style>{`
        @keyframes idleWobble {
          0%   { transform: translate(0px, 0px); }
          25%  { transform: translate(3px, -2px); }
          50%  { transform: translate(-2px, 3px); }
          75%  { transform: translate(-3px, -3px); }
          100% { transform: translate(0px, 0px); }
        }
        @keyframes idleSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div
        className="w-full h-full"
        style={{
          animationName: 'idleWobble',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          ...wobbleStyle
        }}
      >
        <div
          ref={cardRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUpLocal}
          onDoubleClick={(e) => {
            e.stopPropagation();
            // Pass the actual event 'e' out so Home.jsx knows the X/Y coordinates
            if (!dragRef.current.hasMoved && onDoubleClick) onDoubleClick(e);
          }}
          onClick={(e) => e.stopPropagation()} // Prevents single clicks from doing anything
          className={`w-full h-full rounded-full bg-black/80 border ${borderGlow} backdrop-blur-2xl flex flex-col items-center justify-center transition-shadow duration-500 hover:border-[#D4AF37]/80 ${glowEffect} select-none overflow-hidden relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{
            transform: `translate(${dragRef.current.currentX}px, ${dragRef.current.currentY}px)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            padding: `${fontSizes.padding}px`
          }}
        >
          {token?.logo && (
            <div
              className="absolute inset-0 z-0 pointer-events-none opacity-90"
              style={{
                animationName: 'idleSpin',
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
                ...spinStyle
              }}
            >
              <img
                src={token.logo}
                alt="Token Logo"
                className="w-full h-full object-cover"
                onError={(e) => e.target.style.display = 'none'}
              />
            </div>
          )}
          {token?.logo && <div className="absolute inset-0 bg-black/15 z-[1] pointer-events-none" />}

          <div className="relative z-10 flex flex-col items-center w-full h-full justify-center pointer-events-none overflow-hidden">
            <div
              className="text-center mb-1 max-w-[88%] pointer-events-auto bg-black/55 rounded-xl backdrop-blur-sm"
              style={{ padding: `${fontSizes.padding * 0.6}px ${fontSizes.padding}px` }}
            >
              <h2
                className="font-bold text-[#F4F4F0] tracking-wide truncate drop-shadow-lg uppercase leading-tight"
                style={{ fontSize: `${fontSizes.ticker}px` }}
              >
                {token?.symbol || '???'}
              </h2>
              <div
                className={`font-light tracking-tighter ${trendText} drop-shadow-[0_0_10px_currentColor] leading-tight`}
                style={{ fontSize: `${fontSizes.change}px` }}
              >
                {isPositive ? '+' : ''}{parseFloat(change).toFixed(1)}%
              </div>
            </div>

            {showStats && (
              <div className="flex justify-center gap-1 mb-1 w-[92%] font-mono pointer-events-auto">
                <div
                  className="bg-[#050505]/85 border-[0.5px] border-[#D4AF37]/30 rounded-full flex flex-col items-center flex-1 min-w-0"
                  style={{ padding: `${fontSizes.padding * 0.4}px ${fontSizes.padding * 0.5}px` }}
                >
                  <span className="text-[#A0A099] uppercase tracking-widest truncate w-full text-center" style={{ fontSize: `${fontSizes.statLabel}px` }}>Price</span>
                  <span className="text-[#F4F4F0] truncate w-full text-center" style={{ fontSize: `${fontSizes.statValue}px` }}>{token?.market?.price || 'PENDING'}</span>
                </div>
                <div
                  className="bg-[#050505]/85 border-[0.5px] border-[#D4AF37]/30 rounded-full flex flex-col items-center flex-1 min-w-0"
                  style={{ padding: `${fontSizes.padding * 0.4}px ${fontSizes.padding * 0.5}px` }}
                >
                  <span className="text-[#A0A099] uppercase tracking-widest truncate w-full text-center" style={{ fontSize: `${fontSizes.statLabel}px` }}>MCap</span>
                  <span className="text-[#F4F4F0] truncate w-full text-center" style={{ fontSize: `${fontSizes.statValue}px` }}>{token?.market?.marketCap || 'PENDING'}</span>
                </div>
                <div
                  className="bg-[#050505]/85 border-[0.5px] border-[#D4AF37]/30 rounded-full flex flex-col items-center flex-1 min-w-0"
                  style={{ padding: `${fontSizes.padding * 0.4}px ${fontSizes.padding * 0.5}px` }}
                >
                  <span className="text-[#A0A099] uppercase tracking-widest truncate w-full text-center" style={{ fontSize: `${fontSizes.statLabel}px` }}>Liq</span>
                  <span className="text-[#F4F4F0] truncate w-full text-center" style={{ fontSize: `${fontSizes.statValue}px` }}>{token?.market?.liquidity || 'PENDING'}</span>
                </div>
              </div>
            )}

            {showThesis && (
              <div
                className="text-center border-t border-[#D4AF37]/30 bg-black/55 rounded-b-2xl w-[75%] pointer-events-auto"
                style={{ padding: `${fontSizes.padding * 0.5}px` }}
              >
                <span className="text-[#D4AF37] uppercase block tracking-widest" style={{ fontSize: `${fontSizes.thesisLabel}px` }}>Thesis</span>
                <span className="text-[#F4F4F0] font-light tracking-widest uppercase truncate block" style={{ fontSize: `${fontSizes.thesisValue}px` }}>
                  {token?.intelligence?.thesis || 'AWAITING DATA'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}