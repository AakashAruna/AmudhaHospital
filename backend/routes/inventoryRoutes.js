const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticateToken, requireRole } = require('../middleware/auth');

const allowWrite = requireRole(['Admin', 'Pharmacist']);
const allowAll = requireRole(['Admin', 'Pharmacist', 'Billing Clerk']);

router.get('/', authenticateToken, allowAll, inventoryController.listInventory);
router.post('/', authenticateToken, allowWrite, inventoryController.createItem);
router.put('/:item_id', authenticateToken, allowWrite, inventoryController.updateItem);
router.post('/:item_id/dispense', authenticateToken, allowWrite, inventoryController.dispenseItem);

module.exports = router;
