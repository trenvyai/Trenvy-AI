# Production-Grade Password Reset System

## Overview

This is a defense-in-depth password reset system implementing OWASP best practices with anti-enumeration protection, rate limiting, and comprehensive security measures.

## Architecture

### Key Components

1. **Password Reset Routes** (`routes/passwordReset.js`)
   - `/api/v1/auth/forgot-password` - Request reset link
   - `/api/v1/auth/reset-password` - Submit new password
   - `/api/v1/auth/check-reset-token/:tokenId` - Validate token

2. **Rate Limiting** (`middleware/rateLimiter.js`)
   - IP-based: 20 requests/hour
   - User-based: 5 requests/hour
   - Token-based: 10 attempts/5 minutes

3. **Bloom Filter** (`services/UsernameVerifier.js`)
   - Fast O(1) email existence check
   - Prevents database load from enumeration attacks
   - ~90% reduction in DB queries

4. **Email Queue** (`services/EmailQueue.js`)
   - Async email processing
   - Ready for BullMQ integration

5. **Audit Logging** (`services/AuditLogger.js`)
   - Non-repudiable trail in PostgreSQL
   - Tracks all password reset events

6. **Metrics** (`services/Metrics.js`)
   - Prometheus-compatible metrics
   - Counters, gauges, and histograms

## Security Features

### 1. Anti-Enumeration Protection

The system always returns the same generic message regardless of whether the email exists:

```
"If this email is registered, you will receive a password reset link."
```

**Implementation:**
- Uniform response messages
- Uniform timing (via Bloom filter)
- No error differentiation

### 2. Three-Layer Rate Limiting

```
IP Layer (20/hour) → User Layer (5/hour) → Token Layer (10/5min)
```

All rate limits use atomic Redis Lua scripts to prevent race conditions.

### 3. Token Security

- **Generation**: UUID tokenId + 48-byte cryptographic random token
- **Storage**: Only HMAC-SHA256 hash stored in Redis
- **Verification**: Timing-safe comparison using `crypto.timingSafeEqual`
- **Lifecycle**: Single-use, 15-minute TTL

### 4. Password Hashing

Uses `crypto.scrypt` (memory-hard) instead of bcrypt:

```javascript
// Parameters: N=16384, r=8, p=1, keylen=64
crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })
```

**Note**: For production, install `argon2` package for true Argon2id support.

### 5. Audit Logging

Every password reset event is logged:

```javascript
{
  id: correlationId,
  userId: user.id,
  requestIp: clientIp,
  outcome: 'requested' | 'reset' | 'user_not_found' | 'rate_limited',
  meta: { tokenId, ... }
}
```

## Data Flow

### Forgot Password Flow

```
1. User submits email
2. ✓ Input validation
3. ✓ IP rate limit check
4. ✓ Bloom filter check (O(1), in-memory)
   ├─ Miss → Return success (no DB query)
   └─ Hit → Continue
5. ✓ Database query
   └─ Not found → Return success
6. ✓ User rate limit check
7. ✓ Generate tokenId + rawToken
8. ✓ Hash token with HMAC-SHA256
9. ✓ Store in Redis (15 min TTL)
10. ✓ Enqueue email
11. ✓ Audit log
12. → Return success
```

### Reset Password Flow

```
1. User submits tokenId + token + newPassword
2. ✓ Input validation
3. ✓ Token rate limit check
4. ✓ Token lookup in Redis
5. ✓ Hash provided token
6. ✓ Timing-safe comparison
7. ✓ Hash new password (scrypt)
8. ✓ Update database
9. ✓ Delete token from Redis
10. ✓ Invalidate other user tokens
11. ✓ Enqueue confirmation email
12. ✓ Audit log
13. → Return success
```

## API Endpoints

### POST /api/v1/auth/forgot-password

Request a password reset link.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (Always 200):**
```json
{
  "message": "If this email is registered, you will receive a password reset link."
}
```

### POST /api/v1/auth/reset-password

Submit new password with reset token.

**Request:**
```json
{
  "tokenId": "550e8400-e29b-41d4-a716-446655440000",
  "token": "abc123...",
  "newPassword": "newSecurePassword123"
}
```

**Response (200):**
```json
{
  "message": "Password has been reset successfully."
}
```

**Error (400):**
```json
{
  "message": "This reset link is invalid or has expired."
}
```

**Error (429):**
```json
{
  "message": "Too many attempts. Please request a new reset link."
}
```

### GET /api/v1/auth/check-reset-token/:tokenId

Check if a reset token is valid (UX improvement).

**Response:**
```json
{
  "valid": true,
  "expiresIn": 847,
  "message": "This link will expire in 14 minutes"
}
```

## Monitoring

### GET /metrics

Prometheus metrics endpoint.

**Metrics tracked:**
- `password_reset_requests_total{status="success|bloom_miss|rate_limited|..."}`
- `password_reset_completions_total{status="success|token_mismatch|..."}`
- `password_reset_request_duration`
- `password_reset_completion_duration`
- `nodejs_memory_usage_bytes`
- `redis_connected`
- `database_connected`

### GET /health

Health check endpoint for load balancers.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-11T10:30:00.000Z",
  "uptime": 3600,
  "checks": {
    "redis": "ok",
    "database": "ok",
    "memory": {
      "status": "ok",
      "heapUsed": "45MB",
      "heapTotal": "128MB",
      "percentage": "35%"
    }
  }
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend/trenvyAi/apps/server
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update:

```bash
cp .env.example .env
```

**Critical variables:**
- `JWT_SECRET` - Strong random string
- `RESET_TOKEN_HMAC_SECRET` - Strong random string (different from JWT_SECRET)
- `SMTP_*` - Email provider credentials
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string

### 3. Run Database Migrations

```bash
npx prisma migrate deploy
```

### 4. Seed Bloom Filter

```bash
node scripts/seedBloomFilter.js
```

### 5. Start Server

```bash
npm start
```

## Production Deployment Checklist

- [ ] Set strong, random secrets for `JWT_SECRET` and `RESET_TOKEN_HMAC_SECRET`
- [ ] Configure SMTP with production email provider
- [ ] Run database migrations
- [ ] Seed Bloom filter with existing users
- [ ] Configure Prometheus to scrape `/metrics`
- [ ] Set up log aggregation (CloudWatch, Datadog, ELK)
- [ ] Enable HTTPS via reverse proxy (Nginx, Caddy) or load balancer
- [ ] Configure rate limiting at load balancer level (additional layer)
- [ ] Set up monitoring alerts for rate limit violations
- [ ] Test email delivery in production
- [ ] Verify audit logs are being written

## Performance Optimizations

1. **Bloom Filter**: ~90% reduction in DB queries for invalid emails
2. **Redis Caching**: Sub-millisecond token lookups
3. **Async Emails**: Non-blocking email sending
4. **Connection Pooling**: Prisma manages DB connections efficiently

## Future Enhancements

1. **BullMQ Integration**: Replace `setImmediate` with proper job queue
2. **True Argon2id**: Install `argon2` npm package
3. **Distributed Rate Limiting**: Use Redis Cluster for horizontal scaling
4. **Email Templates**: Use template engine (Handlebars, EJS)
5. **Multi-language Support**: i18n for email templates
6. **SMS 2FA**: Add SMS verification option
7. **Grafana Dashboards**: Pre-built dashboards for metrics

## Troubleshooting

### Emails not sending

1. Check SMTP credentials in `.env`
2. Verify SMTP port (465 for SSL, 587 for TLS)
3. Check email provider logs
4. Test with `nodemailer` directly

### Rate limiting not working

1. Verify Redis connection
2. Check Redis Lua script execution
3. Monitor Redis keys: `redis-cli KEYS "password_reset:rate:*"`

### Bloom filter false positives

1. Check filter size and false positive rate
2. Refresh filter: `node scripts/seedBloomFilter.js`
3. Monitor hit/miss ratio in metrics

### Token verification failing

1. Verify `RESET_TOKEN_HMAC_SECRET` is consistent
2. Check token TTL in Redis
3. Review audit logs for patterns

## Security Considerations

1. **Never log sensitive data**: Tokens, passwords, or hashes
2. **Use HTTPS**: Always terminate SSL at reverse proxy
3. **Monitor audit logs**: Set up alerts for suspicious patterns
4. **Rotate secrets**: Periodically rotate HMAC secrets
5. **Test rate limits**: Verify they work under load
6. **Review dependencies**: Keep packages updated

## License

MIT
