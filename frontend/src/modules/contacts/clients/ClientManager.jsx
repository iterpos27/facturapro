import React, { useState, useEffect, useCallback, useRef } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';
import { showToast } from '../../../lib/toast';
import ClientToolbar from './components/ClientToolbar';
import ClientTable from './components/ClientTable';
import ClientFormModal from './components/ClientFormModal';

const PAGE_SIZE = 50;

export default function ClientManager() {
  const [clients, setClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  // Paginación server-side
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Debounce de búsqueda para no lanzar una query por cada tecla
  const searchTimeout = useRef(null);

  const fetchClients = useCallback(async (currentPage = 1, search = '') => {
    setLoading(true);
    setConnectionError(null);
    try {
      const params = new URLSearchParams({
        page:  String(currentPage),
        limit: String(PAGE_SIZE),
        ...(search ? { search } : {}),
      });
      const response = await apiFetch(`/api/clients?${params}`);
      if (!response.ok) throw new Error('No se pudo conectar con el servidor.');
      const result = await response.json();

      // La API ahora devuelve { data, total, page, limit, pages }
      if (result && Array.isArray(result.data)) {
        setClients(result.data);
        setTotalPages(result.pages || 1);
        setTotalRecords(result.total || 0);
      } else {
        // Compatibilidad si la API devuelve array directo
        setClients(Array.isArray(result) ? result : []);
      }
    } catch (err) {
      setConnectionError(
        'Error al obtener la lista de clientes. Asegurate de tener el backend corriendo.'
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients(1, '');
  }, [fetchClients]);

  // Búsqueda con debounce de 350ms para evitar queries por cada tecla
  const handleSearchChange = (value) => {
    setSearchQuery(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchClients(1, value);
    }, 350);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchClients(newPage, searchQuery);
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingClient(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setEditingClient(null);
    setShowForm(false);
  };

  const handleSaveSuccess = () => {
    handleCloseForm();
    fetchClients(page, searchQuery);
  };

  const handleDelete = async (id, clientName) => {
    const result = await Swal.fire({
      title: 'Estas seguro?',
      text: `Deseas eliminar al cliente "${clientName}"? Esta accion no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#212529',
      confirmButtonColor: '#e55353',
      cancelButtonColor: '#8a93a2',
      iconColor: '#f9b115',
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary',
      },
    });

    if (result.isConfirmed) {
      try {
        const response = await apiFetch(`/api/clients/${id}`, { method: 'DELETE' });
        const resultData = await response.json();
        if (!response.ok) throw new Error(resultData.error || 'No se pudo eliminar el cliente.');
        showToast('Cliente eliminado exitosamente.', 'success');
        fetchClients(page, searchQuery);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  return (
    <div className="module-shell">
      {/* 1. Cabecera externa al panel de datos */}
      <div className="view-header client-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Clientes</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>Administra tu cartera de clientes.</p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {totalRecords} {totalRecords === 1 ? 'registro' : 'registros'}
          </span>
          <button className="btn btn-secondary" onClick={handleAddNew}>
            + Nuevo cliente
          </button>
        </div>
      </div>

      {connectionError && <div className="alert alert-danger">{connectionError}</div>}

      {/* 2. Contenedor del panel principal */}
      <div className="client-data-panel">
        <ClientToolbar searchQuery={searchQuery} setSearchQuery={handleSearchChange} />

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            Cargando clientes...
          </p>
        ) : clients.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', margin: 0 }}>
              {searchQuery ? 'No se encontraron clientes con ese criterio.' : 'No se encontraron clientes registrados.'}
            </p>
          </div>
        ) : (
          <ClientTable clients={clients} onEdit={handleEdit} onDelete={handleDelete} />
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="d-flex justify-content-center align-items-center gap-2 mt-3">
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page <= 1 || loading}
              onClick={() => handlePageChange(page - 1)}
            >
              ‹ Anterior
            </button>
            <span className="text-secondary small">
              Página {page} de {totalPages}
            </span>
            <button
              className="btn btn-sm btn-outline-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => handlePageChange(page + 1)}
            >
              Siguiente ›
            </button>
          </div>
        )}
      </div>

      <ClientFormModal
        isOpen={showForm}
        onClose={handleCloseForm}
        editingClient={editingClient}
        onSaveSuccess={handleSaveSuccess}
      />
    </div>
  );
}
