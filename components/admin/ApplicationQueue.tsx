'use client';

import { ArrowDown, ArrowRight, ChevronLeft, ChevronRight, ClipboardList, RefreshCw, Search, X } from 'lucide-react';
import { type ApplicationSummary, formatDate, type Status, statuses } from '../../lib/admin-api';

type Props = {
  filter: Status | ''; search: string; query: string; page: number; pageSize: number;
  rows: ApplicationSummary[]; total: number; loading: boolean; updatedAt: number | null;
  failed: boolean;
  onFilter: (value: Status | '') => void; onSearch: (value: string) => void;
  onPage: (value: number) => void; onPageSize: (value: number) => void;
  onOpen: (id: string) => void; onRefresh: () => void;
};
const filters: { value: Status | ''; label: string }[] = [
  { value: 'under_review', label: 'Ready for review' },
  { value: 'submitted', label: 'Documents pending' },
  { value: 'changes_requested', label: 'Changes requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: '', label: 'All applications' },
];

export default function ApplicationQueue(p: Props) {
  const pages = Math.max(1, Math.ceil(p.total / p.pageSize));
  const searching = p.search.trim() !== p.query;
  const hasRows = p.rows.length > 0;
  return (
    <section className='ops-queue' aria-labelledby='queue-title'>
      <header className='ops-queue-heading'>
        <div>
          <h1 id='queue-title'>Partner applications</h1>
          <p>Review documents, make decisions and track approvals.</p>
        </div>
        <button className='ops-button' onClick={p.onRefresh} disabled={p.loading}>
          <RefreshCw size={15} className={p.loading ? 'ops-spinning' : undefined} aria-hidden='true' /> Refresh
        </button>
      </header>
      <div className='ops-queue-surface'>
        <div className='ops-queue-filters' aria-label='Application status'>
          {filters.map(({ value, label }) => (
            <button key={value} aria-pressed={p.filter === value} onClick={() => p.onFilter(value)}>
              {label}
              {p.filter === value && !p.loading && !searching && !p.failed && <span>{p.total}</span>}
            </button>
          ))}
        </div>
        <div className='ops-queue-toolbar'>
          <label className='ops-queue-search'>
            <span className='ops-sr'>Search applications by name, email or reference</span>
            <Search size={17} aria-hidden='true' />
            <input type='search' autoComplete='off' value={p.search} maxLength={100}
              placeholder='Search name, email or reference' onChange={(event) => p.onSearch(event.target.value)} />
            {p.search && <button aria-label='Clear search' onClick={() => p.onSearch('')}><X size={15} /></button>}
          </label>
          <span className='ops-queue-order'><ArrowDown size={14} aria-hidden='true' /> Newest first</span>
        </div>
        <div className='ops-queue-meta' role='status' aria-live='polite'>
          <span>{searching ? 'Waiting for search…' : p.loading ? hasRows ? 'Updating applications…' : 'Loading applications…' : p.failed ? 'Could not refresh applications' : `${p.total.toLocaleString('en-IN')} ${p.total === 1 ? 'application' : 'applications'}${p.query ? ` matching “${p.query}”` : ''}`}</span>
          {p.updatedAt && !p.loading && <span>Updated {new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }).format(p.updatedAt)} IST</span>}
        </div>
        <div className='ops-queue-table-wrap' aria-busy={p.loading}>
          <table className='ops-queue-table'>
            <caption className='ops-sr'>Partner applications, newest first. All dates use India Standard Time.</caption>
            <thead><tr><th scope='col'>Applicant</th><th scope='col'>Service / area</th><th scope='col'>Submitted</th><th scope='col'>Status</th><th scope='col'><span className='ops-sr'>Actions</span></th></tr></thead>
            <tbody>
              {!hasRows && p.loading ? Array.from({ length: 6 }, (_, index) => (
                <tr key={index} aria-hidden='true' className='ops-queue-placeholder'>{Array.from({ length: 5 }, (_, cell) => <td key={cell}><span className='ops-queue-skeleton' /></td>)}</tr>
              )) : p.rows.map((row) => (
                <tr key={row.application_id}>
                  <td><button className='ops-queue-applicant' onClick={() => p.onOpen(row.application_id)}><strong>{row.full_name}</strong><span>{row.reference}</span></button></td>
                  <td><span className='ops-queue-service'>{row.profession}</span><small>{row.district}</small></td>
                  <td className='ops-queue-date'>{formatDate(row.submitted_at)}</td>
                  <td><span className={`ops-badge status-${row.status}`}><i aria-hidden='true' />{statuses[row.status]}</span></td>
                  <td><button className='ops-queue-open' onClick={() => p.onOpen(row.application_id)} aria-label={`Open application for ${row.full_name}`}>Open <ArrowRight size={14} aria-hidden='true' /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!hasRows && !p.loading && <div className='ops-queue-empty'>
            <ClipboardList size={27} strokeWidth={1.5} aria-hidden='true' />
            <h2>{p.failed ? 'Applications could not be loaded' : p.query ? 'No matching applications' : 'No applications in this queue'}</h2>
            <p>{p.failed ? 'Retry to get the latest applications.' : p.query ? 'Try another name, email or application reference.' : 'New applications will appear here when they reach this status.'}</p>
            {p.failed ? <button className='ops-button' onClick={p.onRefresh}>Retry</button> : (p.filter || p.search) && <button className='ops-button' onClick={() => { p.onSearch(''); p.onFilter(''); }}>View all applications</button>}
          </div>}
        </div>
        <footer className='ops-queue-pagination'>
          <label>Rows per page <select value={p.pageSize} onChange={(event) => p.onPageSize(Number(event.target.value))}><option value={20}>20</option><option value={50}>50</option></select></label>
          <span>{hasRows ? `${(p.page - 1) * p.pageSize + 1}–${(p.page - 1) * p.pageSize + p.rows.length} of ${p.total}` : '0 results'}</span>
          <div><span>Page {p.page} of {Math.max(p.page, pages)}</span><button aria-label='Previous page' disabled={p.page <= 1 || p.loading} onClick={() => p.onPage(p.page - 1)}><ChevronLeft size={18} /></button><button aria-label='Next page' disabled={p.page >= pages || p.loading} onClick={() => p.onPage(p.page + 1)}><ChevronRight size={18} /></button></div>
        </footer>
      </div>
    </section>
  );
}
