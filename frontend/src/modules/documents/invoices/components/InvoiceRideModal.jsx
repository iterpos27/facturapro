import React from 'react';

export default function InvoiceRideModal({ viewInvoice, onClose }) {
  if (!viewInvoice) return null;

  const { invoice, details, payments, cobros } = viewInvoice;
  const isCanceled = invoice.estado === 'ANULADA';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container text-dark print-document"
        style={{
          maxWidth: '900px',
          width: '95%',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '2rem',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className="modal-close-btn form-actions-buttons"
          onClick={onClose}
          aria-label="Cerrar factura"
          style={{ top: '15px', right: '15px' }}
        >
          X
        </button>

        {/* RIDE Header */}
        <div className="row g-3 mb-4">
          {/* Left Panel: Issuer */}
          <div className="col-md-6">
            <div className="p-3 border rounded h-100" style={{ backgroundColor: '#fcfcfc', borderColor: '#e2e8f0' }}>
              <div className="d-flex align-items-center mb-2">
                <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)', letterSpacing: '-0.03em' }}>
                  FACTURAPRO S.A.
                </span>
              </div>
              <div className="small">
                <div className="fw-bold mb-1">FACTURAPRO S.A.</div>
                <div><strong>Matriz:</strong> {invoice.direccion_matriz || 'Av. Amazonas N32-120 y La Niña'}</div>
                <div><strong>Sucursal:</strong> {invoice.sucursal_nombre} ({invoice.codigo_establecimiento}-{invoice.punto_emision})</div>
                <div className="mt-2"><strong>Obligado a llevar contabilidad:</strong> SI</div>
                {invoice.contribuyente_especial && (
                  <div><strong>Contribuyente Especial No:</strong> {invoice.contribuyente_especial}</div>
                )}
                {invoice.regimen_rimpe && (
                  <div className="badge bg-secondary mt-1">Contribuyente Régimen RIMPE</div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: SRI Info */}
          <div className="col-md-6">
            <div className="p-3 border rounded h-100" style={{ backgroundColor: '#fcfcfc', borderColor: '#e2e8f0' }}>
              <div className="text-secondary fw-bold small mb-1">R.U.C. 1792345678001</div>
              <h4 className="fw-bold m-0" style={{ letterSpacing: '-0.02em', color: '#1e293b' }}>
                FACTURA
              </h4>
              <div className="fw-bold text-primary mb-2" style={{ fontSize: '1.1rem' }}>
                No. {invoice.numero_factura}
              </div>

              <div className="small">
                <div><strong>NÚMERO DE AUTORIZACIÓN:</strong></div>
                <div className="text-break font-monospace text-secondary mb-2" style={{ fontSize: '0.8rem' }}>
                  {invoice.clave_acceso || 'SIMULADO - PENDIENTE SRI'}
                </div>
                <div><strong>FECHA/HORA AUTORIZACIÓN:</strong></div>
                <div className="text-secondary mb-2">
                  {invoice.fecha_emision ? new Date(invoice.fecha_emision).toLocaleString() : 'N/D'}
                </div>
                <div><strong>AMBIENTE:</strong> PRUEBAS</div>
                <div><strong>EMISIÓN:</strong> NORMAL</div>
              </div>

              {/* simulated barcode */}
              <div className="mt-3 text-center">
                <div
                  className="font-monospace text-muted d-inline-block px-3 py-1 rounded"
                  style={{
                    letterSpacing: '2px',
                    fontSize: '0.75rem',
                    backgroundColor: '#f1f5f9',
                    border: '1px dashed #cbd5e1'
                  }}
                >
                  ||||| | ||||| | ||| |||| | | |||||| || |
                  <br />
                  {invoice.clave_acceso || '00000000000000000000000000000000000000000'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Client details box */}
        <div className="p-3 border rounded mb-4" style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }}>
          <div className="row g-2 small">
            <div className="col-md-7">
              <div><strong>Razón Social / Nombres y Apellidos:</strong> {invoice.cliente_nombre}</div>
              <div className="mt-1"><strong>Identificación:</strong> {invoice.cliente_identificacion}</div>
              <div className="mt-1"><strong>Dirección:</strong> {invoice.cliente_direccion || 'S/D'}</div>
            </div>
            <div className="col-md-5">
              <div><strong>Fecha Emisión:</strong> {invoice.fecha_emision ? new Date(invoice.fecha_emision).toLocaleDateString() : 'N/D'}</div>
              <div className="mt-1"><strong>Guía Remisión:</strong> S/D</div>
              <div className="mt-1"><strong>Email:</strong> {invoice.cliente_email}</div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="table table-bordered table-sm small align-middle mb-4" style={{ borderColor: '#cbd5e1' }}>
          <thead className="table-light">
            <tr>
              <th className="text-center" style={{ width: '90px' }}>Cod.</th>
              <th className="text-center" style={{ width: '70px' }}>Cant.</th>
              <th>Descripción</th>
              <th className="text-end" style={{ width: '100px' }}>P. Unit</th>
              <th className="text-end" style={{ width: '90px' }}>Desc. $</th>
              <th className="text-end" style={{ width: '90px' }}>Desc. %</th>
              <th className="text-end" style={{ width: '110px' }}>Precio Total</th>
            </tr>
          </thead>
          <tbody>
            {details.map((d) => (
              <tr key={d.id_detalle}>
                <td className="text-center font-monospace">{d.producto_codigo}</td>
                <td className="text-center">{parseFloat(d.cantidad).toFixed(2)}</td>
                <td>{d.producto_name || d.producto_nombre}</td>
                <td className="text-end">${parseFloat(d.precio_unitario).toFixed(2)}</td>
                <td className="text-end">${parseFloat(d.descuento_total || d.descuento || 0).toFixed(2)}</td>
                <td className="text-end">{parseFloat(d.descuento_porcentaje || 0).toFixed(2)}%</td>
                <td className="text-end">${Math.max(parseFloat(d.precio_total || 0) + parseFloat(d.valor_iva || 0) - parseFloat(d.descuento_total || d.descuento || 0), 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer info: Payments and Totales */}
        <div className="row g-4 mb-3">
          {/* Left Footer: Payment info */}
          <div className="col-md-6">
            <div className="p-3 border rounded h-100" style={{ borderColor: '#e2e8f0', backgroundColor: '#fcfcfc' }}>
              <div className="fw-bold small mb-2 text-dark">FORMAS DE PAGO TRIBUTARIAS</div>
              {(payments || []).length > 0 ? (
                payments.map((p) => (
                  <div key={p.id_pago} className="d-flex justify-content-between small mb-1 border-bottom pb-1">
                    <span>{p.metodo_pago_nombre || 'Pago'}:</span>
                    <strong>${parseFloat(p.monto || 0).toFixed(2)}</strong>
                  </div>
                ))
              ) : (
                <div className="d-flex justify-content-between small mb-1 border-bottom pb-1">
                  <span>{invoice.metodo_pago_nombre || 'Sin método registrado'}:</span>
                  <strong>${parseFloat(invoice.total).toFixed(2)}</strong>
                </div>
              )}

              {/* Historial de abonos */}
              {cobros && cobros.length > 0 && (
                <div className="mt-3">
                  <div className="fw-bold small mb-2 text-danger">HISTORIAL DE ABONOS (CxC)</div>
                  {cobros.map((c) => (
                    <div key={c.id_cobro} className="d-flex justify-content-between small mb-1 border-bottom pb-1">
                      <span className="text-muted">
                        • {new Date(c.fecha_cobro).toLocaleDateString()} ({c.metodo_pago_nombre}):
                      </span>
                      <strong>${parseFloat(c.monto).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              )}

              {/* Saldos box */}
              <div className="mt-3 p-2 bg-light rounded border border-dashed text-dark">
                <div className="d-flex justify-content-between small">
                  <span>Anticipo Aplicado:</span>
                  <span>${parseFloat(invoice.anticipo || 0).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between small mt-1">
                  <span>Monto Pagado Total:</span>
                  <span>${(parseFloat(invoice.monto_pago || 0) + (cobros || []).reduce((s, c) => s + parseFloat(c.monto), 0)).toFixed(2)}</span>
                </div>
                <div className="d-flex justify-content-between small mt-1 border-top pt-1 text-danger fw-bold">
                  <span>SALDO EXIGIBLE (Crédito):</span>
                  <span>${parseFloat(invoice.saldo || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Footer: Tax break-down */}
          <div className="col-md-6">
            <div className="p-3 border rounded h-100" style={{ borderColor: '#e2e8f0', backgroundColor: '#fcfcfc' }}>
              <div className="d-flex justify-content-between small mb-1">
                <span>SUBTOTAL IVA 15%:</span>
                <span>${parseFloat(invoice.subtotal_con_iva).toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between small mb-1">
                <span>SUBTOTAL IVA 0%:</span>
                <span>${parseFloat(invoice.subtotal_iva_cero).toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between small mb-1">
                <span>SUBTOTAL SIN IMPUESTOS:</span>
                <span>${(parseFloat(invoice.subtotal_con_iva) + parseFloat(invoice.subtotal_iva_cero)).toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between small mb-1 text-danger">
                <span>TOTAL DESCUENTO:</span>
                <span>-${parseFloat(invoice.descuento_total || 0).toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between small mb-1">
                <span>IVA 15%:</span>
                <span>${parseFloat(invoice.valor_iva).toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between fw-bold text-success border-top pt-2 mt-2" style={{ fontSize: '1.2rem' }}>
                <span>VALOR TOTAL:</span>
                <span>${parseFloat(invoice.total).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Warning label if voided */}
        {isCanceled && (
          <div className="alert alert-danger text-center fw-bold py-2 mb-3">
            DOCUMENTO ANULADO
          </div>
        )}

        {/* Actions panel */}
        <div className="form-actions-buttons border-top pt-3 mt-3 d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            Imprimir RIDE
          </button>
          <button
            type="button"
            className="btn btn-danger"
            style={{ backgroundColor: '#f43f5e', color: '#ffffff' }}
            onClick={onClose}
          >
            Cerrar RIDE
          </button>
        </div>
      </div>
    </div>
  );
}
