import { useState } from 'react';
import RadarTable from '../components/RadarTable.jsx';

export default function Radar() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadRadar() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/.netlify/functions/radar');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Radar failed');
      setReports(data.candidates || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black">Live Radar</h1>
          <p className="muted mt-2 max-w-3xl">Experimental feed based on available DexScreener boosted data. Coverage is incomplete; use this as a research queue, not a market-wide scanner.</p>
        </div>
        <button className="btn-primary" onClick={loadRadar} disabled={loading}>{loading ? 'Loading...' : 'Refresh Radar'}</button>
      </div>
      {error && <div className="card p-4" style={{ borderColor: 'var(--danger)' }}>{error}</div>}
      <RadarTable reports={reports} />
    </div>
  );
}
