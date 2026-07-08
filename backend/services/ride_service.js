const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../db');

const money = (value) => `$${(Number(value || 0) || 0).toFixed(2)}`;
const qty = (value) => (Number(value || 0) || 0).toFixed(2);
const text = (value, fallback = '') => String(value ?? fallback ?? '').trim();

function resolveLogoPath(company) {
  const logo = text(company?.logo_url);
  if (!logo || logo.startsWith('http')) return null;
  const relative = logo.replace(/^\/+/, '');
  const filePath = path.resolve(__dirname, '..', relative);
  return fs.existsSync(filePath) ? filePath : null;
}

function formatDate(value) {
  if (!value) return 'N/D';
  return new Date(value).toLocaleString('es-EC');
}

function normalizeType(value) {
  const type = String(value || '').toLowerCase();
  if (['invoice', 'invoices', 'factura', 'facturas', '01'].includes(type)) return 'invoice';
  if (['proforma', 'proformas'].includes(type)) return 'proforma';
  if (['credit-note', 'credit-notes', 'nota-credito', 'notas-credito', '04'].includes(type)) return 'credit-note';
  if (['withholding', 'withholdings', 'retencion', 'retenciones', '07'].includes(type)) return 'withholding';
  throw new Error('Tipo de RIDE no soportado.');
}

async function loadCompany() {
  const companyRes = await db.query('SELECT * FROM empresas LIMIT 1');
  return companyRes.rows[0] || {};
}

async function loadInvoice(id) {
  const docRes = await db.query(`
    SELECT f.*, c.name AS cliente_nombre, c.identification_number AS cliente_identificacion,
           c.email AS cliente_email, c.phone AS cliente_telefono, c.address AS cliente_direccion,
           s.nombre AS sucursal_nombre, s.direccion AS sucursal_direccion,
           mp.nombre AS metodo_pago_nombre, u.username
    FROM facturas f
    JOIN clients c ON f.id_cliente = c.id
    JOIN sucursales s ON f.id_sucursal = s.id_sucursal
    LEFT JOIN metodos_pago mp ON f.id_metodo_pago = mp.id_metodo
    LEFT JOIN usuarios u ON f.id_usuario = u.id_usuario
    WHERE f.id_factura = $1
  `, [id]);
  if (docRes.rows.length === 0) throw new Error('Factura no encontrada.');

  const detailsRes = await db.query(`
    SELECT fd.*, p.codigo AS producto_codigo, p.nombre AS producto_nombre
    FROM factura_detalles fd
    JOIN productos p ON fd.id_producto = p.id_producto
    WHERE fd.id_factura = $1
    ORDER BY fd.id_detalle ASC
  `, [id]);
  const paymentsRes = await db.query(`
    SELECT fp.*, mp.nombre AS metodo_pago_nombre
    FROM factura_pagos fp
    LEFT JOIN metodos_pago mp ON fp.id_metodo_pago = mp.id_metodo
    WHERE fp.id_factura = $1
    ORDER BY fp.id_pago ASC
  `, [id]).catch((error) => (error.code === '42P01' ? { rows: [] } : Promise.reject(error)));

  const doc = docRes.rows[0];
  return {
    type: 'invoice',
    title: 'FACTURA',
    number: doc.numero_factura,
    subjectLabel: 'Cliente',
    subjectName: doc.cliente_nombre,
    subjectId: doc.cliente_identificacion,
    subjectAddress: doc.cliente_direccion,
    subjectEmail: doc.cliente_email,
    issueDate: doc.fecha_emision,
    authorizationDate: doc.sri_fecha_autorizacion || doc.fecha_emision,
    authorization: doc.sri_numero_autorizacion || doc.clave_acceso || 'PENDIENTE SRI',
    accessKey: doc.clave_acceso || '',
    environment: doc.sri_ambiente || 'PRUEBAS',
    status: doc.estado,
    rows: detailsRes.rows.map((item) => {
      const discount = Number(item.descuento_total || item.descuento || 0);
      return [
        item.producto_codigo,
        item.producto_nombre,
        qty(item.cantidad),
        money(item.precio_unitario),
        money(discount),
        money(Number(item.precio_total || 0) + Number(item.valor_iva || 0) - discount),
      ];
    }),
    headers: ['Codigo', 'Detalle', 'Cant.', 'PVP', 'Desc.', 'Total'],
    totals: [
      ['Subtotal', money(Number(doc.subtotal_con_iva || 0) + Number(doc.subtotal_iva_cero || 0))],
      ['Descuento', money(doc.descuento_total)],
      ['IVA', money(doc.valor_iva)],
      ['TOTAL', money(doc.total)],
      ['Saldo', money(doc.saldo)],
    ],
    info: [
      ['Vendedor', doc.username || 'S/D'],
      ['Sucursal', doc.sucursal_nombre || 'MATRIZ'],
      ['Forma de pago', paymentsRes.rows[0]?.metodo_pago_nombre || doc.metodo_pago_nombre || 'S/D'],
      ['Observacion', doc.observacion || ''],
    ],
  };
}

async function loadProforma(id) {
  const docRes = await db.query(`
    SELECT p.*, c.name AS cliente_nombre, c.identification_number AS cliente_identificacion,
           c.email AS cliente_email, c.phone AS cliente_telefono, c.address AS cliente_direccion,
           u.username
    FROM proformas p
    JOIN clients c ON p.id_cliente = c.id
    LEFT JOIN usuarios u ON p.id_usuario = u.id_usuario
    WHERE p.id_proforma = $1
  `, [id]);
  if (docRes.rows.length === 0) throw new Error('Proforma no encontrada.');

  const detailsRes = await db.query(`
    SELECT pd.*, p.codigo AS producto_codigo, p.nombre AS producto_nombre
    FROM proforma_detalles pd
    JOIN productos p ON pd.id_producto = p.id_producto
    WHERE pd.id_proforma = $1
    ORDER BY pd.id_detalle ASC
  `, [id]);

  const doc = docRes.rows[0];
  return {
    type: 'proforma',
    title: 'PROFORMA',
    number: doc.numero_proforma,
    subjectLabel: 'Cliente',
    subjectName: doc.cliente_nombre,
    subjectId: doc.cliente_identificacion,
    subjectAddress: doc.cliente_direccion,
    subjectEmail: doc.cliente_email,
    issueDate: doc.fecha_emision,
    authorizationDate: doc.fecha_emision,
    authorization: 'Documento comercial sin validez tributaria',
    accessKey: '',
    environment: 'N/A',
    status: doc.estado,
    rows: detailsRes.rows.map((item) => [
      item.producto_codigo,
      item.producto_nombre,
      qty(item.cantidad),
      money(item.precio_unitario),
      money(item.descuento_total || 0),
      money(item.total),
    ]),
    headers: ['Codigo', 'Detalle', 'Cant.', 'PVP', 'Desc.', 'Total'],
    totals: [
      ['Subtotal', money(doc.subtotal_sin_impuestos)],
      ['Descuento', money(doc.descuento_total)],
      ['IVA', money(doc.valor_iva)],
      ['TOTAL COTIZADO', money(doc.total)],
    ],
    info: [
      ['Transaccion', String(doc.transaction_number || '').padStart(6, '0')],
      ['Vendedor', doc.username || 'S/D'],
      ['Vence', doc.valid_until ? new Date(doc.valid_until).toLocaleDateString('es-EC') : 'N/D'],
      ['Observacion', doc.notes || ''],
    ],
  };
}

async function loadCreditNote(id) {
  const docRes = await db.query(`
    SELECT nc.*, f.numero_factura, f.fecha_emision AS factura_fecha,
           c.name AS cliente_nombre, c.identification_number AS cliente_identificacion,
           c.email AS cliente_email, c.address AS cliente_direccion, u.username
    FROM notas_credito nc
    JOIN facturas f ON nc.id_factura = f.id_factura
    JOIN clients c ON f.id_cliente = c.id
    LEFT JOIN usuarios u ON nc.id_usuario = u.id_usuario
    WHERE nc.id_nota_credito = $1
  `, [id]);
  if (docRes.rows.length === 0) throw new Error('Nota de credito no encontrada.');

  const detailsRes = await db.query(`
    SELECT ncd.*, p.codigo AS producto_codigo, p.nombre AS producto_nombre
    FROM nota_credito_detalles ncd
    JOIN productos p ON ncd.id_producto = p.id_producto
    WHERE ncd.id_nota_credito = $1
    ORDER BY ncd.id_detalle ASC
  `, [id]);

  const doc = docRes.rows[0];
  return {
    type: 'credit-note',
    title: 'NOTA DE CREDITO',
    number: doc.numero_nota_credito,
    subjectLabel: 'Cliente',
    subjectName: doc.cliente_nombre,
    subjectId: doc.cliente_identificacion,
    subjectAddress: doc.cliente_direccion,
    subjectEmail: doc.cliente_email,
    issueDate: doc.fecha_emision,
    authorizationDate: doc.sri_fecha_autorizacion || doc.fecha_emision,
    authorization: doc.sri_numero_autorizacion || doc.clave_acceso || 'PENDIENTE SRI',
    accessKey: doc.clave_acceso || '',
    environment: doc.sri_ambiente || 'PRUEBAS',
    status: doc.estado,
    rows: detailsRes.rows.map((item) => [
      item.producto_codigo,
      item.producto_nombre,
      qty(item.cantidad),
      money(item.precio_unitario),
      money(item.valor_iva),
      money(item.precio_total),
    ]),
    headers: ['Codigo', 'Detalle', 'Cant.', 'PVP', 'IVA', 'Total'],
    totals: [
      ['Subtotal', money(Number(doc.subtotal_con_iva || 0) + Number(doc.subtotal_iva_cero || 0))],
      ['IVA', money(doc.valor_iva)],
      ['VALOR MODIFICACION', money(doc.total)],
    ],
    info: [
      ['Factura modificada', doc.numero_factura],
      ['Fecha factura', doc.factura_fecha ? new Date(doc.factura_fecha).toLocaleDateString('es-EC') : 'N/D'],
      ['Motivo', doc.motivo || 'DEVOLUCION'],
    ],
  };
}

async function loadWithholding(id) {
  const docRes = await db.query(`
    SELECT r.*, c.numero_factura_compra, c.fecha_compra,
           p.nombre AS proveedor_nombre, p.identificacion AS proveedor_identificacion,
           p.email AS proveedor_email, p.direccion AS proveedor_direccion, u.username
    FROM retenciones r
    LEFT JOIN compras c ON r.id_compra = c.id_compra
    LEFT JOIN proveedores p ON c.id_proveedor = p.id_proveedor
    LEFT JOIN usuarios u ON r.id_usuario = u.id_usuario
    WHERE r.id_retencion = $1
  `, [id]);
  if (docRes.rows.length === 0) throw new Error('Retencion no encontrada.');

  const detailsRes = await db.query('SELECT * FROM retencion_detalles WHERE id_retencion = $1 ORDER BY id_detalle ASC', [id]);
  const doc = docRes.rows[0];
  const total = detailsRes.rows.reduce((sum, item) => sum + Number(item.valor_retenido || 0), 0);
  return {
    type: 'withholding',
    title: 'COMPROBANTE DE RETENCION',
    number: doc.numero_retencion,
    subjectLabel: 'Proveedor',
    subjectName: doc.proveedor_nombre,
    subjectId: doc.proveedor_identificacion,
    subjectAddress: doc.proveedor_direccion,
    subjectEmail: doc.proveedor_email,
    issueDate: doc.fecha_emision,
    authorizationDate: doc.sri_fecha_autorizacion || doc.fecha_emision,
    authorization: doc.sri_numero_autorizacion || doc.clave_acceso || 'PENDIENTE SRI',
    accessKey: doc.clave_acceso || '',
    environment: doc.sri_ambiente || 'PRUEBAS',
    status: doc.estado,
    rows: detailsRes.rows.map((item) => [
      item.impuesto,
      item.codigo_sri,
      money(item.base_imponible),
      `${Number(item.porcentaje || 0).toFixed(2)}%`,
      money(item.valor_retenido),
    ]),
    headers: ['Impuesto', 'Codigo', 'Base', '%', 'Retenido'],
    totals: [['TOTAL RETENIDO', money(total)]],
    info: [
      ['Factura compra', doc.numero_factura_compra || 'N/D'],
      ['Fecha compra', doc.fecha_compra ? new Date(doc.fecha_compra).toLocaleDateString('es-EC') : 'N/D'],
      ['Observacion', doc.observacion || ''],
    ],
  };
}

async function loadRide(typeValue, id) {
  const type = normalizeType(typeValue);
  const [company, ride] = await Promise.all([
    loadCompany(),
    type === 'invoice' ? loadInvoice(id)
      : type === 'proforma' ? loadProforma(id)
        : type === 'credit-note' ? loadCreditNote(id)
          : loadWithholding(id),
  ]);
  return { company, ride };
}

function renderRideHtml({ company, ride }) {
  const issuer = text(company.razon_social || company.nombre_comercial, 'Empresa no configurada');
  const logo = text(company.logo_url);
  const logoHtml = logo ? `<img src="${logo}" alt="${issuer}" class="logo">` : `<div class="logo-text">${issuer}</div>`;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${ride.title} ${ride.number}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 11px; }
    .ride { width: 190mm; margin: 0 auto; }
    .grid { display: grid; grid-template-columns: 1fr 1.35fr; gap: 8px; }
    .box { border: 1px solid #555; padding: 7px; border-radius: 2px; }
    .logo { max-width: 145px; max-height: 70px; object-fit: contain; }
    .logo-text { font-weight: 800; color: #0f766e; font-size: 18px; }
    h1 { font-size: 17px; margin: 3px 0 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #333; padding: 4px; vertical-align: top; }
    th { background: #f2f2f2; text-align: center; }
    .right { text-align: right; }
    .small { font-size: 10px; }
    .break { word-break: break-all; }
    .totals { margin-left: auto; width: 270px; }
    .totals td { border-color: #ddd; }
    .totals tr:last-child td { border-top: 1px solid #111; font-weight: 800; }
    .stamp { color: #b91c1c; font-weight: 800; text-align: center; margin-top: 8px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <main class="ride">
    <section class="grid">
      <div>
        <div class="box" style="height:82px">${logoHtml}</div>
        <div class="box" style="margin-top:8px; min-height:105px">
          <strong>${issuer}</strong><br>
          <strong>Dir. Matriz:</strong> ${text(company.direccion_matriz, 'No configurada')}<br>
          <strong>Obligado contabilidad:</strong> ${company.obligado_contabilidad ? 'SI' : 'NO'}<br>
          ${company.contribuyente_especial ? `<strong>Contribuyente especial:</strong> ${company.contribuyente_especial}<br>` : ''}
          ${company.regimen ? `<strong>Regimen:</strong> ${company.regimen}<br>` : ''}
        </div>
      </div>
      <div class="box">
        <strong>RUC:</strong> ${text(company.ruc, 'No configurado')}<br>
        <h1>${ride.title}<br>No. ${ride.number}</h1>
        <strong>NUMERO DE AUTORIZACION:</strong><br>
        <div class="break small">${ride.authorization}</div>
        <strong>FECHA Y HORA DE AUTORIZACION:</strong> ${formatDate(ride.authorizationDate)}<br>
        <strong>AMBIENTE:</strong> ${ride.environment}<br>
        <strong>EMISION:</strong> NORMAL<br>
        <strong>CLAVE DE ACCESO:</strong>
        <div class="break small">${ride.accessKey || 'N/D'}</div>
      </div>
    </section>

    <section class="box" style="margin-top:8px">
      <strong>${ride.subjectLabel}:</strong> ${text(ride.subjectName, 'N/D')} &nbsp;
      <strong>C.I./RUC:</strong> ${text(ride.subjectId, 'N/D')} &nbsp;
      <strong>Emision:</strong> ${formatDate(ride.issueDate)}<br>
      <strong>Direccion:</strong> ${text(ride.subjectAddress, 'S/D')} &nbsp;
      <strong>Email:</strong> ${text(ride.subjectEmail, 'S/D')}
    </section>

    <table>
      <thead><tr>${ride.headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead>
      <tbody>
        ${ride.rows.map((row) => `<tr>${row.map((cell, index) => `<td class="${index >= row.length - 3 ? 'right' : ''}">${cell}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>

    <section class="grid" style="grid-template-columns: 1fr 290px; margin-top:8px">
      <div class="box">
        <strong>Info. adicional</strong><br>
        ${ride.info.map(([label, value]) => `<strong>${label}:</strong> ${text(value)}<br>`).join('')}
      </div>
      <table class="totals">
        <tbody>${ride.totals.map(([label, value]) => `<tr><td>${label}</td><td class="right">${value}</td></tr>`).join('')}</tbody>
      </table>
    </section>

    ${ride.status === 'ANULADA' ? '<div class="stamp">DOCUMENTO ANULADO</div>' : ''}
    <div style="text-align:center;margin-top:28px;"><span style="border-top:1px solid #777;padding:2px 60px 0;">${ride.subjectLabel}</span></div>
  </main>
</body>
</html>`;
}

function drawBox(doc, x, y, w, h) {
  doc.rect(x, y, w, h).stroke('#555');
}

function generateRidePdf({ company, ride }, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 28 });
  doc.pipe(stream);

  const left = 28;
  const top = 28;
  const pageWidth = 539;
  const leftW = 220;
  const rightW = pageWidth - leftW - 8;
  const issuer = text(company.razon_social || company.nombre_comercial, 'Empresa no configurada');

  doc.font('Helvetica').fontSize(8).fillColor('#111');
  drawBox(doc, left, top, leftW, 82);
  const logoPath = resolveLogoPath(company);
  if (logoPath) {
    doc.image(logoPath, left + 8, top + 8, { fit: [140, 58] });
  } else {
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#0f766e').text(text(company.nombre_comercial || issuer), left + 8, top + 24, { width: leftW - 16 });
  }

  drawBox(doc, left, top + 90, leftW, 104);
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(8).text(issuer, left + 7, top + 98, { width: leftW - 14 });
  doc.font('Helvetica').fontSize(7)
    .text(`Dir. Matriz: ${text(company.direccion_matriz, 'No configurada')}`, left + 7, top + 112, { width: leftW - 14 })
    .text(`Obligado contabilidad: ${company.obligado_contabilidad ? 'SI' : 'NO'}`, left + 7, top + 140, { width: leftW - 14 });
  if (company.contribuyente_especial) doc.text(`Contribuyente especial: ${company.contribuyente_especial}`, left + 7, top + 152, { width: leftW - 14 });
  if (company.regimen) doc.text(`Regimen: ${company.regimen}`, left + 7, top + 164, { width: leftW - 14 });

  const rx = left + leftW + 8;
  drawBox(doc, rx, top, rightW, 194);
  doc.font('Helvetica-Bold').fontSize(9).text(`RUC: ${text(company.ruc, 'No configurado')}`, rx + 7, top + 8);
  doc.fontSize(14).text(ride.title, rx + 7, top + 24);
  doc.fillColor('#2563eb').fontSize(11).text(`No. ${ride.number}`, rx + 7, top + 42);
  doc.fillColor('#111').fontSize(8)
    .text('NUMERO DE AUTORIZACION:', rx + 7, top + 62)
    .font('Helvetica').fontSize(7).text(ride.authorization, rx + 7, top + 74, { width: rightW - 14 })
    .font('Helvetica-Bold').fontSize(8).text('FECHA Y HORA DE AUTORIZACION:', rx + 7, top + 104)
    .font('Helvetica').fontSize(7).text(formatDate(ride.authorizationDate), rx + 7, top + 116)
    .font('Helvetica-Bold').fontSize(8).text(`AMBIENTE: ${ride.environment}`, rx + 7, top + 130)
    .text('EMISION: NORMAL', rx + 7, top + 143)
    .text('CLAVE DE ACCESO:', rx + 7, top + 158)
    .font('Helvetica').fontSize(6.5).text(ride.accessKey || 'N/D', rx + 7, top + 170, { width: rightW - 14 });

  const subjectY = top + 204;
  drawBox(doc, left, subjectY, pageWidth, 48);
  doc.font('Helvetica-Bold').fontSize(8).text(`${ride.subjectLabel}:`, left + 7, subjectY + 8);
  doc.font('Helvetica').text(text(ride.subjectName, 'N/D'), left + 65, subjectY + 8, { width: 210 });
  doc.font('Helvetica-Bold').text('C.I./RUC:', left + 300, subjectY + 8);
  doc.font('Helvetica').text(text(ride.subjectId, 'N/D'), left + 350, subjectY + 8);
  doc.font('Helvetica-Bold').text('Emision:', left + 430, subjectY + 8);
  doc.font('Helvetica').text(formatDate(ride.issueDate), left + 475, subjectY + 8, { width: 80 });
  doc.font('Helvetica-Bold').text('Direccion:', left + 7, subjectY + 25);
  doc.font('Helvetica').text(text(ride.subjectAddress, 'S/D'), left + 65, subjectY + 25, { width: 275 });
  doc.font('Helvetica-Bold').text('Email:', left + 350, subjectY + 25);
  doc.font('Helvetica').text(text(ride.subjectEmail, 'S/D'), left + 385, subjectY + 25, { width: 140 });

  let y = subjectY + 60;
  const colWidths = ride.headers.length === 6 ? [52, 220, 42, 56, 56, 62] : [92, 78, 92, 75, 92];
  const rowH = 18;
  doc.font('Helvetica-Bold').fontSize(7);
  let x = left;
  ride.headers.forEach((header, index) => {
    drawBox(doc, x, y, colWidths[index], rowH);
    doc.text(header, x + 3, y + 5, { width: colWidths[index] - 6, align: 'center' });
    x += colWidths[index];
  });
  y += rowH;

  doc.font('Helvetica').fontSize(7);
  ride.rows.forEach((row) => {
    if (y > 700) {
      doc.addPage();
      y = 36;
    }
    x = left;
    row.forEach((cell, index) => {
      drawBox(doc, x, y, colWidths[index], rowH);
      doc.text(String(cell), x + 3, y + 5, { width: colWidths[index] - 6, align: index >= row.length - 3 ? 'right' : 'left' });
      x += colWidths[index];
    });
    y += rowH;
  });

  y += 10;
  drawBox(doc, left, y, 260, 86);
  doc.font('Helvetica-Bold').text('Info. adicional', left + 7, y + 8);
  doc.font('Helvetica');
  ride.info.forEach(([label, value], index) => {
    doc.text(`${label}: ${text(value)}`, left + 7, y + 22 + index * 12, { width: 246 });
  });

  const totalsX = left + 300;
  let totalsY = y;
  ride.totals.forEach(([label, value], index) => {
    doc.font(index === ride.totals.length - 1 ? 'Helvetica-Bold' : 'Helvetica');
    doc.text(label, totalsX, totalsY, { width: 120 });
    doc.text(value, totalsX + 130, totalsY, { width: 95, align: 'right' });
    totalsY += 14;
  });

  if (ride.status === 'ANULADA') {
    doc.fillColor('#b91c1c').font('Helvetica-Bold').fontSize(12).text('DOCUMENTO ANULADO', left, y + 100, { width: pageWidth, align: 'center' });
    doc.fillColor('#111');
  }

  doc.font('Helvetica').fontSize(8).text(ride.subjectLabel, left, 775, { width: pageWidth, align: 'center' });
  doc.end();
}

module.exports = {
  loadRide,
  renderRideHtml,
  generateRidePdf,
  normalizeType,
};
