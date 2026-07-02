import React from 'react';

export default function ClientToolbar({ searchQuery, setSearchQuery }) {
  return (
    <div className="search-bar-container client-search-wrap">
      <div className="search-input-wrapper">
        <input
          type="text"
          className="form-control"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, cedula, RUC o correo..."
        />
      </div>
    </div>
  );
}
