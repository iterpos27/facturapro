# Manual operativo FacturaPro

## 1. Inicio diario

1. Verificar que el backend y frontend esten ejecutandose.
2. Ingresar con el usuario asignado.
3. Revisar que la empresa, sucursal y caja correspondan al punto de venta.
4. Abrir caja desde `Caja Chica` indicando el efectivo inicial en billetes y monedas.
5. Confirmar que productos, clientes y secuenciales esten disponibles antes de facturar.

## 2. Clientes y proveedores

- Crear clientes desde `Clientes` con cedula/RUC, nombre, direccion, telefono y email.
- En proforma y factura se puede buscar cliente por cedula/RUC.
- Crear proveedores desde `Proveedores` antes de registrar compras o retenciones.
- Mantener email correcto si se enviaran documentos autorizados por correo.

## 3. Productos e inventario

- Crear productos con codigo, nombre, precio de compra, precio de venta, impuesto y stock minimo.
- Las compras incrementan stock y recalculan costo promedio.
- Las facturas descuentan stock.
- Las notas de credito devuelven stock.
- Consultar `Inventario` para revisar kardex valorizado, costo promedio y valor de inventario.

## 4. Compras y cuentas por pagar

1. Ir a `Compras`.
2. Seleccionar proveedor.
3. Registrar numero de factura de compra.
4. Agregar productos con cantidad y costo.
5. Definir contado o credito, plazo y pago inicial si aplica.
6. Guardar.

Las compras a credito quedan en `CxP y Pagos`, donde se registran abonos hasta saldar la deuda.

## 5. Proformas

1. Ir a `Proformas`.
2. Buscar cliente por cedula/RUC.
3. Agregar productos desde el buscador.
4. Ajustar cantidad, precio y descuentos.
5. Guardar proforma.
6. Aprobar si se convertira en venta.
7. Usar `Facturar` para cargar los datos en factura.

Para editar una proforma se solicita la clave del usuario. Una proforma facturada no debe modificarse.

## 6. Facturacion

1. Abrir caja antes de emitir facturas.
2. Ir a `Facturacion`.
3. Crear factura normal o cargar una proforma por numero.
4. Seleccionar cliente, productos, forma de pago, anticipo o credito.
5. Guardar factura.
6. Revisar RIDE o generar PDF desde el boton `PDF`.
7. Procesar SRI en ambiente de pruebas cuando corresponda.

Si la venta es a credito, queda registrada en `CxC y Cobros` para abonos y gestiones.

## 7. Cuentas por cobrar

- Revisar facturas pendientes, vencidas o abonadas.
- Registrar abonos con metodo de pago y referencia.
- Agregar gestiones de cobranza si el cliente no paga en el plazo pactado.
- El saldo se actualiza automaticamente.

## 8. Notas de credito

1. Seleccionar factura afectada.
2. Indicar motivo.
3. Seleccionar uno o mas productos a devolver.
4. Emitir nota de credito.
5. Procesar SRI si aplica.

La nota de credito resta en caja/reportes y devuelve inventario.

## 9. Retenciones

1. Registrar la compra.
2. Crear la retencion desde `Retenciones`.
3. Seleccionar la compra.
4. Agregar detalles de impuesto, codigo SRI, base imponible, porcentaje y valor retenido.
5. Emitir y procesar SRI si aplica.

## 10. Caja

- Abrir caja con efectivo inicial.
- Facturas contado, cobros CxC y ventas credito alimentan el cierre.
- Notas de credito se restan del resumen operativo.
- Al cerrar caja, registrar billetes y monedas contadas.
- Imprimir el comprobante de cierre para control interno.

## 11. Reportes

Usar `Reportes` para consultar por fecha, usuario, caja, cliente o proveedor:

- Ventas.
- Compras.
- Cuentas por cobrar.
- Caja.
- Stock minimo.
- Valor de inventario.
- Utilidad estimada.

Exportar a Excel cuando se requiera respaldo o analisis externo.

## 12. RIDE y PDF

Los documentos principales tienen RIDE visual y PDF generado desde backend:

- Proforma: `/api/rides/proforma/:id.pdf`
- Factura: `/api/rides/invoice/:id.pdf`
- Nota de credito: `/api/rides/credit-note/:id.pdf`
- Retencion: `/api/rides/withholding/:id.pdf`

Desde la interfaz usar el boton `PDF`.

## 13. SRI pruebas

- Configurar empresa con RUC real, razon social, direccion y ambiente `PRUEBAS`.
- Subir certificado `.p12` o `.pfx`.
- Configurar clave del certificado.
- Generar XML, firmar, enviar y autorizar desde los botones SRI.
- No pasar a produccion hasta validar factura, nota de credito y retencion con datos reales.

## 14. Backup

Ejecutar backup antes de cambios importantes, migraciones o pruebas SRI:

```powershell
cd C:\Cursos\facturapro\backend
npm run db:backup
```

Los archivos se guardan en `backend/backups` y no se suben a Git.

## 15. Buenas practicas

- No compartir claves ni certificados.
- No anular documentos sin motivo claro.
- Revisar stock bajo diariamente.
- Cerrar caja al finalizar turno.
- Realizar backup antes de migraciones y antes de pasar a produccion.
