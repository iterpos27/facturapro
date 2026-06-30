import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiUrl } from '../lib/api';

export default function CashRegisterManager() {
  const [boxes, setBoxes] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);

  // Campos para Apertura
  const [selectedBox, setSelectedBox] = useState('');
  const [montoApertura, setMontoApertura] = useState('0.00');

  // Campos para Cierre
  const [montoCierre, setMontoCierre] = useState('');

  // Usuario actual
  const [currentUser, setCurrentUser] = useState(null);

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
      const response = await fetch(apiUrl(`/api/cash-registers/status?id_usuario=${userId}`));
      if (response.ok) {
        const data = await response.json();
        if (data.sessionActive) {
          setActiveSession(data.session);
        } else {
          setActiveSession(null);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoxes = async () => {
    try {
      const response = await fetch(apiUrl('/api/cash-registers/list'));
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
      const response = await fetch(apiUrl('/api/cash-registers/payment-methods'));
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const showAlert = (message, type = 'success') => {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3500,
      timerProgressBar: true,
      background: '#ffffff',
      color: '#212529',
      iconColor: type === 'success' ? '#2eb85c' : '#e55353',
      customClass: {
        popup: 'swal-custom-toast'
      }
    });
    Toast.fire({
      icon: type,
      title: message
    });
  };

  const handleOpenRegister = async (e) => {
    e.preventDefault();

    if (!selectedBox || !currentUser || montoApertura === '') {
      showAlert('Por favor, complete todos los campos.', 'error');
      return;
    }

    const openAmount = parseFloat(montoApertura);
    if (isNaN(openAmount) || openAmount < 0) {
      showAlert('El monto de apertura debe ser mayor o igual a 0.', 'error');
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/cash-registers/open'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_caja: parseInt(selectedBox, 10),
          id_usuario: currentUser.id_usuario,
          monto_apertura: openAmount
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'No se pudo abrir la caja.');

      showAlert('Sesión de caja abierta correctamente.', 'success');
      checkSessionStatus(currentUser.id_usuario);
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  const handleCloseRegister = async (e) => {
    e.preventDefault();

    if (!activeSession || montoCierre === '') {
      showAlert('Debe ingresar el monto de cierre.', 'error');
      return;
    }

    const closeAmount = parseFloat(montoCierre);
    if (isNaN(closeAmount) || closeAmount < 0) {
      showAlert('El monto de cierre debe ser un número válido mayor o igual a 0.', 'error');
      return;
    }

    try {
      const response = await fetch(apiUrl('/api/cash-registers/close'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_sesion: activeSession.id_sesion,
          monto_cierre: closeAmount
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'No se pudo cerrar la caja.');

      showAlert('Sesión de caja cerrada y arqueada con éxito.', 'success');
      setMontoCierre('');
      checkSessionStatus(currentUser.id_usuario);
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Control de Caja y Métodos de Pago</h1>
          <p>Módulo para abrir/cerrar turnos de cajas e identificar las formas de pago oficiales SRI.</p>
        </div>
      </div>

      <div className="row">
        {/* LADO IZQUIERDO: APERTURA Y CIERRE DE CAJA */}
        <div className="col-lg-7 mb-4">
          {loading ? (
            <p>Verificando estado de caja chica...</p>
          ) : !activeSession ? (
            /* FORMULARIO DE APERTURA */
            <div className="card shadow-sm border">
              <div className="card-header bg-white py-3">
                <h5 className="mb-0 text-dark fw-bold">🚪 Apertura de Turno de Caja</h5>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleOpenRegister}>
                  <div className="form-group mb-3">
                    <label className="form-label fw-semibold text-secondary">Seleccionar Caja de Trabajo *</label>
                    <select
                      className="form-control"
                      value={selectedBox}
                      onChange={(e) => setSelectedBox(e.target.value)}
                      required
                    >
                      {boxes.length === 0 && <option value="">No hay cajas configuradas</option>}
                      {boxes.map((b) => (
                        <option key={b.id_caja} value={b.id_caja}>
                          {b.nombre} ({b.sucursal_nombre})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group mb-4">
                    <label className="form-label fw-semibold text-secondary">Monto Inicial en Efectivo ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control form-control-lg"
                      value={montoApertura}
                      onChange={(e) => setMontoApertura(e.target.value)}
                      placeholder="0.00"
                      required
                    />
                    <small className="text-muted">Fondo sencillo / cambio inicial con el que parte el turno.</small>
                  </div>

                  <button type="submit" className="btn btn-primary px-4 py-2 w-100 fw-bold">
                    Iniciar Turno de Caja
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* FORMULARIO DE CIERRE DE CAJA ABIERTA */
            <div className="card shadow-sm border">
              <div className="card-header bg-white py-3 d-flex align-items-center justify-content-between">
                <h5 className="mb-0 text-dark fw-bold">🔑 Caja Activa en Turno</h5>
                <span className="badge bg-success" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>ABIERTA</span>
              </div>
              <div className="card-body p-4">
                <div className="bg-light p-3 rounded mb-4">
                  <div className="row">
                    <div className="col-md-6 mb-2">
                      <span className="text-muted small d-block">Punto de Venta / Caja:</span>
                      <strong className="text-dark">{activeSession.caja_nombre}</strong>
                    </div>
                    <div className="col-md-6 mb-2">
                      <span className="text-muted small d-block">Fecha de Apertura:</span>
                      <strong className="text-dark">{new Date(activeSession.fecha_apertura).toLocaleString()}</strong>
                    </div>
                  </div>
                  <hr />
                  <div className="row">
                    <div className="col-md-12">
                      <span className="text-muted small d-block">Fondo de Apertura:</span>
                      <h4 className="text-primary fw-bold">${parseFloat(activeSession.monto_apertura).toFixed(2)}</h4>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleCloseRegister}>
                  <div className="form-group mb-4">
                    <label className="form-label fw-semibold text-secondary">Monto Final Obtenido ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control form-control-lg"
                      value={montoCierre}
                      onChange={(e) => setMontoCierre(e.target.value)}
                      placeholder="Ingrese conteo de efectivo total"
                      required
                    />
                    <small className="text-muted">Realiza el arqueo físico de caja antes de ingresar el monto final.</small>
                  </div>

                  <button type="submit" className="btn btn-danger px-4 py-2 w-100 fw-bold">
                    Cerrar Turno y Arqueo
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* LADO DERECHO: METODOS DE PAGO SRI */}
        <div className="col-lg-5 mb-4">
          <div className="card shadow-sm border">
            <div className="card-header bg-white py-3">
              <h5 className="mb-0 text-dark fw-bold">💳 Formas de Pago Homologadas SRI</h5>
            </div>
            <div className="card-body p-3">
              <p className="small text-secondary mb-3">
                Listado oficial de métodos de pago definidos por el SRI de Ecuador para los comprobantes electrónicos.
              </p>
              <div className="list-group">
                {paymentMethods.map((pm) => (
                  <div key={pm.id_metodo} className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <span className="badge bg-secondary me-2">{pm.codigo_sri}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '500' }}>{pm.nombre}</span>
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
