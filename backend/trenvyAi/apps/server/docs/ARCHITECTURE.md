# Password Reset System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Load Balancer / Reverse Proxy                 │
│                    (Nginx, Caddy, AWS ALB)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Express.js Application                      │
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Password Reset Routes                      │    │
│  │  • POST /api/v1/auth/forgot-password                   │    │
│  │  • POST /api/v1/auth/reset-password                    │    │
│  │  • GET  /api/v1/auth/check-reset-token/:tokenId        │    │
│  └────────────────────────────────────────────────────────┘    │
│                             │                                     │
│                             ▼                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Middleware Layer                           │    │
│  │  • Rate Limiter (IP, User, Token)                      │    │
│  │  • Input Validation                                     │    │
│  │  • Correlation ID                                       │    │
│  └────────────────────────────────────────────────────────┘    │
│                             │                                     │
│                             ▼                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Services Layer                             │    │
│  │  • Bloom Filter (UsernameVerifier)                     │    │
│  │  • Email Queue                                          │    │
│  │  • Audit Logger                                         │    │
│  │  • Metrics                                              │    │
│  │  • Hash Password (Argon2id/scrypt)                     │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
        ┌────────────────────┴────────────────────┐
        │                                          │
        ▼                                          ▼
┌──────────────────┐                    ┌──────────────────┐
│   PostgreSQL     │                    │      Redis       │
│                  │                    │                  │
│  • Users         │                    │  • Tokens        │
│  • Audit Logs    │                    │  • Rate Limits   │
│  • Email Changes │                    │  • Bloom Filter  │
└──────────────────┘                    └──────────────────┘
        │
        │
        ▼
┌──────────────────┐
│   SMTP Server    │
│  (Gmail, SES)    │
└──────────────────┘
```

## Request Flow: Forgot Password

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ POST /api/v1/auth/forgot-password
     │ { "email": "user@example.com" }
     ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Input Validation                                      │
│    • Email format check                                  │
│    • Normalize (lowercase, trim)                         │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. IP Rate Limiting (Redis Lua Script)                  │
│    • Key: password_reset:rate:ip:1.2.3.4                │
│    • Limit: 20 requests/hour                             │
│    • Action: If exceeded, return success (anti-enum)     │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Bloom Filter Check (O(1) in-memory)                  │
│    • Check: bloomFilter.mightExist(email)               │
│    • If FALSE: Return success (no DB query)             │
│    • If TRUE: Continue to DB                             │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Database Query (Slow Path)                           │
│    • Query: SELECT id, email, name FROM users           │
│    • If NOT FOUND: Return success (anti-enum)           │
│    • If FOUND: Continue                                  │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. User Rate Limiting (Redis Lua Script)                │
│    • Key: password_reset:rate:user:uuid                 │
│    • Limit: 5 requests/hour                              │
│    • Action: If exceeded, return success (anti-enum)     │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Token Generation                                      │
│    • tokenId: UUID v4                                    │
│    • rawToken: 48 bytes crypto random (base64url)       │
│    • tokenHash: HMAC-SHA256(rawToken, secret)           │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Store Token in Redis                                 │
│    • Key: password_reset:token:tokenId                  │
│    • Value: { userId, tokenHash, email, createdAt }     │
│    • TTL: 900 seconds (15 minutes)                      │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 8. Enqueue Email (Async)                                │
│    • Add job to email queue                             │
│    • Payload: { email, name, tokenId, rawToken }        │
│    • Worker sends email in background                   │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 9. Audit Log (PostgreSQL)                               │
│    • Record: { id, userId, ip, outcome, meta }          │
│    • Outcome: "requested"                               │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 10. Metrics (Prometheus)                                │
│     • Increment: password_reset_requests_total          │
│     • Histogram: password_reset_request_duration        │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────┐
│ Response│ 200 OK
│ "If this email is registered, you will receive a link"  │
└─────────┘
```

## Request Flow: Reset Password

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     │ POST /api/v1/auth/reset-password
     │ { "tokenId": "...", "token": "...", "newPassword": "..." }
     ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Input Validation                                      │
│    • tokenId: UUID v4 format                             │
│    • token: base64url, 32-256 chars                      │
│    • newPassword: min 8 chars                            │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Token Rate Limiting (Redis Lua Script)               │
│    • Key: password_reset:validate:token:tokenId         │
│    • Limit: 10 attempts/5 minutes                        │
│    • Action: If exceeded, return 429 error               │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Token Lookup (Redis)                                 │
│    • Key: password_reset:token:tokenId                  │
│    • If NOT FOUND: Return 400 "Invalid or expired"      │
│    • If FOUND: Parse { userId, tokenHash, email }       │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Token Verification (Timing-Safe)                     │
│    • Hash provided token: HMAC-SHA256(token, secret)    │
│    • Compare: crypto.timingSafeEqual(hash, tokenHash)   │
│    • If MISMATCH: Return 400 "Invalid token"            │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Password Hashing (Memory-Hard)                       │
│    • Algorithm: crypto.scrypt (Argon2id-ready)          │
│    • Parameters: N=16384, r=8, p=1, keylen=64           │
│    • Output: scrypt:salt:hash                            │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Database Update (PostgreSQL)                         │
│    • UPDATE users SET password = hash WHERE id = userId │
│    • UPDATE users SET updatedAt = NOW()                 │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Token Invalidation (Redis)                           │
│    • DELETE password_reset:token:tokenId                │
│    • DELETE all other tokens for this userId            │
│    • DELETE password_reset:validate:token:tokenId       │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 8. Notification Email (Async)                           │
│    • Enqueue "Password Changed" email                   │
│    • Include: timestamp, IP address                      │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 9. Audit Log (PostgreSQL)                               │
│    • Record: { id, userId, ip, outcome, meta }          │
│    • Outcome: "reset"                                    │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 10. Metrics (Prometheus)                                │
│     • Increment: password_reset_completions_total       │
│     • Histogram: password_reset_completion_duration     │
└────┬────────────────────────────────────────────────────┘
     │
     ▼
┌─────────┐
│ Response│ 200 OK
│ "Password has been reset successfully"                   │
└─────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Defense-in-Depth Layers                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Layer 1: Network Security                                   │
│  ├─ HTTPS/TLS encryption                                     │
│  ├─ Reverse proxy (Nginx, Caddy)                            │
│  └─ Load balancer rate limiting                              │
│                                                               │
│  Layer 2: Application Rate Limiting                          │
│  ├─ IP-based: 20 requests/hour                              │
│  ├─ User-based: 5 requests/hour                             │
│  └─ Token-based: 10 attempts/5 minutes                       │
│                                                               │
│  Layer 3: Anti-Enumeration                                   │
│  ├─ Uniform response messages                                │
│  ├─ Uniform timing (Bloom filter)                           │
│  └─ No error differentiation                                 │
│                                                               │
│  Layer 4: Bloom Filter Optimization                          │
│  ├─ O(1) in-memory check                                     │
│  ├─ Prevents DB load from attacks                           │
│  └─ ~90% query reduction                                     │
│                                                               │
│  Layer 5: Token Security                                     │
│  ├─ Cryptographically random generation                      │
│  ├─ HMAC-SHA256 hashing                                      │
│  ├─ Timing-safe comparison                                   │
│  ├─ Single-use tokens                                        │
│  └─ Short TTL (15 minutes)                                   │
│                                                               │
│  Layer 6: Password Security                                  │
│  ├─ Memory-hard hashing (scrypt/Argon2id)                   │
│  ├─ High computational cost                                  │
│  └─ GPU/ASIC resistant                                       │
│                                                               │
│  Layer 7: Audit & Monitoring                                 │
│  ├─ Non-repudiable audit logs                               │
│  ├─ Correlation IDs for tracing                             │
│  ├─ Prometheus metrics                                       │
│  └─ Structured logging                                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Data Storage

### Redis Keys

```
# Token Storage
password_reset:token:{tokenId}
├─ Value: { userId, tokenHash, email, createdAt }
├─ TTL: 900 seconds (15 minutes)
└─ Purpose: Store reset token data

# Rate Limiting
password_reset:rate:ip:{ip}
├─ Value: request count
├─ TTL: 3600 seconds (1 hour)
└─ Purpose: IP-based rate limiting

password_reset:rate:user:{userId}
├─ Value: request count
├─ TTL: 3600 seconds (1 hour)
└─ Purpose: User-based rate limiting

password_reset:validate:token:{tokenId}
├─ Value: attempt count
├─ TTL: 300 seconds (5 minutes)
└─ Purpose: Token validation rate limiting

# Bloom Filter
bloom:emails
├─ Value: Bloom filter bit array
├─ TTL: None (persistent)
└─ Purpose: Fast email existence check
```

### PostgreSQL Tables

```sql
-- Users Table
users
├─ id (UUID, PK)
├─ email (TEXT, UNIQUE)
├─ username (TEXT)
├─ password (TEXT) -- Hashed with scrypt/Argon2id
├─ name (TEXT)
├─ isVerified (BOOLEAN)
├─ createdAt (TIMESTAMP)
└─ updatedAt (TIMESTAMP)

-- Audit Logs Table
password_resets_audit
├─ id (TEXT, PK) -- Correlation ID
├─ userId (TEXT, FK -> users.id)
├─ requestedAt (TIMESTAMP)
├─ requestIp (TEXT)
├─ outcome (TEXT) -- "requested", "reset", "rate_limited", etc.
└─ meta (JSONB) -- Additional metadata

-- Email Changes Table (existing)
EmailChange
├─ id (UUID, PK)
├─ userId (TEXT, FK -> users.id)
├─ newEmail (TEXT)
├─ tokenHash (TEXT, UNIQUE)
├─ expiresAt (TIMESTAMP)
├─ used (BOOLEAN)
└─ createdAt (TIMESTAMP)
```

## Monitoring Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Express Application                    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │            Metrics Service                       │   │
│  │  • Counters (requests, errors, rate limits)     │   │
│  │  • Gauges (connections, memory, queue size)     │   │
│  │  • Histograms (latency, duration)               │   │
│  └────────────────────┬────────────────────────────┘   │
└───────────────────────┼─────────────────────────────────┘
                        │
                        │ HTTP GET /api/v1/metrics
                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Prometheus Server                     │
│  • Scrapes metrics every 15s                            │
│  • Stores time-series data                              │
│  • Evaluates alerting rules                             │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Grafana Dashboards                    │
│  • Password Reset Funnel                                │
│  • API Performance (latency, RPS)                       │
│  • System Health (memory, CPU, connections)             │
│  • Security Metrics (rate limits, audit events)         │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Alertmanager                          │
│  • Routes alerts to on-call                             │
│  • Integrates with PagerDuty, Slack, etc.              │
└─────────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Load Balancer (AWS ALB)                │
│  • SSL Termination                                       │
│  • Health Checks (/api/v1/health)                       │
│  • Rate Limiting (additional layer)                      │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  App Server │  │  App Server │  │  App Server │
│  Instance 1 │  │  Instance 2 │  │  Instance 3 │
│             │  │             │  │             │
│  Node.js    │  │  Node.js    │  │  Node.js    │
│  Express    │  │  Express    │  │  Express    │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ PostgreSQL  │  │    Redis    │  │ Prometheus  │
│  (Primary)  │  │   Cluster   │  │   Server    │
│             │  │             │  │             │
│  + Replica  │  │  + Sentinel │  │             │
└─────────────┘  └─────────────┘  └─────────────┘
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Technology Stack                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Runtime                                                 │
│  └─ Node.js v18+ (LTS)                                  │
│                                                           │
│  Framework                                               │
│  └─ Express.js v5                                        │
│                                                           │
│  Database                                                │
│  ├─ PostgreSQL (primary data store)                     │
│  └─ Prisma ORM (type-safe queries)                      │
│                                                           │
│  Cache & Queue                                           │
│  └─ Redis (tokens, rate limits, Bloom filter)           │
│                                                           │
│  Email                                                   │
│  └─ Nodemailer (SMTP client)                            │
│                                                           │
│  Security                                                │
│  ├─ crypto (Node.js built-in)                           │
│  ├─ bcrypt (legacy password hashing)                    │
│  └─ scrypt (memory-hard hashing)                        │
│                                                           │
│  Monitoring                                              │
│  ├─ Winston (structured logging)                        │
│  └─ Custom Metrics Service (Prometheus-compatible)      │
│                                                           │
│  Utilities                                               │
│  └─ uuid (token ID generation)                          │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Performance Characteristics

```
┌─────────────────────────────────────────────────────────┐
│                  Performance Metrics                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Bloom Filter Check                                      │
│  ├─ Time Complexity: O(1)                               │
│  ├─ Latency: < 1ms                                      │
│  └─ DB Query Reduction: ~90%                            │
│                                                           │
│  Redis Operations                                        │
│  ├─ GET/SET: < 1ms                                      │
│  ├─ Lua Script: < 2ms                                   │
│  └─ Connection Pool: 10 connections                      │
│                                                           │
│  Database Queries                                        │
│  ├─ User Lookup: 5-10ms (indexed)                      │
│  ├─ Audit Insert: 2-5ms                                 │
│  └─ Connection Pool: 10 connections                      │
│                                                           │
│  Password Hashing                                        │
│  ├─ scrypt: 100-200ms (intentionally slow)             │
│  └─ Argon2id: 200-500ms (production)                   │
│                                                           │
│  Email Sending                                           │
│  ├─ Async: Non-blocking                                 │
│  └─ SMTP: 1-5 seconds (background)                     │
│                                                           │
│  API Response Times (p95)                                │
│  ├─ /forgot-password: < 200ms                          │
│  ├─ /reset-password: < 300ms                           │
│  └─ /health: < 50ms                                     │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Scalability Considerations

### Horizontal Scaling

- ✅ Stateless application servers
- ✅ Redis for shared state (tokens, rate limits)
- ✅ PostgreSQL read replicas for high read load
- ✅ Load balancer distributes traffic

### Vertical Scaling

- ✅ Increase Node.js memory (--max-old-space-size)
- ✅ Increase Redis memory (maxmemory)
- ✅ Increase PostgreSQL resources (CPU, RAM)

### Bottlenecks

1. **Password Hashing**: CPU-intensive (intentional)
   - Solution: Use worker threads or separate service

2. **Email Sending**: Network-bound
   - Solution: BullMQ with multiple workers

3. **Database Writes**: Audit logs
   - Solution: Batch inserts or async writes

4. **Redis Memory**: Bloom filter + tokens
   - Solution: Increase memory or use Redis Cluster

## Future Enhancements

```
┌─────────────────────────────────────────────────────────┐
│                   Roadmap                                │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Phase 1: Core Improvements                              │
│  ├─ BullMQ integration for email queue                  │
│  ├─ True Argon2id password hashing                      │
│  └─ Grafana dashboards                                   │
│                                                           │
│  Phase 2: Advanced Features                              │
│  ├─ SMS 2FA for password reset                          │
│  ├─ Email template engine (Handlebars)                  │
│  ├─ Multi-language support (i18n)                       │
│  └─ Distributed tracing (Jaeger)                        │
│                                                           │
│  Phase 3: Enterprise Features                            │
│  ├─ SSO integration (SAML, OAuth)                       │
│  ├─ Advanced fraud detection                             │
│  ├─ Compliance reporting (GDPR, SOC 2)                  │
│  └─ Multi-region deployment                              │
│                                                           │
└─────────────────────────────────────────────────────────┘
```
