import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api';
import { showToast } from '../../../lib/toast';
import ProductSearchInput from '../../../shared/ProductSearchInput';

export default function InventoryManager() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [reasonFilter, setReasonFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showForm && !saving) {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showForm, saving]);

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
      }
    } catch (error) {
      console.error(error);
    }
  };

  const selectedProduct = products.find((product) => product.id_producto.toString() === idProducto.toString()) || null;

  const resetForm = () => {
    setIdProducto('');
    setTipo('INGRESO');
    setCantidad('');
    setMotivo('AJUSTE');
    setReferencia('');
    setShowForm(false);
  };

  const handleCancel = () => {
    if (saving) return;
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!idProducto || !tipo || !cantidad || !motivo) {
      showToast('Por favor, complete todos los campos obligatorios.', 'error');
      return;
    }

    const cantNum = parseFloat(cantidad);
    if (isNaN(cantNum) || cantNum <= 0) {
      showToast('La cantidad debe ser un numero valido mayor a 0.', 'error');
      return;
    }

    if (!currentUser?.id_usuario) {
      showToast('No se pudo validar el usuario actual. Vuelve a iniciar sesion.', 'error');
      return;
    }

    const movementData = {
      id_producto: parseInt(idProducto, 10),
      tipo,
      cantidad: cantNum,
      motivo,
      referencia,
      id_usuario: currentUser.id_usuario
    };

    try {
      setSaving(true);
      const response = await apiFetch('/api/inventory/movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(movementData),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'No se pudo procesar el movimiento.');

      showToast('Movimiento de inventario registrado con exito.', 'success');
      resetForm();
      fetchMovements();
      fetchProducts();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredMovements = movements.filter((movement) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      movement.producto_nombre.toLowerCase().includes(query) ||
      movement.producto_codigo.toLowerCase().includes(query) ||
      (movement.referencia || '').toLowerCase().includes(query) ||
      movement.motivo.toLowerCase().includes(query);

    const matchesType = typeFilter === 'ALL' || movement.tipo === typeFilter;
    const matchesReason = reasonFilter === 'ALL' || movement.motivo === reasonFilter;

    return matchesSearch && matchesType && matchesReason;
  });

  const reasonOptions = [...new Set(movements.map((movement) => movement.motivo).filter(Boolean))];

  return (
    <div className="module-shell">
      <div className="view-header module-header-card">
        <div className="module-header-copy">
          <h1>Movimientos de Inventario</h1>
          <p>Kárdex y control de entradas y salidas de existencias del almacén.</p>
        </div>
        
        <div className="module-header-actions">
          <div className="client-stat-pill client-stat-pill-compact">
            <strong>{movements.length}</strong>
            <span>{movements.length === 1 ? 'movimiento' : 'movimientos'}</span>
          </div>
          <button className="btn btn-primary client-primary-btn" onClick={() => setShowForm(true)}>
            + Registrar Movimiento
          </button>
        </div>
      </div>

      <div className="client-data-panel">
        <div className="search-bar-container client-search-wrap">
          <div className="module-toolbar-row">
            <input
              type="text"
              className="form-control"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por producto, codigo, motivo o referencia..."
            />
            <select className="form-control" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="ALL">Todos los tipos</option>
              <option value="INGRESO">Ingresos</option>
              <option value="EGRESO">Egresos</option>
            </select>
            <select className="form-control" value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
              <option value="ALL">Todos los motivos</option>
              {reasonOptions.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando kárdex...</p>
        ) : filteredMovements.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', margin: 0 }}>
              No se han registrado movimientos de inventario aún.
            </p>
          </div>
        ) : (
          <div>
            <div className="table-responsive desktop-only">
              <table className="table table-hover align-middle client-table">
                <thead>
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
                  {filteredMovements.map((mov) => {
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
              {filteredMovements.map((mov) => {
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
          <div className="modal-container modal-container-clean compact-modal" style={{ maxWidth: '760px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCancel} aria-label="Cerrar formulario">✕</button>
            <h2>Registrar Movimiento de Inventario</h2>
            <p className="modal-support-copy">Aplica ingresos o egresos con referencia y consulta del stock disponible.</p>

            <form onSubmit={handleSubmit}>
              <div className="form-group mb-3">
                <label className="form-label">Producto *</label>
                <ProductSearchInput
                  products={products}
                  value={idProducto}
                  onChange={setIdProducto}
                  required
                  placeholder="Buscar producto por codigo, SKU o nombre"
                />
                {selectedProduct && (
                  <small className="text-muted d-block mt-2">
                    Stock actual: {parseFloat(selectedProduct.stock_actual || 0).toFixed(2)} | Stock minimo: {parseFloat(selectedProduct.stock_minimo || 0).toFixed(2)}
                  </small>
                )}
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
                <button type="button" className="btn btn-danger" style={{ backgroundColor: '#f43f5e', color: '#ffffff' }} onClick={handleCancel} disabled={saving}>
                  Cerrar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
