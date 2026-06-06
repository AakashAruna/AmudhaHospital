const { Sequelize } = require('sequelize');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Database configuration
// If DATABASE_URL is set (Supabase / Render PostgreSQL), use PostgreSQL.
// Otherwise fall back to the local SQLite file for development.
// ─────────────────────────────────────────────────────────────────────────────

let sequelize;

if (process.env.DATABASE_URL) {
  // ── PostgreSQL (Supabase or Render) ──────────────────────────────────────
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false   // needed for Supabase / Render certs
      }
    },
    logging: false,
    define: {
      timestamps: false
    }
  });
} else {
  // ── SQLite (local development) ─────────────────────────────────────────
  const fs = require('fs');
  let dbPath = path.resolve(__dirname, '../../hms.db');
  if (!fs.existsSync(dbPath)) {
    const rootDb = path.resolve(process.cwd(), 'hms.db');
    if (fs.existsSync(rootDb)) {
      dbPath = rootDb;
    } else {
      dbPath = path.resolve(__dirname, '../hms.db');
    }
  }

  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: false,
    define: {
      timestamps: false
    }
  });

  // Enable SQLite foreign key enforcement
  sequelize.addHook('afterConnect', (connection) => {
    connection.run('PRAGMA foreign_keys = ON;', (err) => {
      if (err) console.error('Failed to enable SQLite foreign keys:', err);
    });
  });
}

module.exports = sequelize;
