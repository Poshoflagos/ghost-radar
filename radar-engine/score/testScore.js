/**
 * radar-engine/score/testScore.js
 * Test harness to verify the math logic.
 */
import { score } from './ghostScore.js';

const mockCleanToken = {
    isGraduated: false, isPumpCurve: true,
    devClusterRugs: 0, devClusterLaunches: 5,
    topClusterPct: 0.10, bundledSupplyPct: 0.05,
    washRatio: 0.10, realLiqToMcap: 0.20,
    exitQualityRisk: 0.10, mcap: 50000,
    smartConfluence: 0.8, organicVelocity: 0.7,
    holderSlopeNet: 0.6, buyQuality: 0.8,
    entryExtension: 0.5, devEdge: 0.3,
    confidenceFlags: []
};

const mockWashTradedToken = {
    ...mockCleanToken,
    washRatio: 0.90, // Extreme wash trading
    organicVelocity: 0.10
};

const mockFreshDeployer = {
    ...mockCleanToken,
    devClusterRugs: 0, devClusterLaunches: 0 // Unknown entity
};

console.log("=== GHOST SCORE TEST SUITE ===");
console.log("\n1. Clean Token (Should score high):");
console.log(score(mockCleanToken));

console.log("\n2. Wash Traded Token (Should hit Floor gate):");
console.log(score(mockWashTradedToken));

console.log("\n3. Fresh Deployer (Should score lower than Clean due to unknown risk):");
console.log(score(mockFreshDeployer));