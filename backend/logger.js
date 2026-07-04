/**
 * logger.js
 * Logger centralizado con pino.
 * - En producción: JSON estructurado (rápido, para ingestión por Datadog/Loki).
 * - En desarrollo: salida simple a consola sin pretty-print para evitar overhead.
 */
const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'info' : 'info'),
  // En desarrollo usamos el transport de pino-pretty sólo si se activa
  // la variable PRETTY_LOGS=true, de lo contrario salida JSON estándar
  ...(isDev && process.env.PRETTY_LOGS === 'true'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

module.exports = logger;
