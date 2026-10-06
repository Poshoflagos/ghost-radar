// radar-engine/routes/wallet.js
import express from 'express';
import { runWalletCheckup } from '../scripts/walletDiagnosis.js'; 
import { getCachedData, setCachedData } from '../utils/cache.js';

const router = express.Router();

router.get('/:address/checkup', async (req, res) => {
    const { address } = req.params;

    if (!address || address.length < 32 || address.length > 44) {
        return res.status(400).json({ error: "Invalid Solana wallet address." });
    }

    // 🛡️ THE SHIELD: Prevent Helius API credit drain from spam refreshes
    const cacheKey = `wallet_checkup_${address}`;
    const cached = getCachedData(cacheKey);
    if (cached) return res.status(200).json(cached);

    try {
        const diagnosticData = await runWalletCheckup(address);
        if (!diagnosticData) {
            return res.status(404).json({ error: "Insufficient on-chain data." });
        }
        
        // Lock in memory for 2 minutes (120000 ms)
        setCachedData(cacheKey, diagnosticData, 120000);

        res.status(200).json(diagnosticData);
    } catch (error) {
        res.status(500).json({ error: "Internal server error." });
    }
});

export default router;