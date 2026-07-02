import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';
import ProformaTable from './components/ProformaTable';
import ProformaToolbar from './components/ProformaToolbar';
import ProformaRideModal from './components/ProformaRideModal';
import ProformaFormModal from './components/ProformaFormModal';

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

export default function ProformaManager({ onInvoiceProforma }) {
  const [proformas, setProformas] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [viewProforma, setViewProforma] = useState(null);
  const [editingProforma, setEditingProforma] = useState(null);

  // Filtros de búsqueda
  const [listQuery, setListQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');

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

  const loadMetadata = async () => {
    try {
      const [clientResponse, productResponse] = await Promise.all([
        apiFetch('/api/clients'),
        apiFetch('/api/products'),
      ]);

      if (clientResponse.ok) {
        const clientData = await clientResponse.json();
        setClients(clientData);
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
        popup: 'swal-custom-toast',
      },
    });
    Toast.fire({
      icon: type,
      title: message,
    });
  };

  // Filtrado de proformas para el listado
  const filteredProformas = useMemo(() => {
    const query = listQuery.trim().toLowerCase();
    return proformas.filter((proforma) => {
      const createdDate = proforma.createdAt ? String(proforma.createdAt).slice(0, 10) : '';
      const matchesQuery =
        !query ||
        String(proforma.number || '').toLowerCase().includes(query) ||
        String(proforma.transactionNumber || '').toLowerCase().includes(query) ||
        String(proforma.clientName || '').toLowerCase().includes(query) ||
        String(proforma.clientIdentification || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || proforma.status === statusFilter;
      const matchesFrom = !dateFromFilter || createdDate >= dateFromFilter;
      const matchesTo = !dateToFilter || createdDate <= dateToFilter;
      return matchesQuery && matchesStatus && matchesFrom && matchesTo;
    });
  }, [proformas, listQuery, statusFilter, dateFromFilter, dateToFilter]);

  // Siguiente número correlativo para la UI
  const nextTransactionNumber = useMemo(() => {
    const maxTransaction = proformas.reduce((max, proforma) => {
      const value = Number(proforma.transactionNumber || 0);
      return value > max ? value : max;
    }, 0);
    return String(maxTransaction + 1).padStart(6, '0');
  }, [proformas]);

  const transactionNumber = editingProforma?.transactionNumber || nextTransactionNumber;

  const handleOpenCreateForm = () => {
    setEditingProforma(null);
    setShowForm(true);
  };

  const handleOpenEditForm = async (proforma) => {
    if (proforma.status !== 'BORRADOR') {
      showAlert('Solo se pueden editar proformas en estado BORRADOR.', 'error');
      return;
    }
    setEditingProforma(proforma);
    setShowForm(true);
  };

  const handleSaveProforma = async (formData) => {
    const isEdit = !!editingProforma;
    const url = isEdit ? `/api/proformas/${editingProforma.id_proforma}` : '/api/proformas';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await readApiResponse(response);
      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error al guardar la proforma.');
      }

      showAlert(
        isEdit ? 'Proforma actualizada con éxito.' : 'Proforma emitida con éxito.',
        'success'
      );
      setShowForm(false);
      setEditingProforma(null);
      await loadProformas();
    } catch (error) {
      showAlert(error.message, 'error');
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
        cancelButton: 'btn btn-secondary',
      },
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
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e55353',
      cancelButtonColor: '#8a93a2',
      inputValidator: (value) => (!value ? 'La clave es requerida.' : undefined),
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary',
      },
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
        cancelButton: 'btn btn-secondary',
      },
    });

    if (!reasonResult.isConfirmed) return;

    try {
      const response = await apiFetch(`/api/proformas/${id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editPassword: result.value,
          reason: reasonResult.value || '',
        }),
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

  const handleClearFilters = () => {
    setListQuery('');
    setStatusFilter('ALL');
    setDateFromFilter('');
    setDateToFilter('');
  };

  return (
    <div className="module-shell">
      {/* Header */}
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>
            Proformas
          </h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>
            Crea cotizaciones comerciales antes de emitir una factura.
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {filteredProformas.length}{' '}
            {filteredProformas.length === 1 ? 'registro' : 'registros'}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => (showForm ? setShowForm(false) : handleOpenCreateForm())}
          >
            {showForm ? 'Ver proformas' : '+ Nueva proforma'}
          </button>
        </div>
      </div>

      {showForm ? (
        <ProformaFormModal
          clients={clients}
          products={products}
          editingProforma={editingProforma}
          currentUser={currentUser}
          transactionNumber={transactionNumber}
          onSave={handleSaveProforma}
          onClose={() => {
            setShowForm(false);
            setEditingProforma(null);
          }}
        />
      ) : (
        <>
          <ProformaToolbar
            listQuery={listQuery}
            setListQuery={setListQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            dateFromFilter={dateFromFilter}
            setDateFromFilter={setDateFromFilter}
            dateToFilter={dateToFilter}
            setDateToFilter={setDateToFilter}
            onClear={handleClearFilters}
          />
          <ProformaTable
            proformas={filteredProformas}
            onViewRide={setViewProforma}
            onEdit={handleOpenEditForm}
            onApprove={handleApproveProforma}
            onCancel={handleCancelProforma}
            onInvoice={handleInvoiceProforma}
          />
        </>
      )}

      {viewProforma && (
        <ProformaRideModal
          viewProforma={viewProforma}
          onClose={() => setViewProforma(null)}
        />
      )}
    </div>
  );
}
