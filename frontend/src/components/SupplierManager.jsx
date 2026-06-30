import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiFetch, apiUrl } from '../lib/api';

export default function SupplierManager() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);

  // Campos del formulario
  const [tipoIdentificacion, setTipoIdentificacion] = useState('RUC');
  const [identificacion, setIdentificacion] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/suppliers');
      if (!response.ok) throw new Error('Error al conectar con la base de datos.');
      const data = await response.json();
      setSuppliers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
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

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setTipoIdentificacion(supplier.tipo_identificacion);
    setIdentificacion(supplier.identificacion);
    setNombre(supplier.nombre);
    setEmail(supplier.email);
    setTelefono(supplier.telefono || '');
    setDireccion(supplier.direccion || '');
    setActivo(supplier.activo);
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingSupplier(null);
    setTipoIdentificacion('RUC');
    setIdentificacion('');
    setNombre('');
    setEmail('');
    setTelefono('');
    setDireccion('');
    setActivo(true);
    setShowForm(false);
  };

  const handleDelete = async (id, sName) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar al proveedor "${sName}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#212529',
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
        const response = await apiFetch(`/api/suppliers/${id}`, {
          method: 'DELETE',
        });
        const resultData = await response.json();
        
        if (!response.ok) throw new Error(resultData.error || 'No se pudo eliminar al proveedor.');

        showAlert('Proveedor eliminado exitosamente.', 'success');
        fetchSuppliers();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    }
  };

  const validateForm = () => {
    if (!identificacion.trim()) return 'La identificación es obligatoria.';
    if (tipoIdentificacion === 'RUC' && identificacion.length !== 13) {
      return 'El RUC debe contener exactamente 13 dígitos.';
    }
    if (tipoIdentificacion === 'CEDULA' && identificacion.length !== 10) {
      return 'La cédula debe contener exactamente 10 dígitos.';
    }
    if (!nombre.trim()) return 'El nombre o razón social es obligatorio.';
    if (!email.trim() || !email.includes('@')) return 'El correo electrónico debe ser válido.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const err = validateForm();
    if (err) {
      showAlert(err, 'error');
      return;
    }

    const supplierData = {
      tipo_identificacion: tipoIdentificacion,
      identificacion,
      nombre,
      email,
      telefono,
      direccion,
      activo
    };

    const url = editingSupplier 
      ? apiUrl(`/api/suppliers/${editingSupplier.id_proveedor}`) 
      : apiUrl('/api/suppliers');
      
    const method = editingSupplier ? 'PUT' : 'POST';

    try {
      const response = await apiFetch(url.replace(/^https?:\/\/[^/]+/, ''), {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(supplierData),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Ocurrió un error inesperado.');

      showAlert(editingSupplier ? 'Proveedor actualizado correctamente.' : 'Proveedor registrado exitosamente.', 'success');
      handleCancel();
      fetchSuppliers();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    const query = searchQuery.toLowerCase();
    return (
      s.nombre.toLowerCase().includes(query) ||
      s.identificacion.includes(query) ||
      s.email.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Catálogo de Proveedores</h1>
          <p>Módulo para registrar y mantener a los proveedores de productos y suministros.</p>
        </div>
        
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nuevo Proveedor
        </button>
      </div>

      <div>
        <div className="search-bar-container">
          <div className="search-input-wrapper">
            <input 
              type="text" 
              className="form-control" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar proveedores por nombre, identificación o correo..."
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando proveedores...</p>
        ) : filteredSuppliers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', margin: 0 }}>
              No se encontraron proveedores registrados.
            </p>
          </div>
        ) : (
          <div>
            <div className="table-responsive desktop-only">
              <table className="table table-striped table-hover align-middle border">
                <thead className="table-light">
                  <tr>
                    <th>Nombre / Razón Social</th>
                    <th>Tipo Doc. / No. Identificación</th>
                    <th>Correo Electrónico</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th style={{ width: '160px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((s) => (
                    <tr key={s.id_proveedor}>
                      <td style={{ fontWeight: '600' }}>{s.nombre}</td>
                      <td>
                        <span className="badge badge-ruc" style={{ marginRight: '0.5rem', backgroundColor: '#ebedef', color: '#4f5d73' }}>{s.tipo_identificacion}</span>
                        <span>{s.identificacion}</span>
                      </td>
                      <td>{s.email}</td>
                      <td>{s.telefono || '-'}</td>
                      <td>
                        <span className={`badge ${s.activo ? 'badge-cedula' : 'badge-consumidor'}`} style={{ backgroundColor: s.activo ? '#d2f4ea' : '#f8d7da', color: s.activo ? '#14a44d' : '#dc3545' }}>
                          {s.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleEdit(s)}
                          >
                            Editar
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleDelete(s.id_proveedor, s.nombre)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="client-cards-container mobile-only">
              {filteredSuppliers.map((s) => (
                <div key={s.id_proveedor} className="client-mobile-card">
                  <div className="client-card-header">
                    <span className="client-name">{s.nombre}</span>
                    <span className={`badge ${s.activo ? 'badge-cedula' : 'badge-consumidor'}`} style={{ backgroundColor: s.activo ? '#d2f4ea' : '#f8d7da', color: s.activo ? '#14a44d' : '#dc3545' }}>
                      {s.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="client-card-body">
                    <div className="client-card-info-item">
                      <span className="info-label">Identificación ({s.tipo_identificacion}):</span>
                      <span className="info-val">{s.identificacion}</span>
                    </div>
                    <div className="client-card-info-item">
                      <span className="info-label">Correo / Teléfono:</span>
                      <span className="info-val">{s.email} / {s.telefono || '-'}</span>
                    </div>
                  </div>
                  <div className="client-card-actions">
                    <button className="btn btn-secondary" onClick={() => handleEdit(s)}>Editar</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(s.id_proveedor, s.nombre)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-container" style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCancel} aria-label="Cerrar formulario">✕</button>
            <h2>{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
            <div style={{ height: '1.5rem' }}></div>

            <form onSubmit={handleSubmit}>
              <div className="row mb-3">
                <div className="col-md-4">
                  <div className="form-group mb-3">
                    <label className="form-label">Tipo de identificación *</label>
                    <select
                      className="form-control"
                      value={tipoIdentificacion}
                      onChange={(e) => setTipoIdentificacion(e.target.value)}
                    >
                      <option value="RUC">RUC</option>
                      <option value="CEDULA">Cédula</option>
                      <option value="PASAPORTE">Pasaporte</option>
                    </select>
                  </div>
                </div>

                <div className="col-md-8">
                  <div className="form-group mb-3">
                    <label className="form-label">Número de identificación *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={identificacion} 
                      onChange={(e) => setIdentificacion(e.target.value.replace(/\D/g, ''))} 
                      placeholder="Ingrese número de identificación"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Nombre / Razón Social *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={nombre} 
                  onChange={(e) => setNombre(e.target.value)} 
                  placeholder="Ingrese nombre de la empresa proveedora"
                  required
                />
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Correo electrónico *</label>
                    <input 
                      type="email" 
                      className="form-control" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="ej: contacto@proveedor.com"
                      required
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Teléfono de contacto</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={telefono} 
                      onChange={(e) => setTelefono(e.target.value)} 
                      placeholder="Número de teléfono"
                    />
                  </div>
                </div>
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Dirección física</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={direccion} 
                  onChange={(e) => setDireccion(e.target.value)} 
                  placeholder="Dirección del proveedor"
                />
              </div>

              <div className="form-group mb-3" style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="form-label">Estado:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                  <input 
                    type="checkbox" 
                    id="activo-sup"
                    checked={activo} 
                    onChange={(e) => setActivo(e.target.checked)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <label htmlFor="activo-sup" style={{ cursor: 'pointer', fontWeight: '500' }}>
                    Proveedor Activo
                  </label>
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
