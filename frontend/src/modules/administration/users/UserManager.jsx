import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiFetch, apiUrl } from '../../../lib/api';

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [idRol, setIdRol] = useState('');
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showForm && !saving) {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showForm, saving, handleCancel]);

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
        popup: 'swal-custom-toast',
      },
    });
    Toast.fire({
      icon: type,
      title: message,
    });
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setUsername(user.username);
    setEmail(user.email);
    setPassword('');
    setIdRol(user.id_rol);
    setActivo(user.activo);
    setShowForm(true);
  };

  function handleCancel() {
    if (saving) return;
    setEditingUser(null);
    setUsername('');
    setEmail('');
    setPassword('');
    if (roles.length > 0) setIdRol(roles[0].id_rol);
    setActivo(true);
    setShowForm(false);
  }

  const handleDelete = async (id, uName) => {
    if (uName === 'admin') {
      showAlert('El usuario administrador principal no puede ser eliminado.', 'error');
      return;
    }

    const result = await Swal.fire({
      title: 'Estas seguro?',
      text: `Deseas eliminar el usuario "${uName}"? Esta accion no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#212529',
      confirmButtonColor: '#e55353',
      cancelButtonColor: '#8a93a2',
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary',
      },
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
      activo,
    };

    const url = editingUser ? apiUrl(`/api/users/${editingUser.id_usuario}`) : apiUrl('/api/users');
    const method = editingUser ? 'PUT' : 'POST';

    try {
      setSaving(true);
      const response = await apiFetch(url.replace(/^https?:\/\/[^/]+/, ''), {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Ocurrio un error inesperado.');

      showAlert(editingUser ? 'Usuario actualizado correctamente.' : 'Usuario registrado exitosamente.', 'success');
      handleCancel();
      fetchUsers();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    return u.username.toLowerCase().includes(query) || u.email.toLowerCase().includes(query) || u.rol_nombre.toLowerCase().includes(query);
  });

  return (
    <div className="module-shell">
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Usuarios</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>Configura operadores, vendedores y administradores.</p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'registro' : 'registros'}
          </span>
          <button className="btn btn-secondary" onClick={() => setShowForm(true)}>
            + Nuevo usuario
          </button>
        </div>
      </div>

      <div className="client-data-panel">
        <div className="search-bar-container client-search-wrap">
          <div className="search-input-wrapper">
            <input type="text" className="form-control" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar usuarios por nombre, correo o rol..." />
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
              <table className="table table-hover align-middle client-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Correo Electronico</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th style={{ width: '170px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id_usuario}>
                      <td style={{ fontWeight: '600' }}>{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className="module-badge module-badge-role">{u.rol_nombre}</span>
                      </td>
                      <td>
                        <span className={`module-badge ${u.activo ? 'module-badge-active' : 'module-badge-inactive'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="client-table-actions">
                          <button className="btn btn-secondary client-action-btn" onClick={() => handleEdit(u)}>
                            Editar
                          </button>
                          <button className="btn btn-danger client-action-btn" onClick={() => handleDelete(u.id_usuario, u.username)}>
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
                    <span className={`module-badge ${u.activo ? 'module-badge-active' : 'module-badge-inactive'}`}>
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
          <div className="modal-container modal-container-clean compact-modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCancel} aria-label="Cerrar formulario">X</button>
            <h2>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
            <p className="modal-support-copy">Acceso, rol y estado del usuario dentro del sistema.</p>

            <form onSubmit={handleSubmit}>
              <div className="form-group mb-3">
                <label className="form-label">Nombre de usuario *</label>
                <input type="text" className="form-control" value={username} onChange={(e) => setUsername(e.target.value.trimStart())} placeholder="Ingrese nombre de usuario" required />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Correo electronico *</label>
                <input type="email" className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ejemplo@facturapro.com" required />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Contrasena {editingUser && '(Dejar en blanco para conservar anterior)'}</label>
                <input type="password" className="form-control" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ingrese contrasena de acceso" required={!editingUser} />
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Rol del sistema *</label>
                <select className="form-control" value={idRol} onChange={(e) => setIdRol(e.target.value)} required>
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
                  <input type="checkbox" id="activo-usr" checked={activo} onChange={(e) => setActivo(e.target.checked)} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                  <label htmlFor="activo-usr" style={{ cursor: 'pointer', fontWeight: '500' }}>
                    Usuario Activo
                  </label>
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
