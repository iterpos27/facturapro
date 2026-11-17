# PDF y reportes: exactitud inicial

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar estados SRI reales en los RIDE y eliminar la duplicación de ventas en la utilidad mensual.

**Architecture:** Mantener los contratos actuales de `/api/rides` y `/api/reports/summary`. Corregir la proyección de autorización en `ride_service` y agregar costos por factura antes de agregarlos por mes en el reporte. Contrastar la respuesta con los documentos existentes, incluidos los de dos líneas.

**Tech Stack:** Node.js, Express, PostgreSQL, PDFKit, React.

**Spec:** `docs/CHECKLIST_ROADMAP.md`, secciones 3 y 4.

## Global Constraints

- Conservar los cambios locales SRI y no alterar estados ni comprobantes autorizados.
- Mantener el ambiente SRI de PRUEBAS; este plan no transmite comprobantes.
- Presentar la utilidad como estimada hasta validar descuentos, devoluciones y costo histórico.

## Review Focus

- Documento sin autorización: mostrar pendiente y fecha N/D, sin usar clave o fecha de emisión como autorización.
- Factura con dos líneas: la venta del mes cuenta una vez.
- Factura anulada: no se suma a ventas ni costo.
- Filtro por fecha: el total mensual debe concordar con el mismo conjunto de facturas.
- PDF y HTML del mismo documento: deben proyectar los mismos campos de autorización.

---

### Task 1: Estado pendiente en RIDE

**Files:** Modify `backend/services/ride_service.js`; test `backend/tests/ride_authorization.test.js`.

**Interfaces:** `loadRide(type, id)` entrega `ride.authorization` y `ride.authorizationDate` a `renderRideHtml` y `generateRidePdf`.

- [x] Escribir una prueba con documento sin autorización y comprobar que HTML indica pendiente y fecha N/D.
- [x] Ejecutar la prueba y confirmar el fallo por el uso actual de clave y fecha de emisión.
- [x] Corregir la proyección de factura, nota y retención sin alterar proformas.
- [x] Ejecutar la prueba y verificar un RIDE autorizado existente.

### Task 2: Utilidad mensual sin ventas duplicadas

**Files:** Modify `backend/routes/reports.js`; verify against PostgreSQL local.

**Interfaces:** `/api/reports/summary` mantiene `profitByPeriod[{periodo, ventas, costo, utilidad}]`.

- [x] Registrar el valor actual de julio y el total independiente de `facturas` para confirmar el fallo.
- [x] Agregar el costo a una fila por factura antes de agrupar por mes, sin multiplicar `f.total` por líneas.
- [x] Comparar `ventas` por período con `SUM(f.total)` de facturas emitidas y comprobar filtros de fecha.
- [x] Ejecutar las pruebas del backend y documentar los límites restantes de la fórmula.

### Task 3: Verificación visible y checklist

**Files:** Modify `docs/CHECKLIST_ROADMAP.md`; inspect PDF/HTML y dashboard.

- [x] Comprobar RIDE pendiente y autorizado en PDF y HTML.
- [x] Comprobar utilidad mensual en API y dashboard, con los totales de julio y octubre.
- [x] Actualizar el checklist con evidencia y tareas abiertas de exportación y costo histórico.

### Task 4: Paginación de RIDE con detalles extensos

**Files:** Modify `backend/services/ride_service.js`; verify synthetic PDF with Poppler.

- [x] Reproducir superposición con 21 líneas de descripción larga.
- [x] Calcular la altura de cada fila, repetir encabezado al cambiar de página y reservar el bloque final de totales e información adicional.
- [x] Renderizar el PDF resultante y comprobar que ninguna fila, total o pie se superpone.
