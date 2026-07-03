import React, { useEffect, useState, useMemo } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';
import ProductSearchInput from '../../../shared/ProductSearchInput';

export default function PurchaseManager() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Filtros de búsqueda
  const [searchQuery, setSearchQuery] = useState('');

  // Detalle de compra
  const [selectedPurchaseDetail, setSelectedPurchaseDetail] = useState(null);

  // Formulario de Registro
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([
    { id_producto: '', cantidad: 1, costo_unitario: 0, iva_porcentaje: 0 },
  ]);
  const [productId, setProductId] = useState('');

  useEffect(() => {
    fetchPurchases();
    fetchMetadata();
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/purchases');
      if (!response.ok) throw new Error('Error al conectar con la base de datos.');
      const data = await response.json();
      setPurchases(data);
    } catch (error) {
      console.error(error);
      showAlert('No se pudieron cargar las compras.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [suppRes, prodRes] = await Promise.all([
        apiFetch('/api/suppliers'),
        apiFetch('/api/products'),
      ]);

      if (suppRes.ok) {
        const data = await suppRes.json();
        setSuppliers(data.filter((s) => s.activo));
        if (data.length > 0) {
          setSelectedSupplier(String(data[0].id_proveedor));
        }
      }

      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.filter((p) => p.activo));
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

  const filteredPurchases = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return purchases.filter((p) => {
      return (
        !query ||
        String(p.numero_factura_compra || '').toLowerCase().includes(query) ||
        String(p.proveedor_nombre || '').toLowerCase().includes(query) ||
        String(p.proveedor_identificacion || '').toLowerCase().includes(query)
      );
    });
  }, [purchases, searchQuery]);

  const handleCancelPurchase = async (purchase) => {
    const { value: reason } = await Swal.fire({
      title: 'Anular compra',
      input: 'textarea',
      inputLabel: `Motivo para anular ${purchase.numero_factura_compra}`,
      inputPlaceholder: 'Describe el motivo de anulacion...',
      showCancelButton: true,
      confirmButtonText: 'Anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e55353',
    });
    if (!reason) return;

    try {
      const response = await apiFetch(`/api/purchases/${purchase.id_compra}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario: currentUser?.id_usuario, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo anular la compra.');
      showAlert('Compra anulada correctamente.', 'success');
      fetchPurchases();
      fetchMetadata();
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  // Totales de la compra en tiempo real
  const totals = useMemo(() => {
    let subtotalSinImpuestos = 0;
    let subtotalConIva = 0;
    let subtotalIvaCero = 0;
    let valorIvaTotal = 0;

    purchaseItems.forEach((item) => {
      if (!item.id_producto) return;
      const qty = parseFloat(item.cantidad) || 0;
      const cost = parseFloat(item.costo_unitario) || 0;
      const sub = qty * cost;
      const taxPercent = parseFloat(item.iva_porcentaje) || 0;
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
  }, [purchaseItems]);

  const handleFetchPurchaseDetail = async (id) => {
    try {
      const response = await apiFetch(`/api/purchases/${id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedPurchaseDetail(data);
      } else {
        showAlert('No se pudo obtener el detalle de la compra.', 'error');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const applyProductToItem = (item, selectedProdId) => {
    const prod = products.find((p) => String(p.id_producto) === String(selectedProdId));
    if (!prod) return { id_producto: '', cantidad: 1, costo_unitario: 0, iva_porcentaje: 0 };
    return {
      id_producto: String(prod.id_producto),
      cantidad: item.cantidad || 1,
      costo_unitario: parseFloat(prod.precio_compra) || 0,
      iva_porcentaje: parseFloat(prod.impuesto_porcentaje) || 0,
      code: prod.codigo,
      name: prod.nombre,
    };
  };

  const handleProductSearchSelect = (selectedProdId) => {
    if (!selectedProdId) {
      setProductId('');
      return;
    }

    const alreadyAdded = purchaseItems.some((item) => String(item.id_producto) === String(selectedProdId));
    if (alreadyAdded) {
      Swal.fire('Información', 'El producto ya está en la lista de compra.', 'info');
      setProductId('');
      return;
    }

    const emptyIndex = purchaseItems.findIndex((item) => !item.id_producto);
    if (emptyIndex >= 0) {
      const nextItems = [...purchaseItems];
      nextItems[emptyIndex] = applyProductToItem({ ...nextItems[emptyIndex], cantidad: 1 }, selectedProdId);
      setPurchaseItems(nextItems);
    } else {
      setPurchaseItems((current) => [
        ...current,
        applyProductToItem({ cantidad: 1 }, selectedProdId),
      ]);
    }
    setProductId('');
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...purchaseItems];
    newItems[index][field] = value;
    setPurchaseItems(newItems);
  };

  const handleRemoveItemRow = (index) => {
    if (purchaseItems.length === 1) {
      setPurchaseItems([{ id_producto: '', cantidad: 1, costo_unitario: 0, iva_porcentaje: 0 }]);
      return;
    }
    const newItems = [...purchaseItems];
    newItems.splice(index, 1);
    setPurchaseItems(newItems);
  };

  const handleRegisterPurchase = async (e) => {
    e.preventDefault();

    if (!selectedSupplier || !currentUser) {
      Swal.fire('Error', 'Falta seleccionar proveedor u operador.', 'error');
      return;
    }

    const validItems = purchaseItems.filter((item) => item.id_producto);
    if (validItems.length === 0) {
      Swal.fire('Error', 'Debe agregar al menos un producto a la compra.', 'error');
      return;
    }

    const hasInvalid = validItems.some(
      (item) => parseFloat(item.cantidad) <= 0 || parseFloat(item.costo_unitario) < 0
    );
    if (hasInvalid) {
      Swal.fire('Error', 'Todos los renglones deben tener costos y cantidades válidos.', 'error');
      return;
    }

    const payload = {
      numero_factura_compra: invoiceNumber,
      id_proveedor: parseInt(selectedSupplier, 10),
      id_usuario: currentUser.id_usuario,
      subtotal_iva_cero: totals.subtotalIvaCero,
      subtotal_con_iva: totals.subtotalConIva,
      descuento_total: 0,
      valor_iva: totals.valorIvaTotal,
      total: totals.total,
      observacion: notes,
      items: validItems.map((item) => ({
        id_producto: parseInt(item.id_producto, 10),
        cantidad: parseFloat(item.cantidad),
        costo_unitario: parseFloat(item.costo_unitario),
        precio_total: parseFloat(item.cantidad) * parseFloat(item.costo_unitario),
        valor_iva: parseFloat(item.cantidad) * parseFloat(item.costo_unitario) * (parseFloat(item.iva_porcentaje) / 100),
      })),
    };

    try {
      const response = await apiFetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Ocurrió un error al guardar la compra.');

      showAlert('Compra registrada exitosamente.', 'success');
      setShowForm(false);
      setInvoiceNumber('');
      setNotes('');
      setPurchaseItems([{ id_producto: '', cantidad: 1, costo_unitario: 0, iva_porcentaje: 0 }]);
      fetchPurchases();
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
  };

  return (
    <div className="module-shell">
      {/* Header */}
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>
            Compras
          </h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>
            Registra facturas de compra y reabastece el inventario.
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {filteredPurchases.length}{' '}
            {filteredPurchases.length === 1 ? 'registro' : 'registros'}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Ver listado' : '+ Registrar Compra'}
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="invoice-inline-panel client-data-panel">
          <div className="invoice-inline-body">
            <h2>Registrar Factura de Compra</h2>
            <p className="invoice-inline-copy">
              Ingresa los datos de la factura provista por tu proveedor de mercadería.
            </p>
            <div className="invoice-inline-divider"></div>

            <form onSubmit={handleRegisterPurchase}>
              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label fw-bold">Proveedor *</label>
                  <select
                    className="form-select"
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    required
                  >
                    {suppliers.map((supp) => (
                      <option key={supp.id_proveedor} value={supp.id_proveedor}>
                        {supp.nombre} ({supp.identificacion})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label fw-bold">No. Factura Proveedor *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Ej: 001-002-000034871"
                    required
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label fw-bold">Fecha de Compra *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">Observación / Notas</label>
                <textarea
                  className="form-control"
                  style={{ height: '50px', minHeight: '50px' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles sobre el despacho o pago de la compra..."
                />
              </div>

              {/* Detalle de Productos */}
              <div className="mb-3">
                <label className="form-label fw-bold">Buscar producto a ingresar *</label>
                <ProductSearchInput
                  products={products}
                  value={productId}
                  onChange={handleProductSearchSelect}
                  placeholder="Escribe código, SKU o nombre para agregar..."
                  clearOnSelect
                />
              </div>

              <div className="table-responsive border rounded bg-light p-1 mb-4">
                <table className="table table-sm table-bordered align-middle mb-0" style={{ minWidth: '700px' }}>
                  <thead className="table-secondary">
                    <tr>
                      <th style={{ width: '120px' }}>Código</th>
                      <th>Producto</th>
                      <th style={{ width: '120px' }}>Cant. *</th>
                      <th style={{ width: '140px' }}>Costo Unitario ($) *</th>
                      <th style={{ width: '100px' }}>IVA</th>
                      <th style={{ width: '140px' }}>Total ($)</th>
                      <th style={{ width: '45px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseItems.map((item, index) => {
                      const qty = parseFloat(item.cantidad) || 0;
                      const cost = parseFloat(item.costo_unitario) || 0;
                      const lineTotal = qty * cost;
                      const hasProd = !!item.id_producto;

                      return (
                        <tr key={index}>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm text-center fw-bold"
                              value={item.code || ''}
                              readOnly
                              disabled
                            />
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={item.id_producto}
                              onChange={(e) => {
                                const nextItems = [...purchaseItems];
                                nextItems[index] = applyProductToItem(nextItems[index], e.target.value);
                                setPurchaseItems(nextItems);
                              }}
                            >
                              <option value="">-- Selecciona producto --</option>
                              {products.map((p) => (
                                <option key={p.id_producto} value={p.id_producto}>
                                  {p.nombre}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="form-control form-control-sm text-end"
                              value={item.cantidad}
                              onChange={(e) => handleItemChange(index, 'amount_dummy', e.target.value) || handleItemChange(index, 'cantidad', e.target.value)}
                              min="0.01"
                              required
                              disabled={!hasProd}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.0001"
                              className="form-control form-control-sm text-end"
                              value={item.costo_unitario}
                              onChange={(e) => handleItemChange(index, 'cost_dummy', e.target.value) || handleItemChange(index, 'costo_unitario', e.target.value)}
                              min="0"
                              required
                              disabled={!hasProd}
                            />
                          </td>
                          <td className="text-center">
                            <span className="badge bg-secondary" style={{ fontSize: '0.8rem' }}>
                              {item.iva_porcentaje || 0}%
                            </span>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm text-end fw-bold"
                              value={'$' + lineTotal.toFixed(2)}
                              readOnly
                              disabled
                            />
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => handleRemoveItemRow(index)}
                              title="Quitar"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totales y Acciones */}
              <div className="row g-4 justify-content-end mb-4">
                <div className="col-md-5">
                  <div className="invoice-total-box bg-white p-3 border">
                    <div className="d-flex justify-content-between mb-2">
                      <span>Subtotal con IVA:</span>
                      <span>${totals.subtotalConIva.toFixed(2)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>Subtotal IVA 0%:</span>
                      <span>${totals.subtotalIvaCero.toFixed(2)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span>IVA Total:</span>
                      <span>${totals.valorIvaTotal.toFixed(2)}</span>
                    </div>
                    <hr className="my-2" />
                    <div className="d-flex justify-content-between fw-bold text-success" style={{ fontSize: '1.2rem' }}>
                      <span>TOTAL COMPRA:</span>
                      <span>${totals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={!selectedSupplier}>
                  Registrar Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <>
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
                placeholder="Buscar por proveedor, RUC o factura..."
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
            <div className="text-center py-4">Cargando compras...</div>
          ) : filteredPurchases.length === 0 ? (
            <p className="module-empty-state">No se registraron compras.</p>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="table-responsive desktop-only">
                <table className="table table-striped table-hover align-middle border">
                  <thead className="table-light">
                    <tr>
                      <th>Factura Proveedor</th>
                      <th>Proveedor</th>
                      <th>Fecha Registro</th>
                      <th className="text-end">Total</th>
                      <th>Estado</th>
                      <th style={{ width: '130px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPurchases.map((purchase) => (
                      <tr key={purchase.id_compra}>
                        <td style={{ fontWeight: 700 }}>{purchase.numero_factura_compra}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{purchase.proveedor_nombre}</div>
                          <small className="text-muted">{purchase.proveedor_identificacion}</small>
                        </td>
                        <td>{new Date(purchase.fecha_compra).toLocaleString()}</td>
                        <td className="text-end fw-bold">${parseFloat(purchase.total).toFixed(2)}</td>
                        <td>
                          <span className="badge bg-success" style={{ fontWeight: 'bold' }}>
                            {purchase.estado}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-info text-white"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleOpenPurchaseDetail(purchase.id_compra)}
                          >
                            Ver Detalle
                          </button>
                          {purchase.estado !== 'ANULADA' && (
                            <button
                              className="btn btn-danger ms-1"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleCancelPurchase(purchase)}
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
                {filteredPurchases.map((purchase) => (
                  <div key={purchase.id_compra} className="client-mobile-card">
                    <div className="client-card-header">
                      <span className="client-name">{purchase.numero_factura_compra}</span>
                      <span className="badge bg-success" style={{ fontWeight: 'bold' }}>
                        {purchase.estado}
                      </span>
                    </div>
                    <div className="client-card-body">
                      <div className="client-card-info-item">
                        <span className="info-label">Proveedor:</span>
                        <span className="info-val">
                          {purchase.proveedor_nombre}
                        </span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Total:</span>
                        <span className="info-val">
                          <strong>${parseFloat(purchase.total).toFixed(2)}</strong>
                        </span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Fecha:</span>
                        <span className="info-val">{new Date(purchase.fecha_compra).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="client-card-actions">
                      <button className="btn btn-info text-white" onClick={() => handleOpenPurchaseDetail(purchase.id_compra)}>
                        Ver Detalle
                      </button>
                      {purchase.estado !== 'ANULADA' && (
                        <button className="btn btn-danger" onClick={() => handleCancelPurchase(purchase)}>
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

      {/* MODAL DETALLE DE COMPRA */}
      {selectedPurchaseDetail && (
        <div className="modal-overlay" onClick={() => setSelectedPurchaseDetail(null)}>
          <div
            className="modal-container text-dark print-document"
            style={{ maxWidth: '800px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={() => setSelectedPurchaseDetail(null)}
              aria-label="Cerrar detalle"
            >
              X
            </button>
            <h2 className="fw-bold text-center mb-3">Detalle de Factura de Compra</h2>
            <div style={{ borderTop: '2px dashed #ccc', margin: '0.75rem 0' }}></div>

            <div className="row small mb-3">
              <div className="col-md-6">
                <div><strong>PROVEEDOR:</strong> {selectedPurchaseDetail.purchase.proveedor_nombre}</div>
                <div><strong>RUC/Cédula:</strong> {selectedPurchaseDetail.purchase.proveedor_identificacion}</div>
                <div><strong>Email:</strong> {selectedPurchaseDetail.purchase.proveedor_email}</div>
                <div><strong>Teléfono:</strong> {selectedPurchaseDetail.purchase.proveedor_telefono}</div>
              </div>
              <div className="col-md-6">
                <div><strong>Factura Proveedor:</strong> {selectedPurchaseDetail.purchase.numero_factura_compra}</div>
                <div><strong>Fecha Registro:</strong> {new Date(selectedPurchaseDetail.purchase.fecha_compra).toLocaleString()}</div>
                <div><strong>Usuario Operador:</strong> {selectedPurchaseDetail.purchase.username}</div>
                <div><strong>Estado:</strong> {selectedPurchaseDetail.purchase.estado}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #eee', margin: '0.75rem 0' }}></div>

            <table className="table table-sm table-striped small">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción Producto</th>
                  <th className="text-end">Cantidad</th>
                  <th className="text-end">Costo Unit.</th>
                  <th className="text-end">IVA</th>
                  <th className="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {selectedPurchaseDetail.details.map((d) => (
                  <tr key={d.id_detalle}>
                    <td>{d.producto_codigo}</td>
                    <td>{d.producto_nombre}</td>
                    <td className="text-end">{parseFloat(d.cantidad).toFixed(2)}</td>
                    <td className="text-end">${parseFloat(d.costo_unitario).toFixed(2)}</td>
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
                  <span>${parseFloat(selectedPurchaseDetail.purchase.subtotal_iva_cero).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Subtotal con IVA:</span>
                  <span>${parseFloat(selectedPurchaseDetail.purchase.subtotal_con_iva).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>IVA Total:</span>
                  <span>${parseFloat(selectedPurchaseDetail.purchase.valor_iva).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between fw-bold text-success border-top pt-1 mt-1">
                  <span>Total:</span>
                  <span>${parseFloat(selectedPurchaseDetail.purchase.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {selectedPurchaseDetail.purchase.observacion && (
              <div className="mt-3 p-2 bg-light rounded small">
                <strong>Observaciones:</strong> {selectedPurchaseDetail.purchase.observacion}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => window.print()}
              >
                Imprimir
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedPurchaseDetail(null)}
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function handleOpenPurchaseDetail(id) {
    handleFetchPurchaseDetail(id);
  }
}
