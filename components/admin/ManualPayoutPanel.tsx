'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Landmark, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { AdminSession, formatDate, PortalError } from '../../lib/admin-api';
import { formatMoney, readableState } from '../../lib/finance';
import { availablePayoutActions, executePayout, payoutActions, payoutCommand, type Batch, type BatchDetail, type Beneficiary, type BeneficiaryVerification, type Candidate, type PayoutCommand, type PayoutPage, type PayoutState, type PayoutWorker, type PayoutWrite, type TransferDetails } from '../../lib/manual-payouts';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';

type Draft = { action: PayoutWrite; params: Record<string, unknown>; subject: string };
const blankPage = <T,>(): PayoutPage<T> => ({ items: [], next_offset: null, mode: 'test' });
const states: PayoutState[] = ['prepared', 'approved', 'submitted', 'review_required', 'paid', 'rejected', 'cancelled', 'reversed'];
const message = (error: unknown) => error instanceof Error ? error.message : 'The request could not be completed.';
const money = (paise: number) => formatMoney(paise / 100);

export function ManualPayoutPanel({ session, theme, onError, onPendingChange }: {
  session: AdminSession; theme: string; onError: (e: unknown) => void; onPendingChange: (pending: boolean) => void;
}) {
  const [view, setView] = useState<'batches' | 'workers'>('batches');
  const [filter, setFilter] = useState<PayoutState | 'all'>('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [offsets, setOffsets] = useState([0]);
  const [batches, setBatches] = useState(blankPage<Batch>);
  const [workers, setWorkers] = useState(blankPage<PayoutWorker>);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [worker, setWorker] = useState<PayoutWorker | null>(null);
  const [candidates, setCandidates] = useState(blankPage<Candidate>);
  const [candidateOffset, setCandidateOffset] = useState(0);
  const [earnings, setEarnings] = useState<string[]>([]);
  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [transferDetails, setTransferDetails] = useState<TransferDetails | null>(null);
  const [verification, setVerification] = useState<BeneficiaryVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [command, setCommand] = useState<PayoutCommand | null>(null);
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState('');
  const [bankReference, setBankReference] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [writing, setWriting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [dialogError, setDialogError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    onPendingChange(writing || uncertain);
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    if (writing || uncertain) window.addEventListener('beforeunload', warn);
    return () => { onPendingChange(false); window.removeEventListener('beforeunload', warn); };
  }, [writing, uncertain, onPendingChange]);
  // Full bank details live only in this component and disappear after five minutes.
  useEffect(() => { if (!beneficiary) return; const timer = setTimeout(() => setBeneficiary(null), 300_000); return () => clearTimeout(timer); }, [beneficiary]);
  useEffect(() => { if (!transferDetails) return; const timer = setTimeout(() => setTransferDetails(null), 300_000); return () => clearTimeout(timer); }, [transferDetails]);
  const report = useCallback((e: unknown) => {
    if (e instanceof PortalError && (e.status === 401 || ['ADMIN_MFA_REQUIRED', 'ADMIN_EMAIL_VERIFICATION_REQUIRED', 'ADMIN_ROLE_REQUIRED'].includes(e.code))) onError(e);
    if (mounted.current) setError(message(e));
  }, [onError]);
  const offset = offsets[offsets.length - 1];
  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    const load = async () => {
      if (selected) {
        const { result } = await session.financeRequest<{ result: BatchDetail }>('payout_detail', { batch_id: selected });
        if (current) setDetail(result);
      } else if (worker) {
        const { result } = await session.financeRequest<{ result: PayoutPage<Candidate> }>('payout_candidates', { worker_id: worker.worker_id, offset: candidateOffset });
        if (current) { setCandidates(result); setEarnings([]); }
      } else if (view === 'workers') {
        const { result } = await session.financeRequest<{ result: PayoutPage<PayoutWorker> }>('payout_workers', { query, offset });
        if (current) setWorkers(result);
      } else {
        const { result } = await session.financeRequest<{ result: PayoutPage<Batch> }>('payout_list', { state: filter, offset });
        if (current) setBatches(result);
      }
    };
    load().catch(e => { if (current) report(e); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [session, selected, worker, view, query, filter, offset, candidateOffset, refresh, report]);

  function navigate(next: 'batches' | 'workers') {
    if (busy.current || uncertain) return;
    setTransferDetails(null); setView(next); setSelected(null); setDetail(null); setWorker(null); setBeneficiary(null); setVerification(null); setOffsets([0]); setNotice('');
  }
  function open(action: PayoutWrite, params: Record<string, unknown>, subject: string) {
    if (busy.current || uncertain) return;
    setDraft({ action, params, subject }); setCommand(null); setNote(''); setEvidence(''); setBankReference(''); setAcknowledged(false); setDialogError('');
  }
  async function confirm() {
    if (!draft || busy.current) return;
    const spec = payoutActions[draft.action];
    if (spec.acknowledgment && !acknowledged) { setDialogError('Confirm the evidence check before continuing.'); return; }
    let retained = command;
    try {
      retained ??= payoutCommand(draft.action, crypto.randomUUID(), { ...draft.params, evidence_reference: evidence, bank_reference: bankReference }, note);
    } catch (e) { setDialogError(message(e)); return; }
    setCommand(retained); busy.current = true; setWriting(true); setDialogError('');
    try {
      const result = await executePayout<Beneficiary | BeneficiaryVerification | Batch | TransferDetails>(session, retained);
      if (!mounted.current) return;
      setError('');
      if (retained.action === 'payout_transfer_details') setTransferDetails(result as TransferDetails);
      else if (retained.action === 'payout_beneficiary') setBeneficiary(result as Beneficiary);
      else if (retained.action === 'payout_verify_beneficiary') { setVerification(result as BeneficiaryVerification); setBeneficiary(null); }
      else {
        const batch = result as Batch;
        setTransferDetails(null); setView('batches'); setSelected(batch.batch_id); setWorker(null); setBeneficiary(null); setVerification(null); setDetail(null);
        setNotice(`Payout is ${readableState(batch.state).toLowerCase()}. ${batch.state === 'paid' ? 'Bank settlement has been reconciled.' : batch.state === 'review_required' ? 'A hold needs review before settlement can be confirmed.' : 'No money was moved by Kaylo.'}`);
      }
      setDraft(null); setCommand(null); setUncertain(false);
      // Revealing or verifying a beneficiary must not reset the selected earnings.
      if (!['payout_beneficiary', 'payout_verify_beneficiary', 'payout_transfer_details'].includes(retained.action)) setRefresh(n => n + 1);
    } catch (e) {
      if (!mounted.current) return;
      // Unknown responses keep the original immutable request. An explicit retry
      // uses its idempotency key; it never makes another bank transfer.
      const unknown = !(e instanceof PortalError) || e.outcomeUnknown;
      setUncertain(unknown); setDialogError(message(e));
      if (!unknown) setCommand(null);
      report(e);
    } finally { busy.current = false; if (mounted.current) setWriting(false); }
  }
  const disabled = loading || writing || uncertain || !!error;
  const currentDetail = detail?.batch.batch_id === selected ? detail : null;
  const mode = currentDetail?.batch.mode ?? (worker ? candidates.mode : view === 'workers' ? workers.mode : batches.mode);
  const page = view === 'workers' ? workers : batches;
  return <section className='payout-panel'>
    <header className='ops-page-heading'><div><h1>Professional payouts</h1><p>Approve, record and reconcile manual bank transfers.</p></div><button className='ops-button' disabled={loading || writing || uncertain} onClick={() => setRefresh(n => n + 1)}><RefreshCw size={16} aria-hidden/>Refresh</button></header>
    <div className='payout-policy'><ShieldCheck size={18} aria-hidden/><span>Two administrators verify each payout. Transfers are made through your bank.</span>{!loading && !error && <strong>{mode === 'live' ? 'Live ledger' : 'Test ledger · no real payouts'}</strong>}</div>
    <nav className='payout-tabs' aria-label='Payout workspace'><button aria-current={view === 'batches' ? 'page' : undefined} disabled={writing || uncertain} onClick={() => navigate('batches')}>Payout records</button><button aria-current={view === 'workers' ? 'page' : undefined} disabled={writing || uncertain} onClick={() => navigate('workers')}>Prepare a payout</button></nav>
    {error && <div className='ops-alert' role='alert'>{error}</div>}
    {notice && <div className='ops-notice' role='status'>{notice}</div>}
    {loading && <p role='status'>Loading current payout records…</p>}
    {!selected && !worker && <>
      <form className='payout-filters' onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setOffsets([0]); }}>
        {view === 'workers' ? <><label>Find a professional<input value={search} maxLength={80} onChange={e => setSearch(e.target.value)} placeholder='Name or partner reference' disabled={writing || uncertain}/></label><button className='ops-button' disabled={writing || uncertain}>Search</button></> : <label>Status<select value={filter} disabled={writing || uncertain} onChange={e => { setFilter(e.target.value as PayoutState | 'all'); setOffsets([0]); }}><option value='all'>All statuses</option>{states.map(state => <option value={state} key={state}>{readableState(state)}</option>)}</select></label>}
      </form>
      {!loading && !error && page.items.length === 0 && <div className='payout-empty'><Landmark size={26} aria-hidden/><h2>{view === 'workers' ? 'No eligible earnings' : 'No payout records'}</h2><p>Completed, captured online bookings appear here when their earnings are eligible.</p></div>}
      {!error && <div className='payout-table-wrap'><table><caption className='sr-only'>{view === 'workers' ? 'Eligible professionals' : 'Payout records'}</caption><thead><tr><th>Professional</th><th>{view === 'workers' ? 'Eligible amount' : 'Payout amount'}</th><th>{view === 'workers' ? 'Bank account' : 'Status'}</th><th><span className='sr-only'>Open record</span></th></tr></thead><tbody>
        {view === 'workers' ? workers.items.map(item => <tr key={item.worker_id}><td><strong>{item.name}</strong><small>{item.partner_id}</small></td><td>{money(item.eligible_paise)}<small>{item.eligible_count} completed earnings</small></td><td>{item.account_last4 ? `Ending ${item.account_last4}` : 'Account required'}<small>{item.beneficiary_verified ? 'Previously verified' : 'Verification required'}</small></td><td><button className='ops-button' disabled={disabled} onClick={() => { setWorker(item); setCandidateOffset(0); setCandidates(blankPage()); }}>Review earnings</button></td></tr>) : batches.items.map(batch => <tr key={batch.batch_id}><td><strong>{batch.name}</strong><small>{formatDate(batch.created_at)}</small></td><td>{money(batch.amount_paise)}<small>Account ending {batch.account_last4}</small></td><td><span className='payout-state'>{readableState(batch.state)}</span>{batch.requires_review && <small>Financial review required</small>}</td><td><button className='ops-button' disabled={disabled} onClick={() => { setSelected(batch.batch_id); setDetail(null); }}>View payout</button></td></tr>)}
      </tbody></table></div>}
      <div className='payout-pagination'><button className='ops-button' disabled={disabled || offsets.length < 2} onClick={() => setOffsets(items => items.slice(0, -1))}>Previous</button><span>Page {offsets.length}</span><button className='ops-button' disabled={disabled || page.next_offset === null} onClick={() => setOffsets(items => [...items, page.next_offset!])}>Next</button></div>
    </>}
    {worker && !selected && <article className='payout-record'>
      <button className='ops-text-button' disabled={writing || uncertain} onClick={() => navigate('workers')}>All professionals</button>
      <header><h2>{worker.name}</h2><p>{worker.partner_id} · Account {worker.account_last4 ? `ending ${worker.account_last4}` : 'not supplied'}</p></header>
      <section className='payout-surface'><h3>Verify the beneficiary</h3><p>Check the account against evidence before preparing a payout. A verification is tied to these exact bank details.</p>
        {verification && <p className='ops-notice' role='status'>Account ending {verification.account_last4} verified for this preparation.</p>}
        {beneficiary && <div className='payout-private'><div><strong>Private bank details</strong><button className='ops-text-button' onClick={() => setBeneficiary(null)} aria-label='Hide bank details'><X size={18}/></button></div><dl>{Object.entries(beneficiary.bank_account).map(([key, value]) => <div key={key}><dt>{readableState(key)}</dt><dd>{value}</dd></div>)}</dl></div>}
        <div className='payout-actions'><button className='ops-button' disabled={disabled} onClick={() => open('payout_beneficiary', { worker_id: worker.worker_id }, worker.name)}>View bank details</button>{beneficiary && <button className='ops-button primary' disabled={disabled} onClick={() => open('payout_verify_beneficiary', { worker_id: worker.worker_id, fingerprint: beneficiary.fingerprint }, worker.name)}>Record verification</button>}</div>
      </section>
      <section className='payout-surface'><h3>Select completed earnings</h3><p>Cash jobs and held earnings are excluded. The server rechecks eligibility when preparing and approving.</p>
        {!loading && !error && candidates.items.length === 0 && <p>No eligible earnings remain for this professional.</p>}
        <div className='payout-earnings'>{candidates.items.map(item => <label key={item.earning_id}><input type='checkbox' disabled={disabled || (earnings.length >= 100 && !earnings.includes(item.earning_id))} checked={earnings.includes(item.earning_id)} onChange={e => setEarnings(ids => e.target.checked ? [...ids, item.earning_id] : ids.filter(id => id !== item.earning_id))}/><span>Booking {item.booking_id}<small>{formatDate(item.completed_at)}</small></span><strong>{money(item.net_paise)}</strong></label>)}</div>
        <div className='payout-actions'><button className='ops-button' disabled={disabled || candidateOffset === 0} onClick={() => setCandidateOffset(0)}>First earnings</button><button className='ops-button' disabled={disabled || candidates.next_offset === null} onClick={() => setCandidateOffset(candidates.next_offset!)}>Next earnings</button><button className='ops-button primary' disabled={disabled || !verification || earnings.length === 0} onClick={() => open('payout_prepare', { worker_id: worker.worker_id, beneficiary_verification_id: verification!.verification_id, earning_ids: earnings }, `${worker.name} · ${earnings.length} earnings`)}>Prepare selected earnings</button></div>
      </section>
    </article>}
    {currentDetail && <article className='payout-record'>
      <button className='ops-text-button' disabled={writing || uncertain} onClick={() => navigate('batches')}>All payouts</button>
      <header className='payout-record-heading'><div><h2>{currentDetail.batch.name}</h2><p>{currentDetail.batch.partner_id} · Account ending {currentDetail.batch.account_last4}</p><small className='payout-reference'>{currentDetail.batch.batch_id}</small></div><div><strong className='payout-amount'>{money(currentDetail.batch.amount_paise)}</strong><span className='payout-state'>{readableState(currentDetail.batch.state)}</span></div></header>
      {currentDetail.batch.requires_review && <p className='ops-alert' role='status'>This recorded payout needs financial review. A later refund, dispute or returned-funds review does not undo the bank transfer. Reconcile the exposure and record any actual return.</p>}
      {!currentDetail.eligible_now && !['paid', 'reversed', 'cancelled', 'rejected'].includes(currentDetail.batch.state) && <p className='ops-alert'>Eligibility has changed. Review payment, refund, dispute and beneficiary records before confirming settlement.</p>}
      <section className='payout-surface'><h3>Transfer and reconciliation</h3>
        {transferDetails?.batch.batch_id === currentDetail.batch.batch_id && <div className='payout-private'><div><strong>Approved beneficiary · {money(transferDetails.batch.amount_paise)}</strong><button className='ops-text-button' aria-label='Hide approved bank details' onClick={() => setTransferDetails(null)}><X size={18}/></button></div>{transferDetails.batch.mode === 'test' && <p><strong>Test ledger: do not transfer real money.</strong></p>}<dl>{Object.entries(transferDetails.bank_account).map(([key, value]) => <div key={key}><dt>{readableState(key)}</dt><dd>{value}</dd></div>)}</dl></div>}<dl className='payout-fields'><div><dt>Prepared</dt><dd>{formatDate(currentDetail.batch.created_at)}</dd></div><div><dt>Bank reference</dt><dd>{currentDetail.batch.bank_reference || 'Not recorded'}</dd></div><div><dt>Reconciled</dt><dd>{currentDetail.batch.paid_at ? formatDate(currentDetail.batch.paid_at) : 'Not confirmed'}</dd></div><div><dt>Return reference</dt><dd>{currentDetail.batch.reversal_reference || 'Not recorded'}</dd></div></dl>
        <p>Preparation and approval do not send money. Only record bank actions that have actually happened. Settlement and returned funds require independent verification.</p>
        <div className='payout-actions'>{availablePayoutActions(currentDetail).map(action => <button className='ops-button' disabled={disabled} key={action} onClick={() => open(action, { batch_id: currentDetail.batch.batch_id }, `${currentDetail.batch.name} · ${money(currentDetail.batch.amount_paise)}`)}>{payoutActions[action].title}</button>)}</div>
        {(currentDetail.batch.state === 'prepared' && !currentDetail.can_approve) && <p className='payout-muted'>Another authorised administrator must approve this payout.</p>}
        {['submitted', 'review_required'].includes(currentDetail.batch.state) && !currentDetail.can_reconcile && <p className='payout-muted'>Settlement requires an eligible payout and a different administrator from the transfer recorder.</p>}
      </section>
      <section className='payout-surface'><h3>Review evidence</h3><dl className='payout-fields'><div><dt>Beneficiary evidence</dt><dd>{currentDetail.evidence.beneficiary_reference}</dd></div><div><dt>Account still matches</dt><dd>{currentDetail.evidence.bank_current ? 'Yes' : 'Changed: review required'}</dd></div><div><dt>Verified by</dt><dd>{currentDetail.evidence.verified_by} · {formatDate(currentDetail.evidence.verified_at)}</dd></div><div><dt>Transfer evidence</dt><dd>{currentDetail.evidence.transfer_reference || 'Not recorded'}</dd></div><div><dt>Settlement evidence</dt><dd>{currentDetail.evidence.reconcile_reference || 'Not recorded'}</dd></div><div><dt>Returned funds evidence</dt><dd>{currentDetail.evidence.reversal_reference || 'Not recorded'}</dd></div><div><dt>Return confirmation evidence</dt><dd>{currentDetail.evidence.reversal_confirmation_reference || 'Not recorded'}</dd></div></dl></section>
      <section className='payout-surface'><h3>Included earnings</h3><ul className='payout-item-list'>{currentDetail.items.map(item => <li key={item.earning_id}><span>Booking {item.booking_id}</span><strong>{money(item.net_paise)}</strong></li>)}</ul></section>
      <section className='payout-surface'><h3>Audit history</h3><ol className='payout-audit'>{currentDetail.audit.map((entry, index) => <li key={`${entry.created_at}-${index}`}><strong>{readableState(entry.action)}</strong><p>{entry.note}</p><small>{formatDate(entry.created_at)} · Administrator {entry.actor_uid}</small></li>)}</ol></section>
    </article>}
    <Dialog open={!!draft} onOpenChange={openValue => { if (!openValue && !writing && !uncertain) { setDraft(null); setCommand(null); } }}>
      {draft && <DialogContent className='ops payout-dialog' data-theme={theme} onEscapeKeyDown={e => { if (writing || uncertain) e.preventDefault(); }} onPointerDownOutside={e => e.preventDefault()}>
        <DialogTitle>{payoutActions[draft.action].title}</DialogTitle><DialogDescription>{payoutActions[draft.action].explanation}</DialogDescription><p className='payout-subject'>{draft.subject}</p>
        <form onSubmit={e => { e.preventDefault(); void confirm(); }}>
          <fieldset disabled={writing || uncertain}>
            {payoutActions[draft.action].bankReference && <label>Bank transaction reference<input required minLength={6} maxLength={80} value={bankReference} onChange={e => setBankReference(e.target.value)} autoComplete='off'/></label>}
            {payoutActions[draft.action].evidence && <label>Evidence reference<input required minLength={3} maxLength={180} value={evidence} onChange={e => setEvidence(e.target.value)} autoComplete='off'/><small>Use your internal record reference. Do not paste bank statements or account numbers here.</small></label>}
            <label>Audit note<textarea required minLength={5} maxLength={500} value={note} onChange={e => setNote(e.target.value)}/></label>
            {payoutActions[draft.action].acknowledgment && <label className='payout-check'><input type='checkbox' required checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/><span>{payoutActions[draft.action].acknowledgment}</span></label>}
          </fieldset>
          {dialogError && <p className='ops-alert' role='alert'>{dialogError}</p>}
          {uncertain && <div className='payout-uncertain' role='status'><strong>Outcome not confirmed</strong><p>The original request is retained. Retry checks that same request; do not repeat the transfer in your bank.</p><small>Request: {command?.requestId}</small></div>}
          <div className='payout-actions'><button type='button' className='ops-button' disabled={writing || uncertain} onClick={() => { setDraft(null); setCommand(null); }}>Cancel</button><button className='ops-button primary' disabled={writing}>{writing ? 'Saving…' : uncertain ? 'Retry the same request' : 'Confirm'}</button></div>
        </form>
      </DialogContent>}
    </Dialog>
  </section>;
}
