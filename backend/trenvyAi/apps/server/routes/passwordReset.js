import express from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import redisClient from '../microservices/Redisserver.js';
import prisma from '../Database/prismaClient.js';
import { hashPasswordArgon2, verifyPasswordArgon2 } from '../services/HashPassword.js';
import { isEmailInBloomFilter } from '../services/UsernameVerifier.js';
import { enqueuePasswordResetEmail, enqueuePasswordChangedEmail } from '../services/EmailQueue.js';
import { 
  checkIpRateLimit, 
  checkUserRateLimit, 
  checkTokenRateLimit 
} from '../middleware/rateLimiter.js';
import { auditLog } from '../services/AuditLogger.js';
import { metrics } from '../services/Metrics.js';
import winston from 'winston';

const router = express.Router();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// HMAC secret for token hashing
const RESET_TOKEN_SECRET = process.env.RESET_TOKEN_HMAC_SECRET || 'change-this-in-production';
const TOKEN_TTL = 900; // 15 minutes in seconds

/**
 * Helper: Generate HMAC-SHA256 hash
 */
function hmacHash(data) {
  return crypto.createHmac('sha256', RESET_TOKEN_SECRET)
    .update(data)
    .digest('hex');
}

/**
 * Helper: Timing-safe comparison
 */
function timingSafeEqual(a, b) {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * POST /api/v1/auth/forgot-password
 * Request a password reset link (anti-enumeration design)
 */
router.post('/forgot-password', async (req, res) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    const { email } = req.body;
    
    // Input validation
    if (!email || typeof email !== 'string') {
      metrics.increment('password_reset_requests_total', { status: 'invalid_input' });
      return res.status(400).json({ 
        message: 'Email is required' 
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      metrics.increment('password_reset_requests_total', { status: 'invalid_email' });
      return res.status(400).json({ 
        message: 'Invalid email format' 
      });
    }

    logger.info('Password reset requested', { 
      correlationId, 
      email: normalizedEmail, 
      ip: clientIp 
    });

    // IP Rate Limiting
    const ipRateLimited = await checkIpRateLimit(clientIp);
    if (ipRateLimited) {
      logger.warn('IP rate limit exceeded', { correlationId, ip: clientIp });
      metrics.increment('password_reset_requests_total', { status: 'ip_rate_limited' });
      // Anti-enumeration: Still return success
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      return res.status(200).json({ 
        message: 'If this email is registered, you will receive a password reset link.' 
      });
    }

    // Bloom Filter Check (Fast Path)
    const bloomCheck = await isEmailInBloomFilter(normalizedEmail);
    if (!bloomCheck) {
      logger.info('Bloom filter miss', { correlationId, email: normalizedEmail });
      metrics.increment('password_reset_requests_total', { status: 'bloom_miss' });
      // Anti-enumeration: Return success without DB query
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      return res.status(200).json({ 
        message: 'If this email is registered, you will receive a password reset link.' 
      });
    }

    // Database Query (Slow Path)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      logger.info('User not found (Bloom false positive)', { 
        correlationId, 
        email: normalizedEmail 
      });
      metrics.increment('password_reset_requests_total', { status: 'user_not_found' });
      await auditLog({
        id: correlationId,
        userId: null,
        requestIp: clientIp,
        outcome: 'user_not_found',
        meta: { email: normalizedEmail }
      });
      // Anti-enumeration: Return success
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      return res.status(200).json({ 
        message: 'If this email is registered, you will receive a password reset link.' 
      });
    }

    // User Rate Limiting
    const userRateLimited = await checkUserRateLimit(user.id);
    if (userRateLimited) {
      logger.warn('User rate limit exceeded', { correlationId, userId: user.id });
      metrics.increment('password_reset_requests_total', { status: 'user_rate_limited' });
      await auditLog({
        id: correlationId,
        userId: user.id,
        requestIp: clientIp,
        outcome: 'user_rate_limited',
        meta: {}
      });
      // Anti-enumeration: Return success
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      return res.status(200).json({ 
        message: 'If this email is registered, you will receive a password reset link.' 
      });
    }

    // Token Generation
    const tokenId = uuidv4();
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = hmacHash(rawToken);

    // Store Token in Redis
    const tokenData = {
      userId: user.id,
      tokenHash,
      email: normalizedEmail,
      createdAt: Date.now()
    };
    
    await redisClient.setEx(
      `password_reset:token:${tokenId}`,
      TOKEN_TTL,
      JSON.stringify(tokenData)
    );

    // Enqueue Email
    await enqueuePasswordResetEmail({
      email: normalizedEmail,
      name: user.name,
      tokenId,
      rawToken
    });

    // Audit Log
    await auditLog({
      id: correlationId,
      userId: user.id,
      requestIp: clientIp,
      outcome: 'requested',
      meta: { tokenId }
    });

    logger.info('Password reset token generated', { 
      correlationId, 
      userId: user.id, 
      tokenId 
    });
    metrics.increment('password_reset_requests_total', { status: 'success' });
    
    const duration = Date.now() - startTime;
    metrics.histogram('password_reset_request_duration', duration);

    return res.status(200).json({ 
      message: 'If this email is registered, you will receive a password reset link.' 
    });

  } catch (error) {
    logger.error('Error in forgot-password', { 
      correlationId, 
      error: error.message, 
      stack: error.stack 
    });
    metrics.increment('password_reset_requests_total', { status: 'error' });
    
    // Anti-enumeration: Return generic success even on error
    return res.status(200).json({ 
      message: 'If this email is registered, you will receive a password reset link.' 
    });
  }
});

/**
 * POST /api/v1/auth/reset-password
 * Submit new password with reset token
 */
router.post('/reset-password', async (req, res) => {
  const correlationId = uuidv4();
  const startTime = Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;

  try {
    const { tokenId, token, newPassword } = req.body;

    // Input Validation
    if (!tokenId || !token || !newPassword) {
      metrics.increment('password_reset_completions_total', { status: 'invalid_input' });
      return res.status(400).json({ 
        message: 'All fields are required' 
      });
    }

    // Validate tokenId format (UUID v4)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tokenId)) {
      metrics.increment('password_reset_completions_total', { status: 'invalid_token_id' });
      return res.status(400).json({ 
        message: 'Invalid token format' 
      });
    }

    // Validate token format (base64url, 32-256 chars)
    if (token.length < 32 || token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      metrics.increment('password_reset_completions_total', { status: 'invalid_token_format' });
      return res.status(400).json({ 
        message: 'Invalid token format' 
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      metrics.increment('password_reset_completions_total', { status: 'weak_password' });
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters long' 
      });
    }

    logger.info('Password reset attempt', { correlationId, tokenId, ip: clientIp });

    // Token Rate Limiting
    const tokenRateLimited = await checkTokenRateLimit(tokenId);
    if (tokenRateLimited) {
      logger.warn('Token rate limit exceeded', { correlationId, tokenId });
      metrics.increment('password_reset_completions_total', { status: 'token_rate_limited' });
      return res.status(429).json({ 
        message: 'Too many attempts. Please request a new reset link.' 
      });
    }

    // Token Lookup
    const tokenDataStr = await redisClient.get(`password_reset:token:${tokenId}`);
    if (!tokenDataStr) {
      logger.warn('Token not found or expired', { correlationId, tokenId });
      metrics.increment('password_reset_completions_total', { status: 'token_not_found' });
      return res.status(400).json({ 
        message: 'This reset link is invalid or has expired.' 
      });
    }

    const tokenData = JSON.parse(tokenDataStr);

    // Token Verification (timing-safe)
    const providedTokenHash = hmacHash(token);
    if (!timingSafeEqual(providedTokenHash, tokenData.tokenHash)) {
      logger.warn('Token verification failed', { correlationId, tokenId });
      metrics.increment('password_reset_completions_total', { status: 'token_mismatch' });
      return res.status(400).json({ 
        message: 'Invalid reset token.' 
      });
    }

    // Password Hashing (Argon2id)
    const passwordHash = await hashPasswordArgon2(newPassword);

    // Database Update
    await prisma.user.update({
      where: { id: tokenData.userId },
      data: { 
        password: passwordHash,
        updatedAt: new Date()
      }
    });

    // Token Invalidation
    await redisClient.del(`password_reset:token:${tokenId}`);
    
    // Invalidate all other pending tokens for this user
    const keys = await redisClient.keys('password_reset:token:*');
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.userId === tokenData.userId) {
          await redisClient.del(key);
        }
      }
    }

    // Clear token rate limit
    await redisClient.del(`password_reset:validate:token:${tokenId}`);

    // Notification Email
    await enqueuePasswordChangedEmail({
      email: tokenData.email,
      ip: clientIp,
      timestamp: new Date().toISOString()
    });

    // Audit Log
    await auditLog({
      id: correlationId,
      userId: tokenData.userId,
      requestIp: clientIp,
      outcome: 'reset',
      meta: { tokenId }
    });

    logger.info('Password reset successful', { 
      correlationId, 
      userId: tokenData.userId 
    });
    metrics.increment('password_reset_completions_total', { status: 'success' });
    
    const duration = Date.now() - startTime;
    metrics.histogram('password_reset_completion_duration', duration);

    return res.status(200).json({ 
      message: 'Password has been reset successfully.' 
    });

  } catch (error) {
    logger.error('Error in reset-password', { 
      correlationId, 
      error: error.message, 
      stack: error.stack 
    });
    metrics.increment('password_reset_completions_total', { status: 'error' });
    
    return res.status(500).json({ 
      message: 'An error occurred. Please try again.' 
    });
  }
});

/**
 * GET /api/v1/auth/check-reset-token/:tokenId
 * Check if a reset token is valid (UX improvement)
 */
router.get('/check-reset-token/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;

    // Validate tokenId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tokenId)) {
      return res.status(200).json({ 
        valid: false,
        message: 'Invalid token format'
      });
    }

    // Check if token exists in Redis
    const tokenDataStr = await redisClient.get(`password_reset:token:${tokenId}`);
    
    if (!tokenDataStr) {
      return res.status(200).json({ 
        valid: false,
        message: 'This reset link has expired or is invalid'
      });
    }

    const tokenData = JSON.parse(tokenDataStr);
    const ttl = await redisClient.ttl(`password_reset:token:${tokenId}`);

    return res.status(200).json({ 
      valid: true,
      expiresIn: ttl,
      message: `This link will expire in ${Math.floor(ttl / 60)} minutes`
    });

  } catch (error) {
    logger.error('Error in check-reset-token', { 
      error: error.message 
    });
    
    return res.status(200).json({ 
      valid: false,
      message: 'Unable to verify token'
    });
  }
});

export default router;
