import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

const entityOptions = [
  { value: '', label: 'Todas las entidades' },
  { value: 'facturas', label: 'Facturas' },
  { value: 'proformas', label: 'Proformas' },
  { value: 'compras', label: 'Compras' },
  { value: 'notas_credito', label: 'Notas de credito' },
  { value: 'retenciones', label: 'Retenciones' },
  { value: 'sesiones_caja', label: 'Caja' },
];

export default function AuditManager() {
  const [events, setEvents] = useState([]);
  const [entity, setEntity] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const suffix = entity ? `?entity=${encodeURIComponent(entity)}` : '';
      const response = await apiFetch(`/api/audit${suffix}`);
      if (!response.ok) throw new Error('No se pudo consultar auditoria.');
      setEvents(await response.json());
    } catch (error) {
      console.error(error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [entity]);

  return (
    <div className="module-shell">
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Auditoria</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>
            Bitacora de acciones sensibles del sistema.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={fetchAudit}>Actualizar</button>
      </div>

      <div className="client-data-panel">
        <div className="search-bar-container mt-1">
          <select className="form-select" style={{ maxWidth: '260px' }} value={entity} onChange={(e) => setEntity(e.target.value)}>
            {entityOptions.map((option) => (
              <option key={option.value || 'ALL'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="module-empty-state">Cargando auditoria...</p>
        ) : events.length === 0 ? (
          <p className="module-empty-state">No hay eventos de auditoria para este filtro.</p>
        ) : (
          <div className="table-responsive">
            <table className="table table-sm table-striped align-middle mb-0">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Accion</th>
                  <th>Entidad</th>
                  <th>ID</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id_auditoria}>
                    <td>{new Date(event.created_at).toLocaleString()}</td>
                    <td>{event.username || 'Sistema'}</td>
                    <td><span className="badge bg-secondary">{event.accion}</span></td>
                    <td>{event.entidad}</td>
                    <td>{event.entidad_id || '-'}</td>
                    <td className="small text-muted">
                      {event.detalle ? JSON.stringify(event.detalle) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
