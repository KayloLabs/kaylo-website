'use client';
import AdminSignIn from './AdminSignIn';
import { FinancePanel } from './FinancePanel';
import { PrivacyPanel } from './PrivacyPanel';
import { SupportPanel } from './SupportPanel';
import ApplicationQueue from './ApplicationQueue';
import { type Payout, PayoutDetails } from './PayoutDetails';
import { sitePath } from '../../lib/site-path';
import { Wordmark } from '../Logo';
import { useAdminAppearance } from './AdminExperience';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  ClipboardList,
  CreditCard,
  LoaderCircle,
  LogOut,
  Mail,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  X,
} from 'lucide-react';
import {
  type Admin,
  AdminSession,
  type ApplicationSummary,
  applicationListKey,
  type Detail,
  documentNames,
  formatDate,
  loadPortalConfig,
  PortalError,
  requiredDocuments,
  type Status,
  statuses,
} from '../../lib/admin-api';

function Brand() {
  return (
    <div className='ops-brand'>
      <a href={sitePath('/')} className='ops-brand-home' aria-label='Kaylo home'>
        <Wordmark />
      </a>
      <span>Admin</span>
    </div>
  );
}
function Badge({ status }: { status: Status }) {
  return (
    <span className={`ops-badge status-${status}`}>
      <i />
      {statuses[status] || status}
    </span>
  );
}
function Loading() {
  return (
    <span className='ops-loading'>
      <LoaderCircle size={18} /> Working…
    </span>
  );
}
function errorText(e: unknown) {
  return e instanceof Error ? e.message : 'Something went wrong. Please retry.';
}

export default function AdminPortal() {
  const { theme, toggleTheme } = useAdminAppearance();
  const session = useRef<AdminSession | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [section, setSection] = useState<'applications' | 'finance' | 'privacy' | 'support'>('applications');
  const [financePending, setFinancePending] = useState(false);
  const [configReady, setConfigReady] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | ''>('under_review');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<ApplicationSummary[]>([]);
  const [rowsKey, setRowsKey] = useState('');
  const [total, setTotal] = useState(0);
  const [listing, setListing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const forceListRefresh = useRef(false);
  const [refresh, setRefresh] = useState(0);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const loadConfig = useCallback(() => {
    setError('');
    setConfigReady(false);
    loadPortalConfig().then((c) => {
      session.current = new AdminSession(c);
      setConfigReady(true);
    }).catch((e) => setError(errorText(e)));
  }, []);
  useEffect(() => {
    loadConfig();
    return () => session.current?.signOut();
  }, [loadConfig]);
  const signOut = useCallback(() => {
    session.current?.signOut();
    setAdmin(null);
    setSection('applications');
    setSelected(null);
    setDetail(null);
    setRows([]);
    setRowsKey('');
    setTotal(0);
    setUpdatedAt(null);
    setSearch('');
    setQuery('');
    setPage(1);
    setPageSize(20);
    forceListRefresh.current = false;
    setFilter('under_review');
    setNotice('');
  }, []);
  useEffect(() => {
    if (!admin) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        signOut();
        setError('You were signed out after 30 minutes of inactivity.');
      }, 30 * 60 * 1000);
    };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [admin, signOut]);
  const report = useCallback((e: unknown) => {
    if (
      e instanceof PortalError &&
      (e.status === 401 ||
        ['ADMIN_MFA_REQUIRED', 'ADMIN_EMAIL_VERIFICATION_REQUIRED', 'ADMIN_ACCESS_REQUIRED', 'ADMIN_ONLY'].includes(e.code))
    ) signOut();
    setError(errorText(e));
  }, [signOut]);
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    if (!admin || selected || !session.current || section !== 'applications') return;
    let cancelled = false;
    setListing(true);
    setError('');
    const params = {
      status: filter || undefined,
      search: query,
      page,
      page_size: pageSize,
    };
    const key = applicationListKey(params);
    const snapshot = session.current.cachedApplications(params);
    setRows(snapshot?.page.applications ?? []);
    setTotal(snapshot?.page.total ?? 0);
    setRowsKey(key);
    setUpdatedAt(snapshot?.receivedAt ?? null);
    const force = forceListRefresh.current;
    forceListRefresh.current = false;
    session.current.listApplications(params, force).then((r) => {
      if (!cancelled) {
        // A concurrent reviewer may have removed the final row on this page.
        const lastPage = Math.max(1, Math.ceil(r.total / pageSize));
        if (page > lastPage) { setPage(lastPage); return; }
        setRows(r.applications);
        setTotal(r.total);
        setUpdatedAt(Date.now());
      }
    }).catch((e) => {
      if (!cancelled) report(e);
    }).finally(() => {
      if (!cancelled) setListing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [admin, selected, filter, query, page, pageSize, refresh, report, section]);
  useEffect(() => {
    if (!admin || !selected || !session.current || section !== 'applications') {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail((current) => current?.application.application_id === selected ? current : null);
    setDetailLoading(true);
    setError('');
    session.current.request<Detail>('detail', { application_id: selected }).then((r) => {
      if (!cancelled) setDetail(r);
    }).catch((e) => {
      if (!cancelled) report(e);
    }).finally(() => {
      if (!cancelled) setDetailLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [admin, selected, refresh, report, section]);
  async function perform<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
    if (!session.current) throw new Error('Please sign in.');
    return session.current.request<T>(action, body);
  }
  async function reloadDetail() {
    setRefresh((v) => v + 1);
  }
  return (
    <div className={`ops-portal${admin ? ' ops-authenticated' : ''}`}>
      <header className='ops-header'>
        <Brand />
        <div className='ops-header-actions'>
          <button
            type='button'
            className='ops-theme-toggle'
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark'
              ? <Sun size={17} aria-hidden='true' />
              : <Moon size={17} aria-hidden='true' />}
          </button>
          {admin
            ? (
              <div className='ops-account'>
                <span>
                  {admin.email}
                  <small>{admin.role === 'admin' ? 'Administrator' : 'Reviewer'}</small>
                </span>
                <button className='ops-icon' onClick={signOut} aria-label='Sign out'>
                  <LogOut size={19} />
                </button>
              </div>
            )
            : null}
        </div>
      </header>
      {!admin
        ? (
          <AdminSignIn
            session={session.current}
            ready={configReady}
            connectionError={error}
            retry={loadConfig}
            onSignedIn={(a) => {
              setError('');
              setAdmin(a);
            }}
          />
        )
        : (
          <div className='ops-shell'>
            <aside className='ops-sidebar' aria-label='Workspace navigation'>
              <span className='ops-nav-label'>WORKSPACE</span>
              <nav aria-label='Administration areas'>
                <button disabled={financePending} aria-current={section === 'applications' ? 'page' : undefined} onClick={() => { setSection('applications'); setError(''); setNotice(''); }}><ClipboardList size={18} /> Applications</button>
                {admin.role === 'admin' && <>
                  <button disabled={financePending} aria-current={section === 'finance' ? 'page' : undefined} onClick={() => { setSection('finance'); setError(''); setNotice(''); }}><CreditCard size={18} /> Payments & resolutions</button>
                  <button disabled={financePending} aria-current={section === 'privacy' ? 'page' : undefined} onClick={() => { setSection('privacy'); setError(''); setNotice(''); }}><ShieldCheck size={18} /> Account deletion</button>
                  <button disabled={financePending} aria-current={section === 'support' ? 'page' : undefined} onClick={() => { setSection('support'); setError(''); setNotice(''); }}><Mail size={18} /> General support</button>
                </>}
              </nav>
              <div className='ops-sidebar-foot'><span>Kaylo operations</span><small>All times in India Standard Time</small></div>
            </aside>
            <main id='main' tabIndex={-1} className='ops-main'>
              {error && (
                <div role='alert' className='ops-alert'>
                  {error}
                  <button aria-label='Dismiss error' onClick={() => setError('')}>
                    <X size={16} />
                  </button>
                </div>
              )}
              {notice && (
                <div role='status' className='ops-notice'>
                  <CheckCircle2 size={18} />
                  {notice}
                  <button aria-label='Dismiss notice' onClick={() => setNotice('')}>
                    <X size={16} />
                  </button>
                </div>
              )}
              {section === 'finance' && admin.role === 'admin' && session.current
                ? <FinancePanel session={session.current} onError={report} theme={theme} onPendingChange={setFinancePending}/>
                : section === 'privacy' && admin.role === 'admin' && session.current
                ? <PrivacyPanel session={session.current} onError={report} theme={theme} onPendingChange={setFinancePending}/>
                : section === 'support' && admin.role === 'admin' && session.current
                ? <SupportPanel session={session.current} onError={report} onPendingChange={setFinancePending}/>
                : selected
                ? (
                  <>
                    <button
                      className='ops-text-button'
                      disabled={financePending}
                      onClick={() => {
                        setSelected(null);
                        setNotice('');
                      }}
                    >
                      <ArrowLeft size={16} /> All applications
                    </button>
                    {detail && detail.application.application_id === selected
                      ? (
                        <ApplicationReview
                          key={`${detail.application.application_id}-${detail.application.version}`}
                          detail={detail}
                          refreshing={detailLoading}
                          admin={admin}
                          call={perform}
                          refresh={reloadDetail}
                          onError={report}
                          onNotice={setNotice}
                          onPendingChange={setFinancePending}
                        />
                      )
                      : detailLoading
                      ? (
                        <div className='ops-empty'>
                          <Loading />
                        </div>
                      )
                      : (
                        <div className='ops-empty'>
                          <p>Unable to load this application.</p>
                          <button className='ops-button' onClick={reloadDetail}>Try again</button>
                        </div>
                      )}
                  </>
                )
                : (
                  <>
                    <ApplicationQueue
                      filter={filter}
                      search={search}
                      query={query}
                      page={page}
                      pageSize={pageSize}
                      rows={rowsKey === applicationListKey({ status: filter || undefined, search: query, page, page_size: pageSize }) ? rows : []}
                      total={rowsKey === applicationListKey({ status: filter || undefined, search: query, page, page_size: pageSize }) ? total : 0}
                      loading={listing || rowsKey !== applicationListKey({ status: filter || undefined, search: query, page, page_size: pageSize })}
                      updatedAt={updatedAt}
                      failed={!!error}
                      onFilter={(value) => { setFilter(value); setPage(1); }}
                      onSearch={setSearch}
                      onPage={setPage}
                      onPageSize={(value) => { setPageSize(value); setPage(1); }}
                      onOpen={setSelected}
                      onRefresh={() => { forceListRefresh.current = true; setRefresh((v) => v + 1); }}
                    />
                  </>
                )}
            </main>
          </div>
        )}
      <footer className='ops-footer'>
        <span>Kaylo Admin</span>
        <a href={sitePath('/')}>
          Back to Kaylo <ArrowUpRight size={12} />
        </a>
      </footer>
    </div>
  );
}

function ApplicationReview({
  detail,
  refreshing,
  admin,
  call,
  refresh,
  onError,
  onNotice,
  onPendingChange,
}: {
  detail: Detail;
  refreshing: boolean;
  admin: Admin;
  call: <T>(action: string, body?: Record<string, unknown>) => Promise<T>;
  refresh: () => Promise<void>;
  onError: (e: unknown) => void;
  onNotice: (s: string) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const { application: a, documents, audit, deliveries, certificate } = detail;
  const d = a.details;
  const required = requiredDocuments(d.role);
  const [checked, setChecked] = useState<string[]>([]);
  const [opened, setOpened] = useState<string[]>([]);
  const [requested, setRequested] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<'approve' | 'reject' | 'request_changes' | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<{ url: string; title: string; type: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const viewerDialog = useRef<HTMLDialogElement>(null);
  const waiting = busy || refreshing;
  const canReview = ['submitted', 'under_review', 'changes_requested'].includes(a.status);
  const allChecked = required.every((t) => checked.includes(t));
  useEffect(() => {
    onPendingChange(busy);
    return () => onPendingChange(false);
  }, [busy, onPendingChange]);
  useEffect(() => {
    if (decision) dialog.current?.showModal();
    else dialog.current?.close();
  }, [decision]);
  useEffect(() => {
    if (viewer) viewerDialog.current?.showModal();
    else viewerDialog.current?.close();
  }, [viewer]);
  async function view(type: string, historyId?: string) {
    setBusy(true);
    try {
      const r = await call<{ url: string; content_type: string }>('document', {
        application_id: a.application_id,
        doc_type: type,
        history_id: historyId,
      });
      setViewer({
        url: r.url,
        title: documentNames[type],
        type: r.content_type || documents.find((d) => d.doc_type === type)?.content_type || '',
      });
      if (!historyId) setOpened((v) => [...new Set([...v, type])]);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  async function approve(e: FormEvent) {
    e.preventDefault();
    if (!decision) return;
    setBusy(true);
    try {
      const result = await call<{ delivery?: { state: string }; reconciled?: boolean }>('review', {
        application_id: a.application_id,
        expected_version: a.version,
        decision,
        note,
        requested_documents: requested,
        checked_documents: checked,
      });
      setDecision(null);
      onNotice(
        result.reconciled
          ? 'The latest application status confirms the decision was saved. Check email delivery below.'
          : result.delivery?.state === 'sent'
          ? 'Decision saved and email sent.'
          : 'Decision saved. Email delivery is pending; check delivery below and retry if needed.',
      );
      await refresh();
    } catch (e) {
      setDecision(null);
      onError(e);
      if (e instanceof PortalError && e.outcomeUnknown) await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    setBusy(true);
    try {
      const r = await call<{ delivery?: { state: string } }>('retry_delivery', {
        application_id: a.application_id,
      });
      onNotice(
        r.delivery?.state === 'sent'
          ? 'Email sent.'
          : 'The email is still pending. Refresh to check its latest status.',
      );
      await refresh();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    try {
      const r = await call<{ url: string }>('certificate', { application_id: a.application_id });
      setViewer({
        url: r.url,
        title: 'Kaylo Approved Partner certificate',
        type: 'application/pdf',
      });
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  const toggle = (items: string[], item: string) =>
    items.includes(item) ? items.filter((i) => i !== item) : [...items, item];
  return (
    <>
      {refreshing && (
        <div role='status' className='ops-list-meta'>
          <Loading />
        </div>
      )}
      <div className='ops-detail-heading'>
        <div>
          <div className='ops-reference'>{a.reference}</div>
          <h1>{d.full_name}</h1>
          <p>
            {d.profession} <span>·</span> {d.district}
          </p>
        </div>
        <Badge status={a.status} />
      </div>
      <div className='ops-detail-grid'>
        <div>
          <section className='ops-panel'>
            <div className='ops-panel-title'>
              <h2>Application details</h2>
              <span>Revision {a.version}</span>
            </div>
            <dl className='ops-details'>
              <div>
                <dt>Email</dt>
                <dd>{d.email}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{d.phone}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{d.experience_years} years</dd>
              </div>
              <div>
                <dt>Service radius</dt>
                <dd>{d.travel_radius_km} km</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{formatDate(a.submitted_at)}</dd>
              </div>
              <div>
                <dt>Application status</dt>
                <dd>{statuses[a.status]}</dd>
              </div>
              {d.role === 'doctor' && (
                <>
                  <div>
                    <dt>Partner type</dt>
                    <dd>Doctor</dd>
                  </div>
                  <div>
                    <dt>Medical council number</dt>
                    <dd>{d.medical_council_number || 'Not supplied'}</dd>
                  </div>
                  <div>
                    <dt>Consultation modes</dt>
                    <dd>
                      {d.consultation_modes?.map((mode) =>
                        mode === 'homeVisit'
                          ? 'Home visit'
                          : mode === 'teleconsult'
                          ? 'Remote consultation'
                          : 'Clinic'
                      ).join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt>Consultation fee</dt>
                    <dd>₹{d.consultation_fee}</dd>
                  </div>
                  <div>
                    <dt>Clinic / practice address</dt>
                    <dd>{d.clinic_address}</dd>
                  </div>
                </>
              )}
              {d.role === 'caregiver' && (
                <>
                  <div>
                    <dt>Partner type</dt>
                    <dd>Caregiver</dd>
                  </div>
                  <div>
                    <dt>Training and experience</dt>
                    <dd>{d.caregiver_training || 'Not supplied'}</dd>
                  </div>
                  <div>
                    <dt>Care services</dt>
                    <dd>{d.care_services?.join(', ')}</dd>
                  </div>
                  <div>
                    <dt>Hourly rate</dt>
                    <dd>₹{d.hourly_rate}</dd>
                  </div>
                  <div>
                    <dt>Languages</dt>
                    <dd>{d.languages?.join(', ') || 'Not supplied'}</dd>
                  </div>
                </>
              )}
            </dl>
            <PayoutDetails
              canReveal={admin.role === 'admin'}
              summary={d.payout_summary}
              load={async () => {
                const result = await call<{ payout: Payout }>('payout', {
                  application_id: a.application_id,
                });
                return result.payout;
              }}
              onError={onError}
            />
          </section>
          {a.review_note && (
            <section className='ops-panel'>
              <h2>Last review note</h2>
              <p className='ops-preserve'>{a.review_note}</p>
            </section>
          )}
          <section className='ops-panel'>
            <div className='ops-panel-title'>
              <h2>Email delivery</h2>
              <Mail size={18} />
            </div>
            {deliveries.length === 0
              ? <p className='ops-muted'>An email is queued when you make a review decision.</p>
              : deliveries.map((item, i) => (
                <div className='ops-delivery' key={item.mail_id || i}>
                  <div>
                    <strong>
                      {(item.kind || item.event_type || 'Application update').replaceAll('_', ' ')}
                    </strong>
                    <small>
                      {item.status === 'sent'
                        ? `Sent ${formatDate(item.sent_at)}`
                        : !item.is_current
                        ? 'Superseded by a newer decision'
                        : `${item.status} · ${item.attempts} attempt${
                          item.attempts === 1 ? '' : 's'
                        }`}
                    </small>
                    {item.is_current && item.last_error && (
                      <small className='ops-error-text'>
                        Delivery needs attention. Retry after checking mail configuration.
                      </small>
                    )}
                  </div>
                  <span className={`ops-delivery-dot ${item.status === 'sent' ? 'sent' : ''}`} />
                </div>
              ))}
            {admin.role === 'admin' && deliveries.some((x) =>
              x.is_current && ['pending', 'failed', 'sending'].includes(x.status)
            ) && (
              <button className='ops-button' disabled={waiting} onClick={retry}>
                <RefreshCw size={16} /> Retry pending email
              </button>
            )}
          </section>
          {certificate && (
            <section className='ops-certificate'>
              <FileCheck2 size={26} />
              <h2>Kaylo Approved Partner</h2>
              <p>
                Issued{' '}
                {formatDate(certificate.issued_at)}.<br />Records the checks completed during this
                review.
              </p>
              <button className='ops-button' disabled={waiting} onClick={download}>
                <Download size={16} /> View certificate PDF
              </button>
            </section>
          )}
          <section className='ops-panel'>
            <h2>Review history</h2>
            {audit.length === 0
              ? <p className='ops-muted'>No review actions yet.</p>
              : (
                <ol className='ops-timeline'>
                  {audit.map((event, i) => (
                    <li key={event.event_id || i}>
                      <span className='ops-timeline-dot' />
                      <strong>{event.action.replaceAll('_', ' ')}</strong>
                      <small>
                        {formatDate(event.created_at)}
                        {event.actor_email ? ` · ${event.actor_email}` : ''}
                      </small>
                      {typeof event.data?.note === 'string' && <p>{event.data.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
          </section>
        </div>
        <div>
          <section className='ops-panel ops-evidence'>
            <div className='ops-panel-title'>
              <h2>Submitted documents</h2>
              <span>
                {documents.filter((doc) => required.includes(doc.doc_type)).length}/{required
                  .length} received
              </span>
            </div>
            <p className='ops-muted'>
              Open each document before marking it reviewed. Confirm only what you can establish
              from the submitted evidence.
            </p>
            {required.map((type) => [type, documentNames[type]]).map(([type, label]) => {
              const doc = documents.find((d) => d.doc_type === type);
              return (
                <div className='ops-document' key={type}>
                  <div className='ops-document-top'>
                    <FileText size={21} />
                    <div>
                      <strong>{label}</strong>
                      <small>
                        {doc
                          ? `${formatDate(doc.submitted_at)} · ${
                            Math.max(1, Math.round(doc.byte_size / 1024))
                          } KB`
                          : 'Awaiting upload'}
                      </small>
                    </div>
                    <button
                      className='ops-text-button'
                      disabled={!doc || waiting}
                      onClick={() => view(type)}
                    >
                      View <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {canReview && doc && (
                    <label className='ops-checkbox'>
                      <input
                        type='checkbox'
                        disabled={!opened.includes(type) || waiting}
                        checked={checked.includes(type)}
                        onChange={() => setChecked(toggle(checked, type))}
                      />
                      <span>Reviewed and accepted</span>
                    </label>
                  )}
                  {doc?.history?.some((h) => h.storage_path !== doc.storage_path) && (
                    <details className='ops-sensitive'>
                      <summary>Previous submissions</summary>
                      {doc.history.filter((h) => h.storage_path !== doc.storage_path).map((h) => (
                        <div key={h.history_id} className='ops-history-row'>
                          <small>{formatDate(h.uploaded_at)}</small>
                          <button
                            className='ops-text-button'
                            disabled={waiting}
                            onClick={() =>
                              view(type, h.history_id)}
                          >
                            View previous <ArrowUpRight size={13} />
                          </button>
                        </div>
                      ))}
                    </details>
                  )}
                </div>
              );
            })}
          </section>
          {canReview && (
            <section className='ops-panel ops-decision'>
              <h2>Make a decision</h2>
              <p className='ops-muted'>
                Approval creates partner access and emails their credentials and certificate. It
                does not certify a professional licence.
              </p>
              <button
                className='ops-button primary'
                disabled={waiting || admin.role !== 'admin' || a.status !== 'under_review' ||
                  !allChecked}
                onClick={() => setDecision('approve')}
              >
                <Check size={18} /> Approve application
              </button>
              {admin.role !== 'admin'
                ? <small>Final approval requires an administrator.</small>
                : !allChecked && (
                  <small>Review and accept all required documents to approve.</small>
                )}
              <div className='ops-decision-secondary'>
                <button
                  className='ops-button'
                  disabled={waiting}
                  onClick={() => setDecision('request_changes')}
                >
                  {a.status === 'changes_requested' ? 'Update request' : 'Request changes'}
                </button>
                <button
                  className='ops-button danger'
                  disabled={waiting || admin.role !== 'admin'}
                  onClick={() => setDecision('reject')}
                >
                  Reject
                </button>
              </div>
              {a.status === 'changes_requested' && (
                <small>
                  Waiting for replacements. Update the request to change instructions or renew an
                  expired link.
                </small>
              )}
            </section>
          )}
        </div>
      </div>
      <dialog
        ref={dialog}
        className='ops-dialog'
        aria-labelledby='ops-review-title'
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setDecision(null);
        }}
      >
        <form onSubmit={approve}>
          <button
            type='button'
            className='ops-icon ops-dialog-close'
            aria-label='Close decision'
            disabled={waiting}
            onClick={() => setDecision(null)}
          >
            <X size={20} />
          </button>
          <span className='ops-eyebrow'>APPLICATION REVIEW</span>
          <h2 id='ops-review-title'>
            {decision === 'approve'
              ? 'Welcome them to Kaylo.'
              : decision === 'reject'
              ? 'Reject this application?'
              : 'What needs another look?'}
          </h2>
          <p>
            {decision === 'approve'
              ? `Approve ${d.full_name} and send their partner credentials and certificate. Your acceptance of all required documents will be recorded.`
              : decision === 'reject'
              ? 'Your reason will be emailed to the applicant. This decision closes the current application.'
              : 'Choose the documents that need replacing. The applicant receives a secure link and your instructions.'}
          </p>
          {decision === 'request_changes' && (
            <fieldset className='ops-request-docs'>
              <legend>Documents to replace</legend>
              {required.map((type) => [type, documentNames[type]]).map(([type, label]) => (
                <label className='ops-checkbox' key={type}>
                  <input
                    type='checkbox'
                    checked={requested.includes(type)}
                    disabled={waiting}
                    onChange={() =>
                      setRequested(toggle(requested, type))}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
          <label>
            {decision === 'approve' ? 'Review note' : 'Reason and instructions'}
            <textarea
              rows={4}
              maxLength={2000}
              required={decision !== 'approve'}
              minLength={decision !== 'approve' ? 5 : undefined}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={waiting}
              placeholder={decision === 'request_changes'
                ? 'Explain clearly what needs correcting…'
                : decision === 'reject'
                ? 'Explain why the application cannot be approved…'
                : 'Add a useful note about your review…'}
            />
          </label>
          <div className='ops-dialog-actions'>
            <button
              type='button'
              className='ops-button'
              disabled={waiting}
              onClick={() => setDecision(null)}
            >
              Cancel
            </button>
            <button
              className={`ops-button ${decision === 'reject' ? 'danger-fill' : 'primary'}`}
              disabled={waiting || (decision === 'request_changes' && !requested.length)}
            >
              {waiting
                ? <Loading />
                : decision === 'approve'
                ? 'Approve & send email'
                : decision === 'reject'
                ? 'Reject & notify'
                : 'Send change request'}
            </button>
          </div>
        </form>
      </dialog>
      <dialog
        ref={viewerDialog}
        className='ops-document-dialog'
        aria-labelledby='ops-document-title'
        onClose={() => setViewer(null)}
        onCancel={() => setViewer(null)}
      >
        <header>
          <h2 id='ops-document-title'>{viewer?.title}</h2>
          <button className='ops-icon' aria-label='Close document' onClick={() => setViewer(null)}>
            <X size={22} />
          </button>
        </header>
        {viewer && (viewer.type === 'application/pdf'
          ? <iframe title={viewer.title} src={viewer.url} referrerPolicy='no-referrer' />
          : <img src={viewer.url} alt={viewer.title} />)}
        <footer>
          <span>Private preview · Link expires after one minute</span>
          {viewer && (
            <a href={viewer.url} target='_blank' rel='noopener noreferrer'>
              Open original <ArrowUpRight size={14} />
            </a>
          )}
        </footer>
      </dialog>
    </>
  );
}
