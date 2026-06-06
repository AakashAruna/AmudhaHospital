const sequelize = require('../config/database');
const User = require('./User');
const InventoryItem = require('./InventoryItem');
const Patient = require('./Patient');
const Invoice = require('./Invoice');
const BillItem = require('./BillItem');
const PaymentTransaction = require('./PaymentTransaction');
const AuditLog = require('./AuditLog');
const Appointment = require('./Appointment');
const Attendance = require('./Attendance');
const Holiday = require('./Holiday');

// Associations

// Patient has many Invoices
Patient.hasMany(Invoice, {
  foreignKey: 'patient_id',
  as: 'invoices',
  onDelete: 'CASCADE'
});
Invoice.belongsTo(Patient, {
  foreignKey: 'patient_id',
  as: 'patient'
});

// Invoice has many BillItems
Invoice.hasMany(BillItem, {
  foreignKey: 'invoice_id',
  as: 'items',
  onDelete: 'CASCADE'
});
BillItem.belongsTo(Invoice, {
  foreignKey: 'invoice_id',
  as: 'invoice'
});

// BillItem belongs to InventoryItem
BillItem.belongsTo(InventoryItem, {
  foreignKey: 'item_id',
  as: 'inventoryItem',
  onDelete: 'SET NULL'
});

// Invoice has many PaymentTransactions
Invoice.hasMany(PaymentTransaction, {
  foreignKey: 'invoice_id',
  as: 'transactions',
  onDelete: 'CASCADE'
});
PaymentTransaction.belongsTo(Invoice, {
  foreignKey: 'invoice_id',
  as: 'invoice'
});

// User has many Attendances
User.hasMany(Attendance, {
  foreignKey: 'user_id',
  as: 'attendances',
  onDelete: 'CASCADE'
});
Attendance.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

module.exports = {
  sequelize,
  User,
  InventoryItem,
  Patient,
  Invoice,
  BillItem,
  PaymentTransaction,
  AuditLog,
  Appointment,
  Attendance,
  Holiday
};
