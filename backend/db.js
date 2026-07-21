const { Pool } = require('pg');
require('dotenv').config();
const logger = require('./utils/logger');

const pool = new Pool({
  user:     process.env.DB_USER,
  host:     process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port:     parseInt(process.env.DB_PORT || '5432', 10),

  // Límites del pool — evitan agotar conexiones bajo carga
  max:                parseInt(process.env.DB_POOL_MAX   || '20',   10),
  idleTimeoutMillis:  parseInt(process.env.DB_POOL_IDLE  || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_TIMEOUT || '5000', 10),
  allowExitOnIdle: true,

  // Timeout de sentencia en el lado del servidor (ms → seg para PostgreSQL)
  // Evita que una query colgada bloquee una conexión indefinidamente
  ...(process.env.DB_STATEMENT_TIMEOUT
    ? { statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT, 10) }
    : {}),
});

const shouldLogSql = process.env.DB_LOG_SQL === 'true';

module.exports = {
  query: (text, params) => {
    if (shouldLogSql) {
      logger.debug({ sql: text }, 'SQL Executed');
    }
    return pool.query(text, params);
  },
  pool,
};
