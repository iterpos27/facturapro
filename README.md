# FacturaPro

Sistema comercial para ventas, compras, inventario, caja, cobranza y comprobantes electrónicos del SRI de Ecuador. Incluye una API en **Express + PostgreSQL** y una interfaz en **React + Vite + CoreUI**.

> Estado al 17 de noviembre de 2026: el flujo electrónico funciona en el ambiente **PRUEBAS** para facturas, notas de crédito y retenciones. El paso a **PRODUCCIÓN** permanece bloqueado mientras se completan las validaciones operativas y tributarias indicadas abajo.

## Qué está implementado

- Usuarios, autenticación JWT, roles, permisos y auditoría básica.
- Empresa, sucursales, cajas, bancos y secuenciales por documento y punto de emisión.
- Clientes, proveedores, productos, categorías, compras, cuentas por pagar, inventario, kardex y costo promedio.
- Proformas, facturas, notas de crédito, retenciones, cuentas por cobrar, abonos y gestiones de cobranza.
- Apertura, movimientos y cierre de caja; reportes comerciales y exportación a Excel.
- PDF desde el backend para proformas y RIDE de facturas, notas de crédito y retenciones.
- Generación y firma de XML, recepción y consulta de autorización SRI para los tres tipos de comprobante. La emisión crea una cola dentro de la transacción comercial; un trabajador despacha los pendientes de PRUEBAS y reconsulta estados inciertos sin retransmitirlos.
- Panel **Control SRI** con indicadores, filtros, consulta por clave y reconsulta individual. Historial de intentos de correo y envío manual de comprobantes autorizados con XML y RIDE PDF.
- Scripts de migración, respaldo, restauración y chequeo previo a producción.

## Qué se ha verificado

- En SRI **PRUEBAS** se emitieron y autorizaron comprobantes nuevos de los tipos 01 (factura), 04 (nota de crédito) y 07 (retención). Una consulta posterior al servicio oficial confirmó sus números de autorización y los XML guardados contienen firma. Se generaron sus RIDE PDF.
- La anulación local de una factura autorizada fue rechazada sin alterar su estado. El transporte de correo se probó con SMTP simulado; **la entrega a destinatarios reales sigue pendiente**.
- La suite local del backend pasó **62 pruebas**; también pasaron el lint y la compilación del frontend el 17 de noviembre de 2026. Estas comprobaciones no sustituyen una prueba operativa completa ni certifican cumplimiento tributario.

## Qué falta

### Antes de producción

1. Configurar SMTP y verificar, con autorización expresa, la entrega real de XML autorizado y RIDE PDF. Definir reintentos y seguimiento de fallos de correo.
2. Probar una caída, un timeout y un reinicio reales entre recepción y autorización SRI; comprobar la recuperación y que no haya envíos duplicados. Completar alertas y trazabilidad de reintentos.
3. Investigar y conciliar registros históricos cuyo estado local difiere de la consulta oficial del SRI. Las autorizaciones de comprobantes nuevos no resuelven esas diferencias anteriores.
4. Validar XML, impuestos, descuentos, identificaciones, redondeos y RIDE frente a la ficha técnica y los XSD vigentes del SRI, con casos aceptados y rechazados.
5. Verificar el trámite de anulación en el portal SRI PRUEBAS y definir cómo reflejar su resultado. Una anulación interna no equivale a una anulación tributaria.
6. Completar el recorrido operativo con distintos roles: compra → inventario → venta → cobro/caja → devolución → reportes. Revisar permisos, cambiar contraseñas iniciales, configurar HTTPS y secretos, y comprobar respaldo externo y restauración.

### Mejoras posteriores

- Completar archivo y descarga histórica de XML/RIDE, y respaldar esos documentos junto con la base de datos.
- Conciliar fórmulas y filtros de reportes; permitir exportaciones completas y agregar reportes transaccionales detallados.
- Verificar paginación, permisos de otros roles y acciones del panel Control SRI con más de 25 comprobantes.
- Priorizar guía de remisión electrónica, nota de débito y liquidación de compra según las necesidades del negocio. La guía de remisión todavía no está implementada.

El detalle y la evidencia de cada pendiente están en [la lista de verificación](docs/CHECKLIST_ROADMAP.md) y [el plan de salida a producción](docs/PLAN_SALIDA_PRODUCCION_2026-11-13.md). El [manual operativo](docs/MANUAL_OPERATIVO.md) describe el uso de los módulos existentes.

## Requisitos y configuración local

- Node.js y npm; PostgreSQL.
- Para pruebas reales con SRI, un certificado de firma `.p12` o `.pfx` válido y una empresa configurada en PRUEBAS.

1. Crear `backend/.env` desde [`backend/.env.example`](backend/.env.example) y `frontend/.env` desde [`frontend/.env.example`](frontend/.env.example). Configurar la base de datos y reemplazar `JWT_SECRET` por un valor seguro. Los archivos `.env` y certificados están excluidos de Git.
2. Instalar dependencias y ejecutar las migraciones:

```bash
cd backend
npm install
npm run db:migrate:all

cd ../frontend
npm install
```

3. Iniciar cada servicio en una terminal diferente:

```bash
cd backend
npm start
```

```bash
cd frontend
npm run dev
```

## Comprobaciones útiles

```bash
# Desde backend/
node --test tests/*.test.js
npm run preprod:check
npm run db:backup
npm run db:restore-check

# Desde frontend/
npm run lint
npm run build
```

`preprod:check` evalúa la configuración local; un resultado favorable no habilita por sí solo el ambiente de PRODUCCIÓN.
