const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.get('/', authenticateToken, attendanceController.getAttendance);
router.post('/check-in', authenticateToken, attendanceController.checkIn);
router.post('/check-out', authenticateToken, attendanceController.checkOut);
router.post('/log', authenticateToken, requireRole(['Admin']), attendanceController.logAttendance);

router.get('/holidays', authenticateToken, attendanceController.getHolidays);
router.post('/holidays', authenticateToken, requireRole(['Admin']), attendanceController.declareHoliday);
router.delete('/holidays/:id', authenticateToken, requireRole(['Admin']), attendanceController.deleteHoliday);

module.exports = router;
