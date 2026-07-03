import React, { useEffect, useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';
import { printDocument } from '../../../lib/printDocument';

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
      const data = await response.json();
      setCreditNotes(data);
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
        body: JSON.stringify({ id_usuario: currentUser?.id_usuario, reason: reasonText }),
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
          id_usuario: currentUser.id_usuario,
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
                      <th style={{ width: '130px' }}>Acciones</th>
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
                          <button
                            className="btn btn-info text-white"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleFetchNcDetail(nc.id_nota_credito)}
                          >
                            Ver Detalle
                          </button>
                          {nc.estado !== 'ANULADA' && (
                            <button
                              className="btn btn-danger ms-1"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleCancelNc(nc)}
                            >
                              Anular
                            </button>
                          )}
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
                      <span className="badge bg-success" style={{ fontWeight: 'bold' }}>
                        EMITIDA
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

      {/* MODAL DETALLE NOTA DE CRÉDITO */}
      {selectedNcDetail && (
        <div className="modal-overlay" onClick={() => setSelectedNcDetail(null)}>
          <div
            className="modal-container text-dark print-document"
            style={{ maxWidth: '800px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={() => setSelectedNcDetail(null)}
              aria-label="Cerrar detalle"
            >
              X
            </button>
            <h2 className="fw-bold text-center mb-3">Detalle de Nota de Crédito</h2>
            <div style={{ borderTop: '2px dashed #ccc', margin: '0.75rem 0' }}></div>

            <div className="row small mb-3">
              <div className="col-md-6">
                <div><strong>CLIENTE:</strong> {selectedNcDetail.creditNote.cliente_nombre}</div>
                <div><strong>RUC/Cédula:</strong> {selectedNcDetail.creditNote.cliente_identificacion}</div>
                <div><strong>Email:</strong> {selectedNcDetail.creditNote.cliente_email}</div>
                <div><strong>Dirección:</strong> {selectedNcDetail.creditNote.cliente_direccion || 'S/D'}</div>
              </div>
              <div className="col-md-6">
                <div><strong>Nota de Crédito:</strong> {selectedNcDetail.creditNote.numero_nota_credito}</div>
                <div><strong>Factura Modificada:</strong> {selectedNcDetail.creditNote.numero_factura}</div>
                <div><strong>Fecha Emisión:</strong> {new Date(selectedNcDetail.creditNote.fecha_emision).toLocaleString()}</div>
                <div><strong>Clave Acceso SRI:</strong> <br /> <span className="small text-muted">{selectedNcDetail.creditNote.clave_acceso}</span></div>
              </div>
            </div>

            <div className="p-2 bg-light rounded small mb-3">
              <strong>Motivo de Modificación:</strong> {selectedNcDetail.creditNote.motivo}
            </div>

            <table className="table table-sm table-striped small">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción Producto</th>
                  <th className="text-end">Cantidad Devuelta</th>
                  <th className="text-end">Precio Unitario</th>
                  <th className="text-end">IVA</th>
                  <th className="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedNcDetail.details.map((d) => (
                  <tr key={d.id_detalle}>
                    <td>{d.producto_codigo}</td>
                    <td>{d.producto_nombre}</td>
                    <td className="text-end">{parseFloat(d.cantidad).toFixed(2)}</td>
                    <td className="text-end">${parseFloat(d.precio_unitario).toFixed(2)}</td>
                    <td className="text-end">${parseFloat(d.valor_iva).toFixed(2)}</td>
                    <td className="text-end">${parseFloat(d.precio_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="row justify-content-end mt-3">
              <div className="col-md-5 small">
                <div className="d-flex justify-content-between">
                  <span>Subtotal IVA 0%:</span>
                  <span>${parseFloat(selectedNcDetail.creditNote.subtotal_iva_cero).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Subtotal con IVA:</span>
                  <span>${parseFloat(selectedNcDetail.creditNote.subtotal_con_iva).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>IVA Devuelto:</span>
                  <span>${parseFloat(selectedNcDetail.creditNote.valor_iva).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between fw-bold text-success border-top pt-1 mt-1">
                  <span>Total Neto:</span>
                  <span>${parseFloat(selectedNcDetail.creditNote.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => printDocument()}
              >
                Imprimir
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedNcDetail(null)}
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
