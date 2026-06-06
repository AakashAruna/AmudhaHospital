const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') }); // Load .env variables relative to backend directory
const express = require('express');
const cors = require('cors');
const http = require('http');
const { sequelize } = require('./models');
const websocketManager = require('./websocket');

// Import routes
const authRoutes = require('./routes/authRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const billingRoutes = require('./routes/billingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const auditRoutes = require('./routes/auditRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS — allow configured frontend domain + localhost for local dev
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL  // e.g. https://amudha-hospital.netlify.app
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for origin: ' + origin));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middlewares
app.use(express.json());
// Auth context sends urlencoded credentials for login
app.use(express.urlencoded({ extended: true }));

// Register MVC Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/attendance', attendanceRoutes);

// Root path handler
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    project: 'Amudha Hospital Management System API'
  });
});

// Create HTTP server wrapper for WebSocket integration
const server = http.createServer(app);

// Initialize WebSocket Manager
websocketManager.init(server);

// Database connection & startup
const startServer = async () => {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    const isPostgres = !!process.env.DATABASE_URL;

    if (isPostgres) {
      // Supabase / PostgreSQL:
      // Tables are created via supabase_schema.sql in the Supabase SQL Editor.
      // sequelize.sync() runs in safe mode — it will NOT drop or alter existing tables.
      await sequelize.sync({ force: false, alter: false });
      console.log('Sequelize models synced (PostgreSQL — schema managed via Supabase SQL Editor).');
    } else {
      // SQLite (local development): auto-create/alter tables
      await sequelize.sync();
      console.log('Database tables synchronized (SQLite).');

      // SQLite-only migrations: add columns added after initial schema
      const migrations = [
        'ALTER TABLE users ADD COLUMN base_salary DECIMAL(10, 2) DEFAULT 0.00;',
        'ALTER TABLE users ADD COLUMN daily_wage DECIMAL(10, 2) DEFAULT 0.00;',
        'ALTER TABLE appointments ADD COLUMN queue_number INTEGER DEFAULT 0;'
      ];
      for (const sql of migrations) {
        try { await sequelize.query(sql); } catch (e) { /* column already exists — safe to ignore */ }
      }

      // Backfill queue numbers for SQLite appointments that have 0 or NULL
      try {
        const [existing] = await sequelize.query(
          'SELECT id, doctor_name, appointment_date FROM appointments WHERE queue_number = 0 OR queue_number IS NULL ORDER BY appointment_date ASC, id ASC'
        );
        if (existing && existing.length > 0) {
          console.log(`Backfilling queue numbers for ${existing.length} appointments...`);
          for (const row of existing) {
            const [maxQResult] = await sequelize.query(
              'SELECT MAX(queue_number) as max_q FROM appointments WHERE doctor_name = :doctor AND appointment_date = :date AND queue_number > 0',
              { replacements: { doctor: row.doctor_name, date: row.appointment_date } }
            );
            const currentMax = (maxQResult && maxQResult[0] && maxQResult[0].max_q) || 0;
            await sequelize.query(
              'UPDATE appointments SET queue_number = :nextQ WHERE id = :id',
              { replacements: { nextQ: currentMax + 1, id: row.id } }
            );
          }
          console.log('Queue number backfill complete.');
        }
      } catch (e) {
        console.error('Failed to backfill queue numbers:', e);
      }
    }

    server.listen(PORT, () => {
      console.log(`Express server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start Express server:', err);
    process.exit(1);
  }
};

startServer();


