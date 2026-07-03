import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

export default function CashRegisterManager() {
  const [boxes, setBoxes] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedBox, setSelectedBox] = useState('');
  const [aperturaBilletes, setAperturaBilletes] = useState('0.00');
  const [aperturaMonedas, setAperturaMonedas] = useState('0.00');
  const [cierreBilletes, setCierreBilletes] = useState('');
  const [cierreMonedas, setCierreMonedas] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [lastClosedSession, setLastClosedSession] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const parsed = JSON.parse(userStr);
      setCurrentUser(parsed);
      checkSessionStatus(parsed.id_usuario);
    }
    fetchBoxes();
    fetchPaymentMethods();
  }, []);

  const checkSessionStatus = async (userId) => {
    setLoading(true);
    try {
      const response = await apiFetch(`/api/cash-registers/status?id_usuario=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setActiveSession(data.sessionActive ? data.session : null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoxes = async () => {
    try {
      const response = await apiFetch('/api/cash-registers/list');
      if (response.ok) {
        const data = await response.json();
        setBoxes(data);
        if (data.length > 0) setSelectedBox(data[0].id_caja);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await apiFetch('/api/cash-registers/payment-methods');
      if (response.ok) {
        setPaymentMethods(await response.json());
      }
    } catch (error) {
      console.error(error);
    }
  };

  const showAlert = (message, type = 'success') => {
    Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3500,
      timerProgressBar: true,
      background: '#ffffff',
      color: '#212529',
      iconColor: type === 'success' ? '#2eb85c' : '#e55353',
      customClass: { popup: 'swal-custom-toast' },
    }).fire({ icon: type, title: message });
  };

  const cashSummary = activeSession?.summary || {};
  const openingBills = Number(activeSession?.apertura_billetes ?? activeSession?.monto_apertura ?? 0);
  const openingCoins = Number(activeSession?.apertura_monedas || 0);
  const openingTotal = openingBills + openingCoins;
  const expectedCash = openingTotal + Number(cashSummary.esperado_caja || 0);
  const operationalTotal = expectedCash + Number(cashSummary.ventas_credito || 0);
  const closingTotal = Number(cierreBilletes || 0) + Number(cierreMonedas || 0);
  const closeDifference = cierreBilletes === '' && cierreMonedas === '' ? null : closingTotal - expectedCash;

  const handleOpenRegister = async (e) => {
    e.preventDefault();

    if (!selectedBox || !currentUser) {
      showAlert('Por favor, complete todos los campos.', 'error');
      return;
    }

    const openAmount = Number(aperturaBilletes || 0) + Number(aperturaMonedas || 0);
    if (!Number.isFinite(openAmount) || openAmount < 0) {
      showAlert('El monto de apertura debe ser mayor o igual a 0.', 'error');
      return;
    }

    try {
      const response = await apiFetch('/api/cash-registers/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_caja: parseInt(selectedBox, 10),
          id_usuario: currentUser.id_usuario,
          monto_apertura: openAmount,
          apertura_billetes: Number(aperturaBilletes || 0),
          apertura_monedas: Number(aperturaMonedas || 0),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo abrir la caja.');

      showAlert('Sesion de caja abierta correctamente.', 'success');
      checkSessionStatus(currentUser.id_usuario);
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  const handleCloseRegister = async (e) => {
    e.preventDefault();

    if (!activeSession || (cierreBilletes === '' && cierreMonedas === '')) {
      showAlert('Debe ingresar el conteo de cierre.', 'error');
      return;
    }

    const closeAmount = Number(cierreBilletes || 0) + Number(cierreMonedas || 0);
    if (!Number.isFinite(closeAmount) || closeAmount < 0) {
      showAlert('El monto de cierre debe ser mayor o igual a 0.', 'error');
      return;
    }

    try {
      const response = await apiFetch('/api/cash-registers/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_sesion: activeSession.id_sesion,
          monto_cierre: closeAmount,
          cierre_billetes: Number(cierreBilletes || 0),
          cierre_monedas: Number(cierreMonedas || 0),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo cerrar la caja.');

      showAlert('Sesion de caja cerrada y arqueada con exito.', 'success');
      setLastClosedSession(result);
      setCierreBilletes('');
      setCierreMonedas('');
      checkSessionStatus(currentUser.id_usuario);
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Caja</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>
            Apertura, arqueo y cierre por billetes, monedas, credito y notas de credito.
          </p>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-7 mb-4">
          {loading ? (
            <p>Verificando estado de caja...</p>
          ) : !activeSession ? (
            <div className="card shadow-sm border">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0 text-dark fw-bold">Apertura de Turno de Caja</h5>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleOpenRegister}>
                  <div className="form-group mb-3">
                    <label className="form-label fw-semibold text-secondary">Seleccionar caja *</label>
                    <select className="form-control" value={selectedBox} onChange={(e) => setSelectedBox(e.target.value)} required>
                      {boxes.length === 0 && <option value="">No hay cajas configuradas</option>}
                      {boxes.map((box) => (
                        <option key={box.id_caja} value={box.id_caja}>
                          {box.nombre} ({box.sucursal_nombre})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold text-secondary">Apertura en billetes ($) *</label>
                      <input type="number" step="0.01" min="0" className="form-control form-control-lg" value={aperturaBilletes} onChange={(e) => setAperturaBilletes(e.target.value)} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold text-secondary">Apertura en monedas ($) *</label>
                      <input type="number" step="0.01" min="0" className="form-control form-control-lg" value={aperturaMonedas} onChange={(e) => setAperturaMonedas(e.target.value)} required />
                    </div>
                    <small className="text-muted mt-2">
                      Total apertura: {money(Number(aperturaBilletes || 0) + Number(aperturaMonedas || 0))}
                    </small>
                  </div>

                  <button type="submit" className="btn btn-primary px-4 py-2 w-100 fw-bold">
                    Iniciar Turno de Caja
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="card shadow-sm border">
              <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
                <h5 className="mb-0 text-dark fw-bold">Caja Activa en Turno</h5>
                <span className="badge bg-success" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>ABIERTA</span>
              </div>
              <div className="card-body p-4">
                <div className="bg-light p-3 rounded mb-4">
                  <div className="row">
                    <div className="col-md-6 mb-2">
                      <span className="text-muted small d-block">Punto de venta / caja</span>
                      <strong className="text-dark">{activeSession.caja_nombre}</strong>
                    </div>
                    <div className="col-md-6 mb-2">
                      <span className="text-muted small d-block">Fecha de apertura</span>
                      <strong className="text-dark">{new Date(activeSession.fecha_apertura).toLocaleString()}</strong>
                    </div>
                  </div>
                  <hr />
                  <span className="text-muted small d-block">Fondo de apertura</span>
                  <h4 className="text-primary fw-bold">{money(openingTotal)}</h4>
                  <small className="text-muted">Billetes {money(openingBills)} + monedas {money(openingCoins)}</small>
                </div>

                <div className="row g-2 mb-3">
                  <SummaryTile label="Ventas contado" value={cashSummary.ventas_contado} />
                  <SummaryTile label="Ventas credito" value={cashSummary.ventas_credito} />
                  <SummaryTile label="Cobros CxC" value={cashSummary.cobros_cxc} />
                  <SummaryTile label="Notas credito (-)" value={cashSummary.notas_credito_total} />
                  <SummaryTile label="Efectivo esperado" value={expectedCash} />
                  <SummaryTile label="Total operativo" value={operationalTotal} />
                  {closeDifference !== null && (
                    <div className="col-md-12">
                      <div className={`border rounded p-2 ${Math.abs(closeDifference) < 0.01 ? 'bg-light' : 'bg-warning-subtle'}`}>
                        <span className="text-muted small d-block">Diferencia contra conteo fisico</span>
                        <strong>{money(closeDifference)}</strong>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleCloseRegister}>
                  <div className="row mb-4">
                    <div className="col-md-6">
                      <label className="form-label fw-semibold text-secondary">Cierre en billetes ($) *</label>
                      <input type="number" step="0.01" min="0" className="form-control form-control-lg" value={cierreBilletes} onChange={(e) => setCierreBilletes(e.target.value)} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label fw-semibold text-secondary">Cierre en monedas ($) *</label>
                      <input type="number" step="0.01" min="0" className="form-control form-control-lg" value={cierreMonedas} onChange={(e) => setCierreMonedas(e.target.value)} required />
                    </div>
                    <small className="text-muted mt-2">
                      Conteo fisico: {money(closingTotal)}. El credito suma al total operativo, pero no al efectivo fisico.
                    </small>
                  </div>

                  <button type="submit" className="btn btn-danger px-4 py-2 w-100 fw-bold">
                    Cerrar Turno y Arqueo
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        <div className="col-lg-5 mb-4">
          {lastClosedSession && (
            <div className="card shadow-sm border mb-3 print-document">
              <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                <h5 className="mb-0 text-dark fw-bold">Recibo de cierre</h5>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>Imprimir</button>
              </div>
              <div className="card-body p-3 small">
                <div className="text-center mb-2">
                  <strong>CIERRE DE CAJA</strong>
                  <div>{lastClosedSession.caja_nombre || activeSession?.caja_nombre || 'Caja'}</div>
                </div>
                <div className="d-flex justify-content-between"><span>Apertura</span><strong>{money(lastClosedSession.monto_apertura)}</strong></div>
                <div className="d-flex justify-content-between"><span>Ventas contado</span><strong>{money(lastClosedSession.summary?.ventas_contado)}</strong></div>
                <div className="d-flex justify-content-between"><span>Ventas credito</span><strong>{money(lastClosedSession.summary?.ventas_credito)}</strong></div>
                <div className="d-flex justify-content-between"><span>Cobros CxC</span><strong>{money(lastClosedSession.summary?.cobros_cxc)}</strong></div>
                <div className="d-flex justify-content-between"><span>Notas credito</span><strong>-{money(lastClosedSession.summary?.notas_credito_total)}</strong></div>
                <hr />
                <div className="d-flex justify-content-between"><span>Efectivo esperado</span><strong>{money(lastClosedSession.efectivo_esperado)}</strong></div>
                <div className="d-flex justify-content-between"><span>Conteo fisico</span><strong>{money(lastClosedSession.monto_cierre)}</strong></div>
                <div className="d-flex justify-content-between"><span>Diferencia</span><strong>{money(lastClosedSession.diferencia_cierre)}</strong></div>
              </div>
            </div>
          )}

          <div className="card shadow-sm border">
            <div className="card-header bg-white py-3">
              <h5 className="mb-0 text-dark fw-bold">Formas de Pago SRI</h5>
            </div>
            <div className="card-body p-3">
              <p className="small text-secondary mb-3">Metodos de pago disponibles para comprobantes electronicos.</p>
              <div className="list-group">
                {paymentMethods.map((method) => (
                  <div key={method.id_metodo} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <span className="badge bg-secondary me-2">{method.codigo_sri}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>{method.nombre}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({ label, value }) {
  return (
    <div className="col-md-4">
      <div className="border rounded p-2 bg-white">
        <span className="text-muted small d-block">{label}</span>
        <strong>{money(value)}</strong>
      </div>
    </div>
  );
}
