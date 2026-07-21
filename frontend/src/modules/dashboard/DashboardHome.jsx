import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CIcon from '@coreui/icons-react';
import {
  cilBasket,
  cilChartLine,
  cilFile,
  cilList,
  cilPeople,
  cilReload,
  cilSpeedometer,
  cilWarning,
} from '@coreui/icons';
import { apiFetch } from '../../lib/api';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;
const num = (value) => Number(value || 0).toLocaleString();
const asArray = (value) => (Array.isArray(value) ? value : []);

function DashboardMetric({ label, value, detail, tone, icon, onClick }) {
  const clickable = Boolean(onClick);
  return (
    <button
      type="button"
      className={`dashboard-metric dashboard-metric-${tone}`}
      onClick={onClick}
      disabled={!clickable}
    >
      <span className="dashboard-metric-icon"><CIcon icon={icon} /></span>
      <span className="dashboard-metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </span>
    </button>
  );
}

function DashboardTable({ title, count, columns, rows, emptyText, onViewAll }) {
  return (
    <section className="dashboard-panel">
      <div className="dashboard-panel-head">
        <div>
          <h2>{title}</h2>
          <span>{count} registros</span>
        </div>
        {onViewAll && (
          <button type="button" className="btn btn-light btn-sm" onClick={onViewAll}>
            Ver todo
          </button>
        )}
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0 dashboard-table">
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center text-muted py-4">{emptyText}</td></tr>
            ) : rows.map((row, index) => (
              <tr key={`${title}-${index}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${index}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function QuickAction({ label, icon, onClick }) {
  return (
    <button type="button" className="dashboard-action" onClick={onClick}>
      <CIcon icon={icon} />
      <span>{label}</span>
    </button>
  );
}

export default function DashboardHome({ currentUser, permissions, onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await apiFetch(`/api/reports/summary?date_from=${today}&date_to=${today}`);
      if (!response.ok) throw new Error('No se pudo consultar el resumen del dia.');
      setSummary(await response.json());
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
      setError(err.message || 'No se pudo cargar el dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const invoices = summary?.invoices || {};
  const purchases = summary?.purchases || {};
  const cash = summary?.cash || {};
  const profit = summary?.approximateProfit || {};
  const inventory = summary?.inventory || {};
  const lowStock = asArray(summary?.lowStock);
  const receivables = asArray(summary?.receivables);
  const topProducts = asArray(summary?.topProducts);
  const paymentBreakdown = asArray(summary?.paymentBreakdown);

  const todayLabel = useMemo(() => (
    new Date().toLocaleDateString('es-EC', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  ), []);

  const metrics = [
    {
      label: 'Facturado hoy',
      value: money(invoices.total_facturado),
      detail: `${num(invoices.facturas_emitidas)} facturas emitidas`,
      tone: 'success',
      icon: cilFile,
      onClick: permissions.invoices ? () => onNavigate('/facturas') : null,
    },
    {
      label: 'Saldo por cobrar',
      value: money(invoices.saldo_pendiente),
      detail: `${receivables.length} documentos pendientes`,
      tone: 'warning',
      icon: cilList,
      onClick: permissions.receivables ? () => onNavigate('/cuentas-cobrar') : null,
    },
    {
      label: 'Utilidad estimada',
      value: money(profit.utilidad_estimada),
      detail: 'ventas menos costo',
      tone: 'primary',
      icon: cilChartLine,
      onClick: permissions.reports ? () => onNavigate('/reportes') : null,
    },
    {
      label: 'Ventas en caja',
      value: money(cash.ventas_contado),
      detail: `${num(cash.abiertas)} cajas abiertas`,
      tone: 'info',
      icon: cilSpeedometer,
      onClick: permissions.cash ? () => onNavigate('/caja') : null,
    },
  ];

  return (
    <div className="module-shell dashboard-home">
      <div className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">Panel operativo</span>
          <h1>Buenos dias, {currentUser?.username || 'usuario'}</h1>
          <p>
            Resumen de hoy: {todayLabel}
            {lastUpdated && <span> · actualizado {lastUpdated}</span>}
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <CIcon icon={cilReload} className="me-1" />
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {loading && !summary ? (
        <div className="dashboard-loading">
          <div className="spinner-border text-primary" role="status" />
          <p>Cargando metricas...</p>
        </div>
      ) : error ? (
        <div className="dashboard-error">
          <CIcon icon={cilWarning} />
          <div>
            <strong>No se pudo cargar el dashboard</strong>
            <span>{error}</span>
          </div>
        </div>
      ) : (
        <>
          <div className="dashboard-metrics-grid">
            {metrics.map((metric) => <DashboardMetric key={metric.label} {...metric} />)}
          </div>

          <div className="dashboard-operation-grid">
            <section className="dashboard-panel dashboard-cash-panel">
              <div className="dashboard-panel-head">
                <div>
                  <h2>Caja y flujo</h2>
                  <span>movimiento del dia</span>
                </div>
                {permissions.cash && (
                  <button type="button" className="btn btn-light btn-sm" onClick={() => onNavigate('/caja')}>
                    Abrir caja
                  </button>
                )}
              </div>
              <div className="dashboard-cash-grid">
                <span><small>Contado</small><strong>{money(cash.ventas_contado)}</strong></span>
                <span><small>Credito</small><strong>{money(cash.ventas_credito)}</strong></span>
                <span><small>Cobros CxC</small><strong>{money(cash.cobros_cxc)}</strong></span>
                <span><small>Total operativo</small><strong>{money(cash.total_operativo)}</strong></span>
              </div>
            </section>

            <section className="dashboard-panel dashboard-cash-panel">
              <div className="dashboard-panel-head">
                <div>
                  <h2>Inventario y compras</h2>
                  <span>control rapido</span>
                </div>
                {permissions.inventory && (
                  <button type="button" className="btn btn-light btn-sm" onClick={() => onNavigate('/inventario')}>
                    Inventario
                  </button>
                )}
              </div>
              <div className="dashboard-cash-grid">
                <span><small>Valor stock</small><strong>{money(inventory.valor_inventario)}</strong></span>
                <span><small>Unidades</small><strong>{Number(inventory.unidades_stock || 0).toFixed(2)}</strong></span>
                <span><small>Compras</small><strong>{money(purchases.total_compras)}</strong></span>
                <span><small>Stock bajo</small><strong>{lowStock.length}</strong></span>
              </div>
            </section>
          </div>

          <div className="dashboard-main-grid">
            <DashboardTable
              title="Cuentas por cobrar"
              count={receivables.length}
              columns={['Factura', 'Cliente', 'Saldo']}
              rows={receivables.slice(0, 8).map((row) => [
                row.numero_factura,
                row.cliente_nombre,
                <strong key="saldo">{money(row.saldo)}</strong>,
              ])}
              emptyText="Sin saldos pendientes"
              onViewAll={permissions.receivables ? () => onNavigate('/cuentas-cobrar') : null}
            />
            <DashboardTable
              title="Stock bajo"
              count={lowStock.length}
              columns={['Codigo', 'Producto', 'Stock']}
              rows={lowStock.slice(0, 8).map((row) => [
                row.codigo,
                row.nombre,
                <strong key="stock">{Number(row.stock_actual || 0).toFixed(2)}</strong>,
              ])}
              emptyText="Sin alertas de stock"
              onViewAll={permissions.products ? () => onNavigate('/productos') : null}
            />
            <DashboardTable
              title="Mas vendidos"
              count={topProducts.length}
              columns={['Codigo', 'Producto', 'Cantidad']}
              rows={topProducts.slice(0, 8).map((row) => [
                row.codigo || '-',
                row.nombre || row.producto_nombre,
                `${num(row.cantidad || row.cantidad_vendida || 0)} uds`,
              ])}
              emptyText="Sin ventas registradas hoy"
              onViewAll={permissions.reports ? () => onNavigate('/reportes') : null}
            />
            <DashboardTable
              title="Formas de pago"
              count={paymentBreakdown.length}
              columns={['Metodo', 'Total']}
              rows={paymentBreakdown.slice(0, 8).map((row) => [
                row.metodo_pago || 'Sin metodo',
                <strong key="total">{money(row.total)}</strong>,
              ])}
              emptyText="Sin pagos registrados hoy"
              onViewAll={permissions.reports ? () => onNavigate('/reportes') : null}
            />
          </div>

          <section className="dashboard-actions-panel">
            <div>
              <h2>Accesos rapidos</h2>
              <span>atajos frecuentes del flujo comercial</span>
            </div>
            <div className="dashboard-actions-grid">
              {permissions.invoices && <QuickAction label="Nueva factura" icon={cilFile} onClick={() => onNavigate('/facturas')} />}
              {permissions.proformas && <QuickAction label="Proforma" icon={cilList} onClick={() => onNavigate('/proformas')} />}
              {permissions.clients && <QuickAction label="Clientes" icon={cilPeople} onClick={() => onNavigate('/clientes')} />}
              {permissions.products && <QuickAction label="Productos" icon={cilBasket} onClick={() => onNavigate('/productos')} />}
              {permissions.receivables && <QuickAction label="CxC" icon={cilList} onClick={() => onNavigate('/cuentas-cobrar')} />}
              {permissions.reports && <QuickAction label="Reportes" icon={cilChartLine} onClick={() => onNavigate('/reportes')} />}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
