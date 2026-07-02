import React from 'react';
import CIcon from '@coreui/icons-react';
import { cilPencil, cilTrash } from '@coreui/icons';

export default function ProductTable({ products, onEdit, onDelete }) {
  const getFinalPrice = (prod) => {
    const taxPercentVal = parseFloat(prod.impuesto_porcentaje) || 0;
    return (parseFloat(prod.precio_venta) || 0) * (1 + taxPercentVal / 100);
  };

  return (
    <div>
      <div className="table-responsive desktop-only">
        <table className="table table-hover align-middle client-table">
          <thead>
            <tr>
              <th>Codigos</th>
              <th>Nombre</th>
              <th>Stock</th>
              <th>Marca</th>
              <th>Precio venta</th>
              <th>Referencia</th>
              <th>Categoria</th>
              <th style={{ width: '120px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products.map((prod) => {
              const isLowStock =
                parseFloat(prod.stock_actual) <= parseFloat(prod.stock_minimo);
              const finalPrice = getFinalPrice(prod);

              return (
                <tr key={prod.id_producto}>
                  <td style={{ fontSize: '0.85rem' }}>
                    <div style={{ whiteSpace: 'nowrap' }}>
                      <strong>C. Producto:</strong> {prod.codigo || '-'}
                    </div>
                    <div style={{ whiteSpace: 'nowrap' }}>
                      <strong>C. Barra:</strong> {prod.sku || '-'}
                    </div>
                  </td>

                  <td style={{ fontWeight: '600' }}>{prod.nombre}</td>

                  <td>
                    <div
                      style={{
                        fontWeight: '600',
                        color: isLowStock ? '#e55353' : 'inherit',
                      }}
                    >
                      {parseFloat(prod.stock_actual).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Min: {parseFloat(prod.stock_minimo).toFixed(2)}
                    </div>
                    {isLowStock && (
                      <span className="module-inline-alert">Reposicion</span>
                    )}
                  </td>

                  <td>{prod.marca || '-'}</td>

                  <td>
                    <div style={{ fontWeight: '600', color: '#2eb85c' }}>
                      ${finalPrice.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Base: ${parseFloat(prod.precio_venta || 0).toFixed(2)}
                    </div>
                  </td>

                  <td>{prod.referencia || '-'}</td>

                  <td>
                    <span
                      className="badge badge-ruc"
                      style={{ backgroundColor: '#ebedef', color: '#4f5d73' }}
                    >
                      {prod.categoria_nombre || 'Sin categoria'}
                    </span>
                  </td>

                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
                        onClick={() => onEdit(prod)}
                        title="Editar"
                      >
                        <CIcon icon={cilPencil} size="sm" />
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
                        onClick={() => onDelete(prod.id_producto, prod.nombre)}
                        title="Eliminar"
                      >
                        <CIcon icon={cilTrash} size="sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="client-cards-container mobile-only">
        {products.map((prod) => {
          const isLowStock =
            parseFloat(prod.stock_actual) <= parseFloat(prod.stock_minimo);
          const finalPrice = getFinalPrice(prod);

          return (
            <div key={prod.id_producto} className="client-mobile-card">
              <div className="client-card-header">
                <span className="client-name">{prod.nombre}</span>
                <span className={`module-badge ${prod.activo ? 'module-badge-active' : 'module-badge-inactive'}`}>
                  {prod.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <div className="client-card-body">
                <div className="client-card-info-item">
                  <span className="info-label">Codigo Gral (SKU):</span>
                  <span className="info-val" style={{ fontWeight: '600' }}>
                    {prod.sku || '-'}
                  </span>
                </div>
                <div className="client-card-info-item">
                  <span className="info-label">Marca / Referencia:</span>
                  <span className="info-val">
                    {prod.marca || '-'} / {prod.referencia || '-'}
                  </span>
                </div>
                <div className="client-card-info-item">
                  <span className="info-label">Precio venta con IVA:</span>
                  <span className="info-val" style={{ fontWeight: '600', color: '#2eb85c' }}>
                    ${finalPrice.toFixed(2)}
                  </span>
                </div>
                <div className="client-card-info-item">
                  <span className="info-label">Stock Actual:</span>
                  <span
                    className="info-val"
                    style={{
                      fontWeight: '600',
                      color: isLowStock ? '#e55353' : 'inherit',
                    }}
                  >
                    {parseFloat(prod.stock_actual).toFixed(2)} (Min:{' '}
                    {parseFloat(prod.stock_minimo).toFixed(2)})
                  </span>
                </div>
              </div>
              <div className="client-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => onEdit(prod)}
                  title="Editar"
                  style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
                >
                  <CIcon icon={cilPencil} size="sm" />
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => onDelete(prod.id_producto, prod.nombre)}
                  title="Eliminar"
                  style={{ padding: '0.35rem 0.5rem', display: 'inline-flex', alignItems: 'center' }}
                >
                  <CIcon icon={cilTrash} size="sm" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
