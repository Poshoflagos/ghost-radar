import { Link } from 'react-router-dom';
import { formatAge, formatUsd } from '../utils/formatting.js';

export default function RadarTable({ reports = [] }) {
  if (!reports.length) {
    return <div className="card p-6 muted">No radar candidates loaded yet. Use the refresh button or scan tokens manually.</div>;
  }

  return (
    <div className="overflow-x-auto card">
      <table className="w-full text-sm">
        <thead style={{ background: 'var(--surface-2)' }}>
          <tr className="text-left">
            <Th>Rank</Th><Th>Token</Th><Th>Verdict</Th><Th>Risk</Th><Th>Runner</Th><Th>FDV</Th><Th>Liq.</Th><Th>Age</Th><Th>Link</Th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r, i) => (
            <tr key={`${r.token.address}-${i}`} className="border-t" style={{ borderColor: 'var(--border)' }}>
              <Td>#{i + 1}</Td>
              <Td><b>${r.token.symbol}</b><div className="muted text-xs">{r.token.name}</div></Td>
              <Td>{r.scores.verdict}</Td>
              <Td>{r.scores.riskScore}</Td>
              <Td>{r.scores.runnerScore}</Td>
              <Td>{formatUsd(r.market.fdv)}</Td>
              <Td>{formatUsd(r.market.liquidity)}</Td>
              <Td>{formatAge(r.pair.ageMinutes)}</Td>
              <Td><a className="font-bold" style={{ color: 'var(--primary)' }} href={r.links.dexScreener} target="_blank" rel="noreferrer">Open</a></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Th({ children }) { return <th className="p-3 font-bold muted">{children}</th>; }
function Td({ children }) { return <td className="p-3 align-top">{children}</td>; }
