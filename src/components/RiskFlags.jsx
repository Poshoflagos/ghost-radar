export default function RiskFlags({ flags = [] }) {
  if (!flags.length) return <p className="muted">No major v1 flags from available data. Manual checks still required.</p>;
  return (
    <div className="space-y-2">
      {flags.map((flag, index) => (
        <div key={index} className="p-3 rounded-xl border text-sm" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          {flag}
        </div>
      ))}
    </div>
  );
}
