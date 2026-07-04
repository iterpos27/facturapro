import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { CContainer, CFooter } from '@coreui/react';

import Login from './modules/auth/Login';
import AppSidebar from './components/AppSidebar';
import AppHeader from './components/AppHeader';
import AppContent from './components/AppContent';
import { useAppState } from './hooks/useAppState';

/**
 * AppShell
 * Componente interno que usa el hook useAppState (requiere BrowserRouter como padre).
 * Separa la lógica de routing del BrowserRouter para poder usar useNavigate dentro del hook.
 */
function AppShell() {
  const {
    currentUser,
    setCurrentUser,
    sessionLoading,
    sidebarVisible,
    setSidebarVisible,
    theme,
    menuOpen,
    permissions,
    handleLogout,
    toggleTheme,
    toggleMenuSection,
    handleNavigate,
  } = useAppState();

  // ── Pantalla de carga ────────────────────────────────────────────────────────
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

  // ── Login ────────────────────────────────────────────────────────────────────
  if (!currentUser) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  // ── Shell principal ──────────────────────────────────────────────────────────
  return (
    <div className="d-flex min-vh-100 app-shell">
      <AppSidebar
        visible={sidebarVisible}
        onVisibleChange={(v) => setSidebarVisible(v)}
        menuOpen={menuOpen}
        permissions={permissions}
        onToggleSection={toggleMenuSection}
      />

      <div className="wrapper d-flex flex-column min-vh-100 flex-grow-1" style={{ minWidth: 0 }}>
        <AppHeader
          currentUser={currentUser}
          theme={theme}
          onToggleSidebar={() => setSidebarVisible((v) => !v)}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
        />

        <div className="body flex-grow-1 px-4">
          <CContainer fluid className="app-content-frame">
            <AppContent
              permissions={permissions}
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          </CContainer>
        </div>

        <CFooter className="px-4 mt-4 border-top app-footer">
          <div>
            <span className="ms-1">&copy; 2026 FacturaPro.</span>
          </div>
          <div className="ms-auto">
            <span>Desarrollado con IPS Tech</span>
          </div>
        </CFooter>
      </div>
    </div>
  );
}

/**
 * App
 * Envuelve AppShell con BrowserRouter para habilitar react-router en toda la app.
 */
function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
