const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);
router.post('/register', authController.register);
router.put('/profile', authenticateToken, authController.updateProfile);
router.get('/users', authenticateToken, authController.listUsers);
router.delete('/users/:id', authenticateToken, requireRole(['Admin']), authController.deleteUser);
router.put('/users/:id/salary', authenticateToken, requireRole(['Admin']), authController.updateBaseSalary);

module.exports = router;
