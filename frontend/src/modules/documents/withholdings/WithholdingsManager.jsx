import React, { useEffect, useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import { apiFetch, apiUrl } from '../../../lib/api';
import { printDocument } from '../../../lib/printDocument';
import { openRidePdf } from '../../../lib/rides';
import WithholdingRideModal from './WithholdingRideModal';

const money = (value) => (parseFloat(value || 0) || 0).toFixed(2);

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

export default function WithholdingsManager() {
  const [withholdings, setWithholdings] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Filtros de búsqueda
  const [searchQuery, setSearchQuery] = useState('');

  // Detalle de Retención
  const [selectedRetDetail, setSelectedRetDetail] = useState(null);
  // RIDE de Retención
  const [viewRide, setViewRide] = useState(null);

  // Formulario de emisión
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [selectedPurchaseData, setSelectedPurchaseData] = useState(null);
  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [withholdingRows, setWithholdingRows] = useState([
    { impuesto: 'RENTA', codigo_sri: '312', porcentaje: 1.75, base_imponible: 0, valor_retenido: 0 },
  ]);

  useEffect(() => {
    fetchWithholdings();
    fetchPurchases();
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const fetchWithholdings = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/withholdings');
      if (!response.ok) throw new Error('Error al consultar los comprobantes de retención.');
      const result = await response.json();
      setWithholdings(Array.isArray(result) ? result : (result.data || []));
    } catch (error) {
      console.error(error);
      showAlert('No se pudieron cargar las retenciones.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    try {
      const response = await apiFetch('/api/purchases');
      if (response.ok) {
        const data = await response.json();
        // Filtramos para retener solo compras registradas
        setPurchases(data.filter((p) => p.estado === 'REGISTRADA'));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchPurchaseDetails = async (id) => {
    setLoadingPurchase(true);
    try {
      const response = await apiFetch(`/api/purchases/${id}`);
      if (!response.ok) throw new Error('No se pudo cargar el detalle de la compra.');
      const data = await response.json();
      setSelectedPurchaseData(data);

      // Pre-cargar primera línea de retención con el subtotal de la compra como base imponible
      const subtotalTotal = parseFloat(data.purchase.subtotal_con_iva) + parseFloat(data.purchase.subtotal_iva_cero);
      setWithholdingRows([
        { impuesto: 'RENTA', codigo_sri: '312', porcentaje: 1.75, base_imponible: subtotalTotal, valor_retenido: subtotalTotal * 0.0175 },
      ]);
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
      setSelectedPurchaseId('');
      setSelectedPurchaseData(null);
    } finally {
      setLoadingPurchase(false);
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

  const handlePurchaseChange = (e) => {
    const val = e.target.value;
    setSelectedPurchaseId(val);
    if (val) {
      fetchPurchaseDetails(val);
    } else {
      setSelectedPurchaseData(null);
      setWithholdingRows([]);
    }
  };

  const handleRowChange = (index, field, value) => {
    const nextRows = [...withholdingRows];
    nextRows[index][field] = value;

    // Recalcular valor retenido automáticamente
    if (field === 'base_imponible' || field === 'porcentaje') {
      const base = parseFloat(nextRows[index].base_imponible) || 0;
      const pct = parseFloat(nextRows[index].porcentaje) || 0;
      nextRows[index].valor_retenido = base * (pct / 100);
    }

    // Configurar valores SRI por defecto si cambia impuesto
    if (field === 'impuesto') {
      if (value === 'RENTA') {
        nextRows[index].codigo_sri = '312';
        nextRows[index].porcentaje = 1.75;
      } else {
        nextRows[index].codigo_sri = '725'; // retencion 30% IVA
        nextRows[index].porcentaje = 30.00;
      }
      const base = parseFloat(nextRows[index].base_imponible) || 0;
      const pct = parseFloat(nextRows[index].porcentaje) || 0;
      nextRows[index].valor_retenido = base * (pct / 100);
    }

    setWithholdingRows(nextRows);
  };

  const handleAddRow = () => {
    const subtotalTotal = selectedPurchaseData
      ? parseFloat(selectedPurchaseData.purchase.subtotal_con_iva) + parseFloat(selectedPurchaseData.purchase.subtotal_iva_cero)
      : 0;

    setWithholdingRows((current) => [
      ...current,
      { impuesto: 'RENTA', codigo_sri: '312', porcentaje: 1.75, base_imponible: subtotalTotal, valor_retenido: subtotalTotal * 0.0175 },
    ]);
  };

  const handleRemoveRow = (index) => {
    setWithholdingRows((current) =>
      current.length === 1
        ? [{ impuesto: 'RENTA', codigo_sri: '312', porcentaje: 1.75, base_imponible: 0, valor_retenido: 0 }]
        : current.filter((_, idx) => idx !== index)
    );
  };

  const handleFetchRetDetail = async (id) => {
    try {
      const response = await apiFetch(`/api/withholdings/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedRetDetail(data);
      } else {
        showAlert('No se pudo obtener el detalle de la retención.', 'error');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleCancelWithholding = async (withholding) => {
    const { value: reason } = await Swal.fire({
      title: 'Anular retencion',
      input: 'textarea',
      inputLabel: `Motivo para anular ${withholding.numero_retencion}`,
      inputPlaceholder: 'Describe el motivo de anulacion...',
      showCancelButton: true,
      confirmButtonText: 'Anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e55353',
    });
    if (!reason) return;

    try {
      const response = await apiFetch(`/api/withholdings/${withholding.id_retencion}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo anular la retencion.');
      showAlert('Retencion anulada correctamente.', 'success');
      fetchWithholdings();
      fetchPurchases();
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  const handleGenerateSriXml = async (withholding) => {
    try {
      const response = await apiFetch(`/api/sri/withholdings/${withholding.id_retencion}/generate-test-xml`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo generar el XML SRI.');
      await Swal.fire({
        icon: 'success',
        title: 'XML SRI generado',
        html: `<div class="text-start"><strong>Estado:</strong> ${data.estado}<br/><strong>Clave:</strong><br/><small>${data.clave_acceso}</small></div>`,
      });
      fetchWithholdings();
    } catch (error) {
      Swal.fire('SRI Pruebas', error.message, 'error');
    }
  };

  const handleProcessSri = async (withholding) => {
    try {
      const response = await apiFetch(`/api/sri/withholdings/${withholding.id_retencion}/process-test`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo procesar la retencion en SRI.');
      const messages = (data.mensajes || []).map((msg) => `<li>${msg.mensaje || msg.informacionAdicional || JSON.stringify(msg)}</li>`).join('');
      await Swal.fire({
        icon: data.estado === 'AUTORIZADO' ? 'success' : 'info',
        title: 'SRI Pruebas',
        html: `<div class="text-start"><strong>Estado:</strong> ${data.estado}<br/><strong>Ambiente:</strong> ${data.ambiente}<br/><strong>Clave:</strong><br/><small>${data.clave_acceso}</small>${messages ? `<ul class="mt-2">${messages}</ul>` : ''}</div>`,
      });
      fetchWithholdings();
    } catch (error) {
      Swal.fire('SRI Pruebas', error.message, 'error');
    }
  };

  const handleEmailSri = async (withholding) => {
    try {
      const historyResponse = await apiFetch(`/api/sri/emails/withholding/${withholding.id_retencion}`);
      const history = historyResponse.ok ? await historyResponse.json() : [];
      const historyRows = history.length > 0
        ? history.slice(0, 5).map((item) => `
            <tr><td>${new Date(item.created_at).toLocaleString()}</td><td>${item.destinatario}</td><td>${item.estado}</td></tr>
          `).join('')
        : '<tr><td colspan="3">Sin envios previos.</td></tr>';
      const confirm = await Swal.fire({
        title: 'Enviar retencion por email',
        html: `
          <div class="text-start">
            <p><strong>Retencion:</strong> ${withholding.numero_retencion}</p>
            <p><strong>Estado SRI:</strong> ${withholding.sri_estado || 'PENDIENTE'}</p>
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
      const response = await apiFetch(`/api/sri/emails/withholding/${withholding.id_retencion}/send`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.history?.mensaje_error || 'No se pudo enviar el email.');
      Swal.fire('Email enviado', `Comprobante enviado a ${data.history.destinatario}.`, 'success');
    } catch (error) {
      Swal.fire('Email SRI', error.message, 'error');
    }
  };

  const filteredWithholdings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return withholdings.filter((w) => {
      return (
        !query ||
        String(w.numero_retencion || '').toLowerCase().includes(query) ||
        String(w.numero_factura_compra || '').toLowerCase().includes(query) ||
        String(w.proveedor_nombre || '').toLowerCase().includes(query) ||
        String(w.proveedor_identificacion || '').toLowerCase().includes(query)
      );
    });
  }, [withholdings, searchQuery]);

  const totalWithheld = useMemo(() => {
    return withholdingRows.reduce((sum, r) => sum + (parseFloat(r.valor_retenido) || 0), 0);
  }, [withholdingRows]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedPurchaseId || withholdingRows.length === 0 || !currentUser) {
      Swal.fire('Error', 'Faltan datos obligatorios para emitir la retención.', 'error');
      return;
    }

    const hasInvalid = withholdingRows.some(
      (r) => parseFloat(r.base_imponible) < 0 || parseFloat(r.porcentaje) < 0 || parseFloat(r.valor_retenido) < 0
    );
    if (hasInvalid) {
      Swal.fire('Error', 'Las bases y porcentajes de retención deben ser valores válidos.', 'error');
      return;
    }

    try {
      const response = await apiFetch('/api/withholdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_compra: parseInt(selectedPurchaseId, 10),
          details: withholdingRows,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Ocurrió un error al emitir la retención.');

      showAlert('Comprobante de retención emitido con éxito.', 'success');
      setShowForm(false);
      setSelectedPurchaseId('');
      setSelectedPurchaseData(null);
      setWithholdingRows([]);
      fetchWithholdings();
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
            Retenciones
          </h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>
            Emite y administra comprobantes de retención del IVA y Renta para compras.
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {filteredWithholdings.length}{' '}
            {filteredWithholdings.length === 1 ? 'registro' : 'registros'}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Ver listado' : '+ Emitir Retención'}
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="invoice-inline-panel client-data-panel">
          <div className="invoice-inline-body">
            <h2>Emitir Comprobante de Retención</h2>
            <p className="invoice-inline-copy">
              Selecciona una factura de compra a la que aplicarás retenciones tributarias.
            </p>
            <div className="invoice-inline-divider"></div>

            <form onSubmit={handleSubmit}>
              <div className="row mb-3">
                <div className="col-md-6">
                  <label className="form-label fw-bold">Seleccionar Factura de Compra *</label>
                  <select
                    className="form-select"
                    value={selectedPurchaseId}
                    onChange={handlePurchaseChange}
                    required
                  >
                    <option value="">-- Selecciona una compra --</option>
                    {purchases.map((p) => (
                      <option key={p.id_compra} value={p.id_compra}>
                        {p.numero_factura_compra} - {p.proveedor_nombre} (${parseFloat(p.total).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {loadingPurchase && <div className="text-center py-3">Cargando detalles de la compra...</div>}

              {selectedPurchaseData && (
                <div className="mb-4">
                  <div className="row small p-3 bg-light rounded border mb-3">
                    <div className="col-md-6">
                      <strong>Proveedor:</strong> {selectedPurchaseData.purchase.proveedor_nombre}<br />
                      <strong>RUC:</strong> {selectedPurchaseData.purchase.proveedor_identificacion}
                    </div>
                    <div className="col-md-6">
                      <strong>Subtotal con IVA:</strong> ${parseFloat(selectedPurchaseData.purchase.subtotal_con_iva).toFixed(2)}<br />
                      <strong>Subtotal IVA 0%:</strong> ${parseFloat(selectedPurchaseData.purchase.subtotal_iva_cero).toFixed(2)}
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h5 className="text-dark fw-bold mb-0">Líneas de Retención</h5>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleAddRow}>
                      + Agregar Retención
                    </button>
                  </div>

                  <div className="table-responsive border rounded bg-white p-1">
                    <table className="table table-sm align-middle mb-0" style={{ minWidth: '700px' }}>
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '130px' }}>Impuesto</th>
                          <th style={{ width: '120px' }}>Código SRI</th>
                          <th style={{ width: '120px' }}>Porcentaje %</th>
                          <th>Base Imponible ($)</th>
                          <th>Valor Retenido ($)</th>
                          <th style={{ width: '45px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {withholdingRows.map((row, index) => (
                          <tr key={index}>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={row.impuesto}
                                onChange={(e) => handleRowChange(index, 'impuesto', e.target.value)}
                              >
                                <option value="RENTA">Renta</option>
                                <option value="IVA">IVA</option>
                              </select>
                            </td>
                            <td>
                              <select
                                className="form-select form-select-sm"
                                value={row.codigo_sri}
                                onChange={(e) => handleRowChange(index, 'codigo_sri', e.target.value)}
                              >
                                {row.impuesto === 'RENTA' ? (
                                  <>
                                    <option value="312">312 (Servicios)</option>
                                    <option value="343">343 (Bienes)</option>
                                    <option value="332">332 (Profesionales)</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="725">725 (30% IVA - Bienes)</option>
                                    <option value="729">729 (70% IVA - Servs)</option>
                                    <option value="732">732 (100% IVA)</option>
                                  </>
                                )}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                className="form-control form-control-sm text-end"
                                value={row.porcentaje}
                                onChange={(e) => handleRowChange(index, 'porcentaje', e.target.value)}
                                min="0"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                className="form-control form-control-sm text-end"
                                value={row.base_imponible}
                                onChange={(e) => handleRowChange(index, 'base_imponible', e.target.value)}
                                min="0"
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control form-control-sm text-end fw-bold"
                                value={'$' + parseFloat(row.valor_retenido || 0).toFixed(2)}
                                readOnly
                                disabled
                              />
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => handleRemoveRow(index)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex justify-content-end mt-3">
                    <div className="card bg-light p-2 border fw-bold text-success" style={{ fontSize: '1.1rem' }}>
                      Total Retenido: ${totalWithheld.toFixed(2)}
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
                    setSelectedPurchaseId('');
                    setSelectedPurchaseData(null);
                    setWithholdingRows([]);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={!selectedPurchaseId}>
                  Emitir Retención
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
                placeholder="Buscar por retención, compra, proveedor o RUC..."
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
            <div className="text-center py-4">Cargando retenciones...</div>
          ) : filteredWithholdings.length === 0 ? (
            <p className="module-empty-state">No se encontraron retenciones emitidas.</p>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="table-responsive desktop-only">
                <table className="table table-striped table-hover align-middle border">
                  <thead className="table-light">
                    <tr>
                      <th>No. Retención</th>
                      <th>Factura Compra</th>
                      <th>Proveedor</th>
                      <th>Fecha Emisión</th>
                      <th>SRI</th>
                      <th style={{ width: '260px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWithholdings.map((w) => (
                      <tr key={w.id_retencion}>
                        <td style={{ fontWeight: 700 }}>{w.numero_retencion}</td>
                        <td style={{ fontWeight: 700 }}>{w.numero_factura_compra}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{w.proveedor_nombre}</div>
                          <small className="text-muted">{w.proveedor_identificacion}</small>
                        </td>
                        <td>{new Date(w.fecha_emision).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${getSriBadgeClass(w.sri_estado)}`}>
                            {w.sri_estado || 'PENDIENTE'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-info text-white"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleFetchRetDetail(w.id_retencion)}
                          >
                            Ver Detalle
                          </button>
                          <button
                            className="btn btn-secondary ms-1"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={async () => {
                              try {
                                const r = await apiFetch(`/api/withholdings/${w.id_retencion}`);
                                const d = await r.json();
                                if (r.ok) setViewRide(d);
                              } catch { showAlert('Error al cargar RIDE.', 'error'); }
                            }}
                          >
                            RIDE
                          </button>
                          <button
                            className="btn btn-outline-primary ms-1"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => openRidePdf('withholding', w.id_retencion)}
                          >
                            PDF
                          </button>
                          <button
                            className="btn btn-warning ms-1"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleGenerateSriXml(w)}
                          >
                            XML SRI
                          </button>
                          {w.estado !== 'ANULADA' && w.sri_estado !== 'AUTORIZADO' && (
                            <button
                              className="btn btn-success ms-1"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleProcessSri(w)}
                            >
                              Procesar SRI
                            </button>
                          )}
                          <button
                            className="btn btn-secondary ms-1"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleEmailSri(w)}
                          >
                            Email
                          </button>
                          {w.estado !== 'ANULADA' && (
                            <button
                              className="btn btn-danger ms-1"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleCancelWithholding(w)}
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
                {filteredWithholdings.map((w) => (
                  <div key={w.id_retencion} className="client-mobile-card">
                    <div className="client-card-header">
                      <span className="client-name">{w.numero_retencion}</span>
                      <span className={`badge ${getSriBadgeClass(w.sri_estado)}`} style={{ fontWeight: 'bold' }}>
                        {w.sri_estado || 'PENDIENTE'}
                      </span>
                    </div>
                    <div className="client-card-body">
                      <div className="client-card-info-item">
                        <span className="info-label">Factura Compra:</span>
                        <span className="info-val">{w.numero_factura_compra}</span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Proveedor:</span>
                        <span className="info-val">{w.proveedor_nombre}</span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Fecha:</span>
                        <span className="info-val">{new Date(w.fecha_emision).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="client-card-actions">
                      <button className="btn btn-info text-white" onClick={() => handleFetchRetDetail(w.id_retencion)}>
                        Ver Detalle
                      </button>
                      <button className="btn btn-warning" onClick={() => handleGenerateSriXml(w)}>
                        XML SRI
                      </button>
                      {w.estado !== 'ANULADA' && w.sri_estado !== 'AUTORIZADO' && (
                        <button className="btn btn-success" onClick={() => handleProcessSri(w)}>
                          Procesar SRI
                        </button>
                      )}
                      <button className="btn btn-secondary" onClick={() => handleEmailSri(w)}>
                        Email
                      </button>
                      {w.estado !== 'ANULADA' && (
                        <button className="btn btn-danger" onClick={() => handleCancelWithholding(w)}>
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

      {/* MODAL DETALLE RETENCION */}
      {selectedRetDetail && (() => {
        const { withholding, details, company } = selectedRetDetail;
        const issuerName = company?.razon_social || company?.nombre_comercial || 'Empresa no configurada';
        const tradeName = company?.nombre_comercial || issuerName;
        const logoUrl = resolveAssetUrl(company?.logo_url);
        const totalRetenido = details.reduce((sum, r) => sum + parseFloat(r.valor_retenido || 0), 0);

        return (
          <div className="modal-overlay" onClick={() => setSelectedRetDetail(null)}>
            <div className="modal-container text-dark print-document" style={{ maxWidth: '820px', width: '96%', fontFamily: 'Arial, Helvetica, sans-serif', padding: '1.4rem', borderRadius: '6px', backgroundColor: '#ffffff', boxShadow: '0 20px 40px rgba(0,0,0,0.18)' }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn form-actions-buttons" onClick={() => setSelectedRetDetail(null)} aria-label="Cerrar detalle" style={{ top: '10px', right: '10px' }}>X</button>
              <div className="d-grid gap-2" style={{ gridTemplateColumns: '1fr 1.35fr' }}><div><div className="border d-flex align-items-center justify-content-center bg-white mb-2" style={{ width: '150px', height: '74px', padding: '6px' }}>{logoUrl ? <img src={logoUrl} alt={tradeName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <div className="fw-bold text-center text-primary" style={{ fontSize: '0.95rem', lineHeight: 1.05 }}>{tradeName}</div>}</div><div className="border rounded-1 p-2 small" style={{ minHeight: '116px' }}><div className="fw-bold">{issuerName}</div><div><strong>Dir. Matriz:</strong> {company?.direccion_matriz || 'Direccion matriz no configurada'}</div><div><strong>Obligado a llevar contabilidad:</strong> {company?.obligado_contabilidad ? 'SI' : 'NO'}</div>{company?.contribuyente_especial && <div><strong>Agente/Contribuyente especial:</strong> {company.contribuyente_especial}</div>}{company?.regimen && <div><strong>Regimen:</strong> {company.regimen}</div>}</div></div><div className="border rounded-1 p-2 small"><div><strong>RUC:</strong> {company?.ruc || 'RUC no configurado'}</div><div className="fw-bold" style={{ fontSize: '1.05rem' }}>COMPROBANTE DE RETENCION No. {withholding.numero_retencion}</div><div><strong>Factura compra:</strong> {withholding.numero_factura_compra}</div><div><strong>Fecha emision:</strong> {withholding.fecha_emision ? new Date(withholding.fecha_emision).toLocaleString() : 'N/D'}</div><div><strong>Estado:</strong> {withholding.estado || 'EMITIDA'}</div><div className="fw-bold mt-1">CLAVE DE ACCESO:</div><div className="text-center border-top pt-1 mt-1"><div className="font-monospace" style={{ letterSpacing: '2px', fontSize: '0.7rem' }}>||||| || ||||| ||| |||| |||||| |||</div><div className="font-monospace text-break" style={{ fontSize: '0.66rem' }}>{withholding.clave_acceso || 'PENDIENTE'}</div></div></div></div>
              <div className="border rounded-1 p-2 small mt-3"><div className="d-grid" style={{ gridTemplateColumns: '1.8fr 1fr 1fr', columnGap: '1rem' }}><div><strong>Sujeto retenido:</strong> {withholding.proveedor_nombre}</div><div><strong>RUC/C.I.:</strong> {withholding.proveedor_identificacion}</div><div><strong>Email:</strong> {withholding.proveedor_email || 'S/D'}</div><div><strong>Direccion:</strong> {withholding.proveedor_direccion || 'S/D'}</div><div><strong>Telefono:</strong> {withholding.proveedor_telefono || 'S/D'}</div><div><strong>Usuario:</strong> {withholding.username || 'S/D'}</div></div></div>
              <table className="table table-bordered table-sm small align-middle my-2" style={{ borderColor: '#4b5563' }}><thead><tr className="text-center"><th>Impuesto</th><th>Codigo SRI</th><th className="text-end">Porcentaje</th><th className="text-end">Base Imponible</th><th className="text-end">Valor Retenido</th></tr></thead><tbody>{details.map((d) => <tr key={d.id_detalle}><td>{d.impuesto}</td><td className="font-monospace">{d.codigo_sri}</td><td className="text-end">{money(d.porcentaje)}%</td><td className="text-end">{money(d.base_imponible)}</td><td className="text-end fw-bold text-success">{money(d.valor_retenido)}</td></tr>)}</tbody></table>
              <div className="d-grid gap-2" style={{ gridTemplateColumns: '1fr 1.15fr' }}><div className="border rounded-1 p-2 small"><div className="fw-bold mb-1">Info. Adicional</div><div><strong>Factura compra afectada:</strong> {withholding.numero_factura_compra}</div><div><strong>Fecha compra:</strong> {withholding.fecha_compra ? new Date(withholding.fecha_compra).toLocaleDateString() : 'N/D'}</div></div><div className="border rounded-1 p-2 small"><div className="d-flex justify-content-between fw-bold text-success border-top pt-1 mt-1"><span>TOTAL RETENIDO:</span><span>{money(totalRetenido)}</span></div></div></div>
              {withholding.estado === 'ANULADA' && <div className="alert alert-danger text-center fw-bold py-2 mt-3 mb-0">DOCUMENTO ANULADO</div>}
              <div className="form-actions-buttons d-flex justify-content-end gap-2 mt-4 pt-3 border-top"><button type="button" className="btn btn-outline-primary" onClick={() => printDocument()}>Imprimir</button><button type="button" className="btn btn-secondary" onClick={() => setSelectedRetDetail(null)}>Cerrar Detalle</button></div>
            </div>
          </div>
        );
      })()}
      {/* RIDE Retención */}
      {viewRide && (
        <WithholdingRideModal
          viewWithholding={viewRide}
          onClose={() => setViewRide(null)}
        />
      )}
    </div>
  );
}
