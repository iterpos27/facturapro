import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../lib/api';

export default function InventoryManager() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Campos del formulario
  const [idProducto, setIdProducto] = useState('');
  const [tipo, setTipo] = useState('INGRESO');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('AJUSTE');
  const [referencia, setReferencia] = useState('');

  // Usuario activo en el sistema
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchMovements();
    fetchProducts();
    
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/inventory/movements');
      if (!response.ok) throw new Error('Error al conectar con la base de datos.');
      const data = await response.json();
      setMovements(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await apiFetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
        if (data.length > 0) setIdProducto(data[0].id_producto);
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

  const handleCancel = () => {
    if (products.length > 0) setIdProducto(products[0].id_producto);
    setTipo('INGRESO');
    setCantidad('');
    setMotivo('AJUSTE');
    setReferencia('');
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!idProducto || !tipo || !cantidad || !motivo) {
      showAlert('Por favor, complete todos los campos obligatorios.', 'error');
      return;
    }

    const cantNum = parseFloat(cantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      showAlert('La cantidad debe ser un número válido mayor a 0.', 'error');
      return;
    }

    const movementData = {
      id_producto: parseInt(idProducto, 10),
      tipo,
      cantidad: cantNum,
      motivo,
      referencia,
      id_usuario: currentUser ? currentUser.id_usuario : null
    };

    try {
      const response = await apiFetch('/api/inventory/movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(movementData),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'No se pudo procesar el movimiento.');

      showAlert('Movimiento de inventario registrado con éxito.', 'success');
      handleCancel();
      fetchMovements();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Movimientos de Inventario</h1>
          <p>Kárdex y control de entradas y salidas de existencias del almacén.</p>
        </div>
        
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Registrar Movimiento
        </button>
      </div>

      <div>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando kárdex...</p>
        ) : movements.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', margin: 0 }}>
              No se han registrado movimientos de inventario aún.
            </p>
          </div>
        ) : (
          <div>
            <div className="table-responsive desktop-only">
              <table className="table table-striped table-hover align-middle border">
                <thead className="table-light">
                  <tr>
                    <th>Fecha / Hora</th>
                    <th>Código Prod.</th>
                    <th>Producto</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Motivo</th>
                    <th>Referencia</th>
                    <th>Operador</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((mov) => {
                    const formatFecha = new Date(mov.fecha).toLocaleString();
                    const isIngreso = mov.tipo === 'INGRESO';

                    return (
                      <tr key={mov.id_movimiento}>
                        <td>{formatFecha}</td>
                        <td style={{ fontWeight: '600' }}>{mov.producto_codigo}</td>
                        <td>{mov.producto_nombre}</td>
                        <td>
                          <span 
                            className={`badge`} 
                            style={{ 
                              backgroundColor: isIngreso ? '#d2f4ea' : '#f8d7da', 
                              color: isIngreso ? '#14a44d' : '#dc3545',
                              fontWeight: 'bold'
                            }}
                          >
                            {mov.tipo}
                          </span>
                        </td>
                        <td style={{ fontWeight: '700' }}>{parseFloat(mov.cantidad).toFixed(2)}</td>
                        <td>{mov.motivo}</td>
                        <td>{mov.referencia || '-'}</td>
                        <td>{mov.username || 'Sistema'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="client-cards-container mobile-only">
              {movements.map((mov) => {
                const formatFecha = new Date(mov.fecha).toLocaleString();
                const isIngreso = mov.tipo === 'INGRESO';

                return (
                  <div key={mov.id_movimiento} className="client-mobile-card">
                    <div className="client-card-header">
                      <span className="client-name">{mov.producto_nombre}</span>
                      <span 
                        className={`badge`} 
                        style={{ 
                          backgroundColor: isIngreso ? '#d2f4ea' : '#f8d7da', 
                          color: isIngreso ? '#14a44d' : '#dc3545',
                          fontWeight: 'bold'
                        }}
                      >
                        {mov.tipo}
                      </span>
                    </div>
                    <div className="client-card-body">
                      <div className="client-card-info-item">
                        <span className="info-label">Fecha / Cantidad:</span>
                        <span className="info-val">{formatFecha} / <strong>{parseFloat(mov.cantidad).toFixed(2)}</strong></span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Motivo / Referencia:</span>
                        <span className="info-val">{mov.motivo} ({mov.referencia || '-'})</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-container" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCancel} aria-label="Cerrar formulario">✕</button>
            <h2>Registrar Movimiento de Inventario</h2>
            <div style={{ height: '1.5rem' }}></div>

            <form onSubmit={handleSubmit}>
              <div className="form-group mb-3">
                <label className="form-label">Producto *</label>
                <select
                  className="form-control"
                  value={idProducto}
                  onChange={(e) => setIdProducto(e.target.value)}
                  required
                >
                  <option value="">Seleccione un producto</option>
                  {products.map((p) => (
                    <option key={p.id_producto} value={p.id_producto}>
                      [{p.codigo}] {p.nombre} (Stock: {parseFloat(p.stock_actual).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Tipo de movimiento *</label>
                    <select
                      className="form-control"
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value)}
                      required
                    >
                      <option value="INGRESO">INGRESO (Entrada de mercadería)</option>
                      <option value="EGRESO">EGRESO (Salida de mercadería)</option>
                    </select>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Cantidad *</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0.01"
                      className="form-control" 
                      value={cantidad} 
                      onChange={(e) => setCantidad(e.target.value)} 
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="row mb-3">
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Motivo *</label>
                    <select
                      className="form-control"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      required
                    >
                      <option value="AJUSTE">Ajuste de inventario</option>
                      <option value="COMPRA">Compra (Ingreso)</option>
                      <option value="VENTA">Venta (Egreso)</option>
                      <option value="INVENTARIO_INICIAL">Inventario Inicial</option>
                      <option value="DEVOLUCION">Devolución</option>
                    </select>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Referencia / Documento</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={referencia} 
                      onChange={(e) => setReferencia(e.target.value)} 
                      placeholder="ej: Factura Compra No. 123"
                    />
                  </div>
                </div>
              </div>

              <div className="form-actions-buttons">
                <button type="button" className="btn btn-danger" style={{ backgroundColor: '#f43f5e', color: '#ffffff' }} onClick={handleCancel}>
                  Cerrar
                </button>
                <button type="submit" className="btn btn-primary">
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
