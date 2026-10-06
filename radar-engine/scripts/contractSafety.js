// radar-engine/scripts/contractSafety.js
import { Connection, PublicKey } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';

const connection = new Connection(`https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`);

export async function runContractSafetyCheck(tokenMintAddress) {
    try {
        const mintPubKey = new PublicKey(tokenMintAddress);
        const mintInfo = await getMint(connection, mintPubKey);

        const mintAuthorityRenounced = mintInfo.mintAuthority === null;
        const freezeAuthorityRenounced = mintInfo.freezeAuthority === null;

        let riskLevel = "LOW";
        const warnings = [];

        if (!mintAuthorityRenounced) {
            riskLevel = "HIGH";
            warnings.push("Mint authority is still active — supply can be inflated at any time.");
        }

        if (!freezeAuthorityRenounced) {
            riskLevel = riskLevel === "HIGH" ? "HIGH" : "MODERATE";
            warnings.push("Freeze authority is still active — holder wallets could be frozen.");
        }

        if (mintAuthorityRenounced && freezeAuthorityRenounced) {
            warnings.push("Mint and freeze authority both renounced — standard safety baseline met.");
        }

        return {
            mintAuthorityRenounced,
            freezeAuthorityRenounced,
            riskLevel,
            warnings
        };

    } catch (error) {
        console.error("Contract Safety Check failed:", error.message);
        return null;
    }
}