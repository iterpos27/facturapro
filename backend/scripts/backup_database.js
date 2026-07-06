const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const backupsDir = path.resolve(__dirname, '..', 'backups');
fs.mkdirSync(backupsDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const database = process.env.DB_DATABASE || process.env.PGDATABASE || 'facturapro';
const outputFile = path.join(backupsDir, `${database}_${timestamp}.sql`);

function resolvePostgresBinary(envName, binaryName) {
  if (process.env[envName]) return process.env[envName];
  if (process.platform === 'win32') {
    const postgresRoot = 'C:\\Program Files\\PostgreSQL';
    if (fs.existsSync(postgresRoot)) {
      const versions = fs.readdirSync(postgresRoot)
        .filter((entry) => fs.existsSync(path.join(postgresRoot, entry, 'bin', binaryName)))
        .sort((a, b) => Number(b) - Number(a));
      if (versions.length > 0) {
        return path.join(postgresRoot, versions[0], 'bin', binaryName);
      }
    }
  }
  return binaryName.replace(/\.exe$/i, '');
}

const pgDump = resolvePostgresBinary('PG_DUMP_PATH', 'pg_dump.exe');
const args = [
  '--format=plain',
  '--no-owner',
  '--no-privileges',
  '--clean',
  '--if-exists',
  '--file',
  outputFile,
];

if (process.env.DB_HOST) args.push('--host', process.env.DB_HOST);
if (process.env.DB_PORT) args.push('--port', process.env.DB_PORT);
if (process.env.DB_USER) args.push('--username', process.env.DB_USER);
args.push(database);

const child = spawn(pgDump, args, {
  env: {
    ...process.env,
    PGPASSWORD: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stdout.on('data', (chunk) => process.stdout.write(chunk));
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString();
  process.stderr.write(chunk);
});

child.on('error', (error) => {
  console.error(`No se pudo ejecutar pg_dump. Configure PG_DUMP_PATH si PostgreSQL no esta en PATH. Detalle: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`Backup fallido con codigo ${code}.`);
    if (stderr) console.error(stderr);
    process.exit(code);
  }
  console.log(`Backup creado: ${outputFile}`);
});
