import crypto from 'crypto';

/**
 * Generate a cryptographically secure random token
 * @param {number} bytes - Number of random bytes (default: 32)
 * @returns {string} Hex-encoded random token
 */
export function generateSecureToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hash a token using SHA-256 for secure storage
 * @param {string} token - Raw token to hash
 * @returns {string} Hex-encoded hash
 */
export function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} True if strings match
 */
export function timingSafeCompare(a, b) {
    try {
        const bufA = Buffer.from(a, 'utf8');
        const bufB = Buffer.from(b, 'utf8');
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
    } catch (error) {
        console.error('Timing-safe comparison error:', error);
        return false;
    }
}

/**
 * Generate an ETag from a JSON string for HTTP caching
 * @param {string} jsonString - JSON string to hash
 * @returns {string} ETag hash
 */
export function computeETag(jsonString) {
    return crypto.createHash('sha1').update(jsonString).digest('hex');
}
