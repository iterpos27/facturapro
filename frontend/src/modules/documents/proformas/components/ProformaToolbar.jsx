import React from 'react';

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function ProformaToolbar({
  listQuery,
  setListQuery,
  statusFilter,
  setStatusFilter,
  dateFromFilter,
  setDateFromFilter,
  dateToFilter,
  setDateToFilter,
  onClear,
}) {
  return (
    <div className="search-bar-container mt-1">
      {/* Campo de búsqueda con ícono embebido */}
      <div className="search-input-wrap">
        <span className="search-icon">
          <SearchIcon />
        </span>
        <input
          type="text"
          className="form-control"
          value={listQuery}
          onChange={(event) => setListQuery(event.target.value)}
          placeholder="Buscar por No. de proforma o cliente..."
        />
      </div>

      {/* Filtro Estado */}
      <select
        className="form-select"
        style={{ flex: '0 0 155px' }}
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
      >
        <option value="ALL">Todos los estados</option>
        <option value="BORRADOR">Borrador</option>
        <option value="APROBADA">Aprobada</option>
        <option value="FACTURADA">Facturada</option>
        <option value="ANULADA">Anulada</option>
      </select>

      {/* Fecha Desde */}
      <input
        type="date"
        className="form-control"
        style={{ flex: '0 0 145px' }}
        value={dateFromFilter}
        onChange={(event) => setDateFromFilter(event.target.value)}
        title="Fecha Desde"
      />

      {/* Fecha Hasta */}
      <input
        type="date"
        className="form-control"
        style={{ flex: '0 0 145px' }}
        value={dateToFilter}
        onChange={(event) => setDateToFilter(event.target.value)}
        title="Fecha Hasta"
      />

      {/* Limpiar */}
      <button
        type="button"
        className="btn btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        onClick={onClear}
      >
        <XIcon />
        Limpiar
      </button>
    </div>
  );
}
