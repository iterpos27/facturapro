const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function resolvePostgresBinary(envName, binaryName) {
  if (process.env[envName]) return process.env[envName];
  if (process.platform === 'win32') {
    const postgresRoot = 'C:\\Program Files\\PostgreSQL';
    if (fs.existsSync(postgresRoot)) {
      const versions = fs.readdirSync(postgresRoot)
        .filter((entry) => fs.existsSync(path.join(postgresRoot, entry, 'bin', binaryName)))
        .sort((a, b) => Number(b) - Number(a));
      if (versions.length > 0) return path.join(postgresRoot, versions[0], 'bin', binaryName);
    }
  }
  return binaryName.replace(/\.exe$/i, '');
}

function latestBackupFile() {
  const backupsDir = path.resolve(__dirname, '..', 'backups');
  const files = fs.readdirSync(backupsDir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => path.join(backupsDir, file))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env: {
      ...process.env,
      PGPASSWORD: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
    },
    encoding: 'utf8',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} fallo con codigo ${result.status}: ${result.stderr || result.stdout}`);
  }
  return result.stdout || '';
}

const backupFile = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : latestBackupFile();
if (!backupFile || !fs.existsSync(backupFile)) {
  console.error('No hay backup .sql para validar. Ejecute primero npm run db:backup.');
  process.exit(1);
}

const psql = resolvePostgresBinary('PSQL_PATH', 'psql.exe');
const hostArgs = [];
if (process.env.DB_HOST) hostArgs.push('--host', process.env.DB_HOST);
if (process.env.DB_PORT) hostArgs.push('--port', process.env.DB_PORT);
if (process.env.DB_USER) hostArgs.push('--username', process.env.DB_USER);

const maintenanceDb = process.env.DB_MAINTENANCE_DATABASE || 'postgres';
const testDb = `facturapro_restore_check_${process.pid}_${Date.now()}`;

try {
  run(psql, [...hostArgs, '--dbname', maintenanceDb, '--command', `CREATE DATABASE ${testDb}`], { stdio: 'pipe' });
  run(psql, [...hostArgs, '--dbname', testDb, '--set', 'ON_ERROR_STOP=on', '--file', backupFile], { stdio: 'pipe' });
  const tableCount = run(psql, [
    ...hostArgs,
    '--dbname',
    testDb,
    '--tuples-only',
    '--no-align',
    '--command',
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'",
  ], { stdio: 'pipe' }).trim();

  console.log(`Restauracion de prueba OK en ${testDb}. Tablas publicas: ${tableCount}.`);
} catch (error) {
  console.error(`Restauracion de prueba fallida: ${error.message}`);
  process.exitCode = 1;
} finally {
  try {
    run(psql, [...hostArgs, '--dbname', maintenanceDb, '--command', `DROP DATABASE IF EXISTS ${testDb} WITH (FORCE)`], { stdio: 'pipe' });
  } catch (error) {
    console.error(`No se pudo eliminar la base temporal ${testDb}: ${error.message}`);
    process.exitCode = 1;
  }
}
