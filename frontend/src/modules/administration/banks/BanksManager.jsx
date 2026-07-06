import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { showToast } from '../../../lib/toast';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

export default function BanksManager() {
  const [accounts, setAccounts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [reconciliations, setReconciliations] = useState([]);
  const [accountForm, setAccountForm] = useState({ banco: '', numero_cuenta: '', tipo_cuenta: 'CORRIENTE', titular: '', saldo_inicial: 0 });
  const [depositForm, setDepositForm] = useState({ id_cuenta: '', id_sesion: '', fecha_deposito: new Date().toISOString().slice(0, 10), monto: '', referencia: '', observacion: '' });
  const [reconcileForm, setReconcileForm] = useState({ id_cuenta: '', fecha_desde: new Date().toISOString().slice(0, 10), fecha_hasta: new Date().toISOString().slice(0, 10), saldo_banco: '', observacion: '' });
  const [loading, setLoading] = useState(false);

  const activeAccount = useMemo(
    () => accounts.find((account) => String(account.id_cuenta) === String(reconcileForm.id_cuenta)),
    [accounts, reconcileForm.id_cuenta]
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [accRes, depRes, recRes] = await Promise.all([
        apiFetch('/api/banks/accounts'),
        apiFetch('/api/banks/deposits'),
        apiFetch('/api/banks/reconciliations'),
      ]);
      setAccounts(accRes.ok ? await accRes.json() : []);
      setDeposits(depRes.ok ? await depRes.json() : []);
      setReconciliations(recRes.ok ? await recRes.json() : []);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const saveAccount = async (event) => {
    event.preventDefault();
    const response = await apiFetch('/api/banks/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accountForm),
    });
    const data = await response.json();
    if (!response.ok) return showToast(data.error || 'No se pudo crear la cuenta.', 'error');
    showToast('Cuenta bancaria creada.', 'success');
    setAccountForm({ banco: '', numero_cuenta: '', tipo_cuenta: 'CORRIENTE', titular: '', saldo_inicial: 0 });
    loadData();
  };

  const saveDeposit = async (event) => {
    event.preventDefault();
    const response = await apiFetch('/api/banks/deposits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(depositForm),
    });
    const data = await response.json();
    if (!response.ok) return showToast(data.error || 'No se pudo registrar deposito.', 'error');
    showToast('Deposito registrado.', 'success');
    setDepositForm((current) => ({ ...current, monto: '', referencia: '', observacion: '' }));
    loadData();
  };

  const reconcileDeposit = async (deposit) => {
    const response = await apiFetch(`/api/banks/deposits/${deposit.id_deposito}/reconcile`, { method: 'PUT' });
    const data = await response.json();
    if (!response.ok) return showToast(data.error || 'No se pudo conciliar.', 'error');
    showToast('Deposito conciliado.', 'success');
    loadData();
  };

  const saveReconciliation = async (event) => {
    event.preventDefault();
    const response = await apiFetch('/api/banks/reconciliations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reconcileForm),
    });
    const data = await response.json();
    if (!response.ok) return showToast(data.error || 'No se pudo registrar conciliacion.', 'error');
    showToast('Conciliacion registrada.', 'success');
    setReconcileForm((current) => ({ ...current, saldo_banco: '', observacion: '' }));
    loadData();
  };

  return (
    <div className="module-shell">
      <div className="view-header module-header-card">
        <div className="module-header-copy">
          <h1>Bancos y Conciliacion</h1>
          <p>Control de cuentas bancarias, depositos de caja y conciliaciones.</p>
        </div>
        <button className="btn btn-secondary" onClick={loadData} disabled={loading}>Actualizar</button>
      </div>

      <div className="row g-3">
        <div className="col-lg-4">
          <form className="client-data-panel h-100" onSubmit={saveAccount}>
            <h5 className="fw-bold mb-3">Cuenta bancaria</h5>
            <Input label="Banco" value={accountForm.banco} onChange={(v) => setAccountForm({ ...accountForm, banco: v })} required />
            <Input label="Numero cuenta" value={accountForm.numero_cuenta} onChange={(v) => setAccountForm({ ...accountForm, numero_cuenta: v })} required />
            <Input label="Titular" value={accountForm.titular} onChange={(v) => setAccountForm({ ...accountForm, titular: v })} />
            <Input label="Saldo inicial" type="number" value={accountForm.saldo_inicial} onChange={(v) => setAccountForm({ ...accountForm, saldo_inicial: v })} />
            <button className="btn btn-primary w-100" type="submit">Guardar cuenta</button>
          </form>
        </div>

        <div className="col-lg-4">
          <form className="client-data-panel h-100" onSubmit={saveDeposit}>
            <h5 className="fw-bold mb-3">Deposito</h5>
            <Select label="Cuenta" value={depositForm.id_cuenta} onChange={(v) => setDepositForm({ ...depositForm, id_cuenta: v })} options={accounts.map((a) => ({ value: a.id_cuenta, label: `${a.banco} ${a.numero_cuenta}` }))} required />
            <Input label="Fecha" type="date" value={depositForm.fecha_deposito} onChange={(v) => setDepositForm({ ...depositForm, fecha_deposito: v })} />
            <Input label="Monto" type="number" value={depositForm.monto} onChange={(v) => setDepositForm({ ...depositForm, monto: v })} required />
            <Input label="Referencia" value={depositForm.referencia} onChange={(v) => setDepositForm({ ...depositForm, referencia: v })} />
            <button className="btn btn-success w-100" type="submit">Registrar deposito</button>
          </form>
        </div>

        <div className="col-lg-4">
          <form className="client-data-panel h-100" onSubmit={saveReconciliation}>
            <h5 className="fw-bold mb-3">Conciliacion</h5>
            <Select label="Cuenta" value={reconcileForm.id_cuenta} onChange={(v) => setReconcileForm({ ...reconcileForm, id_cuenta: v })} options={accounts.map((a) => ({ value: a.id_cuenta, label: `${a.banco} ${a.numero_cuenta}` }))} required />
            <div className="row g-2">
              <div className="col-6"><Input label="Desde" type="date" value={reconcileForm.fecha_desde} onChange={(v) => setReconcileForm({ ...reconcileForm, fecha_desde: v })} /></div>
              <div className="col-6"><Input label="Hasta" type="date" value={reconcileForm.fecha_hasta} onChange={(v) => setReconcileForm({ ...reconcileForm, fecha_hasta: v })} /></div>
            </div>
            <Input label="Saldo banco" type="number" value={reconcileForm.saldo_banco} onChange={(v) => setReconcileForm({ ...reconcileForm, saldo_banco: v })} required />
            {activeAccount && <small className="text-muted d-block mb-2">Depositado sistema: {money(activeAccount.depositado)}</small>}
            <button className="btn btn-primary w-100" type="submit">Guardar conciliacion</button>
          </form>
        </div>
      </div>

      <div className="client-data-panel mt-3">
        <h5 className="fw-bold mb-3">Depositos registrados</h5>
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle">
            <thead><tr><th>Fecha</th><th>Cuenta</th><th>Referencia</th><th className="text-end">Monto</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {deposits.map((deposit) => (
                <tr key={deposit.id_deposito}>
                  <td>{String(deposit.fecha_deposito).slice(0, 10)}</td>
                  <td>{deposit.banco} {deposit.numero_cuenta}</td>
                  <td>{deposit.referencia || '-'}</td>
                  <td className="text-end fw-bold">{money(deposit.monto)}</td>
                  <td><span className={`badge ${deposit.estado === 'CONCILIADO' ? 'bg-success' : 'bg-secondary'}`}>{deposit.estado}</span></td>
                  <td className="text-end">{deposit.estado !== 'CONCILIADO' && <button className="btn btn-sm btn-outline-success" onClick={() => reconcileDeposit(deposit)}>Conciliar</button>}</td>
                </tr>
              ))}
              {deposits.length === 0 && <tr><td colSpan="6" className="text-center text-muted py-3">Sin depositos registrados.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="client-data-panel mt-3">
        <h5 className="fw-bold mb-3">Historial de conciliaciones</h5>
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle">
            <thead><tr><th>Cuenta</th><th>Periodo</th><th className="text-end">Banco</th><th className="text-end">Sistema</th><th className="text-end">Diferencia</th><th>Estado</th></tr></thead>
            <tbody>
              {reconciliations.map((row) => (
                <tr key={row.id_conciliacion}>
                  <td>{row.banco} {row.numero_cuenta}</td>
                  <td>{String(row.fecha_desde).slice(0, 10)} al {String(row.fecha_hasta).slice(0, 10)}</td>
                  <td className="text-end">{money(row.saldo_banco)}</td>
                  <td className="text-end">{money(row.saldo_sistema)}</td>
                  <td className="text-end fw-bold">{money(row.diferencia)}</td>
                  <td><span className={`badge ${row.estado === 'CUADRADA' ? 'bg-success' : 'bg-warning text-dark'}`}>{row.estado}</span></td>
                </tr>
              ))}
              {reconciliations.length === 0 && <tr><td colSpan="6" className="text-center text-muted py-3">Sin conciliaciones registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Input({ label, type = 'text', value, onChange, required = false }) {
  return (
    <div className="mb-2">
      <label className="form-label small fw-semibold">{label}</label>
      <input className="form-control form-control-sm" type={type} step={type === 'number' ? '0.01' : undefined} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  );
}

function Select({ label, value, onChange, options, required = false }) {
  return (
    <div className="mb-2">
      <label className="form-label small fw-semibold">{label}</label>
      <select className="form-select form-select-sm" value={value} onChange={(event) => onChange(event.target.value)} required={required}>
        <option value="">Seleccione</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
