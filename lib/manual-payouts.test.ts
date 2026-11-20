import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminSession, PortalError } from './admin-api.ts';
import { availablePayoutActions, executePayout, payoutCommand, type BatchDetail } from './manual-payouts.ts';
const config = { firebaseApiKey: 'public', supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'anon' };
async function signedIn(handler: typeof fetch, run: (session: AdminSession) => Promise<void>, role = 'admin') {
  const previous = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('signInWithPassword')) return Response.json({ idToken: 'signed-token', refreshToken: 'refresh', expiresIn: 3600 });
    if (String(input).endsWith('/admin-applications') && JSON.parse(String(init?.body)).action === 'session') return Response.json({ admin: { email: 'admin@example.com', role } });
    return handler(input, init);
  };
  const session = new AdminSession(config);
  try { await session.signIn('admin@example.com', 'test-password'); await run(session); }
  finally { session.signOut(); globalThis.fetch = previous; }
}
test('prepare sends immutable earning identities, never caller amount, actor or provider mode', () => {
  const ids = ['earning-1'];
  const c = payoutCommand('payout_prepare', 'request', { worker_id: 'worker', beneficiary_verification_id: 'verification', earning_ids: ids, amount_paise: 1, mode: 'live', actor: 'other' }, ' Earnings checked ');
  ids.push('earning-2');
  assert.deepEqual(c.body, { request_id: 'request', note: 'Earnings checked', worker_id: 'worker', beneficiary_verification_id: 'verification', earning_ids: ['earning-1'] });
  assert.ok(Object.isFrozen(c.body)); assert.ok(Object.isFrozen(c.body.earning_ids));
  assert.throws(() => payoutCommand('payout_prepare', 'r', { worker_id: 'w', beneficiary_verification_id: 'v', earning_ids: ['x', 'x'] }, 'Checked twice'), /distinct/);
});
test('bank recording validates the exact reference and evidence', () => {
  assert.throws(() => payoutCommand('payout_record_transfer', 'r', { batch_id: 'b', bank_reference: '<script>', evidence_reference: 'bank-evidence' }, 'Transfer made'), /bank reference/);
  assert.throws(() => payoutCommand('payout_reconcile', 'r', { batch_id: 'b', evidence_reference: 'a' }, 'Transfer checked'), /evidence reference/);
  const c = payoutCommand('payout_record_transfer', 'r', { batch_id: 'b', bank_reference: 'UTR-100001', evidence_reference: 'statement-42' }, 'Transfer made');
  assert.equal(c.body.bank_reference, 'UTR-100001');
});
test('bank reveal and each payout mutation are uncertain writes, not silently replayed reads', async () => {
  for (const action of ['payout_beneficiary', 'payout_transfer_details', 'payout_prepare', 'payout_verify_beneficiary', 'payout_record_transfer', 'payout_reconcile', 'payout_confirm_reversal'] as const) {
    let calls = 0;
    await signedIn(async (_input, init) => { calls++; assert.equal(init?.cache, 'no-store'); assert.equal(init?.referrerPolicy, 'no-referrer'); throw new TypeError('connection lost'); }, async session => {
      await assert.rejects(session.financeRequest(action, { request_id: 'retained' }), (e: unknown) => e instanceof PortalError && e.outcomeUnknown);
      assert.equal(calls, 1);
    });
  }
});
test('explicit retry retains the identical immutable request after an unknown result', async () => {
  const c = payoutCommand('payout_record_transfer', 'retained-id', { batch_id: 'batch', bank_reference: 'UTR-100001', evidence_reference: 'statement-42' }, 'Transfer made');
  const bodies: unknown[] = [];
  await signedIn(async (_input, init) => { bodies.push(JSON.parse(String(init?.body))); if (bodies.length === 1) throw new TypeError('reply lost'); return Response.json({ ok: true, result: { state: 'submitted' } }); }, async session => {
    await assert.rejects(executePayout(session, c));
    assert.deepEqual(await executePayout(session, c), { state: 'submitted' });
    assert.deepEqual(bodies[0], bodies[1]);
  });
});
test('reviewers cannot read bank details or approve payouts', async () => {
  let calls = 0;
  await signedIn(async () => { calls++; return Response.json({}); }, async session => {
    for (const action of ['payout_beneficiary', 'payout_workers', 'payout_approve'] as const) await assert.rejects(session.financeRequest(action), (e: unknown) => e instanceof PortalError && e.status === 403);
    assert.equal(calls, 0);
  }, 'reviewer');
});
test('payout reads coalesce while audited bank reveals remain separate', async () => {
  let calls = 0;
  const responses: ((value: Response) => void)[] = [];
  await signedIn(async () => { calls++; return new Promise(resolve => responses.push(resolve)); }, async session => {
    const a = session.financeRequest('payout_workers'); const b = session.financeRequest('payout_workers'); await Promise.resolve(); assert.equal(calls, 1); responses.shift()!(Response.json({ ok: true, result: { items: [] } })); await Promise.all([a, b]);
    const c = session.financeRequest('payout_beneficiary', { request_id: 'one' }); const d = session.financeRequest('payout_beneficiary', { request_id: 'two' }); await Promise.resolve(); assert.equal(calls, 3); responses.forEach(resolve => resolve(Response.json({ ok: true, result: {} }))); await Promise.all([c, d]);
  });
});
test('UI exposes only applicable transitions and independent checks', () => {
  const d = { batch: { state: 'prepared', bank_reference: null, reversal_reference: null }, eligible_now: true, can_approve: false, can_reconcile: false, can_confirm_reversal: false } as unknown as BatchDetail;
  assert.deepEqual(availablePayoutActions(d), ['payout_reject', 'payout_cancel']);
  d.can_approve = true; assert.ok(availablePayoutActions(d).includes('payout_approve'));
  d.eligible_now = false; assert.ok(!availablePayoutActions(d).includes('payout_approve'));
  d.batch.state = 'submitted'; d.batch.bank_reference = 'UTR1000'; d.can_reconcile = true; assert.ok(!availablePayoutActions(d).includes('payout_reconcile'));
  d.eligible_now = true; assert.ok(availablePayoutActions(d).includes('payout_reconcile')); assert.ok(!availablePayoutActions(d).includes('payout_cancel'));
  d.batch.state = 'review_required'; d.batch.reversal_reference = 'RETURN1000'; d.can_confirm_reversal = true;
  assert.deepEqual(availablePayoutActions(d), ['payout_confirm_reversal']);
});
