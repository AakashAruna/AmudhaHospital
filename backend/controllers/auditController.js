const { AuditLog } = require('../models');

exports.getAuditLogs = async (req, res) => {
  try {
    const logs = await AuditLog.findAll({
      order: [['timestamp', 'DESC']]
    });
    return res.json(logs);
  } catch (err) {
    console.error('Get audit logs error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve audit logs' });
  }
};
