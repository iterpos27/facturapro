import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';

const money = (value) => (parseFloat(value || 0) || 0).toFixed(2);
const numberValue = (value) => parseFloat(value || 0) || 0;
const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleString();
};

const getPaymentBadge = (status) => {
  const value = String(status || 'PENDIENTE').toUpperCase();
  if (value === 'PAGADA') return 'bg-success';
  if (value === 'VENCIDA') return 'bg-danger';
  if (value === 'ABONADA') return 'bg-warning text-dark';
  return 'bg-secondary';
};

const isPending = (item) => Number(item.saldo || 0) > 0;

export default function PayablesManager() {
  const [payables, setPayables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('EFECTIVO');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchPayables = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/purchases/payables');
      if (!response.ok) throw new Error('No se pudieron consultar cuentas por pagar.');
      setPayables(await response.json());
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayables();
  }, []);

  const filteredPayables = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return payables;
    return payables.filter((item) => (
      String(item.numero_factura_compra || '').toLowerCase().includes(needle) ||
      String(item.proveedor_nombre || '').toLowerCase().includes(needle) ||
      String(item.proveedor_identificacion || '').toLowerCase().includes(needle)
    ));
  }, [payables, query]);

  const openPayment = (purchase) => {
    setSelectedPurchase(purchase);
    setAmount(money(purchase.saldo));
    setMethod('EFECTIVO');
    setReference('');
  };

  const registerPayment = async (event) => {
    event.preventDefault();
    if (!selectedPurchase) return;
    const paymentAmount = parseFloat(amount);
    const maxAmount = parseFloat(selectedPurchase.saldo || 0);
    if (!paymentAmount || paymentAmount <= 0) {
      Swal.fire('Error', 'El monto debe ser mayor a cero.', 'error');
      return;
    }
    if (paymentAmount > maxAmount + 0.0001) {
      Swal.fire('Error', `El pago no puede superar el saldo de $${money(maxAmount)}.`, 'error');
      return;
    }

    setSaving(true);
    try {
      const response = await apiFetch(`/api/purchases/${selectedPurchase.id_compra}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monto: paymentAmount,
          metodo_pago: method,
          referencia: reference,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo registrar el pago.');
      setSelectedPurchase(null);
      await fetchPayables();
      Swal.fire('Pago registrado', `Nuevo saldo: $${money(data.nuevo_saldo)}`, 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async (purchase) => {
    setLoadingHistory(true);
    try {
      const response = await apiFetch(`/api/purchases/${purchase.id_compra}`);
      if (!response.ok) throw new Error('No se pudo cargar el historico de pagos.');
      setHistoryDetail(await response.json());
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="module-shell">
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Cuentas por Pagar</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>
            Controla compras a credito, vencimientos y pagos a proveedores.
          </p>
        </div>
        <span className="count-badge-pill">{filteredPayables.filter(isPending).length} pendientes</span>
      </div>

      <div className="search-bar-container mt-1">
        <div className="search-input-wrap">
          <span className="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
          <input className="form-control" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por proveedor, RUC o factura..." />
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setQuery('')}>Limpiar</button>
      </div>

      {loading ? (
        <div className="text-center py-4">Cargando cuentas por pagar...</div>
      ) : filteredPayables.length === 0 ? (
        <p className="module-empty-state">No hay cuentas por pagar pendientes.</p>
      ) : (
        <div className="table-responsive desktop-only">
          <table className="table table-striped table-hover align-middle border">
            <thead className="table-light">
              <tr>
                <th>Factura proveedor</th>
                <th>Proveedor</th>
                <th>Vence</th>
                <th>Estado</th>
                <th className="text-end">Total</th>
                <th className="text-end">Pagado</th>
                <th className="text-end">Saldo</th>
                <th style={{ width: '240px' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayables.map((item) => (
                <tr key={item.id_compra}>
                  <td className="fw-bold">{item.numero_factura_compra}</td>
                  <td>
                    <div className="fw-bold">{item.proveedor_nombre}</div>
                    <small className="text-muted">{item.proveedor_identificacion}</small>
                  </td>
                  <td>
                    {item.fecha_vencimiento ? new Date(item.fecha_vencimiento).toLocaleDateString() : 'Sin plazo'}
                    {parseInt(item.dias_vencidos || 0, 10) > 0 && (
                      <small className="d-block text-danger fw-bold">{item.dias_vencidos} dias vencida</small>
                    )}
                  </td>
                  <td><span className={`badge ${getPaymentBadge(item.estado_pago_actual)}`}>{item.estado_pago_actual}</span></td>
                  <td className="text-end fw-semibold">${money(item.total)}</td>
                  <td className="text-end">${money(item.monto_pagado)}</td>
                  <td className="text-end fw-bold text-danger">${money(item.saldo)}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      <button className="btn btn-primary btn-sm" onClick={() => openPayment(item)} disabled={!isPending(item)}>
                        Registrar pago
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => openHistory(item)} disabled={loadingHistory}>
                        Historial
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedPurchase && (
        <div className="modal-overlay" onClick={() => setSelectedPurchase(null)}>
          <div className="modal-container modal-container-clean compact-modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSelectedPurchase(null)} aria-label="Cerrar modal">X</button>
            <h2 className="text-dark fw-bold">Registrar pago proveedor</h2>
            <p className="modal-support-copy">
              {selectedPurchase.proveedor_nombre} - factura {selectedPurchase.numero_factura_compra}
            </p>
            <form onSubmit={registerPayment}>
              <div className="mb-3">
                <label className="form-label fw-bold">Saldo pendiente</label>
                <input className="form-control" value={`$${money(selectedPurchase.saldo)}`} readOnly disabled />
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold">Monto *</label>
                <input type="number" step="0.01" className="form-control text-end" value={amount} onChange={(e) => setAmount(e.target.value)} min="0.01" max={selectedPurchase.saldo} required autoFocus />
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold">Metodo</label>
                <select className="form-select" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold">Referencia</label>
                <input className="form-control" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej: transferencia Banco #123" />
              </div>
              <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedPurchase(null)}>Cancelar</button>
                <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Guardando...' : 'Registrar pago'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyDetail && (
        <PurchasePaymentHistoryModal
          detail={historyDetail}
          onClose={() => setHistoryDetail(null)}
        />
      )}
    </div>
  );
}

function PurchasePaymentHistoryModal({ detail, onClose }) {
  const purchase = detail.purchase || {};
  const rows = (detail.payments || []).length > 0
    ? detail.payments
    : numberValue(purchase.monto_pagado) > 0
      ? [{
          id_pago: 'reconstruido',
          fecha_pago: purchase.fecha_compra || purchase.created_at,
          metodo_pago: 'Registrado',
          referencia: 'Reconstruido desde el total pagado de la compra',
          username: purchase.username,
          monto: purchase.monto_pagado,
        }]
      : [];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-container-clean compact-modal payment-history-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar modal">X</button>
        <h2 className="text-dark fw-bold">Historial de pagos CxP</h2>
        <p className="modal-support-copy">
          {purchase.numero_factura_compra} - {purchase.proveedor_nombre}
        </p>

        <div className="payment-history-summary">
          <span>Total <strong>${money(purchase.total)}</strong></span>
          <span>Pagado <strong>${money(purchase.monto_pagado)}</strong></span>
          <span>Saldo <strong>${money(purchase.saldo)}</strong></span>
        </div>

        <div className="table-responsive">
          <table className="table table-sm table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Metodo</th>
                <th>Referencia</th>
                <th>Usuario</th>
                <th className="text-end">Monto</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan="5" className="text-center text-muted">Esta compra no tiene pagos registrados.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id_pago}>
                  <td>{formatDateTime(row.fecha_pago)}</td>
                  <td>{row.metodo_pago || 'Sin metodo'}</td>
                  <td>{row.referencia || '-'}</td>
                  <td>{row.username || '-'}</td>
                  <td className="text-end fw-bold">${money(row.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
