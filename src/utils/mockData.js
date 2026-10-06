export const mockTokens = [
  {
    id: "token-ghost-01",
    name: "Ghost Protocol",
    symbol: "$GHOST",
    contract: "7xK9...2PmX", 
    logo: "https://api.dicebear.com/7.x/shapes/svg?seed=Ghost&backgroundColor=0a0a0a",
    market: { price: "$0.014", liquidity: "$245k", volume24h: "$1.2M", marketCap: "$1.4M" },
    priceChange: { '1h': 12.4, '4h': 45.2, '24h': 82.5, '7d': 140.2, '30d': 320.5 },
    bondingCurve: {
      isGraduated: true,
      progress: 100,
      postGraduationDump: -92.4,
      postDumpRebound: 45.8,
      poolType: "Raydium"
    },
    intelligence: { lifecycle: "RECOVERY", thesis: "POST-DUMP ACCUMULATION", walletConvergence: "HIGH", liquidityQuality: "GOOD" },
    similarity: { historical: 82, extremeCohort: 76, failure: 31 },
    risk: { creator: "MEDIUM", liquidity: "LOW", concentration: "MEDIUM", cluster: "LOW" }
  },
  {
    id: "token-pumpin",
    name: "pumpin",
    symbol: "$PUMPIN",
    contract: "8g93zr9BiZQUQgFMF86nEFt7nCoApUJKGy4ZZqURpump", // YOUR LIVE CA
    logo: "https://api.dicebear.com/7.x/shapes/svg?seed=pumpin&backgroundColor=0a0a0a",
    market: { price: "STREAMING", liquidity: "STREAMING", volume24h: "STREAMING", marketCap: "STREAMING" },
    priceChange: { '1h': 0, '4h': 0, '24h': 0, '7d': 0, '30d': 0 },
    bondingCurve: {
      isGraduated: false,
      progress: 0.1, 
      postGraduationDump: 0,
      postDumpRebound: 0,
      poolType: "Pump.fun"
    },
    intelligence: { lifecycle: "CURVE EXPANSION", thesis: "LIVE WS STREAMING", walletConvergence: "PENDING", liquidityQuality: "BONDING" },
    similarity: { historical: 0, extremeCohort: 0, failure: 0 },
    risk: { creator: "PENDING", liquidity: "PENDING", concentration: "PENDING", cluster: "PENDING" }
  }
];