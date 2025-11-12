import prisma from '../database/prismaClient.js';

/**
 * Audit logging for password reset events
 * Stores non-repudiable trail in PostgreSQL
 */
export async function auditLog({ id, userId, requestIp, outcome, meta }) {
  try {
    await prisma.password_resets_audit.create({
      data: {
        id,
        userId: userId || 'unknown',
        requestIp: requestIp || 'unknown',
        outcome,
        meta: meta || {},
        requestedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error writing audit log:', error);
    // Don't throw - audit logging failure shouldn't block the main flow
  }
}

/**
 * Query audit logs for a specific user
 */
export async function getUserAuditLogs(userId, limit = 50) {
  try {
    return await prisma.password_resets_audit.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      take: limit
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
}
