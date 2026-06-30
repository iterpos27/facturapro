# FacturaPro

Sistema de facturacion e inventario con backend en Express, PostgreSQL y frontend en React + Vite + CoreUI.

## Estructura

- `backend/`: API REST, autenticacion y scripts de base de datos.
- `frontend/`: interfaz administrativa.
- `coreui-free-react-admin-template-main/`: copia local del template original. Se ignora para no subir ruido a GitHub.

## Requisitos

- Node.js 20 o superior
- PostgreSQL

## Configuracion

1. Crear `backend/.env` desde `backend/.env.example`.
2. Crear `frontend/.env` desde `frontend/.env.example`.
3. Instalar dependencias:

```bash
cd backend && npm install
cd ../frontend && npm install
```

## Ejecucion local

Backend:

```bash
cd backend
npm start
```

Frontend:

```bash
cd frontend
npm run dev
```

## Scripts utiles

Backend:

- `npm start`
- `npm run db:init`
- `npm run db:migrate`
- `npm run db:migrate:rename`
- `npm run db:migrate:phase1`
- `npm run db:migrate:phase2-3`
- `npm run db:migrate:phase4`
- `npm run db:drop`
- `npm run db:productos`

Frontend:

- `npm run dev`
- `npm run build`
- `npm run lint`

## Preparacion para GitHub

- La URL del backend en el frontend sale de `VITE_API_URL`.
- El backend expone `GET /health` para pruebas rapidas.
- `.env`, `scratch/` y la copia del template quedan ignorados.

## Siguientes mejoras recomendadas

- Proteger las rutas sensibles del backend con `authenticateToken`.
- Separar el frontend por modulos o rutas; hoy gran parte del flujo vive en `frontend/src/App.jsx`.
- Agregar pruebas y validaciones de integridad para facturacion e inventario antes de publicar versiones.
