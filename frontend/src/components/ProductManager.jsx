import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiUrl } from '../lib/api';

export default function ProductManager() {
  // 1. ==========================================
  // ESTADOS DE LA APLICACIÓN (STATE)
  // ==========================================

  // Listados principales
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [taxes, setTaxes] = useState([]);

  // Estados de carga e interfaz
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Campos específicos del formulario de producto
  const [codigo, setCodigo] = useState('');
  const [sku, setSku] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [idCategoria, setIdCategoria] = useState('');
  const [precioCompra, setPrecioCompra] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [precioVentaConIva, setPrecioVentaConIva] = useState('');
  const [idImpuesto, setIdImpuesto] = useState('');
  const [stockActual, setStockActual] = useState('0.00');
  const [stockMinimo, setStockMinimo] = useState('0.00');
  const [activo, setActivo] = useState(true);

  // 2. ==========================================
  // EFECTOS Y CARGA DE DATOS (EFFECTS)
  // ==========================================

  useEffect(() => {
    fetchProducts();
    fetchMetadata();
  }, []);

  // Cargar productos del backend
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/products'));
      if (!response.ok) throw new Error('Error al conectar con la base de datos.');
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar categorías e impuestos para los dropdowns
  const fetchMetadata = async () => {
    try {
      const catRes = await fetch(apiUrl('/api/products/categories'));
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData);
        if (catData.length > 0) setIdCategoria(catData[0].id_categoria);
      }

      const taxRes = await fetch(apiUrl('/api/products/taxes'));
      if (taxRes.ok) {
        const taxData = await taxRes.json();
        setTaxes(taxData);
        if (taxData.length > 0) setIdImpuesto(taxData[0].id_impuesto);
      }
    } catch (error) {
      console.error('Error al cargar datos de configuración:', error);
    }
  };

  // 3. ==========================================
  // LÓGICA DE CÁLCULO DE PRECIOS E IMPUESTOS
  // ==========================================

  // Obtener porcentaje del impuesto seleccionado
  const getTaxPercent = (taxId = idImpuesto) => {
    const selectedTax = taxes.find(t => t.id_impuesto.toString() === taxId.toString());
    return selectedTax ? parseFloat(selectedTax.porcentaje) : 0;
  };

  // Cuando cambia el precio base (Sin IVA)
  const handlePrecioVentaChange = (val) => {
    setPrecioVenta(val);
    const valNum = parseFloat(val);
    if (!isNaN(valNum) && valNum >= 0) {
      const taxPercent = getTaxPercent();
      setPrecioVentaConIva((valNum * (1 + taxPercent / 100)).toFixed(4));
    } else {
      setPrecioVentaConIva('');
    }
  };

  // Cuando cambia el precio final (Con IVA)
  const handlePrecioVentaConIvaChange = (val) => {
    setPrecioVentaConIva(val);
    const valNum = parseFloat(val);
    if (!isNaN(valNum) && valNum >= 0) {
      const taxPercent = getTaxPercent();
      setPrecioVenta((valNum / (1 + taxPercent / 100)).toFixed(4));
    } else {
      setPrecioVenta('');
    }
  };

  // Cuando cambia la selección del impuesto
  const handleImpuestoChange = (newTaxId) => {
    setIdImpuesto(newTaxId);
    const basePriceNum = parseFloat(precioVenta);
    if (!isNaN(basePriceNum) && basePriceNum >= 0) {
      const taxPercent = getTaxPercent(newTaxId);
      setPrecioVentaConIva((basePriceNum * (1 + taxPercent / 100)).toFixed(4));
    }
  };

  // Calcular el margen de utilidad
  const calculateMargin = () => {
    const sell = parseFloat(precioVenta) || 0;
    const buy = parseFloat(precioCompra) || 0;
    if (sell <= 0) return 0;
    return ((sell - buy) / sell) * 100;
  };

  // 4. ==========================================
  // MANEJADORES DE ACCIONES (HANDLERS)
  // ==========================================

  // Toast de SweetAlert2 con tema CoreUI Light
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

  // Prepara el formulario para editar un producto
  const handleEdit = (product) => {
    setEditingProduct(product);
    setCodigo(product.codigo || '');
    setSku(product.sku || '');
    setNombre(product.nombre);
    setDescripcion(product.descripcion || '');
    setIdCategoria(product.id_categoria || '');
    setPrecioCompra(product.precio_compra);
    setPrecioVenta(product.precio_venta);
    setIdImpuesto(product.id_impuesto || '');

    // Calcular el precio inicial con IVA basado en la tarifa cargada
    const basePriceNum = parseFloat(product.precio_venta) || 0;
    const taxPercent = product.impuesto_porcentaje ? parseFloat(product.impuesto_porcentaje) : 0;
    setPrecioVentaConIva((basePriceNum * (1 + taxPercent / 100)).toFixed(4));

    setStockActual(product.stock_actual);
    setStockMinimo(product.stock_minimo);
    setActivo(product.activo);
    setShowForm(true);
  };

  // Cancela/resetea el formulario
  const handleCancel = () => {
    setEditingProduct(null);
    setCodigo('');
    setSku('');
    setNombre('');
    setDescripcion('');
    if (categories.length > 0) setIdCategoria(categories[0].id_categoria);
    setPrecioCompra('');
    setPrecioVenta('');
    setPrecioVentaConIva('');
    if (taxes.length > 0) setIdImpuesto(taxes[0].id_impuesto);
    setStockActual('0.00');
    setStockMinimo('0.00');
    setActivo(true);
    setShowForm(false);
  };

  // Eliminar un producto
  const handleDelete = async (id, prodName) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar el producto "${prodName}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      color: '#212529',
      confirmButtonColor: '#e55353',
      cancelButtonColor: '#8a93a2',
      iconColor: '#f9b115',
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(apiUrl(`/api/products/${id}`), {
          method: 'DELETE',
        });
        const resultData = await response.json();
        
        if (!response.ok) throw new Error(resultData.error || 'No se pudo eliminar el producto.');

        showAlert('Producto eliminado exitosamente.', 'success');
        fetchProducts();
      } catch (err) {
        showAlert(err.message, 'error');
      }
    }
  };

  // Validador local básico en el frontend
  const validateForm = () => {
    if (!nombre.trim()) return 'El nombre del producto es obligatorio.';
    if (!precioCompra || isNaN(parseFloat(precioCompra)) || parseFloat(precioCompra) < 0) {
      return 'El precio de compra debe ser un número mayor o igual a 0.';
    }
    if (!precioVenta || isNaN(parseFloat(precioVenta)) || parseFloat(precioVenta) < 0) {
      return 'El precio de venta debe ser un número mayor o igual a 0.';
    }
    if (isNaN(parseFloat(stockActual)) || parseFloat(stockActual) < 0) {
      return 'El stock actual debe ser un número mayor o igual a 0.';
    }
    if (isNaN(parseFloat(stockMinimo)) || parseFloat(stockMinimo) < 0) {
      return 'El stock mínimo debe ser un número mayor o igual a 0.';
    }
    return null;
  };

  // Envía el formulario para guardar/actualizar
  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      showAlert(validationError, 'error');
      return;
    }

    const productData = {
      codigo: codigo || null,
      sku: sku || null,
      nombre,
      descripcion,
      id_categoria: idCategoria ? parseInt(idCategoria, 10) : null,
      precio_compra: parseFloat(precioCompra),
      precio_venta: parseFloat(precioVenta),
      id_impuesto: idImpuesto ? parseInt(idImpuesto, 10) : null,
      stock_actual: parseFloat(stockActual),
      stock_minimo: parseFloat(stockMinimo),
      activo
    };

    const url = editingProduct 
      ? apiUrl(`/api/products/${editingProduct.id_producto}`) 
      : apiUrl('/api/products');
      
    const method = editingProduct ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Ocurrió un error inesperado.');

      showAlert(editingProduct ? 'Producto actualizado correctamente.' : 'Producto registrado exitosamente.', 'success');
      handleCancel();
      fetchProducts();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  // Filtrado de productos por búsqueda y stock bajo
  const filteredProducts = products.filter(prod => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      prod.nombre.toLowerCase().includes(query) ||
      (prod.codigo && prod.codigo.includes(query)) ||
      (prod.sku && prod.sku.toLowerCase().includes(query)) ||
      (prod.categoria_nombre && prod.categoria_nombre.toLowerCase().includes(query));

    if (filterLowStock) {
      const isLowStock = parseFloat(prod.stock_actual) <= parseFloat(prod.stock_minimo);
      return matchesSearch && isLowStock;
    }
    return matchesSearch;
  });

  return (
    <div>
      <div className="view-header">
        <div>
          <h1>Catálogo de Productos</h1>
          <p>Módulo para registrar y mantener el control de inventario y tarifas.</p>
        </div>
        
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nuevo Producto
        </button>
      </div>

      {/* SECCIÓN DE BÚSQUEDA Y FILTRADO RESPONSIVO */}
      <div>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div style={{ flex: '1 1 320px' }}>
            <input 
              type="text" 
              className="form-control" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, código, SKU o categoría..."
            />
          </div>
          
          <div className="d-flex align-items-center gap-2">
            <input 
              type="checkbox" 
              id="low-stock-check"
              checked={filterLowStock}
              onChange={(e) => setFilterLowStock(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="low-stock-check" style={{ cursor: 'pointer', fontWeight: '600', userSelect: 'none' }}>
              ⚠️ Filtrar por Stock Bajo
            </label>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando productos...</p>
        ) : filteredProducts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', margin: 0 }}>
              No se encontraron productos registrados.
            </p>
          </div>
        ) : (
          <div>
            {/* TABLA DE PRODUCTOS (SOLO DESKTOP) */}
            <div className="table-responsive desktop-only">
              <table className="table table-striped table-hover align-middle border">
                <thead className="table-light">
                  <tr>
                    <th>Código</th>
                    <th>Nombre / Descripción</th>
                    <th>SKU</th>
                    <th>Categoría</th>
                    <th>Precio Compra</th>
                    <th>Precio Venta (Base / Con IVA)</th>
                    <th>IVA</th>
                    <th>Stock Actual</th>
                    <th>Estado</th>
                    <th style={{ width: '160px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((prod) => {
                    const isLowStock = parseFloat(prod.stock_actual) <= parseFloat(prod.stock_minimo);
                    const basePriceVal = parseFloat(prod.precio_venta) || 0;
                    const taxPercentVal = parseFloat(prod.impuesto_porcentaje) || 0;
                    const finalPriceVal = basePriceVal * (1 + (taxPercentVal / 100));

                    return (
                      <tr key={prod.id_producto}>
                        <td style={{ fontWeight: '600' }}>{prod.codigo}</td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{prod.nombre}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {prod.descripcion || 'Sin descripción'}
                          </div>
                        </td>
                        <td>{prod.sku || '-'}</td>
                        <td>
                          <span className="badge badge-ruc" style={{ backgroundColor: '#ebedef', color: '#4f5d73' }}>
                            {prod.categoria_nombre || 'Sin categoría'}
                          </span>
                        </td>
                        <td>${parseFloat(prod.precio_compra).toFixed(2)}</td>
                        <td>
                          <div>Base: ${basePriceVal.toFixed(2)}</div>
                          <div style={{ fontWeight: '600', color: '#2eb85c' }}>
                            P. Final: ${finalPriceVal.toFixed(2)}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-pasaporte" style={{ backgroundColor: '#ebedef', color: '#4f5d73' }}>
                            {prod.impuesto_nombre || 'EXENTO'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: '600', color: isLowStock ? '#e55353' : 'inherit' }}>
                            {parseFloat(prod.stock_actual).toFixed(2)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            Min: {parseFloat(prod.stock_minimo).toFixed(2)}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${prod.activo ? 'badge-cedula' : 'badge-consumidor'}`} style={{ backgroundColor: prod.activo ? '#d2f4ea' : '#f8d7da', color: prod.activo ? '#14a44d' : '#dc3545' }}>
                            {prod.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleEdit(prod)}
                            >
                              Editar
                            </button>
                            <button 
                              className="btn btn-danger" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleDelete(prod.id_producto, prod.nombre)}
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* TARJETAS DE PRODUCTOS (SOLO MOBILE) */}
            <div className="client-cards-container mobile-only">
              {filteredProducts.map((prod) => {
                const isLowStock = parseFloat(prod.stock_actual) <= parseFloat(prod.stock_minimo);
                const basePriceVal = parseFloat(prod.precio_venta) || 0;
                const taxPercentVal = parseFloat(prod.impuesto_porcentaje) || 0;
                const finalPriceVal = basePriceVal * (1 + (taxPercentVal / 100));

                return (
                  <div key={prod.id_producto} className="client-mobile-card">
                    <div className="client-card-header">
                      <span className="client-name">{prod.nombre}</span>
                      <span className={`badge ${prod.activo ? 'badge-cedula' : 'badge-consumidor'}`} style={{ backgroundColor: prod.activo ? '#d2f4ea' : '#f8d7da', color: prod.activo ? '#14a44d' : '#dc3545' }}>
                        {prod.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <div className="client-card-body">
                      <div className="client-card-info-item">
                        <span className="info-label">Código:</span>
                        <span className="info-val" style={{ fontWeight: '600' }}>{prod.codigo}</span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Categoría:</span>
                        <span className="info-val">{prod.categoria_nombre || 'Sin categoría'}</span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Compra / Venta con IVA:</span>
                        <span className="info-val">${parseFloat(prod.precio_compra).toFixed(2)} / <strong>${finalPriceVal.toFixed(2)}</strong></span>
                      </div>
                      <div className="client-card-info-item">
                        <span className="info-label">Stock Actual:</span>
                        <span className="info-val" style={{ fontWeight: '600', color: isLowStock ? '#e55353' : 'inherit' }}>
                          {parseFloat(prod.stock_actual).toFixed(2)} (Min: {parseFloat(prod.stock_minimo).toFixed(2)})
                        </span>
                      </div>
                    </div>
                    <div className="client-card-actions">
                      <button className="btn btn-secondary" onClick={() => handleEdit(prod)}>Editar</button>
                      <button className="btn btn-danger" onClick={() => handleDelete(prod.id_producto, prod.nombre)}>Eliminar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FORMULARIO DE REGISTRO / EDICIÓN EN MODAL */}
      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal-container" style={{ maxWidth: '850px' }} onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCancel} aria-label="Cerrar formulario">✕</button>
            <h2>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
            <div style={{ height: '1.5rem' }}></div>

            <form onSubmit={handleSubmit}>
              {/* FILA 1: Código, SKU, Nombre */}
              <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="form-group mb-3">
                  <label className="form-label">Código del producto</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={codigo} 
                    onChange={(e) => setCodigo(e.target.value)} 
                    placeholder="Autogenerado (ej: 000001)"
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">SKU</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={sku} 
                    onChange={(e) => setSku(e.target.value)} 
                    placeholder="Ingrese SKU único"
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Nombre del producto *</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={nombre} 
                    onChange={(e) => setNombre(e.target.value)} 
                    placeholder="Ingrese nombre"
                    required
                  />
                </div>
              </div>

              {/* FILA 2: Categoría, Impuesto, Precio Compra */}
              <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="form-group mb-3">
                  <label className="form-label">Categoría</label>
                  <select 
                    className="form-control" 
                    value={idCategoria} 
                    onChange={(e) => setIdCategoria(e.target.value)}
                  >
                    <option value="">Seleccione una categoría</option>
                    {categories.map((cat) => (
                      <option key={cat.id_categoria} value={cat.id_categoria}>
                        {cat.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Impuesto (SRI) *</label>
                  <select 
                    className="form-control" 
                    value={idImpuesto} 
                    onChange={(e) => handleImpuestoChange(e.target.value)}
                  >
                    {taxes.map((tax) => (
                      <option key={tax.id_impuesto} value={tax.id_impuesto}>
                        {tax.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Precio de compra ($) *</label>
                  <input 
                    type="number" 
                    step="0.0001"
                    min="0"
                    className="form-control" 
                    value={precioCompra} 
                    onChange={(e) => setPrecioCompra(e.target.value)} 
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* FILA 3: Precio Venta (Sin IVA), Precio Venta (Con IVA), Utilidad/Margen */}
              <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="form-group mb-3">
                  <label className="form-label">Precio de venta (Sin IVA) ($) *</label>
                  <input 
                    type="number" 
                    step="0.0001"
                    min="0"
                    className="form-control" 
                    value={precioVenta} 
                    onChange={(e) => handlePrecioVentaChange(e.target.value)} 
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Precio de venta (Con IVA) ($) *</label>
                  <input 
                    type="number" 
                    step="0.0001"
                    min="0"
                    className="form-control" 
                    value={precioVentaConIva} 
                    onChange={(e) => handlePrecioVentaConIvaChange(e.target.value)} 
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="form-group mb-3" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label className="form-label">Margen de Ganancia</label>
                  <div className="form-control d-flex align-items-center" style={{ backgroundColor: '#ebedef', fontWeight: 'bold', height: '38px' }}>
                    <span style={{ color: calculateMargin() < 0 ? '#e55353' : '#2eb85c' }}>
                      {calculateMargin().toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* FILA 4: Stock Actual, Stock Mínimo, Estado Activo */}
              <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <div className="form-group mb-3">
                  <label className="form-label">Stock actual</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    className="form-control" 
                    value={stockActual} 
                    onChange={(e) => setStockActual(e.target.value)} 
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group mb-3">
                  <label className="form-label">Stock mínimo</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    className="form-control" 
                    value={stockMinimo} 
                    onChange={(e) => setStockMinimo(e.target.value)} 
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group mb-3" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label className="form-label">Estado:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                    <input 
                      type="checkbox" 
                      id="activo-check"
                      checked={activo} 
                      onChange={(e) => setActivo(e.target.checked)}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                    <label htmlFor="activo-check" style={{ cursor: 'pointer', fontWeight: '500' }}>
                      Producto Activo
                    </label>
                  </div>
                </div>
              </div>

              {/* FILA 5: Descripción */}
              <div className="form-group mb-3">
                <label className="form-label">Descripción</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={descripcion} 
                  onChange={(e) => setDescripcion(e.target.value)} 
                  placeholder="Ingrese descripción opcional"
                />
              </div>

              <div className="form-actions-buttons">
                <button type="button" className="btn btn-danger" style={{ backgroundColor: '#f43f5e', color: '#ffffff' }} onClick={handleCancel}>
                  Cerrar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
