'use strict';

const CFG = {
  minAgeMin: 4,
  probeUsd: 300,
  beta: 0.75,
  gate: {
    controlled: 0.40,   // union of all flagged supply -> hard zero
    top10: 0.20,        // UPDATED: tightened to 20% to natively catch Cabal Traps
    insider: 0.30,      // supply in RugCheck insider networks
    devHold: 0.15,
    devRugs: 2,
    sellImpactPct: 15,  // can't exit at probe size
    lpUnlocked: 0.20,   // AMM only
    liqToMcap: 0.02,    // AMM only
    wash: 0.85,
  },
  split:  { tol: 0.10, minSize: 6, minPct: 0.15 },  // equal-split (bundle) cluster
  funder: { minGroup: 5 },
  slot:   { window: 2 },                            // buyers within first N slots
  fresh:  { hours: 24, minCount: 8 },
  wash: {
    dustUsd: 3, dustTxShare: 0.45, dustVolShare: 0.08,
    cmLo: 12, cmHi: 60,                              // churn multiple ramp
    loopFlips: 3, loopImbal: 0.20,
    cadence: { minN: 8, cvInt: 0.30, cvSize: 0.15 },
    pairTol: 0.03, pairSec: 3, top5Share: 0.55,
  },
  timing: {
    pullback: { minImpulse: 0.60, rhoLo: 0.25, rhoHi: 0.62, dLo: 0.12, dHi: 0.40,
                minSinceHigh: 3, maxSinceHigh: 45, maxVd: 0.60, minAR: 0.85,
                minOfi5: -0.10, minAboveBase: 0.15, maxE: 1.8 },
    breakout: { maxRange: 0.25, clearance: 0.02, minA: 1.8, minOfi5: 0.25, maxE: 0.45 },
    extended: { E: 1.0, m5: 60, exhaustA: 0.8, exhaustDOfi: -0.15 },
    knife: { dMin: 0.20, points: 3, m5: -20, ofi5: -0.20, ar: 0.6, vd: 0.9,
             heavyOfi: -0.30, liqDrop: -10, whaleSells: 3, dDeep: 0.30, belowBase: 0.95 },
    dead: { h6: -55, vRatio: 0.35, ofi60: -0.05 },
    mult: { PULLBACK: 1.0, BREAKOUT: 0.9, BASE: 0.75, NEUTRAL: 0.6, EXTENDED: 0.3, EXHAUSTION: 0.15, KNIFE: 0.05 },
  },
  lambda: { dev: 1.4, conc: 1.2, wash: 1.0, liq: 0.8, exit: 0.6 },
  verdict: { pullbackS: 0.6, pullbackO: 0.5, pullbackQ: 45, breakoutS: 0.6, breakoutO: 0.55, breakoutQ: 50, washTrend: 0.6 },
};

// ---------- helpers ----------
const clip01 = (x) => Math.max(0, Math.min(1, x));
const sum = (a) => a.reduce((x, y) => x + y, 0);
const mean = (a) => (a.length ? sum(a) / a.length : 0);
const cv = (a) => { const m = mean(a); if (!a.length || m === 0) return Infinity; return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) / m; };
const ramp = (x, lo, hi) => clip01((x - lo) / (hi - lo));
const pct = (x, d = 0) => `${(x * 100).toFixed(d)}%`;

// ---------- PILLAR 1: holder forensics + fatal gates ----------
function equalSplitCluster(hs) {
  const C = CFG.split; let best = { pct: 0, addrs: [] };
  for (const p of hs) {
    if (p.pct <= 0) continue;
    const g = hs.filter((h) => Math.abs(h.pct - p.pct) / p.pct <= C.tol);
    const tot = sum(g.map((h) => h.pct));
    if (g.length >= C.minSize && tot >= C.minPct && tot > best.pct) best = { pct: tot, addrs: g.map((h) => h.addr) };
  }
  return best;
}

function holderForensics(s) {
  const hs = (s.holders || []).filter((h) => !h.isPool).sort((a, b) => b.pct - a.pct);
  const flagged = new Map();
  const mark = (a, r) => { if (!flagged.has(a)) flagged.set(a, new Set()); flagged.get(a).add(r); };
  hs.filter((h) => h.isInsider).forEach((h) => mark(h.addr, 'insider-network'));
  equalSplitCluster(hs).addrs.forEach((a) => mark(a, 'equal-split'));
  const byF = new Map();
  for (const h of hs) { if (!h.funder) continue; if (!byF.has(h.funder)) byF.set(h.funder, []); byF.get(h.funder).push(h); }
  for (const g of byF.values()) if (g.length >= CFG.funder.minGroup) g.forEach((h) => mark(h.addr, 'same-funder'));
  if (s.trades && s.trades.length) {
    const s0 = Math.min(...s.trades.map((t) => t.slot));
    s.trades.filter((t) => t.side === 'buy' && t.slot <= s0 + CFG.slot.window).forEach((t) => mark(t.wallet, 'same-slot'));
  }
  const fresh = hs.filter((h) => h.walletAgeH != null && h.walletAgeH < CFG.fresh.hours);
  if (fresh.length >= CFG.fresh.minCount) fresh.forEach((h) => mark(h.addr, 'fresh-wallet'));
  const controlled = sum(hs.filter((h) => flagged.has(h.addr)).map((h) => h.pct)); // UNION, no double counting
  return {
    top10: sum(hs.slice(0, 10).map((h) => h.pct)),
    insiderPct: sum(hs.filter((h) => h.isInsider).map((h) => h.pct)),
    controlled,
    flaggedCount: flagged.size,
    reasons: [...new Set([...flagged.values()].flatMap((r) => [...r]))],
  };
}

function gates(s, det, wash) {
  const G = CFG.gate, out = [];
  const add = (code, cat, msg, value) => out.push({ code, cat, msg, value });
  if (s.authorities && s.authorities.mintActive) add('MINT_ACTIVE', 'STRUCTURAL', 'Mint authority is active');
  if (s.authorities && s.authorities.freezeActive) add('FREEZE_ACTIVE', 'STRUCTURAL', 'Freeze authority is active');
  if (s.venue === 'amm' && s.lp && s.lp.unlockedPct > G.lpUnlocked) add('LP_UNLOCKED', 'STRUCTURAL', `${pct(s.lp.unlockedPct)} of LP is unlocked`, s.lp.unlockedPct);
  if (s.creator && s.creator.rugs >= G.devRugs) add('SERIAL_RUGGER', 'STRUCTURAL', `Deployer cluster has ${s.creator.rugs} prior rugs`, s.creator.rugs);
  if (s.creator && s.creator.pct >= G.devHold) add('DEV_HOLD', 'STRUCTURAL', `Deployer holds ${pct(s.creator.pct)}`, s.creator.pct);
  if (det.controlled >= G.controlled) add('CABAL_SUPPLY', 'CABAL', `${pct(det.controlled)} of supply sits in linked wallets (${det.reasons.join(', ')})`, det.controlled);
  if (det.insiderPct >= G.insider) add('INSIDER_NET', 'CABAL', `${pct(det.insiderPct)} of supply is in insider networks`, det.insiderPct);
  if (det.top10 >= G.top10) add('TOP10', 'CABAL', `Top 10 holders own ${pct(det.top10)} (excluding pools)`, det.top10);
  if (s.sellImpactPct != null && s.sellImpactPct >= G.sellImpactPct) add('EXIT_TRAP', 'EXIT', `Selling $${CFG.probeUsd} moves price ${s.sellImpactPct.toFixed(1)}%`, s.sellImpactPct);
  if (s.venue === 'amm' && s.mcap > 0 && s.liqUsd / s.mcap < G.liqToMcap) add('THIN_POOL', 'EXIT', `Pool depth is only ${pct(s.liqUsd / s.mcap, 1)} of market cap`, s.liqUsd / s.mcap);
  if (wash.omega >= G.wash) add('WASH_TRAP', 'WASH', `About ${pct(wash.omega)} of volume looks artificial`, wash.omega);
  return out;
}

// ---------- PILLAR 3: wash-trading filter ----------
function washFromTrades(trades, liqUsd) {
  const C = CFG.wash, Q = liqUsd / 2, sorted = [...trades].sort((a, b) => a.t - b.t), n = sorted.length;
  const W = new Map(); let gross = 0, buyU = 0, sellU = 0, buyN = 0, dustN = 0, dustVol = 0;
  for (const x of sorted) {
    gross += x.usd;
    if (x.side === 'buy') { buyU += x.usd; buyN++; } else sellU += x.usd;
    if (x.usd < C.dustUsd) { dustN++; dustVol += x.usd; }
    let w = W.get(x.wallet);
    if (!w) { w = { b: 0, s: 0, flips: 0, last: null, ts: [], us: [] }; W.set(x.wallet, w); }
    if (x.side === 'buy') w.b += x.usd; else w.s += x.usd;
    if (w.last && w.last !== x.side) w.flips++;
    w.last = x.side; w.ts.push(x.t); w.us.push(x.usd);
  }
  let loop = 0, cadence = 0;
  for (const w of W.values()) {
    const tot = w.b + w.s; if (!tot) continue;
    if (w.flips >= C.loopFlips && Math.abs(w.b - w.s) / tot < C.loopImbal) loop += 2 * Math.min(w.b, w.s);
    if (w.ts.length >= C.cadence.minN) {
      const iv = w.ts.slice(1).map((t, i) => t - w.ts[i]);
      if (cv(iv) < C.cadence.cvInt && cv(w.us) < C.cadence.cvSize) cadence += tot;
    }
  }
  let linked = 0;
  for (let i = 0; i < n; i++) {
    const a = sorted[i]; if (a.side !== 'sell' || !a.group) continue;
    for (let j = 0; j < n; j++) {
      const b = sorted[j];
      if (b.side !== 'buy' || b.group !== a.group || b.wallet === a.wallet) continue;
      if (Math.abs(b.t - a.t) <= C.pairSec && Math.abs(b.usd - a.usd) / a.usd <= C.pairTol) { linked += a.usd + b.usd; break; }
    }
  }
  const direct = clip01((loop + cadence + linked) / Math.max(gross, 1));
  const cm = gross / Math.max(Math.abs(buyU - sellU), 0.005 * Q, 1);
  const churn = 0.7 * ramp(Math.log10(cm), Math.log10(C.cmLo), Math.log10(C.cmHi));
  const sym = Math.abs(buyN - (n - buyN)) / n < 0.1;
  const dust = dustN / n >= C.dustTxShare && dustVol / gross <= C.dustVolShare && sym ? 0.5 : 0;
  const top5 = sum([...W.values()].map((w) => w.b + w.s).sort((a, b) => b - a).slice(0, 5)) / Math.max(gross, 1);
  const parts = [direct, churn, dust, top5 >= C.top5Share ? 0.4 : 0];
  const mx = Math.max(...parts);
  const omega = clip01(mx + 0.10 * parts.filter((p) => p >= 0.3 && p !== mx).length);
  return { omega, conf: 'high', src: 'trades', churnMultiple: cm, top5Share: top5, parts: { direct, churn, dust } };
}

function washFromSnapshot(s) {
  const C = CFG.wash, Q = s.liqUsd / 2, b = s.tx.h1.b, sl = s.tx.h1.s, n = b + sl, vol = s.vol.h1;
  if (n < 20 || vol <= 0 || Q <= 0) return { omega: 0, conf: 'low', src: 'snapshot' };
  const pc = Math.max(s.pc.h1, -99) / 100;
  const required = Math.max(Math.abs(Math.sqrt(1 + pc) - 1), 0.01); 
  const cm = vol / Q / required;
  const sym = 1 - Math.abs(b - sl) / n;
  let omega = ramp(Math.log10(cm), Math.log10(C.cmLo), Math.log10(C.cmHi)) * (0.6 + 0.4 * ramp(sym, 0.8, 1));
  if (vol / n < C.dustUsd * 2) omega += 0.15;
  return { omega: Math.min(omega, 0.9), conf: 'low', src: 'snapshot', churnMultiple: cm };
}

// ---------- PILLAR 2: order flow + timing ----------
function orderFlow(s) {
  const cnt = (x) => { const n = x.b + x.s; return n ? (x.b - x.s) / n : 0; };
  const o5c = cnt(s.tx.m5), o60c = cnt(s.tx.h1);
  if (!s.trades || !s.trades.length) return { ofi5: o5c, ofi60: o60c, dOFI: o5c - o60c, divergence: 0, sizeRatio: 0, whaleSells: 0, src: 'counts' };
  const now = Math.max(...s.trades.map((t) => t.t)), Q = s.liqUsd / 2;
  const agg = (sec) => {
    const r = { b: 0, sv: 0, bn: 0, sn: 0, whale: 0 };
    for (const t of s.trades) {
      if (now - t.t > sec) continue;
      if (t.side === 'buy') { r.b += t.usd; r.bn++; } else { r.sv += t.usd; r.sn++; if (t.usd >= 0.0075 * Q) r.whale++; }
    }
    return r;
  };
  const u = (a) => { const d = a.b + a.sv; return d ? (a.b - a.sv) / d : 0; };
  const a5 = agg(300), a60 = agg(3600), ofi5 = u(a5), ofi60 = u(a60);
  const avgB = a5.bn ? a5.b / a5.bn : 0, avgS = a5.sn ? a5.sv / a5.sn : 0;
  return { ofi5, ofi60, dOFI: ofi5 - ofi60, divergence: o5c - ofi5, sizeRatio: avgB ? avgS / avgB : 0, whaleSells: a5.whale, src: 'trades' };
}

function distribution(s, det, of) {
  const why = [];
  if (of.divergence >= 0.25) why.push('many small buys but sell dollars dominate');
  if (of.sizeRatio >= 2) why.push('average sell is 2x+ the average buy');
  if (s.prevControlled != null && det.controlled - s.prevControlled <= -0.04) why.push('linked-wallet supply is shrinking');
  const A = s.vol.h1 > 0 ? (s.vol.m5 * 12) / s.vol.h1 : 1;
  if (s.pc.h1 >= 50 && Math.abs(s.pc.m5) <= 3 && A < 0.9) why.push('price stalled after a run on fading volume');
  return { points: why.length, flag: why.length >= 2, why };
}

function timing(s, of) {
  const T = CFG.timing, c = s.candles;
  const AR = (1 + of.ofi5) / Math.max(1 - of.ofi5, 0.05);
  let A = s.vol.h1 > 0 ? (s.vol.m5 * 12) / s.vol.h1 : 1;
  let m = { mode: 'coarse', E: s.pc.h1 / 100, D: Math.max(0, -s.pc.m5 / 100), impulse: s.pc.h1 / 100, rho: null, msh: null, vd: 0, cons: null };

  if (c && c.length >= 30) {
    const w = c.slice(-90);
    let hi = 0; w.forEach((k, i) => { if (k.h >= w[hi].h) hi = i; });
    const pre = w.slice(0, hi + 1);
    let lo = 0; pre.forEach((k, i) => { if (k.l <= pre[lo].l) lo = i; });
    const H = w[hi].h, B = pre[lo].l, P = w[w.length - 1].c;
    const after = w.slice(hi + 1), avgV = (a) => (a.length ? mean(a.map((k) => k.v)) : 0);
    const impVol = avgV(w.slice(lo, hi + 1)), pbVol = avgV(after);
    const bw = w.slice(-32, -2), bHi = Math.max(...bw.map((k) => k.h)), bLo = Math.min(...bw.map((k) => k.l));
    const v5 = sum(w.slice(-5).map((k) => k.v)), v60 = sum(w.slice(-60).map((k) => k.v));
    if (v60 > 0) A = (v5 * 12) / v60;
    m = {
      mode: 'candles', H, B, P,
      impulse: H / B - 1, D: 1 - P / H, E: P / B - 1,
      rho: H > B ? (H - P) / (H - B) : 0,
      msh: w.length - 1 - hi,
      vd: impVol > 0 && after.length ? pbVol / impVol : 0,
      pullbackLow: after.length ? Math.min(...after.map((k) => k.l)) : P,
      cons: { range: bHi / bLo - 1, brokeOut: P > bHi * (1 + T.breakout.clearance), Eb: P / bLo - 1, baseLow: bLo },
    };
  }

  let ds = 0; const dsWhy = [];
  const hit = (cond, msg) => { if (cond) { ds++; dsWhy.push(msg); } };
  hit(AR < T.knife.ar, `sell dollars outweigh buys (absorption ${AR.toFixed(2)}x)`);
  hit(m.vd >= T.knife.vd, 'selling volume matches the pump volume');
  hit(of.ofi5 <= T.knife.heavyOfi, `flow imbalance ${of.ofi5.toFixed(2)}`);
  hit((s.liqChange15Pct || 0) <= T.knife.liqDrop, 'pool depth shrinking');
  hit((of.whaleSells || 0) >= T.knife.whaleSells, 'repeated large sells into the pool');
  hit(m.D >= T.knife.dDeep, `${pct(m.D)} off the high`);

  const dead = (s.pc.h6 <= T.dead.h6 || (m.mode === 'candles' && m.D >= 0.55)) &&
    s.vol.h6 > 0 && s.vol.h1 / (s.vol.h6 / 6) <= T.dead.vRatio && of.ofi60 <= T.dead.ofi60;

  let zone = 'NEUTRAL';
  const K = T.knife, P_ = T.pullback, B_ = T.breakout, X = T.extended;
  if ((m.D >= K.dMin && ds >= K.points) || (m.mode === 'candles' && m.P < m.B * K.belowBase && of.ofi5 < 0) || (s.pc.m5 <= K.m5 && of.ofi5 <= K.ofi5)) {
    zone = 'KNIFE';
  } else if (m.mode === 'candles' && m.impulse >= P_.minImpulse && m.rho >= P_.rhoLo && m.rho <= P_.rhoHi &&
    m.D >= P_.dLo && m.D <= P_.dHi && m.msh >= P_.minSinceHigh && m.msh <= P_.maxSinceHigh &&
    m.vd <= P_.maxVd && AR >= P_.minAR && of.ofi5 >= P_.minOfi5 && m.E >= P_.minAboveBase && m.E <= P_.maxE) {
    zone = 'PULLBACK';
  } else if (m.mode === 'candles' && m.cons.range <= B_.maxRange && m.cons.brokeOut &&
    A >= B_.minA && of.ofi5 >= B_.minOfi5 && m.cons.Eb <= B_.maxE) {
    zone = 'BREAKOUT';
  } else if (m.E >= X.E || s.pc.m5 >= X.m5) {
    const exhausted = A < X.exhaustA || of.dOFI < X.exhaustDOfi;
    zone = exhausted ? 'EXHAUSTION' : 'EXTENDED';
  } else if (m.mode === 'candles' && m.cons.range <= B_.maxRange) {
    zone = 'BASE';
  }
  return { ...m, A, AR, ds, dsWhy, dead, zone, mult: T.mult[zone] };
}

// ---------- survival multiplier (hybrid Ghost Score) ----------
function survival(s, det, wash, dist) {
  const L = CFG.lambda, cr = s.creator || { rugs: 0, launches: 0 };
  const liqRatio = s.mcap > 0 ? s.liqUsd / s.mcap : 0;
  const r = {
    dev: (cr.rugs + 2.4) / (cr.launches + 4),
    conc: clip01((det.controlled - 0.15) / 0.30),
    wash: clip01((wash.omega - 0.30) / 0.50),
    liq: s.lp && s.lp.unlockedPct > 0.2 ? 0.8 : clip01(1 - liqRatio / 0.15),
    exit: clip01(dist.points / 3),
  };
  const penalty = sum(Object.keys(r).map((k) => L[k] * r[k] ** 2));
  return { S: Math.exp(-penalty), r };
}

// ---------- PILLAR 4: verdict matrix ----------
function verdict(c) {
  const { s, det, wash, dist, G, tm, S, O, quality, of } = c, V = CFG.verdict;
  const mk = (code, title, tag, advice) => ({ code, title, tag, advice });
  const tel = s.telemetrySignals || {}; 

  if (s.ageMin < CFG.minAgeMin) return mk('TOO_EARLY', 'TOO EARLY: INSUFFICIENT DATA', 'WAIT', `Only ${s.ageMin.toFixed(1)} min of history. Bundles and snipers have not shown their hand yet. Re-scan after ${CFG.minAgeMin} minutes.`);

  if (G.length) {
    const pick = (cat) => G.find((g) => g.cat === cat);
    const st = pick('STRUCTURAL'), cb = pick('CABAL'), ex = pick('EXIT'), ws = pick('WASH');
    if (st) return mk('STRUCTURAL_RUG_RISK', 'STRUCTURAL RUG RISK', 'AVOID', `${st.msg}. The contract or deployer gives the team a direct way to hurt holders. Hard-gated to 0.`);
    if (cb) return mk('CABAL_SUPPLY_TRAP', 'CABAL SUPPLY TRAP', 'AVOID', `${cb.msg}. A clean contract does not matter when one operator can dump most of the float. Hard-gated to 0.`);
    if (ex) return mk('EXIT_LIQUIDITY_TRAP', 'EXIT LIQUIDITY TRAP', 'AVOID', `${ex.msg}. You could get in, but not out at size. Hard-gated to 0.`);
    if (ws) return mk('WASHED_VOLUME_TRAP', 'WASHED VOLUME TRAP', 'AVOID', `${ws.msg}. The trending volume is manufactured. Hard-gated to 0.`);
  }

  // Alpha Extension string
  const alphaStr = tel.smartMoneyConvergence?.trackedWalletsCount > 0
    ? ` Alpha Convergence: ${tel.smartMoneyConvergence.trackedWalletsCount} tracked smart wallets have entered.`
    : '';

  // 1. ZOMBIE OVERRIDE
  if (tel.isZombieRevival) {
    return mk('ZOMBIE_REVIVAL', 'DORMANT CTO DETECTED', 'PRIME', `Token was inactive for ${tel.zombieDormancyDays} days before a massive baseline volume spike. High probability of community takeover or viral revival.${alphaStr}`);
  }

  if (dist.flag && (det.controlled >= 0.15 || (s.prevControlled || 0) >= 0.15))
    return mk('CABAL_DISTRIBUTION_TRAP', 'CABAL DISTRIBUTION TRAP', 'AVOID', `Linked wallets holding ${pct(det.controlled)} are selling into retail demand: ${dist.why.join('; ')}. Price is being held up while supply changes hands. You would be the exit liquidity.`);
  if (tm.zone === 'KNIFE')
    return mk('FALLING_KNIFE', 'FALLING KNIFE: LIQUIDITY DEATH SPIRAL', 'AVOID', `${pct(tm.D)} off the high with no replacement bids: ${tm.dsWhy.join('; ') || 'price lost its base'}. Do not average down. Wait for a higher low with buy dollars returning.`);
  if (tm.dead)
    return mk('DEAD_BLEED', 'DEAD BLEED', 'AVOID', `Down ${Math.abs(s.pc.h6).toFixed(0)}% over 6h with volume at ${pct(s.vol.h1 / (s.vol.h6 / 6))} of its 6h average and sellers still ahead. No demand is coming back.`);
  if (wash.omega >= V.washTrend)
    return mk('WASHED_TREND', 'WASHED TREND: VOLUME NOT REAL', 'AVOID', `About ${pct(wash.omega)} of volume is churn (${wash.churnMultiple ? wash.churnMultiple.toFixed(0) + 'x gross-to-net' : 'loops and repeat patterns'}). Trending status is likely bought. Ignore the volume and re-check when organic flow shows up.`);
  
  if (tm.zone === 'EXHAUSTION' || tm.zone === 'EXTENDED') {
    const why = tm.zone === 'EXHAUSTION' ? 'volume and flow are fading while price is stretched' : 'momentum is still strong but you would be buying the stretch';
    return mk('OVEREXTENDED_TOP', 'OVEREXTENDED TOP: WAIT', 'WAIT', `Price is ${pct(tm.E)} above its base; ${why}. Late entries here feed early-holder profit taking. Wait for a 25-60% retrace on light volume.${alphaStr}`);
  }
  if (tm.zone === 'PULLBACK' && S >= V.pullbackS && O >= V.pullbackO && quality >= V.pullbackQ)
    return mk('PRIME_PULLBACK', 'PRIME PULLBACK ENTRY', 'ENTER', `Pulled back ${pct(tm.D)} from the high (${pct(tm.rho)} retrace of the run) on ${pct(tm.vd)} of the run's volume, with buy/sell absorption at ${tm.AR.toFixed(2)}x and clean supply. Invalidation: a close below ${tm.pullbackLow ? (tm.pullbackLow * 0.95).toPrecision(4) : 'the pullback low'}.${alphaStr}`);
  if (tm.zone === 'BREAKOUT' && S >= V.breakoutS && O >= V.breakoutO && quality >= V.breakoutQ)
    return mk('MOMENTUM_BREAKOUT', 'MOMENTUM BREAKOUT', 'ENTER_SMALL', `Broke a tight ${pct(tm.cons.range)} range on ${tm.A.toFixed(1)}x volume acceleration with buy-dollar dominance (${of.ofi5.toFixed(2)}), only ${pct(tm.cons.Eb)} above the base. Breakouts fail more often than pullbacks; size down. Invalidation: back inside the range, below ${tm.cons.baseLow.toPrecision(4)}.${alphaStr}`);
  if (tm.zone === 'BASE')
    return mk('ACCUMULATION_BASE', 'ACCUMULATION BASE: WATCHLIST', 'WATCH', `Tight ${pct(tm.cons.range)} range with no breakout yet. Set an alert for a close above the range high with volume acceleration of 1.8x or more.${alphaStr}`);
  return mk('NO_EDGE', 'NO EDGE: LOW CONVICTION', 'WAIT', `Quality ${quality.toFixed(0)} (S ${S.toFixed(2)}, O ${O.toFixed(2)}) with no qualifying entry structure (zone: ${tm.zone}${tm.mode === 'coarse' ? ', coarse mode: no candles' : ''}).${alphaStr}`);
}

// ---------- entry point ----------
function xray(s, base = {}) {
  const det = holderForensics(s);
  const wash = s.trades && s.trades.length >= 40 ? washFromTrades(s.trades, s.liqUsd) : washFromSnapshot(s);
  const of = orderFlow(s);
  const dist = distribution(s, det, of);
  const G = gates(s, det, wash);
  const tm = timing(s, of);
  const { S, r } = survival(s, det, wash, dist);
  const O = base.O != null ? base.O : 0.5; 
  const floored = S < 0.5 || O < 0.5;
  const quality = G.length || floored ? 0 : 100 * S * Math.pow(O, CFG.beta);
  const entry = quality * tm.mult;
  const v = verdict({ s, det, wash, dist, G, tm, S, O, quality, of });
  return { verdict: v, quality: Math.round(quality), entryScore: Math.round(entry), S, O, r, gates: G, controlled: det.controlled, washOmega: wash.omega, washConf: wash.conf, zone: tm.zone, timing: tm, flow: of, distribution: dist };
}

export { xray, CFG, holderForensics, washFromTrades, washFromSnapshot, orderFlow, timing, gates, verdict };