import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiFetch, apiUrl } from '../lib/api';

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Campos del formulario
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [idRol, setIdRol] = useState('');
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/users');
      if (!response.ok) throw new Error('Error al conectar con la base de datos.');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiFetch('/api/users/roles');
      if (response.ok) {
        const data = await response.json();
        setRoles(data);
        if (data.length > 0) setIdRol(data[0].id_rol);
      }
    } catch (error) {
      console.error(error);
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

  const handleEdit = (user) => {
    setEditingUser(user);
    setUsername(user.username);
    setEmail(user.email);
    setPassword(''); // Dejar en blanco en edición por seguridad
    setIdRol(user.id_rol);
    setActivo(user.activo);
    setShowForm(true);
  };

  const handleCancel = () => {
    setEditingUser(null);
    setUsername('');
    setEmail('');
    setPassword('');
    if (roles.length > 0) setIdRol(roles[0].id_rol);
    setActivo(true);
    setShowForm(false);
  };

  const handleDelete = async (id, uName) => {
    if (uName === 'admin') {
      showAlert('El usuario administrador principal no puede ser eliminado.', 'error');
      return;
    }

    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar el usuario "${uName}"? Esta acción no se puede deshacer.`,
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
        const response = await apiFetch(`/api/users/${id}`, {
          method: 'DELETE',
        });
        const resultData = await response.json();
        
        if (!response.ok) throw new Error(resultData.error || 'No se pudo eliminar.');

        showAlert('Usuario eliminado correctamente.', 'success');
        fetchUsers();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !email.trim() || (!editingUser && !password.trim()) || !idRol) {
      showAlert('Por favor, complete todos los campos obligatorios.', 'error');
      return;
    }

    const userData = {
      username,
      email,
      password: password || undefined,
      id_rol: parseInt(idRol, 10),
      activo
    };

    const url = editingUser 
      ? apiUrl(`/api/users/${editingUser.id_usuario}`) 
      : apiUrl('/api/users');
      
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const response = await apiFetch(url.replace(/^https?:\/\/[^/]+/, ''), {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Ocurrió un error inesperado.');

      showAlert(editingUser ? 'Usuario actualizado correctamente.' : 'Usuario registrado exitosamente.', 'success');
      handleCancel();
      fetchUsers();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.rol_nombre.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Usuarios y Roles</h1>
          <p>Módulo para configurar operadores, vendedores y administradores.</p>
        </div>
        
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nuevo Usuario
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
              placeholder="Buscar usuarios por nombre, correo o rol..."
            />
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando usuarios...</p>
        ) : filteredUsers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', margin: 0 }}>
              No se encontraron usuarios registrados.
            </p>
          </div>
        ) : (
          <div>
            <div className="table-responsive desktop-only">
              <table className="table table-striped table-hover align-middle border">
                <thead className="table-light">
                  <tr>
                    <th>Usuario</th>
                    <th>Correo Electrónico</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th style={{ width: '160px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id_usuario}>
                      <td style={{ fontWeight: '600' }}>{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className="badge badge-ruc" style={{ backgroundColor: '#ebedef', color: '#4f5d73' }}>
                          {u.rol_nombre}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${u.activo ? 'badge-cedula' : 'badge-consumidor'}`} style={{ backgroundColor: u.activo ? '#d2f4ea' : '#f8d7da', color: u.activo ? '#14a44d' : '#dc3545' }}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleEdit(u)}
                          >
                            Editar
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleDelete(u.id_usuario, u.username)}
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
              {filteredUsers.map((u) => (
                <div key={u.id_usuario} className="client-mobile-card">
                  <div className="client-card-header">
                    <span className="client-name">{u.username}</span>
                    <span className={`badge ${u.activo ? 'badge-cedula' : 'badge-consumidor'}`} style={{ backgroundColor: u.activo ? '#d2f4ea' : '#f8d7da', color: u.activo ? '#14a44d' : '#dc3545' }}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="client-card-body">
                    <div className="client-card-info-item">
                      <span className="info-label">Email:</span>
                      <span className="info-val">{u.email}</span>
                    </div>
                    <div className="client-card-info-item">
                      <span className="info-label">Rol:</span>
                      <span className="info-val">{u.rol_nombre}</span>
                    </div>
                  </div>
                  <div className="client-card-actions">
                    <button className="btn btn-secondary" onClick={() => handleEdit(u)}>Editar</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(u.id_usuario, u.username)}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-container" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCancel} aria-label="Cerrar formulario">✕</button>
            <h2>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
            <div style={{ height: '1.5rem' }}></div>

            <form onSubmit={handleSubmit}>
              <div className="form-group mb-3">
                <label className="form-label">Nombre de usuario *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="Ingrese nombre de usuario"
                  required
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Correo electrónico *</label>
                <input 
                  type="email" 
                  className="form-control" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="ejemplo@facturapro.com"
                  required
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Contraseña {editingUser && '(Dejar en blanco para conservar anterior)'}</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="Ingrese contraseña de acceso"
                  required={!editingUser}
                />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Rol del sistema *</label>
                <select 
                  className="form-control" 
                  value={idRol} 
                  onChange={(e) => setIdRol(e.target.value)}
                  required
                >
                  {roles.map((r) => (
                    <option key={r.id_rol} value={r.id_rol}>
                      {r.nombre} - {r.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group mb-3" style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="form-label">Estado:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                  <input 
                    type="checkbox" 
                    id="activo-usr"
                    checked={activo} 
                    onChange={(e) => setActivo(e.target.checked)}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <label htmlFor="activo-usr" style={{ cursor: 'pointer', fontWeight: '500' }}>
                    Usuario Activo
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
