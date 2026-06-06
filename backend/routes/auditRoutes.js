const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const allowAll = requireRole(['Admin', 'Pharmacist', 'Billing Clerk']);

router.get('/', authenticateToken, allowAll, auditController.getAuditLogs);

module.exports = router;
