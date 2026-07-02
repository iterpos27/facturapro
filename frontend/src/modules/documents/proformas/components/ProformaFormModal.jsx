import React, { useEffect, useMemo, useState } from 'react';
import ProductSearchInput from '../../../../shared/ProductSearchInput';
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

export default function ProformaFormModal({
  clients,
  products,
  editingProforma,
  currentUser,
  transactionNumber,
  onSave,
  onClose,
}) {
  const [clientId, setClientId] = useState('');
  const [clientCedulaQuery, setClientCedulaQuery] = useState('');
  const [validUntil, setValidUntil] = useState(todayValue());
  const [notes, setNotes] = useState('');
  const [proformaItems, setProformaItems] = useState([createEmptyItem()]);
  const [editPassword, setEditPassword] = useState('');

  // Lookup modal de cliente
  const [showClientLookup, setShowClientLookup] = useState(false);
  const [clientLookupQuery, setClientLookupQuery] = useState('');

  // Búsqueda de productos
  const [productId, setProductId] = useState('');

  // Inicializar formulario (Crear vs Editar)
  useEffect(() => {
    if (editingProforma) {
      setClientId(String(editingProforma.clientId || ''));
      setClientCedulaQuery(editingProforma.clientIdentification || '');
      setValidUntil(
        editingProforma.validUntil
          ? editingProforma.validUntil.slice(0, 10)
          : todayValue()
      );
      setNotes(editingProforma.notes || '');

      const mappedItems = editingProforma.items.map((item) => ({
        id_producto: String(item.productId || ''),
        cantidad: Number(item.quantity || 0),
        precio_unitario: Number(item.price || 0),
        descuento: Number(item.discountAmount || 0),
        descuento_porcentaje: Number(item.discountPercent || 0),
        iva_porcentaje: Number(item.taxPercent || 0),
        code: item.code,
        name: item.name,
      }));
      setProformaItems(mappedItems.length > 0 ? mappedItems : [createEmptyItem()]);
      setEditPassword('');
    } else {
      const defaultClient = clients.find(c =>
        String(getClientIdentification(c)) === '9999999999999' ||
        String(getClientIdentification(c)) === '9999999999' ||
        String(getClientName(c)).toLowerCase().includes('consumidor final')
      ) || clients[0] || null;
      setClientId(defaultClient ? String(getClientId(defaultClient)) : '');
      setClientCedulaQuery(
        defaultClient ? getClientIdentification(defaultClient) : ''
      );
      setValidUntil(todayValue());
      setNotes('');
      setProformaItems([createEmptyItem()]);
      setEditPassword('');
    }
  }, [editingProforma, clients]);

  const selectedClient = useMemo(() => {
    return (
      clients.find((c) => String(getClientId(c)) === String(clientId)) || null
    );
  }, [clients, clientId]);

  const daysValid = useMemo(() => {
    const start = new Date(todayValue());
    const end = new Date(validUntil || todayValue());
    const diff = Math.round((end - start) / 86400000);
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  }, [validUntil]);

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

  // Cálculos consolidados en tiempo real para el formulario
  const totals = useMemo(() => {
    let subtotalSinImpuestos = 0;
    let subtotalConIva = 0;
    let subtotalIvaCero = 0;
    let valorIvaTotal = 0;
    let descuentoTotal = 0;

    proformaItems.forEach((item) => {
      if (!item.id_producto) return;
      const { subtotal: base, iva, totalDiscount } = calculateLineAmounts(item);

      subtotalSinImpuestos += base;
      descuentoTotal += totalDiscount;
      if (parseFloat(item.iva_porcentaje) > 0) {
        subtotalConIva += base;
        valorIvaTotal += iva;
      } else {
        subtotalIvaCero += base;
      }
    });

    const total = Math.max(
      subtotalSinImpuestos + valorIvaTotal - descuentoTotal,
      0
    );

    return {
      subtotalSinImpuestos,
      subtotalConIva,
      subtotalIvaCero,
      valorIvaTotal,
      descuentoTotal,
      total,
    };
  }, [proformaItems]);

  const handleClientCedulaSearch = (value) => {
    setClientCedulaQuery(value);
    const query = value.trim();
    if (!query) {
      setClientId('');
      return;
    }

    const foundClient = clients.find(
      (client) => getClientIdentification(client) === query
    );
    if (foundClient) {
      setClientId(String(getClientId(foundClient)));
    } else {
      setClientId('');
    }
  };

  const selectClient = (client) => {
    setClientId(String(getClientId(client)));
    setClientCedulaQuery(getClientIdentification(client));
    setClientLookupQuery('');
    setShowClientLookup(false);
  };

  const applyProductToItem = (item, productIdValue) => {
    const selectedProd = products.find(
      (p) => String(p.id_producto) === String(productIdValue)
    );
    if (!selectedProd) {
      return {
        ...item,
        id_producto: '',
        precio_unitario: 0,
        iva_porcentaje: 0,
      };
    }

    return {
      ...item,
      id_producto: String(selectedProd.id_producto),
      cantidad: item.cantidad || 1,
      precio_unitario: parseFloat(selectedProd.precio_venta) || 0,
      iva_porcentaje: parseFloat(selectedProd.impuesto_porcentaje) || 0,
      code: selectedProd.codigo,
      name: selectedProd.nombre,
    };
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...proformaItems];
    newItems[index][field] = value;

    if (field === 'id_producto') {
      newItems[index] = applyProductToItem(newItems[index], value);
    }

    setProformaItems(newItems);
  };

  const handleProductSearchSelect = (selectedProductId) => {
    if (!selectedProductId) {
      setProductId('');
      return;
    }

    const alreadyAdded = proformaItems.some(
      (item) => String(item.id_producto) === String(selectedProductId)
    );
    if (alreadyAdded) {
      setProductId('');
      return;
    }

    const emptyIndex = proformaItems.findIndex((item) => !item.id_producto);
    if (emptyIndex >= 0) {
      const nextItems = [...proformaItems];
      nextItems[emptyIndex] = applyProductToItem(
        { ...nextItems[emptyIndex], cantidad: 1 },
        selectedProductId
      );
      setProformaItems(nextItems);
    } else {
      setProformaItems((current) => [
        ...current,
        applyProductToItem(createEmptyItem(), selectedProductId),
      ]);
    }

    setProductId('');
  };

  const handleRemoveItemRow = (index) => {
    if (proformaItems.length === 1) {
      setProformaItems([createEmptyItem()]);
      return;
    }
    const newItems = [...proformaItems];
    newItems.splice(index, 1);
    setProformaItems(newItems);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!clientId) return;

    // Filtrar ítems vacíos
    const activeItems = proformaItems.filter((item) => item.id_producto);
    if (activeItems.length === 0) return;

    onSave({
      id_cliente: clientId,
      validUntil,
      notes,
      items: activeItems,
      editPassword, // solo aplica si se está editando
    });
  };

  return (
    <div className="invoice-inline-panel client-data-panel">
      <div className="invoice-inline-body">
        <div className="document-form-header">
          <div>
            <h2>
              {editingProforma ? 'Editar Proforma' : 'Nueva Proforma / Cotización'}
            </h2>
            <p className="invoice-inline-copy">
              Completa los datos de la cotización comercial para tu cliente.
            </p>
          </div>
          <div className="d-flex align-items-start gap-3">
            <div className="text-end">
              <label className="form-label fw-bold mb-1">No. Transaccion</label>
              <input
                className="form-control text-end fw-bold"
                value={transactionNumber}
                readOnly
                disabled
                style={{ maxWidth: '140px' }}
              />
            </div>
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
        <div className="invoice-inline-divider"></div>

        <form onSubmit={handleSubmit}>
          {/* Cabecera */}
          <div className="row mb-2">
            <div className="col-md-3 mb-3">
              <label className="form-label fw-bold">RUC / Cedula</label>
              <div className="client-cedula-search">
                <input
                  className="form-control"
                  value={clientCedulaQuery}
                  onChange={(event) => handleClientCedulaSearch(event.target.value)}
                  placeholder="Buscar por cedula/RUC"
                  required
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowClientLookup(true)}
                  title="Buscar cliente por nombre o RUC"
                  style={{ padding: '0.375rem 0.65rem', display: 'inline-flex', alignItems: 'center' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </button>
              </div>
            </div>

            <div className="col-md-3 mb-3">
              <label className="form-label fw-bold">Cliente *</label>
              <input
                className="form-control"
                value={
                  selectedClient
                    ? getClientName(selectedClient)
                    : 'Sin cliente seleccionado'
                }
                readOnly
                disabled
              />
            </div>

            <div className="col-md-3 mb-3">
              <label className="form-label fw-bold">Fecha Emision</label>
              <input className="form-control" value={todayValue()} readOnly disabled />
            </div>

            <div className="col-md-3 mb-3">
              <label className="form-label fw-bold">Vence *</label>
              <input
                type="date"
                className="form-control"
                value={validUntil}
                onChange={(event) => setValidUntil(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="row mb-2">
            <div className="col-md-3 mb-2">
              <label className="form-label fw-bold">Telefono</label>
              <input
                className="form-control"
                value={getClientPhone(selectedClient)}
                readOnly
                disabled
              />
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label fw-bold">Validez</label>
              <input
                className="form-control"
                value={daysValid + ' dias'}
                readOnly
                disabled
              />
            </div>
            <div className="col-md-6 mb-2">
              <label className="form-label fw-bold">Dirección</label>
              <input
                className="form-control"
                value={getClientAddress(selectedClient)}
                readOnly
                disabled
              />
            </div>
          </div>

          <div className="row mb-2">
            <div className="col-md-3 mb-2">
              <label className="form-label fw-bold">Vendedor</label>
              <input
                className="form-control"
                value={currentUser?.username || ''}
                readOnly
                disabled
              />
            </div>
            <div className="col-md-3 mb-2">
              <label className="form-label fw-bold">Email</label>
              <input
                className="form-control"
                value={getClientEmail(selectedClient)}
                readOnly
                disabled
              />
            </div>
            <div className="col-md-6 mb-2">
              <label className="form-label fw-bold">Observación / Notas</label>
              <textarea
                className="form-control"
                style={{ height: '38px', minHeight: '38px' }}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Notas o términos de validez..."
              />
            </div>
          </div>

          {editingProforma && (
            <div className="row mb-2">
              <div className="col-md-4 mb-3">
                <label className="form-label fw-bold text-danger">Clave para Confirmar Edición *</label>
                <input
                  type="password"
                  className="form-control border-danger"
                  value={editPassword}
                  onChange={(event) => setEditPassword(event.target.value)}
                  placeholder="Tu contraseña actual"
                  required
                />
              </div>
            </div>
          )}

          {/* Renglones / Detalles de la proforma */}
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
              <label className="form-label fw-bold mb-0">
                Detalles de Proforma *
              </label>
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
                  {proformaItems.map((item, index) => {
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

          {/* Totales */}
          <div className="row justify-content-end mb-4">
            <div className="col-md-4">
              <div className="invoice-total-box bg-white">
                <div className="d-flex justify-content-between mb-2">
                  <span>Subtotal sin Impuestos:</span>
                  <span className="fw-semibold">
                    ${totals.subtotalSinImpuestos.toFixed(2)}
                  </span>
                </div>
                <div className="d-flex justify-content-between mb-2">
                  <span>Subtotal IVA Diferenciado:</span>
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
                  <span>Valor IVA:</span>
                  <span>${totals.valorIvaTotal.toFixed(2)}</span>
                </div>
                <hr className="my-2" />
                <div
                  className="d-flex justify-content-between fw-bold text-primary"
                  style={{ fontSize: '1.15rem' }}
                >
                  <span>TOTAL COTIZADO:</span>
                  <span>${totals.total.toFixed(2)}</span>
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
              disabled={!clientId}
            >
              {editingProforma ? 'Guardar Cambios' : 'Emitir Proforma'}
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
              proforma.
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
