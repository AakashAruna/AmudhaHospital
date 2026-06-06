const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const allowWrite = requireRole(['Admin', 'Billing Clerk']);
const allowAll = requireRole(['Admin', 'Pharmacist', 'Billing Clerk']);

router.post('/checkout/:invoice_id', authenticateToken, allowWrite, paymentController.processPayment);
router.get('/transactions', authenticateToken, allowAll, paymentController.listTransactions);
router.get('/charts/daily-collections', authenticateToken, allowAll, paymentController.getDailyCollections);
router.get('/dashboard-metrics', authenticateToken, allowAll, paymentController.getDashboardMetrics);

module.exports = router;
