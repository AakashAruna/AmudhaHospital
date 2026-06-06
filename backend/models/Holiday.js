const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Holiday = sequelize.define('Holiday', {
  id: {
    type: DataTypes.STRING(36),
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  date: {
    type: DataTypes.STRING(10), // YYYY-MM-DD
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.STRING(100),
    allowNull: true
  }
}, {
  tableName: 'holidays',
  timestamps: false
});

module.exports = Holiday;
