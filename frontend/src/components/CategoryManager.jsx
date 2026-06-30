import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiUrl } from '../lib/api';

export default function CategoryManager() {
  // 1. ==========================================
  // ESTADOS (STATE)
  // ==========================================
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  // Campos del formulario
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [activo, setActivo] = useState(true);

  // 2. ==========================================
  // EFECTOS (EFFECTS)
  // ==========================================
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/categories'));
      if (!response.ok) throw new Error('Error al conectar con la base de datos.');
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 3. ==========================================
  // MANEJADORES (HANDLERS)
  // ==========================================
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

  const handleEdit = (category) => {
    setEditingCategory(category);
    setNombre(category.nombre);
    setDescripcion(category.descripcion || '');
    setActivo(category.activo);
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingCategory(null);
    setNombre('');
    setDescripcion('');
    setActivo(true);
    setShowForm(false);
  };

  const handleDelete = async (id, catName) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar la categoría "${catName}"? Los productos vinculados pasarán a no tener categoría.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#212529',
      confirmButtonColor: '#e55353',
      cancelButtonColor: '#8a93a2',
      iconColor: '#f9b115',
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(apiUrl(`/api/categories/${id}`), {
          method: 'DELETE',
        });
        const resultData = await response.json();
        
        if (!response.ok) throw new Error(resultData.error || 'No se pudo eliminar.');

        showAlert('Categoría eliminada exitosamente.', 'success');
        fetchCategories();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nombre.trim()) {
      showAlert('El nombre de la categoría es obligatorio.', 'error');
      return;
    }

    const categoryData = {
      nombre,
      descripcion,
      activo
    };

    const url = editingCategory 
      ? apiUrl(`/api/categories/${editingCategory.id_categoria}`) 
      : apiUrl('/api/categories');
      
    const method = editingCategory ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(categoryData),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Ocurrió un error inesperado.');

      showAlert(editingCategory ? 'Categoría actualizada correctamente.' : 'Categoría registrada exitosamente.', 'success');
      handleCancel();
      fetchCategories();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  const filteredCategories = categories.filter(cat => {
    const query = searchQuery.toLowerCase();
    return (
      cat.nombre.toLowerCase().includes(query) ||
      (cat.descripcion && cat.descripcion.toLowerCase().includes(query))
    );
  });

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Categorías</h1>
          <p>Módulo para clasificar y agrupar tus productos y servicios.</p>
        </div>
        
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nueva Categoría
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
              placeholder="Buscar categorías por nombre o descripción..."
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando categorías...</p>
        ) : filteredCategories.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No se encontraron categorías registradas.</p>
          </div>
        ) : (
          <div>
            {/* VISTA DE TABLA (SOLO DESKTOP) */}
            <div className="table-responsive desktop-only">
              <table className="table table-striped table-hover align-middle border">
                <thead className="table-light">
                  <tr>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                    <th style={{ width: '160px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((cat) => (
                    <tr key={cat.id_categoria}>
                      <td style={{ fontWeight: '600' }}>{cat.nombre}</td>
                      <td>{cat.descripcion || '-'}</td>
                      <td>
                        <span className={`badge ${cat.activo ? 'badge-cedula' : 'badge-consumidor'}`}>
                          {cat.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleEdit(cat)}
                          >
                            Editar
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleDelete(cat.id_categoria, cat.nombre)}
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

            {/* VISTA DE TARJETAS (SOLO MOBILE) */}
            <div className="client-cards-container mobile-only">
              {filteredCategories.map((cat) => (
                <div key={cat.id_categoria} className="client-mobile-card">
                  <div className="client-card-header">
                    <span className="client-name">{cat.nombre}</span>
                    <span className={`badge ${cat.activo ? 'badge-cedula' : 'badge-consumidor'}`}>
                      {cat.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="client-card-body">
                    <div className="client-card-info-item">
                      <span className="info-label">Descripción:</span>
                      <span className="info-val">{cat.descripcion || '-'}</span>
                    </div>
                  </div>
                  <div className="client-card-actions">
                    <button className="btn btn-secondary" onClick={() => handleEdit(cat)}>Editar</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(cat.id_categoria, cat.nombre)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FORMULARIO DE REGISTRO / EDICIÓN EN MODAL */}
      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-container" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCancel} aria-label="Cerrar formulario">✕</button>
            <h2>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h2>
            <div style={{ height: '1.5rem' }}></div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nombre de la categoría *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={nombre} 
                  onChange={(e) => setNombre(e.target.value)} 
                  placeholder="Ingrese nombre (ej: Bebidas, Servicios)"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={descripcion} 
                  onChange={(e) => setDescripcion(e.target.value)} 
                  placeholder="Ingrese descripción opcional"
                />
              </div>

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', marginTop: '1.5rem' }}>
                <label className="form-label">Estado:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                  <input 
                    type="checkbox" 
                    id="activo-cat"
                    checked={activo} 
                    onChange={(e) => setActivo(e.target.checked)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <label htmlFor="activo-cat" style={{ cursor: 'pointer', fontWeight: '500' }}>
                    Categoría Activa
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
