import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

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
      setMeta({
        users: usersRes.ok ? await usersRes.json() : [],
        boxes: boxesRes.ok ? await boxesRes.json() : [],
        clients: clientsRes.ok ? await clientsRes.json() : [],
        suppliers: suppliersRes.ok ? await suppliersRes.json() : [],
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

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadSummary();
  }, [queryString]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const invoices = summary?.invoices || {};
  const purchases = summary?.purchases || {};
  const creditNotes = summary?.creditNotes || {};
  const withholdings = summary?.withholdings || {};
  const profit = summary?.approximateProfit || {};

  return (
    <div className="module-shell">
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Reportes</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>Resumen comercial con filtros operativos.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadSummary}>Actualizar</button>
      </div>

      <div className="client-data-panel mb-3">
        <div className="row g-2">
          <FilterInput label="Desde" type="date" value={filters.date_from} onChange={(value) => updateFilter('date_from', value)} />
          <FilterInput label="Hasta" type="date" value={filters.date_to} onChange={(value) => updateFilter('date_to', value)} />
          <FilterSelect label="Usuario" value={filters.id_usuario} onChange={(value) => updateFilter('id_usuario', value)} options={meta.users.map((user) => ({ value: user.id_usuario, label: user.username }))} />
          <FilterSelect label="Caja" value={filters.id_caja} onChange={(value) => updateFilter('id_caja', value)} options={meta.boxes.map((box) => ({ value: box.id_caja, label: `${box.nombre} - ${box.sucursal_nombre}` }))} />
          <FilterSelect label="Cliente" value={filters.id_cliente} onChange={(value) => updateFilter('id_cliente', value)} options={meta.clients.map((client) => ({ value: client.id, label: `${client.name} (${client.identification_number})` }))} />
          <FilterSelect label="Proveedor" value={filters.id_proveedor} onChange={(value) => updateFilter('id_proveedor', value)} options={meta.suppliers.map((supplier) => ({ value: supplier.id_proveedor, label: `${supplier.nombre} (${supplier.identificacion})` }))} />
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
            <Metric title="Notas credito" value={money(creditNotes.total_notas_credito)} tone="warning" />
            <Metric title="Retenido" value={money(withholdings.total_retenido)} tone="primary" />
            <Metric title="Utilidad est." value={money(profit.utilidad_estimada)} tone="success" />
          </div>

          <div className="row g-3">
            <ReportTable title="Proformas por estado" headers={['Estado', 'Cantidad', 'Total']} rows={(summary.proformas || []).map((row) => [row.estado, row.cantidad, money(row.total)])} />
            <ReportTable title="Ventas por dia" headers={['Fecha', 'Facturas', 'Total']} rows={(summary.dailySales || []).map((row) => [String(row.fecha).slice(0, 10), row.facturas, money(row.total)])} />
            <ReportTable title="Productos mas vendidos" headers={['Codigo', 'Producto', 'Cantidad']} rows={(summary.topProducts || []).map((row) => [row.codigo, row.nombre, Number(row.cantidad || 0).toFixed(2)])} />
            <ReportTable title="Cuentas por cobrar" headers={['Factura', 'Cliente', 'Saldo']} rows={(summary.receivables || []).map((row) => [row.numero_factura, row.cliente_nombre, money(row.saldo)])} />
            <ReportTable title="Stock minimo" headers={['Codigo', 'Producto', 'Stock']} rows={(summary.lowStock || []).map((row) => [row.codigo, row.nombre, Number(row.stock_actual || 0).toFixed(2)])} />
            <ReportTable title="Formas de pago" headers={['Metodo', 'Total']} rows={(summary.paymentBreakdown || []).map((row) => [row.metodo_pago || 'Sin metodo', money(row.total)])} />
          </div>
        </>
      )}
    </div>
  );
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
      <div className={`card dashboard-tile dashboard-tile-${tone}`}>
        <h5>{title}</h5>
        <p>{value}</p>
      </div>
    </div>
  );
}

function ReportTable({ title, headers, rows }) {
  return (
    <div className="col-lg-6">
      <div className="client-data-panel">
        <h2 className="h5 fw-bold mb-3">{title}</h2>
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
