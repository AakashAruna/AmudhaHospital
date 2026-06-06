const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const allowWrite = requireRole(['Admin', 'Billing Clerk']);
const allowAll = requireRole(['Admin', 'Pharmacist', 'Billing Clerk']);

// Patient routes
router.get('/patients', authenticateToken, allowAll, billingController.listPatients);
router.get('/patients/:id/history', authenticateToken, allowAll, billingController.getPatientHistory);
router.post('/patients', authenticateToken, allowWrite, billingController.createPatient);

// Invoice routes
router.get('/invoices', authenticateToken, allowAll, billingController.listInvoices);
router.get('/invoices/:invoice_id', authenticateToken, allowAll, billingController.getInvoice);
router.post('/invoices', authenticateToken, allowWrite, billingController.createInvoice);

module.exports = router;
