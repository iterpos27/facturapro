import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiFetch, apiUrl } from '../lib/api';

export default function BranchManager() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  // Campos del formulario
  const [codigoEstablecimiento, setCodigoEstablecimiento] = useState('');
  const [puntoEmision, setPuntoEmision] = useState('');
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/branches');
      if (!response.ok) throw new Error('Error al conectar con la base de datos.');
      const data = await response.json();
      setBranches(data);
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

  const handleEdit = (branch) => {
    setEditingBranch(branch);
    setCodigoEstablecimiento(branch.codigo_establecimiento);
    setPuntoEmision(branch.punto_emision);
    setNombre(branch.nombre);
    setDireccion(branch.direccion);
    setActivo(branch.activo);
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingBranch(null);
    setCodigoEstablecimiento('');
    setPuntoEmision('');
    setNombre('');
    setDireccion('');
    setActivo(true);
    setShowForm(false);
  };

  const handleDelete = async (id, bName) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar la sucursal "${bName}"? Esta acción no se puede deshacer.`,
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
        const response = await apiFetch(`/api/branches/${id}`, {
          method: 'DELETE',
        });
        const resultData = await response.json();
        
        if (!response.ok) throw new Error(resultData.error || 'No se pudo eliminar.');

        showAlert('Sucursal/Establecimiento eliminado correctamente.', 'success');
        fetchBranches();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!codigoEstablecimiento.trim() || codigoEstablecimiento.length !== 3) {
      showAlert('El código de establecimiento debe tener 3 dígitos (ej: 001).', 'error');
      return;
    }

    if (!puntoEmision.trim() || puntoEmision.length !== 3) {
      showAlert('El punto de emisión debe tener 3 dígitos (ej: 001).', 'error');
      return;
    }

    if (!nombre.trim() || !direccion.trim()) {
      showAlert('El nombre y la dirección de la sucursal son campos obligatorios.', 'error');
      return;
    }

    const branchData = {
      codigo_establecimiento: codigoEstablecimiento,
      punto_emision: puntoEmision,
      nombre,
      direccion,
      activo
    };

    const url = editingBranch 
      ? apiUrl(`/api/branches/${editingBranch.id_sucursal}`) 
      : apiUrl('/api/branches');
      
    const method = editingBranch ? 'PUT' : 'POST';

    try {
      const response = await apiFetch(url.replace(/^https?:\/\/[^/]+/, ''), {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(branchData),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Ocurrió un error inesperado.');

      showAlert(editingBranch ? 'Sucursal actualizada correctamente.' : 'Sucursal registrada exitosamente.', 'success');
      handleCancel();
      fetchBranches();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  const filteredBranches = branches.filter(b => {
    const query = searchQuery.toLowerCase();
    return (
      b.nombre.toLowerCase().includes(query) ||
      b.direccion.toLowerCase().includes(query) ||
      b.codigo_establecimiento.includes(query) ||
      b.punto_emision.includes(query)
    );
  });

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Establecimientos y Puntos de Emisión</h1>
          <p>Módulo para definir las sucursales físicas y cajas autorizadas para emitir comprobantes SRI.</p>
        </div>
        
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nuevo Establecimiento
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
              placeholder="Buscar sucursales por código, nombre o dirección..."
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando sucursales...</p>
        ) : filteredBranches.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', margin: 0 }}>
              No se encontraron establecimientos registrados.
            </p>
          </div>
        ) : (
          <div>
            <div className="table-responsive desktop-only">
              <table className="table table-striped table-hover align-middle border">
                <thead className="table-light">
                  <tr>
                    <th>Código Establecimiento</th>
                    <th>Punto de Emisión</th>
                    <th>Nombre Sucursal</th>
                    <th>Dirección</th>
                    <th>Estado</th>
                    <th style={{ width: '160px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBranches.map((b) => (
                    <tr key={b.id_sucursal}>
                      <td style={{ fontWeight: '600', textAlign: 'center' }}>{b.codigo_establecimiento}</td>
                      <td style={{ fontWeight: '600', textAlign: 'center' }}>{b.punto_emision}</td>
                      <td>{b.nombre}</td>
                      <td>{b.direccion}</td>
                      <td>
                        <span className={`badge ${b.activo ? 'badge-cedula' : 'badge-consumidor'}`} style={{ backgroundColor: b.activo ? '#d2f4ea' : '#f8d7da', color: b.activo ? '#14a44d' : '#dc3545' }}>
                          {b.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleEdit(b)}
                          >
                            Editar
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleDelete(b.id_sucursal, b.nombre)}
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
              {filteredBranches.map((b) => (
                <div key={b.id_sucursal} className="client-mobile-card">
                  <div className="client-card-header">
                    <span className="client-name">{b.nombre}</span>
                    <span className={`badge ${b.activo ? 'badge-cedula' : 'badge-consumidor'}`} style={{ backgroundColor: b.activo ? '#d2f4ea' : '#f8d7da', color: b.activo ? '#14a44d' : '#dc3545' }}>
                      {b.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="client-card-body">
                    <div className="client-card-info-item">
                      <span className="info-label">Código Establecimiento / Emisión:</span>
                      <span className="info-val"><strong>{b.codigo_establecimiento} - {b.punto_emision}</strong></span>
                    </div>
                    <div className="client-card-info-item">
                      <span className="info-label">Dirección:</span>
                      <span className="info-val">{b.direccion}</span>
                    </div>
                  </div>
                  <div className="client-card-actions">
                    <button className="btn btn-secondary" onClick={() => handleEdit(b)}>Editar</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(b.id_sucursal, b.nombre)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-container" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCancel} aria-label="Cerrar formulario">✕</button>
            <h2>{editingBranch ? 'Editar Establecimiento' : 'Nuevo Establecimiento'}</h2>
            <div style={{ height: '1.5rem' }}></div>

            <form onSubmit={handleSubmit}>
              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="form-group">
                    <label className="form-label">Código del establecimiento *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={codigoEstablecimiento} 
                      onChange={(e) => setCodigoEstablecimiento(e.target.value.replace(/\D/g, '').substring(0, 3))} 
                      placeholder="ej: 001"
                      required
                    />
                    <small className="text-muted">3 dígitos exactos asignados por el SRI.</small>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-group">
                    <label className="form-label">Punto de emisión *</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={puntoEmision} 
                      onChange={(e) => setPuntoEmision(e.target.value.replace(/\D/g, '').substring(0, 3))} 
                      placeholder="ej: 001"
                      required
                    />
                    <small className="text-muted">3 dígitos exactos asignados por el SRI.</small>
                  </div>
                </div>
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Nombre del establecimiento *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={nombre} 
                  onChange={(e) => setNombre(e.target.value)} 
                  placeholder="ej: Sucursal Norte, Local Comercial 1"
                  required
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Dirección física del establecimiento *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={direccion} 
                  onChange={(e) => setDireccion(e.target.value)} 
                  placeholder="Dirección completa"
                  required
                />
              </div>

              <div className="form-group mb-3" style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="form-label">Estado:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                  <input 
                    type="checkbox" 
                    id="activo-br"
                    checked={activo} 
                    onChange={(e) => setActivo(e.target.checked)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <label htmlFor="activo-br" style={{ cursor: 'pointer', fontWeight: '500' }}>
                    Establecimiento Activo
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
