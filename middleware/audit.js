const { pool } = require('../db');

async function auditLog(req, action, entityType, entityId, detail) {
  try {
    const user = req.session && req.session.user;
    await pool.query(
      'INSERT INTO audit_log (user_id, user_name, user_email, action, entity_type, entity_id, detail, ip_address) VALUES (?,?,?,?,?,?,?,?)',
      [
        user ? user.id : null,
        user ? user.name : 'System',
        user ? user.email : null,
        action,
        entityType || null,
        entityId || null,
        detail || null,
        req.ip || null
      ]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

module.exports = { auditLog };
