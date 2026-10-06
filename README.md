# Trench Radar MVP

Independent Solana token research scanner with Telegram research alerts.

## What this is
A read-only research and risk-analysis tool. It is not financial advice, not a trading bot, and not a buy-signal product.

## Stack
- React + Vite
- Tailwind CSS v4 Vite plugin
- Netlify Functions
- DexScreener API
- Telegram Bot API

## Local setup
```bash
npm install
npm run dev
```

## Required environment variables on Netlify
```bash
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## Deploy
1. Push to GitHub.
2. Import repo into Netlify.
3. Build command: `npm run build`.
4. Publish directory: `dist`.
5. Add environment variables.
6. Deploy.

## Pages
- `/` landing page
- `/scanner` token scanner
- `/radar` experimental live radar
- `/telegram` Telegram setup
- `/methodology` scoring methodology
- `/disclaimer` risk disclaimer

## V1 limitations
- No wallet connection.
- No auto-trading.
- No full bundle detection.
- No deployer history automation.
- No holder concentration automation.
- Use Solscan/RugCheck/Birdeye links for manual verification.
