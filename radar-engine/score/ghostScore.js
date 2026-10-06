/**
 * radar-engine/score/ghostScore.js
 * PURE FUNCTION: Score = 100 * S * (O ^ beta)
 * v1.2.0: floors and the market cap band are params, and every failure says
 * whether it is HARD (reject the token) or SOFT (keep watching it).
 */

const ENGINE_VERSION = 'v1.2.0';

export const defaultParams = {
    version: ENGINE_VERSION,
    beta: 0.75,
    mcapMin: 5000,
    mcapMax: 150000,
    floors: { S: 0.50, O: 0.30, maxRisk: 0.85 },   // O floor was 0.50
    lambda: { dev: 1.4, conc: 1.2, bundle: 1.0, wash: 1.0, liq: 0.8, exit: 0.6 },
    w: {
        smartConfluence: 0.30,
        organicVelocity: 0.25,
        holderSlopeNet: 0.15,
        buyQuality: 0.15,
        entryExtension: 0.10,
        devEdge: 0.05
    }
};

const clip = (val, min, max) => Math.max(min, Math.min(max, val));

export function score(f, params = defaultParams) {
    const { lambda, w, beta, version } = params;
    const floors = params.floors || defaultParams.floors;
    const mcapMin = params.mcapMin ?? defaultParams.mcapMin;
    const mcapMax = params.mcapMax ?? defaultParams.mcapMax;

    const hard = (msg) => ({ score: 0, gateFailed: msg, hard: true });
    const soft = (msg, extra = {}) => ({ score: 0, gateFailed: msg, hard: false, ...extra });

    // 1. GATES
    if (f.isGraduated && f.sellSimulationFailed) return hard('Sells Blocked');
    if (!f.isPumpCurve && (f.mintActive || f.freezeActive)) return hard('Mint/Freeze Active');
    if (f.isGraduated && f.lpUnlocked) return hard('LP Unlocked');
    if (f.devClusterRugs >= 2) return hard('Serial Rug Deployer');
    if (f.topClusterPct > 0.45) return hard('Supply Concentration >45%');
    if (f.mcap > mcapMax) return hard('Market Cap Above Band');
    if (f.mcap < mcapMin) return soft('Market Cap Below Band'); // can still grow into the band

    // 2. SURVIVAL MULTIPLIER (S)
    const r = {
        dev: (f.devClusterRugs + 2.4) / (f.devClusterLaunches + 4),
        conc: clip((f.topClusterPct - 0.15) / 0.30, 0, 1),
        bundle: clip(f.bundledSupplyPct / 0.30, 0, 1),
        wash: clip((f.washRatio - 0.30) / 0.50, 0, 1),
        liq: f.lpUnlocked ? 0.8 : clip(1 - (f.realLiqToMcap / 0.15), 0, 1),
        exit: f.exitQualityRisk
    };

    let penalty = 0;
    const penaltyDetails = [];
    for (const key in r) {
        const p = lambda[key] * Math.pow(r[key], 2);
        penalty += p;
        penaltyDetails.push({ key, val: p });
    }
    const S = Math.exp(-penalty);

    // 3. OPPORTUNITY SURFACE (O)
    const O = (w.smartConfluence * f.smartConfluence) +
              (w.organicVelocity * f.organicVelocity) +
              (w.holderSlopeNet * f.holderSlopeNet) +
              (w.buyQuality * f.buyQuality) +
              (w.entryExtension * f.entryExtension) +
              (w.devEdge * f.devEdge);

    // 4. FLOORS (soft: the token keeps being monitored)
    const maxRisk = Math.max(...Object.values(r));
    if (S < floors.S || O < floors.O || maxRisk > floors.maxRisk) {
        return soft(`Floor S=${S.toFixed(2)} O=${O.toFixed(2)} R=${maxRisk.toFixed(2)}`, { S, O, r });
    }

    // 5. FINAL SCORE
    let finalScore = 100 * S * Math.pow(O, beta);
    if (f.isCabal) finalScore *= 0.50;
    if (f.isZombieRevival) finalScore = Math.min(100, finalScore + 50);

    penaltyDetails.sort((a, b) => b.val - a.val);
    const topRisks = penaltyDetails.slice(0, 3).map((x) => x.key);

    const topDrivers = [
        { key: 'smartConfluence', val: w.smartConfluence * f.smartConfluence },
        { key: 'organicVelocity', val: w.organicVelocity * f.organicVelocity },
        { key: 'holderSlopeNet', val: w.holderSlopeNet * f.holderSlopeNet },
        { key: 'buyQuality', val: w.buyQuality * f.buyQuality },
        { key: 'entryExtension', val: w.entryExtension * f.entryExtension },
        { key: 'devEdge', val: w.devEdge * f.devEdge }
    ].sort((a, b) => b.val - a.val).slice(0, 3).map((x) => x.key);

    return {
        score: Math.max(0, Math.min(100, Math.floor(finalScore))),
        S, O, r, gateFailed: null, hard: false, topRisks, topDrivers,
        version, confidenceFlags: f.confidenceFlags || []
    };
}