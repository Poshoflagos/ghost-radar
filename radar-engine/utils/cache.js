// A lightweight, zero-cost memory cache to protect your Neon DB
const memoryCache = new Map();

// Default lifespan of cached data: 60 seconds
const DEFAULT_TTL = 60 * 1000; 

export function getCachedData(key) {
    if (memoryCache.has(key)) {
        const { data, expiry } = memoryCache.get(key);
        
        // If it's still fresh, return it
        if (Date.now() < expiry) {
            return data;
        }
        // If it's stale, delete it and return null
        memoryCache.delete(key);
    }
    return null;
}

export function setCachedData(key, data, ttlMs = DEFAULT_TTL) {
    memoryCache.set(key, {
        data,
        expiry: Date.now() + ttlMs
    });
}