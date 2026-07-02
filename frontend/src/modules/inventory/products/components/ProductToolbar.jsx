import React from 'react';

export default function ProductToolbar({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  categories,
  filterLowStock,
  setFilterLowStock,
}) {
  return (
    <div className="search-bar-container client-search-wrap">
      <div className="module-toolbar-row">
        <input
          type="text"
          className="form-control"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, código, SKU o categoría..."
        />
        <select
          className="form-control"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">Todos los estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="INACTIVE">Inactivos</option>
        </select>
        <select
          className="form-control"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="ALL">Todas las categorias</option>
          {categories.map((category) => (
            <option key={category.id_categoria} value={category.id_categoria}>
              {category.nombre}
            </option>
          ))}
        </select>
      </div>

      <label htmlFor="low-stock-check" className="module-filter-chip">
        <input
          type="checkbox"
          id="low-stock-check"
          checked={filterLowStock}
          onChange={(e) => setFilterLowStock(e.target.checked)}
        />
        <span>⚠️ Filtrar por Stock Bajo</span>
      </label>
    </div>
  );
}
