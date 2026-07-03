import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiFetch, readApiResponse } from '../../../lib/api';

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
  const [logoUrl, setLogoUrl] = useState('');
  const [ambienteSri, setAmbienteSri] = useState('PRUEBAS');
  const [tipoEmision, setTipoEmision] = useState('NORMAL');
  const [certificadoPath, setCertificadoPath] = useState('');
  const [certificadoAlias, setCertificadoAlias] = useState('');
  const [certificadoClave, setCertificadoClave] = useState('');
  const [sriEndpointRecepcion, setSriEndpointRecepcion] = useState('');
  const [sriEndpointAutorizacion, setSriEndpointAutorizacion] = useState('');
  const [certificateFile, setCertificateFile] = useState(null);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);
  const [checkingSri, setCheckingSri] = useState(false);
  const [sriChecks, setSriChecks] = useState([]);

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/company');
      if (!response.ok) throw new Error('Error al consultar datos de la empresa.');
      const data = await readApiResponse(response);
      if (data) {
        setRuc(data.ruc);
        setRazonSocial(data.razon_social);
        setNombreComercial(data.nombre_comercial || '');
        setDireccionMatriz(data.direccion_matriz);
        setObligadoContabilidad(data.obligado_contabilidad);
        setContribuyenteEspecial(data.contribuyente_especial || '');
        setRegimen(data.regimen || 'RIMPE');
        setLogoUrl(data.logo_url || '');
        setAmbienteSri(data.ambiente_sri || 'PRUEBAS');
        setTipoEmision(data.tipo_emision || 'NORMAL');
        setCertificadoPath(data.certificado_path || '');
        setCertificadoAlias(data.certificado_alias || '');
        setCertificadoClave(data.certificado_clave || '');
        setSriEndpointRecepcion(data.sri_endpoint_recepcion || '');
        setSriEndpointAutorizacion(data.sri_endpoint_autorizacion || '');
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
      regimen,
      logo_url: logoUrl,
      ambiente_sri: ambienteSri,
      tipo_emision: tipoEmision,
      certificado_path: certificadoPath,
      certificado_alias: certificadoAlias,
      certificado_clave: certificadoClave,
      sri_endpoint_recepcion: sriEndpointRecepcion,
      sri_endpoint_autorizacion: sriEndpointAutorizacion,
    };

    setSaving(true);
    try {
      const response = await apiFetch('/api/company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(companyData),
      });

      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar la configuración.');

      showAlert('Configuración de la empresa guardada exitosamente.', 'success');
      fetchCompanyData();
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCertificateUpload = async () => {
    if (!certificateFile) {
      showAlert('Seleccione un archivo .p12 o .pfx.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('certificate', certificateFile);

    setUploadingCertificate(true);
    try {
      const response = await apiFetch('/api/company/certificate', {
        method: 'POST',
        body: formData,
      });
      const result = await readApiResponse(response);
      if (!response.ok) throw new Error(result.error || 'No se pudo cargar el certificado.');
      setCertificadoPath(result.certificado_path || '');
      setCertificateFile(null);
      showAlert('Certificado cargado. Guarde la configuracion con la clave del certificado.', 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    } finally {
      setUploadingCertificate(false);
    }
  };

  const saveCurrentCompanyBeforeSriCheck = async () => {
    if (!ruc.trim() || ruc.length !== 13) {
      throw new Error('El RUC debe tener exactamente 13 digitos.');
    }

    if (!razonSocial.trim() || !direccionMatriz.trim()) {
      throw new Error('La razon social y la direccion matriz son obligatorias.');
    }

    const response = await apiFetch('/api/company', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ruc,
        razon_social: razonSocial,
        nombre_comercial: nombreComercial,
        direccion_matriz: direccionMatriz,
        obligado_contabilidad: obligadoContabilidad,
        contribuyente_especial: contribuyenteEspecial,
        regimen,
        logo_url: logoUrl,
        ambiente_sri: ambienteSri,
        tipo_emision: tipoEmision,
        certificado_path: certificadoPath,
        certificado_alias: certificadoAlias,
        certificado_clave: certificadoClave,
        sri_endpoint_recepcion: sriEndpointRecepcion,
        sri_endpoint_autorizacion: sriEndpointAutorizacion,
      }),
    });

    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar la configuracion.');
    return result;
  };

  const handleCheckSriReadiness = async () => {
    setCheckingSri(true);
    try {
      await saveCurrentCompanyBeforeSriCheck();
      const response = await apiFetch('/api/sri/readiness-test');
      const result = await readApiResponse(response);
      setSriChecks(result.checks || []);
      if (!response.ok || !result.ready) {
        showAlert('Revise los requisitos pendientes para SRI pruebas.', 'error');
        return;
      }
      showAlert('Configuracion lista para facturacion SRI en pruebas.', 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    } finally {
      setCheckingSri(false);
    }
  };

  return (
    <div className="module-shell">
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Empresa</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>Configura los datos tributarios y parámetros de facturación SRI.</p>
        </div>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando datos de la empresa...</p>
      ) : (
        <div className="client-data-panel">
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

              <div className="border-top pt-3 mb-3">
                <h5 className="mb-3 text-dark fw-bold">Parametros electronicos SRI</h5>
                <div className="row mb-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary">Logo / URL</label>
                    <input
                      type="text"
                      className="form-control"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://.../logo.png"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary">Ambiente SRI</label>
                    <select className="form-control" value={ambienteSri} onChange={(e) => setAmbienteSri(e.target.value)}>
                      <option value="PRUEBAS">PRUEBAS</option>
                      <option value="PRODUCCION">PRODUCCION</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary">Tipo emision</label>
                    <select className="form-control" value={tipoEmision} onChange={(e) => setTipoEmision(e.target.value)}>
                      <option value="NORMAL">NORMAL</option>
                    </select>
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-5">
                    <label className="form-label fw-semibold text-secondary">Ruta certificado firma</label>
                    <input
                      type="text"
                      className="form-control"
                      value={certificadoPath}
                      onChange={(e) => setCertificadoPath(e.target.value)}
                      placeholder="C:\\certificados\\firma.p12"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label fw-semibold text-secondary">Alias certificado</label>
                    <input
                      type="text"
                      className="form-control"
                      value={certificadoAlias}
                      onChange={(e) => setCertificadoAlias(e.target.value)}
                      placeholder="Alias"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-semibold text-secondary">Clave certificado</label>
                    <input
                      type="password"
                      className="form-control"
                      value={certificadoClave}
                      onChange={(e) => setCertificadoClave(e.target.value)}
                      placeholder="Clave de firma"
                    />
                  </div>
                </div>

                <div className="row mb-3 align-items-end">
                  <div className="col-md-8">
                    <label className="form-label fw-semibold text-secondary">Cargar certificado .p12 / .pfx</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".p12,.pfx"
                      onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                    />
                    <small className="text-muted">El archivo se guarda localmente en el backend y no se sube a Git.</small>
                  </div>
                  <div className="col-md-4 d-grid">
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={handleCertificateUpload}
                      disabled={uploadingCertificate || !certificateFile}
                    >
                      {uploadingCertificate ? 'Cargando...' : 'Cargar certificado'}
                    </button>
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-secondary">Endpoint recepcion</label>
                    <input
                      type="text"
                      className="form-control"
                      value={sriEndpointRecepcion}
                      onChange={(e) => setSriEndpointRecepcion(e.target.value)}
                      placeholder="URL servicio recepcion SRI"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-semibold text-secondary">Endpoint autorizacion</label>
                    <input
                      type="text"
                      className="form-control"
                      value={sriEndpointAutorizacion}
                      onChange={(e) => setSriEndpointAutorizacion(e.target.value)}
                      placeholder="URL servicio autorizacion SRI"
                    />
                  </div>
                </div>

                <div className="border rounded p-3 bg-light">
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <div>
                      <strong>Validacion SRI pruebas</strong>
                      <div className="small text-muted">Guarda los datos actuales y confirma endpoints/certificado antes de procesar facturas.</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCheckSriReadiness}
                      disabled={checkingSri}
                    >
                      {checkingSri ? 'Validando...' : 'Guardar y validar'}
                    </button>
                  </div>
                  {sriChecks.length > 0 && (
                    <div className="mt-3">
                      {sriChecks.map((check) => (
                        <div key={check.key} className="d-flex justify-content-between gap-2 border-top py-2 small">
                          <span>
                            <strong>{check.ok ? 'OK' : 'Pendiente'}</strong> - {check.label}
                          </span>
                          <span className={check.ok ? 'text-success' : 'text-danger'} style={{ maxWidth: '55%', textAlign: 'right' }}>
                            {check.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
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
