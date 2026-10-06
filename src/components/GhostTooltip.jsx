// src/components/GhostTooltip.jsx
import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

export default function GhostTooltip({
  text,
  title,
  children,
  side = 'top',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleTooltip = (e) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleMouseEnter = () => {
    if (window.matchMedia('(hover: hover)').matches) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (window.matchMedia('(hover: hover)').matches) {
      setIsOpen(false);
    }
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[#D4AF37]/40 border-l-transparent border-r-transparent border-b-transparent border-4',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#D4AF37]/40 border-l-transparent border-r-transparent border-t-transparent border-4',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[#D4AF37]/40 border-t-transparent border-b-transparent border-r-transparent border-4',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[#D4AF37]/40 border-t-transparent border-b-transparent border-l-transparent border-4'
  };

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center align-middle ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={toggleTooltip}
        aria-label="Explain this metric"
        className="text-[#A0A099] hover:text-[#D4AF37] focus:outline-none focus:text-[#D4AF37] p-0.5 rounded transition-colors inline-flex items-center cursor-pointer"
      >
        {children || <HelpCircle size={13} className="shrink-0" />}
      </button>

      {isOpen && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${positionClasses[side]} z-50 w-60 sm:w-64 p-3 bg-[#0A0A0A] border-[0.5px] border-[#D4AF37]/40 rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.85)] font-mono text-left animate-[fadeIn_0.15s_ease-out] select-text cursor-default`}
        >
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b-[0.5px] border-[#D4AF37]/20">
            <span className="text-[9px] font-bold text-[#D4AF37] uppercase tracking-widest">
              {title || 'Quick Guide'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="sm:hidden text-[#A0A099] hover:text-[#F4F4F0] p-0.5"
            >
              <X size={11} />
            </button>
          </div>

          <p className="text-[10px] text-[#F4F4F0] leading-relaxed font-sans sm:font-mono font-normal">
            {text}
          </p>

          <span className={`absolute w-0 h-0 pointer-events-none ${arrowClasses[side]}`} />
        </div>
      )}
    </span>
  );
}