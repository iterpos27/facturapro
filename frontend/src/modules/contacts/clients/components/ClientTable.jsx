import React from 'react';
import CIcon from '@coreui/icons-react';
import { cilPencil, cilTrash } from '@coreui/icons';

export default function ClientTable({ clients, onEdit, onDelete }) {
  return (
    <div className="client-table-wrap">
      {/* TABLA DE ESCRITORIO */}
      <div className="table-responsive desktop-only">
        <table className="table table-hover align-middle client-table">
          <thead>
            <tr>
              <th>Nombre / Razon Social</th>
              <th>No. Identificacion</th>
              <th>Correo Electronico</th>
              <th>Telefono</th>
              <th style={{ width: '120px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td style={{ fontWeight: '600' }}>{client.name}</td>
                <td>{client.identification_number}</td>
                <td>{client.email}</td>
                <td>{client.phone || '-'}</td>
                <td>
                  <div className="client-table-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-secondary client-action-btn"
                      onClick={() => onEdit(client)}
                      title="Editar"
                      style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <CIcon icon={cilPencil} size="sm" />
                    </button>
                    <button
                      className="btn btn-danger client-action-btn"
                      onClick={() => onDelete(client.id, client.name)}
                      title="Eliminar"
                      style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <CIcon icon={cilTrash} size="sm" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TARJETAS PARA DISPOSITIVOS MÓVILES */}
      <div className="client-cards-container mobile-only">
        {clients.map((client) => (
          <div key={client.id} className="client-mobile-card">
            <div className="client-card-header">
              <span className="client-name">{client.name}</span>
            </div>
            <div className="client-card-body">
              <div className="client-card-info-item">
                <span className="info-label">Identificacion:</span>
                <span className="info-val">{client.identification_number}</span>
              </div>
              <div className="client-card-info-item">
                <span className="info-label">Correo:</span>
                <span className="info-val">{client.email}</span>
              </div>
              <div className="client-card-info-item">
                <span className="info-label">Telefono:</span>
                <span className="info-val">{client.phone || '-'}</span>
              </div>
              {client.address && (
                <div className="client-card-info-item">
                  <span className="info-label">Direccion:</span>
                  <span className="info-val">{client.address}</span>
                </div>
              )}
            </div>
            <div className="client-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={() => onEdit(client)}
                title="Editar"
                style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
              >
                <CIcon icon={cilPencil} size="sm" />
              </button>
              <button
                className="btn btn-danger"
                onClick={() => onDelete(client.id, client.name)}
                title="Eliminar"
                style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
              >
                <CIcon icon={cilTrash} size="sm" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
