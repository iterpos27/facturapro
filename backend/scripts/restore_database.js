const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const backupFileArg = process.argv[2];
const confirmed = process.argv.includes('--yes');

if (!backupFileArg) {
  console.error('Uso: npm run db:restore -- <ruta-backup.sql> --yes');
  process.exit(1);
}

if (!confirmed) {
  console.error('Restauracion bloqueada. Agregue --yes despues del archivo para confirmar.');
  process.exit(1);
}

const backupFile = path.resolve(process.cwd(), backupFileArg);
if (!fs.existsSync(backupFile)) {
  console.error(`No existe el archivo de backup: ${backupFile}`);
  process.exit(1);
}

const database = process.env.DB_DATABASE || process.env.PGDATABASE || 'facturapro';
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

const psql = resolvePostgresBinary('PSQL_PATH', 'psql.exe');
const args = ['--set', 'ON_ERROR_STOP=on'];

if (process.env.DB_HOST) args.push('--host', process.env.DB_HOST);
if (process.env.DB_PORT) args.push('--port', process.env.DB_PORT);
if (process.env.DB_USER) args.push('--username', process.env.DB_USER);
args.push('--dbname', database, '--file', backupFile);

const child = spawn(psql, args, {
  env: {
    ...process.env,
    PGPASSWORD: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
  },
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`No se pudo ejecutar psql. Configure PSQL_PATH si PostgreSQL no esta en PATH. Detalle: ${error.message}`);
  process.exit(1);
});

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`Restauracion fallida con codigo ${code}.`);
    process.exit(code);
  }
  console.log(`Base ${database} restaurada desde ${backupFile}`);
});
