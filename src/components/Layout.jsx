import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Menu } from 'lucide-react';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Calmed down ambient background to ensure data readability
  const renderBackground = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none flex justify-evenly z-0 opacity-40">
      <style>{`@keyframes rain { 0% { transform: translateY(-20%); opacity: 0; } 50% { opacity: 0.15; } 100% { transform: translateY(110vh); opacity: 0; } }`}</style>
      {[...Array(20)].map((_, i) => (
        <div key={i} className="text-gold-500 font-mono text-xl" style={{ animation: `rain ${15 + Math.random() * 10}s linear infinite`, animationDelay: `${Math.random() * 10}s`, filter: 'drop-shadow(0 0 2px #D4AF37)' }}>
          {Array(40).fill(0).map(() => String.fromCharCode(0x30A0 + Math.random() * 96)).join('\n')}
        </div>
      ))}
    </div>
  );

  return (
    <div className="h-screen w-screen bg-ghost-black text-offwhite relative overflow-hidden flex">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-gold-500/[0.03] rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-gold-500/[0.02] rounded-full blur-[120px] pointer-events-none z-0"></div>
      
      {renderBackground()}

      {/* Sidebar - Persistent on Desktop, hidden on Mobile */}
      <div className="hidden md:block z-40">
        <Sidebar expanded={true} setExpanded={() => {}} />
      </div>

      {/* Mobile Sidebar Overlay */}
      <div className="md:hidden z-50">
        <Sidebar expanded={mobileMenuOpen} setExpanded={setMobileMenuOpen} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen relative z-10 w-full min-w-0">
        {/* Top Navigation / Mobile Header */}
        <nav className="h-[73px] border-b border-ghost-border bg-ghost-bg/90 backdrop-blur-md flex items-center px-6 shrink-0 justify-between">
          <div className="flex items-center">
            {/* Mobile Hamburger */}
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden mr-4 text-muted hover:text-gold-500 transition-colors"
            >
              <Menu size={24} />
            </button>

            {/* Back Button */}
            {location.pathname !== '/' && (
              <button onClick={() => navigate(-1)} className="hidden md:flex items-center text-gold-500 hover:text-offwhite transition-colors mr-6 px-3 py-1.5 rounded bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 font-mono text-[10px] uppercase tracking-widest cursor-pointer">
                <ArrowLeft size={14} className="mr-2" /> Back
              </button>
            )}
            
            <h1 className="text-2xl text-gold-500 tracking-wider drop-shadow-[0_0_10px_rgba(212,175,55,0.3)] font-halloween md:hidden">
              Ghost Radar
            </h1>
          </div>
        </nav>

        {/* Scrollable Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-ghost-black/50 p-4 md:p-8">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}