import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Ghost Radar Terminal Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[60vh] bg-ghost-black p-8 text-center font-sans">
          <div className="bg-ghost-bg border border-danger/30 rounded-2xl p-8 max-w-md w-full flex flex-col items-center shadow-[0_0_30px_rgba(239,68,68,0.1)]">
            <div className="w-16 h-16 bg-danger/10 border border-danger/30 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-danger"/>
            </div>
            <h2 className="text-lg font-bold text-offwhite uppercase tracking-widest mb-2">Module Offline</h2>
            <p className="text-xs text-muted mb-6 leading-relaxed">
              A critical memory or rendering fault occurred in this sector of the terminal. The module has been isolated to prevent global state corruption.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-5 py-2.5 bg-ghost-black hover:bg-ghost-surface border border-ghost-border hover:border-gold-500/50 text-gold-500 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all cursor-pointer shadow-inner"
            >
              <RefreshCw size={14} /> Reboot Interface
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}