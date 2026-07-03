import React from 'react';
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
  cilUserFollow,
  cilList,
} from '@coreui/icons';

/**
 * AppSidebar
 * Sidebar de navegación con secciones colapsables por grupo de módulo.
 * Filtra las opciones visibles según el objeto `permissions` del rol activo.
 */
export default function AppSidebar({
  visible,
  onVisibleChange,
  activeTab,
  menuOpen,
  permissions,
  onNavigate,
  onToggleSection,
}) {
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

  const navLink = (tab, icon, label) => (
    <CNavItem key={tab}>
      <CNavLink
        className="app-nav-link"
        active={activeTab === tab}
        onClick={() => onNavigate(tab)}
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
            active={activeTab === 'dashboard'}
            onClick={() => onNavigate('dashboard')}
            style={{ cursor: 'pointer' }}
          >
            <CIcon icon={cilSpeedometer} className="nav-icon" /> Dashboard
          </CNavLink>
        </CNavItem>

        {/* Contactos */}
        {(permissions.clients || permissions.suppliers) &&
          renderSection('contactos', 'Contactos', (
            <>
              {permissions.clients && navLink('clients', cilUser, 'Clientes')}
              {permissions.suppliers && navLink('suppliers', cilUserFollow, 'Proveedores')}
            </>
          ))}

        {/* Inventario */}
        {(permissions.products || permissions.categories || permissions.inventory || permissions.purchases) &&
          renderSection('inventario', 'Inventario', (
            <>
              {permissions.products && navLink('products', cilBasket, 'Productos')}
              {permissions.categories && navLink('categories', cilFolder, 'Categorías')}
              {permissions.inventory && navLink('inventory', cilList, 'Inventario')}
              {permissions.purchases && navLink('purchases', cilBasket, 'Compras')}
            </>
          ))}

        {/* Documentos */}
        {(permissions.proformas || permissions.invoices || permissions.receivables ||
          permissions.creditnotes || permissions.withholdings || permissions.reports) &&
          renderSection('documentos', 'Documentos', (
            <>
              {permissions.proformas && navLink('proformas', cilFile, 'Proformas')}
              {permissions.invoices && navLink('invoices', cilFile, 'Facturación')}
              {permissions.receivables && navLink('receivables', cilFile, 'CxC y Cobros')}
              {permissions.creditnotes && navLink('creditnotes', cilFile, 'Notas de Crédito')}
              {permissions.withholdings && navLink('withholdings', cilFile, 'Retenciones')}
              {permissions.reports && navLink('reports', cilSpeedometer, 'Reportes')}
            </>
          ))}

        {/* Configuración / Caja */}
        {(permissions.cash || permissions.company || permissions.branches || permissions.audit) &&
          renderSection('configuracion', 'Configuración / Caja', (
            <>
              {permissions.cash && navLink('cash', cilSpeedometer, 'Caja Chica')}
              {permissions.company && navLink('company', cilSettings, 'Config. Empresa')}
              {permissions.branches && navLink('branches', cilHome, 'Sucursales')}
              {permissions.audit && navLink('audit', cilList, 'Auditoria')}
            </>
          ))}

        {/* Usuarios (sólo ADMINISTRADOR) */}
        {permissions.users && (
          <CNavItem>
            <CNavLink
              className="app-nav-link"
              active={activeTab === 'users'}
              onClick={() => onNavigate('users')}
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
