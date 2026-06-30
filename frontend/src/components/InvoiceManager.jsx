import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../lib/api';

export default function InvoiceManager() {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);

  // Estados de vista
  const [showForm, setShowForm] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);

  // Campos de la Factura (Cabecera)
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [invoiceItems, setInvoiceItems] = useState([
    { id_producto: '', cantidad: 1, precio_unitario: 0, descuento: 0, iva_porcentaje: 0 }
  ]);

  // Usuario actual
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
      // 1. Clientes
      const cliRes = await apiFetch('/api/clients');
      if (cliRes.ok) {
        const data = await cliRes.json();
        setClients(data);
        if (data.length > 0) setSelectedClient(data[0].id);
      }

      // 2. Productos
      const prodRes = await apiFetch('/api/products');
      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.filter(p => p.activo));
      }

      // 3. Métodos de pago
      const pmRes = await apiFetch('/api/cash-registers/payment-methods');
      if (pmRes.ok) {
        const data = await pmRes.json();
        setPaymentMethods(data);
        if (data.length > 0) setSelectedPayment(data[0].id_metodo);
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
      customClass: {
        popup: 'swal-custom-toast'
      }
    });
    Toast.fire({
      icon: type,
      title: message
    });
  };

  // Manejar ítems dinámicos
  const handleAddItemRow = () => {
    setInvoiceItems([
      ...invoiceItems,
      { id_producto: '', cantidad: 1, precio_unitario: 0, descuento: 0, iva_porcentaje: 0 }
    ]);
  };

  const handleRemoveItemRow = (index) => {
    if (invoiceItems.length === 1) return;
    const newItems = [...invoiceItems];
    newItems.splice(index, 1);
    setInvoiceItems(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...invoiceItems];
    newItems[index][field] = value;

    // Si seleccionó un producto, autocompletar precio e IVA
    if (field === 'id_producto') {
      const selectedProd = products.find(p => p.id_producto.toString() === value.toString());
      if (selectedProd) {
        newItems[index].precio_unitario = parseFloat(selectedProd.precio_venta) || 0;
        newItems[index].iva_porcentaje = parseFloat(selectedProd.impuesto_porcentaje) || 0;
      } else {
        newItems[index].precio_unitario = 0;
        newItems[index].iva_porcentaje = 0;
      }
    }

    setInvoiceItems(newItems);
  };

  // Cálculos consolidados en tiempo real para el formulario
  const calculateTotals = () => {
    let subtotalSinImpuestos = 0;
    let subtotalConIva = 0;
    let subtotalIvaCero = 0;
    let valorIvaTotal = 0;

    invoiceItems.forEach(item => {
      const cant = parseFloat(item.cantidad) || 0;
      const precio = parseFloat(item.precio_unitario) || 0;
      const desc = parseFloat(item.descuento) || 0;
      const base = (cant * precio) - desc;

      subtotalSinImpuestos += base;
      if (parseFloat(item.iva_porcentaje) > 0) {
        subtotalConIva += base;
        valorIvaTotal += base * (parseFloat(item.iva_porcentaje) / 100);
      } else {
        subtotalIvaCero += base;
      }
    });

    const total = subtotalSinImpuestos + valorIvaTotal;

    return {
      subtotalSinImpuestos,
      subtotalConIva,
      subtotalIvaCero,
      valorIvaTotal,
      total
    };
  };

  const handleCancel = () => {
    if (clients.length > 0) setSelectedClient(clients[0].id);
    if (paymentMethods.length > 0) setSelectedPayment(paymentMethods[0].id_metodo);
    setInvoiceItems([
      { id_producto: '', cantidad: 1, precio_unitario: 0, descuento: 0, iva_porcentaje: 0 }
    ]);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedClient || !selectedPayment || !currentUser) {
      showAlert('Faltan configurar parámetros del comprobante.', 'error');
      return;
    }

    // Validar ítems
    const invalidItem = invoiceItems.some(item => !item.id_producto || parseFloat(item.cantidad) <= 0 || parseFloat(item.precio_unitario) < 0);
    if (invalidItem) {
      showAlert('Todos los renglones deben contener un producto con cantidad y precio válidos.', 'error');
      return;
    }

    const payload = {
      id_cliente: parseInt(selectedClient, 10),
      id_usuario: currentUser.id_usuario,
      id_metodo_pago: parseInt(selectedPayment, 10),
      items: invoiceItems.map(item => ({
        id_producto: parseInt(item.id_producto, 10),
        cantidad: parseFloat(item.cantidad),
        precio_unitario: parseFloat(item.precio_unitario),
        descuento: parseFloat(item.descuento) || 0
      }))
    };

    try {
      const response = await apiFetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Ocurrió un error al facturar.');

      showAlert(`Factura ${result.numero_factura} emitida correctamente.`, 'success');
      handleCancel();
      fetchInvoices();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  const handleCancelInvoice = async (id, invoiceNum) => {
    const result = await Swal.fire({
      title: '¿Anular Factura?',
      text: `¿Deseas anular la factura "${invoiceNum}"? Se devolverán los ítems al inventario.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e55353',
      cancelButtonColor: '#8a93a2',
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    });

    if (result.isConfirmed) {
      try {
        const response = await apiFetch(`/api/invoices/${id}/cancel`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id_usuario: currentUser.id_usuario })
        });
        const resultData = await response.json();
        
        if (!response.ok) throw new Error(resultData.error || 'No se pudo anular la factura.');

        showAlert('Factura anulada con éxito.', 'success');
        fetchInvoices();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    }
  };

  // Cargar una factura en detalle para RIDE
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

  const totals = calculateTotals();

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Facturación Normal</h1>
          <p>Módulo para emitir comprobantes de venta comerciales (Fase 4).</p>
        </div>
        
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Emitir Factura
        </button>
      </div>

      {/* LISTADO DE FACTURAS EMITIDAS */}
      <div>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando comprobantes...</p>
        ) : invoices.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', margin: 0 }}>
              No se han registrado facturas emitidas.
            </p>
          </div>
        ) : (
          <div>
            <div className="table-responsive desktop-only">
              <table className="table table-striped table-hover align-middle border">
                <thead className="table-light">
                  <tr>
                    <th>Fecha Emisión</th>
                    <th>No. Factura</th>
                    <th>Cliente</th>
                    <th>RUC / Cédula</th>
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
                        <td>
                          <span 
                            className="badge" 
                            style={{ 
                              backgroundColor: isAnulada ? '#f8d7da' : '#d2f4ea', 
                              color: isAnulada ? '#dc3545' : '#14a44d',
                              fontWeight: 'bold'
                            }}
                          >
                            {inv.estado}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-info text-white" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleOpenDetail(inv.id_factura)}
                            >
                              Ver RIDE
                            </button>
                            {!isAnulada && (
                              <button 
                                className="btn btn-danger" 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                onClick={() => handleCancelInvoice(inv.id_factura, inv.numero_factura)}
                              >
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

            <div className="client-cards-container mobile-only">
              {invoices.map((inv) => {
                const isAnulada = inv.estado === 'ANULADA';
                return (
                  <div key={inv.id_factura} className="client-mobile-card">
                    <div className="client-card-header">
                      <span className="client-name">{inv.numero_factura}</span>
                      <span 
                        className="badge" 
                        style={{ 
                          backgroundColor: isAnulada ? '#f8d7da' : '#d2f4ea', 
                          color: isAnulada ? '#dc3545' : '#14a44d',
                          fontWeight: 'bold'
                        }}
                      >
                        {inv.estado}
                      </span>
                    </div>
                    <div className="client-card-body">
                      <div className="client-card-info-item">
                        <span className="info-label">Cliente / ID:</span>
                        <span className="info-val">{inv.cliente_nombre} ({inv.cliente_identificacion})</span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Fecha / Total:</span>
                        <span className="info-val">{new Date(inv.fecha_emision).toLocaleString()} / <strong>${parseFloat(inv.total).toFixed(2)}</strong></span>
                      </div>
                    </div>
                    <div className="client-card-actions">
                      <button className="btn btn-info text-white" onClick={() => handleOpenDetail(inv.id_factura)}>Ver RIDE</button>
                      {!isAnulada && (
                        <button className="btn btn-danger" onClick={() => handleCancelInvoice(inv.id_factura, inv.numero_factura)}>Anular</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FORMULARIO DE NUEVA FACTURA (PANTALLA COMPLETA O MODAL GRANDE) */}
      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-container" style={{ maxWidth: '980px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCancel} aria-label="Cerrar formulario">✕</button>
            <h2>Nueva Factura Comercial</h2>
            <hr />

            <form onSubmit={handleSubmit}>
              {/* Cabecera */}
              <div className="row mb-3">
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-bold">Cliente *</label>
                  <select
                    className="form-control"
                    value={selectedClient}
                    onChange={(e) => setSelectedClient(e.target.value)}
                    required
                  >
                    <option value="">Seleccione un cliente</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.identification_number})</option>
                    ))}
                  </select>
                </div>

                <div className="col-md-6 mb-3">
                  <label className="form-label fw-bold">Método de Pago *</label>
                  <select
                    className="form-control"
                    value={selectedPayment}
                    onChange={(e) => setSelectedPayment(e.target.value)}
                    required
                  >
                    <option value="">Seleccione forma de pago</option>
                    {paymentMethods.map(pm => (
                      <option key={pm.id_metodo} value={pm.id_metodo}>[{pm.codigo_sri}] {pm.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Listado de ítems */}
              <div className="mb-4">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <label className="form-label fw-bold mb-0">Detalles de Factura *</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItemRow}>
                    + Añadir Renglón
                  </button>
                </div>

                <div className="table-responsive border rounded bg-light p-2">
                  <table className="table table-sm table-bordered align-middle mb-0" style={{ minWidth: '700px' }}>
                    <thead className="table-secondary">
                      <tr>
                        <th>Producto / Servicio</th>
                        <th style={{ width: '100px' }}>Cant.</th>
                        <th style={{ width: '120px' }}>P. Unit ($)</th>
                        <th style={{ width: '100px' }}>Desc. ($)</th>
                        <th style={{ width: '100px' }}>IVA</th>
                        <th style={{ width: '110px' }}>Importe ($)</th>
                        <th style={{ width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item, index) => {
                        const cant = parseFloat(item.cantidad) || 0;
                        const price = parseFloat(item.precio_unitario) || 0;
                        const desc = parseFloat(item.descuento) || 0;
                        const lineBase = (cant * price) - desc;

                        return (
                          <tr key={index}>
                            <td>
                              <select
                                className="form-control form-control-sm"
                                value={item.id_producto}
                                onChange={(e) => handleItemChange(index, 'id_producto', e.target.value)}
                                required
                              >
                                <option value="">Seleccione ítem</option>
                                {products.map(p => (
                                  <option key={p.id_producto} value={p.id_producto}>
                                    [{p.codigo}] {p.nombre} (Stock: {parseFloat(p.stock_actual).toFixed(2)})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="form-control form-control-sm text-center"
                                value={item.cantidad}
                                onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                className="form-control form-control-sm text-end"
                                value={item.precio_unitario}
                                onChange={(e) => handleItemChange(index, 'precio_unitario', e.target.value)}
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="form-control form-control-sm text-end"
                                value={item.descuento}
                                onChange={(e) => handleItemChange(index, 'descuento', e.target.value)}
                              />
                            </td>
                            <td className="text-center">
                              <span className="badge bg-secondary">{item.iva_porcentaje}%</span>
                            </td>
                            <td className="text-end fw-bold">
                              ${lineBase.toFixed(2)}
                            </td>
                            <td className="text-center">
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm border-0"
                                onClick={() => handleRemoveItemRow(index)}
                                disabled={invoiceItems.length === 1}
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
              </div>

              {/* Totales consolidados y botones */}
              <div className="row">
                <div className="col-md-7 mb-3">
                  <div className="bg-light p-3 rounded" style={{ fontSize: '0.85rem' }}>
                    <h6 className="fw-bold">Nota de Facturación</h6>
                    <p className="text-secondary mb-0">
                      Al presionar el botón "Guardar/Emitir", el correlativo se bloqueará e incrementará, se generará la factura comercial normal, y se actualizarán automáticamente las existencias en el inventario.
                    </p>
                  </div>
                </div>

                <div className="col-md-5">
                  <div className="border rounded p-3 bg-white shadow-sm">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-secondary">Subtotal IVA 0%:</span>
                      <span>${totals.subtotalIvaCero.toFixed(2)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-secondary">Subtotal con IVA:</span>
                      <span>${totals.subtotalConIva.toFixed(2)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-secondary">Valor IVA (Total):</span>
                      <span>${totals.valorIvaTotal.toFixed(2)}</span>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-between align-items-center mb-0">
                      <strong className="text-dark">VALOR NETO:</strong>
                      <h3 className="text-success fw-bold mb-0">${totals.total.toFixed(2)}</h3>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-actions-buttons border-top pt-3 mt-3">
                <button type="button" className="btn btn-danger" style={{ backgroundColor: '#f43f5e', color: '#ffffff' }} onClick={handleCancel}>
                  Cerrar
                </button>
                <button type="submit" className="btn btn-primary">
                  Emitir Factura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE FACTURA / VISTA RIDE TIPO TICKET SRI */}
      {viewInvoice && (
        <div className="modal-overlay" onClick={() => setViewInvoice(null)}>
          <div className="modal-container text-dark" style={{ maxWidth: '800px', width: '95%', fontFamily: 'Courier New, Courier, monospace' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setViewInvoice(null)} aria-label="Cerrar factura">✕</button>
            
            {/* Cabecera RIDE */}
            <div className="text-center mb-4">
              <h3 className="fw-bold m-0">COMPROBANTE DE VENTA ELECTRÓNICO</h3>
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
                <div style={{ wordBreak: 'break-all' }}>Clave de Acceso SRI: <br />{viewInvoice.invoice.clave_acceso || 'Pndiente autorizacion SRI'}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>

            {/* Datos Cliente */}
            <div className="small mb-3">
              <div><strong>RAZÓN SOCIAL CLIENTE:</strong> {viewInvoice.invoice.cliente_nombre}</div>
              <div><strong>RUC/CÉDULA:</strong> {viewInvoice.invoice.cliente_identificacion}</div>
              <div><strong>DIRECCIÓN:</strong> {viewInvoice.invoice.cliente_direccion || 'S/D'}</div>
              <div><strong>EMAIL:</strong> {viewInvoice.invoice.cliente_email}</div>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>

            {/* Tabla Renglones */}
            <table className="table table-sm table-borderless small mb-3" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px dashed #000' }}>
                  <th>Cod.</th>
                  <th>Cant.</th>
                  <th>Descripción</th>
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

            {/* Resumen de totales */}
            <div className="row small">
              <div className="col-7">
                <div><strong>FORMA DE PAGO:</strong></div>
                <div>{viewInvoice.invoice.metodo_pago_nombre || 'Efectivo'}</div>
              </div>
              <div className="col-5">
                <div className="d-flex justify-content-between">
                  <span>Subtotal IVA 0%:</span>
                  <span>${parseFloat(viewInvoice.invoice.subtotal_iva_cero).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Subtotal con IVA:</span>
                  <span>${parseFloat(viewInvoice.invoice.subtotal_con_iva).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>IVA Total:</span>
                  <span>${parseFloat(viewInvoice.invoice.valor_iva).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between fw-bold" style={{ fontSize: '1rem', borderTop: '1px double #000', paddingTop: '2px' }}>
                  <span>TOTAL NETO:</span>
                  <span>${parseFloat(viewInvoice.invoice.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '2px dashed #000', margin: '1rem 0 0.5rem' }}></div>
            <div className="text-center small text-secondary">
              ¡Gracias por su compra! Factura válida para efectos comerciales.
            </div>

            <div className="form-actions-buttons border-top pt-3 mt-3">
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                🖨️ Imprimir Comprobante
              </button>
              <button type="button" className="btn btn-danger" style={{ backgroundColor: '#f43f5e', color: '#ffffff' }} onClick={() => setViewInvoice(null)}>
                Cerrar RIDE
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
