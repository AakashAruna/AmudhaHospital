const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const allowAll = requireRole(['Admin', 'Pharmacist', 'Billing Clerk']);

router.get('/', authenticateToken, allowAll, appointmentController.listAppointments);
router.get('/next-queue', authenticateToken, allowAll, appointmentController.getNextQueueNumber);
router.post('/', authenticateToken, allowAll, appointmentController.createAppointment);
router.put('/:appointment_id', authenticateToken, allowAll, appointmentController.updateAppointment);
router.delete('/:appointment_id', authenticateToken, allowAll, appointmentController.deleteAppointment);

module.exports = router;
