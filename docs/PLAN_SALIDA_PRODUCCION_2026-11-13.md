# FacturaPro: salida a producción y guía de remisión

Actualizado: 13 de noviembre de 2026. Este documento distingue cambios de código de validaciones operativas. No certifica cumplimiento tributario ni autoriza cambiar el ambiente SRI.

## Cambios iniciados

- [x] Claves nuevas de factura, nota de crédito y retención usan el ambiente de la empresa.
- [x] El XML comprueba ambiente, tipo, RUC, fecha, serie, secuencial y dígito verificador antes de conservar una clave existente.
- [x] Regenerar XML de una factura RECIBIDO, EN_PROCESO o AUTORIZADO conserva el registro original.
- [x] La anulación interna se bloquea si el documento figura como RECIBIDO, EN_PROCESO o AUTORIZADO ante el SRI.
- [x] Las respuestas de empresa y detalles comerciales dejan de enviar la contraseña del certificado al navegador; una edición sin contraseña conserva la guardada.
- [x] La ruta genérica de edición de empresa conserva el ambiente actual; el cambio de ambiente queda en la ruta con permiso y confirmación específicos.
- [x] El cambio a PRODUCCION y el uso de endpoints SRI de producción están bloqueados en código mientras se completa la validación en PRUEBAS.
- [x] El chequeo preproducción exige una sola empresa configurada en PRUEBAS y credenciales de firma presentes; no confunde datos de ejemplo con autorización para operar.

## Hallazgo del ambiente actual

La base consultada el 13 de noviembre tenía **dos** empresas configuradas. A pedido del usuario se conservaron la empresa de demostración y su sucursal en `archivo_empresa_demo_20261113` y `archivo_sucursal_demo_20261113` dentro de la base de pruebas; se retiraron solo las filas operativas que no tenían cajas, facturas ni secuenciales asociados. IPS Tech queda como única empresa operativa. El cambio es reversible restaurando primero la fila de empresa y luego la de sucursal desde esas tablas. El chequeo local pasa y el certificado configurado está vigente hasta el 25 de noviembre de 2027. Hay registros históricos AUTORIZADO en PRUEBAS para los tres tipos, pero eso no demuestra que el flujo actual de emisión y envío automático funcione. No se cambió el ambiente ni se enviaron comprobantes al SRI durante esta revisión.

La consulta de solo lectura `node scripts/check_sri_test_authorization.js` al SRI PRUEBAS confirmó un comprobante histórico de cada tipo (01, 04 y 07): los tres siguen AUTORIZADO, el número oficial coincide con el registro local y el XML guardado incluye firma. Esto valida consulta y conciliación de esas muestras; falta probar una emisión nueva completa, transmisión inmediata, respuestas pendientes y errores, RIDE y entrega por correo.

## Bloqueos antes de emitir en producción

1. [ ] **Emisión y transmisión inmediata.** Al registrar factura, nota de crédito o retención, generar y firmar el XML y transmitirlo sin requerir un segundo clic. Registrar duraderamente el intento antes de comunicarse con el SRI y no repetir un envío cuya recepción es incierta; consultar por clave en ese caso. Pruebas: caída antes de enviar, timeout tras recepción, autorización pendiente, rechazo, doble solicitud y reinicio del servidor.
2. [ ] **Anulación tributaria.** Modelar solicitud, plazo, aceptación o rechazo, resolución y sincronización con SRI. Una anulación local no debe cambiar inventario, cuentas o caja como si el SRI la hubiera aceptado. Probar facturas, notas de crédito, retenciones y casos de consumidor final conforme a las resoluciones vigentes.
3. [ ] **Conciliación de estados.** Investigar los registros históricos donde la base local y la consulta oficial difieren. Añadir reconsulta automática persistente y alertas. El estado mostrado al usuario debe indicar si procede de SRI o es solo local.
4. [ ] **Validación tributaria.** Contrastar XML y RIDE de cada tipo con la ficha técnica vigente y los XSD oficiales. Probar tarifas, descuentos, formas de pago, identificaciones, redondeo, retenciones y datos RIMPE cuando correspondan.
5. [ ] **Entrega y archivo.** Confirmar correo real con XML autorizado y RIDE, registrar errores y reintentos, ofrecer descarga histórica y respaldar los documentos junto con la base de datos.
6. [ ] **Operación.** Confirmar certificado y permisos de emisión en el SRI, HTTPS, secretos, roles, contraseñas iniciales, copia externa y restauración de prueba. Ejecutar un recorrido de venta, cobro, devolución, cierre y reportes con usuarios distintos.

## Validación real en SRI PRUEBAS — 16 de noviembre de 2026

- [x] La emisión nueva de factura 001-001-000000013, nota de crédito 001-001-000000004 y retención 001-001-000000004 creó la cola SRI dentro de la transacción comercial. El trabajador firmó, transmitió y obtuvo AUTORIZADO en PRUEBAS para los tres tipos sin un segundo clic.
- [x] Una consulta posterior al servicio oficial confirmó que los tres números de autorización coinciden con la base local y que los XML guardados tienen firma.
- [x] Los RIDE PDF de los tres documentos se generaron y comenzaron con la cabecera PDF. El ensamblado de correo incluye XML y PDF; se probó el transporte con un SMTP simulado, sin enviar a terceros.
- [x] La anulación local de la factura autorizada respondió 400 y no cambió su estado. La caja de prueba se cerró sin diferencia.
- [ ] Falta SMTP real en el servidor (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`): los intentos durante la prueba quedaron en historial como ERROR. La entrega real por correo no está validada. El envío desde procesos automáticos queda deshabilitado; solo se permite la acción manual de envío.
- [ ] Falta una prueba controlada de timeout/reinicio entre recepción y autorización. Hay pruebas automatizadas de estado incierto y reconsulta sin reenvío, pero no una ejecución real de falla de red.
- [ ] Falta realizar y verificar una anulación en el portal SRI PRUEBAS. El usuario indicó que no tiene acceso ahora. Conforme a la normativa consultada, este trámite se realiza en el portal; no debe marcarse ANULADO en la base por una solicitud local.

La [Resolución NAC-DGERCGC25-00000014](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=137046a6-787c-47fb-a2d7-176595d292dc&nombre=NAC-DGERCGC25-00000014.pdf), reformada por la [Resolución NAC-DGERCGC25-00000017](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar?id=e98fc8a6-299e-4ea9-8de7-2f6c70dbb4f5&nombre=NAC-DGERCGC25-00000017.pdf), regula el proceso y cambió el plazo ordinario de anulación en línea al día 7 del mes siguiente. El [manual SRI de anulación](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/95a67dfb-b0ec-47d1-88b5-aff7bae087e2/MANUAL%2BANULACION%2BDE%2BCOMPROBANTES%2BELECTRONICOS.pdf) muestra el ambiente de PRUEBAS. Las notas de crédito y retenciones pueden requerir aceptación del receptor; la base local no sustituye ese resultado.

La revisión automática rechazó activar correos automáticos tras recuperar una autorización por el riesgo de enviar XML y RIDE a destinatarios reales. El código actual limita el correo a una acción iniciada por un usuario, y el ensayo de SMTP usó un transporte simulado. Para el envío real se necesitan configuración SMTP y autorización específica para esa prueba.

El cambio de ambiente y los endpoints de PRODUCCION siguen bloqueados en código. Esta validación no autoriza desplegar a producción.

## Guía de remisión electrónica (código 06)

La documentación del SRI ofrece ficha técnica vigente y XSD/XML de guía en versiones 1.0.0 y 1.1.0: https://www.sri.gob.ec/web/intersri/facturacion-electronica

1. [ ] Definir el flujo de negocio: emisor, transportista, vehículo, origen, destino, período de traslado, destinatarios, bienes y comprobantes de sustento.
2. [ ] Crear tablas, permiso, secuencial por sucursal y API para borrador y emisión. La emisión debe ser inmutable y registrar auditoría.
3. [ ] Generar XML código 06 validado contra XSD oficial, clave de acceso, firma, recepción y autorización. Compartir el mecanismo de consulta y recuperación del resto de documentos.
4. [ ] Crear interfaz para registrar, consultar y reconsultar guías, RIDE PDF, envío al destinatario y descarga de XML autorizado.
5. [ ] Probar con certificado y datos válidos en SRI PRUEBAS; conservar XML firmado, respuesta de recepción, autorización y RIDE como evidencia. Solo después habilitar producción.

## Orden de entrega

Cerrar primero los seis bloqueos de producción para los tres documentos existentes. Desarrollar la guía en paralelo únicamente hasta borrador y validación local; su emisión real depende del mismo flujo confiable de transmisión, recuperación y archivo.
