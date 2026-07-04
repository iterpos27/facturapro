import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, AUTH_LOGOUT_EVENT, clearSession } from '../lib/api';
import {
  DEFAULT_MENU_STATE,
  MENU_STATE_STORAGE_KEY,
  getPermissions,
} from '../lib/permissions';

/**
 * useAppState
 * Custom hook que centraliza el estado de la aplicación:
 * - Sesión de usuario (JWT restaurado desde localStorage)
 * - Tema claro/oscuro
 * - Visibilidad del sidebar
 * - Estado de secciones del menú (abiertas/cerradas)
 * - Navegación vía react-router
 */
export function useAppState() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);

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
    setSessionLoading(false);
    navigate('/');
  };

  const toggleTheme = () =>
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));

  const toggleMenuSection = (section) =>
    setMenuOpen((current) => ({ ...current, [section]: !current[section] }));

  const handleNavigate = (path) => {
    if (window.innerWidth < 768) setSidebarVisible(false);
    navigate(path);
  };

  const permissions = getPermissions(currentUser);

  return {
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
  };
}
