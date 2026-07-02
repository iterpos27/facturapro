import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

export default function ReportsDashboard() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/reports/summary');
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
    loadSummary();
  }, []);

  const invoices = summary?.invoices || {};

  return (
    <div className="module-shell">
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Reportes</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>Resumen comercial y auditoria operativa.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={loadSummary}>Actualizar</button>
      </div>

      {loading ? (
        <p className="module-empty-state">Cargando reportes...</p>
      ) : !summary ? (
        <p className="module-empty-state">No se pudo cargar la informacion de reportes.</p>
      ) : (
        <>
          <div className="row g-3 mb-3">
            <div className="col-md-3"><div className="card dashboard-tile dashboard-tile-success"><h5>Total facturado</h5><p>{money(invoices.total_facturado)}</p></div></div>
            <div className="col-md-3"><div className="card dashboard-tile dashboard-tile-info"><h5>Facturas emitidas</h5><p>{invoices.facturas_emitidas || 0}</p></div></div>
            <div className="col-md-3"><div className="card dashboard-tile dashboard-tile-warning"><h5>Saldo pendiente</h5><p>{money(invoices.saldo_pendiente)}</p></div></div>
            <div className="col-md-3"><div className="card dashboard-tile dashboard-tile-primary"><h5>Anuladas</h5><p>{invoices.facturas_anuladas || 0}</p></div></div>
          </div>

          <div className="row g-3">
            <div className="col-lg-6">
              <div className="client-data-panel">
                <h2 className="h5 fw-bold mb-3">Proformas por estado</h2>
                <table className="table table-sm table-striped align-middle mb-0">
                  <thead><tr><th>Estado</th><th>Cantidad</th><th className="text-end">Total</th></tr></thead>
                  <tbody>
                    {summary.proformas.map((row) => (
                      <tr key={row.estado}><td>{row.estado}</td><td>{row.cantidad}</td><td className="text-end">{money(row.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="client-data-panel">
                <h2 className="h5 fw-bold mb-3">Ventas ultimos 7 dias</h2>
                <table className="table table-sm table-striped align-middle mb-0">
                  <thead><tr><th>Fecha</th><th>Facturas</th><th className="text-end">Total</th></tr></thead>
                  <tbody>
                    {summary.dailySales.map((row) => (
                      <tr key={row.fecha}><td>{String(row.fecha).slice(0, 10)}</td><td>{row.facturas}</td><td className="text-end">{money(row.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="client-data-panel">
                <h2 className="h5 fw-bold mb-3">Productos mas vendidos</h2>
                <table className="table table-sm table-striped align-middle mb-0">
                  <thead><tr><th>Codigo</th><th>Producto</th><th className="text-end">Cantidad</th></tr></thead>
                  <tbody>
                    {summary.topProducts.map((row) => (
                      <tr key={`${row.codigo}-${row.nombre}`}><td>{row.codigo}</td><td>{row.nombre}</td><td className="text-end">{Number(row.cantidad || 0).toFixed(2)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="client-data-panel">
                <h2 className="h5 fw-bold mb-3">Auditoria reciente</h2>
                <table className="table table-sm table-striped align-middle mb-0">
                  <thead><tr><th>Fecha</th><th>Usuario</th><th>Accion</th><th>Entidad</th></tr></thead>
                  <tbody>
                    {summary.audit.map((row) => (
                      <tr key={row.id_auditoria}><td>{new Date(row.created_at).toLocaleString()}</td><td>{row.username || '-'}</td><td>{row.accion}</td><td>{row.entidad}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
