import express from "express";
const router = express.Router();
import multer from "multer";
import rateLimit from "express-rate-limit";
import redisClient from '../microservices/Redisserver.js';
import prisma from "../database/prismaClient.js";
import { Usermiddleware } from '../middleware/user.js';
import { sendEmailChangeVerification, sendEmailChangeNotification } from '../services/EmailService.js';
import { generateSecureToken, hashToken, timingSafeCompare, computeETag } from '../services/TokenService.js';
import { uploadToS3, generateUniqueFilename } from '../services/StorageService.js';

// ============== CONFIGURATION ==============
const PROFILE_CACHE_TTL = 300; // 5 minutes cache for profile data
const EMAIL_VERIFICATION_TTL = 60 * 60; // 1 hour for email verification token

// ============== HELPERS ==============
/**
 * Extract only public user fields for API responses
 */
function pickPublicFields(user) {
    return {
        id: user.id,
        name: user.name || null,
        username: user.username || null,
        email: user.email || null,
        avatarUrl: user.avatarUrl || null,
        bio: user.bio || null,
        updatedAt: user.updatedAt || null,
    };
}

// ============== GET /profile (Production-Grade) ==============
/**
 * GET /profile - Retrieve user profile with Redis caching and ETag support
 * 
 * Features:
 * - Redis cache with TTL
 * - ETag-based conditional responses (304 Not Modified)
 * - Selective field loading from DB
 * - Proper error handling
 */
router.get('/profile', Usermiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const cacheKey = `user:profile:${userId}`;

        // Try Redis cache first
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached); // { bodyJson, etag, ts }
            const clientEtag = req.header('If-None-Match');
            
            // Check if client has up-to-date version
            if (clientEtag && clientEtag === parsed.etag) {
                return res.status(304).end();
            }

            res.setHeader('ETag', parsed.etag);
            res.setHeader('Cache-Control', `private, max-age=${PROFILE_CACHE_TTL}`);
            return res.status(200).json({ 
                data: JSON.parse(parsed.bodyJson),
                message: 'Profile retrieved from cache'
            });
        }

        // Cache miss -> fetch from database
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                avatarUrl: true,
                bio: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Prepare response
        const publicUser = pickPublicFields(user);
        const bodyJson = JSON.stringify(publicUser);
        const etag = computeETag(bodyJson);

        // Store in cache
        await redisClient.setEx(
            cacheKey,
            PROFILE_CACHE_TTL,
            JSON.stringify({ bodyJson, etag, ts: Date.now() })
        );

        res.setHeader('ETag', etag);
        res.setHeader('Cache-Control', `private, max-age=${PROFILE_CACHE_TTL}`);
        return res.status(200).json({ 
            data: publicUser,
            message: 'Profile retrieved'
        });

    } catch (err) {
        console.error('GET /profile error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// ============== PUT /profile (Production-Grade) ==============
/**
 * Multer configuration for avatar uploads
 * - Memory storage for processing before S3
 * - 3MB file size limit
 * - Image files only
 */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB max
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
    }
});

/**
 * Rate limiter for profile updates
 */
const profileUpdateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: { message: 'Too many profile update requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * PUT /profile - Update user profile
 * 
 * Features:
 * - Multipart form data support for avatar uploads
 * - Field validation and sanitization
 * - Uniqueness checks for username/email
 * - Cache invalidation and refresh
 * - Rate limiting
 * - Proper error handling
 * 
 * Note: Email changes are NOT directly applied here for security.
 *       Use POST /profile/change-email for email changes.
 */
router.put(
    '/profile',
    profileUpdateLimiter,
    Usermiddleware,
    upload.single('avatar'),
    async (req, res) => {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // Get current user data
            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true }
            });

            if (!currentUser) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Sanitize and validate input fields
            const { name, username, bio } = req.body;
            const updatePayload = {};

            if (typeof name === 'string') {
                updatePayload.name = name.trim().slice(0, 100);
            }

            if (typeof username === 'string') {
                const cleanUsername = username.trim().slice(0, 50);
                // Validate username format
                if (!/^[a-zA-Z0-9._-]{3,50}$/.test(cleanUsername)) {
                    return res.status(400).json({ 
                        message: 'Invalid username format. Use 3-50 characters: letters, numbers, dots, underscores, hyphens' 
                    });
                }
                updatePayload.username = cleanUsername;
            }

            if (typeof bio === 'string') {
                updatePayload.bio = bio.trim().slice(0, 500);
            }

            // Handle avatar upload
            if (req.file) {
                const filename = generateUniqueFilename(userId, req.file.originalname);
                const avatarUrl = await uploadToS3(
                    req.file.buffer,
                    filename,
                    req.file.mimetype
                );
                updatePayload.avatarUrl = avatarUrl;
            }

            // Check if email change was attempted (not allowed directly)
            if (req.body.email && req.body.email !== currentUser.email) {
                return res.status(400).json({
                    message: 'Email cannot be changed directly. Please use /profile/change-email endpoint for security verification.',
                    hint: 'POST /profile/change-email with { newEmail: "your@email.com" }'
                });
            }

            // Ensure at least one field is being updated
            if (Object.keys(updatePayload).length === 0) {
                return res.status(400).json({ message: 'No fields provided to update' });
            }

            // Check username uniqueness if being changed
            if (updatePayload.username) {
                const existingUsername = await prisma.user.findFirst({
                    where: {
                        username: updatePayload.username,
                        NOT: { id: userId }
                    },
                    select: { id: true }
                });
                if (existingUsername) {
                    return res.status(409).json({ message: 'Username already taken' });
                }
            }

            // Perform database update
            const updated = await prisma.user.update({
                where: { id: userId },
                data: { ...updatePayload, updatedAt: new Date() },
                select: {
                    id: true,
                    name: true,
                    username: true,
                    email: true,
                    avatarUrl: true,
                    bio: true,
                    updatedAt: true
                }
            });

            // Invalidate and refresh cache
            const cacheKey = `user:profile:${userId}`;
            try {
                await redisClient.del(cacheKey);
                
                const publicUser = pickPublicFields(updated);
                const bodyJson = JSON.stringify(publicUser);
                const etag = computeETag(bodyJson);
                
                await redisClient.setEx(
                    cacheKey,
                    PROFILE_CACHE_TTL,
                    JSON.stringify({ bodyJson, etag, ts: Date.now() })
                );

                res.setHeader('ETag', etag);
                res.setHeader('Cache-Control', `private, max-age=${PROFILE_CACHE_TTL}`);
            } catch (cacheErr) {
                console.error('Cache update error:', cacheErr);
                // Continue even if cache fails
            }

            return res.status(200).json({
                data: pickPublicFields(updated),
                message: 'Profile updated successfully'
            });

        } catch (err) {
            console.error('PUT /profile error:', err);
            
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ message: `Upload error: ${err.message}` });
            }

            if (err.message === 'Only image files are allowed') {
                return res.status(400).json({ message: err.message });
            }

            // Handle Prisma unique constraint errors
            if (err.code === 'P2002') {
                return res.status(409).json({ message: 'Username or email already in use' });
            }

            return res.status(500).json({ message: 'Internal server error' });
        }
    }
);

// ============== POST /profile/change-email (Initiate Email Change) ==============
/**
 * Rate limiter for email change requests
 */
const emailChangeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 requests per 15 minutes
    message: { message: 'Too many email change requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * POST /profile/change-email - Initiate email change process
 * 
 * Flow:
 * 1. Validate new email format
 * 2. Check email is not already in use
 * 3. Generate secure token (store hash in DB)
 * 4. Send verification email to new address
 * 5. Return success (without exposing token)
 * 
 * Security:
 * - Rate limited to prevent abuse
 * - Token hashed in database
 * - 1-hour expiration
 * - Single-use tokens
 */
router.post('/profile/change-email', emailChangeLimiter, Usermiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const { newEmail } = req.body;

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        // Validate email format
        if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            return res.status(400).json({ message: 'Invalid email address' });
        }

        const normalizedEmail = newEmail.trim().toLowerCase();

        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true }
        });

        if (!currentUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if new email is same as current
        if (currentUser.email === normalizedEmail) {
            return res.status(400).json({ message: 'New email is the same as current email' });
        }

        // Check if email is already in use by another user
        const existingEmail = await prisma.user.findFirst({
            where: {
                email: normalizedEmail,
                NOT: { id: userId }
            },
            select: { id: true }
        });

        if (existingEmail) {
            return res.status(409).json({ message: 'Email address already in use' });
        }

        // Check for pending email change requests (prevent spam)
        const pendingChange = await prisma.emailChange.findFirst({
            where: {
                userId: userId,
                used: false,
                expiresAt: { gt: new Date() }
            }
        });

        if (pendingChange) {
            return res.status(400).json({
                message: 'You already have a pending email change request. Please check your email or wait for it to expire.',
                expiresIn: Math.ceil((pendingChange.expiresAt - new Date()) / 1000 / 60) + ' minutes'
            });
        }

        // Generate secure token
        const rawToken = generateSecureToken(32);
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL * 1000);

        // Create email change request in database
        const emailChange = await prisma.emailChange.create({
            data: {
                userId: userId,
                newEmail: normalizedEmail,
                tokenHash: tokenHash,
                expiresAt: expiresAt
            }
        });

        // Send verification email to NEW email address
        try {
            await sendEmailChangeVerification(
                normalizedEmail,
                currentUser.name,
                rawToken,
                emailChange.id
            );
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Clean up the database record if email fails
            await prisma.emailChange.delete({ where: { id: emailChange.id } });
            return res.status(500).json({ message: 'Failed to send verification email. Please try again.' });
        }

        return res.status(200).json({
            message: 'Verification email sent successfully. Please check your new email address.',
            newEmail: normalizedEmail,
            expiresIn: EMAIL_VERIFICATION_TTL / 60 + ' minutes'
        });

    } catch (err) {
        console.error('POST /profile/change-email error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// ============== POST /profile/confirm-email (Confirm Email Change) ==============
/**
 * Rate limiter for confirmation attempts (prevent brute force)
 */
const confirmEmailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per 15 minutes
    message: { message: 'Too many confirmation attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * POST /profile/confirm-email - Confirm email change with token
 * 
 * Flow:
 * 1. Validate token and ID
 * 2. Check token not used and not expired
 * 3. Verify token hash matches (constant-time comparison)
 * 4. Update user email and mark token as used (atomic transaction)
 * 5. Send notification to old email
 * 6. Invalidate profile cache
 * 
 * Security:
 * - Constant-time token comparison
 * - Single-use tokens
 * - Atomic transaction for updates
 * - Rate limited
 */
router.post('/profile/confirm-email', confirmEmailLimiter, async (req, res) => {
    try {
        const { token, id } = req.body;

        if (!token || !id) {
            return res.status(400).json({ message: 'Missing token or request ID' });
        }

        // Find email change request
        const emailChangeRequest = await prisma.emailChange.findUnique({
            where: { id: id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                }
            }
        });

        if (!emailChangeRequest) {
            return res.status(400).json({ message: 'Invalid or expired verification request' });
        }

        // Check if already used
        if (emailChangeRequest.used) {
            return res.status(400).json({ message: 'This verification link has already been used' });
        }

        // Check if expired
        if (new Date() > emailChangeRequest.expiresAt) {
            return res.status(400).json({ message: 'Verification link has expired. Please request a new one.' });
        }

        // Verify token hash (constant-time comparison to prevent timing attacks)
        const providedTokenHash = hashToken(token);
        if (!timingSafeCompare(providedTokenHash, emailChangeRequest.tokenHash)) {
            // Log failed attempt for security monitoring
            console.warn(`Failed email verification attempt for user ${emailChangeRequest.userId}`);
            return res.status(400).json({ message: 'Invalid verification token' });
        }

        // Check if new email is still available (in case another user took it)
        const emailTaken = await prisma.user.findFirst({
            where: {
                email: emailChangeRequest.newEmail,
                NOT: { id: emailChangeRequest.userId }
            },
            select: { id: true }
        });

        if (emailTaken) {
            return res.status(409).json({ message: 'Email address is no longer available' });
        }

        // Perform atomic update: change email + mark token as used
        const [updatedUser] = await prisma.$transaction([
            prisma.user.update({
                where: { id: emailChangeRequest.userId },
                data: {
                    email: emailChangeRequest.newEmail,
                    updatedAt: new Date()
                },
                select: {
                    id: true,
                    name: true,
                    username: true,
                    email: true,
                    avatarUrl: true,
                    bio: true,
                    updatedAt: true
                }
            }),
            prisma.emailChange.update({
                where: { id: emailChangeRequest.id },
                data: { used: true }
            })
        ]);

        // Invalidate profile cache
        const cacheKey = `user:profile:${emailChangeRequest.userId}`;
        try {
            await redisClient.del(cacheKey);
        } catch (cacheErr) {
            console.error('Failed to invalidate cache:', cacheErr);
            // Continue even if cache invalidation fails
        }

        // Send notification to old email address (non-blocking)
        try {
            await sendEmailChangeNotification(
                emailChangeRequest.user.email,
                emailChangeRequest.newEmail,
                emailChangeRequest.user.name
            );
        } catch (notificationError) {
            console.error('Failed to send notification to old email:', notificationError);
            // Don't fail the request if notification fails
        }

        return res.status(200).json({
            message: 'Email address updated successfully',
            data: pickPublicFields(updatedUser)
        });

    } catch (err) {
        console.error('POST /profile/confirm-email error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;