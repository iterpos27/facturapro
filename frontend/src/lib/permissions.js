/**
 * permissions.js
 * Constantes de permisos por rol, mapa de tabs a secciones del menú,
 * y estado por defecto del menú lateral.
 */

export const DEFAULT_MENU_STATE = {
  contactos: true,
  inventario: true,
  documentos: true,
  configuracion: true,
};

export const MENU_STATE_STORAGE_KEY = 'facturapro-menu-state';
export const ACTIVE_TAB_STORAGE_KEY = 'facturapro-active-tab';

/** Qué sección del menú lateral corresponde a cada pestaña */
export const TAB_SECTION_MAP = {
  clients: 'contactos',
  suppliers: 'contactos',
  products: 'inventario',
  categories: 'inventario',
  inventory: 'inventario',
  purchases: 'inventario',
  proformas: 'documentos',
  invoices: 'documentos',
  receivables: 'documentos',
  creditnotes: 'documentos',
  withholdings: 'documentos',
  reports: 'documentos',
  cash: 'configuracion',
  company: 'configuracion',
  branches: 'configuracion',
  audit: 'configuracion',
};

/** Permisos de módulo por nombre de rol */
export const ROLE_PERMISSIONS = {
  ADMINISTRADOR: {
    clients: true,
    suppliers: true,
    products: true,
    categories: true,
    inventory: true,
    purchases: true,
    proformas: true,
    invoices: true,
    receivables: true,
    creditnotes: true,
    withholdings: true,
    reports: true,
    cash: true,
    company: true,
    branches: true,
    users: true,
    audit: true,
  },
  VENDEDOR: {
    clients: true,
    suppliers: false,
    products: true,
    categories: false,
    inventory: false,
    purchases: false,
    proformas: true,
    invoices: true,
    receivables: true,
    creditnotes: false,
    withholdings: false,
    reports: false,
    cash: true,
    company: false,
    branches: false,
    users: false,
    audit: false,
  },
  CONTADOR: {
    clients: true,
    suppliers: true,
    products: true,
    categories: true,
    inventory: true,
    purchases: true,
    proformas: true,
    invoices: true,
    receivables: true,
    creditnotes: true,
    withholdings: true,
    reports: true,
    cash: false,
    company: false,
    branches: false,
    users: false,
    audit: true,
  },
};

/**
 * Devuelve el objeto de permisos para el rol dado.
 * Si el rol no existe, cae a los permisos de VENDEDOR.
 */
export function getPermissions(rolNombre) {
  return ROLE_PERMISSIONS[rolNombre] || ROLE_PERMISSIONS.VENDEDOR;
}
