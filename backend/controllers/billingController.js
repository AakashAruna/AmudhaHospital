const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Patient, Invoice, BillItem, InventoryItem, AuditLog, Appointment } = require('../models');
const websocketManager = require('../websocket');

const TAX_RATE = 0.10; // Flat 10% tax

// --- PATIENT ENDPOINTS ---

exports.listPatients = async (req, res) => {
  const { q } = req.query;
  const whereClause = {};

  if (q) {
    whereClause[Op.or] = [
      { name: { [Op.iLike]: `%${q}%` } },
      { contact: { [Op.iLike]: `%${q}%` } }
    ];
  }

  try {
    const patients = await Patient.findAll({
      where: whereClause,
      order: [['name', 'ASC']]
    });
    return res.json(patients);
  } catch (err) {
    console.error('List patients error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve patients list' });
  }
};

exports.createPatient = async (req, res) => {
  const { name, age, gender, contact, admission_status } = req.body;

  if (!name || !age || !gender || !contact || !admission_status) {
    return res.status(400).json({ detail: 'Required fields missing: name, age, gender, contact, admission_status' });
  }

  try {
    const patient = await Patient.create({
      name,
      age,
      gender,
      contact,
      admission_status
    });

    // Log patient registration in AuditLog
    await AuditLog.create({
      action_type: 'PATIENT_CREATE',
      description: `Registered new patient: ${patient.name} (${patient.admission_status})`,
      performed_by: req.user.username
    });

    return res.status(201).json(patient);
  } catch (err) {
    console.error('Create patient error:', err);
    return res.status(500).json({ detail: 'Failed to create patient' });
  }
};

// --- INVOICE ENDPOINTS ---

exports.listInvoices = async (req, res) => {
  const { status_filter } = req.query;
  const whereClause = {};

  if (status_filter) {
    whereClause.status = status_filter;
  }

  try {
    const invoices = await Invoice.findAll({
      where: whereClause,
      include: [
        { model: Patient, as: 'patient' },
        { model: BillItem, as: 'items' }
      ],
      order: [['created_at', 'DESC']]
    });
    return res.json(invoices);
  } catch (err) {
    console.error('List invoices error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve invoices' });
  }
};

exports.getInvoice = async (req, res) => {
  const { invoice_id } = req.params;

  try {
    const invoice = await Invoice.findByPk(invoice_id, {
      include: [
        { model: Patient, as: 'patient' },
        { model: BillItem, as: 'items' }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ detail: 'Invoice not found' });
    }

    return res.json(invoice);
  } catch (err) {
    console.error('Get invoice error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve invoice' });
  }
};

exports.createInvoice = async (req, res) => {
  const { patient_id, discount, insurance_covered, items, doctor_name } = req.body;

  if (!patient_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ detail: 'patient_id and a non-empty list of items are required' });
  }

  const transaction = await sequelize.transaction();

  try {
    // 1. Validate Patient
    const patient = await Patient.findByPk(patient_id, { transaction });
    if (!patient) {
      await transaction.rollback();
      return res.status(400).json({ detail: 'Invalid patient ID' });
    }

    // 2. Process Bill Items & Reduce Inventory for Inventory Items
    const itemsToCreate = [];
    let subtotalSum = 0;

    for (const itemData of items) {
      const qty = itemData.quantity || 1;
      let price = itemData.unit_price || 0.00;

      if (itemData.item_type === 'Inventory') {
        if (!itemData.item_id) {
          await transaction.rollback();
          return res.status(400).json({ detail: 'item_id is required for Inventory item types' });
        }

        const invItem = await InventoryItem.findByPk(itemData.item_id, { transaction });
        if (!invItem) {
          await transaction.rollback();
          return res.status(400).json({ detail: `Inventory item ${itemData.item_id} not found` });
        }

        if (invItem.current_stock < qty) {
          await transaction.rollback();
          return res.status(400).json({
            detail: `Insufficient stock for ${invItem.item_name}. Available: ${invItem.current_stock}, Requested: ${qty}`
          });
        }

        // Use inventory item price if not customized/supplied as positive
        if (price <= 0) {
          price = Number(invItem.unit_price);
        }

        // Deduct stock
        invItem.current_stock -= qty;
        await invItem.save({ transaction });

        // Log dispense in audit logs
        await AuditLog.create({
          action_type: 'DISPENSE_ITEM',
          description: `Auto-dispensed ${qty} of ${invItem.item_name} via invoice creation`,
          performed_by: req.user.username
        }, { transaction });

        // Send real-time websocket low-stock alert if applicable
        if (invItem.current_stock <= invItem.reorder_level) {
          websocketManager.broadcast({
            type: 'LOW_STOCK_ALERT',
            item_id: invItem.id,
            item_name: invItem.item_name,
            current_stock: invItem.current_stock,
            reorder_level: invItem.reorder_level,
            timestamp: new Date().toISOString()
          });
        }
      }

      const subtotal = qty * price;
      subtotalSum += subtotal;

      itemsToCreate.push({
        item_type: itemData.item_type,
        item_id: itemData.item_id || null,
        quantity: qty,
        unit_price: price,
        subtotal: subtotal
      });
    }

    // Calculate tax & totals
    const taxAmount = subtotalSum * TAX_RATE;
    const grossTotal = subtotalSum + taxAmount;

    const discountVal = discount || 0.00;
    const insuranceVal = insurance_covered || 0.00;

    let outOfPocket = grossTotal - discountVal - insuranceVal;
    if (outOfPocket < 0) {
      outOfPocket = 0.00;
    }

    const invoiceStatus = outOfPocket === 0 ? 'Paid' : 'Unpaid';

    // Create the Invoice
    const invoice = await Invoice.create({
      patient_id,
      total_amount: grossTotal,
      discount: discountVal,
      insurance_covered: insuranceVal,
      out_of_pocket_due: outOfPocket,
      status: invoiceStatus,
      doctor_name: doctor_name || null
    }, { transaction });

    // Create Invoice items
    for (const item of itemsToCreate) {
      item.invoice_id = invoice.id;
      await BillItem.create(item, { transaction });
    }

    // Log invoice creation in audit log
    await AuditLog.create({
      action_type: 'INVOICE_CREATE',
      description: `Created Invoice ${invoice.id} for Patient ${patient.name}. Gross Total: ₹${grossTotal.toFixed(2)}, Out of Pocket: ₹${outOfPocket.toFixed(2)}`,
      performed_by: req.user.username
    }, { transaction });

    await transaction.commit();

    // Re-fetch populated invoice to return
    const populatedInvoice = await Invoice.findByPk(invoice.id, {
      include: [
        { model: Patient, as: 'patient' },
        { model: BillItem, as: 'items' }
      ]
    });

    return res.status(201).json(populatedInvoice);
  } catch (err) {
    await transaction.rollback();
    console.error('Create invoice error:', err);
    return res.status(500).json({ detail: 'Failed to create invoice' });
  }
};

exports.getPatientHistory = async (req, res) => {
  const { id } = req.params;

  try {
    const patient = await Patient.findByPk(id);
    if (!patient) {
      return res.status(404).json({ detail: 'Patient not found' });
    }

    // Fetch all invoices for this patient
    const invoices = await Invoice.findAll({
      where: { patient_id: id },
      include: [{ model: BillItem, as: 'items' }],
      order: [['created_at', 'DESC']]
    });

    // Fetch all appointments matching by name and contact
    const appointments = await Appointment.findAll({
      where: {
        patient_name: patient.name,
        patient_contact: patient.contact
      },
      order: [['appointment_date', 'DESC'], ['queue_number', 'DESC']]
    });

    return res.json({
      patient,
      invoices,
      appointments
    });
  } catch (err) {
    console.error('Get patient history error:', err);
    return res.status(500).json({ detail: 'Failed to retrieve patient medical history' });
  }
};
