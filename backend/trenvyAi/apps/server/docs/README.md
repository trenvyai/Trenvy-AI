# Password Reset System Documentation

## Overview

This directory contains comprehensive documentation for the production-grade password reset system.

## Documentation Files

### 📘 [QUICK_START.md](./QUICK_START.md)
**Start here!** Quick installation and testing guide.
- Installation steps
- Environment setup
- Testing the API
- Common issues and solutions

### 📗 [PASSWORD_RESET_SYSTEM.md](./PASSWORD_RESET_SYSTEM.md)
**Complete system documentation** covering architecture, security, and implementation details.
- Architecture overview
- Security features (anti-enumeration, rate limiting, token security)
- Data flow diagrams
- API endpoints
- Monitoring and metrics
- Performance optimizations

### 📙 [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
**Production deployment guide** with comprehensive checklist.
- Pre-deployment tasks
- Security checklist
- Monitoring setup
- Testing procedures
- Post-deployment verification
- Rollback plan

## Quick Links

### Getting Started
1. [Install dependencies](./QUICK_START.md#installation)
2. [Configure environment](./QUICK_START.md#environment-setup)
3. [Run migrations](./QUICK_START.md#database-migration)
4. [Seed Bloom filter](./QUICK_START.md#seed-bloom-filter)
5. [Start server](./QUICK_START.md#start-the-server)

### Key Features
- **Anti-Enumeration Protection**: Uniform responses and timing
- **Three-Layer Rate Limiting**: IP, user, and token-based
- **Bloom Filter Optimization**: 90% reduction in DB queries
- **Token Security**: HMAC hashing with timing-safe comparison
- **Memory-Hard Password Hashing**: Scrypt (Argon2id-ready)
- **Comprehensive Audit Logging**: Non-repudiable trail
- **Prometheus Metrics**: Production-ready monitoring

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/forgot-password` | POST | Request password reset |
| `/api/v1/auth/reset-password` | POST | Submit new password |
| `/api/v1/auth/check-reset-token/:tokenId` | GET | Validate token |
| `/api/v1/health` | GET | Health check |
| `/api/v1/metrics` | GET | Prometheus metrics |

### Security Highlights

```
Defense-in-Depth Architecture:

┌─────────────────────────────────────────┐
│  1. IP Rate Limiting (20/hour)          │
├─────────────────────────────────────────┤
│  2. Bloom Filter (O(1) check)           │
├─────────────────────────────────────────┤
│  3. User Rate Limiting (5/hour)         │
├─────────────────────────────────────────┤
│  4. Token HMAC Hashing                  │
├─────────────────────────────────────────┤
│  5. Timing-Safe Comparison              │
├─────────────────────────────────────────┤
│  6. Token Rate Limiting (10/5min)       │
├─────────────────────────────────────────┤
│  7. Memory-Hard Password Hashing        │
├─────────────────────────────────────────┤
│  8. Audit Logging                       │
└─────────────────────────────────────────┘
```

## File Structure

```
backend/trenvyAi/apps/server/
├── routes/
│   ├── passwordReset.js          # Password reset endpoints
│   └── monitoring.js             # Health and metrics endpoints
├── middleware/
│   └── rateLimiter.js            # Three-layer rate limiting
├── services/
│   ├── AuditLogger.js            # Audit logging service
│   ├── EmailQueue.js             # Email queue service
│   ├── Metrics.js                # Prometheus metrics
│   ├── HashPassword.js           # Password hashing (bcrypt + scrypt)
│   └── UsernameVerifier.js       # Bloom filter service
├── scripts/
│   └── seedBloomFilter.js        # Bloom filter initialization
├── docs/
│   ├── README.md                 # This file
│   ├── QUICK_START.md            # Quick start guide
│   ├── PASSWORD_RESET_SYSTEM.md  # Complete documentation
│   └── DEPLOYMENT_CHECKLIST.md   # Deployment guide
└── .env.example                  # Environment variables template
```

## Environment Variables

Key environment variables (see [.env.example](../.env.example)):

```env
# Secrets (CRITICAL - Change in production!)
JWT_SECRET="your-super-secret-jwt-key"
RESET_TOKEN_HMAC_SECRET="your-super-secret-hmac-key"

# Database & Redis
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

# SMTP
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Frontend
FRONTEND_URL="http://localhost:3000"
```

## Monitoring

### Prometheus Metrics

Access metrics at: `http://localhost:3000/api/v1/metrics`

Key metrics:
- `password_reset_requests_total` - Total reset requests by status
- `password_reset_completions_total` - Total completions by status
- `password_reset_request_duration` - Request latency histogram
- `redis_connected` - Redis connection status
- `database_connected` - Database connection status

### Health Check

Access health at: `http://localhost:3000/api/v1/health`

Returns:
```json
{
  "status": "ok",
  "checks": {
    "redis": "ok",
    "database": "ok",
    "memory": { "status": "ok", "percentage": "35%" }
  }
}
```

## Testing

### Manual Testing

```bash
# Request password reset
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Reset password
curl -X POST http://localhost:3000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": "550e8400-...",
    "token": "abc123...",
    "newPassword": "newPassword123"
  }'
```

### Load Testing

Use tools like:
- Apache Bench: `ab -n 1000 -c 10 http://localhost:3000/api/v1/health`
- k6: For complex scenarios
- Artillery: For API load testing

## Support & Troubleshooting

### Common Issues

1. **Emails not sending**: Check SMTP credentials and port
2. **Rate limiting not working**: Verify Redis connection
3. **Bloom filter errors**: Run seed script
4. **Token verification failing**: Check HMAC secret consistency

### Debug Mode

Enable debug logging:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Audit Logs

Query audit logs:
```javascript
import { getUserAuditLogs } from './services/AuditLogger.js';
const logs = await getUserAuditLogs(userId, 50);
```

## Contributing

When making changes:
1. Update relevant documentation
2. Add tests for new features
3. Update CHANGELOG.md
4. Follow existing code style
5. Run linter: `npm run lint`

## Security

### Reporting Vulnerabilities

Please report security issues to: security@trenvy.com

### Security Best Practices

1. Never log sensitive data (tokens, passwords)
2. Always use HTTPS in production
3. Rotate secrets regularly
4. Monitor audit logs for suspicious activity
5. Keep dependencies updated

## License

MIT

## Additional Resources

- [OWASP Password Reset Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [Bloom Filter Wikipedia](https://en.wikipedia.org/wiki/Bloom_filter)
- [Argon2 Specification](https://github.com/P-H-C/phc-winner-argon2)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
