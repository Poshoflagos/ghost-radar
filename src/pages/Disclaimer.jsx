export default function Disclaimer() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-black">Disclaimer</h1>
      <div className="card p-6 space-y-4">
        <p>Trench Radar is a research and risk-analysis tool only.</p>
        <p className="muted">It does not provide financial advice, trading advice, or investment recommendations. Memecoins are highly speculative, illiquid, and frequently manipulated. Users can lose their entire balance.</p>
        <p className="muted">Scores indicate signal quality based on available data. They do not predict profit probability or guarantee outcomes. Always verify token contract details, holders, liquidity, deployer behavior, and sellability manually before taking any action.</p>
      </div>
    </div>
  );
}
