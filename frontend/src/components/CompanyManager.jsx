import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiUrl } from '../lib/api';

export default function CompanyManager() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos de la empresa
  const [ruc, setRuc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [nombreComercial, setNombreComercial] = useState('');
  const [direccionMatriz, setDireccionMatriz] = useState('');
  const [obligadoContabilidad, setObligadoContabilidad] = useState(false);
  const [contribuyenteEspecial, setContribuyenteEspecial] = useState('');
  const [regimen, setRegimen] = useState('RIMPE');

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/company'));
      if (!response.ok) throw new Error('Error al consultar datos de la empresa.');
      const data = await response.json();
      if (data) {
        setRuc(data.ruc);
        setRazonSocial(data.razon_social);
        setNombreComercial(data.nombre_comercial || '');
        setDireccionMatriz(data.direccion_matriz);
        setObligadoContabilidad(data.obligado_contabilidad);
        setContribuyenteEspecial(data.contribuyente_especial || '');
        setRegimen(data.regimen || 'RIMPE');
      }
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!ruc.trim() || ruc.length !== 13) {
      showAlert('El RUC debe tener exactamente 13 dígitos.', 'error');
      return;
    }

    if (!razonSocial.trim() || !direccionMatriz.trim()) {
      showAlert('La Razón Social y la Dirección Matriz son campos obligatorios.', 'error');
      return;
    }

    const companyData = {
      ruc,
      razon_social: razonSocial,
      nombre_comercial: nombreComercial,
      direccion_matriz: direccionMatriz,
      obligado_contabilidad: obligadoContabilidad,
      contribuyente_especial: contribuyenteEspecial,
      regimen
    };

    setSaving(true);
    try {
      const response = await fetch(apiUrl('/api/company'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(companyData),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar la configuración.');

      showAlert('Configuración de la empresa guardada exitosamente.', 'success');
      fetchCompanyData();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Configuración de la Empresa</h1>
          <p>Módulo para establecer datos tributarios requeridos para la emisión electrónica al SRI.</p>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando datos de la empresa...</p>
      ) : (
        <div className="card shadow-sm border mb-4">
          <div className="card-header bg-white py-3">
            <h5 className="mb-0 text-dark fw-bold">Parámetros de Facturación SRI</h5>
          </div>
          <div className="card-body p-4">
            <form onSubmit={handleSubmit}>
              
              {/* Fila 1: RUC, Razón Social */}
              <div className="row mb-3">
                <div className="col-md-4">
                  <div className="form-group mb-3">
                    <label className="form-label fw-semibold text-secondary">RUC de la Empresa *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={ruc}
                      onChange={(e) => setRuc(e.target.value.replace(/\D/g, '').substring(0, 13))}
                      placeholder="ej: 1792345678001"
                      required
                    />
                    <small className="text-muted">13 dígitos reglamentarios.</small>
                  </div>
                </div>

                <div className="col-md-8">
                  <div className="form-group mb-3">
                    <label className="form-label fw-semibold text-secondary">Razón Social *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={razonSocial}
                      onChange={(e) => setRazonSocial(e.target.value)}
                      placeholder="Razón Social registrada en la Superintendencia o SRI"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Fila 2: Nombre Comercial, Régimen */}
              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label fw-semibold text-secondary">Nombre Comercial</label>
                    <input
                      type="text"
                      className="form-control"
                      value={nombreComercial}
                      onChange={(e) => setNombreComercial(e.target.value)}
                      placeholder="Nombre de fantasía / Marca"
                    />
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label fw-semibold text-secondary">Régimen Impositivo *</label>
                    <select
                      className="form-control"
                      value={regimen}
                      onChange={(e) => setRegimen(e.target.value)}
                    >
                      <option value="RIMPE NEGOCIOS POPULARES">RIMPE - Negocios Populares</option>
                      <option value="RIMPE EMPRENDEDORES">RIMPE - Emprendedores</option>
                      <option value="REGIMEN GENERAL">Régimen General</option>
                      <option value="ARTESANO CALIFICADO">Artesano Calificado</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Fila 3: Dirección Matriz */}
              <div className="mb-4">
                <div className="form-group">
                  <label className="form-label fw-semibold text-secondary">Dirección de Matriz *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={direccionMatriz}
                    onChange={(e) => setDireccionMatriz(e.target.value)}
                    placeholder="Dirección física del establecimiento principal"
                    required
                  />
                </div>
              </div>

              {/* Fila 4: Obligado Contabilidad, Contribuyente Especial */}
              <div className="row align-items-center mb-4">
                <div className="col-md-6">
                  <div className="form-group">
                    <label className="form-label fw-semibold text-secondary">Obligado a llevar contabilidad:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                      <input
                        type="checkbox"
                        id="obligado-check"
                        checked={obligadoContabilidad}
                        onChange={(e) => setObligadoContabilidad(e.target.checked)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                      <label htmlFor="obligado-check" style={{ cursor: 'pointer', fontWeight: '500' }}>
                        Sí, obligado por el SRI
                      </label>
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-group">
                    <label className="form-label fw-semibold text-secondary">No. Resolución Contribuyente Especial</label>
                    <input
                      type="text"
                      className="form-control"
                      value={contribuyenteEspecial}
                      onChange={(e) => setContribuyenteEspecial(e.target.value)}
                      placeholder="ej: Resolución No. 1234 (Dejar vacío si no aplica)"
                    />
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="d-flex justify-content-end gap-2 border-top pt-3">
                <button
                  type="submit"
                  className="btn btn-primary px-4 py-2"
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
