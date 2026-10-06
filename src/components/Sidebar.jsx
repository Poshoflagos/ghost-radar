import React, { useContext } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Activity, ShieldAlert, ShieldCheck, X, Shield, TerminalSquare, Scan, Eye, Diamond, Trophy, Skull, Target, BookOpen } from 'lucide-react'; 
import { AppContext } from '../AppContext';

export default function Sidebar({ expanded, setExpanded }) {
  const { rugFilterOn, setRugFilterOn } = useContext(AppContext);

  const NavItem = ({ to, icon: Icon, label, badge, badgeColor }) => (
    <NavLink 
      to={to} 
      onClick={() => setExpanded(false)} 
      className={({ isActive }) => `flex items-center justify-between p-3 rounded-lg transition-all duration-200 whitespace-nowrap group cursor-pointer ${
        isActive 
          ? 'bg-gold-500/10 text-gold-500 border border-gold-500/30 shadow-[0_0_10px_rgba(212,175,55,0.1)]' 
          : 'text-muted hover:bg-ghost-surface hover:text-offwhite border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className="shrink-0" />
        <span className="font-mono text-xs tracking-widest uppercase">{label}</span>
      </div>
      {badge && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${badgeColor}`}>
          {badge}
        </span>
      )}
    </NavLink>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {expanded && (
        <div 
          className="fixed inset-0 z-40 bg-ghost-black/80 backdrop-blur-sm transition-opacity md:hidden" 
          onClick={() => setExpanded(false)}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`fixed md:static top-0 left-0 h-full bg-ghost-bg border-r border-ghost-border flex flex-col transition-transform duration-300 ease-out z-50 w-64 md:translate-x-0 ${expanded ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Logo / Header */}
        <div className="h-[73px] flex items-center justify-between px-6 border-b border-ghost-border shrink-0">
          <span className="text-2xl text-gold-500 tracking-wider drop-shadow-[0_0_10px_rgba(212,175,55,0.3)] font-halloween">
            Ghost Radar
          </span>
          <button onClick={() => setExpanded(false)} className="text-muted hover:text-gold-500 transition-colors p-1 md:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 py-6 flex flex-col gap-6 px-4 overflow-y-auto">
          
          {/* MACRO MARKETS */}
          <div>
            <h3 className="text-[10px] text-muted font-bold tracking-widest uppercase mb-3 px-3">Macro Markets</h3>
            <div className="flex flex-col gap-1">
              <NavItem to="/" icon={Home} label="Radar Home" />
              <NavItem to="/alpha-zone" icon={TerminalSquare} label="Alpha Zone" />
              <NavItem 
                to="/ghost-matrix" 
                icon={Target} 
                label="Ghost Matrix" 
                badge="30%+" 
                badgeColor="bg-gold-500/10 text-gold-500 border border-gold-500/30" 
              />
            </div>
          </div>

          {/* FORENSICS & SCANNERS */}
          <div>
            <h3 className="text-[10px] text-muted font-bold tracking-widest uppercase mb-3 px-3">Forensics & Scanners</h3>
            <div className="flex flex-col gap-1">
              <NavItem to="/ghostlens" icon={Eye} label="GhostLens" />
              <NavItem to="/rugchecker" icon={Shield} label="RugChecker" />
              <NavItem 
                to="/zombies" 
                icon={Skull} 
                label="Zombie Radar" 
                badge="CTO" 
                badgeColor="bg-purple-900/50 text-purple-300 border border-purple-500/30" 
              />
              <NavItem to="/scanner" icon={Scan} label="Ghost X-Ray" />
            </div>
          </div>

          {/* INTELLIGENCE & WALLETS */}
          <div>
            <h3 className="text-[10px] text-muted font-bold tracking-widest uppercase mb-3 px-3">Intelligence</h3>
            <div className="flex flex-col gap-1">
              <NavItem to="/gembox" icon={Diamond} label="GemBox HUD" />
              <NavItem to="/diagnostics" icon={Activity} label="Diagnostics" />
              <NavItem to="/leaderboard" icon={Trophy} label="Leaderboard" />
            </div>
          </div>

          {/* DOCUMENTATION */}
          <div>
            <h3 className="text-[10px] text-muted font-bold tracking-widest uppercase mb-3 px-3">Resources</h3>
            <div className="flex flex-col gap-1">
              <NavItem to="/manual" icon={BookOpen} label="Ghost Manual" />
            </div>
          </div>

        </nav>

        {/* Bottom Safety Filter Toggle */}
        <div className="p-4 border-t border-ghost-border bg-ghost-black shrink-0">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setRugFilterOn(!rugFilterOn);
            }} 
            className={`flex items-center gap-3 p-3 rounded-lg w-full transition-all duration-200 border cursor-pointer ${
              rugFilterOn 
                ? 'bg-safe/10 text-safe border-safe/30 hover:bg-safe/20' 
                : 'bg-danger/10 text-danger border-danger/30 hover:bg-danger/20'
            }`}
          >
            {rugFilterOn ? <ShieldCheck size={18} className="shrink-0" /> : <ShieldAlert size={18} className="shrink-0" />}
            <div className="flex flex-col items-start">
              <span className="font-mono text-[9px] text-muted tracking-widest uppercase">Global Filter</span>
              <span className="font-mono text-[11px] font-bold tracking-widest uppercase">
                {rugFilterOn ? 'Safe Mode On' : 'Unfiltered Mode'}
              </span>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}