/**
 * ecosystem.config.js — Configuración de PM2 para FacturaPro
 *
 * Uso:
 *   pm2 start ecosystem.config.js          # Arrancar en cluster mode
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save                               # Guardar lista de procesos
 *   pm2 startup                            # Auto-arranque al reiniciar servidor
 *   pm2 logs facturapro-api                # Ver logs en vivo
 *   pm2 monit                              # Monitor de recursos
 */

module.exports = {
  apps: [
    {
      name: 'facturapro-api',
      script: './server.js',

      // Cluster mode: usa todos los núcleos de CPU disponibles
      // Cambia a un número fijo si tienes otras apps en el mismo servidor
      instances: 'max',
      exec_mode: 'cluster',

      // Reinicio automático si la app consume más de 512MB RAM
      max_memory_restart: '512M',

      // Variables de entorno por ambiente
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Logs — PM2 los rotará automáticamente
      out_file:   './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Reinicio retardado para evitar loops de crash en errores persistentes
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',

      // Apagado graceful: esperar 5s para que las conexiones activas terminen
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
