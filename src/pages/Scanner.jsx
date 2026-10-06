import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import TokenReportCard from '../components/TokenReportCard.jsx';
import { formatTelegramMessage } from '../utils/telegram.js';

export default function Scanner() {
  const location = useLocation();
  const [tokenAddress, setTokenAddress] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [telegramStatus, setTelegramStatus] = useState('');

  // Auto-scan if an address was passed via router state from Alpha Zone
  useEffect(() => {
    if (location.state?.autoAddress) {
      const incomingAddr = location.state.autoAddress;
      setTokenAddress(incomingAddr);
      executeScan(incomingAddr);
    }
  }, [location.state]);

  async function executeScan(addressToScan) {
    if (!addressToScan || !addressToScan.trim()) return;
    setLoading(true);
    setError('');
    setTelegramStatus('');
    setReport(null);

    try {
      const res = await fetch('/.netlify/functions/scan-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress: addressToScan.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Scan failed');
      setReport(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function scanToken(e) {
    e.preventDefault();
    executeScan(tokenAddress);
  }

  async function sendToTelegram(currentReport) {
    setSending(true);
    setTelegramStatus('');
    try {
      const res = await fetch('/.netlify/functions/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: formatTelegramMessage(currentReport) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Telegram send failed');
      setTelegramStatus('Telegram research alert sent.');
    } catch (err) {
      setTelegramStatus(`Telegram error: ${err.message}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-black">Token Scanner</h1>
        <p className="muted mt-2">Paste a Solana token address. The scanner will fetch DexScreener data and generate a v1 risk report.</p>
      </div>

      <form onSubmit={scanToken} className="card p-4 flex flex-col md:flex-row gap-3">
        <input
          className="flex-1 rounded-xl px-4 py-3 outline-none border"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text)' }}
          placeholder="Paste Solana token address"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
        />
        <button className="btn-primary" disabled={loading || !tokenAddress.trim()}>{loading ? 'Scanning...' : 'Scan Token'}</button>
      </form>

      {error && <div className="card p-4" style={{ borderColor: 'var(--danger)' }}>{error}</div>}
      {telegramStatus && <div className="card p-4 muted">{telegramStatus}</div>}
      <TokenReportCard report={report} onSendTelegram={sendToTelegram} sending={sending} />
    </div>
  );
}