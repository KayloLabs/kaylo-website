'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { AdminSession, formatDate, PortalError } from '../../lib/admin-api';
import { financeWriteBody, formatMoney, readableState, reconciliationKindLabel, readFinanceCommand, type FinanceCommand, type FinanceDetail, type FinanceList, type ReconciliationReport } from '../../lib/finance';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';

const emptyList: FinanceList = { items: [], next_after: null };
function Status({ value }: { value?: string | null }) {
  return <span className="finance-state">{readableState(value)}</span>;
}
function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed. Please refresh.';
}

export function FinancePanel({ session, onError, theme, onPendingChange }: { session: AdminSession; onError: (error: unknown) => void; theme: string; onPendingChange: (pending: boolean) => void }) {
  const [view, setView] = useState<'bookings' | 'reconciliation'>('bookings');
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [list, setList] = useState<FinanceList>(emptyList);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<FinanceDetail | null>(null);
  const [date, setDate] = useState('');
  const [offset, setOffset] = useState(0);
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [command, setCommand] = useState<FinanceCommand | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [readBack, setReadBack] = useState(false);
  const [confirmationError, setConfirmationError] = useState('');
  const [latestCommandReport, setLatestCommandReport] = useState<ReconciliationReport | null>(null);
  useEffect(() => { onPendingChange(writing || uncertain); return () => onPendingChange(false); }, [writing, uncertain, onPendingChange]);
  const mounted = useRef(true);
  const submitting = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const handleError = useCallback((e: unknown) => {
    if (e instanceof PortalError && (e.status === 401 || ['ADMIN_MFA_REQUIRED', 'ADMIN_EMAIL_VERIFICATION_REQUIRED', 'ADMIN_ROLE_REQUIRED'].includes(e.code))) onError(e);
    if (mounted.current) setError(errorMessage(e));
  }, [onError]);
  const cursor = cursors[cursors.length - 1];
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    const work = view === 'reconciliation'
      ? session.financeRequest<{ result: ReconciliationReport | null }>('reconciliation', { ...(date ? { report_date: date } : {}), offset }).then(value => { if (current) setReport(value.result); })
      : selected
      ? session.financeRequest<FinanceDetail>('detail', { booking_id: selected }).then(value => { if (current) setDetail(value); })
      : session.financeRequest<FinanceList>('list', { state: filter, limit: 20, ...(cursor ? { after_booking_id: cursor } : {}) }).then(value => { if (current) setList(value); });
    work.catch(e => { if (current) handleError(e); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [session, view, selected, filter, cursor, date, offset, refresh, handleError]);

  function prepare(input: Omit<FinanceCommand, 'requestId' | 'note'>) {
    if (uncertain || submitting.current) return;
    setCommand({ ...input, ...(!input.bookingId && report ? { reportDate: report.run.report_date, reportOffset: offset } : {}), requestId: crypto.randomUUID(), note: '' });
    setLatestCommandReport(null);
    setUncertain(false); setReadBack(false); setConfirmationError(''); setConfirmOpen(true);
  }
  async function checkLatest(pending: FinanceCommand) {
    const latest = await readFinanceCommand(session, pending);
    if (!mounted.current) return;
    if (latest.kind === 'booking') setDetail(latest.detail);
    else setLatestCommandReport(latest.report);
    setReadBack(true);
  }
  async function retryRead() {
    if (!command || submitting.current) return;
    submitting.current = true; setWriting(true);
    try { await checkLatest(command); setConfirmationError('Latest status loaded. Review it before retrying the same request.'); }
    catch (e) { if (mounted.current) { setConfirmationError(errorMessage(e)); handleError(e); } }
    finally { submitting.current = false; if (mounted.current) setWriting(false); }
  }
  async function confirm() {
    if (!command || submitting.current || (uncertain && !readBack)) return;
    submitting.current = true; setWriting(true); setConfirmationError('');
    try {
      const response = await session.financeRequest<{ result: unknown }>(command.action, financeWriteBody(command));
      if (!mounted.current) return;
      setNotice(command.action === 'replay_refund' && response.result === false ? 'No retry was queued because the refund status has changed. The latest record is being refreshed.' : command.action === 'retry_reconciliation' ? 'Reconciliation retry requested. Existing evidence and the last checkpoint are preserved. The report is not complete until the worker finishes.' : command.action === 'review_exception' ? 'Review note recorded. This does not change the provider amounts or resolve the exception.' : 'Decision recorded. Refresh the booking to follow its current payment and refund status.');
      setCommand(null); setConfirmOpen(false); setUncertain(false); setReadBack(false); setRefresh(value => value + 1);
    } catch (e) {
      if (!mounted.current) return;
      setConfirmationError(errorMessage(e));
      if (e instanceof PortalError && e.outcomeUnknown) {
        setUncertain(true); setReadBack(false);
        try { await checkLatest(command); }
        catch (readError) { if (mounted.current) { setConfirmationError(`${errorMessage(e)} The latest status could not be loaded. Check again before retrying.`); handleError(readError); } }
      } else handleError(e);
    } finally { submitting.current = false; if (mounted.current) setWriting(false); }
  }
  const actionsDisabled = loading || writing || uncertain || !!error;
  const currentDetail = detail?.booking_id === selected ? detail : null;
  return <section className="finance-panel">
    <div className="ops-page-heading"><div><h1>Payments & resolutions</h1><p>Review bookings, refunds and provider reconciliation.</p></div><button className="ops-button" disabled={loading || writing} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} aria-hidden="true"/>Refresh</button></div>
    <div className="finance-access"><ShieldCheck size={17} aria-hidden="true"/>Administrator access with authenticator verification</div>
    <nav className="finance-views" aria-label="Finance views">
      <button aria-current={view === 'bookings' ? 'page' : undefined} onClick={() => { setView('bookings'); setNotice(''); }} disabled={writing}>Booking payments</button>
      <button aria-current={view === 'reconciliation' ? 'page' : undefined} onClick={() => { setView('reconciliation'); setNotice(''); }} disabled={writing}>Daily reconciliation</button>
    </nav>
    {error && <div className="ops-alert" role="alert">{error}</div>}
    {notice && <div className="ops-notice" role="status">{notice}</div>}
    {uncertain && <div className="ops-alert" role="status">An action has an unconfirmed outcome. Its request reference has been retained.<button onClick={() => setConfirmOpen(true)}>Review action</button></div>}
    {loading && <p className="finance-loading" role="status">Loading current finance records…</p>}
    {view === 'bookings' && !selected && <>
      <div className="ops-filters" aria-label="Payment cases"><button className={filter === 'open' ? 'selected' : ''} aria-pressed={filter === 'open'} onClick={() => { setFilter('open'); setCursors([null]); }}>Needs attention</button><button className={filter === 'all' ? 'selected' : ''} aria-pressed={filter === 'all'} onClick={() => { setFilter('all'); setCursors([null]); }}>All bookings</button></div>
      <div className="ops-table-wrap" aria-busy={loading}><table className="ops-table"><thead><tr><th>Booking</th><th>Amount</th><th>Work</th><th>Payment</th><th>Resolution</th><th><span className="ops-sr">Open</span></th></tr></thead><tbody>{list.items.map(item => <tr key={item.booking_id}><td><button className="ops-text-button" onClick={() => { setDetail(null); setSelected(item.booking_id); }}>{item.booking_id.slice(0, 8)}</button><small>{readableState(item.payment_mode)}</small></td><td>{formatMoney(item.amount, item.currency)}</td><td>{readableState(item.booking_stage)}</td><td><Status value={item.payment_state}/></td><td>{item.dispute?.state === 'open' ? 'Dispute open' : item.refunds.length ? `${item.refunds.length} refund record(s)` : 'No open dispute'}</td><td><button className="ops-icon" aria-label={`View booking ${item.booking_id}`} onClick={() => { setDetail(null); setSelected(item.booking_id); }}><ArrowUpRight size={17}/></button></td></tr>)}</tbody></table>
      {!loading && !error && !list.items.length && <div className="ops-empty"><h2>No matching records</h2><p>{filter === 'open' ? 'No open cases were returned. All bookings are available in the other filter.' : 'Booking payments will appear here.'}</p></div>}</div>
      <div className="ops-pagination"><span>Page {cursors.length}</span><div><button className="ops-button" disabled={loading || cursors.length === 1} onClick={() => setCursors(values => values.slice(0, -1))}>Previous</button><button className="ops-button" disabled={loading || !list.next_after} onClick={() => setCursors(values => [...values, list.next_after])}>Next</button></div></div>
    </>}
    {view === 'bookings' && selected && <><button className="ops-text-button" disabled={writing} onClick={() => { setSelected(null); setDetail(null); }}><ArrowLeft size={16}/>All payment cases</button>{currentDetail && <FinanceBooking detail={currentDetail} disabled={actionsDisabled} prepare={prepare}/>}</>}
    {view === 'reconciliation' && <>
      <div className="finance-report-controls"><label>Report date (IST)<input type="date" value={date} onChange={event => { setDate(event.target.value); setOffset(0); setReport(null); }}/></label><span>Leave blank for yesterday’s report. Provider data may still be reconciling.</span></div>
      {!loading && !error && !report && <div className="ops-empty"><h2>No reconciliation report available</h2><p>A missing report does not mean that payments match. Check the scheduled reconciliation service or choose another date.</p></div>}
      {report && <><div className="finance-report-heading"><h2>{report.run.report_date}</h2><Status value={report.run.status}/><span>{readableState(report.run.provider_mode)} provider mode</span><span>Phase: {readableState(report.run.phase)}</span></div>
        {report.run.status === 'review_required' ? <section className="finance-surface"><h3>Reconciliation needs review</h3><p>Automatic retries have stopped after repeated failures. Investigate the provider connection or reported failure before requesting another attempt. The saved checkpoint and evidence will be retained.</p><button className="ops-button" disabled={actionsDisabled} onClick={() => prepare({ action: 'retry_reconciliation', params: { run_id: report.run.run_id }, title: 'Retry reconciliation', description: `Request another attempt for the ${report.run.report_date} ${report.run.provider_mode} report, starting from its saved checkpoint. This does not move money or mark the report complete. Record what you investigated or corrected.`, amount: null, currency: 'INR' })}>Review retry</button></section> : report.run.last_error && <div className="ops-alert">The reconciliation run reported a problem. Review the run status before relying on these totals.</div>}
        <dl className="finance-totals"><div><dt>Observed</dt><dd>{report.summary.observed}</dd></div><div><dt>Matched</dt><dd>{report.summary.matched}</dd></div><div><dt>Exceptions</dt><dd>{report.summary.exceptions}</dd></div></dl>
        <p className="finance-muted">Completed: {report.run.completed_at ? formatDate(report.run.completed_at) : 'Not completed'}. Review notes do not change matching results.</p>
        <div className="finance-exceptions">{report.exceptions.map(item => <article className="finance-surface" key={`${item.kind}:${item.provider_id}`}><div className="finance-record-heading"><h3>{reconciliationKindLabel(item.kind)} · {item.provider_id}</h3><strong>{formatMoney(item.amount_paise / 100)}</strong></div><p>{readableState(item.reason)}</p>{item.booking_id && <button className="ops-text-button" onClick={() => { setView('bookings'); setSelected(item.booking_id); setDetail(null); }}>Open booking {item.booking_id.slice(0, 8)} <ArrowUpRight size={14}/></button>}{item.reviews?.map(review => <blockquote key={review.review_id}><p>{review.note}</p><small>{formatDate(review.created_at)}</small></blockquote>)}<button className="ops-button" disabled={actionsDisabled} onClick={() => prepare({ action: 'review_exception', params: { run_id: report.run.run_id, kind: item.kind, provider_id: item.provider_id }, title: 'Record reconciliation review', description: `Add an audit note for ${item.provider_id}. This records your investigation; it does not mark the amount matched or move money.`, amount: item.amount_paise / 100, currency: 'INR' })}>Add review note</button></article>)}</div>
        {!report.exceptions.length && !loading && <p className="finance-muted">No exceptions on this page. Check the run status and total exception count above.</p>}
        <div className="ops-pagination"><span>Exceptions {report.exceptions.length ? offset + 1 : 0}–{offset + report.exceptions.length} of {report.summary.exceptions}</span><div><button className="ops-button" disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Previous</button><button className="ops-button" disabled={loading || offset + report.exceptions.length >= report.summary.exceptions} onClick={() => setOffset(value => value + 50)}>Next</button></div></div>
      </>}
    </>}
    <Dialog open={confirmOpen && !!command} onOpenChange={value => { if (!writing) setConfirmOpen(value); }}><DialogContent className="ops finance-dialog" data-theme={theme} showCloseButton={!writing}><DialogTitle>{command?.title}</DialogTitle><DialogDescription>{command?.description}</DialogDescription>{command && <>
      {command.amount !== null && <p className="finance-confirm-amount">{formatMoney(command.amount, command.currency)}</p>}
      <p className="finance-muted finance-reference">Request: {command.requestId}</p>
      <label htmlFor="finance-audit-note">Reason for this action<textarea id="finance-audit-note" value={command.note} minLength={5} maxLength={500} disabled={writing || uncertain} onChange={event => setCommand({ ...command, note: event.target.value })} placeholder="Record what you checked and why this action is appropriate."/></label>
      {confirmationError && <div className="ops-alert" role="alert">{confirmationError}</div>}
      {uncertain && <div className="finance-uncertain"><p>{readBack ? 'The latest records have been loaded below. The original request reference and reason will be reused if you retry.' : 'The response was interrupted. The action may already have been recorded. Load the current records before retrying.'}</p>{readBack && command.bookingId && detail?.booking_id === command.bookingId && <p>Payment: {readableState(detail.payment_state)} · Refunds: {detail.refunds.map(value => readableState(value.state)).join(', ') || 'None'} · Dispute: {readableState(detail.dispute?.state)}</p>}{readBack && !command.bookingId && latestCommandReport && <p>Run: {readableState(latestCommandReport.run.status)}{command.action === 'retry_reconciliation' ? ` · Phase: ${readableState(latestCommandReport.run.phase)}` : ` · ${latestCommandReport.exceptions.find(value => value.provider_id === command.params.provider_id && value.kind === command.params.kind)?.reviews?.length ?? 0} review note(s) on this exception.`}</p>}<button className="ops-button" disabled={writing} onClick={retryRead}>Check latest status</button></div>}
      <div className="finance-dialog-actions"><button className="ops-button" disabled={writing} onClick={() => setConfirmOpen(false)}>Close</button><button className="ops-button primary" disabled={writing || command.note.trim().length < 5 || (uncertain && !readBack)} onClick={confirm}>{writing ? 'Checking…' : uncertain ? 'Retry the same request' : 'Confirm action'}</button></div>
    </>}</DialogContent></Dialog>
  </section>;
}

function FinanceBooking({ detail: d, disabled, prepare }: { detail: FinanceDetail; disabled: boolean; prepare: (input: Omit<FinanceCommand, 'requestId' | 'note'>) => void }) {
  const captured = d.payments.filter(payment => payment.capture && payment.status === 'success');
  return <div className="finance-booking">
    <div className="finance-record-heading"><div><p className="finance-reference">Booking {d.booking_id}</p><h2>{formatMoney(d.amount, d.currency)}</h2></div><Status value={d.payment_state}/></div>
    <dl className="finance-totals"><div><dt>Work status</dt><dd>{readableState(d.booking_stage)}</dd></div><div><dt>Payment method</dt><dd>{readableState(d.payment_mode)}</dd></div><div><dt>Policy</dt><dd>{d.policy_version}</dd></div></dl>
    <div className="finance-deadlines">{d.request_expires_at && <p>Request deadline: {formatDate(d.request_expires_at)}</p>}{d.payment_due_at && <p>Payment deadline: {formatDate(d.payment_due_at)}</p>}</div>
    {d.cancellation && <section className="finance-surface"><h3>Cancellation</h3><p>{readableState(d.cancellation.actor)} · {readableState(d.cancellation.reason)}</p><small>{formatDate(d.cancellation.cancelled_at)} · Policy {d.cancellation.policy_version}</small></section>}
    <section className="finance-surface"><h3>Payments</h3>{!d.payments.length && <p>No payment attempts recorded.</p>}{d.payments.map(payment => <article className="finance-record" key={payment.payment_id}><div className="finance-record-heading"><strong>{formatMoney(payment.amount, d.currency)}</strong><Status value={payment.status}/></div><dl className="finance-fields"><div><dt>Payment</dt><dd>{payment.payment_id}</dd></div><div><dt>Provider reference</dt><dd>{payment.gateway_payment_id || 'Not received'}</dd></div><div><dt>Capture</dt><dd>{payment.capture ? 'Verified capture receipt' : 'No verified capture receipt'}</dd></div><div><dt>Recovery</dt><dd>{payment.recovery ? readableState(payment.recovery.state) : 'No recovery case'}</dd></div></dl>{payment.capture && payment.status === 'success' && !d.refund_details.some(refund => refund.payment_id === payment.payment_id) && <button className="ops-button" disabled={disabled} onClick={() => prepare({ action: 'refund', params: { payment_id: payment.payment_id }, bookingId: d.booking_id, title: 'Authorise a full refund', description: `Authorise a refund of this captured payment for booking ${d.booking_id.slice(0, 8)}. The server checks eligibility. Provider processing and bank credit can take additional time.`, amount: payment.amount, currency: d.currency })}>Review full refund</button>}</article>)}</section>
    <section className="finance-surface"><h3>Refunds</h3><p className="finance-muted">Processed means the provider confirmed processing. It is not a confirmation of credit to the customer’s bank.</p>{!d.refunds.length && <p>No refund requests recorded.</p>}{d.refunds.map(refund => <article className="finance-record" key={refund.id}><div className="finance-record-heading"><strong>{formatMoney(refund.amount, refund.currency)}</strong><Status value={refund.state}/></div><p className="finance-reference">{refund.reference || refund.id}</p>{refund.processed_at && <p>{formatDate(refund.processed_at)}</p>}{['failed', 'requires_review'].includes(refund.state) && <button className="ops-button" disabled={disabled} onClick={() => prepare({ action: 'replay_refund', params: { refund_id: refund.id }, bookingId: d.booking_id, title: 'Recheck this refund', description: 'Request another provider reconciliation for this existing refund. This does not authorise a second refund.', amount: refund.amount, currency: refund.currency })}>Review retry</button>}</article>)}</section>
    <section className="finance-surface"><h3>Dispute</h3>{d.dispute ? <><div className="finance-record-heading"><p>{readableState(d.dispute.reason)}</p><Status value={d.dispute.state}/></div><p className="finance-muted">Opened {formatDate(d.dispute.opened_at)}</p>{d.dispute.resolution && <p>Resolution: {readableState(d.dispute.resolution)}</p>}{d.dispute_detail?.resolution_note && <blockquote>{d.dispute_detail.resolution_note}</blockquote>}{d.dispute.state === 'open' && <div className="finance-inline-actions">{captured.length > 0 && <button className="ops-button" disabled={disabled} onClick={() => prepare({ action: 'resolve_dispute', params: { dispute_id: d.dispute!.id, resolution: 'full_refund' }, bookingId: d.booking_id, title: 'Resolve with a full refund', description: 'Resolve this dispute and authorise eligible captured online payments for refund. Review the payment records before confirming.', amount: captured.reduce((sum, payment) => sum + Number(payment.amount), 0), currency: d.currency })}>Resolve with refund</button>}<button className="ops-button" disabled={disabled} onClick={() => prepare({ action: 'resolve_dispute', params: { dispute_id: d.dispute!.id, resolution: 'no_refund' }, bookingId: d.booking_id, title: 'Resolve without a refund', description: 'Close this dispute without issuing a refund. Include the evidence and reasoning for this decision.', amount: 0, currency: d.currency })}>Resolve without refund</button></div>}</> : <p>No dispute recorded.</p>}</section>
    <section className="finance-surface"><h3>Partner earnings & payout</h3>{d.earning ? <><dl className="finance-totals"><div><dt>Gross</dt><dd>{formatMoney(d.earning.gross_paise / 100)}</dd></div><div><dt>Platform fee</dt><dd>{formatMoney(d.earning.fee_paise / 100)}</dd></div><div><dt>Net earning</dt><dd>{formatMoney(d.earning.net_paise / 100)}</dd></div></dl><Status value={d.earning.state}/></> : <p>No completed-work earning is recorded for this booking.</p>}<p className="finance-muted">Payout initiation is not configured here. An earning balance is an accounting record, not confirmation of bank settlement.</p></section>
  </div>;
}
