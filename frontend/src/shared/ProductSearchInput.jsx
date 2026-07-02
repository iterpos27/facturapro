import React, { useEffect, useMemo, useRef, useState } from 'react';

const MIN_SEARCH_LENGTH = 2;
const MAX_RESULTS = 20;

const normalize = (value) => String(value || '').trim().toLowerCase();

const getProductLabel = (product) => {
  if (!product) return '';
  const code = product.codigo || product.sku || 'S/C';
  const stock = Number(product.stock_actual || 0).toFixed(2);
  return `[${code}] ${product.nombre} (Stock: ${stock})`;
};

export default function ProductSearchInput({
  products,
  value,
  onChange,
  required = false,
  disabled = false,
  placeholder = 'Buscar por codigo, SKU o nombre',
  clearOnSelect = false,
}) {
  const wrapperRef = useRef(null);
  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id_producto) === String(value)) || null,
    [products, value],
  );
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(getProductLabel(selectedProduct));
  }, [selectedProduct]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchTerm = normalize(query);
  const results = useMemo(() => {
    if (searchTerm.length < MIN_SEARCH_LENGTH) return [];

    return products
      .filter((product) => {
        const haystack = [
          product.codigo,
          product.sku,
          product.nombre,
          product.marca,
          product.referencia,
        ].map(normalize).join(' ');
        return haystack.includes(searchTerm);
      })
      .slice(0, MAX_RESULTS);
  }, [products, searchTerm]);

  const handleInputChange = (event) => {
    setQuery(event.target.value);
    setOpen(true);
    if (value) {
      onChange('');
    }
  };

  const handleSelect = (product) => {
    onChange(String(product.id_producto));
    setQuery(clearOnSelect ? '' : getProductLabel(product));
    setOpen(false);
  };

  return (
    <div className="product-search" ref={wrapperRef}>
      <input
        type="text"
        className="form-control"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoComplete="off"
      />

      {open && !disabled && (
        <div className="product-search-results">
          {searchTerm.length < MIN_SEARCH_LENGTH ? (
            <div className="product-search-empty">Escribe al menos 2 caracteres para buscar.</div>
          ) : results.length === 0 ? (
            <div className="product-search-empty">No se encontraron productos.</div>
          ) : (
            results.map((product) => (
              <button
                type="button"
                className="product-search-option"
                key={product.id_producto}
                onClick={() => handleSelect(product)}
              >
                <span>{product.nombre}</span>
                <small>
                  [{product.codigo || product.sku || 'S/C'}] Stock: {Number(product.stock_actual || 0).toFixed(2)}
                </small>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
