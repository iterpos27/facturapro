import React, { useCallback, useEffect, useState } from 'react';
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

const entityLabels = {
  facturas: 'Facturas',
  proformas: 'Proformas',
  compras: 'Compras',
  notas_credito: 'Notas de credito',
  retenciones: 'Retenciones',
  sesiones_caja: 'Caja',
  cuentas_bancarias: 'Cuentas bancarias',
  depositos_bancarios: 'Depositos bancarios',
};

const detailLabels = {
  ambiente: 'Ambiente',
  autorizacion: 'Autorizacion',
  banco: 'Banco',
  clave_acceso: 'Clave de acceso',
  cierre_billetes: 'Cierre billetes',
  cierre_monedas: 'Cierre monedas',
  estado: 'Estado',
  id_cuenta: 'Cuenta',
  id_deposito: 'Deposito',
  id_sesion: 'Caja',
  mensajes: 'Mensajes',
  monto: 'Monto',
  monto_cierre: 'Monto cierre',
  numero_comprobante: 'Comprobante',
  numero_cuenta: 'Numero de cuenta',
  total_operativo: 'Total operativo',
};

function prettifyAction(value = '') {
  return String(value).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDetailValue(value) {
  if (value === null || value === undefined || value === '') return 'Sin dato';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : `$${value.toFixed(2)}`;
  if (typeof value === 'boolean') return value ? 'Si' : 'No';
  if (Array.isArray(value)) return value.length ? `${value.length} registro(s)` : 'Sin registros';
  if (typeof value === 'object') return Object.keys(value).length ? 'Ver informacion relacionada' : 'Sin detalle';
  return String(value);
}

function normalizeDetail(detail) {
  if (!detail) return [];
  const parsed = typeof detail === 'string'
    ? (() => {
        try {
          return JSON.parse(detail);
        } catch {
          return { detalle: detail };
        }
      })()
    : detail;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [{ label: 'Detalle', value: formatDetailValue(parsed) }];
  }

  return Object.entries(parsed)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      label: detailLabels[key] || prettifyAction(key),
      value: formatDetailValue(value),
    }));
}

function AuditDetail({ detail }) {
  const items = normalizeDetail(detail);
  if (items.length === 0) return <span className="text-muted">Sin detalle</span>;

  return (
    <div className="audit-detail-list">
      {items.map((item) => (
        <span className="audit-detail-chip" key={`${item.label}-${item.value}`}>
          <strong>{item.label}:</strong> {item.value}
        </span>
      ))}
    </div>
  );
}

export default function AuditManager() {
  const [events, setEvents] = useState([]);
  const [entity, setEntity] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAudit = useCallback(async () => {
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
  }, [entity]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

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
                    <td><span className="badge bg-secondary">{prettifyAction(event.accion)}</span></td>
                    <td>{entityLabels[event.entidad] || event.entidad}</td>
                    <td>{event.entidad_id || '-'}</td>
                    <td className="small">
                      <AuditDetail detail={event.detalle} />
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
