# Quick Start Guide - Password Reset System

## Installation

### 1. Install Dependencies

```bash
cd backend/trenvyAi/apps/server
npm install
```

This will install the new dependencies:
- `uuid` - For generating unique token IDs
- `winston` - For structured logging

### 2. Environment Setup

Create a `.env` file from the example:

```bash
cp .env.example .env
```

**Minimum required configuration:**

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/trenvy"

# Redis
REDIS_URL="redis://localhost:6379"

# Secrets (CHANGE THESE!)
JWT_SECRET="your-super-secret-jwt-key"
RESET_TOKEN_HMAC_SECRET="your-super-secret-hmac-key"

# SMTP
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Frontend
FRONTEND_URL="http://localhost:3000"
```

### 3. Database Migration

Run the Prisma migration to create the audit table:

```bash
npx prisma migrate deploy
```

Or manually run the migration:

```bash
npx prisma db execute --file Database/prisma/migrations/add_password_reset_audit/migration.sql
```

### 4. Seed Bloom Filter

Initialize the Bloom filter with existing users:

```bash
node scripts/seedBloomFilter.js
```

### 5. Start the Server

```bash
npm start
```

The server will start on port 3000 (or your configured PORT).

## Testing the API

### Test Forgot Password

```bash
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Expected Response:**
```json
{
  "message": "If this email is registered, you will receive a password reset link."
}
```

### Check Email

You should receive an email with a reset link like:
```
http://localhost:3000/reset-password?tokenId=550e8400-...&token=abc123...
```

### Test Token Validation

```bash
curl http://localhost:3000/api/v1/auth/check-reset-token/550e8400-e29b-41d4-a716-446655440000
```

**Expected Response:**
```json
{
  "valid": true,
  "expiresIn": 847,
  "message": "This link will expire in 14 minutes"
}
```

### Test Reset Password

```bash
curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": "550e8400-e29b-41d4-a716-446655440000",
    "token": "abc123...",
    "newPassword": "newSecurePassword123"
  }'
```

**Expected Response:**
```json
{
  "message": "Password has been reset successfully."
}
```

## Monitoring

### Check Health

```bash
curl http://localhost:3000/api/v1/health
```

### View Metrics

```bash
curl http://localhost:3000/api/v1/metrics
```

### View Metrics (JSON)

```bash
curl http://localhost:3000/api/v1/metrics/json
```

## Common Issues

### Issue: "Email sending failed"

**Solution:**
1. Verify SMTP credentials in `.env`
2. For Gmail, use an App Password (not your regular password)
3. Enable "Less secure app access" or use OAuth2

### Issue: "Redis connection failed"

**Solution:**
1. Ensure Redis is running: `redis-cli ping`
2. Check REDIS_URL in `.env`
3. Start Redis: `redis-server`

### Issue: "Database connection failed"

**Solution:**
1. Ensure PostgreSQL is running
2. Verify DATABASE_URL in `.env`
3. Run migrations: `npx prisma migrate deploy`

### Issue: "Bloom filter not initialized"

**Solution:**
1. Run the seed script: `node scripts/seedBloomFilter.js`
2. Check that users exist in the database
3. Verify Redis connection

## Next Steps

1. **Configure Production SMTP**: Use a production email service (SendGrid, AWS SES, Mailgun)
2. **Set Up Monitoring**: Configure Prometheus to scrape `/metrics`
3. **Enable HTTPS**: Use a reverse proxy (Nginx, Caddy) or load balancer
4. **Review Security**: Change all default secrets
5. **Test Rate Limiting**: Verify rate limits work as expected
6. **Set Up Alerts**: Monitor for suspicious activity in audit logs

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/reset-password` | Submit new password |
| GET | `/api/v1/auth/check-reset-token/:tokenId` | Validate token |
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/metrics` | Prometheus metrics |
| GET | `/api/v1/metrics/json` | JSON metrics |

## Security Notes

1. **Always use HTTPS in production**
2. **Never commit `.env` file to git**
3. **Use strong, random secrets**
4. **Monitor rate limit violations**
5. **Review audit logs regularly**
6. **Keep dependencies updated**

## Support

For detailed documentation, see:
- [PASSWORD_RESET_SYSTEM.md](./PASSWORD_RESET_SYSTEM.md) - Complete system documentation
- [Prisma Schema](../Database/prisma/schema.prisma) - Database schema
- [Environment Variables](./.env.example) - Configuration reference
