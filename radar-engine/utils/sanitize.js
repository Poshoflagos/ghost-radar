/**
 * Ghost Radar - Market Data Bouncer
 * Rejects corrupt, NaN, negative, or absurd market numbers.
 */

export const sanitizeMetrics = {
    totalChecked: 0,
    totalRejected: 0,
    lastRejectedReason: null
};

export function sanitizeMarketNumber(val, options = {}) {
    const {
        min = 0,
        max = 10_000_000_000, // $10B ceiling (anything higher on a memecoin is a glitch)
        fieldName = 'market_value'
    } = options;

    sanitizeMetrics.totalChecked++;

    // If it's empty, null, or undefined, skip it safely
    if (val === null || val === undefined || val === '') {
        return null;
    }

    const num = Number(val);

    // Reject "NaN" or weird infinity values
    if (!Number.isFinite(num) || Number.isNaN(num)) {
        recordRejection(fieldName, val, 'Not a valid number');
        return null;
    }

    // Reject negative numbers
    if (num < min) {
        recordRejection(fieldName, num, `Below minimum of ${min}`);
        return null;
    }

    // Reject impossibly huge numbers
    if (num > max) {
        recordRejection(fieldName, num, `Exceeds max allowed (${max})`);
        return null;
    }

    return num;
}

function recordRejection(field, value, reason) {
    sanitizeMetrics.totalRejected++;
    sanitizeMetrics.lastRejectedReason = `[${field}] Skipped value "${value}": ${reason}`;
    console.warn(`[Ghost Radar Bouncer] ${sanitizeMetrics.lastRejectedReason}`);
}

export function getSanitizeMetrics() {
    return { ...sanitizeMetrics };
}