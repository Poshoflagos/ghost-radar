import { formatAge, formatPercent, formatUsd } from './formatting.js';

export function formatTelegramMessage(report) {
  const { token, pair, market, scores, links } = report;
  const flags = (scores.flags || []).slice(0, 5).map((f) => `- ${escapeMd(f)}`).join('\n') || '- No major v1 flags from available data';
  return `🚨 Trench Radar Research Alert\n\nToken: $${escapeMd(token.symbol || 'TOKEN')}\nVerdict: ${escapeMd(scores.verdict)}\nRisk Score: ${scores.riskScore}/100\nRunner Score: ${scores.runnerScore}/100\nConfidence: ${escapeMd(scores.confidence)}\n\nFDV: ${formatUsd(market.fdv)}\nLiquidity: ${formatUsd(market.liquidity)}\n1h Volume: ${formatUsd(market.volume1h)}\nBuy/Sell: ${escapeMd(market.buySellRatio || 'N/A')}\nPair Age: ${formatAge(pair.ageMinutes)}\n1h Change: ${escapeMd(formatPercent(market.priceChange1h))}\n\nFlags:\n${flags}\n\nLinks:\nDexScreener: ${links.dexScreener}\nSolscan: ${links.solscanToken}\nRugCheck: ${links.rugCheck}\n\nNote: Signal quality, not profit probability. Manual verification required.`;
}

function escapeMd(value) {
  return String(value || '').replace(/[_*`\[]/g, '');
}
