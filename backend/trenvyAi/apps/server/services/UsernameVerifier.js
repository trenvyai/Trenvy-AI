import { createBloomFilter } from "./BloomFilter.js";
import prisma from "../database/prismaClient.js";

// Create singleton state
let bloomFilter = createBloomFilter(200000, 0.001);
let isInitialized = false;

/**
 * Initialize the Bloom filter with existing usernames from database
 */
async function initialize() {
    try {
        console.log("Initializing username Bloom filter...");
        
        // Fetch all usernames from database
        const users = await prisma.user.findMany({
            select: { username: true },
        });

        // Add all usernames to Bloom filter
        for (const user of users) {
            if (user.username) {
                bloomFilter.add(user.username);
            }
        }

        isInitialized = true;
        const stats = bloomFilter.getStats();
        console.log("Bloom filter initialized:", stats);
        
        return stats;
    } catch (error) {
        console.error("Error initializing Bloom filter:", error);
        throw error;
    }
}

/**
 * Check if username might be taken (fast check)
 * Returns: { available: boolean, needsDbCheck: boolean }
 */
export async function isUsernameTaken(username) {
    if (!isInitialized) {
        await initialize();
    }

    const mightExist = bloomFilter.mightExist(username);

    if (!mightExist) {
        // Definitely available (no false negatives in Bloom filter)
        return { available: true, needsDbCheck: false };
    }

    // Might exist - need to verify with database
    const user = await prisma.user.findUnique({
        where: { username: username.toLowerCase().trim() },
        select: { id: true },
    });

    return {
        available: !user,
        needsDbCheck: true,
    };
}

/**
 * Add a new username to the filter (call after creating user)
 */
export function addUsername(username) {
    if (username) {
        bloomFilter.add(username);
    }
}

/**
 * Get filter statistics
 */
export function getStats() {
    return bloomFilter.getStats();
}

/**
 * Reinitialize the filter (useful for periodic refresh)
 */
export async function refresh() {
    bloomFilter.clear();
    isInitialized = false;
    return await initialize();
}
