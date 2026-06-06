const { query, usePostgres } = require('../config/db');

let ensured = false;

async function ensureAppointmentsTable() {
  if (ensured) return true;
  const pg = usePostgres();
  const sql = pg
    ? `CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        reference_number VARCHAR(32) NOT NULL UNIQUE,
        customer_name VARCHAR(120) NOT NULL,
        customer_phone VARCHAR(30) NOT NULL,
        customer_email VARCHAR(120),
        appointment_date DATE NOT NULL,
        appointment_time VARCHAR(48) NOT NULL,
        service_type VARCHAR(80) NOT NULL DEFAULT 'consultation',
        notes TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )`
    : `CREATE TABLE IF NOT EXISTS appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reference_number VARCHAR(32) NOT NULL UNIQUE,
        customer_name VARCHAR(120) NOT NULL,
        customer_phone VARCHAR(30) NOT NULL,
        customer_email VARCHAR(120) NULL,
        appointment_date DATE NOT NULL,
        appointment_time VARCHAR(48) NOT NULL,
        service_type VARCHAR(80) NOT NULL DEFAULT 'consultation',
        notes TEXT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
  await query(sql);
  ensured = true;
  return true;
}

module.exports = { ensureAppointmentsTable };
