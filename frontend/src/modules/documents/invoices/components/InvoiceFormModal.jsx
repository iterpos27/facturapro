import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import ProductSearchInput from '../../../../shared/ProductSearchInput';
import { apiFetch } from '../../../../lib/api';
import {
  todayValue,
  getClientId,
  getClientName,
  getClientIdentification,
  getClientPhone,
  getClientEmail,
  getClientAddress,
  calculateLineAmounts,
} from '../../../../lib/calculations';

const createEmptyItem = () => ({
  id_producto: '',
  cantidad: 1,
  precio_unitario: 0,
  descuento: 0,
  descuento_porcentaje: 0,
  iva_porcentaje: 0,
});

const createEmptyPayment = (methodId = '') => ({
  id_metodo_pago: methodId,
  monto: '',
  referencia: '',
});

const addDaysValue = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + (parseInt(days, 10) || 0));
  return date.toISOString().slice(0, 10);
};

export default function InvoiceFormModal({
  clients,
  products,
  paymentMethods,
  currentUser,
  initialProformaNumber,
  onSave,
  onClose,
}) {
  const [selectedClient, setSelectedClient] = useState('');
  const [clientCedulaQuery, setClientCedulaQuery] = useState('');
  const [selectedPayment, setSelectedPayment] = useState('');
  const [paymentRows, setPaymentRows] = useState([]);
  const [invoiceItems, setInvoiceItems] = useState([createEmptyItem()]);
  const [productId, setProductId] = useState('');
  const [proformaNumber, setProformaNumber] = useState('');
  const [sourceProforma, setSourceProforma] = useState(null);
  const [notes, setNotes] = useState('');
  const [anticipo, setAnticipo] = useState('');
  const [tipoPago, setTipoPago] = useState('CONTADO');
  const [diasCredito, setDiasCredito] = useState(15);

  // Lookup modal de cliente
  const [showClientLookup, setShowClientLookup] = useState(false);
  const [clientLookupQuery, setClientLookupQuery] = useState('');

  const loadProformaByNumber = useCallback(async (number) => {
    const query = number.trim();
    if (!query) return;

    try {
      const response = await apiFetch(
        `/api/proformas/number/${encodeURIComponent(query)}`
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'No se encontró la proforma.');
      if (data.status === 'FACTURADA') {
        await Swal.fire({
          title: 'Proforma ya facturada',
          text: `La proforma ${query} ya fue convertida en factura.`,
          icon: 'warning',
          confirmButtonText: 'Entendido',
        });
        return;
      }
      if (data.status === 'ANULADA')
        throw new Error('Esta proforma está anulada y no puede facturarse.');

      setSourceProforma(data);
      setProformaNumber(data.number);
      setSelectedClient(String(data.clientId));
      const clientObj = clients.find((c) => String(getClientId(c)) === String(data.clientId));
      if (clientObj) setClientCedulaQuery(getClientIdentification(clientObj));
      setNotes(data.notes || '');
      setInvoiceItems(
        (data.items || []).map((item) => ({
          id_producto: String(item.productId),
          cantidad: item.quantity,
          precio_unitario: item.price,
          descuento: item.discountAmount || item.discount || 0,
          descuento_porcentaje: item.discountPercent || 0,
          iva_porcentaje: item.taxPercent || 0,
          code: item.code,
          name: item.name,
        }))
      );
      setPaymentRows([createEmptyPayment(selectedPayment)]);
      setAnticipo('');
      Swal.fire('Éxito', `Proforma ${data.number} cargada correctamente.`, 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  }, [clients, selectedPayment]);

  // Inicializar selectores por defecto
  useEffect(() => {
    if (clients.length > 0) {
      const defaultClient = clients.find(c =>
        String(getClientIdentification(c)) === '9999999999999' ||
        String(getClientIdentification(c)) === '9999999999' ||
        String(getClientName(c)).toLowerCase().includes('consumidor final')
      ) || clients[0];
      setSelectedClient(String(getClientId(defaultClient)));
      setClientCedulaQuery(getClientIdentification(defaultClient));
    }
    if (paymentMethods.length > 0) {
      const defaultPayment = String(paymentMethods[0].id_metodo);
      setSelectedPayment(defaultPayment);
      setPaymentRows([createEmptyPayment(defaultPayment)]);
    }
  }, [clients, paymentMethods]);

  // Si viene una proforma pendiente por cargar de manera inicial
  useEffect(() => {
    if (initialProformaNumber) {
      setProformaNumber(initialProformaNumber);
      loadProformaByNumber(initialProformaNumber);
    }
  }, [initialProformaNumber, loadProformaByNumber]);

  const selectedClientData = useMemo(() => {
    return (
      clients.find((c) => String(getClientId(c)) === String(selectedClient)) ||
      null
    );
  }, [clients, selectedClient]);

  const clientLookupResults = useMemo(() => {
    const query = clientLookupQuery.trim().toLowerCase();
    if (query.length < 2) return [];

    return clients
      .filter((client) => {
        const name = getClientName(client).toLowerCase();
        const identification = getClientIdentification(client).toLowerCase();
        return name.includes(query) || identification.includes(query);
      })
      .slice(0, 20);
  }, [clients, clientLookupQuery]);

  // Cálculo consolidado de totales en tiempo real
  const totals = useMemo(() => {
    let subtotalSinImpuestos = 0;
    let subtotalConIva = 0;
    let subtotalIvaCero = 0;
    let descuentoTotal = 0;
    let valorIvaTotal = 0;

    invoiceItems.forEach((item) => {
      if (!item.id_producto) return;
      const { subtotal, taxPercent, iva, totalDiscount } = calculateLineAmounts(item);

      subtotalSinImpuestos += subtotal;
      descuentoTotal += totalDiscount;
      valorIvaTotal += iva;
      if (taxPercent > 0) {
        subtotalConIva += subtotal;
      } else {
        subtotalIvaCero += subtotal;
      }
    });

    const total = Math.max(subtotalSinImpuestos + valorIvaTotal - descuentoTotal, 0);

    return {
      subtotalSinImpuestos,
      subtotalConIva,
      subtotalIvaCero,
      descuentoTotal,
      valorIvaTotal,
      total,
    };
  }, [invoiceItems]);

  const paymentRowsTotal = useMemo(() => {
    return paymentRows.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
  }, [paymentRows]);

  const paidAmount = paymentRowsTotal + (parseFloat(anticipo) || 0);
  const changeAmount = Math.max(paidAmount - totals.total, 0);
  const balanceAmount = Math.max(totals.total - paidAmount, 0);

  const handleClientCedulaSearch = (value) => {
    setClientCedulaQuery(value);
    const query = value.trim();
    if (!query) {
      setSelectedClient('');
      return;
    }

    const foundClient = clients.find(
      (client) => getClientIdentification(client) === query
    );
    if (foundClient) {
      setSelectedClient(String(getClientId(foundClient)));
    } else {
      setSelectedClient('');
    }
  };

  const selectClient = (client) => {
    setSelectedClient(String(getClientId(client)));
    setClientCedulaQuery(getClientIdentification(client));
    setClientLookupQuery('');
    setShowClientLookup(false);
  };

  const applyProductToItem = (item, productIdValue) => {
    const selectedProd = products.find(
      (p) => String(p.id_producto) === String(productIdValue)
    );
    if (!selectedProd) return createEmptyItem();
    return {
      ...item,
      id_producto: String(selectedProd.id_producto),
      cantidad: item.cantidad || 1,
      precio_unitario: parseFloat(selectedProd.precio_venta) || 0,
      descuento: item.descuento || 0,
      descuento_porcentaje: item.descuento_porcentaje || 0,
      iva_porcentaje: parseFloat(selectedProd.impuesto_porcentaje) || 0,
      code: selectedProd.codigo,
      name: selectedProd.nombre,
    };
  };

  const handleProductSearchSelect = (selectedProductId) => {
    if (!selectedProductId) {
      setProductId('');
      return;
    }

    const alreadyAdded = invoiceItems.some(
      (item) => String(item.id_producto) === String(selectedProductId)
    );
    if (alreadyAdded) {
      Swal.fire('Información', 'El producto ya está agregado.', 'info');
      setProductId('');
      return;
    }

    const emptyIndex = invoiceItems.findIndex((item) => !item.id_producto);
    if (emptyIndex >= 0) {
      const nextItems = [...invoiceItems];
      nextItems[emptyIndex] = applyProductToItem(
        { ...nextItems[emptyIndex], cantidad: 1 },
        selectedProductId
      );
      setInvoiceItems(nextItems);
    } else {
      setInvoiceItems((current) => [
        ...current,
        applyProductToItem(createEmptyItem(), selectedProductId),
      ]);
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


  const handleClearProforma = () => {
    setSourceProforma(null);
    setProformaNumber('');
    setInvoiceItems([createEmptyItem()]);
    setNotes('');
    setPaymentRows([createEmptyPayment(selectedPayment)]);
    setAnticipo('');
    setTipoPago('CONTADO');
    setDiasCredito(15);
  };

  const handlePaymentChange = (index, field, value) => {
    setPaymentRows((current) =>
      current.map((payment, paymentIndex) =>
        paymentIndex === index ? { ...payment, [field]: value } : payment
      )
    );
  };

  const handleAddPayment = () => {
    setPaymentRows((current) => [
      ...current,
      createEmptyPayment(selectedPayment),
    ]);
  };

  const handleRemovePayment = (index) => {
    setPaymentRows((current) =>
      current.length === 1
        ? [createEmptyPayment(selectedPayment)]
        : current.filter((_, paymentIndex) => paymentIndex !== index)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedClient || !selectedPayment || !currentUser) {
      Swal.fire('Error', 'Faltan configurar parámetros del comprobante.', 'error');
      return;
    }

    const validItems = invoiceItems.filter((item) => item.id_producto);
    const invalidItem =
      validItems.length === 0 ||
      validItems.some(
        (item) =>
          parseFloat(item.cantidad) <= 0 || parseFloat(item.precio_unitario) < 0
      );
    if (invalidItem) {
      Swal.fire(
        'Error',
        'Todos los renglones deben contener producto, cantidad y precio válidos.',
        'error'
      );
      return;
    }

    const validPayments = paymentRows
      .map((payment) => ({
        id_metodo_pago: parseInt(payment.id_metodo_pago || selectedPayment, 10),
        monto: parseFloat(payment.monto) || 0,
        referencia: payment.referencia || '',
      }))
      .filter((payment) => payment.id_metodo_pago && payment.monto > 0);

    const payload = {
      id_cliente: parseInt(selectedClient, 10),
      id_usuario: currentUser.id_usuario,
      id_metodo_pago:
        validPayments[0]?.id_metodo_pago || parseInt(selectedPayment, 10),
      id_proforma: sourceProforma?.id || null,
      tipo_pago: tipoPago,
      dias_credito: tipoPago === 'CREDITO' ? parseInt(diasCredito, 10) || 15 : 0,
      items: validItems.map((item) => ({
        id_producto: parseInt(item.id_producto, 10),
        cantidad: parseFloat(item.cantidad),
        precio_unitario: parseFloat(item.precio_unitario),
        descuento: parseFloat(item.descuento) || 0,
        descuento_porcentaje: parseFloat(item.descuento_porcentaje) || 0,
      })),
      monto_pago: validPayments.reduce((sum, payment) => sum + payment.monto, 0),
      anticipo: parseFloat(anticipo) || 0,
      observacion: notes,
      payments: validPayments,
    };

    onSave(payload, {
      total: totals.total,
      paidAmount,
      balanceAmount,
      changeAmount,
    });
  };

  return (
    <div className="invoice-inline-panel client-data-panel">
      <div className="invoice-inline-body">
        <div className="document-form-header">
          <div>
            <h2>Emitir Factura Comercial</h2>
            <p className="invoice-inline-copy">
              Registra una venta directa o carga los detalles desde una proforma aprobada.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-danger"
            onClick={onClose}
          >
            Cerrar Formulario
          </button>
        </div>
        <div className="invoice-inline-divider"></div>

        <form onSubmit={handleSubmit}>
          {/* Cabecera — Fila 1: Proforma + Datos Cliente */}
          <div className="row mb-1 g-2 align-items-end">
            {/* No. Proforma — integrado en la misma fila */}
            <div className="col-md-2">
              <label className="form-label fw-bold mb-1">No. Proforma</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingRight: sourceProforma ? '2.2rem' : undefined }}
                  value={proformaNumber}
                  onChange={(e) => setProformaNumber(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); loadProformaByNumber(proformaNumber); } }}
                  placeholder="Ej: 000001"
                />
                {sourceProforma && (
                  <button
                    type="button"
                    title="Limpiar proforma"
                    onClick={handleClearProforma}
                    style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#e05a4b', cursor: 'pointer', padding: '2px' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
              {sourceProforma && (
                <small style={{ color: '#27ae60', fontWeight: 600 }}>✓ {sourceProforma.number}</small>
              )}
            </div>

            <div className="col-md-2">
              <label className="form-label fw-bold mb-1">RUC / Cédula</label>
              <div className="client-cedula-search">
                <input
                  className="form-control"
                  value={clientCedulaQuery}
                  onChange={(event) => handleClientCedulaSearch(event.target.value)}
                  placeholder="Cedula/RUC"
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowClientLookup(true)}
                  title="Buscar cliente"
                  style={{ padding: '0.375rem 0.6rem', display: 'inline-flex', alignItems: 'center' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </button>
              </div>
            </div>

            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Cliente *</label>
              <input
                className="form-control"
                value={selectedClientData ? getClientName(selectedClientData) : 'Sin cliente'}
                readOnly
                disabled
              />
            </div>

            <div className="col-md-2">
              <label className="form-label fw-bold mb-1">Fecha Emisión</label>
              <input className="form-control" value={todayValue()} readOnly disabled />
            </div>

            <div className="col-md-2">
              <label className="form-label fw-bold mb-1">Tipo de Pago</label>
              <div className="d-flex gap-1">
                <button
                  type="button"
                  className={`btn btn-sm flex-fill ${tipoPago === 'CONTADO' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  style={{ borderRadius: '10px', fontWeight: 700, fontSize: '0.78rem' }}
                  onClick={() => {
                    setTipoPago('CONTADO');
                    setDiasCredito(0);
                  }}
                >
                  Contado
                </button>
                <button
                  type="button"
                  className={`btn btn-sm flex-fill ${tipoPago === 'CREDITO' ? 'btn-warning' : 'btn-outline-secondary'}`}
                  style={{ borderRadius: '10px', fontWeight: 700, fontSize: '0.78rem' }}
                  onClick={() => {
                    setTipoPago('CREDITO');
                    setDiasCredito((current) => parseInt(current, 10) > 0 ? current : 15);
                  }}
                >
                  Crédito
                </button>
              </div>
            </div>

            <div className="col-md-1">
              <label className="form-label fw-bold mb-1">Caja</label>
              <input className="form-control" value="001-001" readOnly disabled />
            </div>
          </div>

          {/* Cabecera — Fila 2 */}
          <div className="row mb-1 g-2">
            <div className="col-md-2">
              <label className="form-label fw-bold mb-1">Teléfono</label>
              <input className="form-control" value={getClientPhone(selectedClientData)} readOnly disabled />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Dirección</label>
              <input className="form-control" value={getClientAddress(selectedClientData)} readOnly disabled />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-bold mb-1">Email</label>
              <input className="form-control" value={getClientEmail(selectedClientData)} readOnly disabled />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-bold mb-1">Cajero</label>
              <input className="form-control" value={currentUser?.username || ''} readOnly disabled />
            </div>
            <div className="col-md-1">
              <label className="form-label fw-bold mb-1">Plazo</label>
              <input
                type="number"
                className="form-control"
                value={diasCredito}
                onChange={(event) => setDiasCredito(event.target.value)}
                min={tipoPago === 'CREDITO' ? '1' : '0'}
                max="365"
                disabled={tipoPago !== 'CREDITO'}
              />
            </div>
            <div className="col-md-1">
              <label className="form-label fw-bold mb-1">Vence</label>
              <input
                className="form-control"
                value={tipoPago === 'CREDITO' ? addDaysValue(diasCredito) : 'Contado'}
                readOnly
                disabled
              />
            </div>
            <div className="col-md-2">
              <label className="form-label fw-bold mb-1">Observaciones</label>
              <input
                className="form-control"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notas..."
              />
            </div>
          </div>


          {/* Renglones / Detalles */}
          <div className="mb-3">
            <div className="mb-2">
              <label className="form-label fw-bold">Buscar producto *</label>
              <ProductSearchInput
                products={products}
                value={productId}
                onChange={handleProductSearchSelect}
                placeholder="Buscar producto por codigo, SKU o nombre"
                clearOnSelect
              />
            </div>

            <div className="d-flex align-items-center justify-content-between mb-2">
              <label className="form-label fw-bold mb-0">Detalles de Facturación *</label>
            </div>

            <div className="table-responsive border rounded bg-light p-1">
              <table
                className="table table-sm table-bordered align-middle mb-0"
                style={{ minWidth: '700px' }}
              >
                <thead className="table-secondary">
                  <tr>
                    <th style={{ width: '110px' }}>Codigo</th>
                    <th>Producto / Servicio</th>
                    <th style={{ width: '100px' }}>Cant.</th>
                    <th style={{ width: '120px' }}>P. Unit ($)</th>
                    <th style={{ width: '100px' }}>Desc. ($)</th>
                    <th style={{ width: '100px' }}>Desc. (%)</th>
                    <th style={{ width: '80px' }}>IVA</th>
                    <th style={{ width: '110px' }}>Total ($)</th>
                    <th style={{ width: '45px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems.map((item, index) => {
                    const line = calculateLineAmounts(item);
                    const isProductSelected = !!item.id_producto;

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
                          <div style={{ padding: '0.25rem 0.5rem', fontWeight: 600, fontSize: '0.9rem', minHeight: '31px', display: 'flex', alignItems: 'center' }}>
                            {item.name || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Sin producto</span>}
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm text-end"
                            value={item.cantidad}
                            onChange={(event) =>
                              handleItemChange(
                                index,
                                'cantidad',
                                event.target.value
                              )
                            }
                            min="0.01"
                            required
                            disabled={!isProductSelected}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.0001"
                            className="form-control form-control-sm text-end"
                            value={item.precio_unitario}
                            onChange={(event) =>
                              handleItemChange(
                                index,
                                'precio_unitario',
                                event.target.value
                              )
                            }
                            min="0"
                            required
                            disabled={!isProductSelected}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm text-end"
                            value={item.descuento}
                            onChange={(event) =>
                              handleItemChange(
                                index,
                                'descuento',
                                event.target.value
                              )
                            }
                            min="0"
                            disabled={!isProductSelected}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control form-control-sm text-end"
                            value={item.descuento_porcentaje}
                            onChange={(event) =>
                              handleItemChange(
                                index,
                                'descuento_porcentaje',
                                event.target.value
                              )
                            }
                            min="0"
                            max="100"
                            disabled={!isProductSelected}
                          />
                        </td>
                        <td className="text-center">
                          <span
                            className="badge bg-secondary"
                            style={{ fontSize: '0.8rem' }}
                          >
                            {line.taxPercent}%
                          </span>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm text-end fw-bold"
                            value={'$' + line.total.toFixed(2)}
                            readOnly
                            disabled
                          />
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            onClick={() => handleRemoveItemRow(index)}
                            title="Quitar fila"
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

          {/* Formas de Pago y Totales */}
          <div className="row g-4 mb-4">
            {/* Sección de Pago */}
            <div className="col-md-7">
              <div className="card shadow-sm border p-3">
                <h5 className="mb-3 text-dark fw-bold">Configuración de Pagos</h5>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold">Anticipo / Crédito Interno ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={anticipo}
                      onChange={(e) => setAnticipo(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="mb-2 d-flex justify-content-between align-items-center">
                  <label className="form-label fw-bold mb-0">Renglones de Pago (Multicaja)</label>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleAddPayment}
                  >
                    + Agregar Pago
                  </button>
                </div>

                <div className="table-responsive border rounded bg-light p-1">
                  <table className="table table-sm table-borderless align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Método de Pago</th>
                        <th style={{ width: '130px' }}>Monto ($)</th>
                        <th>Referencia / Lote</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentRows.map((row, index) => (
                        <tr key={index}>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={row.id_metodo_pago}
                              onChange={(e) =>
                                handlePaymentChange(
                                  index,
                                  'id_metodo_pago',
                                  e.target.value
                                )
                              }
                            >
                              {paymentMethods.map((pm) => (
                                <option key={pm.id_metodo} value={pm.id_metodo}>
                                  {pm.nombre}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="form-control form-control-sm text-end"
                              value={row.monto}
                              onChange={(e) =>
                                handlePaymentChange(index, 'monto', e.target.value)
                              }
                              placeholder="0.00"
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              value={row.referencia}
                              onChange={(e) =>
                                handlePaymentChange(
                                  index,
                                  'referencia',
                                  e.target.value
                                )
                              }
                              placeholder="Ej: Lote 12903"
                            />
                          </td>
                          <td className="text-center">
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm p-0"
                              style={{ width: '24px', height: '24px' }}
                              onClick={() => handleRemovePayment(index)}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="row g-2 mt-3 small text-secondary">
                  <div className="col-6">
                    <strong>Total Pagado (Métodos):</strong> ${paymentRowsTotal.toFixed(2)}
                  </div>
                  <div className="col-6">
                    <strong>Anticipo Aplicado:</strong> ${parseFloat(anticipo || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Totales */}
            <div className="col-md-5">
              <div className="invoice-total-box bg-white h-100 d-flex flex-column justify-content-between p-3 border">
                <div>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Subtotal sin Impuestos:</span>
                    <span className="fw-semibold">
                      ${totals.subtotalSinImpuestos.toFixed(2)}
                    </span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Subtotal con IVA:</span>
                    <span>${totals.subtotalConIva.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span>Subtotal IVA 0%:</span>
                    <span>${totals.subtotalIvaCero.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2 text-danger">
                    <span>Descuento Total:</span>
                    <span>-${totals.descuentoTotal.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span>IVA Total:</span>
                    <span>${totals.valorIvaTotal.toFixed(2)}</span>
                  </div>
                  <hr className="my-2" />
                  <div
                    className="d-flex justify-content-between fw-bold text-success"
                    style={{ fontSize: '1.2rem' }}
                  >
                    <span>TOTAL FACTURA:</span>
                    <span>${totals.total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-3 p-2 bg-light rounded border border-dashed text-dark">
                  <div className="d-flex justify-content-between small mb-1">
                    <span>Pagado + Anticipo:</span>
                    <span className="fw-semibold">${paidAmount.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between small mb-1">
                    <span>Cambio (Vuelto):</span>
                    <span className="text-success fw-bold">${changeAmount.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between small">
                    <span>Saldo Pendiente (Crédito):</span>
                    <span className="text-danger fw-bold">${balanceAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-success"
              disabled={!selectedClient}
            >
              Emitir Factura
            </button>
          </div>
        </form>
      </div>

      {/* MODAL BUSCADOR DE CLIENTES */}
      {showClientLookup && (
        <div
          className="modal-overlay"
          onClick={() => setShowClientLookup(false)}
        >
          <div
            className="modal-container modal-container-clean compact-modal"
            style={{ maxWidth: '720px' }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={() => setShowClientLookup(false)}
              aria-label="Cerrar buscador"
            >
              X
            </button>
            <h2>Buscar Cliente</h2>
            <p className="modal-support-copy">
              Busca por nombre, RUC o cedula y selecciona el cliente para la
              factura.
            </p>

            <div className="form-group mb-3">
              <label className="form-label">Nombre o RUC/Cedula</label>
              <input
                className="form-control"
                value={clientLookupQuery}
                onChange={(event) => setClientLookupQuery(event.target.value)}
                placeholder="Escribe al menos 2 caracteres"
                autoFocus
              />
            </div>

            <div className="client-lookup-results">
              {clientLookupQuery.trim().length < 2 ? (
                <p className="module-empty-state">
                  Escribe al menos 2 caracteres para buscar.
                </p>
              ) : clientLookupResults.length === 0 ? (
                <p className="module-empty-state">
                  No se encontraron clientes.
                </p>
              ) : (
                clientLookupResults.map((client) => (
                  <button
                    type="button"
                    key={getClientId(client)}
                    className="client-lookup-option"
                    onClick={() => selectClient(client)}
                  >
                    <strong>{getClientName(client)}</strong>
                    <span>
                      {getClientIdentification(client)} | {getClientPhone(client)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
