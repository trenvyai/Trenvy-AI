import bcrypt from "bcrypt";
import crypto from "crypto";

const saltRounds = 10;

/**
 * Legacy bcrypt hashing (for existing users)
 */
export async function hashPassword(password) {
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        return hash;
    } catch (err) {
        console.error("Error hashing password:", err);
        throw err;
    }
}

/**
 * Legacy bcrypt comparison (for existing users)
 */
export async function comparepassword(password, hashedPassword) {
    try {
        const result = await bcrypt.compare(password, hashedPassword);
        return result;
    } catch (err) {
        console.error("Error comparing password:", err);
        throw err;
    }
}

/**
 * Argon2id hashing (production-grade, memory-hard)
 * Uses Node.js crypto.scrypt as a substitute for Argon2
 * In production, install 'argon2' package for true Argon2id
 */
export async function hashPasswordArgon2(password) {
    try {
        // Generate a random salt
        const salt = crypto.randomBytes(16).toString('hex');
        
        // Use scrypt with memory-hard parameters
        // N=16384 (2^14), r=8, p=1, keylen=64
        return new Promise((resolve, reject) => {
            crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
                if (err) reject(err);
                // Store salt and hash together
                resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
            });
        });
    } catch (err) {
        console.error("Error hashing password with Argon2:", err);
        throw err;
    }
}

/**
 * Verify Argon2id hashed password
 */
export async function verifyPasswordArgon2(password, storedHash) {
    try {
        // Parse stored hash
        const [algorithm, salt, hash] = storedHash.split(':');
        
        if (algorithm !== 'scrypt') {
            throw new Error('Invalid hash format');
        }

        // Hash the provided password with the same salt
        return new Promise((resolve, reject) => {
            crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
                if (err) reject(err);
                
                // Timing-safe comparison
                const hashBuffer = Buffer.from(hash, 'hex');
                const isValid = crypto.timingSafeEqual(hashBuffer, derivedKey);
                resolve(isValid);
            });
        });
    } catch (err) {
        console.error("Error verifying password:", err);
        return false;
    }
}
