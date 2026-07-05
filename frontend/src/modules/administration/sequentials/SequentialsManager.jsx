import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';

const TIPO_LABELS = {
  '01': 'Factura',
  '04': 'Nota de Crédito',
  '07': 'Retención',
};

export default function SequentialsManager() {
  const [sequentials, setSequentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // id del que se está guardando

  const fetchSequentials = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/sequentials');
      if (!res.ok) throw new Error('Error al cargar secuenciales.');
      setSequentials(await res.json());
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSequentials(); }, []);

  const handleChangeSeq = (id, value) => {
    setSequentials((prev) =>
      prev.map((s) => s.id_secuencial === id ? { ...s, secuencial_actual: value } : s)
    );
  };

  const handleToggleActive = (id, value) => {
    setSequentials((prev) =>
      prev.map((s) => s.id_secuencial === id ? { ...s, activo: value } : s)
    );
  };

  const handleSaveSeq = async (seq) => {
    const next = parseInt(seq.secuencial_actual, 10);
    if (!Number.isInteger(next) || next < 1) {
      Swal.fire('Error', 'El secuencial debe ser un número entero mayor o igual a 1.', 'error');
      return;
    }
    setSaving(seq.id_secuencial);
    try {
      const res = await apiFetch(`/api/sequentials/${seq.id_secuencial}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secuencial_actual: next, activo: seq.activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar.');
      Swal.fire({ icon: 'success', title: 'Actualizado', text: `Secuencial guardado: ${String(next).padStart(9, '0')}`, timer: 1800, showConfirmButton: false });
      fetchSequentials();
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveBranch = async (seq) => {
    const est = String(seq._est || seq.codigo_establecimiento || '').replace(/\D/g, '').padStart(3, '0').slice(-3);
    const pe  = String(seq._pe  || seq.punto_emision        || '').replace(/\D/g, '').padStart(3, '0').slice(-3);
    if (!/^\d{3}$/.test(est) || !/^\d{3}$/.test(pe)) {
      Swal.fire('Error', 'El establecimiento y punto de emisión deben tener 3 dígitos.', 'error');
      return;
    }
    setSaving(`branch-${seq.id_sucursal}`);
    try {
      const res = await apiFetch(`/api/sequentials/branch/${seq.id_sucursal}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_establecimiento: est, punto_emision: pe }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar.');
      Swal.fire({ icon: 'success', title: 'Actualizado', text: `Establecimiento: ${est} — Punto: ${pe}`, timer: 1800, showConfirmButton: false });
      fetchSequentials();
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  // Agrupar por sucursal
  const bySucursal = sequentials.reduce((acc, s) => {
    const key = s.id_sucursal;
    if (!acc[key]) acc[key] = { nombre: s.sucursal_nombre, id: s.id_sucursal, est: s.codigo_establecimiento, pe: s.punto_emision, items: [] };
    acc[key].items.push(s);
    return acc;
  }, {});

  return (
    <div className="module-shell">
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Secuenciales</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>
            Configura el código de establecimiento, punto de emisión y el número de secuencia para cada tipo de comprobante.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchSequentials} disabled={loading}>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {loading ? (
        <p className="module-empty-state">Cargando secuenciales...</p>
      ) : Object.keys(bySucursal).length === 0 ? (
        <p className="module-empty-state">No hay secuenciales configurados. Crea primero una sucursal.</p>
      ) : (
        Object.values(bySucursal).map((sucursal) => (
          <div key={sucursal.id} className="client-data-panel mb-4">
            <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
              <h5 className="mb-0 text-dark fw-bold">
                🏢 {sucursal.nombre}
              </h5>
              <span className="badge bg-secondary fs-6 font-monospace">
                {sucursal.est}-{sucursal.pe}
              </span>
            </div>

            <div className="card-body p-4">
              {/* Establecimiento y Punto de Emisión */}
              <div className="row g-3 mb-4 pb-3 border-bottom">
                <div className="col-md-12">
                  <p className="fw-semibold text-secondary mb-2" style={{ fontSize: '0.88rem' }}>
                    CÓDIGO DE ESTABLECIMIENTO Y PUNTO DE EMISIÓN
                  </p>
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold text-secondary small">Establecimiento (3 dígitos)</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    maxLength={3}
                    defaultValue={sucursal.est}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').padStart(3, '0').slice(-3);
                      setSequentials((prev) =>
                        prev.map((s) => s.id_sucursal === sucursal.id ? { ...s, _est: val } : s)
                      );
                    }}
                    placeholder="001"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label fw-semibold text-secondary small">Punto de Emisión (3 dígitos)</label>
                  <input
                    type="text"
                    className="form-control font-monospace"
                    maxLength={3}
                    defaultValue={sucursal.pe}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').padStart(3, '0').slice(-3);
                      setSequentials((prev) =>
                        prev.map((s) => s.id_sucursal === sucursal.id ? { ...s, _pe: val } : s)
                      );
                    }}
                    placeholder="001"
                  />
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <button
                    className="btn btn-primary"
                    disabled={saving === `branch-${sucursal.id}`}
                    onClick={() => handleSaveBranch({ ...sucursal.items[0], ...bySucursal[sucursal.id] })}
                  >
                    {saving === `branch-${sucursal.id}` ? 'Guardando...' : 'Guardar Códigos'}
                  </button>
                </div>
              </div>

              {/* Secuenciales por tipo */}
              <p className="fw-semibold text-secondary mb-3" style={{ fontSize: '0.88rem' }}>
                SECUENCIALES POR TIPO DE COMPROBANTE
              </p>
              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Tipo Comprobante</th>
                      <th>Código SRI</th>
                      <th style={{ width: '200px' }}>Próximo Nº (secuencial)</th>
                      <th>Vista previa</th>
                      <th style={{ width: '100px' }}>Activo</th>
                      <th style={{ width: '120px' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sucursal.items.map((seq) => {
                      const next = parseInt(seq.secuencial_actual, 10) || 1;
                      const preview = `${sucursal.est}-${sucursal.pe}-${String(next).padStart(9, '0')}`;
                      return (
                        <tr key={seq.id_secuencial}>
                          <td className="fw-semibold">{TIPO_LABELS[seq.tipo_comprobante] || seq.tipo_comprobante}</td>
                          <td><span className="badge bg-secondary font-monospace">{seq.tipo_comprobante}</span></td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              className="form-control font-monospace text-center"
                              value={seq.secuencial_actual}
                              onChange={(e) => handleChangeSeq(seq.id_secuencial, e.target.value)}
                            />
                          </td>
                          <td>
                            <code className="text-success">{preview}</code>
                          </td>
                          <td className="text-center">
                            <div className="form-check form-switch d-flex justify-content-center">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={seq.activo}
                                onChange={(e) => handleToggleActive(seq.id_secuencial, e.target.checked)}
                              />
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm btn-success w-100"
                              disabled={saving === seq.id_secuencial}
                              onClick={() => handleSaveSeq(seq)}
                            >
                              {saving === seq.id_secuencial ? '...' : 'Guardar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
