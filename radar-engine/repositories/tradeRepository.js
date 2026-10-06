import { pool } from '../db.js';

/**
 * Persists a batch of decoded trade events and deployer updates in a single atomic transaction.
 * @param {Array<Object>} batch - Array of decoded trade or launch events.
 */
export async function persistTradeBatch(batch) {
    if (!batch || batch.length === 0) return;

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        for (const event of batch) {
            // 1. HANDLE NEW LAUNCHES -> DEPLOYER REPUTATION
            if (event.isCreateEvent) {
                const insertDeployerSql = `
                    INSERT INTO deployer_history (deployer_address, total_launches, rugs_detected, reputation_score, last_launch)
                    VALUES ($1, 1, 0, 100.00, NOW())
                    ON CONFLICT (deployer_address) DO UPDATE SET 
                        total_launches = deployer_history.total_launches + 1,
                        last_launch = NOW();
                `;
                await client.query(insertDeployerSql, [event.deployerAddress]);
                continue;
            }

            // 2. HANDLE ON-CHAIN TRADES
            const pnlImpact = event.tradeType === 'SELL' ? event.capitalSol : -event.capitalSol;
            const isWin = event.tradeType === 'SELL' && pnlImpact > 0 ? 1 : 0;

            const updateWalletSql = `
                INSERT INTO tracked_wallets (address, label, tier, total_trades, wins, win_rate, realized_pnl_sol)
                VALUES ($1, 'Ghost in the Machine', $2, 1, $3, 0, ROUND($4::numeric, 4))
                ON CONFLICT (address) DO UPDATE SET 
                    total_trades = tracked_wallets.total_trades + 1,
                    tier = CASE 
                        WHEN $2 = 'Whale' THEN 'Whale'
                        WHEN $2 = 'Mid-Weight' AND tracked_wallets.tier != 'Whale' THEN 'Mid-Weight'
                        ELSE tracked_wallets.tier
                    END,
                    wins = tracked_wallets.wins + $3,
                    realized_pnl_sol = tracked_wallets.realized_pnl_sol + ROUND($4::numeric, 4),
                    win_rate = ROUND(LEAST(((tracked_wallets.wins + $3)::numeric / (tracked_wallets.total_trades + 1)) * 100, 100.0), 2);
            `;
            await client.query(updateWalletSql, [
                event.walletAddress, event.tier, isWin, pnlImpact
            ]);

            const insertTradeSql = `
                INSERT INTO wallet_trades (wallet_address, token_address, token_symbol, trade_type, capital_sol, token_amount, price_sol, tx_signature, phase)
                VALUES ($1, $2, $3, $4, ROUND($5::numeric, 4), ROUND($6::numeric, 6), ROUND($7::numeric, 9), $8, $9)
                ON CONFLICT (tx_signature) DO NOTHING;
            `;
            await client.query(insertTradeSql, [
                event.walletAddress, event.tokenAddress, event.tokenSymbol, event.tradeType, 
                event.capitalSol, event.tokenAmount, event.priceSol, event.signature, event.phase
            ]);

            console.log(`[Ghost Radar Alpha] ${event.tier} ${event.tradeType} | Wallet: ${event.walletAddress.slice(0, 4)}... | ${event.capitalSol.toFixed(2)} SOL | Price: ${event.priceSol.toFixed(9)} SOL`);
        }

        await client.query('COMMIT');
    } catch (dbErr) {
        if (client) await client.query('ROLLBACK');
        console.error('[Ghost Radar] DB Batch Insert Error:', dbErr.message);
    } finally {
        if (client) client.release();
    }
}