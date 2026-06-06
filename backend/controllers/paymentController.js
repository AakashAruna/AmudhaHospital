const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Invoice, PaymentTransaction, InventoryItem, AuditLog, Patient } = require('../models');
const websocketManager = require('../websocket');

exports.processPayment = async (req, res) => {
  const { invoice_id } = req.params;
  const { amount_paid, payment_mode, reference_number } = req.body;

  if (!amount_paid || amount_paid <= 0 || !payment_mode) {
    return res.status(400).json({ detail: 'amount_paid (positive) and payment_mode are required' });
  }

  const transaction = await sequelize.transaction();

  try {
    const invoice = await Invoice.findByPk(invoice_id, { transaction });
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ detail: 'Invoice not found' });
    }

    if (invoice.status === 'Paid') {
      await transaction.rollback();
      return res.status(400).json({ detail: 'Invoice is already fully paid' });
    }

    const amountPaidNum = Number(amount_paid);
    const outOfPocketNum = Number(invoice.out_of_pocket_due);

    if (amountPaidNum > outOfPocketNum) {
      await transaction.rollback();
      return res.status(400).json({
        detail: `Payment amount (₹${amountPaidNum.toFixed(2)}) exceeds due amount (₹${outOfPocketNum.toFixed(2)})`
      });
    }

    // Create Payment Transaction
    const payTx = await PaymentTransaction.create({
      invoice_id: invoice.id,
      amount_paid: amountPaidNum,
      payment_mode,
      status: 'Success',
      reference_number: reference_number || null,
      processed_by: req.user.username,
      timestamp: new Date()
    }, { transaction });

    // Update Invoice out of pocket due
    invoice.out_of_pocket_due = outOfPocketNum - amountPaidNum;
    if (Number(invoice.out_of_pocket_due) <= 0) {
      invoice.status = 'Paid';
    } else {
      invoice.status = 'Partial';
    }
    invoice.updated_at = new Date();
    await invoice.save({ transaction });

    // Log payment in AuditLog
    await AuditLog.create({
      action_type: 'PAYMENT_RECEIVED',
      description: `Processed payment of ₹${amountPaidNum.toFixed(2)} (Mode: ${payment_mode}) for Invoice ${invoice.id}. Remaining due: ₹${Number(invoice.out_of_pocket_due).toFixed(2)}`,
      performed_by: req.user.username
    }, { transaction });

    await transaction.commit();

    // Broadcast WS event
    websocketManager.broadcast({
      type: 'PAYMENT_ALERT',
      invoice_id: invoice.id,
      amount_paid: amountPaidNum,
      status: invoice.status,
      remaining_due: Number(invoice.out_of_pocket_due),
      timestamp: new Date().toISOString()
    });

    return res.json(payTx);
  } catch (err) {
    await transaction.rollback();
    console.error('Process payment error:', err);
    return res.status(500).json({ detail: 'Failed to process payment transaction' });
  }
};

exports.listTransactions = async (req, res) => {
  try {
    const transactions = await PaymentTransaction.findAll({
      include: [
        {
          model: Invoice,
          as: 'invoice',
          include: [
            {
              model: Patient,
              as: 'patient'
            }
          ]
        }
      ],
      order: [['timestamp', 'DESC']]
    });
    return res.json(transactions);
  } catch (err) {
    console.error('List transactions error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve transactions' });
  }
};

exports.getDailyCollections = async (req, res) => {
  try {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - 30);

    const transactions = await PaymentTransaction.findAll({
      where: {
        status: 'Success',
        timestamp: {
          [Op.gte]: startDate
        }
      }
    });

    const dailySums = {};
    // Initialize past 7 days with 0.00
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      dailySums[dayStr] = 0.00;
    }

    for (const tx of transactions) {
      const dayStr = new Date(tx.timestamp).toISOString().split('T')[0];
      dailySums[dayStr] = (dailySums[dayStr] || 0.00) + Number(tx.amount_paid);
    }

    // Format for recharts
    const chartData = Object.keys(dailySums)
      .sort()
      .map(date => ({
        date,
        amount: Number(dailySums[date].toFixed(2))
      }));

    return res.json(chartData);
  } catch (err) {
    console.error('Get daily collections error:', err);
    return res.status(500).json({ detail: 'Failed to generate charts data' });
  }
};

exports.getDashboardMetrics = async (req, res) => {
  try {
    const items = await InventoryItem.findAll();

    // 1. Total Stock Value: Sum(current_stock * unit_price)
    const totalStockValue = items.reduce(
      (sum, item) => sum + item.current_stock * Number(item.unit_price),
      0
    );

    // 2. Low Stock Count
    const lowStockCount = items.filter(item => item.current_stock <= item.reorder_level).length;

    // 3. Expiring Soon Count (within 30 days)
    const today = new Date();
    const expThreshold = new Date();
    expThreshold.setDate(today.getDate() + 30);
    const expiringSoonCount = items.filter(item => new Date(item.expiry_date) <= expThreshold).length;

    // 4. Total Receivables: Sum(out_of_pocket_due) from invoices
    const totalReceivables = await Invoice.sum('out_of_pocket_due') || 0.00;

    // 5. Total Collections: Sum(amount_paid) from payment transactions
    const totalCollections = await PaymentTransaction.sum('amount_paid', {
      where: { status: 'Success' }
    }) || 0.00;

    return res.json({
      total_stock_value: Number(totalStockValue.toFixed(2)),
      low_stock_count: lowStockCount,
      expiring_soon_count: expiringSoonCount,
      total_receivables: Number(totalReceivables.toFixed(2)),
      total_collections: Number(totalCollections.toFixed(2))
    });
  } catch (err) {
    console.error('Get dashboard metrics error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve dashboard metrics' });
  }
};
