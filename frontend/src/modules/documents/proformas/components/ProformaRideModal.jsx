import React from 'react';
import { apiUrl } from '../../../../lib/api';
import { printDocument } from '../../../../lib/printDocument';

const money = (value) => (parseFloat(value || 0) || 0).toFixed(2);
const qty = (value) => (parseFloat(value || 0) || 0).toFixed(2);

function resolveAssetUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  return url.startsWith('/uploads/') ? apiUrl(url) : url;
}

export default function ProformaRideModal({ viewProforma, onClose }) {
  if (!viewProforma) return null;

  const company = viewProforma.company || {};
  const issuerName = company.razon_social || company.nombre_comercial || 'Empresa no configurada';
  const tradeName = company.nombre_comercial || issuerName;
  const companyRuc = company.ruc || 'RUC no configurado';
  const matrixAddress = company.direccion_matriz || 'Direccion matriz no configurada';
  const accountingRequired = company.obligado_contabilidad ? 'SI' : 'NO';
  const logoUrl = resolveAssetUrl(company.logo_url);
  const subtotalNoTax = parseFloat(viewProforma.subtotal || 0) || 0;
  const discount = parseFloat(viewProforma.discount || 0) || 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container text-dark print-document"
        style={{
          maxWidth: '820px',
          width: '96%',
          fontFamily: 'Arial, Helvetica, sans-serif',
          padding: '1.4rem',
          borderRadius: '6px',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close-btn form-actions-buttons"
          onClick={onClose}
          aria-label="Cerrar proforma"
          style={{ top: '10px', right: '10px' }}
        >
          X
        </button>

        <div className="d-grid gap-2" style={{ gridTemplateColumns: '1fr 1.35fr' }}>
          <div>
            <div className="border d-flex align-items-center justify-content-center bg-white mb-2" style={{ width: '150px', height: '74px', padding: '6px' }}>
              {logoUrl ? (
                <img src={logoUrl} alt={tradeName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <div className="fw-bold text-center text-primary" style={{ fontSize: '0.95rem', lineHeight: 1.05 }}>{tradeName}</div>
              )}
            </div>

            <div className="border rounded-1 p-2 small" style={{ minHeight: '116px' }}>
              <div className="fw-bold">{issuerName}</div>
              <div><strong>Dir. Matriz:</strong> {matrixAddress}</div>
              <div><strong>Establecimiento:</strong> MATRIZ (001-001)</div>
              <div><strong>Obligado a llevar contabilidad:</strong> {accountingRequired}</div>
              {company.contribuyente_especial && <div><strong>Agente/Contribuyente especial:</strong> {company.contribuyente_especial}</div>}
              {company.regimen && <div><strong>Regimen:</strong> {company.regimen}</div>}
            </div>
          </div>

          <div className="border rounded-1 p-2 small">
            <div><strong>RUC:</strong> {companyRuc}</div>
            <div className="fw-bold" style={{ fontSize: '1.08rem' }}>PROFORMA No. {viewProforma.number}</div>
            <div className="mt-1"><strong>No. Transaccion:</strong> {viewProforma.transactionNumber || 'N/D'}</div>
            <div><strong>Fecha Emision:</strong> {viewProforma.createdAt ? new Date(viewProforma.createdAt).toLocaleString() : 'N/D'}</div>
            <div><strong>Vence:</strong> {viewProforma.validUntil || 'N/D'}</div>
            <div><strong>Estado:</strong> {viewProforma.status || 'BORRADOR'}</div>
            <div className="alert alert-warning py-1 px-2 mt-2 mb-0 small">
              Documento sin validez tributaria. Sirve como cotizacion previa a factura.
            </div>
          </div>
        </div>

        <div className="border rounded-1 p-2 small mt-3">
          <div className="d-grid" style={{ gridTemplateColumns: '1.8fr 1fr 1fr', columnGap: '1rem' }}>
            <div><strong>Cliente:</strong> {viewProforma.clientName}</div>
            <div><strong>RUC/C.I.:</strong> {viewProforma.clientIdentification}</div>
            <div><strong>Telefono:</strong> {viewProforma.clientPhone || 'S/D'}</div>
            <div><strong>Direccion:</strong> {viewProforma.clientAddress || 'S/D'}</div>
            <div><strong>Email:</strong> {viewProforma.clientEmail || 'S/D'}</div>
            <div><strong>Moneda:</strong> USD</div>
          </div>
        </div>

        <table className="table table-bordered table-sm small align-middle my-2" style={{ borderColor: '#4b5563' }}>
          <thead>
            <tr className="text-center">
              <th style={{ width: '75px' }}>Codigo</th>
              <th>Detalle del producto</th>
              <th style={{ width: '62px' }}>Cant.</th>
              <th style={{ width: '78px' }}>PVP</th>
              <th style={{ width: '78px' }}>Desc</th>
              <th style={{ width: '78px' }}>Desc %</th>
              <th style={{ width: '82px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {viewProforma.items.map((d, index) => {
              const lineDiscount = parseFloat(d.discountAmount ?? d.discount ?? 0) || 0;
              return (
                <tr key={d.id || index}>
                  <td className="font-monospace">{d.code}</td>
                  <td>{d.name}</td>
                  <td className="text-center">{qty(d.quantity)}</td>
                  <td className="text-end">{money(d.price)}</td>
                  <td className="text-end">{money(lineDiscount)}</td>
                  <td className="text-end">{money(d.discountPercent)}%</td>
                  <td className="text-end">{money(d.total ?? d.subtotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="d-grid gap-2" style={{ gridTemplateColumns: '1fr 1.15fr' }}>
          <div className="border rounded-1 p-2 small">
            <div className="fw-bold mb-1">Info. Adicional</div>
            <div><strong>Observacion:</strong> {viewProforma.notes || ''}</div>
            <div><strong>Uso:</strong> Cotizacion comercial</div>
          </div>

          <div className="border rounded-1 p-2 small">
            {[
              ['Subtotal', subtotalNoTax],
              ['Descuento', discount],
              ['Subtotal neto', Math.max(subtotalNoTax - discount, 0)],
              ['IVA', viewProforma.iva],
              ['TOTAL COTIZADO', viewProforma.total],
            ].map(([label, value]) => (
              <div key={label} className={`d-flex justify-content-between ${label === 'TOTAL COTIZADO' ? 'fw-bold border-top mt-1 pt-1' : ''}`}>
                <span>{label}</span>
                <span>{money(value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-4 small">
          <div style={{ width: '170px', borderTop: '1px solid #777', margin: '0 auto 2px' }}></div>
          Cliente
        </div>

        <div className="form-actions-buttons border-top pt-3 mt-3 d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => printDocument()}>
            Imprimir Proforma
          </button>
          <button type="button" className="btn btn-danger" style={{ backgroundColor: '#f43f5e', color: '#ffffff' }} onClick={onClose}>
            Cerrar RIDE
          </button>
        </div>
      </div>
    </div>
  );
}
