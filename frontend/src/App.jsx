import React, { useState, useEffect } from 'react';
import {
  CSidebar,
  CSidebarBrand,
  CSidebarHeader,
  CSidebarNav,
  CNavItem,
  CNavLink,
  CHeader,
  CHeaderToggler,
  CHeaderNav,
  CContainer,
  CFooter,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import {
  cilSpeedometer,
  cilUser,
  cilFolder,
  cilFile,
  cilBasket,
  cilMenu,
  cilSettings,
  cilPeople,
  cilHome,
  cilUserFollow,
  cilList,
  cilMoon,
  cilSun,
} from '@coreui/icons';

import Login from './modules/auth/Login';
import ClientManager from './modules/contacts/clients/ClientManager';
import SupplierManager from './modules/contacts/suppliers/SupplierManager';
import ProductManager from './modules/inventory/products/ProductManager';
import CategoryManager from './modules/inventory/categories/CategoryManager';
import InventoryManager from './modules/inventory/stock/InventoryManager';
import ProformaManager from './modules/documents/proformas/ProformaManager';
import InvoiceManager from './modules/documents/invoices/InvoiceManager';
import CashRegisterManager from './modules/administration/cash/CashRegisterManager';
import CompanyManager from './modules/administration/company/CompanyManager';
import BranchManager from './modules/administration/branches/BranchManager';
import UserManager from './modules/administration/users/UserManager';
import ReportsDashboard from './modules/reports/ReportsDashboard';
import { apiFetch, AUTH_LOGOUT_EVENT, clearSession } from './lib/api';

const DEFAULT_MENU_STATE = {
  contactos: true,
  inventario: true,
  documentos: true,
  configuracion: true,
};

const MENU_STATE_STORAGE_KEY = 'facturapro-menu-state';
const ACTIVE_TAB_STORAGE_KEY = 'facturapro-active-tab';
const TAB_SECTION_MAP = {
  clients: 'contactos',
  suppliers: 'contactos',
  products: 'inventario',
  categories: 'inventario',
  inventory: 'inventario',
  proformas: 'documentos',
  invoices: 'documentos',
  reports: 'documentos',
  cash: 'configuracion',
  company: 'configuracion',
  branches: 'configuracion',
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) || 'dashboard');
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    const stored = localStorage.getItem('facturapro-sidebar-visible');
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('facturapro-theme') || 'light');
  const [menuOpen, setMenuOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(MENU_STATE_STORAGE_KEY);
      if (!stored) {
        return DEFAULT_MENU_STATE;
      }

      return {
        ...DEFAULT_MENU_STATE,
        ...JSON.parse(stored),
      };
    } catch (error) {
      console.warn('No se pudo restaurar el estado del menu lateral:', error);
      return DEFAULT_MENU_STATE;
    }
  });

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setActiveTab('dashboard');
    setSessionLoading(false);
  };

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('facturapro-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(MENU_STATE_STORAGE_KEY, JSON.stringify(menuOpen));
  }, [menuOpen]);

  useEffect(() => {
    localStorage.setItem('facturapro-sidebar-visible', JSON.stringify(sidebarVisible));
  }, [sidebarVisible]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    let mounted = true;

    const handleForcedLogout = () => {
      handleLogout();
    };

    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');

      if (!token || !userStr) {
        if (mounted) {
          setSessionLoading(false);
        }
        return;
      }

      try {
        const localUser = JSON.parse(userStr);
        const response = await apiFetch('/api/auth/me');

        if (!response.ok) {
          throw new Error('La sesion no es valida.');
        }

        const data = await response.json();
        const user = data.user || localUser;
        localStorage.setItem('user', JSON.stringify(user));

        if (mounted) {
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Error al restaurar sesion:', error);
        clearSession();
        if (mounted) {
          setCurrentUser(null);
        }
      } finally {
        if (mounted) {
          setSessionLoading(false);
        }
      }
    };

    restoreSession();
    window.addEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);

    return () => {
      mounted = false;
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  };

  const toggleMenuSection = (section) => {
    setMenuOpen((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const handleNavigate = (tab) => {
    if (window.innerWidth < 768) {
      setSidebarVisible(false);
    }
    const sectionKey = TAB_SECTION_MAP[tab];
    if (sectionKey) {
      setMenuOpen((current) => ({
        ...current,
        [sectionKey]: true,
      }));
    }
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="card shadow-sm border module-panel-card">
            <div className="card-body p-4">
              <h1 className="text-dark fw-bold mb-3">Bienvenido al sistema, {currentUser?.username}</h1>
              <p className="text-secondary mb-4">
                Has iniciado sesion con el rol de <strong>{currentUser?.rol_nombre}</strong>. Usa el menu lateral para navegar por las opciones.
              </p>
              <div className="row g-4 mt-2">
                <div className="col-md-3">
                  <div className="card dashboard-tile dashboard-tile-primary" onClick={() => handleNavigate('clients')}>
                    <h5>Clientes</h5>
                    <p>Registra y administra clientes en la base de datos.</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card dashboard-tile dashboard-tile-success" onClick={() => handleNavigate('products')}>
                    <h5>Productos y servicios</h5>
                    <p>Administra inventarios, precios y calculo automatico de IVA.</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card dashboard-tile dashboard-tile-warning" onClick={() => handleNavigate('cash')}>
                    <h5>Caja chica</h5>
                    <p>Abre y cierra turnos de caja para registrar arqueos diarios.</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card dashboard-tile dashboard-tile-info" onClick={() => handleNavigate('reports')}>
                    <h5>Reportes</h5>
                    <p>Consulta ventas, proformas y auditoria reciente.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'clients':
        return <ClientManager />;
      case 'suppliers':
        return <SupplierManager />;
      case 'products':
        return <ProductManager />;
      case 'categories':
        return <CategoryManager />;
      case 'users':
        return <UserManager />;
      case 'company':
        return <CompanyManager />;
      case 'branches':
        return <BranchManager />;
      case 'inventory':
        return <InventoryManager />;
      case 'cash':
        return <CashRegisterManager />;
      case 'proformas':
        return <ProformaManager />;
      case 'invoices':
        return <InvoiceManager onRedirectToCash={() => handleNavigate('cash')} />;
      case 'reports':
        return <ReportsDashboard />;
      default:
        return <ClientManager />;
    }
  };

  const renderSection = (key, label, items) => (
    <div className="app-sidebar-section">
      <button type="button" className="app-nav-section-toggle" onClick={() => toggleMenuSection(key)}>
        <span>{label}</span>
        <span className={`app-nav-section-arrow ${menuOpen[key] ? 'open' : ''}`}>+</span>
      </button>
      {menuOpen[key] && items}
    </div>
  );

  if (sessionLoading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
        <div className="text-center">
          <h2 className="h5 mb-2">Validando sesion</h2>
          <p className="text-secondary mb-0">Esperando respuesta del servidor...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="d-flex min-vh-100 app-shell">
      <CSidebar
        colorScheme="dark"
        className="border-end app-sidebar"
        visible={sidebarVisible}
        onVisibleChange={(visible) => {
          if (window.innerWidth < 768) {
            setSidebarVisible(visible);
          }
        }}
      >
        <CSidebarHeader className="border-bottom app-sidebar-header">
          <CSidebarBrand className="d-flex flex-column py-2 app-brand-wrap">
            <span className="app-brand-mark">FacturaPro</span>
          </CSidebarBrand>
        </CSidebarHeader>

        <CSidebarNav>
          <CNavItem>
            <CNavLink className="app-nav-link" active={activeTab === 'dashboard'} onClick={() => handleNavigate('dashboard')} style={{ cursor: 'pointer' }}>
              <CIcon icon={cilSpeedometer} className="nav-icon" /> Dashboard
            </CNavLink>
          </CNavItem>

          {renderSection(
            'contactos',
            'Contactos',
            <>
              <CNavItem>
                <CNavLink className="app-nav-link" active={activeTab === 'clients'} onClick={() => handleNavigate('clients')} style={{ cursor: 'pointer' }}>
                  <CIcon icon={cilUser} className="nav-icon" /> Clientes
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink className="app-nav-link" active={activeTab === 'suppliers'} onClick={() => handleNavigate('suppliers')} style={{ cursor: 'pointer' }}>
                  <CIcon icon={cilUserFollow} className="nav-icon" /> Proveedores
                </CNavLink>
              </CNavItem>
            </>,
          )}

          {renderSection(
            'inventario',
            'Inventario',
            <>
              <CNavItem>
                <CNavLink className="app-nav-link" active={activeTab === 'products'} onClick={() => handleNavigate('products')} style={{ cursor: 'pointer' }}>
                  <CIcon icon={cilBasket} className="nav-icon" /> Productos
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink className="app-nav-link" active={activeTab === 'categories'} onClick={() => handleNavigate('categories')} style={{ cursor: 'pointer' }}>
                  <CIcon icon={cilFolder} className="nav-icon" /> Categorías
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink className="app-nav-link" active={activeTab === 'inventory'} onClick={() => handleNavigate('inventory')} style={{ cursor: 'pointer' }}>
                  <CIcon icon={cilList} className="nav-icon" /> Inventario
                </CNavLink>
              </CNavItem>
            </>,
          )}

          {renderSection(
            'documentos',
            'Documentos',
            <>
              <CNavItem>
                <CNavLink className="app-nav-link" active={activeTab === 'proformas'} onClick={() => handleNavigate('proformas')} style={{ cursor: 'pointer' }}>
                  <CIcon icon={cilFile} className="nav-icon" /> Proformas
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink className="app-nav-link" active={activeTab === 'invoices'} onClick={() => handleNavigate('invoices')} style={{ cursor: 'pointer' }}>
                  <CIcon icon={cilFile} className="nav-icon" /> Facturación
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink className="app-nav-link" active={activeTab === 'reports'} onClick={() => handleNavigate('reports')} style={{ cursor: 'pointer' }}>
                  <CIcon icon={cilSpeedometer} className="nav-icon" /> Reportes
                </CNavLink>
              </CNavItem>
            </>,
          )}

          {renderSection(
            'configuracion',
            'Configuración / Caja',
            <>
              <CNavItem>
                <CNavLink className="app-nav-link" active={activeTab === 'cash'} onClick={() => handleNavigate('cash')} style={{ cursor: 'pointer' }}>
                  <CIcon icon={cilSpeedometer} className="nav-icon" /> Caja Chica
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink className="app-nav-link" active={activeTab === 'company'} onClick={() => handleNavigate('company')} style={{ cursor: 'pointer' }}>
                  <CIcon icon={cilSettings} className="nav-icon" /> Config. Empresa
                </CNavLink>
              </CNavItem>
              <CNavItem>
                <CNavLink className="app-nav-link" active={activeTab === 'branches'} onClick={() => handleNavigate('branches')} style={{ cursor: 'pointer' }}>
                  <CIcon icon={cilHome} className="nav-icon" /> Sucursales
                </CNavLink>
              </CNavItem>
            </>,
          )}

          <CNavItem>
            <CNavLink className="app-nav-link" active={activeTab === 'users'} onClick={() => handleNavigate('users')} style={{ cursor: 'pointer' }}>
              <CIcon icon={cilPeople} className="nav-icon" /> Usuarios
            </CNavLink>
          </CNavItem>
        </CSidebarNav>
      </CSidebar>

      <div className="wrapper d-flex flex-column min-vh-100 flex-grow-1" style={{ minWidth: 0 }}>
        <CHeader className="mb-4 border-bottom bg-white px-3 app-topbar" position="sticky">
          <CContainer fluid className="d-flex align-items-center justify-content-between">
            <CHeaderToggler className="ps-1" onClick={() => setSidebarVisible(!sidebarVisible)}>
              <CIcon icon={cilMenu} size="lg" />
            </CHeaderToggler>

            <CHeaderNav className="d-none d-md-flex me-auto">
              <span className="text-secondary" style={{ marginLeft: '1rem', fontWeight: '500' }}>
                Sistema Comercial Integrado
              </span>
            </CHeaderNav>

            <CHeaderNav className="align-items-center gap-2">
              <button type="button" className="btn btn-sm app-theme-toggle" onClick={toggleTheme} title="Cambiar tema">
                <CIcon icon={theme === 'light' ? cilMoon : cilSun} />
                <span>{theme === 'light' ? 'Oscuro' : 'Claro'}</span>
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--header-user-text)', fontWeight: '600' }}>
                {currentUser?.username} ({currentUser?.rol_nombre})
              </span>
              <button className="btn btn-outline-danger btn-sm ms-2" onClick={handleLogout} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                Cerrar sesion
              </button>
            </CHeaderNav>
          </CContainer>
        </CHeader>

        <div className="body flex-grow-1 px-4">
          <CContainer fluid className="app-content-frame">
            {renderContent()}
          </CContainer>
        </div>

        <CFooter className="px-4 mt-4 border-top app-footer">
          <div>
            <span className="ms-1">&copy; 2026 FacturaPro.</span>
          </div>
          <div className="ms-auto">
            <span>Desarrollado con CoreUI</span>
          </div>
        </CFooter>
      </div>
    </div>
  );
}

export default App;
