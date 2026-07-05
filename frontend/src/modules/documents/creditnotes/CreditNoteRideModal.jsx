import React from 'react';
import { apiUrl } from '../../../lib/api';
import { printDocument } from '../../../lib/printDocument';

const money = (value) => (parseFloat(value || 0) || 0).toFixed(2);
const qty = (value) => (parseFloat(value || 0) || 0).toFixed(2);

function resolveAssetUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  return url.startsWith('/uploads/') ? apiUrl(url) : url;
}

/**
 * CreditNoteRideModal
 * Representación impresa (RIDE) de una Nota de Crédito Electrónica SRI.
 * Props:
 *   viewCreditNote — { creditNote, details, company }
 *   onClose        — callback para cerrar el modal
 */
export default function CreditNoteRideModal({ viewCreditNote, onClose }) {
  if (!viewCreditNote) return null;

  const { creditNote, details, company } = viewCreditNote;
  const isCanceled = creditNote.estado === 'ANULADA';

  const issuerName = company?.razon_social || company?.nombre_comercial || 'Empresa no configurada';
  const tradeName = company?.nombre_comercial || issuerName;
  const companyRuc = company?.ruc || 'RUC no configurado';
  const matrixAddress = company?.direccion_matriz || 'Dirección no configurada';
  const accountingRequired = company?.obligado_contabilidad ? 'SI' : 'NO';
  const logoUrl = resolveAssetUrl(company?.logo_url);

  const authorizationNumber = creditNote.sri_numero_autorizacion || creditNote.clave_acceso || 'PENDIENTE SRI';
  const authorizationDate = creditNote.sri_fecha_autorizacion || creditNote.fecha_emision;
  const accessKey = creditNote.clave_acceso || '';

  const subtotalIvaCero = parseFloat(creditNote.subtotal_iva_cero || 0);
  const subtotalConIva = parseFloat(creditNote.subtotal_con_iva || 0);
  const subtotalSinImpuesto = subtotalIvaCero + subtotalConIva;
  const valorIva = parseFloat(creditNote.valor_iva || 0);
  const total = parseFloat(creditNote.total || 0);
  const descuento = parseFloat(creditNote.descuento_total || 0);

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
          aria-label="Cerrar nota de crédito"
          style={{ top: '10px', right: '10px' }}
        >
          X
        </button>

        {/* Cabecera — 2 columnas */}
        <div className="d-grid gap-2" style={{ gridTemplateColumns: '1fr 1.35fr' }}>
          {/* Columna izquierda — Datos del emisor */}
          <div>
            <div className="d-flex align-items-start gap-2 mb-2">
              <div
                className="border d-flex align-items-center justify-content-center bg-white"
                style={{ width: '150px', height: '74px', padding: '6px' }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt={tradeName} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : (
                  <div className="fw-bold text-center text-primary" style={{ fontSize: '0.95rem', lineHeight: 1.05 }}>{tradeName}</div>
                )}
              </div>
            </div>

            <div className="border rounded-1 p-2 small" style={{ minHeight: '116px' }}>
              <div className="fw-bold">{issuerName}</div>
              <div><strong>Dir. Matriz:</strong> {matrixAddress}</div>
              <div><strong>Dir. Sucursal:</strong> {creditNote.sucursal_direccion || matrixAddress}</div>
              <div><strong>Obligado a llevar contabilidad:</strong> {accountingRequired}</div>
              {company?.contribuyente_especial && <div><strong>Contribuyente Especial:</strong> {company.contribuyente_especial}</div>}
              {company?.regimen && <div><strong>Régimen:</strong> {company.regimen}</div>}
            </div>
          </div>

          {/* Columna derecha — Datos SRI */}
          <div className="border rounded-1 p-2 small">
            <div><strong>RUC:</strong> {companyRuc}</div>
            <div className="fw-bold" style={{ fontSize: '1.05rem' }}>NOTA DE CRÉDITO No. {creditNote.numero_nota_credito}</div>
            <div className="fw-bold mt-1">NÚMERO DE AUTORIZACIÓN:</div>
            <div className="font-monospace text-break" style={{ fontSize: '0.74rem' }}>{authorizationNumber}</div>
            <div className="mt-1"><strong>FECHA Y HORA DE AUTORIZACIÓN:</strong> {authorizationDate ? new Date(authorizationDate).toLocaleString() : 'N/D'}</div>
            <div><strong>AMBIENTE:</strong> {creditNote.sri_ambiente || 'PRUEBAS'}</div>
            <div><strong>EMISIÓN:</strong> NORMAL</div>
            <div className="fw-bold mt-1">CLAVE DE ACCESO:</div>
            <div className="text-center border-top pt-1 mt-1">
              <div className="font-monospace" style={{ letterSpacing: '2px', fontSize: '0.7rem' }}>||||| || ||||| ||| |||| |||||| |||</div>
              <div className="font-monospace text-break" style={{ fontSize: '0.66rem' }}>{accessKey || 'PENDIENTE'}</div>
            </div>
          </div>
        </div>

        {/* Doc de sustento */}
        <div className="border rounded-1 p-2 small mt-3">
          <div className="fw-bold mb-1" style={{ color: '#b91c1c' }}>DOCUMENTO QUE SE MODIFICA</div>
          <div className="d-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', columnGap: '1rem' }}>
            <div><strong>Tipo:</strong> Factura</div>
            <div><strong>N°:</strong> {creditNote.numero_factura || 'N/D'}</div>
            <div><strong>Fecha:</strong> {creditNote.factura_fecha ? new Date(creditNote.factura_fecha).toLocaleDateString() : 'N/D'}</div>
          </div>
          <div className="mt-1"><strong>Motivo:</strong> {creditNote.motivo || 'DEVOLUCIÓN'}</div>
        </div>

        {/* Datos del comprador */}
        <div className="border rounded-1 p-2 small mt-2">
          <div className="d-grid" style={{ gridTemplateColumns: '1.8fr 1fr 1fr', columnGap: '1rem' }}>
            <div><strong>Cliente:</strong> {creditNote.cliente_nombre}</div>
            <div><strong>Emisión:</strong> {creditNote.fecha_emision ? new Date(creditNote.fecha_emision).toLocaleDateString() : 'N/D'}</div>
            <div><strong>NC #:</strong> {creditNote.id_nota_credito}</div>
            <div><strong>C.I./RUC:</strong> {creditNote.cliente_identificacion}</div>
            <div><strong>Email:</strong> {creditNote.cliente_email || 'S/D'}</div>
            <div></div>
          </div>
        </div>

        {/* Tabla de detalles */}
        <table className="table table-bordered table-sm small align-middle my-2" style={{ borderColor: '#4b5563' }}>
          <thead>
            <tr className="text-center">
              <th style={{ width: '75px' }}>Código</th>
              <th>Detalle del producto</th>
              <th style={{ width: '62px' }}>Cant.</th>
              <th style={{ width: '78px' }}>PVP</th>
              <th style={{ width: '82px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(details || []).map((d, i) => {
              const base = parseFloat(d.precio_total || d.precio_unitario * d.cantidad || 0);
              return (
                <tr key={d.id_detalle || i}>
                  <td className="font-monospace">{d.producto_codigo || d.codigo}</td>
                  <td>{d.producto_nombre || d.producto_name}</td>
                  <td className="text-center">{qty(d.cantidad)}</td>
                  <td className="text-end">{money(d.precio_unitario)}</td>
                  <td className="text-end">{money(base)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totales */}
        <div className="d-flex justify-content-end">
          <div className="border rounded-1 p-2 small" style={{ minWidth: '260px' }}>
            {[
              ['Subtotal (con IVA)', subtotalConIva],
              ['Subtotal 0%', subtotalIvaCero],
              ['Descuento', descuento],
              ['Total sin impuestos', subtotalSinImpuesto - descuento],
              ['IVA', valorIva],
              ['VALOR DE MODIFICACIÓN', total],
            ].map(([label, value]) => (
              <div key={label} className={`d-flex justify-content-between ${label === 'VALOR DE MODIFICACIÓN' ? 'fw-bold border-top mt-1 pt-1' : ''}`}>
                <span>{label}</span>
                <span>{money(value)}</span>
              </div>
            ))}
          </div>
        </div>

        {isCanceled && <div className="alert alert-danger text-center fw-bold py-2 mt-3 mb-0">DOCUMENTO ANULADO</div>}

        <div className="text-center mt-4 small">
          <div style={{ width: '170px', borderTop: '1px solid #777', margin: '0 auto 2px' }}></div>
          Cliente
        </div>

        <div className="form-actions-buttons border-top pt-3 mt-3 d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => printDocument()}>
            Imprimir RIDE
          </button>
          <button type="button" className="btn btn-danger" style={{ backgroundColor: '#f43f5e', color: '#ffffff' }} onClick={onClose}>
            Cerrar RIDE
          </button>
        </div>
      </div>
    </div>
  );
}
