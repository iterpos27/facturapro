import React, { useEffect, useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import {
  cilCloudUpload,
  cilDescription,
  cilEnvelopeClosed,
  cilFile,
  cilPrint,
  cilTrash,
} from '@coreui/icons';
import { apiFetch, apiUrl } from '../../../lib/api';
import { printDocument } from '../../../lib/printDocument';
import { openRidePdf } from '../../../lib/rides';
import DocumentActionButtons from '../../../shared/DocumentActionButtons';
import CreditNoteRideModal from './CreditNoteRideModal';

const money = (value) => (parseFloat(value || 0) || 0).toFixed(2);
const qty = (value) => (parseFloat(value || 0) || 0).toFixed(2);

const getSriBadgeClass = (estado) => {
  const value = String(estado || 'PENDIENTE').toUpperCase();
  if (value === 'AUTORIZADO') return 'bg-success';
  if (value === 'NO_AUTORIZADO' || value === 'DEVUELTO') return 'bg-danger';
  if (value === 'FIRMADO' || value === 'RECIBIDO' || value === 'GENERADO') return 'bg-warning text-dark';
  return 'bg-secondary';
};

function resolveAssetUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  return url.startsWith('/uploads/') ? apiUrl(url) : url;
}

export default function CreditNotesManager() {
  const [creditNotes, setCreditNotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Filtros de búsqueda
  const [searchQuery, setSearchQuery] = useState('');

  // Detalle de NC
  const [selectedNcDetail, setSelectedNcDetail] = useState(null);
  // RIDE de NC
  const [viewRide, setViewRide] = useState(null);

  // Formulario de emisión
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [selectedInvoiceData, setSelectedInvoiceData] = useState(null);
  const [reason, setReason] = useState('');
  const [returnItems, setReturnItems] = useState([]); // [{ id_producto, name, code, maxQty, cantidad, precio_unitario, taxPercent }]
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  useEffect(() => {
    fetchCreditNotes();
    fetchInvoices();
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const fetchCreditNotes = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/credit-notes');
      if (!response.ok) throw new Error('Error al consultar las notas de crédito.');
      const result = await response.json();
      setCreditNotes(Array.isArray(result) ? result : (result.data || []));
    } catch (error) {
      console.error(error);
      showAlert('No se pudieron cargar las notas de crédito.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await apiFetch('/api/invoices');
      if (response.ok) {
        const data = await response.json();
        // Solo facturas emitidas son elegibles
        setInvoices(data.filter((f) => f.estado === 'EMITIDA'));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchInvoiceDetails = async (id) => {
    setLoadingInvoice(true);
    try {
      const response = await apiFetch(`/api/invoices/${id}`);
      if (!response.ok) throw new Error('No se pudo cargar el detalle de la factura.');
      const data = await response.json();
      setSelectedInvoiceData(data);

      // Pre-cargar items elegibles para devolución
      setReturnItems(
        (data.details || []).map((d) => ({
          id_producto: d.id_producto,
          name: d.producto_name || d.producto_nombre,
          code: d.producto_codigo,
          maxQty: parseFloat(d.cantidad),
          cantidad: parseFloat(d.cantidad), // por defecto toda la fila
          precio_unitario: parseFloat(d.precio_unitario),
          taxPercent: parseFloat(d.porcentaje_iva || d.impuesto_porcentaje || d.iva_porcentaje || 0),
        }))
      );
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
      setSelectedInvoiceId('');
      setSelectedInvoiceData(null);
    } finally {
      setLoadingInvoice(false);
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

  const handleInvoiceChange = (e) => {
    const val = e.target.value;
    setSelectedInvoiceId(val);
    if (val) {
      fetchInvoiceDetails(val);
    } else {
      setSelectedInvoiceData(null);
      setReturnItems([]);
    }
  };

  const handleItemQtyChange = (index, value) => {
    const nextItems = [...returnItems];
    const qty = parseFloat(value) || 0;
    const max = nextItems[index].maxQty;
    nextItems[index].cantidad = Math.min(Math.max(qty, 0), max);
    setReturnItems(nextItems);
  };

  const handleFetchNcDetail = async (id) => {
    try {
      const response = await apiFetch(`/api/credit-notes/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedNcDetail(data);
      } else {
        showAlert('No se pudo obtener el detalle de la nota de crédito.', 'error');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const filteredNcs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return creditNotes.filter((nc) => {
      return (
        !query ||
        String(nc.numero_nota_credito || '').toLowerCase().includes(query) ||
        String(nc.numero_factura || '').toLowerCase().includes(query) ||
        String(nc.cliente_nombre || '').toLowerCase().includes(query) ||
        String(nc.cliente_identificacion || '').toLowerCase().includes(query)
      );
    });
  }, [creditNotes, searchQuery]);

  const handleCancelNc = async (nc) => {
    const { value: reasonText } = await Swal.fire({
      title: 'Anular nota de credito',
      input: 'textarea',
      inputLabel: `Motivo para anular ${nc.numero_nota_credito}`,
      inputPlaceholder: 'Describe el motivo de anulacion...',
      showCancelButton: true,
      confirmButtonText: 'Anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e55353',
    });
    if (!reasonText) return;

    try {
      const response = await apiFetch(`/api/credit-notes/${nc.id_nota_credito}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reasonText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo anular la nota de credito.');
      showAlert('Nota de credito anulada correctamente.', 'success');
      fetchCreditNotes();
      fetchInvoices();
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  const handleGenerateSriXml = async (nc) => {
    try {
      const response = await apiFetch(`/api/sri/credit-notes/${nc.id_nota_credito}/generate-test-xml`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo generar el XML SRI.');
      await Swal.fire({
        icon: 'success',
        title: 'XML SRI generado',
        html: `<div class="text-start"><strong>Estado:</strong> ${data.estado}<br/><strong>Clave:</strong><br/><small>${data.clave_acceso}</small></div>`,
      });
      fetchCreditNotes();
    } catch (error) {
      Swal.fire('SRI Pruebas', error.message, 'error');
    }
  };

  const handleProcessSri = async (nc) => {
    try {
      const response = await apiFetch(`/api/sri/credit-notes/${nc.id_nota_credito}/process-test`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo procesar la nota de credito en SRI.');
      const messages = (data.mensajes || []).map((msg) => `<li>${msg.mensaje || msg.informacionAdicional || JSON.stringify(msg)}</li>`).join('');
      await Swal.fire({
        icon: data.estado === 'AUTORIZADO' ? 'success' : 'info',
        title: 'SRI Pruebas',
        html: `<div class="text-start"><strong>Estado:</strong> ${data.estado}<br/><strong>Ambiente:</strong> ${data.ambiente}<br/><strong>Clave:</strong><br/><small>${data.clave_acceso}</small>${messages ? `<ul class="mt-2">${messages}</ul>` : ''}</div>`,
      });
      fetchCreditNotes();
    } catch (error) {
      Swal.fire('SRI Pruebas', error.message, 'error');
    }
  };

  const handleEmailSri = async (nc) => {
    try {
      const historyResponse = await apiFetch(`/api/sri/emails/credit-note/${nc.id_nota_credito}`);
      const history = historyResponse.ok ? await historyResponse.json() : [];
      const historyRows = history.length > 0
        ? history.slice(0, 5).map((item) => `
            <tr><td>${new Date(item.created_at).toLocaleString()}</td><td>${item.destinatario}</td><td>${item.estado}</td></tr>
          `).join('')
        : '<tr><td colspan="3">Sin envios previos.</td></tr>';
      const confirm = await Swal.fire({
        title: 'Enviar nota de credito por email',
        html: `
          <div class="text-start">
            <p><strong>Nota:</strong> ${nc.numero_nota_credito}</p>
            <p><strong>Estado SRI:</strong> ${nc.sri_estado || 'PENDIENTE'}</p>
            <table class="table table-sm">
              <thead><tr><th>Fecha</th><th>Destino</th><th>Estado</th></tr></thead>
              <tbody>${historyRows}</tbody>
            </table>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Enviar ahora',
        cancelButtonText: 'Cerrar',
      });
      if (!confirm.isConfirmed) return;
      const response = await apiFetch(`/api/sri/emails/credit-note/${nc.id_nota_credito}/send`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.history?.mensaje_error || 'No se pudo enviar el email.');
      Swal.fire('Email enviado', `Comprobante enviado a ${data.history.destinatario}.`, 'success');
    } catch (error) {
      Swal.fire('Email SRI', error.message, 'error');
    }
  };

  // Totales de la Nota de Crédito en tiempo real
  const totals = useMemo(() => {
    let subtotalSinImpuestos = 0;
    let subtotalConIva = 0;
    let subtotalIvaCero = 0;
    let valorIvaTotal = 0;

    returnItems.forEach((item) => {
      const qty = parseFloat(item.cantidad) || 0;
      if (qty <= 0) return;

      const sub = qty * item.precio_unitario;
      const taxPercent = parseFloat(item.taxPercent) || 0;
      const iva = sub * (taxPercent / 100);

      subtotalSinImpuestos += sub;
      valorIvaTotal += iva;

      if (taxPercent > 0) {
        subtotalConIva += sub;
      } else {
        subtotalIvaCero += sub;
      }
    });

    const total = subtotalSinImpuestos + valorIvaTotal;

    return {
      subtotalSinImpuestos,
      subtotalConIva,
      subtotalIvaCero,
      valorIvaTotal,
      total,
    };
  }, [returnItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedInvoiceId || !reason.trim() || !currentUser) {
      Swal.fire('Error', 'Faltan datos obligatorios para emitir la nota de crédito.', 'error');
      return;
    }

    const itemsToReturn = returnItems
      .filter((item) => parseFloat(item.cantidad) > 0)
      .map((item) => ({
        id_producto: item.id_producto,
        cantidad: parseFloat(item.cantidad),
        precio_unitario: item.precio_unitario,
      }));

    if (itemsToReturn.length === 0) {
      Swal.fire('Error', 'Debe devolver al menos una unidad de algún producto.', 'error');
      return;
    }

    try {
      const response = await apiFetch('/api/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_factura: parseInt(selectedInvoiceId, 10),
          motivo: reason,
          items: itemsToReturn,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Ocurrió un error al emitir la nota de crédito.');

      showAlert('Nota de crédito emitida con éxito.', 'success');
      setShowForm(false);
      setSelectedInvoiceId('');
      setSelectedInvoiceData(null);
      setReturnItems([]);
      setReason('');
      fetchCreditNotes();
      fetchInvoices(); // recargar elegibles
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  };

  return (
    <div className="module-shell">
      {/* Header */}
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>
            Notas de Crédito
          </h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>
            Emite notas de crédito para anular facturas o realizar devoluciones parciales.
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {filteredNcs.length}{' '}
            {filteredNcs.length === 1 ? 'registro' : 'registros'}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Ver listado' : '+ Emitir Nota de Crédito'}
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="invoice-inline-panel client-data-panel">
          <div className="invoice-inline-body">
            <h2>Emitir Nota de Crédito</h2>
            <p className="invoice-inline-copy">
              Selecciona una factura de venta vigente y define las cantidades a devolver.
            </p>
            <div className="invoice-inline-divider"></div>

            <form onSubmit={handleSubmit}>
              <div className="row">
                <div className="col-md-5 mb-3">
                  <label className="form-label fw-bold">Seleccionar Factura de Venta *</label>
                  <select
                    className="form-select"
                    value={selectedInvoiceId}
                    onChange={handleInvoiceChange}
                    required
                  >
                    <option value="">-- Selecciona una factura --</option>
                    {invoices.map((f) => (
                      <option key={f.id_factura} value={f.id_factura}>
                        {f.numero_factura} - {f.cliente_nombre} (${parseFloat(f.total).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-7 mb-3">
                  <label className="form-label fw-bold">Motivo de Emisión *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Ej: Devolución de mercadería defectuosa o error de datos"
                    required
                  />
                </div>
              </div>

              {loadingInvoice && <div className="text-center py-3">Cargando detalles de factura...</div>}

              {selectedInvoiceData && (
                <div className="mb-4">
                  <h5 className="mb-3 text-dark fw-bold">Detalles Elegibles para Devolución</h5>
                  <div className="table-responsive border rounded bg-white p-1">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Código</th>
                          <th>Producto</th>
                          <th className="text-end">Cant. Original</th>
                          <th className="text-end">Precio Unit.</th>
                          <th className="text-end" style={{ width: '130px' }}>Cant. Devuelta</th>
                          <th className="text-end">Total Devolución</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnItems.map((item, index) => {
                          const lineTotal = (parseFloat(item.cantidad) || 0) * item.precio_unitario;

                          return (
                            <tr key={index}>
                              <td>{item.code}</td>
                              <td>{item.name}</td>
                              <td className="text-end">{item.maxQty.toFixed(2)}</td>
                              <td className="text-end">${item.precio_unitario.toFixed(2)}</td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="form-control form-control-sm text-end"
                                  value={item.cantidad}
                                  onChange={(e) => handleItemQtyChange(index, e.target.value)}
                                  min="0"
                                  max={item.maxQty}
                                />
                              </td>
                              <td className="text-end fw-semibold">${lineTotal.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="row g-4 justify-content-end mt-2">
                    <div className="col-md-5">
                      <div className="invoice-total-box bg-light p-3 border">
                        <div className="d-flex justify-content-between mb-2">
                          <span>Subtotal con IVA devuelto:</span>
                          <span>${totals.subtotalConIva.toFixed(2)}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span>Subtotal IVA 0% devuelto:</span>
                          <span>${totals.subtotalIvaCero.toFixed(2)}</span>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span>IVA Devuelto:</span>
                          <span>${totals.valorIvaTotal.toFixed(2)}</span>
                        </div>
                        <hr className="my-2" />
                        <div className="d-flex justify-content-between fw-bold text-success" style={{ fontSize: '1.2rem' }}>
                          <span>TOTAL DEVOLUCIÓN:</span>
                          <span>${totals.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="d-flex justify-content-end gap-2 border-top pt-3">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowForm(false);
                    setSelectedInvoiceId('');
                    setSelectedInvoiceData(null);
                    setReturnItems([]);
                    setReason('');
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={!selectedInvoiceId}>
                  Emitir Nota de Crédito
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar de listado */}
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
                placeholder="Buscar por NC, factura, cliente o cédula..."
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

          {/* Listado */}
          {loading ? (
            <div className="text-center py-4">Cargando notas de crédito...</div>
          ) : filteredNcs.length === 0 ? (
            <p className="module-empty-state">No se encontraron notas de crédito emitidas.</p>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="table-responsive desktop-only">
                <table className="table table-striped table-hover align-middle border">
                  <thead className="table-light">
                    <tr>
                      <th>No. Nota de Crédito</th>
                      <th>Factura Afectada</th>
                      <th>Cliente</th>
                      <th>Fecha Emisión</th>
                      <th className="text-end">Monto Devuelto</th>
                      <th>SRI</th>
                      <th style={{ width: '230px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredNcs.map((nc) => (
                      <tr key={nc.id_nota_credito}>
                        <td style={{ fontWeight: 700 }}>{nc.numero_nota_credito}</td>
                        <td style={{ fontWeight: 700 }}>{nc.numero_factura}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{nc.cliente_nombre}</div>
                          <small className="text-muted">{nc.cliente_identificacion}</small>
                        </td>
                        <td>{new Date(nc.fecha_emision).toLocaleString()}</td>
                        <td className="text-end fw-bold text-success">${parseFloat(nc.total).toFixed(2)}</td>
                        <td>
                          <span className={`badge ${getSriBadgeClass(nc.sri_estado)}`}>
                            {nc.sri_estado || 'PENDIENTE'}
                          </span>
                        </td>
                        <td>
                          <DocumentActionButtons
                            actions={[
                              { label: 'Ver detalle', icon: cilDescription, tone: 'info', onClick: () => handleFetchNcDetail(nc.id_nota_credito) },
                              {
                                label: 'Ver RIDE',
                                icon: cilPrint,
                                tone: 'secondary',
                                onClick: async () => {
                                  try {
                                    const r = await apiFetch(`/api/credit-notes/${nc.id_nota_credito}`);
                                    const d = await r.json();
                                    if (r.ok) setViewRide(d);
                                  } catch { showAlert('Error al cargar RIDE.', 'error'); }
                                },
                              },
                              { label: 'PDF', icon: cilFile, tone: 'primary', onClick: () => openRidePdf('credit-note', nc.id_nota_credito) },
                              { label: 'XML SRI', icon: cilDescription, tone: 'warning', onClick: () => handleGenerateSriXml(nc) },
                              nc.estado !== 'ANULADA' && nc.sri_estado !== 'AUTORIZADO' && { label: 'Procesar SRI', icon: cilCloudUpload, tone: 'success', onClick: () => handleProcessSri(nc) },
                              { label: 'Enviar email', icon: cilEnvelopeClosed, tone: 'secondary', onClick: () => handleEmailSri(nc) },
                              nc.estado !== 'ANULADA' && { label: 'Anular', icon: cilTrash, tone: 'danger', onClick: () => handleCancelNc(nc) },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="client-cards-container mobile-only">
                {filteredNcs.map((nc) => (
                  <div key={nc.id_nota_credito} className="client-mobile-card">
                    <div className="client-card-header">
                      <span className="client-name">{nc.numero_nota_credito}</span>
                      <span className={`badge ${getSriBadgeClass(nc.sri_estado)}`} style={{ fontWeight: 'bold' }}>
                        {nc.sri_estado || 'PENDIENTE'}
                      </span>
                    </div>
                    <div className="client-card-body">
                      <div className="client-card-info-item">
                        <span className="info-label">Factura Afectada:</span>
                        <span className="info-val">{nc.numero_factura}</span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Cliente:</span>
                        <span className="info-val">{nc.cliente_nombre}</span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Monto Devuelto:</span>
                        <span className="info-val text-success"><strong>${parseFloat(nc.total).toFixed(2)}</strong></span>
                      </div>
                    </div>
                    <div className="client-card-actions">
                      <button className="btn btn-info text-white" onClick={() => handleFetchNcDetail(nc.id_nota_credito)}>
                        Ver Detalle
                      </button>
                      <button className="btn btn-warning" onClick={() => handleGenerateSriXml(nc)}>
                        XML SRI
                      </button>
                      {nc.estado !== 'ANULADA' && nc.sri_estado !== 'AUTORIZADO' && (
                        <button className="btn btn-success" onClick={() => handleProcessSri(nc)}>
                          Procesar SRI
                        </button>
                      )}
                      <button className="btn btn-secondary" onClick={() => handleEmailSri(nc)}>
                        Email
                      </button>
                      {nc.estado !== 'ANULADA' && (
                        <button className="btn btn-danger" onClick={() => handleCancelNc(nc)}>
                          Anular
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL DETALLE NOTA DE CREDITO */}
      {selectedNcDetail && (() => {
        const { creditNote, details, company } = selectedNcDetail;
        const issuerName = company?.razon_social || company?.nombre_comercial || 'Empresa no configurada';
        const tradeName = company?.nombre_comercial || issuerName;
        const logoUrl = resolveAssetUrl(company?.logo_url);
        const subtotalNoTax = parseFloat(creditNote.subtotal_con_iva || 0) + parseFloat(creditNote.subtotal_iva_cero || 0);

        return (
          <div className="modal-overlay" onClick={() => setSelectedNcDetail(null)}>
            <div className="modal-container text-dark print-document" style={{ maxWidth: '820px', width: '96%', fontFamily: 'Arial, Helvetica, sans-serif', padding: '1.4rem', borderRadius: '6px', backgroundColor: '#ffffff', boxShadow: '0 20px 40px rgba(0,0,0,0.18)' }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn form-actions-buttons" onClick={() => setSelectedNcDetail(null)} aria-label="Cerrar detalle" style={{ top: '10px', right: '10px' }}>X</button>
              <div className="d-grid gap-2" style={{ gridTemplateColumns: '1fr 1.35fr' }}>
                <div>
                  <div className="border d-flex align-items-center justify-content-center bg-white mb-2" style={{ width: '150px', height: '74px', padding: '6px' }}>{logoUrl ? <img src={logoUrl} alt={tradeName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <div className="fw-bold text-center text-primary" style={{ fontSize: '0.95rem', lineHeight: 1.05 }}>{tradeName}</div>}</div>
                  <div className="border rounded-1 p-2 small" style={{ minHeight: '116px' }}><div className="fw-bold">{issuerName}</div><div><strong>Dir. Matriz:</strong> {company?.direccion_matriz || 'Direccion matriz no configurada'}</div><div><strong>Obligado a llevar contabilidad:</strong> {company?.obligado_contabilidad ? 'SI' : 'NO'}</div>{company?.contribuyente_especial && <div><strong>Agente/Contribuyente especial:</strong> {company.contribuyente_especial}</div>}{company?.regimen && <div><strong>Regimen:</strong> {company.regimen}</div>}</div>
                </div>
                <div className="border rounded-1 p-2 small"><div><strong>RUC:</strong> {company?.ruc || 'RUC no configurado'}</div><div className="fw-bold" style={{ fontSize: '1.05rem' }}>NOTA DE CREDITO No. {creditNote.numero_nota_credito}</div><div><strong>Factura modificada:</strong> {creditNote.numero_factura}</div><div><strong>Fecha emision:</strong> {creditNote.fecha_emision ? new Date(creditNote.fecha_emision).toLocaleString() : 'N/D'}</div><div><strong>Estado:</strong> {creditNote.estado || 'EMITIDA'}</div><div className="fw-bold mt-1">CLAVE DE ACCESO:</div><div className="text-center border-top pt-1 mt-1"><div className="font-monospace" style={{ letterSpacing: '2px', fontSize: '0.7rem' }}>||||| || ||||| ||| |||| |||||| |||</div><div className="font-monospace text-break" style={{ fontSize: '0.66rem' }}>{creditNote.clave_acceso || 'PENDIENTE'}</div></div></div>
              </div>
              <div className="border rounded-1 p-2 small mt-3"><div className="d-grid" style={{ gridTemplateColumns: '1.8fr 1fr 1fr', columnGap: '1rem' }}><div><strong>Cliente:</strong> {creditNote.cliente_nombre}</div><div><strong>RUC/C.I.:</strong> {creditNote.cliente_identificacion}</div><div><strong>Email:</strong> {creditNote.cliente_email || 'S/D'}</div><div><strong>Direccion:</strong> {creditNote.cliente_direccion || 'S/D'}</div><div><strong>Telefono:</strong> {creditNote.cliente_telefono || 'S/D'}</div><div><strong>Motivo:</strong> {creditNote.motivo}</div></div></div>
              <table className="table table-bordered table-sm small align-middle my-2" style={{ borderColor: '#4b5563' }}><thead><tr className="text-center"><th style={{ width: '75px' }}>Codigo</th><th>Detalle del producto</th><th className="text-end">Cant. Devuelta</th><th className="text-end">Precio Unit.</th><th className="text-end">IVA</th><th className="text-end">Total</th></tr></thead><tbody>{details.map((d) => <tr key={d.id_detalle}><td className="font-monospace">{d.producto_codigo}</td><td>{d.producto_nombre}</td><td className="text-end">{qty(d.cantidad)}</td><td className="text-end">{money(d.precio_unitario)}</td><td className="text-end">{money(d.valor_iva)}</td><td className="text-end">{money(parseFloat(d.precio_total || 0) + parseFloat(d.valor_iva || 0))}</td></tr>)}</tbody></table>
              <div className="d-grid gap-2" style={{ gridTemplateColumns: '1fr 1.15fr' }}><div className="border rounded-1 p-2 small"><div className="fw-bold mb-1">Info. Adicional</div><div><strong>Factura modificada:</strong> {creditNote.numero_factura}</div><div><strong>Fecha factura:</strong> {creditNote.factura_fecha ? new Date(creditNote.factura_fecha).toLocaleDateString() : 'N/D'}</div><div><strong>Usuario:</strong> {creditNote.username || 'S/D'}</div></div><div className="border rounded-1 p-2 small"><div className="d-flex justify-content-between"><span>Subtotal IVA 0%:</span><span>{money(creditNote.subtotal_iva_cero)}</span></div><div className="d-flex justify-content-between"><span>Subtotal:</span><span>{money(creditNote.subtotal_con_iva)}</span></div><div className="d-flex justify-content-between"><span>Subtotal sin impuesto:</span><span>{money(subtotalNoTax)}</span></div><div className="d-flex justify-content-between"><span>IVA Devuelto:</span><span>{money(creditNote.valor_iva)}</span></div><div className="d-flex justify-content-between fw-bold text-success border-top pt-1 mt-1"><span>TOTAL DEVOLUCION:</span><span>{money(creditNote.total)}</span></div></div></div>
              {creditNote.estado === 'ANULADA' && <div className="alert alert-danger text-center fw-bold py-2 mt-3 mb-0">DOCUMENTO ANULADO</div>}
              <div className="form-actions-buttons d-flex justify-content-end gap-2 mt-4 pt-3 border-top"><button type="button" className="btn btn-outline-primary" onClick={() => printDocument()}>Imprimir</button><button type="button" className="btn btn-secondary" onClick={() => setSelectedNcDetail(null)}>Cerrar Detalle</button></div>
            </div>
          </div>
        );
      })()}
      {/* RIDE Nota de Crédito */}
      {viewRide && (
        <CreditNoteRideModal
          viewCreditNote={viewRide}
          onClose={() => setViewRide(null)}
        />
      )}
    </div>
  );
}
