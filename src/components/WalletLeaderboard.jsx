// src/components/WalletLeaderboard.jsx
import React, { useState, useEffect } from 'react';
import { ExternalLink, Award, Activity, Search, Crosshair, ArrowLeft, Copy, Check } from 'lucide-react';

// Tier from USD profit (old tiers were Whale > 50 SOL, Mid-Weight > 10 SOL, roughly $10K and $2K)
const getTier = (w) => {
    const pnl = Number(w.pnl_usd || 0);
    if (pnl >= 10000) return 'Whale';
    if (pnl >= 2000) return 'Mid-Weight';
    return 'Trench';
};

const fmtUsd = (n) => {
    const v = Number(n || 0);
    return `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const fmtRoi = (n) => {
    if (n === null || n === undefined) return '—';
    const v = Number(n);
    return `${v >= 0 ? '+' : ''}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}%`;
};

export default function WalletLeaderboard({ timeframe = '48h' }) {
    const [wallets, setWallets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [meta, setMeta] = useState(null);
    const [tierFilter, setTierFilter] = useState('ALL');
    const [tokenCA, setTokenCA] = useState('');
    const [activeTokenSearch, setActiveTokenSearch] = useState('');
    const [copiedAddress, setCopiedAddress] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setMessage('');

        const endpoint = activeTokenSearch
            ? `import.meta.env.VITE_API_URL || 'http://localhost:3001'/api/wallet-leaderboard/token/${encodeURIComponent(activeTokenSearch.trim())}`
            : `import.meta.env.VITE_API_URL || 'http://localhost:3001'/api/wallet-leaderboard/top`;

        fetch(endpoint)
            .then(res => res.json().catch(() => ({})))
            .then(data => {
                if (cancelled) return;
                if (data.success && Array.isArray(data.data)) {
                    setWallets(data.data);
                    setMeta(data);
                    if (data.warming) {
                        setMessage("Building the leaderboard from today's top gainers. Check back in a minute.");
                    } else if (data.data.length === 0) {
                        setMessage(data.note || 'No wallet trades found for this target.');
                    }
                } else {
                    setWallets([]);
                    setMeta(null);
                    setMessage(data.error || 'Wallet data is unavailable right now.');
                }
                setLoading(false);
            })
            .catch(err => {
                if (cancelled) return;
                console.error('Failed to fetch wallet leaderboard:', err);
                setWallets([]);
                setMeta(null);
                setMessage('Wallet data is unavailable right now.');
                setLoading(false);
            });

        return () => { cancelled = true; };
    }, [activeTokenSearch]);

    const handleTokenSearch = (e) => {
        e.preventDefault();
        if (tokenCA.trim().length > 30) {
            setActiveTokenSearch(tokenCA.trim());
        }
    };

    const clearTokenSearch = () => {
        setTokenCA('');
        setActiveTokenSearch('');
    };

    const handleCopy = (address) => {
        if (!address) return;
        navigator.clipboard.writeText(address);
        setCopiedAddress(address);
        setTimeout(() => {
            setCopiedAddress(null);
        }, 2000);
    };

    const visibleWallets = (!activeTokenSearch && tierFilter !== 'ALL')
        ? wallets.filter(w => getTier(w) === tierFilter)
        : wallets;

    return (
        <div className="w-full bg-ghost-bg/90 backdrop-blur-md border border-ghost-border rounded-xl p-5 font-sans shadow-xl">
            
            {/* Header & Token CA Search Bay */}
            <div className="flex flex-col mb-6 gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                        {activeTokenSearch ? <Crosshair size={18} className="text-safe" /> : <Award size={18} className="text-gold-500" />}
                        <div className="flex flex-col">
                            <h3 className="text-sm font-bold text-offwhite uppercase tracking-wider font-halloween">
                                {activeTokenSearch ? 'Top 20 Token Profiteers' : '24-Hour Velocity Wallets'}
                            </h3>
                            {!activeTokenSearch && meta?.ranked_by && (
                                <span className="text-[9px] text-muted uppercase tracking-widest font-mono mt-0.5">
                                    Wallets from the top {meta.tokens?.length || 10} gainers (24H) • ranked by {meta.ranked_by === 'roi_pct' ? `ROI, min $${meta.min_invested_usd} invested` : 'profit'}
                                </span>
                            )}
                        </div>
                    </div>

                    {!activeTokenSearch && (
                        <div className="flex bg-ghost-black border border-ghost-border rounded-lg p-1 text-[9px] uppercase tracking-widest font-bold">
                            {['ALL', 'Whale', 'Mid-Weight', 'Trench'].map(tier => (
                                <button
                                    key={tier}
                                    onClick={() => setTierFilter(tier)}
                                    className={`px-3 py-1 rounded transition-colors cursor-pointer ${tierFilter === tier ? 'bg-gold-500/20 text-gold-400 border border-gold-500/40' : 'text-muted hover:text-offwhite'}`}
                                >
                                    {tier}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Token CA Input Bar */}
                <form onSubmit={handleTokenSearch} className="flex items-center gap-3 w-full bg-ghost-black p-2 rounded-lg border border-ghost-border shadow-inner">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500/50" size={14} />
                        <input 
                            type="text"
                            value={tokenCA}
                            onChange={e => setTokenCA(e.target.value)}
                            placeholder="Paste Token CA to reveal the top 20 most profitable wallets..."
                            className="w-full bg-transparent py-2 pl-9 pr-4 text-offwhite text-xs font-mono outline-none focus:border-gold-500 placeholder:text-muted/50"
                        />
                    </div>
                    {activeTokenSearch && (
                        <button 
                            type="button" 
                            onClick={clearTokenSearch}
                            className="text-muted hover:text-offwhite px-3 py-2 flex items-center gap-1 text-[9px] uppercase tracking-widest transition-colors cursor-pointer font-bold"
                        >
                            <ArrowLeft size={12}/> Global
                        </button>
                    )}
                    <button 
                        type="submit"
                        disabled={tokenCA.trim().length < 32}
                        className="bg-gold-500/10 text-gold-400 border border-gold-500/30 hover:bg-gold-500/20 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50 cursor-pointer font-mono"
                    >
                        Extract Wallets
                    </button>
                </form>
            </div>

            {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-gold-500 font-mono">
                    <Activity className="animate-spin" size={20} />
                    <span className="text-[10px] uppercase tracking-widest font-bold">Aggregating On-Chain Swaps...</span>
                </div>
            ) : visibleWallets.length === 0 ? (
                <div className="py-16 text-center text-muted text-xs uppercase tracking-widest font-bold font-mono">
                    {message || 'No wallet trades logged yet for this target.'}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead>
                            <tr className="border-b border-ghost-border text-[9px] text-gold-500 uppercase tracking-[0.2em] bg-ghost-black/50 font-bold">
                                <th className="py-3 px-4">Rank</th>
                                <th className="py-3 px-4">Wallet</th>
                                <th className="py-3 px-4">Tier</th>
                                <th className="py-3 px-4 text-right">Trades</th>
                                <th className="py-3 px-4 text-right">Profit (USD)</th>
                                <th className="py-3 px-4 text-right">ROI (%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-ghost-border">
                            {visibleWallets.map((w, idx) => {
                                const pnlNum = Number(w.pnl_usd || 0);
                                const isPositive = pnlNum >= 0;
                                const isCopied = copiedAddress === w.address;
                                const tier = getTier(w);

                                return (
                                    <tr key={w.address} className="hover:bg-gold-500/[0.03] transition-colors">
                                        <td className="py-3 px-4 font-bold text-gold-500 tabular-nums">#{idx + 1}</td>
                                        <td className="py-3 px-4 text-offwhite flex items-center gap-2">
                                            <span>{w.address.slice(0, 4)}...{w.address.slice(-4)}</span>
                                            
                                            {/* Copy Full Address Button */}
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(w.address)}
                                                className="text-muted hover:text-gold-400 transition-colors p-0.5 cursor-pointer"
                                                title="Copy full wallet address"
                                            >
                                                {isCopied ? (
                                                    <Check size={12} className="text-safe" />
                                                ) : (
                                                    <Copy size={12} />
                                                )}
                                            </button>

                                            {/* Solscan Link */}
                                            <a
                                                href={`https://solscan.io/account/${w.address}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-muted hover:text-gold-400 transition-colors p-0.5"
                                                title="View on Solscan"
                                            >
                                                <ExternalLink size={12} />
                                            </a>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold ${
                                                tier === 'Whale' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                                                tier === 'Mid-Weight' ? 'bg-gold-500/10 text-gold-400 border border-gold-500/30' :
                                                'bg-safe/10 text-safe border border-safe/30'
                                            }`}>
                                                {tier}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right text-muted tabular-nums">{w.trades ?? '—'}</td>
                                        <td className={`py-3 px-4 text-right font-bold tabular-nums ${isPositive ? 'text-safe' : 'text-danger'}`}>
                                            {fmtUsd(pnlNum)}
                                        </td>
                                        <td className="py-3 px-4 text-right text-offwhite tabular-nums">
                                            {fmtRoi(w.roi_pct)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}