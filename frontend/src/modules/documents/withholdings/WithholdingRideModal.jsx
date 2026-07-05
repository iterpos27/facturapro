import React from 'react';
import { apiUrl } from '../../../lib/api';
import { printDocument } from '../../../lib/printDocument';

const money = (value) => (parseFloat(value || 0) || 0).toFixed(2);

function resolveAssetUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  return url.startsWith('/uploads/') ? apiUrl(url) : url;
}

/**
 * WithholdingRideModal
 * Representación impresa (RIDE) de un Comprobante de Retención Electrónico SRI.
 * Props:
 *   viewWithholding — { withholding, details, company }
 *   onClose         — callback para cerrar el modal
 */
export default function WithholdingRideModal({ viewWithholding, onClose }) {
  if (!viewWithholding) return null;

  const { withholding, details, company } = viewWithholding;
  const isCanceled = withholding.estado === 'ANULADA';

  const issuerName = company?.razon_social || company?.nombre_comercial || 'Empresa no configurada';
  const tradeName = company?.nombre_comercial || issuerName;
  const companyRuc = company?.ruc || 'RUC no configurado';
  const matrixAddress = company?.direccion_matriz || 'Dirección no configurada';
  const accountingRequired = company?.obligado_contabilidad ? 'SI' : 'NO';
  const logoUrl = resolveAssetUrl(company?.logo_url);

  const authorizationNumber = withholding.sri_numero_autorizacion || withholding.clave_acceso || 'PENDIENTE SRI';
  const authorizationDate = withholding.sri_fecha_autorizacion || withholding.fecha_emision;
  const accessKey = withholding.clave_acceso || '';

  // Período fiscal mm/yyyy
  const periodDate = withholding.fecha_compra || withholding.fecha_emision;
  const periodoFiscal = periodDate
    ? `${String(new Date(periodDate).getMonth() + 1).padStart(2, '0')}/${new Date(periodDate).getFullYear()}`
    : 'N/D';

  const totalRetenido = (details || []).reduce((sum, d) => sum + parseFloat(d.valor_retenido || 0), 0);

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
          aria-label="Cerrar retención"
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
              <div><strong>Obligado a llevar contabilidad:</strong> {accountingRequired}</div>
              {company?.contribuyente_especial && <div><strong>Contribuyente Especial:</strong> {company.contribuyente_especial}</div>}
              {company?.regimen && <div><strong>Régimen:</strong> {company.regimen}</div>}
            </div>
          </div>

          {/* Columna derecha — Datos SRI */}
          <div className="border rounded-1 p-2 small">
            <div><strong>RUC:</strong> {companyRuc}</div>
            <div className="fw-bold" style={{ fontSize: '1.05rem' }}>COMPROBANTE DE RETENCIÓN No. {withholding.numero_retencion}</div>
            <div className="fw-bold mt-1">NÚMERO DE AUTORIZACIÓN:</div>
            <div className="font-monospace text-break" style={{ fontSize: '0.74rem' }}>{authorizationNumber}</div>
            <div className="mt-1"><strong>FECHA Y HORA DE AUTORIZACIÓN:</strong> {authorizationDate ? new Date(authorizationDate).toLocaleString() : 'N/D'}</div>
            <div><strong>AMBIENTE:</strong> {withholding.sri_ambiente || 'PRUEBAS'}</div>
            <div><strong>EMISIÓN:</strong> NORMAL</div>
            <div className="fw-bold mt-1">CLAVE DE ACCESO:</div>
            <div className="text-center border-top pt-1 mt-1">
              <div className="font-monospace" style={{ letterSpacing: '2px', fontSize: '0.7rem' }}>||||| || ||||| ||| |||| |||||| |||</div>
              <div className="font-monospace text-break" style={{ fontSize: '0.66rem' }}>{accessKey || 'PENDIENTE'}</div>
            </div>
          </div>
        </div>

        {/* Datos del sujeto retenido */}
        <div className="border rounded-1 p-2 small mt-3">
          <div className="d-grid" style={{ gridTemplateColumns: '1.8fr 1fr 1fr', columnGap: '1rem' }}>
            <div><strong>Proveedor:</strong> {withholding.proveedor_nombre}</div>
            <div><strong>Fecha emisión:</strong> {withholding.fecha_emision ? new Date(withholding.fecha_emision).toLocaleDateString() : 'N/D'}</div>
            <div><strong>Período fiscal:</strong> {periodoFiscal}</div>
            <div><strong>C.I./RUC:</strong> {withholding.proveedor_identificacion}</div>
            <div><strong>Doc. sustento:</strong> {withholding.numero_factura_compra || 'N/D'}</div>
            <div><strong>Fecha compra:</strong> {withholding.fecha_compra ? new Date(withholding.fecha_compra).toLocaleDateString() : 'N/D'}</div>
          </div>
        </div>

        {/* Tabla de impuestos retenidos */}
        <table className="table table-bordered table-sm small align-middle my-2" style={{ borderColor: '#4b5563' }}>
          <thead>
            <tr className="text-center">
              <th>Impuesto</th>
              <th>Código</th>
              <th style={{ width: '110px' }}>Base Imponible</th>
              <th style={{ width: '90px' }}>% Retención</th>
              <th style={{ width: '100px' }}>Valor Retenido</th>
            </tr>
          </thead>
          <tbody>
            {(details || []).map((d, i) => (
              <tr key={d.id_detalle || i}>
                <td>{d.impuesto || (d.codigo_sri?.startsWith('3') ? 'IVA' : 'RENTA')}</td>
                <td className="text-center font-monospace">{d.codigo_sri}</td>
                <td className="text-end">{money(d.base_imponible)}</td>
                <td className="text-center">{money(d.porcentaje)}%</td>
                <td className="text-end fw-semibold">{money(d.valor_retenido)}</td>
              </tr>
            ))}
            <tr className="fw-bold table-light">
              <td colSpan={4} className="text-end">TOTAL RETENIDO</td>
              <td className="text-end">{money(totalRetenido)}</td>
            </tr>
          </tbody>
        </table>

        <div className="border rounded-1 p-2 small mt-2">
          <div><strong>Observaciones:</strong> {withholding.observacion || 'Ninguna'}</div>
        </div>

        {isCanceled && <div className="alert alert-danger text-center fw-bold py-2 mt-3 mb-0">DOCUMENTO ANULADO</div>}

        <div className="text-center mt-4 small">
          <div style={{ width: '170px', borderTop: '1px solid #777', margin: '0 auto 2px' }}></div>
          Proveedor
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
