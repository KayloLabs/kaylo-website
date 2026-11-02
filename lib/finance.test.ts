import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminSession, PortalError } from './admin-api.ts';
import { financeWriteBody, formatMoney, reconciliationKindLabel, readFinanceCommand, type FinanceCommand, type ReconciliationReport } from './finance.ts';
const config = { firebaseApiKey: 'public', supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'anon' };
async function signedIn(handler: typeof fetch, run: (session: AdminSession) => Promise<void>, role: 'admin' | 'reviewer' = 'admin') {
  const previous = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('signInWithPassword')) return Response.json({ idToken: 'signed-token', refreshToken: 'refresh', expiresIn: 3600 });
    if (String(input).endsWith('/admin-applications') && JSON.parse(String(init?.body)).action === 'session') return Response.json({ admin: { email: 'admin@example.com', role } });
    return handler(input, init);
  };
  const session = new AdminSession(config);
  try { await session.signIn('admin@example.com', 'password'); await run(session); }
  finally { session.signOut(); globalThis.fetch = previous; }
}
test('finance requests use the protected endpoint, token and no-store transport', async () => {
  await signedIn(async (input, init) => {
    assert.equal(String(input), `${config.supabaseUrl}/functions/v1/finance-operations`);
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer signed-token');
    assert.equal(init?.cache, 'no-store'); assert.equal(init?.referrerPolicy, 'no-referrer');
    assert.equal(JSON.parse(String(init?.body)).action, 'list');
    return Response.json({ items: [], next_after: null });
  }, async session => { assert.deepEqual(await session.financeRequest('list', { state: 'open', action: 'refund' }), { items: [], next_after: null }); });
});
test('reviewers cannot request financial data or issue financial actions', async () => {
  let calls = 0;
  await signedIn(async () => { calls++; return Response.json({}); }, async session => {
    await assert.rejects(session.financeRequest('list'), (e: unknown) => e instanceof PortalError && e.code === 'ADMIN_ROLE_REQUIRED');
    await assert.rejects(session.financeRequest('refund'), (e: unknown) => e instanceof PortalError && e.status === 403);
    assert.equal(calls, 0);
  }, 'reviewer');
});
test('the backend strict MFA refusal is preserved for the sign-in flow', async () => {
  await signedIn(async () => Response.json({ error: { code: 'admin-access', message: 'ADMIN_MFA_REQUIRED' } }, { status: 403 }), async session => {
    await assert.rejects(session.financeRequest('list'), (e: unknown) => e instanceof PortalError && e.code === 'ADMIN_MFA_REQUIRED' && /authenticator/.test(e.message));
  });
});
test('uncertain financial writes are never replayed or declared successful by the transport', async () => {
  let writes = 0;
  await signedIn(async () => { writes++; throw new TypeError('connection lost'); }, async session => {
    await assert.rejects(session.financeRequest('refund', { payment_id: 'payment', request_id: 'stable', note: 'Refund reviewed' }), (e: unknown) => e instanceof PortalError && e.outcomeUnknown);
    assert.equal(writes, 1);
  });
});
test('financial read coalescing does not collide with application list reads and stays fresh', async () => {
  let calls = 0;
  let resolveFinance!: (response: Response) => void;
  await signedIn(async (input) => {
    calls++;
    return String(input).endsWith('/finance-operations') ? new Promise(resolve => { resolveFinance = resolve; }) : Response.json({ applications: [] });
  }, async session => {
    const first = session.financeRequest('list'); const second = session.financeRequest('list');
    const applications = session.request('list'); await Promise.resolve();
    assert.equal(calls, 2); resolveFinance(Response.json({ items: [], next_after: null }));
    assert.deepEqual(await first, await second); assert.deepEqual(await applications, { applications: [] });
    const fresh = session.financeRequest('list'); await Promise.resolve(); assert.equal(calls, 3);
    resolveFinance(Response.json({ items: ['new'], next_after: null })); assert.deepEqual(await fresh, { items: ['new'], next_after: null });
  });
});
test('a finance reply arriving after sign-out is rejected', async () => {
  let finish!: (response: Response) => void;
  await signedIn(async () => new Promise(resolve => { finish = resolve; }), async session => {
    const pending = session.financeRequest('detail', { booking_id: 'booking' }); await Promise.resolve();
    session.signOut(); finish(Response.json({ amount: 100 }));
    await assert.rejects(pending, (e: unknown) => e instanceof PortalError && e.code === 'SESSION_CHANGED');
  });
});
test('a missing reconciliation report remains null and is not replaced with zero totals', async () => {
  await signedIn(async () => Response.json({ result: null }), async session => {
    assert.deepEqual(await session.financeRequest('reconciliation'), { result: null });
  });
});
test('request identity and audit note remain unchanged on an explicit retry', () => {
  const command: FinanceCommand = { action: 'refund', params: { payment_id: 'payment', request_id: 'untrusted' }, requestId: 'retained-id', note: '  Duplicate charge confirmed  ', title: 'Refund', description: '', amount: 1200, currency: 'INR' };
  const first = financeWriteBody(command); const retry = financeWriteBody(command);
  assert.deepEqual(first, retry); assert.equal(retry.request_id, 'retained-id'); assert.equal(retry.note, 'Duplicate charge confirmed');
  assert.throws(() => financeWriteBody({ ...command, note: 'no' }), /reason/);
  assert.throws(() => financeWriteBody({ ...command, note: 'x'.repeat(501) }), /reason/);
  assert.match(formatMoney(1200), /1,200\.00/);
});

test('local reconciliation exceptions retain their kind and can receive an audit review', async () => {
  const exception = { kind: 'local' as const, provider_id: 'pending-payment-uuid', booking_id: 'booking', amount_paise: 12900, reason: 'mode_unknown', reviews: null };
  const report: ReconciliationReport = { run: { run_id: 'run', report_date: '2026-11-02', provider_mode: 'test', status: 'running', phase: 'local', last_error: null, completed_at: null }, summary: { observed: 1, matched: 0, exceptions: 1 }, exceptions: [exception] };
  await signedIn(async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.action === 'reconciliation') return Response.json({ result: report });
    assert.equal(body.action, 'review_exception'); assert.equal(body.kind, 'local');
    assert.equal(body.provider_id, 'pending-payment-uuid');
    return Response.json({ result: { review_id: 'review' } });
  }, async session => {
    const response = await session.financeRequest<{ result: ReconciliationReport }>('reconciliation');
    assert.equal(response.result.exceptions[0].kind, 'local');
    assert.equal(reconciliationKindLabel(response.result.exceptions[0].kind), 'Local payment checks');
    await session.financeRequest('review_exception', { kind: exception.kind, provider_id: exception.provider_id, run_id: report.run.run_id, request_id: 'review', note: 'Provider mode investigated' });
  });
});
test('missing or unreachable finance service is shown as unavailable without claiming an outcome', async () => {
  for (const [status, body] of [[404, { code: 'NOT_FOUND' }], [503, { error: 'SERVICE_UNAVAILABLE' }], [503, { error: { message: 'FINANCE_OPERATION_UNAVAILABLE' } }]] as const) {
    await signedIn(async () => Response.json(body, { status }), async session => {
      await assert.rejects(session.financeRequest('list'), (e: unknown) => e instanceof PortalError && /may not be deployed or reachable/.test(e.message) && !e.outcomeUnknown);
      await assert.rejects(session.financeRequest('refund', { payment_id: 'payment', request_id: 'request', note: 'Reviewed payment' }), (e: unknown) => e instanceof PortalError && /No outcome has been confirmed/.test(e.message) && e.outcomeUnknown === (status >= 500));
    });
  }
});
test('a missing booking is distinguished from an undeployed finance service', async () => {
  await signedIn(async () => Response.json({ error: { message: 'BOOKING_NOT_FOUND' } }, { status: 404 }), async session => {
    await assert.rejects(session.financeRequest('detail', { booking_id: 'missing' }), (e: unknown) => e instanceof PortalError && /booking could not be found/.test(e.message) && !/not be deployed/.test(e.message));
  });
});

test('controlled reconciliation retries retain identity and an audit reason without an amount', async () => {
  const command: FinanceCommand = { action: 'retry_reconciliation', params: { run_id: 'run-needing-review' }, requestId: 'retained-retry', note: 'Provider credentials restored and checked', title: 'Retry reconciliation', description: '', amount: null, currency: 'INR' };
  let calls = 0;
  await signedIn(async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body, { run_id: 'run-needing-review', request_id: 'retained-retry', note: 'Provider credentials restored and checked', action: 'retry_reconciliation' });
    calls++;
    if (calls === 1) throw new TypeError('connection interrupted after commit');
    return Response.json({ result: { status: 'pending' } });
  }, async session => {
    await assert.rejects(session.financeRequest(command.action, financeWriteBody(command)), (e: unknown) => e instanceof PortalError && e.outcomeUnknown);
    assert.equal(calls, 1);
    assert.deepEqual(await session.financeRequest(command.action, financeWriteBody(command)), { result: { status: 'pending' } });
    assert.equal(calls, 2);
  });
});
test('review-required status is preserved instead of becoming completed or empty', async () => {
  await signedIn(async () => Response.json({ result: { run: { status: 'review_required', phase: 'settlements', run_id: 'held-run' }, summary: { observed: 8, matched: 7, exceptions: 1 }, exceptions: [] } }), async session => {
    const value = await session.financeRequest<{ result: ReconciliationReport }>('reconciliation');
    assert.equal(value.result.run.status, 'review_required');
    assert.equal(value.result.run.phase, 'settlements');
    assert.equal(value.result.summary.exceptions, 1);
  });
});

test('uncertain reconciliation readback uses its original date and rejects another run', async () => {
  const command: FinanceCommand = { action: 'retry_reconciliation', params: { run_id: 'original-run' }, requestId: 'stable-retry', note: 'Investigated provider credentials', title: 'Retry', description: '', amount: null, currency: 'INR', reportDate: '2026-10-31', reportOffset: 50 };
  let wrongRun = true;
  await signedIn(async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body, { report_date: '2026-10-31', offset: 50, action: 'reconciliation' });
    return Response.json({ result: { run: { run_id: wrongRun ? 'different-run' : 'original-run', status: 'review_required' }, exceptions: [] } });
  }, async session => {
    await assert.rejects(readFinanceCommand(session, command), /original reconciliation report/);
    wrongRun = false;
    const result = await readFinanceCommand(session, command);
    assert.equal(result.kind, 'report');
    if (result.kind === 'report') assert.equal(result.report.run.run_id, 'original-run');
  });
});
