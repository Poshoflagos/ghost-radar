export default function ScoreBadge({ label, score }) {
  const color = score >= 80 ? 'var(--primary)' : score >= 60 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="card p-4">
      <div className="muted text-sm">{label}</div>
      <div className="text-3xl font-black" style={{ color }}>{score}/100</div>
    </div>
  );
}
