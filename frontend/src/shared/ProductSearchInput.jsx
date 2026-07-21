import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';

const MIN_SEARCH_LENGTH = 2;
const MAX_RESULTS = 20;
const DEBOUNCE_MS = 300;

const normalize = (value) => String(value || '').trim().toLowerCase();

const getProductLabel = (product) => {
  if (!product) return '';
  const code = product.codigo || product.sku || 'S/C';
  const stock = Number(product.stock_actual || 0).toFixed(2);
  return `[${code}] ${product.nombre} (Stock: ${stock})`;
};

/**
 * ProductSearchInput
 *
 * Modos de operación:
 * 1. Con `products` prop (array) → búsqueda local en memoria (comportamiento original)
 * 2. Sin `products` o array vacío → búsqueda async via API /api/products?search=...
 *
 * Props:
 *   products       - Array de productos precargados (opcional)
 *   value          - ID del producto seleccionado (string)
 *   onChange       - Callback al seleccionar un producto (id string)
 *   required       - Campo obligatorio en form
 *   disabled       - Deshabilitar input
 *   placeholder    - Texto de ayuda
 *   clearOnSelect  - Limpiar query al seleccionar
 */
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
  const debounceRef = useRef(null);

  // Modo: async si no hay array de productos precargado o está vacío
  const asyncMode = !products || products.length === 0;

  const selectedProduct = useMemo(
    () => (products || []).find((product) => String(product.id_producto) === String(value)) || null,
    [products, value],
  );

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [asyncResults, setAsyncResults] = useState([]);
  const [asyncLoading, setAsyncLoading] = useState(false);

  // Sync: mostrar label del producto seleccionado
  useEffect(() => {
    if (!asyncMode) {
      setQuery(getProductLabel(selectedProduct));
    }
  }, [selectedProduct, asyncMode]);

  // Async mode: resolver el producto seleccionado por ID cuando viene de fuera (ej: proforma)
  useEffect(() => {
    if (!asyncMode || !value) {
      return;
    }
    // Si ya lo tenemos en asyncResults, usarlo
    const fromResults = asyncResults.find((p) => String(p.id_producto) === String(value));
    if (fromResults) {
      setQuery(clearOnSelect ? '' : getProductLabel(fromResults));
      return;
    }
    // Si no, fetch por ID
    apiFetch(`/api/products/${value}`)
      .then((res) => res.ok ? res.json() : null)
      .then((product) => {
        if (product) {
          if (!clearOnSelect) setQuery(getProductLabel(product));
        }
      })
      .catch(() => {});
  }, [value, asyncMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Búsqueda async con debounce
  const searchAsync = useCallback(async (term) => {
    if (term.length < MIN_SEARCH_LENGTH) {
      setAsyncResults([]);
      return;
    }
    setAsyncLoading(true);
    try {
      const params = new URLSearchParams({ search: term, limit: String(MAX_RESULTS), page: '1' });
      const res = await apiFetch(`/api/products?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      setAsyncResults(list);
    } catch {
      setAsyncResults([]);
    } finally {
      setAsyncLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Búsqueda local (modo con productos precargados)
  const localResults = useMemo(() => {
    if (asyncMode) return [];
    const searchTerm = normalize(query);
    if (searchTerm.length < MIN_SEARCH_LENGTH) return [];
    return (products || [])
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
  }, [products, query, asyncMode]);

  const results = asyncMode ? asyncResults : localResults;
  const isLoading = asyncMode && asyncLoading;
  const searchTerm = normalize(query);

  const handleInputChange = (event) => {
    const newQuery = event.target.value;
    setQuery(newQuery);
    setOpen(true);
    if (value) onChange('');

    if (asyncMode) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchAsync(normalize(newQuery)), DEBOUNCE_MS);
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
          {isLoading ? (
            <div className="product-search-empty">Buscando...</div>
          ) : searchTerm.length < MIN_SEARCH_LENGTH ? (
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
