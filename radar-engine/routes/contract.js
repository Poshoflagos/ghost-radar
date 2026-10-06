// radar-engine/routes/contract.js
import express from 'express';
import { checkContractSafety } from '../scripts/contractSafety.js';

const router = express.Router();

router.get('/:mint/safety', async (req, res) => {
    const { mint } = req.params;

    try {
        const result = await checkContractSafety(mint);
        if (!result) {
            return res.status(404).json({ error: "Could not verify contract safety." });
        }
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: "Internal server error." });
    }
});

export default router;