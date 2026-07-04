import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Code splitting: cada módulo se carga solo cuando se navega a él
const ClientManager      = lazy(() => import('../modules/contacts/clients/ClientManager'));
const SupplierManager    = lazy(() => import('../modules/contacts/suppliers/SupplierManager'));
const ProductManager     = lazy(() => import('../modules/inventory/products/ProductManager'));
const CategoryManager    = lazy(() => import('../modules/inventory/categories/CategoryManager'));
const InventoryManager   = lazy(() => import('../modules/inventory/stock/InventoryManager'));
const PurchaseManager    = lazy(() => import('../modules/inventory/purchases/PurchaseManager'));
const ProformaManager    = lazy(() => import('../modules/documents/proformas/ProformaManager'));
const InvoiceManager     = lazy(() => import('../modules/documents/invoices/InvoiceManager'));
const ReceivablesManager = lazy(() => import('../modules/documents/receivables/ReceivablesManager'));
const CreditNotesManager = lazy(() => import('../modules/documents/creditnotes/CreditNotesManager'));
const WithholdingsManager= lazy(() => import('../modules/documents/withholdings/WithholdingsManager'));
const CashRegisterManager= lazy(() => import('../modules/administration/cash/CashRegisterManager'));
const CompanyManager     = lazy(() => import('../modules/administration/company/CompanyManager'));
const BranchManager      = lazy(() => import('../modules/administration/branches/BranchManager'));
const UserManager        = lazy(() => import('../modules/administration/users/UserManager'));
const AuditManager       = lazy(() => import('../modules/administration/audit/AuditManager'));
const ReportsDashboard   = lazy(() => import('../modules/reports/ReportsDashboard'));

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
  return (
    <Suspense fallback={<ModuleLoader />}>
      <Routes>
        {/* Dashboard */}
        <Route
          path="/"
          element={
            <div className="card shadow-sm border module-panel-card">
              <div className="card-body p-4">
                <h1 className="text-dark fw-bold mb-3">
                  Bienvenido al sistema, {currentUser?.username}
                </h1>
                <p className="text-secondary mb-4">
                  Has iniciado sesión con el rol de{' '}
                  <strong>{currentUser?.rol_nombre}</strong>. Usa el menú
                  lateral para navegar por las opciones.
                </p>
                <div className="row g-4 mt-2">
                  {permissions.clients && (
                    <div className="col-md-3">
                      <div className="card dashboard-tile dashboard-tile-primary" onClick={() => onNavigate('/clientes')}>
                        <h5>Clientes</h5>
                        <p>Registra y administra clientes en la base de datos.</p>
                      </div>
                    </div>
                  )}
                  {permissions.products && (
                    <div className="col-md-3">
                      <div className="card dashboard-tile dashboard-tile-success" onClick={() => onNavigate('/productos')}>
                        <h5>Productos y servicios</h5>
                        <p>Administra inventarios, precios y cálculo automático de IVA.</p>
                      </div>
                    </div>
                  )}
                  {permissions.cash && (
                    <div className="col-md-3">
                      <div className="card dashboard-tile dashboard-tile-warning" onClick={() => onNavigate('/caja')}>
                        <h5>Caja chica</h5>
                        <p>Abre y cierra turnos de caja para registrar arqueos diarios.</p>
                      </div>
                    </div>
                  )}
                  {permissions.reports && (
                    <div className="col-md-3">
                      <div className="card dashboard-tile dashboard-tile-info" onClick={() => onNavigate('/reportes')}>
                        <h5>Reportes</h5>
                        <p>Consulta ventas, proformas y auditoría reciente.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          }
        />

        {/* Contactos */}
        <Route path="/clientes"    element={permissions.clients    ? <ClientManager />   : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/proveedores" element={permissions.suppliers  ? <SupplierManager /> : <AccessDenied onBack={() => onNavigate('/')} />} />

        {/* Inventario */}
        <Route path="/productos"   element={permissions.products   ? <ProductManager />  : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/categorias"  element={permissions.categories ? <CategoryManager /> : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/inventario"  element={permissions.inventory  ? <InventoryManager />: <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/compras"     element={permissions.purchases  ? <PurchaseManager /> : <AccessDenied onBack={() => onNavigate('/')} />} />

        {/* Documentos */}
        <Route path="/proformas"       element={permissions.proformas    ? <ProformaManager onInvoiceProforma={() => onNavigate('/facturas')} /> : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/facturas"        element={permissions.invoices     ? <InvoiceManager onRedirectToCash={() => onNavigate('/caja')} />       : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/cuentas-cobrar"  element={permissions.receivables  ? <ReceivablesManager />  : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/notas-credito"   element={permissions.creditnotes  ? <CreditNotesManager />  : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/retenciones"     element={permissions.withholdings ? <WithholdingsManager /> : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/reportes"        element={permissions.reports      ? <ReportsDashboard />    : <AccessDenied onBack={() => onNavigate('/')} />} />

        {/* Administración / Caja */}
        <Route path="/caja"       element={permissions.cash     ? <CashRegisterManager /> : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/empresa"    element={permissions.company  ? <CompanyManager />      : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/sucursales" element={permissions.branches ? <BranchManager />       : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/usuarios"   element={permissions.users    ? <UserManager />         : <AccessDenied onBack={() => onNavigate('/')} />} />
        <Route path="/auditoria"  element={permissions.audit    ? <AuditManager />        : <AccessDenied onBack={() => onNavigate('/')} />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
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
