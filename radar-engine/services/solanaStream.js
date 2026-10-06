import WebSocket from 'ws'; 

export const incubationTokens = [];
const MAX_INCUBATION_SIZE = 500;

// Optional: You can start dropping known rug-deployer addresses here later.
const DEPLOYER_BLACKLIST = new Set([
    'RUGGER1...example...',
    'RUGGER2...example...'
]);

export function startSolanaStream() {
    console.log('[Ghost Radar] Booting Sniper Protocol (PumpPortal New-Token-Only Stream)...');
    connectPumpPortalSniper();
}

function connectPumpPortalSniper() {
    // 100% FREE: We only subscribe to new token creations via PumpPortal
    let ws = new WebSocket('wss://pumpportal.fun/api/data');
    let pingInterval;

    ws.on('open', () => {
        console.log('[Ghost Radar] Sniper Stream Connected. Watching for launches...');
        
        // ONLY subscribe to new tokens. No live trade firehose.
        ws.send(JSON.stringify({ method: 'subscribeNewToken' }));

        pingInterval = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.ping(); }, 30000);
    });

    ws.on('message', (data) => {
        try {
            const parsed = JSON.parse(data);
            
            // --- SNIPER PROTOCOL: NEW LAUNCH ---
            if (parsed.txType === 'create') {
                const mintAddress = parsed.mint;
                const deployerAddress = parsed.traderPublicKey;
                
                // SNIPER FILTER 1: Instant Blacklist Reject
                if (DEPLOYER_BLACKLIST.has(deployerAddress)) {
                    console.log(`[Sniper Reject] Blocked known rugger: ${deployerAddress.slice(0, 4)}...`);
                    return; 
                }

                console.log(`[Sniper] New Launch Detected -> CA: ${mintAddress?.slice(0, 4)}... | Deployer: ${deployerAddress?.slice(0, 4)}...`);
                
                // Push to in-memory incubation. The DexScreener sweeper (built in Phase 6) will poll these.
                incubationTokens.push({ 
                    address: mintAddress, 
                    deployer: deployerAddress,
                    addedAt: Date.now() 
                });
                
                // Keep memory clean
                if (incubationTokens.length > MAX_INCUBATION_SIZE) {
                    incubationTokens.shift(); 
                }
            }
        } catch (err) {
            // Silently ignore malformed JSON
        }
    });

    ws.on('error', (err) => console.error('[Ghost Radar] Sniper WS Error:', err.message));
    ws.on('close', () => {
        console.warn('[Ghost Radar] Sniper Disconnected. Reconnecting in 5s...');
        clearInterval(pingInterval);
        setTimeout(connectPumpPortalSniper, 5000); 
    });
}