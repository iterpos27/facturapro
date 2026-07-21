import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DashboardHome from '../modules/dashboard/DashboardHome';
import ErrorBoundary from './ErrorBoundary';

// Code splitting: cada módulo se carga solo cuando se navega a él
const ClientManager      = lazy(() => import('../modules/contacts/clients/ClientManager'));
const SupplierManager    = lazy(() => import('../modules/contacts/suppliers/SupplierManager'));
const ProductManager     = lazy(() => import('../modules/inventory/products/ProductManager'));
const CategoryManager    = lazy(() => import('../modules/inventory/categories/CategoryManager'));
const InventoryManager   = lazy(() => import('../modules/inventory/stock/InventoryManager'));
const PurchaseManager    = lazy(() => import('../modules/inventory/purchases/PurchaseManager'));
const PayablesManager    = lazy(() => import('../modules/inventory/payables/PayablesManager'));
const ProformaManager    = lazy(() => import('../modules/documents/proformas/ProformaManager'));
const InvoiceManager     = lazy(() => import('../modules/documents/invoices/InvoiceManager'));
const ReceivablesManager = lazy(() => import('../modules/documents/receivables/ReceivablesManager'));
const CreditNotesManager = lazy(() => import('../modules/documents/creditnotes/CreditNotesManager'));
const WithholdingsManager= lazy(() => import('../modules/documents/withholdings/WithholdingsManager'));
const CashRegisterManager= lazy(() => import('../modules/administration/cash/CashRegisterManager'));
const CompanyManager     = lazy(() => import('../modules/administration/company/CompanyManager'));
const BranchManager      = lazy(() => import('../modules/administration/branches/BranchManager'));
const SequentialsManager = lazy(() => import('../modules/administration/sequentials/SequentialsManager'));
const UserManager        = lazy(() => import('../modules/administration/users/UserManager'));
const AuditManager       = lazy(() => import('../modules/administration/audit/AuditManager'));
const ReportsDashboard   = lazy(() => import('../modules/reports/ReportsDashboard'));
const BanksManager       = lazy(() => import('../modules/administration/banks/BanksManager'));

/** Spinner de carga mientras se descarga el chunk del módulo */
function ModuleLoader() {
  return (
    <div className="d-flex justify-content-center align-items-center py-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Cargando...</span>
      </div>
    </div>
  );
}

/**
 * AppContent
 * Usa React Router <Routes> para mapear URLs a módulos.
 * Cada módulo se carga bajo demanda (lazy) con Suspense.
 * Si el rol no tiene permiso para la ruta activa, muestra "Acceso Denegado".
 */
export default function AppContent({ permissions, currentUser, onNavigate }) {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.pathname} onBack={() => onNavigate('/')}>
      <Suspense fallback={<ModuleLoader />}>
        <Routes>
        {/* Dashboard */}
        <Route
          path="/"
          element={<DashboardHome currentUser={currentUser} permissions={permissions} onNavigate={onNavigate} />}
        />

        {/* Contactos */}
        <Route path="/clientes"    element={permissions.clients    ? <ClientManager />   : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/proveedores" element={permissions.suppliers  ? <SupplierManager /> : <AccessDenied onBack={() => onNavigate('/')} />} />

        {/* Inventario */}
        <Route path="/productos"   element={permissions.products   ? <ProductManager />  : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/categorias"  element={permissions.categories ? <CategoryManager /> : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/inventario"  element={permissions.inventory  ? <InventoryManager />: <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/compras"     element={permissions.purchases  ? <PurchaseManager /> : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/cuentas-pagar" element={permissions.purchases ? <PayablesManager /> : <AccessDenied onBack={() => onNavigate('/')} />} />

        {/* Documentos */}
        <Route path="/proformas"       element={permissions.proformas    ? <ProformaManager onInvoiceProforma={() => onNavigate('/facturas')} /> : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/facturas"        element={permissions.invoices     ? <InvoiceManager onRedirectToCash={() => onNavigate('/caja')} />       : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/cuentas-cobrar"  element={permissions.receivables  ? <ReceivablesManager />  : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/notas-credito"   element={permissions.creditnotes  ? <CreditNotesManager />  : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/retenciones"     element={permissions.withholdings ? <WithholdingsManager /> : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/reportes"        element={permissions.reports      ? <ReportsDashboard />    : <AccessDenied onBack={() => onNavigate('/')} />} />

        {/* Administración / Caja */}
        <Route path="/bancos"       element={permissions.banks       ? <BanksManager />        : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/caja"         element={permissions.cash        ? <CashRegisterManager /> : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/empresa"      element={permissions.company     ? <CompanyManager />      : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/sucursales"   element={permissions.branches    ? <BranchManager />       : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/secuenciales" element={permissions.sequentials ? <SequentialsManager />  : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/usuarios"     element={permissions.users       ? <UserManager />         : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/auditoria"    element={permissions.audit       ? <AuditManager />        : <AccessDenied onBack={() => onNavigate('/')} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

function AccessDenied({ onBack }) {
  return (
    <div className="card shadow-sm border module-panel-card">
      <div className="card-body p-4 text-center">
        <h3 className="text-danger fw-bold mb-2">Acceso Denegado</h3>
        <p className="text-secondary mb-3">No tienes permisos para ver esta sección.</p>
        <button className="btn btn-primary btn-sm" onClick={onBack}>
          Ir al Dashboard
        </button>
      </div>
    </div>
  );
}
