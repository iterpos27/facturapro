import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

const TYPES = { '01': 'Factura', '04': 'Nota de crédito', '07': 'Retención' };
const STATES = ['GENERADO', 'FIRMADO', 'PENDIENTE_ENVIO', 'ENVIANDO', 'RECIBIDO', 'EN_PROCESO', 'AUTORIZADO', 'DEVUELTO', 'NO_AUTORIZADO', 'ERROR'];
const initialFilters = { estado: '', tipo: '', ambiente: '', desde: '', hasta: '' };

/** Panel de seguimiento: consulta estados sin emitir documentos ni reenviar XML. */
export default function SriMonitor({ canProcess }) {
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ records: [], counts: [], total: 0, pageSize: 25 });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [key, setKey] = useState('');
  const [consult, setConsult] = useState(null);
  const [revision, setRevision] = useState(0);

  // Cada cambio cancela la lectura anterior para impedir que filtros viejos sobrescriban datos nuevos.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ ...filters, page });
    apiFetch(`/api/sri/monitor?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudo cargar el panel.');
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, page, revision]);

  const reload = useCallback(() => setRevision((value) => value + 1), []);

  /** Cambiar un filtro reinicia la paginación para no mostrar una página inexistente. */
  function changeFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  /** Guarda únicamente la respuesta de autorización; el servidor sincroniza los dos registros. */
  async function refresh(record) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await apiFetch(`/api/sri/monitor/${record.id_sri}/refresh`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(`${record.numero_comprobante}: ${result.estado}.`);
      reload();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  /** Consulta una clave independiente sin alterar los comprobantes locales. */
  async function consultKey(event) {
    event.preventDefault();
    setBusy(true); setError(''); setConsult(null);
    try {
      const response = await apiFetch(`/api/sri/consult/${key}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setConsult(result);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const counts = Object.fromEntries(data.counts.map((item) => [item.estado, item.cantidad]));
  return <div className="py-3">
    <div className="d-flex justify-content-between align-items-center mb-3">
      <div><h2>Control SRI</h2><p className="text-secondary mb-0">Facturas, notas de crédito y retenciones electrónicas.</p></div>
      <button className="btn btn-outline-primary" disabled={loading || busy} onClick={reload}>Actualizar panel</button>
    </div>
    <div className="alert alert-info">La transmisión requiere fecha de emisión de hoy en Ecuador. Puedes consultar autorizaciones de fechas anteriores sin volver a enviar el comprobante.</div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <div className="card mb-3"><div className="card-body">
      <h3 className="h5">Consultar por clave de acceso</h3>
      <form className="d-flex gap-2 flex-wrap" onSubmit={consultKey}>
        <input className="form-control flex-grow-1" style={{ maxWidth: 620 }} aria-label="Clave de acceso" placeholder="49 dígitos" inputMode="numeric" pattern="[0-9]{49}" maxLength={49} required value={key} onChange={(event) => setKey(event.target.value.replace(/\D/g, '').slice(0, 49))} />
        <button className="btn btn-primary" disabled={busy}>Consultar SRI</button>
      </form>
      <small className="text-secondary">Consulta de solo lectura. El ambiente se identifica a partir de la clave.</small>
      {consult && <div className="border rounded p-3 mt-3" role="status">
        <strong>{consult.estado}</strong> · {consult.ambiente}
        <div className="text-break">Clave: {consult.clave_acceso}</div>
        {consult.numero_autorizacion && <div className="text-break">Autorización: {consult.numero_autorizacion}</div>}
        {(consult.mensajes || []).map((message, index) => <p className="mb-0" key={index}>{message.mensaje} {message.informacionAdicional}</p>)}
      </div>}
    </div></div>
    <div className="row g-2 mb-3">
      {[
        ['Total filtrado', data.total], ['Autorizados', counts.AUTORIZADO || 0],
        ['Por autorizar', (counts.RECIBIDO || 0) + (counts.EN_PROCESO || 0)],
        ['Por enviar', (counts.GENERADO || 0) + (counts.FIRMADO || 0) + (counts.PENDIENTE_ENVIO || 0)],
        ['Revisar', (counts.ENVIANDO || 0) + (counts.DEVUELTO || 0) + (counts.NO_AUTORIZADO || 0) + (counts.ERROR || 0)],
      ].map(([label, count]) => <div className="col" key={label}><div className="card h-100"><div className="card-body"><div className="text-secondary">{label}</div><strong className="fs-3">{loading ? '…' : count}</strong></div></div></div>)}
    </div>
    <div className="card"><div className="card-body">
      <div className="row g-2 mb-3">
        {[
          ['estado', 'Estado', STATES.map((value) => [value, value])],
          ['tipo', 'Tipo', Object.entries(TYPES)],
          ['ambiente', 'Ambiente', [['PRUEBAS', 'Pruebas'], ['PRODUCCION', 'Producción']]],
        ].map(([name, label, options]) => <div className="col-md" key={name}><label className="form-label" htmlFor={`sri-${name}`}>{label}</label><select id={`sri-${name}`} className="form-select" value={filters[name]} onChange={(event) => changeFilter(name, event.target.value)}><option value="">Todos</option>{options.map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></div>)}
        {['desde', 'hasta'].map((name) => <div className="col-md" key={name}><label className="form-label" htmlFor={`sri-${name}`}>{name === 'desde' ? 'Registrado desde' : 'Registrado hasta'}</label><input id={`sri-${name}`} className="form-control" type="date" value={filters[name]} onChange={(event) => changeFilter(name, event.target.value)} /></div>)}
      </div>
      <div className="table-responsive" aria-busy={loading}>
        <table className="table align-middle"><thead><tr><th>Comprobante</th><th>Ambiente</th><th>Estado</th><th>Última actualización</th><th>Acciones</th></tr></thead>
          <tbody>{!loading && data.records.map((record) => <tr key={record.id_sri}>
            <td><strong>{TYPES[record.tipo_comprobante] || record.tipo_comprobante}</strong><div>{record.numero_comprobante}</div><small className="text-break">{record.clave_acceso}</small></td>
            <td>{record.ambiente}</td><td><span className={`badge ${record.estado === 'AUTORIZADO' ? 'bg-success' : record.estado === 'ENVIANDO' ? 'bg-danger' : ['RECIBIDO', 'EN_PROCESO', 'PENDIENTE_ENVIO'].includes(record.estado) ? 'bg-warning text-dark' : 'bg-secondary'}`}>{record.estado}</span></td>
            <td>{new Date(record.updated_at).toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}</td>
            <td>{canProcess && record.estado !== 'AUTORIZADO' && <button className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => refresh(record)}>Reconsultar estado</button>}
              {Array.isArray(record.mensajes) && record.mensajes.length > 0 && <details><summary>Mensajes SRI</summary>{record.mensajes.map((message, index) => <p key={index}>{message.mensaje} {message.informacionAdicional}</p>)}</details>}</td>
          </tr>)}{(loading || !data.records.length) && <tr><td colSpan={5}>{loading ? 'Cargando comprobantes…' : 'No hay comprobantes con estos filtros.'}</td></tr>}</tbody>
        </table>
      </div>
      <div className="d-flex gap-3 align-items-center justify-content-end"><button className="btn btn-outline-secondary" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page} de {Math.max(1, Math.ceil(data.total / data.pageSize))}</span><button className="btn btn-outline-secondary" disabled={loading || page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Siguiente</button></div>
    </div></div>
  </div>;
}
