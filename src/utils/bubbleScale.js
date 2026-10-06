// Turns a token's absolute % price change into a "scale" number.
// This one function is now the single source of truth for both:
//   - how big a bubble is (used by the packing layout in Home.jsx)
//   - which glow/border tier it gets (used in TokenReportCard.jsx)
// Keeping it in one place means size and visual tier can never drift apart.
export function getCardScale(absChange) {
  if (absChange >= 200) return 1.65;
  if (absChange >= 100) return 1.3;
  if (absChange >= 50) return 1.0;
  if (absChange >= 10) {
    const step = Math.floor(absChange / 10);
    return 0.6 + step * 0.08;
  }
  return 0.6;
}