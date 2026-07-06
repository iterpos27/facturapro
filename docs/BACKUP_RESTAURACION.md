# Backup y restauracion PostgreSQL

## Backup manual

Desde `backend`:

```powershell
npm run db:backup
```

El script usa las variables de `backend/.env`:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_DATABASE`

El archivo se crea en:

```text
backend/backups/<base>_<fecha>.sql
```

## Cuando ejecutar backup

- Antes de correr migraciones.
- Antes de probar SRI.
- Antes de pasar a produccion.
- Antes de restaurar datos.
- Al cierre del dia, si no existe una tarea automatica externa.

## Restauracion

La restauracion es una accion delicada. Verificar primero que el archivo corresponde a la empresa correcta.

```powershell
npm run db:restore -- .\backups\facturapro_2026-07-05T10-00-00-000Z.sql --yes
```

El `--yes` es obligatorio para evitar restauraciones accidentales.

## Prueba de restauracion segura

Para comprobar que el backup sirve sin tocar la base principal:

```powershell
npm run db:restore-check
```

El script crea una base temporal, restaura el ultimo backup, cuenta tablas publicas y elimina la base temporal.

## PostgreSQL fuera del PATH

Si Windows no encuentra `pg_dump` o `psql`, configurar rutas absolutas en `backend/.env`:

```env
PG_DUMP_PATH=C:\Program Files\PostgreSQL\16\bin\pg_dump.exe
PSQL_PATH=C:\Program Files\PostgreSQL\16\bin\psql.exe
```

## Automatizacion recomendada en Windows

Crear una tarea en el Programador de tareas:

- Programa: `npm.cmd`
- Argumentos: `run db:backup`
- Iniciar en: `C:\Cursos\facturapro\backend`
- Frecuencia: diaria al cierre del negocio.

Tambien se deja un script listo para registrarla:

```powershell
cd C:\Cursos\facturapro\backend
powershell -ExecutionPolicy Bypass -File .\scripts\register_backup_task.ps1 -Time "20:00"
```

Ese comando modifica tareas de Windows; ejecutarlo solo en el equipo definitivo del sistema.

## Verificacion minima

Despues de cada backup:

1. Confirmar que el archivo `.sql` existe.
2. Confirmar que su tamaño es mayor a 0 KB.
3. Copiarlo a una ubicacion externa o nube segura.
4. Hacer una restauracion de prueba en una base separada antes de confiarlo a produccion.
