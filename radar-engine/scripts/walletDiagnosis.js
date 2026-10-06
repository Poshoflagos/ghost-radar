// radar-engine/scripts/walletDiagnosis.js
import { Connection, PublicKey } from '@solana/web3.js';

// Dynamic connection helper ensures HELIUS_API_KEY is read after dotenv loads
function getSolanaConnection() {
    const apiKey = process.env.HELIUS_API_KEY;
    const endpoint = apiKey 
        ? `https://mainnet.helius-rpc.com/?api-key=${apiKey}`
        : 'https://api.mainnet-beta.solana.com';
    return new Connection(endpoint, 'confirmed');
}

const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// Helper function to format raw seconds into a sleek UI string (e.g., "45s", "2h 15m")
function formatHoldTime(seconds) {
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
}

// ---------------------------------------------------------
// ON-CHAIN PARSER (BALANCE DELTA ANALYSIS)
// Reads raw transaction receipts and reconstructs trades
// ---------------------------------------------------------
async function analyzeTrades(conn, walletAddress, signatures) {
    if (!signatures || signatures.length === 0) {
        return { winRateNum: 0, medianHoldSecs: 0, scalingFreqNum: 0 };
    }

    try {
        const sigStrings = signatures.map(s => s.signature);
        const txs = [];

        // Fetch 5 at a time to respect free RPC rate limits while scanning deep
        for (let i = 0; i < sigStrings.length; i += 5) {
            const batch = sigStrings.slice(i, i + 5);
            try {
                const batchTxs = await conn.getParsedTransactions(batch, {
                    maxSupportedTransactionVersion: 0
                });
                if (Array.isArray(batchTxs)) {
                    txs.push(...batchTxs);
                }
            } catch (rpcErr) {
                console.warn(`[Wallet Checkup] Batch RPC notice: ${rpcErr.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const tokens = {};

        for (const tx of txs) {
            if (!tx || !tx.meta || tx.meta.err) continue;

            const timestamp = tx.blockTime ? tx.blockTime * 1000 : Date.now();

            const accountKeys = tx.transaction?.message?.accountKeys || [];
            const accountIndex = accountKeys.findIndex((key) => {
                const pk = key?.pubkey 
                    ? (typeof key.pubkey.toBase58 === 'function' ? key.pubkey.toBase58() : key.pubkey.toString()) 
                    : (key ? key.toString() : '');
                return pk === walletAddress;
            });

            if (accountIndex === -1) continue;

            // 1. Calculate Native SOL balance change
            const preSol = tx.meta.preBalances?.[accountIndex] || 0;
            const postSol = tx.meta.postBalances?.[accountIndex] || 0;
            const nativeSolChange = (postSol - preSol) / 1e9;

            // 2. Identify token balance changes
            const preTokenBalances = tx.meta.preTokenBalances || [];
            const postTokenBalances = tx.meta.postTokenBalances || [];

            const walletPreTokens = preTokenBalances.filter(b => b.owner === walletAddress);
            const walletPostTokens = postTokenBalances.filter(b => b.owner === walletAddress);

            // 3. Capture Wrapped SOL (WSOL) changes to fix Raydium/Jupiter routing
            const preWsol = walletPreTokens.find(t => t.mint === WSOL_MINT)?.uiTokenAmount?.uiAmount || 0;
            const postWsol = walletPostTokens.find(t => t.mint === WSOL_MINT)?.uiTokenAmount?.uiAmount || 0;
            const wsolChange = postWsol - preWsol;
            
            // True capital movement regardless of WSOL vs SOL
            const effectiveSolChange = nativeSolChange + wsolChange;

            const mints = new Set([
                ...walletPreTokens.map(t => t.mint),
                ...walletPostTokens.map(t => t.mint)
            ]);

            mints.forEach(mint => {
                if (mint === WSOL_MINT) return; // Handled in effectiveSolChange above

                const preAmount = walletPreTokens.find(t => t.mint === mint)?.uiTokenAmount?.uiAmount || 0;
                const postAmount = walletPostTokens.find(t => t.mint === mint)?.uiTokenAmount?.uiAmount || 0;
                const tokenDelta = postAmount - preAmount;

                if (Math.abs(tokenDelta) > 0.000001) {
                    if (!tokens[mint]) tokens[mint] = { buys: [], sells: [] };

                    if (tokenDelta > 0 && effectiveSolChange < 0) {
                        // Token UP, Capital DOWN -> BUY
                        tokens[mint].buys.push({
                            amount: tokenDelta,
                            solSpent: Math.abs(effectiveSolChange),
                            time: timestamp
                        });
                    } else if (tokenDelta < 0 && effectiveSolChange > 0) {
                        // Token DOWN, Capital UP -> SELL
                        tokens[mint].sells.push({
                            amount: Math.abs(tokenDelta),
                            solReceived: effectiveSolChange,
                            time: timestamp
                        });
                    }
                }
            });
        }

        // 4. Compute metrics
        let winningTrades = 0;
        let completedTrades = 0;
        const holdTimes = [];
        let multipleEntries = 0;
        let tokensTraded = 0;

        Object.values(tokens).forEach(token => {
            if (token.buys.length > 0 || token.sells.length > 0) tokensTraded++;

            if (token.buys.length > 0 && token.sells.length > 0) {
                completedTrades++;

                const totalSpent = token.buys.reduce((sum, b) => sum + b.solSpent, 0);
                const totalReceived = token.sells.reduce((sum, s) => sum + s.solReceived, 0);

                if (totalReceived > totalSpent) winningTrades++;

                const firstBuy = Math.min(...token.buys.map(b => b.time));
                const firstSell = Math.min(...token.sells.map(s => s.time));

                if (firstSell > firstBuy) {
                    // Calculate hold time in exact seconds for higher precision
                    holdTimes.push((firstSell - firstBuy) / 1000); 
                }
            }

            if (token.buys.length > 1 || token.sells.length > 1) multipleEntries++;
        });

        const winRateNum = completedTrades > 0
            ? parseFloat(((winningTrades / completedTrades) * 100).toFixed(1))
            : 0;

        const medianHoldSecs = holdTimes.length > 0
            ? Math.round(holdTimes.sort((a, b) => a - b)[Math.floor(holdTimes.length / 2)])
            : 0;

        const scalingFreqNum = tokensTraded > 0
            ? Math.round((multipleEntries / tokensTraded) * 100)
            : 0;

        return { winRateNum, medianHoldSecs, scalingFreqNum, completedTrades, totalRawTransactions: txs.length };

    } catch (err) {
        console.error("Trade analysis parsing error:", err.message);
        return { winRateNum: 0, medianHoldSecs: 0, scalingFreqNum: 0, completedTrades: 0, totalRawTransactions: 0 };
    }
}

// ---------------------------------------------------------
// ARCHETYPE ROSTER
// Checked top to bottom — first match wins.
// ---------------------------------------------------------
function classifyArchetype(m) {
    const { winRate, medianHold, scalingFreq, totalTxCount, balanceSOL } = m;

    if (totalTxCount === 0) return "The Dormant Ghost";
    if (winRate >= 65 && scalingFreq >= 50 && medianHold >= 20 && medianHold <= 90) return "The Ghost in the Machine";
    if (scalingFreq < 15 && medianHold < 10 && winRate < 45) return "The Degen Maxi";
    if (medianHold < 15 && totalTxCount > 30) return "The Jeeter";
    if (medianHold < 10 && winRate >= 55) return "The Sniper";
    if (balanceSOL > 25 && medianHold > 100) return "The Conviction Holder";
    if (scalingFreq >= 40 && scalingFreq <= 70 && totalTxCount > 20) return "The Rotatooooooor";
    if (winRate >= 45 && winRate <= 65 && scalingFreq >= 20 && scalingFreq <= 50) return "The Swing Scaler";
    if (winRate < 35 && totalTxCount > 10) return "The Community Member";
    
    return "The Wildcard";
}

const ARCHETYPE_TAGLINES = {
    "The Jeeter": "Sells at the first green candle like it insulted your mother. Discipline mistaken for panic.",
    "The Sniper": "In and out before the chart even loads. Precision-driven, but rarely sticks around for the real move.",
    "The Rotatooooooor": "Never met a position it didn't want to swap for a shinier one. Diversified or just indecisive — jury's out.",
    "The Conviction Holder": "Bags heavy, sells never. Either a genius or the last one holding when the music stops.",
    "The Swing Scaler": "Builds in, trims out, rinse repeat. The closest thing to 'professional' in the trenches.",
    "The Dormant Ghost": "Wallet's been quieter than a rug pull's Twitter account. Zero risk, zero story.",
    "The Degen Maxi": "Full send, every time, no stop-loss, no regrets (publicly, at least).",
    "The Ghost in the Machine": "Wins quiet, exits clean, leaves no trace. The trenches' apex predator — everyone else is just trading against them.",
    "The Wildcard": "Signals so mixed even the algorithm shrugged. Could be a genius, could be a menace — too early to tell.",
    "The Community Member": "Down bad on every position, but the friends you made in the Telegram chat? Priceless. Maybe the real profits were the friends we made along the way."
};

export const ARCHETYPE_GLOSSARY = Object.entries(ARCHETYPE_TAGLINES).map(
    ([name, tagline]) => ({ name, tagline })
);

// ---------------------------------------------------------
// STRENGTHS / LEAKS — derived from the actual metrics.
// ---------------------------------------------------------
function computeStrengths(m) {
    const { winRate, medianHold, scalingFreq, totalTxCount, balanceSOL } = m;
    const candidates = [];

    if (winRate >= 60) candidates.push("Consistently profitable entries (win rate above 60%)");
    else if (winRate >= 45) candidates.push("Modestly net-positive edge, roughly breakeven or better");

    if (scalingFreq >= 50) candidates.push("Disciplined position scaling");
    else if (scalingFreq >= 20) candidates.push("Balanced risk-to-reward structuring");

    if (medianHold >= 60) candidates.push("Patient hold discipline, avoids premature exits");
    else if (medianHold >= 15) candidates.push("Reasonable holding window, not rushing exits");

    if (medianHold < 15 && winRate >= 55) candidates.push("Efficient fast-exit precision on winning trades");

    if (balanceSOL > 10) candidates.push("Maintains solid liquid capital reserve");
    else if (balanceSOL > 1) candidates.push("Modest but functional capital base");

    if (totalTxCount > 20) candidates.push(`Active, verified on-chain footprint (${totalTxCount}+ signatures)`);
    else if (totalTxCount >= 10) candidates.push("Establishing a consistent trading footprint");

    return candidates.slice(0, 4);
}

function computeLeaks(m) {
    const { winRate, medianHold, scalingFreq, totalTxCount, balanceSOL } = m;
    const candidates = [];

    if (winRate < 30) candidates.push("Severely negative win rate — high loss frequency");
    else if (winRate < 45) candidates.push("Losing more trades than winning");
    else if (winRate < 60) candidates.push("Win rate sits near breakeven — not yet a proven edge");

    if (medianHold < 10) candidates.push("Exits before positions can develop");
    else if (medianHold > 150) candidates.push("Overholds positions past optimal exit windows");

    if (scalingFreq < 20) candidates.push("Limited scaling discipline — mostly all-in, all-out behavior");
    else if (scalingFreq > 70) candidates.push("Overtrades positions, may be chasing noise");

    if (balanceSOL < 1) candidates.push("Thin capital reserve — limited room for error");

    if (totalTxCount < 5) candidates.push("Small sample size — behavior pattern still forming");
    else if (totalTxCount < 10) candidates.push("Limited trade history reduces confidence in this profile");

    return candidates.slice(0, 4);
}

// ---------------------------------------------------------
// RECOMMENDED PATH
// ---------------------------------------------------------
function computeRecommendation(m) {
    const { winRate, medianHold } = m;

    if (medianHold < 20 && winRate >= 55) {
        return "Your edge is speed, not patience. Lean into scalping fast 1.5x-2x exits rather than forcing yourself to hold — your win rate drops the longer you stay in.";
    }
    if (medianHold > 60 && winRate >= 50) {
        return "Your edge shows up when you hold. Cutting positions early is costing you upside — let winners run further before scaling out.";
    }
    if (winRate < 40) {
        return "Neither scalping nor holding is saving you right now — the leak is entry selection, not exit timing. Tighten which setups you take before optimizing hold time.";
    }
    return "Your results are mixed enough that timing style isn't the deciding factor yet. Track a few more trades before locking into either a scalp or hold approach.";
}

// ---------------------------------------------------------
// MAIN ENTRY POINT
// ---------------------------------------------------------
export async function runWalletCheckup(walletAddress) {
    try {
        const pubKey = new PublicKey(walletAddress);
        const connection = getSolanaConnection();

        const balanceLamports = await connection.getBalance(pubKey);
        const balanceSOL = balanceLamports / 1e9;

        // Expanded signature fetch to 100 for a deeper forensic scan
        const signatures = await connection.getSignaturesForAddress(pubKey, { limit: 100 });
        const totalTxCount = signatures.length;

        if (totalTxCount === 0) {
            return {
                personality: {
                    archetype: "The Dormant Ghost",
                    confidence: "HIGH",
                    summary: "This wallet has zero recorded transaction history on Solana mainnet.",
                    tagline: ARCHETYPE_TAGLINES["The Dormant Ghost"]
                },
                diagnostics: { winRate: "0.0%", averageHold: "0s", scalingFrequency: "0%" },
                traits: { strengths: ["Zero risk exposure"], fatalLeaks: ["Inactive capital"] },
                recommendation: "Nothing to analyze yet — fund and trade this wallet to generate a real profile.",
                glossary: ARCHETYPE_GLOSSARY
            };
        }

        // Run real transaction parsing on the signatures
        const { winRateNum, medianHoldSecs, scalingFreqNum, completedTrades, totalRawTransactions } = await analyzeTrades(connection, walletAddress, signatures);

        // Convert seconds back to minutes solely for the internal archetype matching logic
        const medianHoldMin = medianHoldSecs / 60;

        const metrics = {
            winRate: winRateNum,
            medianHold: medianHoldMin,
            scalingFreq: scalingFreqNum,
            totalTxCount,
            balanceSOL
        };

        const archetype = classifyArchetype(metrics);
        const strengths = computeStrengths(metrics);
        const leaks = computeLeaks(metrics);
        const recommendation = computeRecommendation(metrics);

        return {
            personality: {
                archetype,
                confidence: totalTxCount >= 40 ? "HIGH" : "MODERATE",
                summary: `Analyzed ${completedTrades} completed buy/sell cycles out of ${totalRawTransactions} recent network signatures. The mathematical footprint strongly indicates a ${archetype.toUpperCase()} profile.`,
                tagline: ARCHETYPE_TAGLINES[archetype]
            },
            diagnostics: {
                winRate: `${winRateNum}%`,
                averageHold: formatHoldTime(medianHoldSecs), // Sleek formatting applied here
                scalingFrequency: `${scalingFreqNum}%`
            },
            traits: {
                strengths,
                fatalLeaks: leaks
            },
            recommendation,
            glossary: ARCHETYPE_GLOSSARY
        };

    } catch (error) {
        console.error("RPC Diagnostic Failed:", error.message);
        return null;
    }
}