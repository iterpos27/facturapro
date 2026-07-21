import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';

const csvCell = (value) => {
  let text = String(value ?? '');
  // Evita que Excel interprete datos de usuarios como formulas al abrir el CSV.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

// Adaptador pequeño para conservar la estructura por secciones sin depender de
// la libreria xlsx, que actualmente tiene vulnerabilidades sin correccion.
const XLSX = {
  utils: {
    book_new: () => ({ sheets: [] }),
    aoa_to_sheet: (rows) => rows,
    book_append_sheet: (workbook, rows, name) => workbook.sheets.push({ name, rows }),
  },
  writeFile: (workbook, requestedName) => {
    const rows = workbook.sheets.flatMap(({ name, rows: sectionRows }, index) => [
      ...(index ? [[]] : []),
      [`[${name}]`],
      ...sectionRows,
    ]);
    const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = requestedName.replace(/\.xlsx$/i, '.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.rows)) return value.rows;
  return [];
};

// ── Exportar a Excel ─────────────────────────────────────────────────────────
function exportToExcel(summary, filters) {
  if (!summary) return;
  const wb = XLSX.utils.book_new();
  const dateRange = filters.date_from || filters.date_to
    ? `${filters.date_from || 'inicio'} al ${filters.date_to || 'hoy'}`
    : 'Todos los períodos';

  // Hoja 1 — Resumen General
  const resumenRows = [
    ['FacturaPro — Reporte de Resumen', '', dateRange],
    [],
    ['FACTURACIÓN'],
    ['Total Facturado', money(summary.invoices?.total_facturado)],
    ['Facturas Emitidas', summary.invoices?.facturas_emitidas || 0],
    ['Facturas Anuladas', summary.invoices?.facturas_anuladas || 0],
    ['Saldo Pendiente', money(summary.invoices?.saldo_pendiente)],
    [],
    ['COMPRAS'],
    ['Total Compras', money(summary.purchases?.total_compras)],
    ['Cantidad Compras', summary.purchases?.compras || 0],
    [],
    ['DOCUMENTOS'],
    ['Notas de Crédito', money(summary.creditNotes?.total_notas_credito)],
    ['Total Retenido', money(summary.withholdings?.total_retenido)],
    [],
    ['UTILIDAD'],
    ['Utilidad Estimada', money(summary.approximateProfit?.utilidad_estimada)],
    ['Valor Inventario', money(summary.inventory?.valor_inventario)],
    ['Unidades en Stock', Number(summary.inventory?.unidades_stock || 0).toFixed(2)],
    [],
    ['CAJA'],
    ['Sesiones Cerradas', summary.cash?.cerradas || 0],
    ['Ventas Contado', money(summary.cash?.ventas_contado)],
    ['Ventas Crédito', money(summary.cash?.ventas_credito)],
    ['Cobros CxC', money(summary.cash?.cobros_cxc)],
    ['Efectivo Esperado', money(summary.cash?.efectivo_esperado)],
    ['Diferencia Cierre', money(summary.cash?.diferencia_cierre)],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenRows), 'Resumen');

  // Hoja 2 — Ventas por día
  if (summary.dailySales?.length) {
    const rows = [
      ['Fecha', 'Facturas', 'Total'],
      ...summary.dailySales.map((r) => [String(r.fecha).slice(0, 10), r.facturas, Number(r.total || 0).toFixed(2)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Ventas por día');
  }

  // Hoja 3 — Productos más vendidos
  if (summary.topProducts?.length) {
    const rows = [
      ['Código', 'Producto', 'Cantidad Vendida', 'Total Ventas'],
      ...summary.topProducts.map((r) => [r.codigo, r.nombre, Number(r.cantidad || 0).toFixed(2), Number(r.total || 0).toFixed(2)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Productos vendidos');
  }

  // Hoja 4 — Cuentas por Cobrar
  if (summary.receivables?.length) {
    const rows = [
      ['Factura', 'Cliente', 'Identificación', 'Total', 'Saldo'],
      ...summary.receivables.map((r) => [r.numero_factura, r.cliente_nombre, r.cliente_identificacion, Number(r.total || 0).toFixed(2), Number(r.saldo || 0).toFixed(2)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'CxC Pendientes');
  }

  // Hoja 5 — Stock Bajo
  if (summary.lowStock?.length) {
    const rows = [
      ['Código', 'Producto', 'Stock Actual', 'Stock Mínimo'],
      ...summary.lowStock.map((r) => [r.codigo, r.nombre, Number(r.stock_actual || 0).toFixed(2), Number(r.stock_minimo || 0).toFixed(2)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Stock Bajo');
  }

  // Hoja 6 — Formas de Pago
  if (summary.paymentBreakdown?.length) {
    const rows = [
      ['Método de Pago', 'Total'],
      ...summary.paymentBreakdown.map((r) => [r.metodo_pago || 'Sin método', Number(r.total || 0).toFixed(2)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Formas de pago');
  }

  // Hoja 7 — Proformas
  if (summary.proformas?.length) {
    const rows = [
      ['Estado', 'Cantidad', 'Total'],
      ...summary.proformas.map((r) => [r.estado, r.cantidad, Number(r.total || 0).toFixed(2)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Proformas');
  }

  if (summary.marginByProduct?.length) {
    const rows = [
      ['Codigo', 'Producto', 'Cantidad', 'Venta', 'Costo', 'Margen'],
      ...summary.marginByProduct.map((r) => [
        r.codigo,
        r.nombre,
        Number(r.cantidad || 0).toFixed(2),
        Number(r.venta || 0).toFixed(2),
        Number(r.costo || 0).toFixed(2),
        Number(r.margen || 0).toFixed(2),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Margen productos');
  }

  if (summary.profitByPeriod?.length) {
    const rows = [
      ['Periodo', 'Ventas', 'Costo', 'Utilidad'],
      ...summary.profitByPeriod.map((r) => [
        String(r.periodo).slice(0, 10),
        Number(r.ventas || 0).toFixed(2),
        Number(r.costo || 0).toFixed(2),
        Number(r.utilidad || 0).toFixed(2),
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Utilidad periodo');
  }

  if (summary.receivablesAging?.length) {
    const rows = [
      ['Rango', 'Documentos', 'Saldo'],
      ...summary.receivablesAging.map((r) => [r.bucket, r.documentos, Number(r.saldo || 0).toFixed(2)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Aging CxC');
  }

  if (summary.payablesAging?.length) {
    const rows = [
      ['Rango', 'Documentos', 'Saldo'],
      ...summary.payablesAging.map((r) => [r.bucket, r.documentos, Number(r.saldo || 0).toFixed(2)]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Aging CxP');
  }

  const fileName = `facturapro_reporte_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

export default function ReportsDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
    id_usuario: '',
    id_caja: '',
    id_cliente: '',
    id_proveedor: '',
  });
  const [meta, setMeta] = useState({ users: [], boxes: [], clients: [], suppliers: [] });
  const [activeSection, setActiveSection] = useState('general');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const loadMeta = async () => {
    try {
      const [usersRes, boxesRes, clientsRes, suppliersRes] = await Promise.all([
        apiFetch('/api/users'),
        apiFetch('/api/cash-registers/list'),
        apiFetch('/api/clients'),
        apiFetch('/api/suppliers'),
      ]);
      const [users, boxes, clients, suppliers] = await Promise.all([
        usersRes.ok ? usersRes.json() : [],
        boxesRes.ok ? boxesRes.json() : [],
        clientsRes.ok ? clientsRes.json() : [],
        suppliersRes.ok ? suppliersRes.json() : [],
      ]);
      setMeta({
        users: asArray(users),
        boxes: asArray(boxes),
        clients: asArray(clients),
        suppliers: asArray(suppliers),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/reports/summary${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) throw new Error('No se pudo consultar reportes.');
      setSummary(await response.json());
    } catch (error) {
      console.error(error);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { loadSummary(); }, [queryString]); // eslint-disable-line

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const invoices = summary?.invoices || {};
  const purchases = summary?.purchases || {};
  const creditNotes = summary?.creditNotes || {};
  const withholdings = summary?.withholdings || {};
  const profit = summary?.approximateProfit || {};
  const inventory = summary?.inventory || {};
  const cash = summary?.cash || {};
  const proformas = asArray(summary?.proformas);
  const dailySales = asArray(summary?.dailySales);
  const topProducts = asArray(summary?.topProducts);
  const receivables = asArray(summary?.receivables);
  const lowStock = asArray(summary?.lowStock);
  const paymentBreakdown = asArray(summary?.paymentBreakdown);
  const marginByProduct = asArray(summary?.marginByProduct);
  const profitByPeriod = asArray(summary?.profitByPeriod);
  const receivablesAging = asArray(summary?.receivablesAging);
  const payablesAging = asArray(summary?.payablesAging);
  const reportSections = [
    {
      id: 'general',
      label: 'General',
      tables: [
        {
          title: 'Resumen de caja',
          headers: ['Concepto', 'Valor'],
          rows: [
            ['Sesiones abiertas', cash.abiertas || 0],
            ['Sesiones cerradas', cash.cerradas || 0],
            ['Ventas contado', money(cash.ventas_contado)],
            ['Ventas credito', money(cash.ventas_credito)],
            ['Cobros CxC', money(cash.cobros_cxc)],
            ['Total operativo', money(cash.total_operativo)],
            ['Diferencia cierre', money(cash.diferencia_cierre)],
          ],
        },
        {
          title: 'Ventas por dia',
          headers: ['Fecha', 'Facturas', 'Total'],
          rows: dailySales.map((row) => [String(row.fecha).slice(0, 10), row.facturas, money(row.total)]),
        },
        {
          title: 'Formas de pago',
          headers: ['Metodo', 'Total'],
          rows: paymentBreakdown.map((row) => [row.metodo_pago || 'Sin metodo', money(row.total)]),
        },
      ],
    },
    {
      id: 'rentabilidad',
      label: 'Rentabilidad',
      tables: [
        {
          title: 'Margen por producto',
          headers: ['Codigo', 'Producto', 'Venta', 'Costo', 'Margen'],
          rows: marginByProduct.map((row) => [row.codigo, row.nombre, money(row.venta), money(row.costo), money(row.margen)]),
        },
        {
          title: 'Utilidad por periodo',
          headers: ['Periodo', 'Ventas', 'Costo', 'Utilidad'],
          rows: profitByPeriod.map((row) => [String(row.periodo).slice(0, 10), money(row.ventas), money(row.costo), money(row.utilidad)]),
        },
        {
          title: 'Productos mas vendidos',
          headers: ['Codigo', 'Producto', 'Cantidad'],
          rows: topProducts.map((row) => [row.codigo, row.nombre, Number(row.cantidad || 0).toFixed(2)]),
        },
      ],
    },
    {
      id: 'cartera',
      label: 'Cartera',
      tables: [
        {
          title: 'Cuentas por cobrar',
          headers: ['Factura', 'Cliente', 'Saldo'],
          rows: receivables.map((row) => [row.numero_factura, row.cliente_nombre, money(row.saldo)]),
        },
        {
          title: 'Aging CxC',
          headers: ['Rango', 'Documentos', 'Saldo'],
          rows: receivablesAging.map((row) => [formatAgingBucket(row.bucket), row.documentos, money(row.saldo)]),
        },
        {
          title: 'Aging CxP',
          headers: ['Rango', 'Documentos', 'Saldo'],
          rows: payablesAging.map((row) => [formatAgingBucket(row.bucket), row.documentos, money(row.saldo)]),
        },
      ],
    },
    {
      id: 'inventario',
      label: 'Inventario y docs',
      tables: [
        {
          title: 'Stock minimo',
          headers: ['Codigo', 'Producto', 'Stock'],
          rows: lowStock.map((row) => [row.codigo, row.nombre, Number(row.stock_actual || 0).toFixed(2)]),
        },
        {
          title: 'Proformas por estado',
          headers: ['Estado', 'Cantidad', 'Total'],
          rows: proformas.map((row) => [row.estado, row.cantidad, money(row.total)]),
        },
        {
          title: 'Documentos tributarios',
          headers: ['Documento', 'Cantidad', 'Total'],
          rows: [
            ['Facturas anuladas', invoices.facturas_anuladas || 0, money(0)],
            ['Notas credito', creditNotes.notas_credito || 0, money(creditNotes.total_notas_credito)],
            ['Retenciones', withholdings.retenciones || 0, money(withholdings.total_retenido)],
          ],
        },
      ],
    },
  ];
  const activeReportSection = reportSections.find((section) => section.id === activeSection) || reportSections[0];

  return (
    <div className="module-shell reports-dashboard">
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Reportes</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>Resumen comercial con filtros operativos.</p>
        </div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-secondary" onClick={loadSummary}>
            Actualizar
          </button>
          <button
            type="button"
            className="btn btn-success d-flex align-items-center gap-1"
            disabled={!summary || loading}
            onClick={() => exportToExcel(summary, filters)}
            title="Exportar todas las tablas a CSV compatible con Excel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/>
              <path d="M4.5 12.5A.5.5 0 0 1 5 12h3.5a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zm0-2A.5.5 0 0 1 5 10h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zm0-2A.5.5 0 0 1 5 8h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5zm0-2A.5.5 0 0 1 5 6h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5z"/>
            </svg>
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="client-data-panel mb-3">
        <div className="row g-2">
          <FilterInput label="Desde" type="date" value={filters.date_from} onChange={(value) => updateFilter('date_from', value)} />
          <FilterInput label="Hasta" type="date" value={filters.date_to} onChange={(value) => updateFilter('date_to', value)} />
          <FilterSelect label="Usuario" value={filters.id_usuario} onChange={(value) => updateFilter('id_usuario', value)} options={asArray(meta.users).map((user) => ({ value: user.id_usuario, label: user.username }))} />
          <FilterSelect label="Caja" value={filters.id_caja} onChange={(value) => updateFilter('id_caja', value)} options={asArray(meta.boxes).map((box) => ({ value: box.id_caja, label: `${box.nombre} - ${box.sucursal_nombre}` }))} />
          <FilterSelect label="Cliente" value={filters.id_cliente} onChange={(value) => updateFilter('id_cliente', value)} options={asArray(meta.clients).map((client) => ({ value: client.id, label: `${client.name} (${client.identification_number})` }))} />
          <FilterSelect label="Proveedor" value={filters.id_proveedor} onChange={(value) => updateFilter('id_proveedor', value)} options={asArray(meta.suppliers).map((supplier) => ({ value: supplier.id_proveedor, label: `${supplier.nombre} (${supplier.identificacion})` }))} />
        </div>
      </div>

      {loading ? (
        <p className="module-empty-state">Cargando reportes...</p>
      ) : !summary ? (
        <p className="module-empty-state">No se pudo cargar la informacion de reportes.</p>
      ) : (
        <>
          <div className="row g-3 mb-3">
            <Metric title="Total facturado" value={money(invoices.total_facturado)} tone="success" />
            <Metric title="Facturas emitidas" value={invoices.facturas_emitidas || 0} tone="info" />
            <Metric title="Saldo pendiente" value={money(invoices.saldo_pendiente)} tone="warning" />
            <Metric title="Anuladas" value={invoices.facturas_anuladas || 0} tone="primary" />
            <Metric title="Compras" value={money(purchases.total_compras)} tone="info" />
            <Metric title="Notas crédito" value={money(creditNotes.total_notas_credito)} tone="warning" />
            <Metric title="Retenido" value={money(withholdings.total_retenido)} tone="primary" />
            <Metric title="Utilidad est." value={money(profit.utilidad_estimada)} tone="success" />
            <Metric title="Valor inventario" value={money(inventory.valor_inventario)} tone="success" />
            <Metric title="Unid. en stock" value={Number(inventory.unidades_stock || 0).toFixed(2)} tone="info" />
            <Metric title="Cierres caja" value={cash.cerradas || 0} tone="info" />
            <Metric title="Diferencia caja" value={money(cash.diferencia_cierre)} tone="warning" />
          </div>

          <div className="reports-workspace">
            <div className="reports-tabs" role="tablist" aria-label="Secciones de reportes">
              {reportSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  className={`reports-tab ${activeReportSection.id === section.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  {section.label}
                </button>
              ))}
            </div>
            <div className="reports-table-grid">
              {activeReportSection.tables.map((table) => (
                <ReportTable key={table.title} {...table} />
              ))}
            </div>
          </div>

          <div className="reports-legacy-tables d-none">
            <ReportTable title="Resumen de caja" headers={['Concepto', 'Valor']} rows={[
              ['Sesiones abiertas', cash.abiertas || 0],
              ['Sesiones cerradas', cash.cerradas || 0],
              ['Aperturas', money(cash.total_apertura)],
              ['Conteo fisico cierre', money(cash.total_cierre)],
              ['Ventas contado', money(cash.ventas_contado)],
              ['Ventas credito', money(cash.ventas_credito)],
              ['Cobros CxC', money(cash.cobros_cxc)],
              ['Notas credito', money(cash.notas_credito_total)],
              ['Efectivo esperado', money(cash.efectivo_esperado)],
              ['Total operativo', money(cash.total_operativo)],
              ['Diferencia cierre', money(cash.diferencia_cierre)],
            ]} />
            <ReportTable title="Proformas por estado" headers={['Estado', 'Cantidad', 'Total']} rows={proformas.map((row) => [row.estado, row.cantidad, money(row.total)])} />
            <ReportTable title="Ventas por dia" headers={['Fecha', 'Facturas', 'Total']} rows={dailySales.map((row) => [String(row.fecha).slice(0, 10), row.facturas, money(row.total)])} />
            <ReportTable title="Productos mas vendidos" headers={['Codigo', 'Producto', 'Cantidad']} rows={topProducts.map((row) => [row.codigo, row.nombre, Number(row.cantidad || 0).toFixed(2)])} />
            <ReportTable title="Cuentas por cobrar" headers={['Factura', 'Cliente', 'Saldo']} rows={receivables.map((row) => [row.numero_factura, row.cliente_nombre, money(row.saldo)])} />
            <ReportTable title="Margen por producto" headers={['Codigo', 'Producto', 'Venta', 'Costo', 'Margen']} rows={marginByProduct.map((row) => [row.codigo, row.nombre, money(row.venta), money(row.costo), money(row.margen)])} />
            <ReportTable title="Utilidad por periodo" headers={['Periodo', 'Ventas', 'Costo', 'Utilidad']} rows={profitByPeriod.map((row) => [String(row.periodo).slice(0, 10), money(row.ventas), money(row.costo), money(row.utilidad)])} />
            <ReportTable title="Aging CxC" headers={['Rango', 'Documentos', 'Saldo']} rows={receivablesAging.map((row) => [formatAgingBucket(row.bucket), row.documentos, money(row.saldo)])} />
            <ReportTable title="Aging CxP" headers={['Rango', 'Documentos', 'Saldo']} rows={payablesAging.map((row) => [formatAgingBucket(row.bucket), row.documentos, money(row.saldo)])} />
            <ReportTable title="Stock minimo" headers={['Codigo', 'Producto', 'Stock']} rows={lowStock.map((row) => [row.codigo, row.nombre, Number(row.stock_actual || 0).toFixed(2)])} />
            <ReportTable title="Formas de pago" headers={['Metodo', 'Total']} rows={paymentBreakdown.map((row) => [row.metodo_pago || 'Sin metodo', money(row.total)])} />
          </div>
        </>
      )}
    </div>
  );
}

function formatAgingBucket(bucket) {
  const labels = {
    POR_VENCER: 'Por vencer',
    '1_30': '1 a 30 dias',
    '31_60': '31 a 60 dias',
    '61_90': '61 a 90 dias',
    MAS_90: 'Mas de 90 dias',
  };
  return labels[bucket] || bucket || 'Sin rango';
}

function FilterInput({ label, type, value, onChange }) {
  return (
    <div className="col-md-2">
      <label className="form-label small fw-semibold">{label}</label>
      <input className="form-control form-control-sm" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="col-md-2">
      <label className="form-label small fw-semibold">{label}</label>
      <select className="form-select form-select-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

function Metric({ title, value, tone }) {
  return (
    <div className="col-md-3">
      <div className={`reports-metric reports-metric-${tone}`}>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function ReportTable({ title, headers, rows }) {
  return (
    <div className="reports-table-card">
      <div className="reports-table-head">
        <h2>{title}</h2>
        <span>{rows.length}</span>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-striped align-middle mb-0">
          <thead>
            <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={headers.length} className="text-center text-muted">Sin datos</td></tr>
            ) : rows.map((row, index) => (
              <tr key={`${title}-${index}`}>
                {row.map((cell, idx) => <td key={`${title}-${index}-${idx}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
