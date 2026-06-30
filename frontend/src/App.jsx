import React, { useState, useEffect } from 'react';
// Importamos los componentes de CoreUI React
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

// Importamos el componente de Iconos de CoreUI
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
} from '@coreui/icons';

// Importamos Login y los gestores de módulos
import Login from './components/Login';
import ClientManager from './components/ClientManager';
import ProductManager from './components/ProductManager';
import CategoryManager from './components/CategoryManager';
import UserManager from './components/UserManager';
import CompanyManager from './components/CompanyManager';
import BranchManager from './components/BranchManager';
import SupplierManager from './components/SupplierManager';
import InventoryManager from './components/InventoryManager';
import CashRegisterManager from './components/CashRegisterManager';
import InvoiceManager from './components/InvoiceManager';

function App() {
  // Estado para el usuario autenticado
  const [currentUser, setCurrentUser] = useState(null);
  
  // Estado para saber qué pestaña lateral está activa
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Estado para controlar si el sidebar está visible (para responsivo)
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Al montar el componente, verificar si hay sesión activa en localStorage
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error('Error al restaurar sesión:', e);
        handleLogout();
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  // Renderizado condicional según la pestaña seleccionada
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="card shadow-sm border">
            <div className="card-body p-4">
              <h1 className="text-dark fw-bold mb-3">¡Bienvenido al Sistema, {currentUser?.username}!</h1>
              <p className="text-secondary mb-4">
                Has iniciado sesión con el rol de <strong>{currentUser?.rol_nombre}</strong>. Usa el menú lateral para navegar por las opciones.
              </p>
              <div className="row g-4 mt-2">
                <div className="col-md-3">
                  <div className="card text-white bg-primary p-3 border-0 shadow-sm" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('clients')}>
                    <h5>👥 Clientes</h5>
                    <p className="small mb-0 opacity-80">Registra y administra clientes en la base de datos.</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card text-white bg-success p-3 border-0 shadow-sm" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('products')}>
                    <h5>📦 Productos y Serv.</h5>
                    <p className="small mb-0 opacity-80">Administra inventarios, precios y cálculo automático de IVA.</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card text-white bg-warning p-3 border-0 shadow-sm" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('cash')}>
                    <h5>💵 Caja Chica</h5>
                    <p className="small mb-0 opacity-80">Abre y cierra turnos de caja para registrar arqueos diarios.</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card text-white bg-info p-3 border-0 shadow-sm" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('company')}>
                    <h5>⚙️ Empresa (SRI)</h5>
                    <p className="small mb-0 opacity-80">Configura el RUC y parámetros de facturación electrónica.</p>
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
      case 'invoices':
        return <InvoiceManager />;
      default:
        return <ClientManager />;
    }
  };

  // Si no está autenticado, renderizar la pantalla de Login
  if (!currentUser) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="d-flex min-vh-100 bg-body-tertiary">
      {/* MENÚ LATERAL (SIDEBAR DE COREUI) */}
      <CSidebar
        colorScheme="dark"
        className="border-end"
        visible={sidebarVisible}
        onVisibleChange={(visible) => {
          setSidebarVisible(visible);
        }}
      >
        <CSidebarHeader className="border-bottom">
          <CSidebarBrand className="text-center d-flex flex-column py-2">
            <span style={{ fontWeight: '800', fontSize: '1.25rem', letterSpacing: '1px' }}>FacturaPro</span>
            <span style={{ fontSize: '0.65rem', color: '#8a93a2', textTransform: 'uppercase', letterSpacing: '2px' }}>Ecuador - SRI</span>
          </CSidebarBrand>
        </CSidebarHeader>

        <CSidebarNav>
          {/* Dashboard */}
          <CNavItem>
            <CNavLink 
              active={activeTab === 'dashboard'} 
              onClick={() => setSidebarVisible(window.innerWidth < 768 ? false : sidebarVisible) || setActiveTab('dashboard')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilSpeedometer} className="nav-icon" /> Dashboard
            </CNavLink>
          </CNavItem>

          {/* FASE 1: NÚCLEO DEL SISTEMA */}
          <div className="nav-title" style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.7rem', fontWeight: 'bold', color: '#8a93a2', textTransform: 'uppercase' }}>
            Núcleo
          </div>
          
          <CNavItem>
            <CNavLink 
              active={activeTab === 'users'} 
              onClick={() => setSidebarVisible(window.innerWidth < 768 ? false : sidebarVisible) || setActiveTab('users')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilPeople} className="nav-icon" /> Usuarios
            </CNavLink>
          </CNavItem>

          <CNavItem>
            <CNavLink 
              active={activeTab === 'company'} 
              onClick={() => setSidebarVisible(window.innerWidth < 768 ? false : sidebarVisible) || setActiveTab('company')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilSettings} className="nav-icon" /> Config. Empresa
            </CNavLink>
          </CNavItem>

          <CNavItem>
            <CNavLink 
              active={activeTab === 'branches'} 
              onClick={() => setSidebarVisible(window.innerWidth < 768 ? false : sidebarVisible) || setActiveTab('branches')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilHome} className="nav-icon" /> Sucursales
            </CNavLink>
          </CNavItem>

          {/* FASE 2: DATOS COMERCIALES */}
          <div className="nav-title" style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.7rem', fontWeight: 'bold', color: '#8a93a2', textTransform: 'uppercase' }}>
            Comercial
          </div>

          <CNavItem>
            <CNavLink 
              active={activeTab === 'clients'} 
              onClick={() => setSidebarVisible(window.innerWidth < 768 ? false : sidebarVisible) || setActiveTab('clients')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilUser} className="nav-icon" /> Clientes
            </CNavLink>
          </CNavItem>

          <CNavItem>
            <CNavLink 
              active={activeTab === 'suppliers'} 
              onClick={() => setSidebarVisible(window.innerWidth < 768 ? false : sidebarVisible) || setActiveTab('suppliers')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilUserFollow} className="nav-icon" /> Proveedores
            </CNavLink>
          </CNavItem>

          <CNavItem>
            <CNavLink 
              active={activeTab === 'products'} 
              onClick={() => setSidebarVisible(window.innerWidth < 768 ? false : sidebarVisible) || setActiveTab('products')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilBasket} className="nav-icon" /> Productos y Serv.
            </CNavLink>
          </CNavItem>

          <CNavItem>
            <CNavLink 
              active={activeTab === 'categories'} 
              onClick={() => setSidebarVisible(window.innerWidth < 768 ? false : sidebarVisible) || setActiveTab('categories')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilFolder} className="nav-icon" /> Categorías
            </CNavLink>
          </CNavItem>

          {/* FASE 3: OPERACIONES */}
          <div className="nav-title" style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.7rem', fontWeight: 'bold', color: '#8a93a2', textTransform: 'uppercase' }}>
            Operación
          </div>

          <CNavItem>
            <CNavLink 
              active={activeTab === 'cash'} 
              onClick={() => setSidebarVisible(window.innerWidth < 768 ? false : sidebarVisible) || setActiveTab('cash')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilSpeedometer} className="nav-icon" /> Caja Chica
            </CNavLink>
          </CNavItem>

          <CNavItem>
            <CNavLink 
              active={activeTab === 'inventory'} 
              onClick={() => setSidebarVisible(window.innerWidth < 768 ? false : sidebarVisible) || setActiveTab('inventory')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilList} className="nav-icon" /> Inventario
            </CNavLink>
          </CNavItem>

          {/* FASE 4: FACTURACIÓN */}
          <div className="nav-title" style={{ padding: '0.75rem 1rem 0.25rem', fontSize: '0.7rem', fontWeight: 'bold', color: '#8a93a2', textTransform: 'uppercase' }}>
            Documentos
          </div>

          <CNavItem>
            <CNavLink 
              active={activeTab === 'invoices'} 
              onClick={() => setSidebarVisible(window.innerWidth < 768 ? false : sidebarVisible) || setActiveTab('invoices')}
              style={{ cursor: 'pointer' }}
            >
              <CIcon icon={cilFile} className="nav-icon" /> Facturación (SRI)
            </CNavLink>
          </CNavItem>
        </CSidebarNav>
      </CSidebar>

      {/* CONTENEDOR PRINCIPAL */}
      <div className="wrapper d-flex flex-column min-vh-100 flex-grow-1" style={{ minWidth: 0 }}>
        {/* Cabecera superior (Header de CoreUI) */}
        <CHeader className="mb-4 border-bottom bg-white px-3" position="sticky">
          <CContainer fluid className="d-flex align-items-center justify-content-between">
            <CHeaderToggler 
              className="ps-1" 
              onClick={() => setSidebarVisible(!sidebarVisible)}
            >
              <CIcon icon={cilMenu} size="lg" />
            </CHeaderToggler>
            
            <CHeaderNav className="d-none d-md-flex me-auto">
              <span className="text-secondary" style={{ marginLeft: '1rem', fontWeight: '500' }}>
                Sistema Comercial Integrado
              </span>
            </CHeaderNav>
            
            <CHeaderNav className="align-items-center gap-2">
              <span style={{ fontSize: '0.85rem', color: '#768192', fontWeight: '600' }}>
                👤 {currentUser?.username} ({currentUser?.rol_nombre})
              </span>
              <button 
                className="btn btn-outline-danger btn-sm ms-2"
                onClick={handleLogout}
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              >
                Cerrar Sesión
              </button>
            </CHeaderNav>
          </CContainer>
        </CHeader>

        {/* Cuerpo del contenido (Body) */}
        <div className="body flex-grow-1 px-4">
          <CContainer fluid>
            {renderContent()}
          </CContainer>
        </div>

        {/* Pie de página (Footer de CoreUI) */}
        <CFooter className="px-4 mt-4 border-top">
          <div>
            <span className="ms-1">&copy; 2026 FacturaPro Ecuador.</span>
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
