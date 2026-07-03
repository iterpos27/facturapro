import React from 'react';
import {
  CHeader,
  CHeaderToggler,
  CHeaderNav,
  CContainer,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilMenu, cilMoon, cilSun } from '@coreui/icons';

/**
 * AppHeader
 * Barra superior fija con:
 * - Toggle del sidebar
 * - Título del sistema
 * - Switch de tema claro/oscuro
 * - Usuario activo + rol
 * - Botón de cerrar sesión
 */
export default function AppHeader({
  currentUser,
  theme,
  onToggleSidebar,
  onToggleTheme,
  onLogout,
}) {
  return (
    <CHeader
      className="mb-4 border-bottom bg-white px-3 app-topbar"
      position="sticky"
    >
      <CContainer fluid className="d-flex align-items-center justify-content-between">
        <CHeaderToggler className="ps-1" onClick={onToggleSidebar}>
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>

        <CHeaderNav className="d-none d-md-flex me-auto">
          <span
            className="text-secondary"
            style={{ marginLeft: '1rem', fontWeight: '500' }}
          >
            Sistema Comercial Integrado
          </span>
        </CHeaderNav>

        <CHeaderNav className="align-items-center gap-2">
          <button
            type="button"
            className="btn btn-sm app-theme-toggle"
            onClick={onToggleTheme}
            title="Cambiar tema"
          >
            <CIcon icon={theme === 'light' ? cilMoon : cilSun} />
            <span>{theme === 'light' ? 'Oscuro' : 'Claro'}</span>
          </button>

          <span
            style={{
              fontSize: '0.85rem',
              color: 'var(--header-user-text)',
              fontWeight: '600',
            }}
          >
            {currentUser?.username} ({currentUser?.rol_nombre})
          </span>

          <button
            className="btn btn-outline-danger btn-sm ms-2"
            onClick={onLogout}
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
          >
            Cerrar sesion
          </button>
        </CHeaderNav>
      </CContainer>
    </CHeader>
  );
}
