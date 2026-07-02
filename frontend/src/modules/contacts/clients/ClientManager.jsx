import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';
import { showToast } from '../../../lib/toast';
import ClientToolbar from './components/ClientToolbar';
import ClientTable from './components/ClientTable';
import ClientFormModal from './components/ClientFormModal';

export default function ClientManager() {
  const [clients, setClients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    setConnectionError(null);
    try {
      const response = await apiFetch('/api/clients');
      if (!response.ok) {
        throw new Error('No se pudo conectar con el servidor.');
      }
      const data = await response.json();
      setClients(data);
    } catch (err) {
      setConnectionError(
        'Error al obtener la lista de clientes. Asegurate de tener el backend corriendo.'
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
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
    fetchClients();
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
        const response = await apiFetch(`/api/clients/${id}`, {
          method: 'DELETE',
        });
        const resultData = await response.json();

        if (!response.ok) {
          throw new Error(resultData.error || 'No se pudo eliminar el cliente.');
        }

        showToast('Cliente eliminado exitosamente.', 'success');
        fetchClients();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  const filteredClients = clients.filter((client) => {
    const query = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(query) ||
      client.identification_number.includes(query) ||
      client.email.toLowerCase().includes(query)
    );
  });

  return (
    <div className="module-shell">
      {/* 1. Cabecera externa al panel de datos (Diseño AsistePro) */}
      <div className="view-header client-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Clientes</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>Administra tu cartera de clientes.</p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {filteredClients.length} {filteredClients.length === 1 ? 'registro' : 'registros'}
          </span>
          <button
            className="btn btn-secondary"
            onClick={handleAddNew}
          >
            + Nuevo cliente
          </button>
        </div>
      </div>

      {connectionError && <div className="alert alert-danger">{connectionError}</div>}

      {/* 2. Contenedor del panel principal que unifica la búsqueda y la tabla */}
      <div className="client-data-panel">
        <ClientToolbar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            Cargando clientes...
          </p>
        ) : filteredClients.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', margin: 0 }}>
              No se encontraron clientes registrados.
            </p>
          </div>
        ) : (
          <ClientTable
            clients={filteredClients}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
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
