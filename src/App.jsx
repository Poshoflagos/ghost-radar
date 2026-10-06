import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppContext } from './AppContext'; 

import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';
import WalletCheckup from './components/WalletCheckup';
import TokenDetails from './pages/TokenDetails';
import RugChecker from './pages/RugChecker'; 
import AlphaZone from './pages/AlphaZone';
import GhostScoreTool from './components/GhostScoreTool'; 

import GhostLens from './pages/GhostLens';
import GemBox from './components/GemBox'; 
import WalletLeaderboard from './components/WalletLeaderboard'; 
import ZombieRadar from './pages/ZombieRadar';
import GhostMatrix from './components/GhostMatrix';

// 🔥 NEW: Premium Guide Page
import GhostManual from './pages/GhostManual';

export default function App() {
  const [rugFilterOn, setRugFilterOn] = useState(true);

  return (
    <AppContext.Provider value={{ rugFilterOn, setRugFilterOn }}>
      <Layout>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/diagnostics" element={<WalletCheckup />} />
            <Route path="/token/:address" element={<TokenDetails />} />
            <Route path="/rugchecker" element={<RugChecker />} />
            <Route path="/alpha-zone" element={<AlphaZone />} />
            
            <Route 
              path="/scanner" 
              element={
                <div className="pt-28 pb-16 px-4 md:px-8 w-full max-w-[800px] mx-auto min-h-screen">
                  <GhostScoreTool />
                </div>
              } 
            />
            
            <Route path="/ghostlens" element={<GhostLens />} />
            <Route path="/gembox" element={<GemBox />} />
            <Route path="/leaderboard" element={<WalletLeaderboard />} />
            <Route path="/zombies" element={<ZombieRadar />} />
            <Route path="/ghost-matrix" element={<GhostMatrix />} />
            
            {/* 🔥 NEW: Dedicated Manual Route */}
            <Route path="/manual" element={<GhostManual />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </AppContext.Provider>
  );
}