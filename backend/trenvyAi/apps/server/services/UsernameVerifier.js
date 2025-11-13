import { createBloomFilter } from "./BloomFilter.js";
import prisma from "../database/prismaClient.js";

// Create singleton state for usernames
let bloomFilter = createBloomFilter(200000, 0.001);
let isInitialized = false;

// Create singleton state for emails
let emailBloomFilter = createBloomFilter(200000, 0.001);
let isEmailInitialized = false;

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
 * Initialize the email Bloom filter with existing emails from database
 */
async function initializeEmailFilter() {
    try {
        console.log("Initializing email Bloom filter...");
        
        // Fetch all emails from database
        const users = await prisma.user.findMany({
            select: { email: true },
        });

        // Add all emails to Bloom filter
        for (const user of users) {
            if (user.email) {
                emailBloomFilter.add(user.email.toLowerCase().trim());
            }
        }

        isEmailInitialized = true;
        const stats = emailBloomFilter.getStats();
        console.log("Email Bloom filter initialized:", stats);
        
        return stats;
    } catch (error) {
        console.error("Error initializing email Bloom filter:", error);
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

/**
 * Check if email exists in Bloom filter (fast check for anti-enumeration)
 * Returns: true if email might exist, false if definitely doesn't exist
 */
export async function isEmailInBloomFilter(email) {
    if (!isEmailInitialized) {
        await initializeEmailFilter();
    }

    const normalizedEmail = email.toLowerCase().trim();
    return emailBloomFilter.mightExist(normalizedEmail);
}

/**
 * Add a new email to the filter (call after creating user)
 */
export function addEmail(email) {
    if (email) {
        emailBloomFilter.add(email.toLowerCase().trim());
    }
}
