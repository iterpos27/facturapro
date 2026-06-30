import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiUrl } from '../lib/api';

export default function ClientManager() {
  // 1. ==========================================
  // ESTADOS DE LA APLICACIÓN (STATE)
  // ==========================================

  // Almacena la lista de clientes traídos de la base de datos
  const [clients, setClients] = useState([]);
  
  // Consulta de búsqueda para filtrar clientes
  const [searchQuery, setSearchQuery] = useState('');
  
  // Estados para controlar visualmente la carga y los mensajes persistentes de error
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  // Controla si se muestra la lista o el formulario (Crear/Editar)
  const [showForm, setShowForm] = useState(false);

  // Si se está editando un cliente, almacena su información completa. Si es nulo, estamos creando uno nuevo
  const [editingClient, setEditingClient] = useState(null);

  // Estados específicos para enlazar cada campo del formulario de cliente
  const [name, setName] = useState('');
  const [identificationNumber, setIdentificationNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [observation, setObservation] = useState('');
  const [personType, setPersonType] = useState('NATURAL');

  // 2. ==========================================
  // EFECTOS (EFFECTS) Y PETICIONES API
  // ==========================================

  // useEffect ejecuta fetchClients inmediatamente cuando el componente se carga por primera vez
  useEffect(() => {
    fetchClients();
  }, []);

  // Manejador para cerrar con ESC cuando el modal de formulario esté abierto
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showForm) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showForm]);

  // Obtiene la lista de clientes desde el backend de Node.js
  const fetchClients = async () => {
    setLoading(true);
    setConnectionError(null);
    try {
      const response = await fetch(apiUrl('/api/clients'));
      if (!response.ok) {
        throw new Error('No se pudo conectar con el servidor.');
      }
      const data = await response.json();
      setClients(data);
    } catch (err) {
      setConnectionError('Error al obtener la lista de clientes. Asegúrate de tener el backend corriendo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 3. ==========================================
  // MANEJADORES DE ACCIONES (HANDLERS)
  // ==========================================

  // Utilidad de SweetAlert2 con tema CoreUI Light
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

  // Llena el formulario con los datos del cliente seleccionado para proceder con la edición (PUT)
  const handleEdit = (client) => {
    setEditingClient(client);
    setName(client.name);
    setIdentificationNumber(client.identification_number);
    setEmail(client.email);
    setPhone(client.phone || '');
    setAddress(client.address || '');
    setObservation(client.observation || '');
    setPersonType(client.person_type || 'NATURAL');
    setShowForm(true);
  };

  // Elimina un cliente por su ID haciendo una llamada DELETE a la API del backend
  const handleDelete = async (id, clientName) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar al cliente "${clientName}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#212529',
      confirmButtonColor: '#e55353', // Rojo CoreUI
      cancelButtonColor: '#8a93a2', // Gris CoreUI
      iconColor: '#f9b115', // Amarillo CoreUI
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(apiUrl(`/api/clients/${id}`), {
          method: 'DELETE',
        });
        const resultData = await response.json();
        
        if (!response.ok) {
          throw new Error(resultData.error || 'No se pudo eliminar el cliente.');
        }

        showAlert('Cliente eliminado exitosamente.', 'success');
        fetchClients();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    }
  };

  // Resetea todos los campos del formulario y vuelve a la vista de lista
  const handleCancel = () => {
    setEditingClient(null);
    setName('');
    setIdentificationNumber('');
    setEmail('');
    setPhone('');
    setAddress('');
    setObservation('');
    setPersonType('NATURAL');
    setShowForm(false);
  };

  // Validador local en el frontend antes de enviar datos al servidor
  const validateForm = () => {
    if (!name.trim()) return 'La razón social / nombre es obligatoria.';
    if (!email.trim()) return 'El correo electrónico es obligatorio.';
    if (!identificationNumber.trim()) return 'El número de identificación es obligatorio.';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'El correo electrónico no tiene un formato válido.';

    return null;
  };

  // Procesa el envío del formulario para crear (POST) o actualizar (PUT)
  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      showAlert(validationError, 'error');
      return;
    }

    const clientData = {
      name,
      identification_number: identificationNumber,
      email,
      phone,
      address,
      observation,
      person_type: personType,
    };

    const url = editingClient 
      ? apiUrl(`/api/clients/${editingClient.id}`) 
      : apiUrl('/api/clients');
      
    const method = editingClient ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ocurrió un error inesperado.');
      }

      showAlert(editingClient ? 'Cliente actualizado correctamente.' : 'Cliente registrado exitosamente.', 'success');
      handleCancel();
      fetchClients();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  // Filtrado de clientes basado en la búsqueda del usuario
  const filteredClients = clients.filter(client => {
    const query = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(query) ||
      client.identification_number.includes(query) ||
      client.email.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Gestión de Clientes</h1>
          <p>Módulo para registrar y mantener el padrón de clientes (Códigos SRI).</p>
        </div>
        
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nuevo Cliente
        </button>
      </div>

      {connectionError && <div className="alert alert-danger">{connectionError}</div>}

      {/* SECCIÓN DE BÚSQUEDA Y LISTADO DE CLIENTES (Siempre visible) */}
      <div>
        <div className="search-bar-container">
          <div className="search-input-wrapper">
            <input 
              type="text" 
              className="form-control" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, cédula/RUC o correo..."
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando clientes...</p>
        ) : filteredClients.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No se encontraron clientes registrados.</p>
          </div>
        ) : (
          <div>
            {/* VISTA DE TABLA (SOLO DESKTOP) */}
            <div className="table-responsive desktop-only">
              <table className="table table-striped table-hover align-middle border">
                <thead className="table-light">
                  <tr>
                    <th>Nombre / Razón Social</th>
                    <th>No. Identificación</th>
                    <th>Correo Electrónico</th>
                    <th>Teléfono</th>
                    <th style={{ width: '160px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    return (
                      <tr key={client.id}>
                        <td style={{ fontWeight: '600' }}>{client.name}</td>
                        <td>{client.identification_number}</td>
                        <td>{client.email}</td>
                        <td>{client.phone || '-'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleEdit(client)}
                            >
                              Editar
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleDelete(client.id, client.name)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* VISTA DE TARJETAS (SOLO MOBILE) */}
            <div className="client-cards-container mobile-only">
              {filteredClients.map((client) => {
                return (
                  <div key={client.id} className="client-mobile-card">
                    <div className="client-card-header">
                      <span className="client-name">{client.name}</span>
                    </div>
                    <div className="client-card-body">
                      <div className="client-card-info-item">
                        <span className="info-label">Identificación:</span>
                        <span className="info-val">{client.identification_number}</span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Correo:</span>
                        <span className="info-val">{client.email}</span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Teléfono:</span>
                        <span className="info-val">{client.phone || '-'}</span>
                      </div>
                      {client.address && (
                        <div className="client-card-info-item">
                          <span className="info-label">Dirección:</span>
                          <span className="info-val">{client.address}</span>
                        </div>
                      )}
                    </div>
                    <div className="client-card-actions">
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => handleEdit(client)}
                      >
                        Editar
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => handleDelete(client.id, client.name)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FORMULARIO DE REGISTRO / EDICIÓN EN MODAL */}
      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-container" style={{ maxWidth: '850px' }} onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close-btn" 
              onClick={handleCancel}
              aria-label="Cerrar formulario"
            >
              ✕
            </button>
            <h2>{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
            <div style={{ height: '1.5rem' }}></div>

            <form onSubmit={handleSubmit}>
              {/* FILA 1: Identificación, Razón Social, Correo electrónico */}
              <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="form-group">
                  <label className="form-label">Identificación *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={identificationNumber} 
                    onChange={(e) => setIdentificationNumber(e.target.value)} 
                    placeholder="Ingrese la identificación"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Razón social *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Ingrese Razón social o Nombres"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Correo electrónico *</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="Ingrese email"
                    required
                  />
                </div>
              </div>

              {/* FILA 2: Teléfono, Dirección */}
              <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="Ingrese teléfono"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Dirección</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)} 
                    placeholder="Ingrese la Dirección"
                  />
                </div>
              </div>

              {/* FILA 3: Observación, Tipo de Persona */}
              <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Observación</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={observation} 
                    onChange={(e) => setObservation(e.target.value)} 
                    placeholder="Ingrese alguna observación"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Tipo de Persona:</label>
                  <select 
                    className="form-control" 
                    value={personType} 
                    onChange={(e) => setPersonType(e.target.value)}
                  >
                    <option value="NATURAL">NATURAL</option>
                    <option value="JURIDICA">JURIDICA</option>
                  </select>
                </div>
              </div>

              <div className="form-actions-buttons">
                <button type="button" className="btn btn-danger" style={{ backgroundColor: '#f43f5e', color: '#ffffff' }} onClick={handleCancel}>
                  Cerrar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
