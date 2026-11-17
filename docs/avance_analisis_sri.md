# Primera entrega del análisis SRI — 24/09/2026

Se revisaron análisis y expansión. Se prioriza el análisis tributario; la expansión queda como roadmap posterior.

Implementado: RUC opcional del proveedor en configuración, persistencia y validación de 13 dígitos, migración phase22, incorporación en nuevos XML de factura/nota de crédito/retención y comentarios explicativos. No se modifican comprobantes ya firmados ni se asigna un RUC ficticio.

Verificación: `npm run test:sri-provider` en backend (9 casos), `npm run db:migrate:sri-provider`, build y lint del frontend.

## Correcciones al análisis

- El [comunicado oficial del SRI](https://www.sri.gob.ec/detalle-noticias?idnoticia=1318&marquesina=1) fija 60 días hábiles desde la publicación para incluir el RUC; no corresponde asumir automáticamente septiembre.
- `RucProveedorSoftware` implementa el nombre propuesto por el documento; falta contrastarlo con la ficha técnica vigente antes de certificar cumplimiento.
- Consultar una autorización no es emitir: bloquear consultas de comprobantes anteriores impediría recuperar estados pendientes.
- Un servicio RIDE no demuestra que exista un módulo de guías de remisión.
- La integración de anulación requiere verificar los mecanismos oficiales; no debe inventarse un servicio web.

## Pendiente para siguientes entregas

Cola automática de reconsultas con política de reintentos; anulaciones; guías de remisión; notas de débito; liquidaciones; archivo tributario; retenciones automáticas y multiempresa. El tablero inicial todavía no incluye alertas de plazo de anulación ni gráficas por período. Estas entregas no implementan todos los módulos del análisis.

## Segunda entrega — control de transmisión y recuperación SRI

- Nuevo módulo **Documentos → Control SRI**, ruta `/sri`, protegido por `SRI_ELECTRONIC_BILLING`.
- Indicadores de autorizados, pendientes, por enviar y documentos por revisar; filtros de estado, tipo, ambiente y fecha de registro, con páginas de 25 documentos.
- `GET /api/sri/consult/:claveAcceso`: consulta de solo lectura con validación de 49 dígitos/módulo 11 y ambiente derivado de la clave.
- `POST /api/sri/monitor/:id/refresh`: sincroniza registro SRI y factura/nota de crédito/retención en una transacción, con auditoría y permiso `SRI_PROCESS`. No firma, transmite ni envía correos.
- Respuestas sin autorización permanecen pendientes; errores SOAP no se presentan como pendientes. Una autorización concurrente no retrocede.
- Control de fecha actual `America/Guayaquil` sobre el XML antes de transmitir, tanto en envío directo como en procesamiento completo. La autorización de documentos históricos sigue disponible.
- Los flujos de procesamiento consultan comprobantes recibidos y conservan autorizados, sin volver a transmitirlos.
- La recepción confirmada queda guardada antes de consultar autorización: una caída posterior del SRI deja el documento RECIBIDO para recuperarlo sin retransmisión.
- Se corrigió una fecha civil ISO que retrocedía un día al generar la clave/XML; el período fiscal de retenciones usa la misma regla.
- El panel muestra el aviso de fecha y las operaciones existentes muestran el error explicativo del servidor si la transmisión se bloquea.

Fuente de transmisión inmediata: [boletín oficial del SRI](https://www.sri.gob.ec/detalle-noticias?idnoticia=1240&marquesina=1). El control del mismo día implementa la restricción del análisis; por sí solo no automatiza la transmisión inmediata al crear una factura ni incorpora un régimen de contingencia.

Verificación: `npm run test:sri` (36 pruebas), build y lint frontend, consulta real de solo lectura contra PostgreSQL (13 comprobantes). Falta verificar visualmente el panel dentro de una sesión iniciada y realizar pruebas reales de autorización SRI con datos válidos. No se enviaron comprobantes ni correos durante las pruebas.

La autorización real requiere validación de ficha técnica y pruebas con certificado y datos válidos en ambiente SRI de pruebas.
