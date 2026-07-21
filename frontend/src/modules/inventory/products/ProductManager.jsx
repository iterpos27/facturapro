import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';
import { showToast } from '../../../lib/toast';
import ProductToolbar from './components/ProductToolbar';
import ProductTable from './components/ProductTable';
import ProductFormModal from './components/ProductFormModal';

export default function ProductManager() {
  // Listados principales
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [taxes, setTaxes] = useState([]);

  // Estados de carga e interfaz
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Paginación server-side
  const [page] = useState(1);

  useEffect(() => {
    fetchProducts(1, '');
    fetchMetadata();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar productos del backend con paginación y búsqueda
  const fetchProducts = async (currentPage = 1, search = '', activo = statusFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '50',
        ...(search ? { search } : {}),
        ...(activo !== 'ALL' ? { activo: String(activo === 'ACTIVE') } : {}),
      });
      const response = await apiFetch(`/api/products?${params}`);
      if (!response.ok) throw new Error('Error al conectar con la base de datos.');
      const data = await response.json();
      if (data && Array.isArray(data.data)) {
        setProducts(data.data);
      } else {
        setProducts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar categorías e impuestos para los dropdowns
  const fetchMetadata = async () => {
    try {
      const catRes = await apiFetch('/api/products/categories');
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData);
      }

      const taxRes = await apiFetch('/api/products/taxes');
      if (taxRes.ok) {
        const taxData = await taxRes.json();
        setTaxes(taxData);
      }
    } catch (error) {
      console.error('Error al cargar datos de configuración:', error);
    }
  };

  // Prepara el formulario para editar un producto
  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setEditingProduct(null);
    setShowForm(false);
  };

  const handleSaveSuccess = () => {
    handleCloseForm();
    fetchProducts(page, searchQuery);
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
        cancelButton: 'btn btn-secondary',
      },
    });

    if (result.isConfirmed) {
      try {
        const response = await apiFetch(`/api/products/${id}`, {
          method: 'DELETE',
        });
        const resultData = await response.json();

        if (!response.ok)
          throw new Error(resultData.error || 'No se pudo eliminar el producto.');

        showToast('Producto eliminado exitosamente.', 'success');
        fetchProducts();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  // Filtrado de productos por búsqueda y stock bajo
  const filteredProducts = products.filter((prod) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      prod.nombre.toLowerCase().includes(query) ||
      (prod.codigo && prod.codigo.includes(query)) ||
      (prod.sku && prod.sku.toLowerCase().includes(query)) ||
      (prod.categoria_nombre && prod.categoria_nombre.toLowerCase().includes(query));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && prod.activo) ||
      (statusFilter === 'INACTIVE' && !prod.activo);

    const matchesCategory =
      categoryFilter === 'ALL' || String(prod.id_categoria || '') === categoryFilter;

    if (filterLowStock) {
      const isLowStock = parseFloat(prod.stock_actual) <= parseFloat(prod.stock_minimo);
      return matchesSearch && matchesStatus && matchesCategory && isLowStock;
    }
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const lowStockCount = products.filter(
    (prod) => parseFloat(prod.stock_actual) <= parseFloat(prod.stock_minimo)
  ).length;

  return (
    <div className="module-shell">
      {/* 1. Cabecera externa al panel de datos (Diseño AsistePro) */}
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>Productos</h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>Administra el inventario de equipos y tarifas.</p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {filteredProducts.length} {filteredProducts.length === 1 ? 'registro' : 'registros'}
          </span>
          {lowStockCount > 0 && (
            <span className="count-badge-pill" style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}>
              {lowStockCount} stock bajo
            </span>
          )}
          <button className="btn btn-secondary" onClick={handleAddNew}>
            + Nuevo producto
          </button>
        </div>
      </div>

      {/* 2. Contenedor del panel principal que unifica la búsqueda, filtros y la tabla */}
      <div className="client-data-panel">
        <ProductToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          categories={categories}
          filterLowStock={filterLowStock}
          setFilterLowStock={setFilterLowStock}
        />

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
            Cargando productos...
          </p>
        ) : filteredProducts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', padding: '2rem 0', margin: 0 }}>
              No se encontraron productos registrados.
            </p>
          </div>
        ) : (
          <ProductTable
            products={filteredProducts}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </div>

      <ProductFormModal
        isOpen={showForm}
        onClose={handleCloseForm}
        editingProduct={editingProduct}
        categories={categories}
        taxes={taxes}
        onSaveSuccess={handleSaveSuccess}
      />
    </div>
  );
}
