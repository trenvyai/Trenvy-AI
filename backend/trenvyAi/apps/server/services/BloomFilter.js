import crypto from "crypto";

/**
 * Calculate optimal bit array size
 * m = -(n * ln(p)) / (ln(2)^2)
 */
function optimalSize(n, p) {
    return Math.ceil(-(n * Math.log(p)) / Math.pow(Math.log(2), 2));
}

/**
 * Calculate optimal number of hash functions
 * k = (m/n) * ln(2)
 */
function optimalHashCount(m, n) {
    return Math.ceil((m / n) * Math.log(2));
}

/**
 * Generate multiple hash values for a given string
 */
function getHashes(str, hashCount, size) {
    const hashes = [];
    
    for (let i = 0; i < hashCount; i++) {
        const hash = crypto
            .createHash("sha256")
            .update(str + i.toString())
            .digest();
        
        // Convert first 4 bytes to number and mod by size
        const hashValue = hash.readUInt32BE(0) % size;
        hashes.push(hashValue);
    }
    
    return hashes;
}

/**
 * Create a new Bloom filter
 * Optimized for 200,000 users with ~0.1% false positive rate
 */
export function createBloomFilter(expectedElements = 200000, falsePositiveRate = 0.001) {
    const size = optimalSize(expectedElements, falsePositiveRate);
    const hashCount = optimalHashCount(size, expectedElements);
    const bitArray = Buffer.alloc(Math.ceil(size / 8));
    let elementCount = 0;

    return {
        /**
         * Add a username to the Bloom filter
         */
        add(username) {
            const normalizedUsername = username.toLowerCase().trim();
            const hashes = getHashes(normalizedUsername, hashCount, size);
            
            for (const hash of hashes) {
                const byteIndex = Math.floor(hash / 8);
                const bitIndex = hash % 8;
                bitArray[byteIndex] |= 1 << bitIndex;
            }
            
            elementCount++;
        },

        /**
         * Check if a username might exist (can have false positives)
         */
        mightExist(username) {
            const normalizedUsername = username.toLowerCase().trim();
            const hashes = getHashes(normalizedUsername, hashCount, size);
            
            for (const hash of hashes) {
                const byteIndex = Math.floor(hash / 8);
                const bitIndex = hash % 8;
                
                if ((bitArray[byteIndex] & (1 << bitIndex)) === 0) {
                    return false; // Definitely doesn't exist
                }
            }
            
            return true; // Might exist (could be false positive)
        },

        /**
         * Get current false positive probability
         */
        getFalsePositiveProbability() {
            return Math.pow(1 - Math.exp(-hashCount * elementCount / size), hashCount);
        },

        /**
         * Get filter statistics
         */
        getStats() {
            return {
                size,
                hashCount,
                elementCount,
                memoryUsage: `${(bitArray.length / 1024).toFixed(2)} KB`,
                falsePositiveRate: `${(this.getFalsePositiveProbability() * 100).toFixed(4)}%`,
            };
        },

        /**
         * Clear the filter
         */
        clear() {
            bitArray.fill(0);
            elementCount = 0;
        }
    };
}
