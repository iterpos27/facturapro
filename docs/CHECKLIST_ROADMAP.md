# FacturaPro — lista de verificación del roadmap

Actualizado: 23 de octubre de 2026.

Esta lista distingue **implementado en el código** de **validado en operación**. Una casilla marcada no certifica por sí sola el funcionamiento en producción. Para cerrar una casilla abierta, anotar fecha, responsable y evidencia (prueba, captura o comprobante) junto al ítem.

## 1. Base comercial existente

- [x] Autenticación, usuarios, roles y permisos implementados.
- [x] Empresa, sucursales, cajas y secuenciales configurables.
- [x] Clientes, proveedores, productos y categorías administrables.
- [x] Compras, cuentas por pagar, inventario, kardex y costo promedio implementados.
- [x] Proformas, facturas, notas de crédito y retenciones registrables.
- [x] Cuentas por cobrar, abonos y gestiones de cobranza implementados.
- [x] Apertura, movimientos y cierre de caja implementados.
- [x] Auditoría básica e historial de correo de comprobantes implementados.
- [ ] Ejecutar un recorrido operativo completo con datos de prueba: compra → stock → proforma → factura → cobro/caja → nota de crédito → cierre. **Cierre:** registrar resultados y corregir fallos encontrados.
- [ ] Verificar permisos de cada rol con usuarios distintos. **Cierre:** comprobar acceso permitido y denegado en interfaz y API.

## 2. SRI — trabajo en curso

Los cambios recientes de esta sección están en el árbol de trabajo local y aún no se han confirmado en Git.

- [x] Generación de XML para factura, nota de crédito y retención.
- [x] Firma, recepción y consulta de autorización implementadas en el código.
- [x] RUC del proveedor de software configurable e incorporado a XML nuevos.
- [x] Validación de fecha de transmisión según el día civil de Ecuador.
- [x] Panel Control SRI con indicadores, filtros, consulta por clave y reconsulta individual implementado.
- [x] Pruebas SRI y RIDE locales: 38 aprobadas el 23/10/2026, incluida una prueba de firma por tipo de XML y otra de autorización pendiente en RIDE. Compilación y lint del frontend aprobados tras las correcciones de reportes.
- [x] Abrir Control SRI con una sesión de administrador y comprobar carga, indicadores y filtros de estado, tipo, ambiente y fecha. **Evidencia 23/10/2026:** 13 registros; filtro AUTORIZADO = 5; AUTORIZADO + nota de crédito = 1; fecha posterior = 0.
- [ ] Comprobar paginación con más de 25 registros y permisos con otro rol; revisar acciones de reconsulta en documentos aptos. **Cierre:** capturas y respuestas esperadas en interfaz y API.
- [ ] Validar factura, nota de crédito y retención con certificado y datos válidos en el ambiente de pruebas del SRI. **Cierre:** guardar XML firmado, respuesta de recepción, autorización y RIDE de cada tipo. **Bloqueo detectado 23/10/2026:** los cinco registros locales AUTORIZADO no coinciden con la consulta oficial de solo lectura (tres facturas SIN_AUTORIZACION; nota de crédito NO AUTORIZADO, código 39 FIRMA INVALIDA; retención NO AUTORIZADO, código 52 ERROR EN DIFERENCIAS). El SRI conserva una nota de crédito sin firma aunque la copia local sí está firmada; conserva una retención con 1,75 % aunque la copia local indica 2,00 %. Investigar cuándo y por qué cambiaron los XML locales antes de confiar en los estados.
- [x] Crear comprobantes recientes para la prueba SRI. **Evidencia 23/10/2026:** facturas 001-001-000000011 (ID 10) y 001-001-000000012 (ID 11), nota de crédito 001-001-000000003 (ID 9) y retención 001-001-000000003 (ID 4), con compra de soporte ID 3. Los cuatro XML tienen fecha 23/10/2026, tipo y clave coherentes; la retención usa base 50,00, código 312, tasa 2,00 % y valor 1,00. Se cerró la caja de prueba ID 7 con diferencia 0,00.
- [x] Firmar y enviar los cuatro comprobantes recientes al SRI de PRUEBAS. **Evidencia 23/10/2026:** certificado vigente y preparación SRI completa; facturas 001-001-000000011 y 001-001-000000012, nota de crédito 001-001-000000003 y retención 001-001-000000003 quedaron AUTORIZADO. Consulta independiente por las cuatro claves confirmó estado, número y fecha iguales a los registros locales. Los cuatro XML guardados contienen una firma y certificado X509; los cuatro RIDE responden PDF. La primera factura tiene advertencia 62 por la cédula ficticia del cliente. La nota y retención recibieron primero código 39 porque se usaba el firmador de facturas; se corrigió, probaron las tres firmas y se reenviaron con la misma clave hasta obtener autorización.
- [ ] Contrastar XML y campos nuevos con la ficha técnica SRI vigente. **Cierre:** matriz de campos obligatorios y casos aceptados/rechazados.
- [ ] Probar recuperación tras caídas o respuestas pendientes del SRI. **Cierre:** comprobar que no se retransmiten documentos recibidos o autorizados.
- [ ] Implementar reconsultas automáticas con cola, reintentos persistentes y alertas de error. **Cierre:** pruebas de recuperación y trazabilidad por intento.
- [ ] Implementar anulaciones electrónicas según el mecanismo oficial aplicable. **Cierre:** flujo probado y estados sincronizados.
- [ ] Implementar guía de remisión, nota de débito y liquidación de compra si forman parte del alcance comercial. **Cierre:** registro, XML, firma, autorización y RIDE por tipo.
- [ ] Implementar archivo electrónico tributario y política de conservación/descarga. **Cierre:** localizar y recuperar XML y RIDE históricos.
- [ ] Definir y validar el paso a producción SRI. **Cierre:** aprobación basada en pruebas reales y requisitos fiscales revisados.
- [ ] Cambiar la clave inicial de la cuenta `admin` antes de exponer la aplicación fuera del entorno de pruebas. **Cierre:** el usuario actualiza la clave y comprueba que la anterior ya no permite ingresar.

## 3. PDF y RIDE

- [x] PDF desde backend para proforma, factura, nota de crédito y retención.
- [x] Datos de emisor/receptor, detalle de líneas, totales e información adicional básica.
- [x] Clave de acceso, ambiente y número de autorización disponibles en documentos electrónicos.
- [x] Corregir la presentación de autorización pendiente. **Evidencia 23/10/2026:** factura y retención pendientes muestran `PENDIENTE SRI` y fecha `N/D`; la nota de crédito histórica ID 7 también conserva `N/D` aunque tenía una fecha SRI residual. La clave de acceso se presenta aparte. Factura autorizada ID 10 conserva su número y fecha reales. Se compararon HTML y PDF; prueba automatizada aprobada.
- [x] Validar paginación y ubicación de totales en documentos con muchas líneas. **Evidencia 23/10/2026:** se reprodujo la superposición inicial con 21 líneas largas; tras la corrección se renderizaron y revisaron un PDF de 2 páginas con 21 líneas y otro de 3 páginas con 60 líneas y observación larga. Encabezados repetidos, filas, totales y pie sin superposición.
- [ ] Revisar desglose de impuestos, descuentos y formas de pago frente a los requisitos del negocio y formato RIDE aplicable. **Cierre:** casos de IVA 0 %, gravado, descuentos y pagos mixtos revisados.
- [ ] Comparar PDF backend con la vista RIDE de la interfaz. **Cierre:** mismos datos y estados en ambos formatos.
- [ ] Revisar visualmente los cuatro PDF con datos reales de prueba. **Cierre:** ejemplos archivados y aprobados.
- [x] Comprobar respuesta PDF de los cuatro comprobantes recientes. **Evidencia 23/10/2026:** los cuatro endpoints RIDE devolvieron HTTP 200, `application/pdf` y encabezado `%PDF-`; posteriormente se revisó la primera página con las autorizaciones reales.
- [x] Revisar visualmente la primera página de los cuatro RIDE autorizados. **Evidencia 23/10/2026:** número, clave, fecha de autorización, ambiente y totales visibles; se corrigió en la nota de crédito el total de línea para incluir IVA (72,45 en vez de 63,00). Permanecen pendientes las pruebas de paginación y la revisión formal de desglose/impuestos.

## 4. Reportería

- [x] Panel con indicadores de ventas, compras, caja, inventario y saldos.
- [x] Tablas de ventas diarias, productos vendidos, CxC, stock bajo, pagos, márgenes, utilidad por período y antigüedad de CxC/CxP.
- [x] Exportación del resumen y tablas disponibles a Excel.
- [x] Corregir utilidad por período: la unión con líneas de factura repetía el total de venta. **Evidencia 23/10/2026:** julio bajó de 5844,1160 duplicados a 3044,4410, igual a `SUM(facturas.total)` independiente; octubre = 152,9500. Se comprobó también con filtros de fecha en API y en el panel.
- [ ] Revisar fórmulas de margen/utilidad, descuentos, impuestos y costo histórico. **Cierre:** resultados conciliados con casos conocidos.
- [ ] Aplicar filtros de forma consistente a todas las secciones o indicar explícitamente qué secciones son globales. **Avance 23/10/2026:** el panel ahora indica que cliente y caja filtran ventas/notas, proveedor filtra compras/retenciones, y proformas, inventario y antigüedad muestran cifras globales. Falta comprobar de forma exhaustiva cada combinación de fecha, usuario, caja, cliente y proveedor.
- [ ] Habilitar detalle completo o paginado para exportar; hoy algunas tablas se limitan a 10 o 20 registros. **Cierre:** exportación conciliada con el total de registros del período.
- [ ] Crear reportes transaccionales detallados de ventas, compras, cobros, pagos e inventario. **Cierre:** búsqueda y exportación por documento/movimiento.
- [ ] Definir si se requiere PDF formal de reportes y, de ser así, implementarlo. **Cierre:** reporte imprimible con período, filtros, totales y fecha de generación.
- [ ] Validar reportes con una base de prueba representativa. **Cierre:** totales conciliados con operaciones fuente.

## 5. Expansión futura — priorizar según usuarios reales

- [ ] Punto de venta táctil y soporte para impresora térmica.
- [ ] Alertas operativas: stock, vencimientos, SRI y certificado.
- [ ] Tesorería y conciliación bancaria.
- [ ] Contabilidad: plan de cuentas, asientos y estados financieros.
- [ ] CRM y seguimiento comercial.
- [ ] Nómina y recursos humanos.
- [ ] Producción y activos fijos.
- [ ] Portal del cliente, aplicación móvil e integraciones externas.
- [ ] Multiempresa/multi-RUC.

## Orden sugerido para ir tachando

1. Cerrar validación visual y real del flujo SRI.
2. Corregir y conciliar la reportería financiera.
3. Validar y pulir los PDF de los cuatro documentos.
4. Automatizar recuperación SRI y completar los documentos electrónicos necesarios.
5. Priorizar expansión con base en los usuarios y negocios objetivo.
