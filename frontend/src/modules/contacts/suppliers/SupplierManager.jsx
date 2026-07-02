import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import CIcon from '@coreui/icons-react';
import { cilPencil, cilTrash } from '@coreui/icons';
import { apiFetch, apiUrl } from '../../../lib/api';

export default function SupplierManager() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [saving, setSaving] = useState(false);

  // Campos del formulario
  const [tipoIdentificacion, setTipoIdentificacion] = useState('RUC');
  const [identificacion, setIdentificacion] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [observacion, setObservacion] = useState('');
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleCancel = useCallback(() => {
    if (saving) return;
    setEditingSupplier(null);
    setTipoIdentificacion('RUC');
    setIdentificacion('');
    setNombre('');
    setEmail('');
    setTelefono('');
    setDireccion('');
    setObservacion('');
    setActivo(true);
    setShowForm(false);
  }, [saving]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showForm && !saving) {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showForm, saving, handleCancel]);

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
    setObservacion(supplier.observacion || '');
    setActivo(supplier.activo);
    setShowForm(true);
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
      observacion,
      activo
    };

    const url = editingSupplier 
      ? apiUrl(`/api/suppliers/${editingSupplier.id_proveedor}`) 
      : apiUrl('/api/suppliers');
      
    const method = editingSupplier ? 'PUT' : 'POST';

    try {
      setSaving(true);
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
    } finally {
      setSaving(false);
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
    <div className="module-shell">
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Proveedores</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>Administra los proveedores de productos y suministros.</p>
        </div>
        
        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {filteredSuppliers.length} {filteredSuppliers.length === 1 ? 'registro' : 'registros'}
          </span>
          <button className="btn btn-secondary" onClick={() => setShowForm(true)}>
            + Nuevo proveedor
          </button>
        </div>
      </div>

      <div className="client-data-panel">
        <div className="search-bar-container client-search-wrap">
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
                    <th>Identificación</th>
                    <th>Razón Social</th>
                    <th>Dirección</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th>Observación</th>
                    <th style={{ width: '160px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((s) => (
                    <tr key={s.id_proveedor}>
                      <td>
                        <span className="badge badge-ruc" style={{ marginRight: '0.5rem', backgroundColor: '#ebedef', color: '#4f5d73' }}>{s.tipo_identificacion}</span>
                        <span>{s.identificacion}</span>
                      </td>
                      <td style={{ fontWeight: '600' }}>{s.nombre}</td>
                      <td>{s.direccion || '-'}</td>
                      <td>{s.email}</td>
                      <td>{s.telefono || '-'}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.observacion || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => handleEdit(s)}
                            title="Editar"
                          >
                            <CIcon icon={cilPencil} size="sm" />
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => handleDelete(s.id_proveedor, s.nombre)}
                            title="Eliminar"
                          >
                            <CIcon icon={cilTrash} size="sm" />
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
                    {s.direccion && (
                      <div className="client-card-info-item">
                        <span className="info-label">Dirección:</span>
                        <span className="info-val">{s.direccion}</span>
                      </div>
                    )}
                    <div className="client-card-info-item">
                      <span className="info-label">Correo / Teléfono:</span>
                      <span className="info-val">{s.email} / {s.telefono || '-'}</span>
                    </div>
                    {s.observacion && (
                      <div className="client-card-info-item">
                        <span className="info-label">Observación:</span>
                        <span className="info-val">{s.observacion}</span>
                      </div>
                    )}
                  </div>
                  <div className="client-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleEdit(s)}
                      title="Editar"
                      style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <CIcon icon={cilPencil} size="sm" />
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(s.id_proveedor, s.nombre)}
                      title="Eliminar"
                      style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <CIcon icon={cilTrash} size="sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-container modal-container-clean compact-modal" style={{ maxWidth: '760px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCancel} aria-label="Cerrar formulario">✕</button>
            <h2>{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
            <p className="modal-support-copy">Datos tributarios y contacto principal del proveedor.</p>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem' }}>
                <div className="form-group mb-3" style={{ gridColumn: 'span 4' }}>
                  <label className="form-label">Tipo de identificación *</label>
                  <select
                    className="form-control"
                    value={tipoIdentificacion}
                    onChange={(e) => {
                      setTipoIdentificacion(e.target.value);
                      setIdentificacion('');
                    }}
                  >
                    <option value="RUC">RUC</option>
                    <option value="CEDULA">Cédula</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>

                <div className="form-group mb-3" style={{ gridColumn: 'span 8' }}>
                  <label className="form-label">Número de identificación *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={identificacion} 
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      const nextValue = tipoIdentificacion === 'PASAPORTE'
                        ? rawValue.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
                        : rawValue.replace(/\D/g, '').slice(0, tipoIdentificacion === 'RUC' ? 13 : 10);
                      setIdentificacion(nextValue);
                    }} 
                    placeholder="Ingrese número de identificación"
                    required
                  />
                </div>

                <div className="form-group mb-3" style={{ gridColumn: 'span 12' }}>
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

                <div className="form-group mb-3" style={{ gridColumn: 'span 8' }}>
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

                <div className="form-group mb-3" style={{ gridColumn: 'span 4' }}>
                  <label className="form-label">Teléfono de contacto</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={telefono} 
                    onChange={(e) => setTelefono(e.target.value.replace(/[^\d+]/g, '').slice(0, 15))} 
                    placeholder="Número de teléfono"
                  />
                </div>

                <div className="form-group mb-3" style={{ gridColumn: 'span 12' }}>
                  <label className="form-label">Dirección física</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={direccion} 
                    onChange={(e) => setDireccion(e.target.value)} 
                    placeholder="Dirección del proveedor"
                  />
                </div>

                <div className="form-group mb-3" style={{ gridColumn: 'span 12' }}>
                  <label className="form-label">Observación</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={observacion} 
                    onChange={(e) => setObservacion(e.target.value)} 
                    placeholder="Ingrese alguna observación"
                  />
                </div>

                <div className="form-group mb-3" style={{ gridColumn: 'span 12', display: 'flex', flexDirection: 'column' }}>
                  <label className="form-label">Estado:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                    <input 
                      type="checkbox" 
                      id="activo-sup"
                      checked={activo} 
                      onChange={(e) => setActivo(e.target.checked)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <label htmlFor="activo-sup" style={{ cursor: 'pointer', fontWeight: '500', marginBottom: 0 }}>
                      Proveedor Activo
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-actions-buttons">
                <button type="button" className="btn btn-danger" style={{ backgroundColor: '#f43f5e', color: '#ffffff' }} onClick={handleCancel} disabled={saving}>
                  Cerrar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
