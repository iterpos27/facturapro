import React, { useState, useEffect } from 'react';
import { apiFetch, apiUrl } from '../../../../lib/api';
import { showToast } from '../../../../lib/toast';

export default function ProductFormModal({
  isOpen,
  onClose,
  editingProduct,
  categories,
  taxes,
  onSaveSuccess,
}) {
  const [saving, setSaving] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [sku, setSku] = useState('');
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [idCategoria, setIdCategoria] = useState('');
  const [idImpuesto, setIdImpuesto] = useState('');
  const [precioCompra, setPrecioCompra] = useState('');
  const [precioVenta, setPrecioVenta] = useState('');
  const [stockActual, setStockActual] = useState('0.00');
  const [stockMinimo, setStockMinimo] = useState('0.00');
  const [activo, setActivo] = useState(true);
  const [marca, setMarca] = useState('');
  const [referencia, setReferencia] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (editingProduct) {
      setCodigo(editingProduct.codigo || '');
      setSku(editingProduct.sku || '');
      setNombre(editingProduct.nombre || '');
      setDescripcion(editingProduct.descripcion || '');
      setIdCategoria(editingProduct.id_categoria || '');
      setIdImpuesto(editingProduct.id_impuesto || '');
      setPrecioCompra(editingProduct.precio_compra || '');
      setPrecioVenta(editingProduct.precio_venta || '');
      setStockActual(editingProduct.stock_actual || '0.00');
      setStockMinimo(editingProduct.stock_minimo || '0.00');
      setActivo(editingProduct.activo !== undefined ? editingProduct.activo : true);
      setMarca(editingProduct.marca || '');
      setReferencia(editingProduct.referencia || '');
      return;
    }

    const fetchNextCode = async () => {
      try {
        const res = await apiFetch('/api/products/next-code');
        if (res.ok) {
          const data = await res.json();
          setCodigo(data.nextCode);
        }
      } catch (err) {
        console.error('Error fetching next code:', err);
      }
    };

    fetchNextCode();
    setSku('');
    setNombre('');
    setDescripcion('');
    setIdCategoria(categories.length > 0 ? categories[0].id_categoria : '');
    setIdImpuesto(taxes.length > 0 ? taxes[0].id_impuesto : '');
    setPrecioCompra('');
    setPrecioVenta('');
    setStockActual('0.00');
    setStockMinimo('0.00');
    setActivo(true);
    setMarca('');
    setReferencia('');
  }, [editingProduct, isOpen, categories, taxes]);

  useEffect(() => {
    if (isOpen && !editingProduct) {
      if (!idCategoria && categories.length > 0) {
        setIdCategoria(categories[0].id_categoria);
      }
      if (!idImpuesto && taxes.length > 0) {
        setIdImpuesto(taxes[0].id_impuesto);
      }
    }
  }, [categories, taxes, isOpen, editingProduct, idCategoria, idImpuesto]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !saving) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, saving, onClose]);

  if (!isOpen) return null;

  const getTaxPercent = () => {
    const selectedTax = taxes.find((t) => t.id_impuesto.toString() === idImpuesto.toString());
    return selectedTax ? parseFloat(selectedTax.porcentaje) : 0;
  };


  const validateForm = () => {
    if (!nombre.trim()) return 'El nombre del producto es obligatorio.';
    if (!sku.trim()) return 'El codigo general (SKU) es obligatorio.';
    if (!precioCompra || isNaN(parseFloat(precioCompra)) || parseFloat(precioCompra) < 0) {
      return 'El precio de compra debe ser un numero mayor o igual a 0.';
    }
    if (!precioVenta || isNaN(parseFloat(precioVenta)) || parseFloat(precioVenta) < 0) {
      return 'El precio de venta debe ser un numero mayor o igual a 0.';
    }
    if (isNaN(parseFloat(stockActual)) || parseFloat(stockActual) < 0) {
      return 'El stock actual debe ser un numero mayor o igual a 0.';
    }
    if (isNaN(parseFloat(stockMinimo)) || parseFloat(stockMinimo) < 0) {
      return 'El stock minimo debe ser un numero mayor o igual a 0.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    const productData = {
      codigo: editingProduct ? codigo : null,
      sku: sku.trim(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim(),
      id_categoria: idCategoria ? parseInt(idCategoria, 10) : null,
      precio_compra: parseFloat(precioCompra),
      precio_venta: parseFloat(precioVenta),
      id_impuesto: idImpuesto ? parseInt(idImpuesto, 10) : null,
      stock_actual: parseFloat(stockActual),
      stock_minimo: parseFloat(stockMinimo),
      activo,
      marca: marca.trim(),
      referencia: referencia.trim(),
    };

    const url = editingProduct
      ? apiUrl(`/api/products/${editingProduct.id_producto}`)
      : apiUrl('/api/products');
    const method = editingProduct ? 'PUT' : 'POST';

    try {
      setSaving(true);
      const response = await apiFetch(url.replace(/^https?:\/\/[^/]+/, ''), {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Ocurrio un error inesperado.');

      showToast(
        editingProduct
          ? 'Producto actualizado correctamente.'
          : 'Producto registrado exitosamente.',
        'success'
      );
      onSaveSuccess();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => !saving && onClose()}>
      <div
        className="modal-container modal-container-clean compact-modal"
        style={{ maxWidth: '920px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close-btn"
          onClick={() => !saving && onClose()}
          aria-label="Cerrar formulario"
          disabled={saving}
        >
          x
        </button>
        <h2>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
        <p className="modal-support-copy">
          Administra datos comerciales sin perder de vista stock, precio e impuesto.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem' }}>
            <div className="form-group mb-3" style={{ gridColumn: 'span 3' }}>
              <label className="form-label">Codigo</label>
              <input type="text" className="form-control" value={codigo} placeholder="Cargando..." disabled />
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 3' }}>
              <label className="form-label">Codigo Producto *</label>
              <input
                type="text"
                className="form-control"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase().trimStart())}
                placeholder="Codigo de barra o SKU"
                required
                disabled={saving}
              />
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 6' }}>
              <label className="form-label">Nombre del producto *</label>
              <input
                type="text"
                className="form-control"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ingrese nombre del equipo o producto"
                required
                disabled={saving}
              />
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 4' }}>
              <label className="form-label">Marca</label>
              <input
                type="text"
                className="form-control"
                value={marca}
                onChange={(e) => setMarca(e.target.value)}
                placeholder="ej: Asus, Logitech"
                disabled={saving}
              />
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 4' }}>
              <label className="form-label">Referencia / Modelo</label>
              <input
                type="text"
                className="form-control"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="ej: ROG Zephyrus G16"
                disabled={saving}
              />
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 4' }}>
              <label className="form-label">Categoria *</label>
              <select
                className="form-control"
                value={idCategoria}
                onChange={(e) => setIdCategoria(e.target.value)}
                disabled={saving}
                required
              >
                <option value="">Seleccione una categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id_categoria} value={cat.id_categoria}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 3' }}>
              <label className="form-label">Impuesto (SRI) *</label>
              <select
                className="form-control"
                value={idImpuesto}
                onChange={(e) => setIdImpuesto(e.target.value)}
                disabled={saving}
                required
              >
                {taxes.map((tax) => (
                  <option key={tax.id_impuesto} value={tax.id_impuesto}>
                    {tax.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 3' }}>
              <label className="form-label">Precio de compra *</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                className="form-control"
                value={precioCompra}
                onChange={(e) => handlePrecioCompraChange(e.target.value)}
                placeholder="0.00"
                required
                disabled={saving}
              />
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 3' }}>
              <label className="form-label">% de utilidad</label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={utilidad}
                onChange={(e) => handleUtilidadChange(e.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 3' }}>
              <label className="form-label">Precio de venta *</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                className="form-control"
                value={precioVenta}
                onChange={(e) => handlePrecioVentaChange(e.target.value)}
                placeholder="0.00"
                required
                disabled={saving}
              />
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 3' }}>
              <label className="form-label">Precio final con IVA</label>
              <input
                type="number"
                step="0.0001"
                min="0"
                className="form-control"
                value={precioVenta ? (parseFloat(precioVenta) * (1 + getTaxPercent() / 100)).toFixed(2) : ''}
                onChange={(e) => handlePrecioFinalChange(e.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 4' }}>
              <label className="form-label">Stock actual</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={stockActual}
                onChange={(e) => setStockActual(e.target.value)}
                placeholder="0.00"
                disabled={Boolean(editingProduct) || saving}
              />
              {editingProduct && (
                <small className="text-muted" style={{ fontSize: '0.7rem', display: 'block', marginTop: '0.2rem' }}>
                  El stock se ajusta desde Inventario.
                </small>
              )}
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 4' }}>
              <label className="form-label">Stock minimo</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
                placeholder="0.00"
                disabled={saving}
              />
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label className="form-label">Estado:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '38px' }}>
                <input
                  type="checkbox"
                  id="activo-check"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  disabled={saving}
                />
                <label htmlFor="activo-check" style={{ cursor: 'pointer', fontWeight: '500', marginBottom: 0 }}>
                  Producto Activo
                </label>
              </div>
            </div>

            <div className="form-group mb-3" style={{ gridColumn: 'span 12' }}>
              <label className="form-label">Descripcion</label>
              <input
                type="text"
                className="form-control"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ingrese descripcion detallada o especificaciones del equipo"
                disabled={saving}
              />
            </div>
          </div>

          <div className="form-actions-buttons">
            <button
              type="button"
              className="btn btn-danger"
              style={{ backgroundColor: '#f43f5e', color: '#ffffff' }}
              onClick={onClose}
              disabled={saving}
            >
              Cerrar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
