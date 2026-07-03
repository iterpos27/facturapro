import React from 'react';

const getStatusBadgeClass = (status) => {
  if (status === 'EMITIDA') return 'bg-success';
  if (status === 'ANULADA') return 'bg-danger';
  return 'bg-secondary';
};

const getSriBadgeClass = (status) => {
  if (status === 'GENERADO') return 'bg-primary';
  if (status === 'AUTORIZADO') return 'bg-success';
  if (status === 'DEVUELTO' || status === 'ERROR') return 'bg-danger';
  return 'bg-secondary';
};

export default function InvoiceTable({ invoices, onViewRide, onCancel, onGenerateSriTestXml }) {
  if (invoices.length === 0) {
    return (
      <p className="module-empty-state">
        Aun no hay comprobantes emitidos. Crea el primero para registrar una venta.
      </p>
    );
  }

  return (
    <div>
      <div className="table-responsive desktop-only">
        <table className="table table-striped table-hover align-middle border">
          <thead className="table-light">
            <tr>
              <th>No. Factura</th>
              <th>Cliente</th>
              <th>Fecha Emision</th>
              <th>Monto</th>
              <th>Saldo</th>
              <th>Estado</th>
              <th>SRI</th>
              <th style={{ width: '260px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id_factura}>
                <td style={{ fontWeight: 700 }}>{invoice.numero_factura}</td>
                <td>
                  <div style={{ fontWeight: 700 }}>{invoice.cliente_nombre}</div>
                  <small className="text-muted">{invoice.cliente_identificacion}</small>
                </td>
                <td>{new Date(invoice.fecha_emision).toLocaleString()}</td>
                <td style={{ fontWeight: 800 }}>${parseFloat(invoice.total).toFixed(2)}</td>
                <td style={{ color: parseFloat(invoice.saldo) > 0 ? '#b91c1c' : 'inherit' }}>
                  ${parseFloat(invoice.saldo || 0).toFixed(2)}
                </td>
                <td>
                  <span className={`badge ${getStatusBadgeClass(invoice.estado)}`} style={{ fontWeight: 'bold' }}>
                    {invoice.estado}
                  </span>
                </td>
                <td>
                  <span className={`badge ${getSriBadgeClass(invoice.sri_estado)}`}>
                    {invoice.sri_estado || 'PENDIENTE'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-info text-white"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      onClick={() => onViewRide(invoice.id_factura)}
                    >
                      Ver RIDE
                    </button>
                    {invoice.estado !== 'ANULADA' && (
                      <>
                        <button
                          className="btn btn-warning"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => onGenerateSriTestXml(invoice.id_factura)}
                        >
                          XML SRI
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => onCancel(invoice.id_factura, invoice.numero_factura)}
                        >
                          Anular
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="client-cards-container mobile-only">
        {invoices.map((invoice) => (
          <div key={invoice.id_factura} className="client-mobile-card">
            <div className="client-card-header">
              <span className="client-name">{invoice.numero_factura}</span>
              <span className={`badge ${getStatusBadgeClass(invoice.estado)}`} style={{ fontWeight: 'bold' }}>
                {invoice.estado}
              </span>
            </div>
            <div className="client-card-body">
              <div className="client-card-info-item">
                <span className="info-label">Cliente:</span>
                <span className="info-val">
                  {invoice.cliente_nombre} ({invoice.cliente_identificacion})
                </span>
              </div>
              <div className="client-card-info-item">
                <span className="info-label">Monto / Saldo:</span>
                <span className="info-val">
                  <strong>${parseFloat(invoice.total).toFixed(2)}</strong> /{' '}
                  <span style={{ color: parseFloat(invoice.saldo) > 0 ? '#b91c1c' : 'inherit' }}>
                    ${parseFloat(invoice.saldo || 0).toFixed(2)}
                  </span>
                </span>
              </div>
              <div className="client-card-info-item">
                <span className="info-label">Fecha Emision:</span>
                <span className="info-val">{new Date(invoice.fecha_emision).toLocaleDateString()}</span>
              </div>
              <div className="client-card-info-item">
                <span className="info-label">SRI:</span>
                <span className="info-val">{invoice.sri_estado || 'PENDIENTE'}</span>
              </div>
            </div>
            <div className="client-card-actions">
              <button className="btn btn-info text-white" onClick={() => onViewRide(invoice.id_factura)}>
                Ver RIDE
              </button>
              {invoice.estado !== 'ANULADA' && (
                <>
                  <button className="btn btn-warning" onClick={() => onGenerateSriTestXml(invoice.id_factura)}>
                    XML SRI
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => onCancel(invoice.id_factura, invoice.numero_factura)}
                  >
                    Anular
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
