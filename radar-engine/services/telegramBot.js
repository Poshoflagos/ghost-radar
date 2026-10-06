// Headless HTTP-based Telegram Alert Engine for Ghost Radar

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const formatCompact = (num) => {
    if (!num) return '$0';
    return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', notation: "compact", maximumFractionDigits: 1
    }).format(Number(num));
};

export async function sendTelegramMessage(text) {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.log('[Telegram Alert Skipped] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in .env');
        return;
    }

    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
    } catch (err) {
        console.error('[Telegram Send Error]:', err.message);
    }
}

// -----------------------------------------------------------------------------
// BROADCAST TEMPLATES
// -----------------------------------------------------------------------------

export function sendZombieAlert(token) {
    const text = `
🧟 <b>GHOST RADAR | ZOMBIE REVIVAL DETECTED</b>
--------------------------------------
<b>Token:</b> $${token.token_symbol} (${token.token_name})
<b>CA:</b> <code>${token.token_address}</code>

<b>1H Surge:</b> +${token.price_change_1h}%
<b>1H Buy Ratio:</b> ${(token.buy_ratio_1h * 100).toFixed(1)}%
<b>Market Cap:</b> ${formatCompact(token.mcap_usd)}
<b>Liquidity:</b> ${formatCompact(token.liquidity_usd)}
<b>Ghost Score:</b> ${token.rank_score.toFixed(1)}/100

🔗 <a href="https://photon-sol.tinyastro.io/en/lp/${token.token_address}">Photon</a> | <a href="https://dexscreener.com/solana/${token.token_address}">DexScreener</a>
    `.trim();

    sendTelegramMessage(text);
}

export function sendBreakoutAlert(token) {
    const text = `
⚡ <b>GHOST RADAR | ALPHA BREAKOUT CONFIRMED</b>
--------------------------------------
<b>Token:</b> $${token.token_symbol} (${token.token_name})
<b>CA:</b> <code>${token.token_address}</code>

<b>1H Volume:</b> ${formatCompact(token.volume_1h)}
<b>1H Price Move:</b> +${token.price_change_1h}%
<b>Lane:</b> ${token.lane}
<b>Score:</b> ${token.rank_score.toFixed(1)}/100

🔗 <a href="https://photon-sol.tinyastro.io/en/lp/${token.token_address}">Photon</a> | <a href="https://dexscreener.com/solana/${token.token_address}">DexScreener</a>
    `.trim();

    sendTelegramMessage(text);
}