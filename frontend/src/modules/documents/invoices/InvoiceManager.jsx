import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';
import ProductSearchInput from '../../../shared/ProductSearchInput';

const todayValue = () => new Date().toISOString().slice(0, 10);
const createEmptyItem = () => ({
  id_producto: '',
  cantidad: 1,
  precio_unitario: 0,
  descuento: 0,
  iva_porcentaje: 0,
});

const getClientName = (client) => client?.name || client?.nombre || 'CONSUMIDOR FINAL';
const getClientIdentification = (client) => client?.identification_number || client?.identificacion || '9999999999999';
const getClientPhone = (client) => client?.phone || client?.telefono || '';
const getClientEmail = (client) => client?.email || '';
const getClientAddress = (client) => client?.address || client?.direccion || '';

export default function InvoiceManager({ onRedirectToCash }) {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [invoiceItems, setInvoiceItems] = useState([createEmptyItem()]);
  const [productId, setProductId] = useState('');
  const [proformaNumber, setProformaNumber] = useState('');
  const [sourceProforma, setSourceProforma] = useState(null);
  const [notes, setNotes] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchInvoices();
    fetchMetadata();
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/invoices');
      if (!response.ok) throw new Error('Error al conectar con la base de datos.');
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [cliRes, prodRes, pmRes] = await Promise.all([
        apiFetch('/api/clients'),
        apiFetch('/api/products'),
        apiFetch('/api/cash-registers/payment-methods'),
      ]);

      if (cliRes.ok) {
        const data = await cliRes.json();
        setClients(data);
        if (data.length > 0) setSelectedClient(String(data[0].id));
      }

      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.filter((p) => p.activo));
      }

      if (pmRes.ok) {
        const data = await pmRes.json();
        setPaymentMethods(data);
        if (data.length > 0) setSelectedPayment(String(data[0].id_metodo));
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
      timer: 3500,
      timerProgressBar: true,
      background: '#ffffff',
      color: '#212529',
      iconColor: type === 'success' ? '#2eb85c' : '#e55353',
      customClass: { popup: 'swal-custom-toast' },
    });
    Toast.fire({ icon: type, title: message });
  };

  const selectedClientData = clients.find((client) => String(client.id) === String(selectedClient));
  const currentDate = todayValue();

  const calculateTotals = () => {
    let subtotalSinImpuestos = 0;
    let subtotalConIva = 0;
    let subtotalIvaCero = 0;
    let descuentoTotal = 0;
    let valorIvaTotal = 0;

    invoiceItems.forEach((item) => {
      if (!item.id_producto) return;
      const cant = parseFloat(item.cantidad) || 0;
      const precio = parseFloat(item.precio_unitario) || 0;
      const desc = parseFloat(item.descuento) || 0;
      const subtotal = cant * precio;
      const base = Math.max(subtotal - desc, 0);
      const taxPercent = parseFloat(item.iva_porcentaje) || 0;
      const iva = base * (taxPercent / 100);

      subtotalSinImpuestos += base;
      descuentoTotal += Math.min(subtotal, desc);
      valorIvaTotal += iva;
      if (taxPercent > 0) {
        subtotalConIva += base;
      } else {
        subtotalIvaCero += base;
      }
    });

    return {
      subtotalSinImpuestos,
      subtotalConIva,
      subtotalIvaCero,
      descuentoTotal,
      valorIvaTotal,
      total: subtotalSinImpuestos + valorIvaTotal,
    };
  };

  const totals = calculateTotals();

  const handleCancel = () => {
    if (clients.length > 0) setSelectedClient(String(clients[0].id));
    if (paymentMethods.length > 0) setSelectedPayment(String(paymentMethods[0].id_metodo));
    setInvoiceItems([createEmptyItem()]);
    setProductId('');
    setProformaNumber('');
    setSourceProforma(null);
    setNotes('');
    setShowForm(false);
  };

  const applyProductToItem = (item, productIdValue) => {
    const selectedProd = products.find((p) => String(p.id_producto) === String(productIdValue));
    if (!selectedProd) return createEmptyItem();
    return {
      ...item,
      id_producto: String(selectedProd.id_producto),
      cantidad: item.cantidad || 1,
      precio_unitario: parseFloat(selectedProd.precio_venta) || 0,
      descuento: item.descuento || 0,
      iva_porcentaje: parseFloat(selectedProd.impuesto_porcentaje) || 0,
    };
  };

  const handleProductSearchSelect = (selectedProductId) => {
    if (!selectedProductId) {
      setProductId('');
      return;
    }

    const alreadyAdded = invoiceItems.some((item) => String(item.id_producto) === String(selectedProductId));
    if (alreadyAdded) {
      showAlert('El producto ya esta agregado. Modifica la cantidad en el detalle.', 'info');
      setProductId('');
      return;
    }

    const emptyIndex = invoiceItems.findIndex((item) => !item.id_producto);
    if (emptyIndex >= 0) {
      const nextItems = [...invoiceItems];
      nextItems[emptyIndex] = applyProductToItem({ ...nextItems[emptyIndex], cantidad: 1 }, selectedProductId);
      setInvoiceItems(nextItems);
    } else {
      setInvoiceItems((current) => [...current, applyProductToItem(createEmptyItem(), selectedProductId)]);
    }
    setProductId('');
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...invoiceItems];
    newItems[index][field] = value;
    setInvoiceItems(newItems);
  };

  const handleRemoveItemRow = (index) => {
    if (invoiceItems.length === 1) {
      setInvoiceItems([createEmptyItem()]);
      return;
    }
    const newItems = [...invoiceItems];
    newItems.splice(index, 1);
    setInvoiceItems(newItems);
  };

  const handleLoadProforma = async () => {
    const query = proformaNumber.trim();
    if (!query) {
      showAlert('Ingresa el numero de proforma.', 'error');
      return;
    }

    try {
      const response = await apiFetch(`/api/proformas/number/${encodeURIComponent(query)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo cargar la proforma.');
      if (data.status === 'FACTURADA') throw new Error('Esta proforma ya fue facturada.');
      if (data.status === 'ANULADA') throw new Error('Esta proforma esta anulada.');

      setSourceProforma(data);
      setProformaNumber(data.number);
      setSelectedClient(String(data.clientId));
      setNotes(data.notes || '');
      setInvoiceItems((data.items || []).map((item) => ({
        id_producto: String(item.productId),
        cantidad: item.quantity,
        precio_unitario: item.price,
        descuento: item.discountAmount || item.discount || 0,
        iva_porcentaje: item.taxPercent || 0,
      })));
      showAlert(`Proforma ${data.number} cargada.`, 'success');
    } catch (error) {
      showAlert(error.message || 'No se pudo cargar la proforma.', 'error');
    }
  };

  const handleClearProforma = () => {
    setSourceProforma(null);
    setProformaNumber('');
    setInvoiceItems([createEmptyItem()]);
    setNotes('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedClient || !selectedPayment || !currentUser) {
      showAlert('Faltan configurar parametros del comprobante.', 'error');
      return;
    }

    const validItems = invoiceItems.filter((item) => item.id_producto);
    const invalidItem = validItems.length === 0 || validItems.some((item) => parseFloat(item.cantidad) <= 0 || parseFloat(item.precio_unitario) < 0);
    if (invalidItem) {
      showAlert('Todos los renglones deben contener producto, cantidad y precio validos.', 'error');
      return;
    }

    const payload = {
      id_cliente: parseInt(selectedClient, 10),
      id_usuario: currentUser.id_usuario,
      id_metodo_pago: parseInt(selectedPayment, 10),
      id_proforma: sourceProforma?.id || null,
      items: validItems.map((item) => ({
        id_producto: parseInt(item.id_producto, 10),
        cantidad: parseFloat(item.cantidad),
        precio_unitario: parseFloat(item.precio_unitario),
        descuento: parseFloat(item.descuento) || 0,
      })),
    };

    try {
      const response = await apiFetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Ocurrio un error al facturar.');

      showAlert(`Factura ${result.numero_factura} emitida correctamente.`, 'success');
      handleCancel();
      fetchInvoices();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  const handleCancelInvoice = async (id, invoiceNum) => {
    const result = await Swal.fire({
      title: 'Anular Factura',
      text: `Deseas anular la factura "${invoiceNum}"? Se devolveran los items al inventario.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e55353',
      cancelButtonColor: '#8a93a2',
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary',
      },
    });

    if (!result.isConfirmed) return;

    try {
      const response = await apiFetch(`/api/invoices/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_usuario: currentUser.id_usuario }),
      });
      const resultData = await response.json();
      if (!response.ok) throw new Error(resultData.error || 'No se pudo anular la factura.');
      showAlert('Factura anulada con exito.', 'success');
      fetchInvoices();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  const handleOpenDetail = async (id) => {
    try {
      const response = await apiFetch(`/api/invoices/${id}`);
      if (response.ok) {
        const data = await response.json();
        setViewInvoice(data);
      }
    } catch (error) {
      console.error(error);
      showAlert('No se pudo cargar el detalle de la factura.', 'error');
    }
  };

  const handleOpenNewInvoice = async () => {
    if (!currentUser) return;
    try {
      const response = await apiFetch(`/api/cash-registers/status?id_usuario=${currentUser.id_usuario}`);
      if (response.ok) {
        const data = await response.json();
        if (data.sessionActive) {
          setShowForm(true);
        } else {
          Swal.fire({
            title: 'Caja Cerrada',
            text: 'Debes iniciar un turno de caja chica antes de poder emitir facturas comerciales.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ir a Caja Chica',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3b82f6',
            cancelButtonColor: '#8a93a2',
            customClass: {
              confirmButton: 'btn btn-primary me-2',
              cancelButton: 'btn btn-secondary',
            },
            buttonsStyling: false,
          }).then((result) => {
            if (result.isConfirmed && onRedirectToCash) onRedirectToCash();
          });
        }
      } else {
        showAlert('No se pudo verificar el estado de caja.', 'error');
      }
    } catch (e) {
      console.error(e);
      showAlert('Error de conexion al verificar caja.', 'error');
    }
  };

  return (
    <div className="module-shell">
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Facturas</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>Emite comprobantes de venta comerciales.</p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {invoices.length} {invoices.length === 1 ? 'registro' : 'registros'}
          </span>
          <button className="btn btn-secondary" onClick={showForm ? handleCancel : handleOpenNewInvoice}>
            {showForm ? 'Ver facturas' : '+ Emitir factura'}
          </button>
        </div>
      </div>

      {!showForm && (
        <div className="client-data-panel">
          {loading ? (
            <p className="module-empty-state">Cargando comprobantes...</p>
          ) : invoices.length === 0 ? (
            <p className="module-empty-state">No se han registrado facturas emitidas.</p>
          ) : (
            <div className="table-responsive desktop-only">
              <table className="table table-striped table-hover align-middle border">
                <thead className="table-light">
                  <tr>
                    <th>Fecha Emision</th>
                    <th>No. Factura</th>
                    <th>Cliente</th>
                    <th>RUC / Cedula</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th style={{ width: '220px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const isAnulada = inv.estado === 'ANULADA';
                    return (
                      <tr key={inv.id_factura}>
                        <td>{new Date(inv.fecha_emision).toLocaleString()}</td>
                        <td style={{ fontWeight: '700' }}>{inv.numero_factura}</td>
                        <td>{inv.cliente_nombre}</td>
                        <td>{inv.cliente_identificacion}</td>
                        <td style={{ fontWeight: '700', color: isAnulada ? 'gray' : '#2eb85c' }}>
                          ${parseFloat(inv.total).toFixed(2)}
                        </td>
                        <td><span className="badge bg-secondary">{inv.estado}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-info text-white" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleOpenDetail(inv.id_factura)}>
                              Ver RIDE
                            </button>
                            {!isAnulada && (
                              <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleCancelInvoice(inv.id_factura, inv.numero_factura)}>
                                Anular
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="invoice-inline-panel client-data-panel">
          <div className="invoice-inline-body">
            <div className="document-form-header">
              <div>
                <h2>Factura Electronica</h2>
                <p className="invoice-inline-copy">Crea una factura normal o carga una proforma por numero.</p>
              </div>
              <button type="button" className="btn btn-outline-danger" onClick={handleCancel}>Cerrar</button>
            </div>
            <div className="invoice-inline-divider"></div>

            <form onSubmit={handleSubmit}>
              <div className="row mb-3">
                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Fecha</label>
                  <input className="form-control" value={currentDate} readOnly disabled />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Factura</label>
                  <input className="form-control" value="Se genera al emitir" readOnly disabled />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Proforma</label>
                  <div className="client-cedula-search">
                    <input className="form-control" value={proformaNumber} onChange={(event) => setProformaNumber(event.target.value)} placeholder="PRO-000001 o 000001" />
                    <button type="button" className="btn btn-secondary" onClick={handleLoadProforma}>Cargar</button>
                  </div>
                  {sourceProforma && (
                    <small className="text-success d-block mt-1">
                      Cargada: {sourceProforma.number}
                      <button type="button" className="btn btn-link btn-sm p-0 ms-2" onClick={handleClearProforma}>Quitar</button>
                    </small>
                  )}
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Metodo de Pago *</label>
                  <select className="form-control" value={selectedPayment} onChange={(e) => setSelectedPayment(e.target.value)} required>
                    <option value="">Seleccione</option>
                    {paymentMethods.map((pm) => (
                      <option key={pm.id_metodo} value={pm.id_metodo}>[{pm.codigo_sri}] {pm.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">RUC / Cedula</label>
                  <input className="form-control" value={getClientIdentification(selectedClientData)} readOnly disabled />
                </div>
                <div className="col-md-5 mb-3">
                  <label className="form-label fw-bold">Cliente *</label>
                  <select className="form-control" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} required disabled={Boolean(sourceProforma)}>
                    <option value="">Seleccione un cliente</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{getClientName(c)} ({getClientIdentification(c)})</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2 mb-3">
                  <label className="form-label fw-bold">Telefono</label>
                  <input className="form-control" value={getClientPhone(selectedClientData)} readOnly disabled />
                </div>
                <div className="col-md-2 mb-3">
                  <label className="form-label fw-bold">Vendedor</label>
                  <input className="form-control" value={currentUser?.username || ''} readOnly disabled />
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-bold">Direccion</label>
                  <input className="form-control" value={getClientAddress(selectedClientData)} readOnly disabled />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Email</label>
                  <input className="form-control" value={getClientEmail(selectedClientData)} readOnly disabled />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Tipo Venta</label>
                  <input className="form-control" value="CONTADO" readOnly disabled />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">Observacion</label>
                <textarea className="form-control" value={notes} onChange={(event) => setNotes(event.target.value)} style={{ minHeight: '42px' }} />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold">Busqueda de Producto</label>
                <ProductSearchInput products={products} value={productId} onChange={handleProductSearchSelect} placeholder="Buscar producto por codigo, SKU o nombre" clearOnSelect />
              </div>

              <div className="table-responsive border rounded bg-light p-2 mb-4">
                <table className="table table-sm table-bordered align-middle mb-0" style={{ minWidth: '900px' }}>
                  <thead className="table-secondary">
                    <tr>
                      <th style={{ width: '100px' }}>Codigo</th>
                      <th>Detalle</th>
                      <th style={{ width: '100px' }}>Cantidad</th>
                      <th style={{ width: '120px' }}>Precio</th>
                      <th style={{ width: '120px' }}>PVP Final</th>
                      <th style={{ width: '110px' }}>Descuento</th>
                      <th style={{ width: '80px' }}>IVA</th>
                      <th style={{ width: '110px' }}>Total</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.filter((item) => item.id_producto).length === 0 ? (
                      <tr><td colSpan="9" className="text-center text-muted">Busca un producto o carga una proforma.</td></tr>
                    ) : (
                      invoiceItems.map((item, index) => {
                        if (!item.id_producto) return null;
                        const product = products.find((p) => String(p.id_producto) === String(item.id_producto));
                        const cant = parseFloat(item.cantidad) || 0;
                        const price = parseFloat(item.precio_unitario) || 0;
                        const desc = parseFloat(item.descuento) || 0;
                        const base = Math.max(cant * price - desc, 0);
                        const iva = base * ((parseFloat(item.iva_porcentaje) || 0) / 100);
                        const totalLine = base + iva;
                        return (
                          <tr key={`${item.id_producto}-${index}`}>
                            <td className="text-center fw-bold">{product?.codigo || product?.sku || item.id_producto}</td>
                            <td>
                              <strong>{product?.nombre || 'Producto seleccionado'}</strong>
                              <br />
                              <small className="text-muted">Stock: {Number(product?.stock_actual || 0).toFixed(2)}</small>
                            </td>
                            <td>
                              <input type="number" step="0.01" min="0.01" className="form-control form-control-sm text-center" value={item.cantidad} onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)} required />
                            </td>
                            <td>
                              <input type="number" step="0.0001" min="0" className="form-control form-control-sm text-end" value={item.precio_unitario} onChange={(e) => handleItemChange(index, 'precio_unitario', e.target.value)} required />
                            </td>
                            <td className="text-end fw-bold">${(price * (1 + ((parseFloat(item.iva_porcentaje) || 0) / 100))).toFixed(4)}</td>
                            <td>
                              <input type="number" step="0.01" min="0" className="form-control form-control-sm text-end" value={item.descuento} onChange={(e) => handleItemChange(index, 'descuento', e.target.value)} />
                            </td>
                            <td className="text-center"><span className="badge bg-secondary">{item.iva_porcentaje}%</span></td>
                            <td className="text-end fw-bold">${totalLine.toFixed(2)}</td>
                            <td className="text-center">
                              <button type="button" className="btn btn-outline-danger btn-sm border-0" onClick={() => handleRemoveItemRow(index)}>X</button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="row">
                <div className="col-md-7 mb-3">
                  <div className="bg-light p-3 rounded" style={{ fontSize: '0.85rem' }}>
                    <h6 className="fw-bold">Nota de Facturacion</h6>
                    <p className="text-secondary mb-0">
                      La factura normal genera su numero al emitir. Si cargas una proforma, sus datos pasan al comprobante y la proforma queda marcada como facturada.
                    </p>
                  </div>
                </div>
                <div className="col-md-5">
                  <div className="border rounded p-3 bg-white shadow-sm">
                    <div className="d-flex justify-content-between mb-2"><span className="text-secondary">Subtotal:</span><span>${totals.subtotalSinImpuestos.toFixed(4)}</span></div>
                    <div className="d-flex justify-content-between mb-2"><span className="text-secondary">Descuento:</span><span>${totals.descuentoTotal.toFixed(4)}</span></div>
                    <div className="d-flex justify-content-between mb-2"><span className="text-secondary">Subtotal IVA 0%:</span><span>${totals.subtotalIvaCero.toFixed(2)}</span></div>
                    <div className="d-flex justify-content-between mb-2"><span className="text-secondary">Subtotal Neto:</span><span>${totals.subtotalConIva.toFixed(4)}</span></div>
                    <div className="d-flex justify-content-between mb-2"><span className="text-secondary">IVA:</span><span>${totals.valorIvaTotal.toFixed(4)}</span></div>
                    <hr />
                    <div className="d-flex justify-content-between align-items-center mb-0">
                      <strong className="text-dark">TOTAL:</strong>
                      <h3 className="text-success fw-bold mb-0">${totals.total.toFixed(2)}</h3>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-actions-buttons invoice-actions mt-3">
                <button type="button" className="btn btn-outline-danger" onClick={handleCancel}>Cerrar</button>
                <button type="submit" className="btn btn-primary client-primary-btn">Emitir Factura</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewInvoice && (
        <div className="modal-overlay" onClick={() => setViewInvoice(null)}>
          <div className="modal-container text-dark" style={{ maxWidth: '800px', width: '95%', fontFamily: 'Courier New, Courier, monospace' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setViewInvoice(null)} aria-label="Cerrar factura">X</button>
            <div className="text-center mb-4">
              <h3 className="fw-bold m-0">COMPROBANTE DE VENTA ELECTRONICO</h3>
              <h5 className="m-0">FACTURA TICKET</h5>
              <div style={{ borderTop: '2px dashed #000', margin: '0.75rem 0' }}></div>
            </div>
            <div className="row small mb-3">
              <div className="col-md-6 mb-2">
                <div><strong>EMISOR:</strong></div>
                <div>FACTURAPRO S.A.</div>
                <div>RUC: 1792345678001</div>
                <div>Matriz: {viewInvoice.invoice.direccion_matriz}</div>
                <div>{viewInvoice.invoice.sucursal_nombre} ({viewInvoice.invoice.codigo_establecimiento}-{viewInvoice.invoice.punto_emision})</div>
                <div>Obligado a llevar contabilidad: SI</div>
              </div>
              <div className="col-md-6 mb-2">
                <div><strong>No. COMPROBANTE:</strong></div>
                <div className="fw-bold" style={{ fontSize: '1.05rem' }}>{viewInvoice.invoice.numero_factura}</div>
                <div>Fecha/Hora: {new Date(viewInvoice.invoice.fecha_emision).toLocaleString()}</div>
                <div>Estado: {viewInvoice.invoice.estado}</div>
                <div style={{ wordBreak: 'break-all' }}>Clave de Acceso SRI: <br />{viewInvoice.invoice.clave_acceso || 'Pendiente autorizacion SRI'}</div>
              </div>
            </div>
            <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>
            <div className="small mb-3">
              <div><strong>RAZON SOCIAL CLIENTE:</strong> {viewInvoice.invoice.cliente_nombre}</div>
              <div><strong>RUC/CEDULA:</strong> {viewInvoice.invoice.cliente_identificacion}</div>
              <div><strong>DIRECCION:</strong> {viewInvoice.invoice.cliente_direccion || 'S/D'}</div>
              <div><strong>EMAIL:</strong> {viewInvoice.invoice.cliente_email}</div>
            </div>
            <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>
            <table className="table table-sm table-borderless small mb-3" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000' }}>
                  <th>Cod.</th>
                  <th>Cant.</th>
                  <th>Descripcion</th>
                  <th className="text-end">P. Unit</th>
                  <th className="text-end">Desc.</th>
                  <th className="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewInvoice.details.map((d) => (
                  <tr key={d.id_detalle}>
                    <td>{d.producto_codigo}</td>
                    <td>{parseFloat(d.cantidad).toFixed(2)}</td>
                    <td>{d.producto_nombre}</td>
                    <td className="text-end">${parseFloat(d.precio_unitario).toFixed(2)}</td>
                    <td className="text-end">${parseFloat(d.descuento).toFixed(2)}</td>
                    <td className="text-end">${parseFloat(d.precio_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>
            <div className="row small">
              <div className="col-7">
                <div><strong>FORMA DE PAGO:</strong></div>
                <div>{viewInvoice.invoice.metodo_pago_nombre || 'Efectivo'}</div>
              </div>
              <div className="col-5">
                <div className="d-flex justify-content-between"><span>Subtotal IVA 0%:</span><span>${parseFloat(viewInvoice.invoice.subtotal_iva_cero).toFixed(2)}</span></div>
                <div className="d-flex justify-content-between"><span>Subtotal con IVA:</span><span>${parseFloat(viewInvoice.invoice.subtotal_con_iva).toFixed(2)}</span></div>
                <div className="d-flex justify-content-between"><span>IVA Total:</span><span>${parseFloat(viewInvoice.invoice.valor_iva).toFixed(2)}</span></div>
                <div className="d-flex justify-content-between fw-bold" style={{ fontSize: '1rem', borderTop: '1px double #000', paddingTop: '2px' }}>
                  <span>TOTAL NETO:</span><span>${parseFloat(viewInvoice.invoice.total).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div style={{ borderTop: '2px dashed #000', margin: '1rem 0 0.5rem' }}></div>
            <div className="text-center small text-secondary">Gracias por su compra. Factura valida para efectos comerciales.</div>
            <div className="form-actions-buttons border-top pt-3 mt-3">
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Imprimir Comprobante</button>
              <button type="button" className="btn btn-danger" style={{ backgroundColor: '#f43f5e', color: '#ffffff' }} onClick={() => setViewInvoice(null)}>Cerrar RIDE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
