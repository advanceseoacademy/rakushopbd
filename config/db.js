/**
 * Database: Supabase (PostgreSQL) via DATABASE_URL
 * Legacy MySQL: set DB_DRIVER=mysql and DB_HOST, DB_USER, etc.
 */
const { convertPlaceholders, isPostgres } = require('../lib/db-dialect');
const { camelizeRow } = require('../lib/pg-row');

let pool = null;

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    ''
  );
}

function usePostgres() {
  if (process.env.DB_DRIVER === 'mysql') return false;
  if (process.env.DB_DRIVER === 'postgres') return true;
  return Boolean(getDatabaseUrl());
}

function getPool() {
  if (pool) return pool;

  if (usePostgres()) {
    const { Pool } = require('pg');
    const url = getDatabaseUrl();
    if (!url) {
      throw new Error('Set DATABASE_URL (Supabase → Project Settings → Database → Connection string)');
    }
    pool = new Pool({
      connectionString: url,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 10,
    });
    return pool;
  }

  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  });
  return pool;
}

async function query(sql, params = []) {
  const p = getPool();
  const { text, values } = convertPlaceholders(sql, params, usePostgres());
  if (usePostgres()) {
    const result = await p.query(text, values);
    return result.rows.map(camelizeRow);
  }
  const [rows] = await p.execute(text, values);
  return rows;
}

/** After INSERT … RETURNING id (Postgres) or legacy insertId wrapper */
function firstInsertId(rows) {
  if (!rows || !rows.length) return null;
  if (rows[0]?.id != null) return rows[0].id;
  if (rows.insertId != null) return rows.insertId;
  return null;
}

module.exports = { getPool, query, firstInsertId, usePostgres, isPostgres: usePostgres };
