import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CSidebar,
  CSidebarBrand,
  CSidebarHeader,
  CSidebarNav,
  CNavItem,
  CNavLink,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilSpeedometer,
  cilUser,
  cilFolder,
  cilFile,
  cilBasket,
  cilSettings,
  cilPeople,
  cilHome,
  cilList,
  cilTask,
  cilUserFollow,
  cilBank,
} from '@coreui/icons';

/**
 * AppSidebar
 * Sidebar de navegación con secciones colapsables.
 * Usa react-router useNavigate para navegación programática
 * y useLocation para resaltar el link activo.
 */
export default function AppSidebar({
  visible,
  onVisibleChange,
  menuOpen,
  permissions,
  onToggleSection,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const handleNav = (path) => {
    if (window.innerWidth < 768) onVisibleChange(false);
    navigate(path);
  };

  const renderSection = (key, label, items) => (
    <div className="app-sidebar-section" key={key}>
      <button
        type="button"
        className="app-nav-section-toggle"
        onClick={() => onToggleSection(key)}
      >
        <span>{label}</span>
        <span className={`app-nav-section-arrow ${menuOpen[key] ? 'open' : ''}`}>+</span>
      </button>
      {menuOpen[key] && items}
    </div>
  );

  const navLink = (path, icon, label) => (
    <CNavItem key={path}>
      <CNavLink
        className="app-nav-link"
        active={isActive(path)}
        onClick={() => handleNav(path)}
        style={{ cursor: 'pointer' }}
      >
        <CIcon icon={icon} className="nav-icon" /> {label}
      </CNavLink>
    </CNavItem>
  );

  return (
    <CSidebar
      colorScheme="dark"
      className="border-end app-sidebar"
      visible={visible}
      onVisibleChange={(v) => {
        if (window.innerWidth < 768) onVisibleChange(v);
      }}
    >
      <CSidebarHeader className="border-bottom app-sidebar-header">
        <CSidebarBrand className="d-flex flex-column py-2 app-brand-wrap">
          <span className="app-brand-mark">FacturaPro</span>
        </CSidebarBrand>
      </CSidebarHeader>

      <CSidebarNav>
        {/* Dashboard */}
        <CNavItem>
          <CNavLink
            className="app-nav-link"
            active={isActive('/')}
            onClick={() => handleNav('/')}
            style={{ cursor: 'pointer' }}
          >
            <CIcon icon={cilSpeedometer} className="nav-icon" /> Dashboard
          </CNavLink>
        </CNavItem>

        {/* Contactos */}
        {(permissions.clients || permissions.suppliers) &&
          renderSection('contactos', 'Contactos', (
            <>
              {permissions.clients    && navLink('/clientes',    cilUser,       'Clientes')}
              {permissions.suppliers  && navLink('/proveedores', cilUserFollow, 'Proveedores')}
            </>
          ))}

        {/* Inventario */}
        {(permissions.products || permissions.categories || permissions.inventory || permissions.purchases) &&
          renderSection('inventario', 'Inventario', (
            <>
              {permissions.products   && navLink('/productos',  cilBasket, 'Productos')}
              {permissions.categories && navLink('/categorias', cilFolder,  'Categorías')}
              {permissions.inventory  && navLink('/inventario', cilList,    'Inventario')}
              {permissions.purchases  && navLink('/compras',    cilBasket,  'Compras')}
              {permissions.purchases  && navLink('/cuentas-pagar', cilFile,  'CxP y Pagos')}
            </>
          ))}

        {/* Documentos */}
        {(permissions.proformas || permissions.invoices || permissions.receivables ||
          permissions.creditnotes || permissions.withholdings || permissions.reports || permissions.sri) &&
          renderSection('documentos', 'Documentos', (
            <>
              {permissions.proformas    && navLink('/proformas',      cilFile,         'Proformas')}
              {permissions.invoices     && navLink('/facturas',       cilFile,         'Facturación')}
              {permissions.receivables  && navLink('/cuentas-cobrar', cilFile,         'CxC y Cobros')}
              {permissions.creditnotes  && navLink('/notas-credito',  cilFile,         'Notas de Crédito')}
              {permissions.withholdings && navLink('/retenciones',    cilFile,         'Retenciones')}
              {permissions.reports      && navLink('/reportes',       cilSpeedometer,  'Reportes')}
              {permissions.sri          && navLink('/sri',            cilTask,         'Control SRI')}
            </>
          ))}

        {/* Configuración / Caja */}
        {(permissions.cash || permissions.banks || permissions.company || permissions.branches || permissions.sequentials || permissions.audit) &&
          renderSection('configuracion', 'Configuración / Caja', (
            <>
              {permissions.banks       && navLink('/bancos',       cilBank,        'Bancos')}
              {permissions.cash        && navLink('/caja',         cilSpeedometer, 'Caja Chica')}
              {permissions.company     && navLink('/empresa',      cilSettings,    'Config. Empresa')}
              {permissions.branches    && navLink('/sucursales',   cilHome,        'Sucursales')}
              {permissions.sequentials && navLink('/secuenciales', cilTask,        'Secuenciales')}
              {permissions.audit       && navLink('/auditoria',    cilList,        'Auditoria')}
            </>
          ))}

        {/* Usuarios */}
        {permissions.users && (
          <CNavItem>
            <CNavLink
              className="app-nav-link"
              active={isActive('/usuarios')}
              onClick={() => handleNav('/usuarios')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilPeople} className="nav-icon" /> Usuarios
            </CNavLink>
          </CNavItem>
        )}
      </CSidebarNav>
    </CSidebar>
  );
}
