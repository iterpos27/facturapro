import React, { useEffect, useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';
import InvoiceRideModal from '../invoices/components/InvoiceRideModal';

const money = (value) => (parseFloat(value || 0) || 0).toFixed(2);
const numberValue = (value) => parseFloat(value || 0) || 0;
const formatDateTime = (value) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : date.toLocaleString();
};

const getCollectionBadge = (item) => {
  const status = String(item.estado_cobranza_actual || item.estado_cobranza || 'PENDIENTE').toUpperCase();
  if (status === 'VENCIDA') return 'bg-danger';
  if (status === 'ABONADA' || status === 'EN_GESTION') return 'bg-warning text-dark';
  if (status === 'PAGADA') return 'bg-success';
  return 'bg-secondary';
};

const isPending = (item) => Number(item.saldo || 0) > 0;

export default function ReceivablesManager() {
  const [receivables, setReceivables] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Estados de modales
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [viewInvoiceDetail, setViewInvoiceDetail] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Formulario de Abono
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [reference, setReference] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [collectionType, setCollectionType] = useState('LLAMADA');
  const [collectionNote, setCollectionNote] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [savingCollection, setSavingCollection] = useState(false);

  useEffect(() => {
    fetchReceivables();
    fetchPaymentMethods();
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const fetchReceivables = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/invoices/receivables');
      if (!response.ok) throw new Error('Error al consultar las cuentas por cobrar.');
      const data = await response.json();
      setReceivables(data);
    } catch (error) {
      console.error(error);
      showAlert('No se pudieron cargar las cuentas por cobrar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await apiFetch('/api/cash-registers/payment-methods');
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data);
        if (data.length > 0) {
          setSelectedPaymentMethod(String(data[0].id_metodo));
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const showAlert = (message, type = 'success') => {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      background: '#ffffff',
      color: '#212529',
      iconColor: type === 'success' ? '#2eb85c' : '#e55353',
      customClass: { popup: 'swal-custom-toast' },
    });
    Toast.fire({ icon: type, title: message });
  };

  const filteredReceivables = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return receivables.filter((item) => {
      return (
        !query ||
        String(item.numero_factura || '').toLowerCase().includes(query) ||
        String(item.cliente_nombre || '').toLowerCase().includes(query) ||
        String(item.cliente_identificacion || '').toLowerCase().includes(query)
      );
    });
  }, [receivables, searchQuery]);

  const handleOpenPayment = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(parseFloat(invoice.saldo).toFixed(2));
    if (paymentMethods.length > 0) {
      setSelectedPaymentMethod(String(paymentMethods[0].id_metodo));
    }
    setReference('');
    setShowPaymentModal(true);
  };

  const handleOpenCollection = (invoice) => {
    setSelectedInvoice(invoice);
    setCollectionType('LLAMADA');
    setCollectionNote('');
    setPromiseDate('');
    setPromiseAmount(parseFloat(invoice.saldo || 0).toFixed(2));
    setShowCollectionModal(true);
  };

  const handleRegisterPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice || !currentUser) return;

    const amount = parseFloat(paymentAmount);
    const maxAmount = parseFloat(selectedInvoice.saldo);

    if (isNaN(amount) || amount <= 0) {
      Swal.fire('Error', 'El monto debe ser un número mayor a cero.', 'error');
      return;
    }

    if (amount > maxAmount + 0.0001) {
      Swal.fire('Error', `El monto no puede superar el saldo pendiente de $${maxAmount.toFixed(2)}.`, 'error');
      return;
    }

    setSavingPayment(true);
    try {
      const response = await apiFetch(`/api/invoices/${selectedInvoice.id_factura}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_metodo_pago: parseInt(selectedPaymentMethod, 10),
          monto: amount,
          referencia: reference,
          id_usuario: currentUser.id_usuario,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo registrar el cobro.');

      showAlert('Abono registrado con éxito.', 'success');
      setShowPaymentModal(false);
      fetchReceivables();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleRegisterCollection = async (e) => {
    e.preventDefault();
    if (!selectedInvoice || !currentUser) return;

    if (!collectionNote.trim()) {
      Swal.fire('Error', 'La nota de gestion es obligatoria.', 'error');
      return;
    }

    setSavingCollection(true);
    try {
      const response = await apiFetch(`/api/invoices/${selectedInvoice.id_factura}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_gestion: collectionType,
          nota: collectionNote,
          fecha_compromiso: promiseDate,
          monto_compromiso: parseFloat(promiseAmount) || 0,
          estado: 'ABIERTA',
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo registrar la gestion.');

      showAlert('Gestion de cobranza registrada.', 'success');
      setShowCollectionModal(false);
      fetchReceivables();
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setSavingCollection(false);
    }
  };

  const handleFetchInvoiceDetail = async (id) => {
    try {
      const response = await apiFetch(`/api/invoices/${id}`);
      if (response.ok) {
        const data = await response.json();
        setViewInvoiceDetail(data);
      } else {
        showAlert('No se pudo cargar el detalle de la factura.', 'error');
      }
    } catch (error) {
      console.error(error);
      showAlert('Error al conectar con el servidor.', 'error');
    }
  };

  const handleOpenHistory = async (invoice) => {
    setLoadingHistory(true);
    try {
      const response = await apiFetch(`/api/invoices/${invoice.id_factura}`);
      if (!response.ok) throw new Error('No se pudo cargar el historico de cobros.');
      const data = await response.json();
      setHistoryDetail(data);
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const buildReceivableHistoryRows = (detail) => {
    const invoice = detail?.invoice || {};
    const initialPayments = (detail?.payments || []).map((payment) => ({
      ...payment,
      historyType: 'Pago inicial',
      historyDate: invoice.fecha_emision || payment.created_at,
      historyMethod: payment.metodo_pago_nombre,
      historyUser: invoice.username,
    }));
    const collections = (detail?.cobros || []).map((payment) => ({
      ...payment,
      historyType: 'Abono CxC',
      historyDate: payment.fecha_cobro,
      historyMethod: payment.metodo_pago_nombre,
      historyUser: payment.username,
    }));
    const rows = [...initialPayments, ...collections].sort((a, b) => (
      new Date(a.historyDate || 0).getTime() - new Date(b.historyDate || 0).getTime()
    ));
    const paid = numberValue(invoice.total) - numberValue(invoice.saldo);

    if (rows.length === 0 && paid > 0) {
      rows.push({
        id_pago: 'reconstruido',
        historyType: 'Pago registrado',
        historyDate: invoice.fecha_emision,
        historyMethod: invoice.metodo_pago_nombre || 'Sin metodo',
        historyUser: invoice.username,
        referencia: 'Reconstruido desde el total pagado del documento',
        monto: paid,
      });
    }

    return rows;
  };

  return (
    <div className="module-shell">
      {/* Header */}
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>
            Cuentas por Cobrar (CxC)
          </h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>
            Registra abonos y cobra saldos pendientes de ventas a crédito.
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {filteredReceivables.filter(isPending).length}{' '}
            {filteredReceivables.filter(isPending).length === 1 ? 'pendiente' : 'pendientes'}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="search-bar-container mt-1">
        <div className="search-input-wrap">
          <span className="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </span>
          <input
            type="text"
            className="form-control"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por cliente, cédula/RUC o factura..."
          />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={() => setSearchQuery('')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          Limpiar
        </button>
      </div>

      {/* Tabla / Tarjetas */}
      {loading ? (
        <div className="text-center py-4">Cargando cuentas por cobrar...</div>
      ) : filteredReceivables.length === 0 ? (
        <p className="module-empty-state">
          No hay cuentas por cobrar pendientes que coincidan con la búsqueda.
        </p>
      ) : (
        <div>
          {/* Desktop Table View */}
          <div className="table-responsive desktop-only">
            <table className="table table-striped table-hover align-middle border">
              <thead className="table-light">
                <tr>
                  <th>No. Factura</th>
                  <th>Cliente</th>
                  <th>Fecha Emisión</th>
                  <th>Vence</th>
                  <th>Cobranza</th>
                  <th className="text-end">Monto Total</th>
                  <th className="text-end">Saldo Pendiente</th>
                  <th style={{ width: '390px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceivables.map((item) => (
                  <tr key={item.id_factura}>
                    <td style={{ fontWeight: 700 }}>{item.numero_factura}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{item.cliente_nombre}</div>
                      <small className="text-muted">{item.cliente_identificacion}</small>
                    </td>
                    <td>{new Date(item.fecha_emision).toLocaleDateString()}</td>
                    <td>
                      {item.fecha_vencimiento ? new Date(item.fecha_vencimiento).toLocaleDateString() : 'Sin plazo'}
                      {parseInt(item.dias_vencidos || 0, 10) > 0 && (
                        <small className="d-block text-danger fw-bold">
                          {item.dias_vencidos} dias vencida
                        </small>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${getCollectionBadge(item)}`}>
                        {item.estado_cobranza_actual || item.estado_cobranza || 'PENDIENTE'}
                      </span>
                      {item.proxima_gestion && (
                        <small className="d-block text-muted">
                          Promesa: {new Date(item.proxima_gestion).toLocaleDateString()}
                        </small>
                      )}
                    </td>
                    <td className="text-end fw-semibold">${money(item.total)}</td>
                    <td className="text-end fw-bold text-danger">${money(item.saldo)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => handleOpenPayment(item)}
                          disabled={!isPending(item)}
                        >
                          Registrar Abono
                        </button>
                        <button
                          className="btn btn-warning"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => handleOpenCollection(item)}
                        >
                          Gestionar
                        </button>
                        <button
                          className="btn btn-info text-white"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => handleFetchInvoiceDetail(item.id_factura)}
                        >
                          Ver RIDE
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => handleOpenHistory(item)}
                          disabled={loadingHistory}
                        >
                          Historial
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="client-cards-container mobile-only">
            {filteredReceivables.map((item) => (
              <div key={item.id_factura} className="client-mobile-card">
                <div className="client-card-header">
                  <span className="client-name">{item.numero_factura}</span>
                  <span className={`badge ${getCollectionBadge(item)}`} style={{ fontWeight: 'bold' }}>
                    {item.estado_cobranza_actual || item.estado_cobranza || 'PENDIENTE'}
                  </span>
                </div>
                <div className="client-card-body">
                  <div className="client-card-info-item">
                    <span className="info-label">Cliente:</span>
                    <span className="info-val">
                      {item.cliente_nombre} ({item.cliente_identificacion})
                    </span>
                  </div>
                  <div className="client-card-info-item">
                    <span className="info-label">Total / Saldo:</span>
                    <span className="info-val">
                      <strong>${money(item.total)}</strong> /{' '}
                      <span className="text-danger fw-bold">
                        ${money(item.saldo)}
                      </span>
                    </span>
                  </div>
                  <div className="client-card-info-item">
                    <span className="info-label">Fecha:</span>
                    <span className="info-val">{new Date(item.fecha_emision).toLocaleDateString()}</span>
                  </div>
                  <div className="client-card-info-item">
                    <span className="info-label">Vence:</span>
                    <span className="info-val">
                      {item.fecha_vencimiento ? new Date(item.fecha_vencimiento).toLocaleDateString() : 'Sin plazo'}
                      {parseInt(item.dias_vencidos || 0, 10) > 0 ? ` (${item.dias_vencidos} dias)` : ''}
                    </span>
                  </div>
                </div>
                <div className="client-card-actions">
                  <button className="btn btn-primary" onClick={() => handleOpenPayment(item)} disabled={!isPending(item)}>
                    Registrar Abono
                  </button>
                  <button className="btn btn-warning" onClick={() => handleOpenCollection(item)}>
                    Gestionar
                  </button>
                  <button className="btn btn-info text-white" onClick={() => handleFetchInvoiceDetail(item.id_factura)}>
                    Ver RIDE
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleOpenHistory(item)} disabled={loadingHistory}>
                    Historial
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR ABONO */}
      {showPaymentModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div
            className="modal-container modal-container-clean compact-modal"
            style={{ maxWidth: '500px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={() => setShowPaymentModal(false)}
              aria-label="Cerrar modal"
            >
              X
            </button>
            <h2 className="text-dark fw-bold">Registrar Abono</h2>
            <p className="modal-support-copy">
              Ingresa el pago a la factura <strong>{selectedInvoice.numero_factura}</strong> de{' '}
              {selectedInvoice.cliente_nombre}.
            </p>

            <form onSubmit={handleRegisterPayment}>
              <div className="mb-3">
                <label className="form-label fw-bold">Saldo Actual Pendiente</label>
                <input
                  type="text"
                  className="form-control"
                  value={`$${parseFloat(selectedInvoice.saldo).toFixed(2)}`}
                  readOnly
                  disabled
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">Monto del Abono *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  max={parseFloat(selectedInvoice.saldo)}
                  min="0.01"
                  required
                  autoFocus
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">Método de Pago *</label>
                <select
                  className="form-select"
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  required
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id_metodo} value={pm.id_metodo}>
                      {pm.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">Referencia / Lote / Detalle</label>
                <input
                  type="text"
                  className="form-control"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej: Transf. Pichincha #1809"
                />
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={savingPayment}>
                  {savingPayment ? 'Registrando...' : 'Registrar Cobro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL GESTION COBRANZA */}
      {showCollectionModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowCollectionModal(false)}>
          <div
            className="modal-container modal-container-clean compact-modal"
            style={{ maxWidth: '560px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={() => setShowCollectionModal(false)}
              aria-label="Cerrar modal"
            >
              X
            </button>
            <h2 className="text-dark fw-bold">Gestionar Cobranza</h2>
            <p className="modal-support-copy">
              Registra el seguimiento de la factura <strong>{selectedInvoice.numero_factura}</strong>.
              Saldo pendiente: <strong>${money(selectedInvoice.saldo)}</strong>.
            </p>

            <form onSubmit={handleRegisterCollection}>
              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label fw-bold">Tipo de gestion *</label>
                  <select
                    className="form-select"
                    value={collectionType}
                    onChange={(event) => setCollectionType(event.target.value)}
                  >
                    <option value="LLAMADA">Llamada</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="VISITA">Visita</option>
                    <option value="ACUERDO">Acuerdo de pago</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-bold">Promesa</label>
                  <input
                    type="date"
                    className="form-control"
                    value={promiseDate}
                    onChange={(event) => setPromiseDate(event.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-bold">Monto</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control text-end"
                    value={promiseAmount}
                    onChange={(event) => setPromiseAmount(event.target.value)}
                    min="0"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="form-label fw-bold">Nota de gestion *</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={collectionNote}
                  onChange={(event) => setCollectionNote(event.target.value)}
                  placeholder="Ej: Cliente confirma pago por transferencia el viernes."
                  required
                />
              </div>

              <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCollectionModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={savingCollection}>
                  {savingCollection ? 'Guardando...' : 'Guardar Gestion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RIDE Detalle */}
      {viewInvoiceDetail && (
        <InvoiceRideModal
          viewInvoice={viewInvoiceDetail}
          onClose={() => setViewInvoiceDetail(null)}
        />
      )}

      {historyDetail && (
        <PaymentHistoryModal
          title="Historial de cobros CxC"
          documentLabel={historyDetail.invoice?.numero_factura}
          partyName={historyDetail.invoice?.cliente_nombre}
          total={historyDetail.invoice?.total}
          paid={numberValue(historyDetail.invoice?.total) - numberValue(historyDetail.invoice?.saldo)}
          balance={historyDetail.invoice?.saldo}
          rows={buildReceivableHistoryRows(historyDetail)}
          emptyText="Esta factura no tiene pagos registrados."
          onClose={() => setHistoryDetail(null)}
        />
      )}
    </div>
  );
}

function PaymentHistoryModal({
  title,
  documentLabel,
  partyName,
  total,
  paid,
  balance,
  rows,
  emptyText,
  onClose,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container modal-container-clean compact-modal payment-history-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar modal">X</button>
        <h2 className="text-dark fw-bold">{title}</h2>
        <p className="modal-support-copy">
          {documentLabel} - {partyName}
        </p>

        <div className="payment-history-summary">
          <span>Total <strong>${money(total)}</strong></span>
          <span>Pagado <strong>${money(paid)}</strong></span>
          <span>Saldo <strong>${money(balance)}</strong></span>
        </div>

        <div className="table-responsive">
          <table className="table table-sm table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Metodo</th>
                <th>Referencia</th>
                <th>Usuario</th>
                <th className="text-end">Monto</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan="6" className="text-center text-muted">{emptyText}</td></tr>
              ) : rows.map((row) => (
                <tr key={`${row.historyType || 'pago'}-${row.id_cobro || row.id_pago}`}>
                  <td>{formatDateTime(row.historyDate)}</td>
                  <td>{row.historyType || 'Pago'}</td>
                  <td>{row.historyMethod || row.metodo_pago || 'Sin metodo'}</td>
                  <td>{row.referencia || '-'}</td>
                  <td>{row.historyUser || '-'}</td>
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
