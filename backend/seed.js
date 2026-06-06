const bcrypt = require('bcryptjs');
const { sequelize, User, Patient, InventoryItem, AuditLog } = require('./models');

const seedData = async () => {
  try {
    console.log('Connecting to database for seeding...');
    await sequelize.authenticate();
    await sequelize.sync();

    // Check if users already exist to prevent duplicates
    const adminUser = await User.findOne({ where: { username: 'admin' } });
    if (adminUser) {
      console.log('Database already seeded.');
      process.exit(0);
    }

    console.log('Seeding database...');
    
    // Hash passwords (standard password for demo profiles)
    const hashedPassword = bcrypt.hashSync('Password123', 10);
    
    // 1. Users
    await User.bulkCreate([
      { username: 'suriya', hashed_password: hashedPassword, role: 'Admin', full_name: 'Dr. Suriya M.B.B.S.' },
      { username: 'pharmacist', hashed_password: hashedPassword, role: 'Pharmacist', full_name: 'Patricia Pharmacist' },
      { username: 'clerk', hashed_password: hashedPassword, role: 'Billing Clerk', full_name: 'Christopher Clerk' }
    ]);

    // 2. Patients
    await Patient.bulkCreate([
      { name: 'John Doe', age: 45, gender: 'Male', contact: '+1 555-0199', admission_status: 'Inpatient' },
      { name: 'Jane Smith', age: 32, gender: 'Female', contact: '+1 555-0122', admission_status: 'Outpatient' },
      { name: 'Alice Johnson', age: 28, gender: 'Female', contact: '+1 555-0155', admission_status: 'Inpatient' },
      { name: 'Robert Lee', age: 67, gender: 'Male', contact: '+1 555-0188', admission_status: 'Outpatient' }
    ]);

    // 3. Inventory Items
    await InventoryItem.bulkCreate([
      {
        item_name: 'Paracetamol 500mg',
        category: 'Pharma',
        batch_number: 'PM88123',
        expiry_date: '2027-12-31',
        current_stock: 150,
        reorder_level: 50,
        unit_price: 0.15,
        supplier_info: 'Apex Pharmaceuticals'
      },
      {
        item_name: 'Amoxicillin 250mg',
        category: 'Pharma',
        batch_number: 'AM00456',
        expiry_date: '2026-10-15',
        current_stock: 80,
        reorder_level: 20,
        unit_price: 0.45,
        supplier_info: 'Cura Labs'
      },
      {
        item_name: 'Surgical Gloves (Size M)',
        category: 'Surgical',
        batch_number: 'GL88210',
        expiry_date: '2029-05-01',
        current_stock: 15,
        reorder_level: 30,
        unit_price: 1.20,
        supplier_info: 'MedTech Supplies'
      },
      {
        item_name: 'Syringe 5ml',
        category: 'Surgical',
        batch_number: 'SY77321',
        expiry_date: '2028-09-30',
        current_stock: 500,
        reorder_level: 100,
        unit_price: 0.30,
        supplier_info: 'MedTech Supplies'
      },
      {
        item_name: 'Adhesive Bandages',
        category: 'Consumable',
        batch_number: 'BD11092',
        expiry_date: '2026-06-25',
        current_stock: 12,
        reorder_level: 25,
        unit_price: 0.05,
        supplier_info: 'CareCorp'
      },
      {
        item_name: 'Saline Solution 500ml',
        category: 'Consumable',
        batch_number: 'SL99210',
        expiry_date: '2027-04-18',
        current_stock: 60,
        reorder_level: 15,
        unit_price: 2.50,
        supplier_info: 'BioGen Health'
      }
    ]);

    // 4. Audit Log
    await AuditLog.create({
      action_type: 'SYSTEM_INIT',
      description: 'Database seeded. Standard roles and mock patients/inventory created.',
      performed_by: 'system'
    });

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed database:', err);
    process.exit(1);
  }
};

seedData();
