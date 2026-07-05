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

export default function InvoiceRideModal({ viewInvoice, onClose }) {
  if (!viewInvoice) return null;

  const { invoice, details, payments, cobros, company } = viewInvoice;
  const isCanceled = invoice.estado === 'ANULADA';
  const issuerName = company?.razon_social || company?.nombre_comercial || 'Empresa no configurada';
  const tradeName = company?.nombre_comercial || issuerName;
  const companyRuc = company?.ruc || 'RUC no configurado';
  const matrixAddress = company?.direccion_matriz || 'Direccion matriz no configurada';
  const accountingRequired = company?.obligado_contabilidad ? 'SI' : 'NO';
  const logoUrl = resolveAssetUrl(company?.logo_url);
  const authorizationNumber = invoice.sri_numero_autorizacion || invoice.clave_acceso || 'PENDIENTE SRI';
  const authorizationDate = invoice.sri_fecha_autorizacion || invoice.fecha_emision;
  const accessKey = invoice.clave_acceso || '';
  const subtotalNoTax = parseFloat(invoice.subtotal_con_iva || 0) + parseFloat(invoice.subtotal_iva_cero || 0);
  const paidTotal = parseFloat(invoice.monto_pago || 0) + (cobros || []).reduce((sum, c) => sum + parseFloat(c.monto || 0), 0);

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
          aria-label="Cerrar factura"
          style={{ top: '10px', right: '10px' }}
        >
          X
        </button>

        <div className="d-grid gap-2" style={{ gridTemplateColumns: '1fr 1.35fr' }}>
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
              <div><strong>Dir. Sucursal:</strong> {invoice.sucursal_direccion || matrixAddress}</div>
              <div><strong>Obligado a llevar contabilidad:</strong> {accountingRequired}</div>
              {company?.contribuyente_especial && <div><strong>Agente/Contribuyente especial:</strong> {company.contribuyente_especial}</div>}
              {company?.regimen && <div><strong>Regimen:</strong> {company.regimen}</div>}
            </div>
          </div>

          <div className="border rounded-1 p-2 small">
            <div><strong>RUC:</strong> {companyRuc}</div>
            <div className="fw-bold" style={{ fontSize: '1.05rem' }}>FACTURA No. {invoice.numero_factura}</div>
            <div className="fw-bold mt-1">NUMERO DE AUTORIZACION:</div>
            <div className="font-monospace text-break" style={{ fontSize: '0.74rem' }}>{authorizationNumber}</div>
            <div className="mt-1"><strong>FECHA Y HORA DE AUTORIZACION:</strong> {authorizationDate ? new Date(authorizationDate).toLocaleString() : 'N/D'}</div>
            <div><strong>AMBIENTE:</strong> {invoice.sri_ambiente || 'PRUEBAS'}</div>
            <div><strong>EMISION:</strong> NORMAL</div>
            <div className="fw-bold mt-1">CLAVE DE ACCESO:</div>
            <div className="text-center border-top pt-1 mt-1">
              <div className="font-monospace" style={{ letterSpacing: '2px', fontSize: '0.7rem' }}>||||| || ||||| ||| |||| |||||| |||</div>
              <div className="font-monospace text-break" style={{ fontSize: '0.66rem' }}>{accessKey || 'PENDIENTE'}</div>
            </div>
          </div>
        </div>

        <div className="border rounded-1 p-2 small mt-3">
          <div className="d-grid" style={{ gridTemplateColumns: '1.8fr 1fr 1fr', columnGap: '1rem' }}>
            <div><strong>Cliente:</strong> {invoice.cliente_nombre}</div>
            <div><strong>Emision:</strong> {invoice.fecha_emision ? new Date(invoice.fecha_emision).toLocaleDateString() : 'N/D'}</div>
            <div><strong>TRANS #:</strong> {invoice.id_factura}</div>
            <div><strong>Direccion:</strong> {invoice.cliente_direccion || 'S/D'}</div>
            <div><strong>C.I./RUC:</strong> {invoice.cliente_identificacion}</div>
            <div><strong>Email:</strong> {invoice.cliente_email || 'S/D'}</div>
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
              <th style={{ width: '82px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d) => {
              const discount = parseFloat(d.descuento_total || d.descuento || 0) || 0;
              const total = Math.max(parseFloat(d.precio_total || 0) + parseFloat(d.valor_iva || 0) - discount, 0);
              return (
                <tr key={d.id_detalle}>
                  <td className="font-monospace">{d.producto_codigo}</td>
                  <td>{d.producto_name || d.producto_nombre}</td>
                  <td className="text-center">{qty(d.cantidad)}</td>
                  <td className="text-end">{money(d.precio_unitario)}</td>
                  <td className="text-end">{money(discount)}</td>
                  <td className="text-end">{money(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="d-grid gap-2" style={{ gridTemplateColumns: '1fr 1.15fr' }}>
          <div>
            <div className="border rounded-1 p-2 small mb-2">
              <div className="fw-bold mb-1">Info. Adicional</div>
              <div><strong>EMAIL:</strong> {invoice.cliente_email || 'S/D'}</div>
              <div><strong>Vendedor:</strong> {invoice.username || 'S/D'}</div>
              <div><strong>Bodega:</strong> {invoice.sucursal_nombre || 'MATRIZ'}</div>
              <div><strong>Observacion:</strong> {invoice.observacion || ''}</div>
            </div>
            <table className="table table-bordered table-sm small mb-0">
              <thead>
                <tr>
                  <th>Forma de Pago</th>
                  <th className="text-end">Valor</th>
                  <th>Plazo</th>
                  <th>Tiempo</th>
                </tr>
              </thead>
              <tbody>
                {(payments || []).length > 0 ? payments.map((p) => (
                  <tr key={p.id_pago}>
                    <td>{p.metodo_pago_nombre || 'Pago'}</td>
                    <td className="text-end">{money(p.monto)}</td>
                    <td>0</td>
                    <td>Dias</td>
                  </tr>
                )) : (
                  <tr>
                    <td>{invoice.metodo_pago_nombre || 'OTROS CON UTILIZACION DE SISTEMAS FINANCIEROS'}</td>
                    <td className="text-end">{money(invoice.total)}</td>
                    <td>0</td>
                    <td>Dias</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <div className="border rounded-1 p-2 small mb-2">
              {[
                ['Subtotal', invoice.subtotal_con_iva],
                ['Subtotal 0%', invoice.subtotal_iva_cero],
                ['Subtotal no sujeto IVA', 0],
                ['Subtotal sin impuesto', subtotalNoTax],
                ['Descuento', invoice.descuento_total || 0],
                ['Subtotal neto', Math.max(subtotalNoTax - parseFloat(invoice.descuento_total || 0), 0)],
                ['ICE', 0],
                ['IVA', invoice.valor_iva],
                ['Propina', 0],
                ['TOTAL', invoice.total],
              ].map(([label, value]) => (
                <div key={label} className={`d-flex justify-content-between ${label === 'TOTAL' ? 'fw-bold border-top mt-1 pt-1' : ''}`}>
                  <span>{label}</span>
                  <span>{money(value)}</span>
                </div>
              ))}
            </div>

            <table className="table table-bordered table-sm small mb-0">
              <thead>
                <tr>
                  <th>FORMA DE PAGO</th>
                  <th className="text-end">VALOR</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{parseFloat(invoice.saldo || 0) > 0 ? 'CREDITO' : 'CONTADO'}</td>
                  <td className="text-end">{money(invoice.saldo || invoice.total)}</td>
                </tr>
                {invoice.fecha_vencimiento && parseFloat(invoice.saldo || 0) > 0 && (
                  <tr>
                    <td>Vence credito</td>
                    <td className="text-end">{new Date(invoice.fecha_vencimiento).toLocaleDateString()}</td>
                  </tr>
                )}
                <tr className="fw-bold">
                  <td>TOTAL</td>
                  <td className="text-end">{money(invoice.total)}</td>
                </tr>
                {paidTotal > 0 && (
                  <tr>
                    <td>Pagado</td>
                    <td className="text-end">{money(paidTotal)}</td>
                  </tr>
                )}
              </tbody>
            </table>
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
