import pool from '../db.js';

export async function auditLog(
  action: string,
  options: {
    adminId?: string;
    adminName?: string;
    entityType?: string;
    entityId?: string;
    details?: string;
    ipAddress?: string;
  }
): Promise<void> {
  const { adminId, adminName, entityType, entityId, details, ipAddress } = options;
  try {
    await pool.query(
      'INSERT INTO audit_logs (admin_id, admin_name, action, entity_type, entity_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [adminId || null, adminName || '', action, entityType || '', entityId || '', details || '', ipAddress || '']
    );
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}