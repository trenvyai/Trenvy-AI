import express from 'express';
import { metrics } from '../services/Metrics.js';
import redisClient from '../microservices/Redisserver.js';
import prisma from '../Database/prismaClient.js';

const router = express.Router();

/**
 * GET /metrics
 * Prometheus metrics endpoint
 */
router.get('/metrics', async (req, res) => {
  try {
    // Add system metrics
    metrics.gauge('nodejs_memory_usage_bytes', process.memoryUsage().heapUsed);
    metrics.gauge('nodejs_uptime_seconds', process.uptime());

    // Add Redis connection status
    try {
      await redisClient.ping();
      metrics.gauge('redis_connected', 1);
    } catch {
      metrics.gauge('redis_connected', 0);
    }

    // Add database connection status
    try {
      await prisma.$queryRaw`SELECT 1`;
      metrics.gauge('database_connected', 1);
    } catch {
      metrics.gauge('database_connected', 0);
    }

    const prometheusFormat = metrics.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(prometheusFormat);
  } catch (error) {
    console.error('Error generating metrics:', error);
    res.status(500).send('Error generating metrics');
  }
});

/**
 * GET /health
 * Health check endpoint for load balancers
 */
router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  // Check Redis
  try {
    await redisClient.ping();
    health.checks.redis = 'ok';
  } catch (error) {
    health.checks.redis = 'error';
    health.status = 'degraded';
  }

  // Check Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.checks.database = 'ok';
  } catch (error) {
    health.checks.database = 'error';
    health.status = 'degraded';
  }

  // Check memory usage
  const memUsage = process.memoryUsage();
  const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  health.checks.memory = {
    status: memUsagePercent < 90 ? 'ok' : 'warning',
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
    percentage: Math.round(memUsagePercent) + '%'
  };

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * GET /metrics/json
 * JSON format metrics (for debugging)
 */
router.get('/metrics/json', (req, res) => {
  try {
    const metricsData = metrics.getMetrics();
    res.json(metricsData);
  } catch (error) {
    console.error('Error generating JSON metrics:', error);
    res.status(500).json({ error: 'Error generating metrics' });
  }
});

export default router;
