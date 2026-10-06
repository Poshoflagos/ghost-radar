export default function Methodology() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-black">Methodology</h1>
      <section className="card p-6 space-y-4">
        <h2 className="text-2xl font-black">Risk Score</h2>
        <p className="muted">Starts at 100 and subtracts penalties for thin liquidity, stretched FDV/liquidity ratio, very young pairs, no sell activity, one-sided buy flow, extreme volume/liquidity ratios, extended price moves, and missing profile data.</p>
      </section>
      <section className="card p-6 space-y-4">
        <h2 className="text-2xl font-black">Runner Score</h2>
        <p className="muted">Adds points for usable liquidity, healthy volume momentum, balanced buy/sell behavior, favorable FDV zone, pair age, price momentum, profile presence, and acceptable risk score.</p>
      </section>
      <section className="card p-6 space-y-4">
        <h2 className="text-2xl font-black">Limitations</h2>
        <p className="muted">V1 does not fully automate holder concentration, deployer history, bundled supply detection, or sell simulations. Manual checks through Solscan/RugCheck/Birdeye are still required.</p>
      </section>
    </div>
  );
}
