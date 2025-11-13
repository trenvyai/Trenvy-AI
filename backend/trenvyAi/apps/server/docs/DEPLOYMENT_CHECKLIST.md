# Production Deployment Checklist

## Pre-Deployment

### Environment Configuration

- [ ] Copy `.env.example` to `.env`
- [ ] Set `NODE_ENV=production`
- [ ] Generate strong random secret for `JWT_SECRET` (min 32 chars)
- [ ] Generate strong random secret for `RESET_TOKEN_HMAC_SECRET` (min 32 chars, different from JWT_SECRET)
- [ ] Configure production `DATABASE_URL`
- [ ] Configure production `REDIS_URL`
- [ ] Set production `FRONTEND_URL`
- [ ] Configure SMTP credentials (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
- [ ] Verify all environment variables are set

### Database Setup

- [ ] PostgreSQL is running and accessible
- [ ] Database exists and is empty or ready for migration
- [ ] Run: `npx prisma migrate deploy`
- [ ] Verify `User` table exists
- [ ] Verify `password_resets_audit` table exists
- [ ] Verify `EmailChange` table exists
- [ ] Check database indexes are created
- [ ] Test database connection: `npx prisma db pull`

### Redis Setup

- [ ] Redis is running and accessible
- [ ] Test connection: `redis-cli ping`
- [ ] Configure Redis persistence (RDB or AOF)
- [ ] Set appropriate `maxmemory` policy
- [ ] Enable Redis authentication if exposed
- [ ] Configure Redis backup strategy

### Dependencies

- [ ] Run: `npm install --production`
- [ ] Verify `uuid` package is installed
- [ ] Verify `winston` package is installed
- [ ] Check for security vulnerabilities: `npm audit`
- [ ] Update vulnerable packages: `npm audit fix`

### Bloom Filter

- [ ] Run seed script: `node scripts/seedBloomFilter.js`
- [ ] Verify Bloom filter statistics show correct user count
- [ ] Schedule periodic refresh (e.g., daily cron job)

## Security Checklist

### Secrets Management

- [ ] All secrets are strong and random (use `openssl rand -base64 32`)
- [ ] Secrets are different from each other
- [ ] `.env` file is in `.gitignore`
- [ ] Secrets are stored securely (AWS Secrets Manager, HashiCorp Vault, etc.)
- [ ] No secrets are hardcoded in source code
- [ ] No secrets are logged

### HTTPS/TLS

- [ ] SSL certificate is valid and not expired
- [ ] HTTPS is enforced (HTTP redirects to HTTPS)
- [ ] TLS 1.2 or higher is used
- [ ] SSL termination is at reverse proxy or load balancer
- [ ] HSTS header is enabled
- [ ] Certificate auto-renewal is configured (Let's Encrypt)

### Rate Limiting

- [ ] IP rate limiting is enabled (20/hour)
- [ ] User rate limiting is enabled (5/hour)
- [ ] Token rate limiting is enabled (10/5min)
- [ ] Rate limits are tested under load
- [ ] Additional rate limiting at load balancer level (optional)

### Email Security

- [ ] SMTP uses TLS/SSL
- [ ] SPF record is configured
- [ ] DKIM is configured
- [ ] DMARC policy is set
- [ ] Email templates don't expose sensitive data
- [ ] Unsubscribe links work (if applicable)

## Monitoring Setup

### Prometheus

- [ ] Prometheus is installed and running
- [ ] Prometheus is configured to scrape `/api/v1/metrics`
- [ ] Scrape interval is set (e.g., 15s)
- [ ] Metrics are being collected
- [ ] Retention period is configured

### Logging

- [ ] Structured JSON logging is enabled
- [ ] Logs are sent to centralized service (CloudWatch, Datadog, ELK)
- [ ] Log retention policy is set
- [ ] Sensitive data is not logged (passwords, tokens)
- [ ] Correlation IDs are present in all logs
- [ ] Log levels are appropriate (INFO in production)

### Alerting

- [ ] Alerts for high error rates
- [ ] Alerts for rate limit violations
- [ ] Alerts for database connection failures
- [ ] Alerts for Redis connection failures
- [ ] Alerts for email sending failures
- [ ] Alerts for high memory usage
- [ ] Alerts for disk space
- [ ] On-call rotation is configured

### Health Checks

- [ ] Load balancer is configured to use `/api/v1/health`
- [ ] Health check interval is set (e.g., 30s)
- [ ] Unhealthy instances are removed from rotation
- [ ] Health check timeout is configured

## Application Setup

### Process Management

- [ ] Using process manager (PM2, systemd, Docker)
- [ ] Auto-restart on crash is enabled
- [ ] Graceful shutdown is implemented
- [ ] Multiple instances for high availability (optional)
- [ ] Load balancing between instances (optional)

### Performance

- [ ] Node.js version is LTS (v18 or v20)
- [ ] `NODE_ENV=production` is set
- [ ] Compression middleware is enabled
- [ ] Connection pooling is configured (Prisma default)
- [ ] Redis connection pooling is configured
- [ ] Static assets are served via CDN (if applicable)

### Backup Strategy

- [ ] Database backups are automated
- [ ] Backup retention policy is set
- [ ] Backup restoration is tested
- [ ] Redis persistence is enabled (RDB or AOF)
- [ ] Audit logs are backed up

## Testing

### Functional Testing

- [ ] Test forgot password flow end-to-end
- [ ] Test reset password flow end-to-end
- [ ] Test token expiration (wait 15 minutes)
- [ ] Test invalid token handling
- [ ] Test rate limiting (IP, user, token)
- [ ] Test email delivery
- [ ] Test Bloom filter (valid and invalid emails)
- [ ] Test audit logging

### Load Testing

- [ ] Simulate high request volume
- [ ] Test rate limiting under load
- [ ] Monitor database performance
- [ ] Monitor Redis performance
- [ ] Check for memory leaks
- [ ] Verify email queue doesn't overflow

### Security Testing

- [ ] Test anti-enumeration (timing attacks)
- [ ] Test token brute-force protection
- [ ] Test SQL injection (Prisma should prevent)
- [ ] Test XSS in email templates
- [ ] Test CSRF protection
- [ ] Run security scanner (OWASP ZAP, Burp Suite)

## Post-Deployment

### Verification

- [ ] Application is accessible via HTTPS
- [ ] Health check returns 200 OK
- [ ] Metrics endpoint is accessible
- [ ] Test password reset flow in production
- [ ] Verify emails are being sent
- [ ] Check audit logs are being written
- [ ] Monitor error logs for issues

### Monitoring

- [ ] Set up Grafana dashboards
  - [ ] Password reset funnel
  - [ ] API performance (latency, RPS)
  - [ ] System health (memory, CPU, connections)
  - [ ] Security metrics (rate limits, audit events)
- [ ] Verify alerts are working
- [ ] Test on-call notification

### Documentation

- [ ] Update internal documentation
- [ ] Document deployment process
- [ ] Document rollback procedure
- [ ] Document incident response plan
- [ ] Share credentials with team (securely)

## Rollback Plan

### Preparation

- [ ] Previous version is tagged in git
- [ ] Database migration rollback script exists
- [ ] Rollback procedure is documented
- [ ] Team knows how to execute rollback

### Rollback Steps

1. [ ] Stop new version
2. [ ] Revert database migrations (if needed)
3. [ ] Deploy previous version
4. [ ] Verify health checks pass
5. [ ] Monitor for errors
6. [ ] Notify team of rollback

## Maintenance

### Regular Tasks

- [ ] Weekly: Review audit logs for suspicious activity
- [ ] Weekly: Check error rates and alerts
- [ ] Monthly: Update dependencies (`npm update`)
- [ ] Monthly: Review and rotate secrets
- [ ] Monthly: Test backup restoration
- [ ] Quarterly: Security audit
- [ ] Quarterly: Load testing

### Bloom Filter Maintenance

- [ ] Daily: Refresh Bloom filter (`node scripts/seedBloomFilter.js`)
- [ ] Monitor false positive rate in metrics
- [ ] Adjust filter size if needed

## Compliance

- [ ] GDPR compliance (if applicable)
  - [ ] User data can be exported
  - [ ] User data can be deleted
  - [ ] Privacy policy is updated
- [ ] CCPA compliance (if applicable)
- [ ] SOC 2 compliance (if applicable)
- [ ] Data retention policies are enforced

## Sign-Off

- [ ] Development team approves
- [ ] Security team approves
- [ ] Operations team approves
- [ ] Product owner approves

---

**Deployment Date:** _______________

**Deployed By:** _______________

**Version:** _______________

**Notes:**
