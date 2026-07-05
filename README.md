# FacturaPro

Sistema comercial integrado para facturacion, inventario, caja, documentos electronicos SRI y gestion de cobranza.

## Estado actual

FacturaPro esta organizado como una aplicacion full stack:

- `backend/`: API REST en Express, PostgreSQL, autenticacion JWT, permisos, auditoria, migraciones y servicios SRI.
- `frontend/`: interfaz React + Vite + CoreUI separada por modulos.
- `coreui-free-react-admin-template-main/`: referencia local del template base, excluida del flujo principal.

## Modulos principales

- Dashboard con metricas comerciales.
- Clientes y proveedores.
- Productos, categorias, inventario y movimientos.
- Compras e ingreso de productos por factura de compra.
- Proformas con registro persistente, edicion con clave y facturacion desde proforma.
- Facturacion contado/credito con pagos, anticipos, cambio, descuentos y RIDE interno.
- Cuentas por cobrar con abonos, vencimientos, estados de cobranza y gestiones.
- Caja chica con apertura, cierre, denominaciones, ventas credito/contado, cobros CxC y notas de credito.
- Notas de credito y retenciones con RIDE interno.
- Secuenciales por documento, sucursal y punto de emision.
- Reportes con filtros y exportacion.
- Auditoria basica de acciones sensibles.
- Configuracion de empresa, logo, certificado, endpoints y parametros SRI.
- SRI en ambiente de pruebas para factura, nota de credito y retenciones.

## Requisitos

- Node.js 20 o superior.
- PostgreSQL.
- Certificado `.p12` o `.pfx` para pruebas SRI reales.

## Configuracion local

1. Crear `backend/.env` desde `backend/.env.example`.
2. Crear `frontend/.env` desde `frontend/.env.example`.
3. Instalar dependencias:

```bash
cd backend
npm install

cd ../frontend
npm install
```

4. Ejecutar migraciones:

```bash
cd backend
npm run db:migrate:all
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
- `npm run db:migrate:all`
- `npm run db:migrate:sri-test`
- `npm run db:migrate:sri-complementary`
- `npm run db:migrate:sequentials-permissions`
- `npm run db:migrate:credit-collections`
- `npm run db:drop`

Frontend:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

## Seguridad

- Autenticacion JWT.
- Permisos por modulo y rutas protegidas.
- `helmet` para cabeceras HTTP defensivas.
- `express-rate-limit` para limitar abuso de API.
- Validacion de payloads con Joi en rutas sensibles.
- `JWT_SECRET` seguro obligatorio en produccion.

## SRI

El sistema trabaja con ambiente `PRUEBAS` y permite:

- Generar XML.
- Firmar con certificado local.
- Enviar a recepcion SRI.
- Consultar autorizacion.
- Guardar estado, mensajes, clave de acceso, numero y fecha de autorizacion.

Documentos cubiertos:

- Factura electronica.
- Nota de credito.
- Comprobante de retencion.

## Pendientes recomendados

- Completar validacion manual SRI con datos reales para todos los documentos.
- Historial de envio de correos con XML y RIDE.
- Cuentas por pagar para compras a credito.
- Kardex valorizado y costo promedio.
- Backup automatico de PostgreSQL y prueba de restauracion.
- Manual operativo para usuario final.
