import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';
import ProductSearchInput from '../../../shared/ProductSearchInput';

const todayValue = () => new Date().toISOString().slice(0, 10);

const getClientId = (client) => client?.id_cliente || client?.id || '';
const getClientName = (client) => client?.nombre || client?.name || 'CONSUMIDOR FINAL';
const getClientIdentification = (client) => client?.identificacion || client?.identification_number || '9999999999999';
const getClientPhone = (client) => client?.telefono || client?.phone || '0980811936';
const getClientEmail = (client) => client?.email || '';
const getClientAddress = (client) => client?.direccion || client?.address || '';
const createEmptyItem = () => ({
  id_producto: '',
  cantidad: 1,
  precio_unitario: 0,
  descuento: 0,
  descuento_porcentaje: 0,
  iva_porcentaje: 0
});
const formatTransactionNumber = (value) => String(Number(value) || 0).padStart(6, '0');
const getStatusBadgeClass = (status) => {
  if (status === 'BORRADOR') return 'bg-secondary';
  if (status === 'APROBADA') return 'bg-primary';
  if (status === 'FACTURADA') return 'bg-success';
  if (status === 'ANULADA') return 'bg-danger';
  return 'bg-secondary';
};
const readApiResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return {
    error: text.includes('Cannot ')
      ? 'La ruta de proformas no esta disponible en el backend. Reinicia el servidor.'
      : 'El servidor devolvio una respuesta inesperada.',
  };
};
const calculateLineAmounts = (item) => {
  const quantity = parseFloat(item.cantidad) || 0;
  const price = parseFloat(item.precio_unitario) || 0;
  const taxPercent = parseFloat(item.iva_porcentaje) || 0;
  const discountAmount = parseFloat(item.descuento) || 0;
  const discountPercent = parseFloat(item.descuento_porcentaje) || 0;
  const subtotal = quantity * price;
  const iva = subtotal * (taxPercent / 100);
  const finalBeforeDiscount = subtotal + iva;
  const percentValue = finalBeforeDiscount * (discountPercent / 100);
  const totalDiscount = Math.min(finalBeforeDiscount, discountAmount + percentValue);
  const total = Math.max(finalBeforeDiscount - totalDiscount, 0);

  return {
    quantity,
    price,
    taxPercent,
    discountAmount,
    discountPercent,
    percentValue,
    totalDiscount,
    subtotal,
    iva,
    finalBeforeDiscount,
    total
  };
};

export default function ProformaManager({ onInvoiceProforma }) {
  const [proformas, setProformas] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [viewProforma, setViewProforma] = useState(null);
  const [editingProforma, setEditingProforma] = useState(null);
  const [editPassword, setEditPassword] = useState('');
  const [showClientLookup, setShowClientLookup] = useState(false);
  const [clientCedulaQuery, setClientCedulaQuery] = useState('');
  const [clientLookupQuery, setClientLookupQuery] = useState('');
  const [productId, setProductId] = useState('');
  const [listQuery, setListQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

  // Cabecera
  const [clientId, setClientId] = useState('');
  const [validUntil, setValidUntil] = useState(todayValue());
  const [notes, setNotes] = useState('');

  // Ítems de la proforma (Renglones editables dinámicos)
  const [proformaItems, setProformaItems] = useState([createEmptyItem()]);

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (error) {
        console.warn('No se pudo leer usuario local:', error);
      }
    }

    loadProformas();
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    try {
      const [clientResponse, productResponse] = await Promise.all([
        apiFetch('/api/clients'),
        apiFetch('/api/products'),
      ]);

      if (clientResponse.ok) {
        const clientData = await clientResponse.json();
        setClients(clientData);
        if (clientData.length > 0) {
          setClientId(String(getClientId(clientData[0])));
          setClientCedulaQuery(getClientIdentification(clientData[0]));
        }
      }

      if (productResponse.ok) {
        const productData = await productResponse.json();
        setProducts(productData.filter((product) => product.activo));
      }
    } catch {
      showAlert('No se pudo cargar clientes o productos.', 'error');
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

  const selectedClient = clients.find((client) => String(getClientId(client)) === String(clientId));
  const nextTransactionNumber = useMemo(() => {
    const maxTransaction = proformas.reduce((max, proforma) => {
      const value = Number(proforma.transactionNumber || 0);
      return value > max ? value : max;
    }, 0);
    return formatTransactionNumber(maxTransaction + 1);
  }, [proformas]);
  const transactionNumber = editingProforma?.transactionNumber || nextTransactionNumber;
  const currentDate = todayValue();
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

  const daysValid = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(validUntil || currentDate);
    const diff = Math.round((end - start) / 86400000);
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  }, [currentDate, validUntil]);

  const filteredProformas = useMemo(() => {
    const query = listQuery.trim().toLowerCase();
    return proformas.filter((proforma) => {
      const createdDate = proforma.createdAt ? String(proforma.createdAt).slice(0, 10) : '';
      const matchesQuery = !query
        || String(proforma.number || '').toLowerCase().includes(query)
        || String(proforma.transactionNumber || '').toLowerCase().includes(query)
        || String(proforma.clientName || '').toLowerCase().includes(query)
        || String(proforma.clientIdentification || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || proforma.status === statusFilter;
      const matchesFrom = !dateFromFilter || createdDate >= dateFromFilter;
      const matchesTo = !dateToFilter || createdDate <= dateToFilter;
      return matchesQuery && matchesStatus && matchesFrom && matchesTo;
    });
  }, [proformas, listQuery, statusFilter, dateFromFilter, dateToFilter]);

  const handleRemoveItemRow = (index) => {
    if (proformaItems.length === 1) {
      setProformaItems([
        createEmptyItem()
      ]);
      return;
    }
    const newItems = [...proformaItems];
    newItems.splice(index, 1);
    setProformaItems(newItems);
  };

  const applyProductToItem = (item, productIdValue) => {
    const selectedProd = products.find(p => p.id_producto.toString() === productIdValue.toString());
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

    const alreadyAdded = proformaItems.some((item) => String(item.id_producto) === String(selectedProductId));
    if (alreadyAdded) {
      showAlert('El producto ya esta agregado. Modifica la cantidad en el detalle.', 'info');
      setProductId('');
      return;
    }

    const emptyIndex = proformaItems.findIndex((item) => !item.id_producto);
    if (emptyIndex >= 0) {
      const nextItems = [...proformaItems];
      nextItems[emptyIndex] = applyProductToItem({ ...nextItems[emptyIndex], cantidad: 1 }, selectedProductId);
      setProformaItems(nextItems);
    } else {
      setProformaItems((current) => [
        ...current,
        applyProductToItem(createEmptyItem(), selectedProductId),
      ]);
    }

    setProductId('');
  };

  const handleClientCedulaSearch = (value) => {
    setClientCedulaQuery(value);
    const query = value.trim();
    if (!query) {
      setClientId('');
      return;
    }

    const foundClient = clients.find((client) => getClientIdentification(client) === query);
    if (foundClient) {
      setClientId(String(getClientId(foundClient)));
    } else {
      setClientId('');
    }
  };

  const loadProformas = async () => {
    try {
      const response = await apiFetch('/api/proformas');
      if (!response.ok) {
        throw new Error('No se pudo cargar proformas.');
      }
      const data = await readApiResponse(response);
      setProformas(data);
    } catch (error) {
      console.warn('Error al cargar proformas:', error);
      showAlert('No se pudo cargar el registro de proformas.', 'error');
    }
  };

  const selectClient = (client) => {
    setClientId(String(getClientId(client)));
    setClientCedulaQuery(getClientIdentification(client));
    setClientLookupQuery('');
    setShowClientLookup(false);
  };
  // Cálculos consolidados en tiempo real para el formulario
  const calculateTotals = () => {
    let subtotalSinImpuestos = 0;
    let subtotalConIva = 0;
    let subtotalIvaCero = 0;
    let valorIvaTotal = 0;
    let descuentoTotal = 0;

    proformaItems.forEach(item => {
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

    const total = Math.max(subtotalSinImpuestos + valorIvaTotal - descuentoTotal, 0);

    return {
      subtotalSinImpuestos,
      subtotalConIva,
      subtotalIvaCero,
      valorIvaTotal,
      descuentoTotal,
      total
    };
  };

  const totals = calculateTotals();

  const resetForm = () => {
    setClientId(clients[0] ? String(getClientId(clients[0])) : '');
    setClientCedulaQuery(clients[0] ? getClientIdentification(clients[0]) : '');
    setClientLookupQuery('');
    setProductId('');
    setEditingProforma(null);
    setEditPassword('');
    setValidUntil(todayValue());
    setNotes('');
    setProformaItems([
      createEmptyItem()
    ]);
    setShowForm(false);
  };

  const openForm = () => {
    const defaultClient = clients[0] || null;
    setClientId(defaultClient ? String(getClientId(defaultClient)) : '');
    setClientCedulaQuery(defaultClient ? getClientIdentification(defaultClient) : '');
    setClientLookupQuery('');
    setProductId('');
    setEditingProforma(null);
    setEditPassword('');
    setValidUntil(todayValue());
    setNotes('');
    setProformaItems([
      createEmptyItem()
    ]);
    setShowForm(true);
  };

  const openEditForm = async (proforma) => {
    if (proforma.status !== 'BORRADOR') {
      showAlert('Solo se pueden editar proformas en estado BORRADOR.', 'error');
      return;
    }

    const result = await Swal.fire({
      title: 'Clave requerida',
      text: `Ingresa tu clave para editar la proforma "${proforma.number}".`,
      input: 'password',
      inputPlaceholder: 'Clave del usuario',
      showCancelButton: true,
      confirmButtonText: 'Editar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#8a93a2',
      inputValidator: (value) => (!value ? 'La clave es requerida.' : undefined),
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-secondary'
      }
    });

    if (!result.isConfirmed) return;

    setEditingProforma(proforma);
    setEditPassword(result.value);
    setClientId(String(proforma.clientId || ''));
    setClientCedulaQuery(proforma.clientIdentification || '');
    setClientLookupQuery('');
    setProductId('');
    setValidUntil(proforma.validUntil ? String(proforma.validUntil).slice(0, 10) : todayValue());
    setNotes(proforma.notes || '');
    setProformaItems((proforma.items || []).map((item) => ({
      id_producto: String(item.productId),
      cantidad: item.quantity,
      precio_unitario: item.price,
      descuento: item.discountAmount || 0,
      descuento_porcentaje: item.discountPercent || 0,
      iva_porcentaje: item.taxPercent || 0
    })));
    setShowForm(true);
  };

  const saveProforma = async (event) => {
    event?.preventDefault();

    if (!selectedClient) {
      showAlert('Selecciona un cliente para la proforma.', 'error');
      return;
    }

    // Validar ítems
    const invalidItem = proformaItems.some(item => !item.id_producto || parseFloat(item.cantidad) <= 0 || parseFloat(item.precio_unitario) < 0);
    if (invalidItem) {
      showAlert('Todos los renglones deben contener un producto con cantidad y precio válidos.', 'error');
      return;
    }

    const mappedItems = proformaItems.map(item => {
      const prod = products.find(p => String(p.id_producto) === String(item.id_producto));
      const {
        quantity: qty,
        price,
        taxPercent,
        discountAmount,
        discountPercent,
        totalDiscount,
        subtotal,
        iva,
        total
      } = calculateLineAmounts(item);
      
      return {
        id: `${item.id_producto}-${Date.now()}`,
        productId: item.id_producto,
        code: prod?.codigo || prod?.sku || '-',
        name: prod?.nombre || 'Producto Desconocido',
        quantity: qty,
        price,
        taxPercent,
        discount: totalDiscount,
        discountAmount,
        discountPercent,
        subtotal,
        iva,
        total,
        measure: prod?.referencia || '-',
        brand: prod?.marca || '-',
        stock: Number(prod?.stock_actual || 0)
      };
    });

    const payload = {
      id_cliente: Number(clientId),
      validUntil,
      notes,
      items: mappedItems,
    };

    if (editingProforma) {
      payload.editPassword = editPassword;
    }

    try {
      const response = await apiFetch(editingProforma ? `/api/proformas/${editingProforma.id}` : '/api/proformas', {
        method: editingProforma ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar la proforma.');
      }

      await loadProformas();
      showAlert(editingProforma ? 'Proforma editada con exito.' : 'Proforma creada como borrador.', 'success');
      resetForm();
    } catch (error) {
      showAlert(error.message || 'No se pudo guardar la proforma.', 'error');
    }
  };

  const handleApproveProforma = async (id, proformaNum) => {
    const result = await Swal.fire({
      title: 'Aprobar Proforma',
      text: `Ingresa tu clave para aprobar la proforma "${proformaNum}".`,
      icon: 'question',
      input: 'password',
      inputPlaceholder: 'Clave del usuario',
      showCancelButton: true,
      confirmButtonText: 'Aprobar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#198754',
      cancelButtonColor: '#8a93a2',
      inputValidator: (value) => (!value ? 'La clave es requerida.' : undefined),
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-secondary'
      }
    });

    if (!result.isConfirmed) return;

    try {
      const response = await apiFetch(`/api/proformas/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editPassword: result.value }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo aprobar la proforma.');
      }
      await loadProformas();
      showAlert('Proforma aprobada.', 'success');
    } catch (error) {
      showAlert(error.message || 'No se pudo aprobar la proforma.', 'error');
    }
  };

  const handleCancelProforma = async (id, proformaNum) => {
    const result = await Swal.fire({
      title: 'Anular Proforma',
      text: `Ingresa tu clave para anular la proforma "${proformaNum}".`,
      icon: 'warning',
      input: 'password',
      inputPlaceholder: 'Clave del usuario',
      inputAttributes: { autocapitalize: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e55353',
      cancelButtonColor: '#8a93a2',
      inputValidator: (value) => (!value ? 'La clave es requerida.' : undefined),
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    });

    if (!result.isConfirmed) return;

    const reasonResult = await Swal.fire({
      title: 'Motivo de anulacion',
      input: 'text',
      inputPlaceholder: 'Ej: Cliente solicita cambios',
      showCancelButton: true,
      confirmButtonText: 'Anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e55353',
      cancelButtonColor: '#8a93a2',
      inputValidator: (value) => (!String(value || '').trim() ? 'El motivo es obligatorio.' : undefined),
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    });

    if (!reasonResult.isConfirmed) return;

    try {
      const response = await apiFetch(`/api/proformas/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editPassword: result.value, reason: reasonResult.value || '' }),
      });
      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo anular la proforma.');
      }
      await loadProformas();
      showAlert('Proforma anulada.', 'success');
    } catch (error) {
      showAlert(error.message || 'No se pudo anular la proforma.', 'error');
    }
  };

  const handleInvoiceProforma = (proforma) => {
    localStorage.setItem('facturapro-pending-proforma', proforma.number);
    if (onInvoiceProforma) {
      onInvoiceProforma(proforma.number);
      return;
    }
    showAlert(`Proforma ${proforma.number} lista para facturar.`, 'success');
  };

  return (
    <div className="module-shell">
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Proformas</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>Crea cotizaciones comerciales antes de emitir una factura.</p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {filteredProformas.length} {filteredProformas.length === 1 ? 'registro' : 'registros'}
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => (showForm ? resetForm() : openForm())}>
            {showForm ? 'Ver proformas' : '+ Nueva proforma'}
          </button>
        </div>
      </div>

      {showForm ? (
        <div className="invoice-inline-panel client-data-panel">
          <div className="invoice-inline-body">
            <div className="document-form-header">
              <div>
                <h2>Nueva Proforma / Cotización</h2>
                <p className="invoice-inline-copy">Completa los datos de la cotización comercial para tu cliente.</p>
              </div>
              <div className="d-flex align-items-start gap-3">
                <div className="text-end">
                  <label className="form-label fw-bold mb-1">No. Transaccion</label>
                  <input className="form-control text-end fw-bold" value={transactionNumber} readOnly disabled style={{ maxWidth: '140px' }} />
                </div>
                <button type="button" className="btn btn-outline-danger" onClick={resetForm}>Cerrar</button>
              </div>
            </div>
            <div className="invoice-inline-divider"></div>

            <form onSubmit={saveProforma}>
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
                    <button type="button" className="btn btn-secondary" onClick={() => setShowClientLookup(true)} title="Buscar cliente por nombre o RUC">
                      Buscar
                    </button>
                  </div>
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Cliente *</label>
                  <input className="form-control" value={selectedClient ? getClientName(selectedClient) : 'Sin cliente seleccionado'} readOnly disabled />
                </div>

                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Fecha Emision</label>
                  <input className="form-control" value={currentDate} readOnly disabled />
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
                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Telefono</label>
                  <input className="form-control" value={getClientPhone(selectedClient)} readOnly disabled />
                </div>
                <div className="col-md-3 mb-3">
                  <label className="form-label fw-bold">Validez</label>
                  <input className="form-control" value={daysValid + ' dias'} readOnly disabled />
                </div>
              </div>

              <div className="row mb-2">
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-bold">Dirección</label>
                  <input className="form-control" value={getClientAddress(selectedClient)} readOnly disabled />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label fw-bold">Email</label>
                  <input className="form-control" value={getClientEmail(selectedClient)} readOnly disabled />
                </div>
              </div>

              <div className="row mb-2">
                <div className="col-md-4 mb-3">
                  <label className="form-label fw-bold">Vendedor</label>
                  <input className="form-control" value={currentUser?.username || 'ALBERTO CHINGA'} readOnly disabled />
                </div>
                <div className="col-md-8 mb-3">
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
                  <label className="form-label fw-bold mb-0">Detalles de Proforma *</label>
                </div>

                <div className="table-responsive border rounded bg-light p-1">
                  <table className="table table-sm table-bordered align-middle mb-0" style={{ minWidth: '700px' }}>
                    <thead className="table-secondary">
                      <tr>
                        <th style={{ width: '110px' }}>Codigo</th>
                        <th>Producto / Servicio</th>
                        <th style={{ width: '100px' }}>Cant.</th>
                        <th style={{ width: '120px' }}>P. Unit ($)</th>
                        <th style={{ width: '100px' }}>Desc. ($)</th>
                        <th style={{ width: '100px' }}>Desc. (%)</th>
                        <th style={{ width: '100px' }}>IVA</th>
                        <th style={{ width: '110px' }}>Importe ($)</th>
                        <th style={{ width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {proformaItems.filter((item) => item.id_producto).length === 0 ? (
                        <tr><td colSpan="9" className="text-center text-muted">Busca un producto para agregarlo a la proforma.</td></tr>
                      ) : (
                        proformaItems.map((item, index) => {
                          if (!item.id_producto) return null;
                          const product = products.find((p) => String(p.id_producto) === String(item.id_producto));
                          const { total: lineTotal } = calculateLineAmounts(item);

                          return (
                            <tr key={index}>
                              <td className="text-center fw-bold">{product?.codigo || product?.sku || 'S/C'}</td>
                              <td>
                                <strong>{product?.nombre || 'Producto seleccionado'}</strong>
                                <br />
                                <small className="text-muted">Stock: {Number(product?.stock_actual || 0).toFixed(2)}</small>
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
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  className="form-control form-control-sm text-end"
                                  value={item.descuento_porcentaje}
                                  onChange={(e) => handleItemChange(index, 'descuento_porcentaje', e.target.value)}
                                />
                              </td>
                              <td className="text-center"><span className="badge bg-secondary">{item.iva_porcentaje}%</span></td>
                              <td className="text-end fw-bold">${lineTotal.toFixed(2)}</td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm border-0"
                                  onClick={() => handleRemoveItemRow(index)}
                                >
                                  X
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totales consolidados */}
              <div className="row">
                <div className="col-md-7 mb-3">
                  <div className="bg-light p-3 rounded" style={{ fontSize: '0.85rem' }}>
                    <h6 className="fw-bold">Nota de Proforma</h6>
                    <p className="text-secondary mb-0">
                      Al presionar el botón "Guardar Proforma", la cotización se guardará localmente como un borrador. No afectará el inventario ni generará obligaciones tributarias hasta que se convierta en una factura comercial.
                    </p>
                  </div>
                </div>

                <div className="col-md-5">
                  <div className="border rounded p-2 bg-white shadow-sm">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-secondary">Subtotal:</span>
                      <span>${totals.subtotalSinImpuestos.toFixed(4)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-secondary">Descuento:</span>
                      <span>${totals.descuentoTotal.toFixed(4)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-secondary">Subtotal IVA 0%:</span>
                      <span>${totals.subtotalIvaCero.toFixed(2)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-secondary">Subtotal Neto:</span>
                      <span>${totals.subtotalConIva.toFixed(4)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-secondary">IVA:</span>
                      <span>${totals.valorIvaTotal.toFixed(4)}</span>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-between align-items-center mb-0">
                      <strong className="text-dark">TOTAL:</strong>
                      <h3 className="text-success fw-bold mb-0">${totals.total.toFixed(2)}</h3>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-actions-buttons invoice-actions mt-3">
                <button type="button" className="btn btn-outline-danger" onClick={resetForm}>
                  Cerrar
                </button>
                <button type="submit" className="btn btn-primary client-primary-btn">
                  {editingProforma ? 'Guardar Cambios' : 'Guardar Proforma'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="client-data-panel">
          <div className="row g-2 mb-3">
            <div className="col-md-4">
              <input className="form-control" value={listQuery} onChange={(event) => setListQuery(event.target.value)} placeholder="Buscar por numero, cliente o cedula" />
            </div>
            <div className="col-md-2">
              <select className="form-control" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="ALL">Todos</option>
                <option value="BORRADOR">Borrador</option>
                <option value="APROBADA">Aprobada</option>
                <option value="FACTURADA">Facturada</option>
                <option value="ANULADA">Anulada</option>
              </select>
            </div>
            <div className="col-md-2"><input type="date" className="form-control" value={dateFromFilter} onChange={(event) => setDateFromFilter(event.target.value)} /></div>
            <div className="col-md-2"><input type="date" className="form-control" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} /></div>
            <div className="col-md-2"><button type="button" className="btn btn-secondary w-100" onClick={() => { setListQuery(''); setStatusFilter('ALL'); setDateFromFilter(''); setDateToFilter(''); }}>Limpiar</button></div>
          </div>

          {filteredProformas.length === 0 ? (
            <p className="module-empty-state">Aún no hay proformas. Crea la primera para preparar una venta antes de facturar.</p>
          ) : (
            <div>
              <div className="table-responsive desktop-only">
                <table className="table table-striped table-hover align-middle border">
                  <thead className="table-light">
                    <tr>
                      <th>No. Proforma</th>
                      <th>Cliente</th>
                      <th>Fecha Creación</th>
                      <th>Vence</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th style={{ width: '220px' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProformas.map((proforma) => (
                      <tr key={proforma.id}>
                        <td style={{ fontWeight: 700 }}>{proforma.number}</td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{proforma.clientName}</div>
                          <small className="text-muted">{proforma.clientIdentification}</small>
                        </td>
                        <td>{new Date(proforma.createdAt).toLocaleDateString()}</td>
                        <td>{proforma.validUntil || '-'}</td>
                        <td style={{ fontWeight: 800 }}>${proforma.total.toFixed(2)}</td>
                        <td>
                          <span className={`badge ${getStatusBadgeClass(proforma.status)}`} style={{ fontWeight: 'bold' }}>
                            {proforma.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button 
                              className="btn btn-info text-white" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => setViewProforma(proforma)}
                            >
                              Ver RIDE
                            </button>
                            {proforma.status === 'BORRADOR' && (
                              <>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                  onClick={() => openEditForm(proforma)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                  onClick={() => handleApproveProforma(proforma.id, proforma.number)}
                                >
                                  Aprobar
                                </button>
                              </>
                            )}
                            {['BORRADOR', 'APROBADA'].includes(proforma.status) && (
                              <button
                                className="btn btn-danger"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                onClick={() => handleCancelProforma(proforma.id, proforma.number)}
                              >
                                Anular
                              </button>
                            )}
                            {proforma.status === 'APROBADA' && (
                              <button
                                className="btn btn-success"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                onClick={() => handleInvoiceProforma(proforma)}
                              >
                                Facturar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="client-cards-container mobile-only">
                {filteredProformas.map((proforma) => (
                  <div key={proforma.id} className="client-mobile-card">
                    <div className="client-card-header">
                      <span className="client-name">{proforma.number}</span>
                      <span className={`badge ${getStatusBadgeClass(proforma.status)}`} style={{ fontWeight: 'bold' }}>
                        {proforma.status}
                      </span>
                    </div>
                    <div className="client-card-body">
                      <div className="client-card-info-item">
                        <span className="info-label">Cliente / ID:</span>
                        <span className="info-val">{proforma.clientName} ({proforma.clientIdentification})</span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Fecha / Total:</span>
                        <span className="info-val">{new Date(proforma.createdAt).toLocaleDateString()} / <strong>${proforma.total.toFixed(2)}</strong></span>
                      </div>
                    </div>
                    <div className="client-card-actions">
                      <button className="btn btn-info text-white" onClick={() => setViewProforma(proforma)}>Ver RIDE</button>
                      {proforma.status === 'BORRADOR' && <button className="btn btn-secondary" onClick={() => openEditForm(proforma)}>Editar</button>}
                      {proforma.status === 'BORRADOR' && <button className="btn btn-primary" onClick={() => handleApproveProforma(proforma.id, proforma.number)}>Aprobar</button>}
                      {['BORRADOR', 'APROBADA'].includes(proforma.status) && <button className="btn btn-danger" onClick={() => handleCancelProforma(proforma.id, proforma.number)}>Anular</button>}
                      {proforma.status === 'APROBADA' && <button className="btn btn-success" onClick={() => handleInvoiceProforma(proforma)}>Facturar</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showClientLookup && (
        <div className="modal-overlay" onClick={() => setShowClientLookup(false)}>
          <div className="modal-container modal-container-clean compact-modal" style={{ maxWidth: '720px' }} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowClientLookup(false)} aria-label="Cerrar buscador">X</button>
            <h2>Buscar Cliente</h2>
            <p className="modal-support-copy">Busca por nombre, RUC o cedula y selecciona el cliente para la proforma.</p>

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
                <p className="module-empty-state">Escribe al menos 2 caracteres para buscar.</p>
              ) : clientLookupResults.length === 0 ? (
                <p className="module-empty-state">No se encontraron clientes.</p>
              ) : (
                clientLookupResults.map((client) => (
                  <button type="button" key={getClientId(client)} className="client-lookup-option" onClick={() => selectClient(client)}>
                    <strong>{getClientName(client)}</strong>
                    <span>{getClientIdentification(client)} | {getClientPhone(client)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE PROFORMA / VISTA TICKET COTIZACION */}
      {viewProforma && (
        <div className="modal-overlay" onClick={() => setViewProforma(null)}>
          <div className="modal-container text-dark" style={{ maxWidth: '800px', width: '95%', fontFamily: 'Courier New, Courier, monospace' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setViewProforma(null)} aria-label="Cerrar proforma">✕</button>
            
            {/* Cabecera Cotización */}
            <div className="text-center mb-4">
              <h3 className="fw-bold m-0">COTIZACIÓN COMERCIAL</h3>
              <h5 className="m-0">DOCUMENTO PROFORMA</h5>
              <div style={{ borderTop: '2px dashed #000', margin: '0.75rem 0' }}></div>
            </div>

            <div className="row small mb-3">
              <div className="col-md-6 mb-2">
                <div><strong>EMISOR:</strong></div>
                <div>FACTURAPRO S.A.</div>
                <div>RUC: 1792345678001</div>
                <div>Matriz: Av. Amazonas N32-156 y Av. Mariana de Jesús</div>
                <div>Establecimiento: MATRIZ (001-001)</div>
                <div>Obligado a llevar contabilidad: SI</div>
              </div>
              <div className="col-md-6 mb-2">
                <div><strong>No. PROFORMA:</strong></div>
                <div className="fw-bold" style={{ fontSize: '1.05rem' }}>{viewProforma.number}</div>
                <div>Fecha de Emisión: {new Date(viewProforma.createdAt).toLocaleString()}</div>
                <div>Vence: {viewProforma.validUntil || '-'}</div>
                <div>Estado: <span className="badge bg-secondary">{viewProforma.status}</span></div>
                <div>No. Transacción: {viewProforma.transactionNumber}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>

            {/* Datos Cliente */}
            <div className="small mb-3">
              <div><strong>RAZÓN SOCIAL CLIENTE:</strong> {viewProforma.clientName}</div>
              <div><strong>RUC/CÉDULA:</strong> {viewProforma.clientIdentification}</div>
              <div><strong>DIRECCIÓN:</strong> {viewProforma.clientAddress || 'S/D'}</div>
              <div><strong>TELÉFONO:</strong> {viewProforma.clientPhone || 'S/D'}</div>
              <div><strong>EMAIL:</strong> {viewProforma.clientEmail || 'S/D'}</div>
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
                  <th className="text-end">Desc. $</th>
                  <th className="text-end">Desc. %</th>
                  <th className="text-end">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewProforma.items.map((d, index) => (
                  <tr key={d.id || index}>
                    <td>{d.code}</td>
                    <td>{parseFloat(d.quantity).toFixed(2)}</td>
                    <td>{d.name}</td>
                    <td className="text-end">${parseFloat(d.price).toFixed(2)}</td>
                    <td className="text-end">${parseFloat(d.discountAmount ?? d.discount ?? 0).toFixed(2)}</td>
                    <td className="text-end">{parseFloat(d.discountPercent ?? 0).toFixed(2)}%</td>
                    <td className="text-end">${parseFloat(d.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>

            {/* Resumen de totales */}
            <div className="row small">
              <div className="col-7">
                {viewProforma.notes && (
                  <div>
                    <div><strong>OBSERVACIONES:</strong></div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{viewProforma.notes}</div>
                  </div>
                )}
              </div>
              <div className="col-5">
                <div className="d-flex justify-content-between">
                  <span>Subtotal:</span>
                  <span>${parseFloat(viewProforma.subtotal).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>Descuento:</span>
                  <span>${parseFloat(viewProforma.discount || 0).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between">
                  <span>IVA:</span>
                  <span>${parseFloat(viewProforma.iva).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between fw-bold" style={{ fontSize: '1rem', borderTop: '1px double #000', paddingTop: '2px' }}>
                  <span>TOTAL COTIZADO:</span>
                  <span>${parseFloat(viewProforma.total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '2px dashed #000', margin: '1rem 0 0.5rem' }}></div>
            <div className="text-center small text-secondary">
              ¡Gracias por preferirnos! Esta proforma no representa una factura ni un comprobante fiscal.
            </div>

            <div className="form-actions-buttons border-top pt-3 mt-3">
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                🖨️ Imprimir Cotización
              </button>
              <button type="button" className="btn btn-danger" style={{ backgroundColor: '#f43f5e', color: '#ffffff' }} onClick={() => setViewProforma(null)}>
                Cerrar Vista
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
