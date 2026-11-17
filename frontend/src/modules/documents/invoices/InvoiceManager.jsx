import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../../lib/api';
import InvoiceTable from './components/InvoiceTable';
import InvoiceToolbar from './components/InvoiceToolbar';
import InvoiceRideModal from './components/InvoiceRideModal';
import InvoiceFormModal from './components/InvoiceFormModal';

export default function InvoiceManager({ onRedirectToCash }) {
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewInvoiceId, setViewInvoiceId] = useState(null);
  const [viewInvoiceDetail, setViewInvoiceDetail] = useState(null);
  const [pendingProformaNumber, setPendingProformaNumber] = useState('');

  // Filtros de búsqueda
  const [listQuery, setListQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchInvoices();
    fetchMetadata();
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const handleOpenNewInvoice = useCallback(async () => {
    if (!currentUser) return;
    try {
      const response = await apiFetch(
        `/api/cash-registers/status?id_usuario=${currentUser.id_usuario}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.sessionActive) {
          setShowForm(true);
        } else {
          Swal.fire({
            title: 'Caja Cerrada',
            text: 'Debes iniciar un turno de caja chica antes de poder emitir facturas comerciales.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ir a Caja Chica',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3b82f6',
            cancelButtonColor: '#8a93a2',
            customClass: {
              confirmButton: 'btn btn-primary me-2',
              cancelButton: 'btn btn-secondary',
            },
            buttonsStyling: false,
          }).then((result) => {
            if (result.isConfirmed && onRedirectToCash) onRedirectToCash();
          });
        }
      } else {
        showAlert('No se pudo verificar el estado de caja.', 'error');
      }
    } catch (e) {
      console.error(e);
      showAlert('Error de conexion al verificar caja.', 'error');
    }
  }, [currentUser, onRedirectToCash]);

  // Verificar si hay una proforma pendiente para facturar inmediatamente al entrar
  useEffect(() => {
    if (!currentUser) return;
    const pendingProforma = localStorage.getItem('facturapro-pending-proforma');
    if (!pendingProforma) return;
    localStorage.removeItem('facturapro-pending-proforma');
    setPendingProformaNumber(pendingProforma);
    handleOpenNewInvoice();
  }, [currentUser, handleOpenNewInvoice]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await apiFetch('/api/invoices');
      if (!response.ok) throw new Error('Error al conectar con la base de datos.');
      const result = await response.json();
      // La API devuelve { data: [], total, page, limit, pages }
      setInvoices(Array.isArray(result) ? result : (result.data || []));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [cliRes, prodRes, pmRes] = await Promise.all([
        apiFetch('/api/clients'),
        apiFetch('/api/products'),
        apiFetch('/api/cash-registers/payment-methods'),
      ]);

      if (cliRes.ok) {
        const data = await cliRes.json();
        setClients(data);
      }

      if (prodRes.ok) {
        const data = await prodRes.json();
        setProducts(data.filter((p) => p.activo));
      }

      if (pmRes.ok) {
        const data = await pmRes.json();
        setPaymentMethods(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const showAlert = (message, type = 'success') => {
    const Toast = Swal.mixin({
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3500,
      timerProgressBar: true,
      background: '#ffffff',
      color: '#212529',
      iconColor: type === 'success' ? '#2eb85c' : '#e55353',
      customClass: { popup: 'swal-custom-toast' },
    });
    Toast.fire({ icon: type, title: message });
  };

  const filteredInvoices = useMemo(() => {
    const query = listQuery.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const issuedDate = invoice.fecha_emision ? String(invoice.fecha_emision).slice(0, 10) : '';
      const matchesQuery =
        !query ||
        String(invoice.numero_factura || '').toLowerCase().includes(query) ||
        String(invoice.cliente_nombre || '').toLowerCase().includes(query) ||
        String(invoice.cliente_identificacion || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || invoice.estado === statusFilter;
      const matchesFrom = !dateFromFilter || issuedDate >= dateFromFilter;
      const matchesTo = !dateToFilter || issuedDate <= dateToFilter;
      return matchesQuery && matchesStatus && matchesFrom && matchesTo;
    });
  }, [invoices, listQuery, statusFilter, dateFromFilter, dateToFilter]);


  const handleFetchInvoiceDetail = async (id) => {
    try {
      const response = await apiFetch(`/api/invoices/${id}`);
      if (response.ok) {
        const data = await response.json();
        setViewInvoiceDetail(data);
        setViewInvoiceId(id);
      }
    } catch (error) {
      console.error(error);
      showAlert('No se pudo cargar el detalle de la factura.', 'error');
    }
  };

  const handleSaveInvoice = async (payload, calcInfo) => {
    const { total, paidAmount, balanceAmount, changeAmount } = calcInfo;

    try {
      const confirmResult = await Swal.fire({
        title: 'Confirmar emision',
        html: `
          <div style="text-align:left">
            <p><strong>Total:</strong> $${total.toFixed(2)}</p>
            <p><strong>Pagado + anticipo:</strong> $${paidAmount.toFixed(2)}</p>
            <p><strong>Saldo:</strong> $${balanceAmount.toFixed(2)}</p>
            ${balanceAmount > 0 ? `<p><strong>Credito:</strong> ${payload.dias_credito || 15} dias</p>` : ''}
            <p><strong>Cambio:</strong> $${changeAmount.toFixed(2)}</p>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Emitir factura',
        cancelButtonText: 'Revisar',
        confirmButtonColor: '#198754',
        cancelButtonColor: '#8a93a2',
        customClass: {
          popup: 'swal-custom-popup',
          confirmButton: 'btn btn-primary',
          cancelButton: 'btn btn-secondary',
        },
      });

      if (!confirmResult.isConfirmed) return;

      const response = await apiFetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Ocurrio un error al facturar.');

      showAlert(`Factura ${result.numero_factura} registrada. Envío automático a SRI PRUEBAS pendiente; consulta su estado antes de entregarla.`, 'success');
      setShowForm(false);
      setPendingProformaNumber('');
      fetchInvoices();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  const handleCancelInvoice = async (id, invoiceNum) => {
    const result = await Swal.fire({
      title: 'Anular Factura',
      text: `¿Deseas anular la factura "${invoiceNum}"? Se devolverán los ítems al inventario.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Si, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e55353',
      cancelButtonColor: '#8a93a2',
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary',
      },
    });

    if (!result.isConfirmed) return;

    const reasonResult = await Swal.fire({
      title: 'Motivo de anulacion',
      input: 'text',
      inputPlaceholder: 'Ej: Error en datos del cliente',
      showCancelButton: true,
      confirmButtonText: 'Anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#e55353',
      cancelButtonColor: '#8a93a2',
      inputValidator: (value) => (!String(value || '').trim() ? 'El motivo es obligatorio.' : undefined),
      customClass: {
        popup: 'swal-custom-popup',
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary',
      },
    });

    if (!reasonResult.isConfirmed) return;

    try {
      const response = await apiFetch(`/api/invoices/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: reasonResult.value || '',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo anular la factura.');
      fetchInvoices();
      showAlert('Factura anulada con éxito.', 'success');
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  const handleGenerateSriTestXml = async (id) => {
    try {
      const response = await apiFetch(`/api/sri/invoices/${id}/generate-test-xml`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo generar el XML SRI.');

      await Swal.fire({
        title: 'XML SRI generado',
        html: `
          <div style="text-align:left">
            <p><strong>Ambiente:</strong> ${data.ambiente}</p>
            <p><strong>Estado:</strong> ${data.estado}</p>
            <p style="word-break:break-all"><strong>Clave de acceso:</strong><br>${data.clave_acceso}</p>
          </div>
        `,
        icon: 'success',
        confirmButtonText: 'OK',
        confirmButtonColor: '#198754',
        customClass: {
          popup: 'swal-custom-popup',
          confirmButton: 'btn btn-primary',
        },
      });
      fetchInvoices();
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  const handleProcessSriTest = async (id) => {
    try {
      const response = await apiFetch(`/api/sri/invoices/${id}/process-test`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo procesar la factura en SRI pruebas.');

      const messages = Array.isArray(data.mensajes) && data.mensajes.length > 0
        ? data.mensajes.map((msg) => `<li>${msg.tipo || ''} ${msg.mensaje || ''} ${msg.informacionAdicional || ''}</li>`).join('')
        : '<li>Sin mensajes.</li>';

      await Swal.fire({
        title: 'SRI Pruebas',
        html: `
          <div style="text-align:left">
            <p><strong>Estado:</strong> ${data.estado}</p>
            <p><strong>Ambiente:</strong> ${data.ambiente}</p>
            <p style="word-break:break-all"><strong>Clave:</strong><br>${data.clave_acceso}</p>
            ${data.numero_autorizacion ? `<p style="word-break:break-all"><strong>Autorizacion:</strong><br>${data.numero_autorizacion}</p>` : ''}
            <ul>${messages}</ul>
          </div>
        `,
        icon: data.estado === 'AUTORIZADO' ? 'success' : 'info',
        confirmButtonText: 'OK',
        confirmButtonColor: '#198754',
        customClass: {
          popup: 'swal-custom-popup',
          confirmButton: 'btn btn-primary',
        },
      });
      fetchInvoices();
    } catch (error) {
      showAlert(error.message, 'error');
    }
  };

  const handleEmailSri = async (invoice) => {
    try {
      const historyResponse = await apiFetch(`/api/sri/emails/invoice/${invoice.id_factura}`);
      const history = historyResponse.ok ? await historyResponse.json() : [];
      const historyRows = history.length > 0
        ? history.slice(0, 5).map((item) => `
            <tr>
              <td>${new Date(item.created_at).toLocaleString()}</td>
              <td>${item.destinatario}</td>
              <td>${item.estado}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3">Sin envios previos.</td></tr>';

      const confirm = await Swal.fire({
        title: 'Enviar comprobante por email',
        html: `
          <div class="text-start">
            <p><strong>Factura:</strong> ${invoice.numero_factura}</p>
            <p><strong>Estado SRI:</strong> ${invoice.sri_estado || 'PENDIENTE'}</p>
            <table class="table table-sm">
              <thead><tr><th>Fecha</th><th>Destino</th><th>Estado</th></tr></thead>
              <tbody>${historyRows}</tbody>
            </table>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Enviar ahora',
        cancelButtonText: 'Cerrar',
      });
      if (!confirm.isConfirmed) return;

      const response = await apiFetch(`/api/sri/emails/invoice/${invoice.id_factura}/send`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.history?.mensaje_error || 'No se pudo enviar el email.');
      Swal.fire('Email enviado', `Comprobante enviado a ${data.history.destinatario}.`, 'success');
    } catch (error) {
      Swal.fire('Email SRI', error.message, 'error');
    }
  };

  const handleClearFilters = () => {
    setListQuery('');
    setStatusFilter('ALL');
    setDateFromFilter('');
    setDateToFilter('');
  };

  return (
    <div className="module-shell">
      {/* Header */}
      <div className="view-header module-header-card d-flex align-items-center justify-content-between">
        <div>
          <h1 className="h2 mb-1 text-dark" style={{ fontWeight: '800' }}>
            Facturas
          </h1>
          <p className="text-secondary mb-0" style={{ fontSize: '0.92rem' }}>
            Emite comprobantes de venta comerciales.
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="count-badge-pill">
            {filteredInvoices.length}{' '}
            {filteredInvoices.length === 1 ? 'registro' : 'registros'}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => (showForm ? setShowForm(false) : handleOpenNewInvoice())}
          >
            {showForm ? 'Ver facturas' : '+ Nueva factura'}
          </button>
        </div>
      </div>

      {showForm ? (
        <InvoiceFormModal
          clients={clients}
          products={products}
          paymentMethods={paymentMethods}
          currentUser={currentUser}
          initialProformaNumber={pendingProformaNumber}
          onSave={handleSaveInvoice}
          onClose={() => {
            setShowForm(false);
            setPendingProformaNumber('');
          }}
        />
      ) : (
        <>
          <InvoiceToolbar
            listQuery={listQuery}
            setListQuery={setListQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            dateFromFilter={dateFromFilter}
            setDateFromFilter={setDateFromFilter}
            dateToFilter={dateToFilter}
            setDateToFilter={setDateToFilter}
            onClear={handleClearFilters}
          />
          {loading ? (
            <div className="text-center py-4">Cargando facturas...</div>
          ) : (
            <InvoiceTable
              invoices={filteredInvoices}
              onViewRide={handleFetchInvoiceDetail}
              onCancel={handleCancelInvoice}
              onGenerateSriTestXml={handleGenerateSriTestXml}
              onProcessSriTest={handleProcessSriTest}
              onEmailSri={handleEmailSri}
            />
          )}
        </>
      )}

      {viewInvoiceId && viewInvoiceDetail && (
        <InvoiceRideModal
          viewInvoice={viewInvoiceDetail}
          onClose={() => {
            setViewInvoiceId(null);
            setViewInvoiceDetail(null);
          }}
        />
      )}
    </div>
  );
}
