import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../../lib/api';

const money = (v) => `$${Number(v || 0).toFixed(2)}`;
const num = (v) => Number(v || 0).toLocaleString();

function MetricCard({ label, value, sub, color, icon, onClick }) {
  return (
    <div
      className="col-xl-3 col-md-6"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div
        className="card h-100 border-0 shadow-sm"
        style={{
          borderRadius: '14px',
          background: `linear-gradient(135deg, ${color}22 0%, ${color}08 100%)`,
          borderLeft: `4px solid ${color}`,
          transition: 'transform .15s, box-shadow .15s',
        }}
        onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.12)'; } }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
      >
        <div className="card-body d-flex align-items-center gap-3 p-3">
          <div style={{ fontSize: '2rem', minWidth: '2.5rem', textAlign: 'center' }}>{icon}</div>
          <div className="flex-grow-1 overflow-hidden">
            <div className="text-secondary small fw-semibold text-truncate">{label}</div>
            <div className="fw-bold" style={{ fontSize: '1.45rem', color, lineHeight: 1.15 }}>{value}</div>
            {sub && <div className="text-muted" style={{ fontSize: '0.76rem' }}>{sub}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ items, label, emptyMsg }) {
  return (
    <div className="col-md-6">
      <div className="card border-0 shadow-sm h-100" style={{ borderRadius: '14px' }}>
        <div className="card-header bg-white border-bottom-0 pt-3 pb-0 px-4">
          <h6 className="fw-bold text-dark mb-0">{label}</h6>
        </div>
        <div className="card-body p-0">
          {items.length === 0 ? (
            <p className="text-muted text-center py-4 small">{emptyMsg}</p>
          ) : (
            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
              <table className="table table-sm table-hover mb-0" style={{ fontSize: '0.82rem' }}>
                <tbody>
                  {items.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className={j === row.length - 1 ? 'text-end fw-semibold' : ''}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardHome({ currentUser, permissions, onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await apiFetch(`/api/reports/summary?date_from=${today}&date_to=${today}`);
      if (res.ok) {
        setSummary(await res.json());
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const inv = summary?.invoices || {};
  const cash = summary?.cash || {};
  const profit = summary?.approximateProfit || {};
  const lowStock = summary?.lowStock || [];
  const receivables = summary?.receivables || [];
  const topProducts = summary?.topProducts || [];

  return (
    <div className="module-shell">
      {/* Header */}
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>
            Buenos días, {currentUser?.username} 👋
          </h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.9rem' }}>
            Resumen de hoy · {new Date().toLocaleDateString('es-EC', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            {lastUpdated && <span className="ms-2 text-muted">· actualizado {lastUpdated}</span>}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? '⏳' : '🔄 Actualizar'}
        </button>
      </div>

      {loading && !summary ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="text-secondary mt-2 small">Cargando métricas...</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="row g-3 mb-4">
            <MetricCard
              label="Facturado hoy"
              value={money(inv.total_facturado)}
              sub={`${num(inv.facturas_emitidas)} factura(s) emitida(s)`}
              color="#10b981"
              icon="💰"
              onClick={permissions.invoices ? () => onNavigate('/facturas') : null}
            />
            <MetricCard
              label="Saldo por cobrar"
              value={money(inv.saldo_pendiente)}
              sub="Facturas a crédito pendientes"
              color="#f59e0b"
              icon="📋"
              onClick={permissions.receivables ? () => onNavigate('/cuentas-cobrar') : null}
            />
            <MetricCard
              label="Utilidad estimada"
              value={money(profit.utilidad_estimada)}
              sub="Precio venta menos costo"
              color="#6366f1"
              icon="📈"
              onClick={permissions.reports ? () => onNavigate('/reportes') : null}
            />
            <MetricCard
              label="Ventas en caja"
              value={money(cash.ventas_contado)}
              sub={`${num(cash.abiertas)} sesión(es) abiertas`}
              color="#3b82f6"
              icon="🏧"
              onClick={permissions.cash ? () => onNavigate('/caja') : null}
            />
          </div>

          {/* Alertas y listas */}
          <div className="row g-3 mb-4">
            <AlertCard
              label={`⚠️ Stock bajo (${lowStock.length})`}
              items={lowStock.map((r) => [r.codigo, r.nombre, `${Number(r.stock_actual || 0).toFixed(2)} uds`])}
              emptyMsg="Sin alertas de stock"
            />
            <AlertCard
              label={`🕐 Cuentas por cobrar (${receivables.length})`}
              items={receivables.slice(0, 8).map((r) => [r.numero_factura, r.cliente_nombre, money(r.saldo)])}
              emptyMsg="Sin saldos pendientes hoy"
            />
            <AlertCard
              label={`Productos mas vendidos (${topProducts.length})`}
              items={topProducts.slice(0, 8).map((r) => [
                r.codigo || '-',
                r.producto_nombre || r.nombre,
                `${num(r.cantidad_vendida || r.cantidad || 0)} uds`,
              ])}
              emptyMsg="Sin ventas de productos hoy"
            />
          </div>

          {/* Accesos rápidos */}
          <div className="client-data-panel">
            <h6 className="fw-bold text-dark mb-3">⚡ Accesos rápidos</h6>
            <div className="d-flex flex-wrap gap-2">
              {permissions.invoices    && <button className="btn btn-outline-primary btn-sm" onClick={() => onNavigate('/facturas')}>Nueva Factura</button>}
              {permissions.proformas   && <button className="btn btn-outline-secondary btn-sm" onClick={() => onNavigate('/proformas')}>Nueva Proforma</button>}
              {permissions.clients     && <button className="btn btn-outline-secondary btn-sm" onClick={() => onNavigate('/clientes')}>Clientes</button>}
              {permissions.products    && <button className="btn btn-outline-secondary btn-sm" onClick={() => onNavigate('/productos')}>Productos</button>}
              {permissions.reports     && <button className="btn btn-outline-secondary btn-sm" onClick={() => onNavigate('/reportes')}>Reportes</button>}
              {permissions.company     && <button className="btn btn-outline-danger btn-sm" onClick={() => onNavigate('/empresa')}>Config. Empresa</button>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
