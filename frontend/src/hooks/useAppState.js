import { useState, useEffect } from 'react';
import { apiFetch, AUTH_LOGOUT_EVENT, clearSession } from '../lib/api';
import {
  DEFAULT_MENU_STATE,
  MENU_STATE_STORAGE_KEY,
  ACTIVE_TAB_STORAGE_KEY,
  TAB_SECTION_MAP,
  getPermissions,
} from '../lib/permissions';

/**
 * useAppState
 * Custom hook que centraliza todo el estado de la aplicación:
 * - Sesión de usuario (JWT restaurado desde localStorage)
 * - Tema claro/oscuro
 * - Visibilidad del sidebar
 * - Estado de secciones del menú (abiertas/cerradas)
 * - Tab activo y navegación
 */
export function useAppState() {
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) || 'dashboard'
  );

  const [sidebarVisible, setSidebarVisible] = useState(() => {
    const stored = localStorage.getItem('facturapro-sidebar-visible');
    return stored !== null ? JSON.parse(stored) : true;
  });

  const [theme, setTheme] = useState(
    () => localStorage.getItem('facturapro-theme') || 'light'
  );

  const [menuOpen, setMenuOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(MENU_STATE_STORAGE_KEY);
      if (!stored) return DEFAULT_MENU_STATE;
      return { ...DEFAULT_MENU_STATE, ...JSON.parse(stored) };
    } catch {
      return DEFAULT_MENU_STATE;
    }
  });

  // ── Persistencia en localStorage ────────────────────────────────────────────
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

  // ── Restaurar sesión al cargar ───────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const handleForcedLogout = () => handleLogout();

    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');

      if (!token || !userStr) {
        if (mounted) setSessionLoading(false);
        return;
      }

      try {
        const localUser = JSON.parse(userStr);
        const response = await apiFetch('/api/auth/me');

        if (!response.ok) throw new Error('La sesion no es valida.');

        const data = await response.json();
        const user = data.user || localUser;
        localStorage.setItem('user', JSON.stringify(user));

        if (mounted) setCurrentUser(user);
      } catch (error) {
        console.error('Error al restaurar sesion:', error);
        clearSession();
        if (mounted) setCurrentUser(null);
      } finally {
        if (mounted) setSessionLoading(false);
      }
    };

    restoreSession();
    window.addEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);

    return () => {
      mounted = false;
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleForcedLogout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Acciones ────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setActiveTab('dashboard');
    setSessionLoading(false);
  };

  const toggleTheme = () =>
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));

  const toggleMenuSection = (section) =>
    setMenuOpen((current) => ({ ...current, [section]: !current[section] }));

  const handleNavigate = (tab) => {
    if (window.innerWidth < 768) setSidebarVisible(false);
    const sectionKey = TAB_SECTION_MAP[tab];
    if (sectionKey) {
      setMenuOpen((current) => ({ ...current, [sectionKey]: true }));
    }
    setActiveTab(tab);
  };

  const permissions = getPermissions(currentUser?.rol_nombre);

  return {
    currentUser,
    setCurrentUser,
    sessionLoading,
    activeTab,
    sidebarVisible,
    setSidebarVisible,
    theme,
    menuOpen,
    permissions,
    handleLogout,
    toggleTheme,
    toggleMenuSection,
    handleNavigate,
  };
}
