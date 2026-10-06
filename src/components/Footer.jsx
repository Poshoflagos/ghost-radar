export default function Footer() {
  return (
    <footer className="border-t mt-10" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6 text-sm muted">
        Trench Radar is a research tool only. Scores are not financial advice, trading advice, or profit guarantees.
      </div>
    </footer>
  );
}
