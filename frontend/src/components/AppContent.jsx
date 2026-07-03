import React from 'react';
import ClientManager from '../modules/contacts/clients/ClientManager';
import SupplierManager from '../modules/contacts/suppliers/SupplierManager';
import ProductManager from '../modules/inventory/products/ProductManager';
import CategoryManager from '../modules/inventory/categories/CategoryManager';
import InventoryManager from '../modules/inventory/stock/InventoryManager';
import PurchaseManager from '../modules/inventory/purchases/PurchaseManager';
import ProformaManager from '../modules/documents/proformas/ProformaManager';
import InvoiceManager from '../modules/documents/invoices/InvoiceManager';
import ReceivablesManager from '../modules/documents/receivables/ReceivablesManager';
import CreditNotesManager from '../modules/documents/creditnotes/CreditNotesManager';
import WithholdingsManager from '../modules/documents/withholdings/WithholdingsManager';
import CashRegisterManager from '../modules/administration/cash/CashRegisterManager';
import CompanyManager from '../modules/administration/company/CompanyManager';
import BranchManager from '../modules/administration/branches/BranchManager';
import UserManager from '../modules/administration/users/UserManager';
import AuditManager from '../modules/administration/audit/AuditManager';
import ReportsDashboard from '../modules/reports/ReportsDashboard';

/**
 * AppContent
 * Renderiza el módulo correspondiente al tab activo.
 * Muestra "Acceso Denegado" si el rol no tiene permiso para el tab.
 */
export default function AppContent({
  activeTab,
  permissions,
  currentUser,
  onNavigate,
}) {
  // Acceso denegado si el tab no es dashboard y el rol no tiene permiso
  if (activeTab !== 'dashboard' && !permissions[activeTab]) {
    return (
      <div className="card shadow-sm border module-panel-card">
        <div className="card-body p-4 text-center">
          <h3 className="text-danger fw-bold mb-2">Acceso Denegado</h3>
          <p className="text-secondary mb-3">No tienes permisos para ver esta sección.</p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate('dashboard')}
          >
            Ir al Dashboard
          </button>
        </div>
      </div>
    );
  }

  switch (activeTab) {
    case 'dashboard':
      return (
        <div className="card shadow-sm border module-panel-card">
          <div className="card-body p-4">
            <h1 className="text-dark fw-bold mb-3">
              Bienvenido al sistema, {currentUser?.username}
            </h1>
            <p className="text-secondary mb-4">
              Has iniciado sesión con el rol de{' '}
              <strong>{currentUser?.rol_nombre}</strong>. Usa el menú lateral
              para navegar por las opciones.
            </p>
            <div className="row g-4 mt-2">
              {permissions.clients && (
                <div className="col-md-3">
                  <div
                    className="card dashboard-tile dashboard-tile-primary"
                    onClick={() => onNavigate('clients')}
                  >
                    <h5>Clientes</h5>
                    <p>Registra y administra clientes en la base de datos.</p>
                  </div>
                </div>
              )}
              {permissions.products && (
                <div className="col-md-3">
                  <div
                    className="card dashboard-tile dashboard-tile-success"
                    onClick={() => onNavigate('products')}
                  >
                    <h5>Productos y servicios</h5>
                    <p>Administra inventarios, precios y cálculo automático de IVA.</p>
                  </div>
                </div>
              )}
              {permissions.cash && (
                <div className="col-md-3">
                  <div
                    className="card dashboard-tile dashboard-tile-warning"
                    onClick={() => onNavigate('cash')}
                  >
                    <h5>Caja chica</h5>
                    <p>Abre y cierra turnos de caja para registrar arqueos diarios.</p>
                  </div>
                </div>
              )}
              {permissions.reports && (
                <div className="col-md-3">
                  <div
                    className="card dashboard-tile dashboard-tile-info"
                    onClick={() => onNavigate('reports')}
                  >
                    <h5>Reportes</h5>
                    <p>Consulta ventas, proformas y auditoría reciente.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );

    case 'clients':      return <ClientManager />;
    case 'suppliers':    return <SupplierManager />;
    case 'products':     return <ProductManager />;
    case 'categories':   return <CategoryManager />;
    case 'inventory':    return <InventoryManager />;
    case 'purchases':    return <PurchaseManager />;
    case 'proformas':    return <ProformaManager onInvoiceProforma={() => onNavigate('invoices')} />;
    case 'invoices':     return <InvoiceManager onRedirectToCash={() => onNavigate('cash')} />;
    case 'receivables':  return <ReceivablesManager />;
    case 'creditnotes':  return <CreditNotesManager />;
    case 'withholdings': return <WithholdingsManager />;
    case 'cash':         return <CashRegisterManager />;
    case 'company':      return <CompanyManager />;
    case 'branches':     return <BranchManager />;
    case 'users':        return <UserManager />;
    case 'audit':        return <AuditManager />;
    case 'reports':      return <ReportsDashboard />;
    default:             return <ClientManager />;
  }
}
