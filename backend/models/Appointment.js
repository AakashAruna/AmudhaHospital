const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  patient_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  patient_age: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  patient_gender: {
    type: DataTypes.STRING(10),
    allowNull: false
  },
  patient_contact: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  doctor_name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  appointment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  appointment_time: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  queue_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'Scheduled'
  },
  created_by: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'appointments',
  timestamps: false
});

module.exports = Appointment;
