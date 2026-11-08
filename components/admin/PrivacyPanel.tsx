'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {RefreshCw, ShieldCheck, UserRoundMinus} from 'lucide-react';
import {AdminSession, formatDate, PortalError} from '@/lib/admin-api';
import {parseAdminPrivacyList, parseAdminPrivacyRequest, privacyBlockerDescription, type AdminPrivacyRequest} from '@/lib/admin-privacy';
import {privacyStatusLabels} from '@/lib/account-privacy';
import {Dialog, DialogContent, DialogDescription, DialogTitle} from '../ui/dialog';

export function PrivacyPanel({session, onError, theme, onPendingChange}: {
  session: AdminSession; onError: (error: unknown) => void; theme: string; onPendingChange: (pending: boolean) => void;
}) {
  const [rows, setRows] = useState<AdminPrivacyRequest[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<AdminPrivacyRequest>();
  const [confirmation, setConfirmation] = useState('');
  const [uncertainId, setUncertainId] = useState<string>();
  const uncertainRequest = useRef<string | undefined>(undefined);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const readGeneration = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; readGeneration.current++; }; }, []);
  useEffect(() => { onPendingChange(writing || !!uncertainId); return () => onPendingChange(false); }, [writing, uncertainId, onPendingChange]);
  const report = useCallback((e: unknown) => {
    if (e instanceof PortalError && (e.status === 401 || ['ADMIN_MFA_REQUIRED','ADMIN_EMAIL_VERIFICATION_REQUIRED','ADMIN_ROLE_REQUIRED'].includes(e.code))) onError(e);
    if (mounted.current) setError(e instanceof Error ? e.message : 'The request could not be completed. Please refresh.');
  }, [onError]);
  const refresh = useCallback(async () => {
    const generation = ++readGeneration.current; setLoading(true); setError('');
    try {
      const next = parseAdminPrivacyList(await session.privacyRequest('list', {limit:50, offset}));
      const uncertain = uncertainRequest.current;
      let recovered: AdminPrivacyRequest | undefined;
      if (uncertain) {
        const response = await session.privacyRequest<{ok: boolean; request: unknown}>('detail', {request_id: uncertain});
        recovered = parseAdminPrivacyRequest(response.request);
        if (!response.ok || recovered.request_id !== uncertain) throw new Error('The deletion outcome is still unconfirmed. Please refresh again.');
      }
      if (!mounted.current || generation !== readGeneration.current) return;
      setRows(next.map(row => recovered?.request_id === row.request_id ? recovered : row));
      if (recovered) { uncertainRequest.current = undefined; setUncertainId(undefined); }
      if (recovered?.status === 'completed') setNotice(`Deletion completed for ${recovered.reference}.`);
      setSelected(current => {
        const updated = current ? (recovered?.request_id === current.request_id ? recovered : next.find(row => row.request_id === current.request_id)) : undefined;
        return updated?.status === 'completed' ? undefined : updated;
      });
    } catch (e) { if (mounted.current && generation === readGeneration.current) report(e); }
    finally { if (mounted.current && generation === readGeneration.current) setLoading(false); }
  }, [offset, report, session]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function processRequest() {
    if (!selected || selected.status === 'completed' || confirmation !== selected.reference || submitting.current || uncertainId) return;
    submitting.current = true; setWriting(true); setError(''); setNotice('');
    try {
      const response = await session.privacyRequest<{ok: boolean; request: unknown}>('process', {request_id:selected.request_id});
      const result = parseAdminPrivacyRequest(response.request);
      if (response.ok !== true || result.request_id !== selected.request_id) throw new PortalError('The outcome could not be confirmed. Refresh the request before retrying.', 0, 'PRIVACY_UNCONFIRMED', true);
      if (!mounted.current) return;
      setRows(values => values.map(row => row.request_id === result.request_id ? result : row));
      setSelected(undefined); setConfirmation('');
      setNotice(result.status === 'completed' ? `Deletion completed for ${result.reference}.` : result.status === 'review_required' ? `Request ${result.reference} needs review. The account has not been confirmed deleted.` : `Request ${result.reference} is still processing. Refresh to check its status.`);
    } catch (e) {
      if (!mounted.current) return;
      // Network failures can occur after irreversible work. Never retry the
      // operation automatically or display an unverified completion message.
      uncertainRequest.current = selected.request_id; setUncertainId(selected.request_id); report(e);
    } finally { submitting.current = false; if (mounted.current) setWriting(false); }
  }
  return <section className="privacy-ops">
    <div className="ops-page-heading"><div><h1>Account deletion</h1><p>Verified requests from Kaylo, Kaylo Partner and the website.</p></div><button className="ops-button" disabled={loading || writing} onClick={()=>void refresh()}><RefreshCw size={15} aria-hidden="true"/>Refresh status</button></div>
    <div className="finance-access"><ShieldCheck size={17} aria-hidden="true"/>Administrator access with authenticator verification</div>
    {error && <div className="ops-alert" role="alert">{error}</div>}
    {notice && <div className="ops-notice" role="status">{notice}</div>}
    {uncertainId && <p className="ops-alert" role="status">The last deletion action has an unconfirmed outcome. Refresh its status before trying again.</p>}
    {loading && <p role="status" className="ops-muted">Loading current requests…</p>}
    <div className="ops-table-wrap" aria-busy={loading}><table className="ops-table"><thead><tr><th>Request</th><th>Account</th><th>Status</th><th>Review</th><th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.request_id}><td><strong>{row.reference}</strong><small>{formatDate(row.requested_at)}</small></td><td>{row.email || 'Account details removed'}<small>{row.account_type === 'partner' ? 'Kaylo Partner' : 'Kaylo Customer'}</small></td><td><span className="finance-state">{privacyStatusLabels[row.status]}</span>{row.completed_at && <small>{formatDate(row.completed_at)}</small>}</td><td>{row.blockers.length ? <ul className="privacy-ops-blockers">{row.blockers.map((code,index)=><li key={`${code}-${index}`}>{privacyBlockerDescription(code)}</li>)}</ul> : row.last_error ? 'A cleanup step needs another attempt.' : 'No outstanding blocker reported.'}</td><td>{row.status !== 'completed' ? <button className="ops-button" disabled={loading || writing || !!uncertainId || !!error} onClick={()=>{setSelected(row);setConfirmation('');setError('');}}>Process deletion</button> : <span className="ops-muted">Completed</span>}</td></tr>)}</tbody></table>
    {!loading && !error && rows.length === 0 && <div className="ops-empty"><UserRoundMinus size={28} aria-hidden="true"/><h2>No requests on this page</h2><p>Verified account-deletion requests appear here.</p></div>}</div>
    <div className="ops-pagination"><span>Page {offset / 50 + 1}</span><div><button className="ops-button" disabled={loading || writing || !!uncertainId || offset === 0} onClick={()=>setOffset(value=>Math.max(0,value-50))}>Previous</button><button className="ops-button" disabled={loading || writing || !!uncertainId || rows.length < 50} onClick={()=>setOffset(value=>value+50)}>Next</button></div></div>
    <Dialog open={!!selected} onOpenChange={open=>{if (!open && !writing && !uncertainId) {setSelected(undefined);setConfirmation('');}}}><DialogContent className="ops privacy-ops-dialog" data-theme={theme} onEscapeKeyDown={event=>{if(writing || uncertainId) event.preventDefault();}} onPointerDownOutside={event=>{if(writing || uncertainId) event.preventDefault();}}>
      <DialogTitle>Process account deletion?</DialogTitle><DialogDescription>For request {selected?.reference}. This attempts removal of eligible account data and sign-in access. The server rechecks bookings and money obligations first. Removed information cannot be restored through this portal.</DialogDescription>
      {selected?.blockers.length ? <p className="ops-alert">This request currently has obligations to review. Processing rechecks those obligations; it does not override them.</p> : null}
      <label htmlFor="privacy-admin-confirm">Type <strong>{selected?.reference}</strong> to confirm</label><input id="privacy-admin-confirm" value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} disabled={writing || !!uncertainId}/>
      {uncertainId && <p role="status" className="ops-alert">Outcome unconfirmed. Refresh the current status before retrying.</p>}
      {error && <p role="alert" className="ops-alert">{error}</p>}
      <div className="privacy-ops-actions"><button className="ops-button" disabled={writing || !!uncertainId} onClick={()=>setSelected(undefined)}>Cancel</button>{uncertainId ? <button className="ops-button" disabled={writing || loading} onClick={()=>void refresh()}>Refresh status</button> : <button className="ops-button danger" disabled={writing || loading || !selected || confirmation !== selected.reference} onClick={()=>void processRequest()}>{writing ? 'Processing…' : 'Process deletion'}</button>}</div>
    </DialogContent></Dialog>
  </section>;
}
