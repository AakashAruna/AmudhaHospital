const { Op } = require('sequelize');
const { InventoryItem, AuditLog } = require('../models');
const websocketManager = require('../websocket');

exports.listInventory = async (req, res) => {
  const { q, category } = req.query;
  const whereClause = {};

  if (q) {
    whereClause[Op.or] = [
      { item_name: { [Op.iLike]: `%${q}%` } },
      { batch_number: { [Op.iLike]: `%${q}%` } }
    ];
  }

  if (category) {
    whereClause.category = category;
  }

  try {
    const items = await InventoryItem.findAll({
      where: whereClause,
      order: [['item_name', 'ASC']]
    });
    return res.json(items);
  } catch (err) {
    console.error('List inventory error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve inventory items' });
  }
};

exports.createItem = async (req, res) => {
  const {
    item_name,
    category,
    batch_number,
    expiry_date,
    current_stock,
    reorder_level,
    unit_price,
    supplier_info
  } = req.body;

  if (!item_name || !category || !batch_number || !expiry_date) {
    return res.status(400).json({ detail: 'Required fields missing: item_name, category, batch_number, expiry_date' });
  }

  try {
    const item = await InventoryItem.create({
      item_name,
      category,
      batch_number,
      expiry_date,
      current_stock: current_stock || 0,
      reorder_level: reorder_level || 0,
      unit_price: unit_price || 0.00,
      supplier_info: supplier_info || null
    });

    // Audit log
    await AuditLog.create({
      action_type: 'INVENTORY_CREATE',
      description: `Created new inventory item: ${item.item_name} (Category: ${item.category}, Stock: ${item.current_stock})`,
      performed_by: req.user.username
    });

    return res.status(201).json(item);
  } catch (err) {
    console.error('Create inventory item error:', err);
    return res.status(500).json({ detail: 'Failed to create inventory item' });
  }
};

exports.updateItem = async (req, res) => {
  const { item_id } = req.params;
  const updateData = req.body;

  try {
    const item = await InventoryItem.findByPk(item_id);
    if (!item) {
      return res.status(404).json({ detail: 'Inventory item not found' });
    }

    const overrides = [];
    if (updateData.current_stock !== undefined && updateData.current_stock !== item.current_stock) {
      overrides.push(`stock from ${item.current_stock} to ${updateData.current_stock}`);
    }
    if (updateData.unit_price !== undefined && Number(updateData.unit_price) !== Number(item.unit_price)) {
      overrides.push(`price from ₹${item.unit_price} to ₹${updateData.unit_price}`);
    }

    // Apply updates
    await item.update(updateData);

    if (overrides.length > 0) {
      // Create an audit log record
      await AuditLog.create({
        action_type: 'INVENTORY_OVERRIDE',
        description: `Manual override for ${item.item_name}: Changed ${overrides.join(', ')}`,
        performed_by: req.user.username
      });
    }

    // Check if drops below or equal to reorder level
    if (item.current_stock <= item.reorder_level) {
      websocketManager.broadcast({
        type: 'LOW_STOCK_ALERT',
        item_id: item.id,
        item_name: item.item_name,
        current_stock: item.current_stock,
        reorder_level: item.reorder_level,
        timestamp: new Date().toISOString()
      });
    }

    return res.json(item);
  } catch (err) {
    console.error('Update inventory item error:', err);
    return res.status(500).json({ detail: 'Failed to update inventory item' });
  }
};

exports.dispenseItem = async (req, res) => {
  const { item_id } = req.params;
  const { quantity } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ detail: 'Valid quantity greater than 0 is required' });
  }

  try {
    const item = await InventoryItem.findByPk(item_id);
    if (!item) {
      return res.status(404).json({ detail: 'Inventory item not found' });
    }

    if (item.current_stock < quantity) {
      return res.status(400).json({
        detail: `Insufficient stock for ${item.item_name}. Available: ${item.current_stock}, Requested: ${quantity}`
      });
    }

    item.current_stock -= quantity;
    await item.save();

    // Log dispense action
    await AuditLog.create({
      action_type: 'DISPENSE_ITEM',
      description: `Dispensed ${quantity} units of ${item.item_name} (Remaining: ${item.current_stock})`,
      performed_by: req.user.username
    });

    // Check if drops below reorder level
    if (item.current_stock <= item.reorder_level) {
      websocketManager.broadcast({
        type: 'LOW_STOCK_ALERT',
        item_id: item.id,
        item_name: item.item_name,
        current_stock: item.current_stock,
        reorder_level: item.reorder_level,
        timestamp: new Date().toISOString()
      });
    }

    return res.json(item);
  } catch (err) {
    console.error('Dispense inventory item error:', err);
    return res.status(500).json({ detail: 'Failed to dispense inventory item' });
  }
};
