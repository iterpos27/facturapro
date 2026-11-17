# Continuación del análisis SRI

Objetivo: completar una entrega verificable de control de transmisión y recuperación de estados, sobre el flujo existente.

Diseño: reglas de fecha/clave/estado en utilidad independiente; consulta y sincronización en servicio reutilizable; rutas de monitor protegidas por el permiso SRI; panel React integrado en Documentos. No generar ni reenviar XML desde una consulta. No mandar correos al consultar.

- [x] Pruebas de fecha Ecuador, fechas inexistentes, clave y respuestas pendientes.
- [x] Validar fecha del XML antes de enviar; conservar la consulta de históricos.
- [x] Evitar reenvío de comprobantes recibidos/autorizados y clasificación incorrecta de pendientes.
- [x] Consulta por clave, sincronización transaccional de los tres tipos de documentos y auditoría.
- [x] Panel con filtros, indicadores y reconsulta individual.
- [x] Verificar pruebas, compilación, lint y consulta del panel contra PostgreSQL local.
- [x] Verificación visual inicial dentro de una sesión de administrador: carga del panel, indicadores y filtros de estado, tipo, ambiente y fecha (23/10/2026).
- [ ] Verificar paginación con más de 25 documentos, permisos de otros roles y acciones de reconsulta.
- [ ] Resolver discrepancia entre registros locales AUTORIZADO y SRI de pruebas: consulta oficial de solo lectura del 23/10/2026 devolvió SIN_AUTORIZACION para tres facturas, NO AUTORIZADO / 39 FIRMA INVALIDA para una nota de crédito y NO AUTORIZADO / 52 ERROR EN DIFERENCIAS para una retención. El XML de la nota de crédito que devuelve el SRI no contiene firma; el XML local sí. La retención en el SRI tiene porcentaje 1,75 % y la copia local 2,00 %. Los XML y estados no se modificaron durante la revisión.
- [x] Recorrido nuevo de PRUEBAS el 23/10/2026: dos facturas, una nota de crédito y una retención quedaron AUTORIZADO en el SRI y fueron confirmadas por consulta independiente de sus claves. Se corrigió el firmador por tipo para la nota y la retención; la primera factura conserva advertencia 62 por cédula ficticia. Este resultado valida el flujo nuevo, pero no resuelve la discrepancia de los registros históricos descrita arriba.

Alcance posterior del documento original: cola automática con reintentos persistentes; anulaciones según mecanismos oficiales; guías y notas de débito; liquidaciones, archivo tributario, retenciones automáticas y multiempresa. No afirmar cumplimiento fiscal completo con pruebas locales.
