import React from 'react';
import { printDocument } from '../../../../lib/printDocument';

export default function ProformaRideModal({ viewProforma, onClose }) {
  if (!viewProforma) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container text-dark print-document"
        style={{
          maxWidth: '800px',
          width: '95%',
          fontFamily: 'Courier New, Courier, monospace',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Cerrar proforma"
        >
          ✕
        </button>

        {/* Cabecera Cotización */}
        <div className="text-center mb-4">
          <h3 className="fw-bold m-0">COTIZACIÓN COMERCIAL</h3>
          <h5 className="m-0">DOCUMENTO PROFORMA</h5>
          <div style={{ borderTop: '2px dashed #000', margin: '0.75rem 0' }}></div>
        </div>

        <div className="row small mb-3">
          <div className="col-md-6 mb-2">
            <div>
              <strong>EMISOR:</strong>
            </div>
            <div>FACTURAPRO S.A.</div>
            <div>RUC: 1792345678001</div>
            <div>Matriz: Av. Amazonas N32-156 y Av. Mariana de Jesús</div>
            <div>Establecimiento: MATRIZ (001-001)</div>
            <div>Obligado a llevar contabilidad: SI</div>
          </div>
          <div className="col-md-6 mb-2">
            <div>
              <strong>No. PROFORMA:</strong>
            </div>
            <div className="fw-bold" style={{ fontSize: '1.05rem' }}>
              {viewProforma.number}
            </div>
            <div>
              Fecha de Emisión:{' '}
              {new Date(viewProforma.createdAt).toLocaleString()}
            </div>
            <div>Vence: {viewProforma.validUntil || '-'}</div>
            <div>
              Estado:{' '}
              <span className="badge bg-secondary">{viewProforma.status}</span>
            </div>
            <div>No. Transacción: {viewProforma.transactionNumber}</div>
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>

        {/* Datos Cliente */}
        <div className="small mb-3">
          <div>
            <strong>RAZÓN SOCIAL CLIENTE:</strong> {viewProforma.clientName}
          </div>
          <div>
            <strong>RUC/CÉDULA:</strong> {viewProforma.clientIdentification}
          </div>
          <div>
            <strong>DIRECCIÓN:</strong> {viewProforma.clientAddress || 'S/D'}
          </div>
          <div>
            <strong>TELÉFONO:</strong> {viewProforma.clientPhone || 'S/D'}
          </div>
          <div>
            <strong>EMAIL:</strong> {viewProforma.clientEmail || 'S/D'}
          </div>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>

        {/* Tabla Renglones */}
        <table
          className="table table-sm table-borderless small mb-3"
          style={{ fontSize: '0.85rem' }}
        >
          <thead>
            <tr style={{ borderBottom: '1px dashed #000' }}>
              <th>Cod.</th>
              <th>Cant.</th>
              <th>Descripción</th>
              <th className="text-end">P. Unit</th>
              <th className="text-end">Desc. $</th>
              <th className="text-end">Desc. %</th>
              <th className="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {viewProforma.items.map((d, index) => (
              <tr key={d.id || index}>
                <td>{d.code}</td>
                <td>{parseFloat(d.quantity).toFixed(2)}</td>
                <td>{d.name}</td>
                <td className="text-end">
                  ${parseFloat(d.price).toFixed(2)}
                </td>
                <td className="text-end">
                  $
                  {parseFloat(d.discountAmount ?? d.discount ?? 0).toFixed(2)}
                </td>
                <td className="text-end">
                  {parseFloat(d.discountPercent ?? 0).toFixed(2)}%
                </td>
                <td className="text-end">
                  ${parseFloat(d.total ?? d.subtotal).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>

        {/* Resumen de totales */}
        <div className="row small">
          <div className="col-7">
            {viewProforma.notes && (
              <div>
                <div>
                  <strong>OBSERVACIONES:</strong>
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {viewProforma.notes}
                </div>
              </div>
            )}
          </div>
          <div className="col-5">
            <div className="d-flex justify-content-between">
              <span>Subtotal:</span>
              <span>${parseFloat(viewProforma.subtotal).toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span>Descuento:</span>
              <span>${parseFloat(viewProforma.discount || 0).toFixed(2)}</span>
            </div>
            <div className="d-flex justify-content-between">
              <span>IVA:</span>
              <span>${parseFloat(viewProforma.iva).toFixed(2)}</span>
            </div>
            <div
              className="d-flex justify-content-between fw-bold"
              style={{
                fontSize: '1rem',
                borderTop: '1px double #000',
                paddingTop: '2px',
              }}
            >
              <span>TOTAL COTIZADO:</span>
              <span>${parseFloat(viewProforma.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div
          style={{ borderTop: '2px dashed #000', margin: '1rem 0 0.5rem' }}
        ></div>
        <div className="text-center small text-secondary">
          ¡Gracias por preferirnos! Esta proforma no representa una factura ni un
          comprobante fiscal.
        </div>

        <div className="form-actions-buttons border-top pt-3 mt-3">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => printDocument()}
          >
            🖨️ Imprimir Cotización
          </button>
          <button
            type="button"
            className="btn btn-danger"
            style={{ backgroundColor: '#f43f5e', color: '#ffffff' }}
            onClick={onClose}
          >
            Cerrar Vista
          </button>
        </div>
      </div>
    </div>
  );
}
