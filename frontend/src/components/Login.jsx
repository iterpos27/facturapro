import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { apiUrl } from '../lib/api';

export default function Login({ onLoginSuccess }) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!usernameOrEmail.trim() || !password) {
      Swal.fire({
        icon: 'error',
        title: 'Campos requeridos',
        text: 'Por favor complete todos los campos.',
        confirmButtonColor: '#e55353'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Credenciales incorrectas o servidor no disponible.');
      }

      // Guardar sesión
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: '¡Sesión iniciada correctamente!',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });

      onLoginSuccess(data.user);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error de ingreso',
        text: err.message,
        confirmButtonColor: '#e55353'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-lg-8 col-md-10">
            <div className="card-group d-flex flex-column flex-md-row shadow-lg" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              
              {/* Bloque izquierdo: Formulario de Login */}
              <div className="card p-4 flex-grow-1 bg-white border-0">
                <div className="card-body">
                  <h1 className="h2 text-dark font-weight-bold">Ingreso al Sistema</h1>
                  <p className="text-secondary mb-4">Accede con tus credenciales de FacturaPro</p>
                  
                  <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <label className="form-label text-secondary small fw-bold">Usuario o Correo Electrónico</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-secondary border-end-0">👤</span>
                        <input
                          type="text"
                          className="form-control bg-light border-start-0"
                          placeholder="admin"
                          value={usernameOrEmail}
                          onChange={(e) => setUsernameOrEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <label className="form-label text-secondary small fw-bold">Contraseña</label>
                      <div className="input-group">
                        <span className="input-group-text bg-light text-secondary border-end-0">🔒</span>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="form-control bg-light border-start-0 border-end-0"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-outline-secondary bg-light border-start-0 text-secondary"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ borderColor: '#d8dbe0', borderLeft: 'none' }}
                        >
                          {showPassword ? '👁️' : '👁️‍🗨️'}
                        </button>
                      </div>
                    </div>
                    
                    <div className="row">
                      <div className="col-12">
                        <button 
                          type="submit" 
                          className="btn btn-primary px-4 py-2 w-100 fw-bold"
                          disabled={loading}
                          style={{ letterSpacing: '0.5px' }}
                        >
                          {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
              
              {/* Bloque derecho: Panel informativo */}
              <div className="card text-white bg-primary py-5 flex-shrink-0 d-flex align-items-center justify-content-center text-center border-0" style={{ minWidth: '40%' }}>
                <div className="card-body d-flex flex-column align-items-center justify-content-center p-4">
                  <div>
                    <h2 className="fw-bold mb-2">FacturaPro</h2>
                    <p style={{ fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8 }}>Ecuador - SRI</p>
                    <p className="mt-3 small" style={{ opacity: 0.9, maxWidth: '240px', lineHeight: '1.6' }}>
                      Solución integral y simplificada de facturación electrónica y gestión comercial adaptada al SRI.
                    </p>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
