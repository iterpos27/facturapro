import React from 'react';
import { openRidePdf } from '../../../../lib/rides';

const getStatusBadgeClass = (status) => {
  if (status === 'BORRADOR') return 'bg-secondary';
  if (status === 'APROBADA') return 'bg-primary';
  if (status === 'FACTURADA') return 'bg-success';
  if (status === 'ANULADA') return 'bg-danger';
  return 'bg-secondary';
};

export default function ProformaTable({
  proformas,
  onViewRide,
  onEdit,
  onApprove,
  onCancel,
  onInvoice,
}) {
  if (proformas.length === 0) {
    return (
      <p className="module-empty-state">
        Aún no hay proformas. Crea la primera para preparar una venta antes de facturar.
      </p>
    );
  }

  return (
    <div>
      {/* Desktop Table View */}
      <div className="table-responsive desktop-only">
        <table className="table table-striped table-hover align-middle border">
          <thead className="table-light">
            <tr>
              <th>No. Proforma</th>
              <th>Cliente</th>
              <th>Fecha Creación</th>
              <th>Vence</th>
              <th>Total</th>
              <th>Estado</th>
              <th style={{ width: '220px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {proformas.map((proforma) => (
              <tr key={proforma.id}>
                <td style={{ fontWeight: 700 }}>{proforma.number}</td>
                <td>
                  <div style={{ fontWeight: 700 }}>{proforma.clientName}</div>
                  <small className="text-muted">{proforma.clientIdentification}</small>
                </td>
                <td>{new Date(proforma.createdAt).toLocaleDateString()}</td>
                <td>{proforma.validUntil || '-'}</td>
                <td style={{ fontWeight: 800 }}>${proforma.total.toFixed(2)}</td>
                <td>
                  <span className={`badge ${getStatusBadgeClass(proforma.status)}`} style={{ fontWeight: 'bold' }}>
                    {proforma.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-info text-white"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      onClick={() => onViewRide(proforma)}
                    >
                      Ver RIDE
                    </button>
                    <button
                      className="btn btn-outline-primary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      onClick={() => openRidePdf('proforma', proforma.id)}
                    >
                      PDF
                    </button>
                    {proforma.status === 'BORRADOR' && (
                      <>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => onEdit(proforma)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => onApprove(proforma.id, proforma.number)}
                        >
                          Aprobar
                        </button>
                      </>
                    )}
                    {['BORRADOR', 'APROBADA'].includes(proforma.status) && (
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => onCancel(proforma.id, proforma.number)}
                      >
                        Anular
                      </button>
                    )}
                    {proforma.status === 'APROBADA' && (
                      <button
                        className="btn btn-success"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => onInvoice(proforma)}
                      >
                        Facturar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="client-cards-container mobile-only">
        {proformas.map((proforma) => (
          <div key={proforma.id} className="client-mobile-card">
            <div className="client-card-header">
              <span className="client-name">{proforma.number}</span>
              <span className={`badge ${getStatusBadgeClass(proforma.status)}`} style={{ fontWeight: 'bold' }}>
                {proforma.status}
              </span>
            </div>
            <div className="client-card-body">
              <div className="client-card-info-item">
                <span className="info-label">Cliente / ID:</span>
                <span className="info-val">
                  {proforma.clientName} ({proforma.clientIdentification})
                </span>
              </div>
              <div className="client-card-info-item">
                <span className="info-label">Fecha / Total:</span>
                <span className="info-val">
                  {new Date(proforma.createdAt).toLocaleDateString()} /{' '}
                  <strong>${proforma.total.toFixed(2)}</strong>
                </span>
              </div>
            </div>
            <div className="client-card-actions">
              <button className="btn btn-info text-white" onClick={() => onViewRide(proforma)}>
                Ver RIDE
              </button>
              <button className="btn btn-outline-primary" onClick={() => openRidePdf('proforma', proforma.id)}>
                PDF
              </button>
              {proforma.status === 'BORRADOR' && (
                <button className="btn btn-secondary" onClick={() => onEdit(proforma)}>
                  Editar
                </button>
              )}
              {proforma.status === 'BORRADOR' && (
                <button
                  className="btn btn-primary"
                  onClick={() => onApprove(proforma.id, proforma.number)}
                >
                  Aprobar
                </button>
              )}
              {['BORRADOR', 'APROBADA'].includes(proforma.status) && (
                <button
                  className="btn btn-danger"
                  onClick={() => onCancel(proforma.id, proforma.number)}
                >
                  Anular
                </button>
              )}
              {proforma.status === 'APROBADA' && (
                <button className="btn btn-success" onClick={() => onInvoice(proforma)}>
                  Facturar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
