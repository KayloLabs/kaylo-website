import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminSession, initialApplicationList, type ApplicationListPage, type ApplicationListParams } from './admin-api.ts';

const config = { firebaseApiKey: 'public', supabaseUrl: 'https://project.supabase.co', supabaseAnonKey: 'anon' };
const emptyPage = { applications: [], total: 0 };
const row = { application_id: 'one', reference: 'KA-001', status: 'under_review' as const, version: 1, submitted_at: '2026-11-08T10:00:00Z', full_name: 'Example partner', profession: 'Plumber', district: 'Kozhikode' };
async function setup(
  run: (session: AdminSession, actions: string[]) => Promise<void>,
  options: { bootstrap?: ApplicationListPage; reply?: (action: string, params: Record<string, unknown>) => Promise<Response> } = {},
) {
  const original = globalThis.fetch;
  const actions: string[] = [];
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('signInWithPassword')) return Response.json({ idToken: 'token', refreshToken: 'refresh', expiresIn: 3600 });
    const params = JSON.parse(String(init?.body));
    actions.push(params.action);
    if (params.action === 'session') {
      assert.equal(params.include_applications, true);
      return Response.json({ admin: { email: 'admin@example.test', role: 'admin' }, ...(options.bootstrap ? { applications: options.bootstrap } : {}) });
    }
    return options.reply ? options.reply(params.action, params) : Response.json(emptyPage);
  };
  const session = new AdminSession(config);
  try { await session.signIn('admin@example.test', 'password'); await run(session, actions); }
  finally { session.signOut(); globalThis.fetch = original; }
}

test('sign-in queue bootstrap avoids exactly one duplicate list request; subsequent visits revalidate', async () => {
  await setup(async (session, actions) => {
    assert.deepEqual(await session.listApplications(initialApplicationList), { applications: [row], total: 1 });
    assert.deepEqual(actions, ['session']);
    await session.listApplications(initialApplicationList);
    assert.deepEqual(actions, ['session', 'list']);
  }, { bootstrap: { applications: [row], total: 1 } });
});

test('older backend without bootstrap falls back to live list, with identical reads deduplicated', async () => {
  await setup(async (session, actions) => {
    assert.equal(session.cachedApplications(initialApplicationList), null);
    const values = await Promise.all([session.listApplications(initialApplicationList), session.listApplications(initialApplicationList)]);
    assert.deepEqual(values, [emptyPage, emptyPage]);
    assert.deepEqual(actions, ['session', 'list']);
  });
});

test('bootstrap is never reused for another filter, query, page or page size', async () => {
  const changes: Partial<ApplicationListParams>[] = [{ status: 'approved' }, { search: 'someone' }, { page: 2 }, { page_size: 50 }];
  for (const change of changes) await setup(async (session, actions) => {
    const params = { ...initialApplicationList, ...change };
    assert.equal(session.cachedApplications(params), null);
    assert.deepEqual(await session.listApplications(params), emptyPage);
    assert.deepEqual(actions, ['session', 'list']);
  }, { bootstrap: { applications: [row], total: 1 } });
});

test('explicit refresh always reads current backend even immediately after sign-in', async () => {
  await setup(async (session, actions) => {
    assert.deepEqual(await session.listApplications(initialApplicationList, true), emptyPage);
    assert.deepEqual(actions, ['session', 'list']);
  }, { bootstrap: { applications: [row], total: 1 } });
});

test('summary snapshots expire, are isolated copies and are removed at sign-out', async () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try { await setup(async (session) => {
    const first = session.cachedApplications(initialApplicationList)!;
    first.page.applications[0].full_name = 'Changed outside session';
    assert.equal(session.cachedApplications(initialApplicationList)!.page.applications[0].full_name, row.full_name);
    now += 30_001;
    assert.equal(session.cachedApplications(initialApplicationList), null);
    await session.listApplications(initialApplicationList);
    assert.ok(session.cachedApplications(initialApplicationList));
    session.signOut();
    assert.equal(session.cachedApplications(initialApplicationList), null);
    await assert.rejects(session.listApplications(initialApplicationList), /sign in/i);
  }, { bootstrap: { applications: [row], total: 1 } }); }
  finally { Date.now = originalNow; }
});

test('bounded summary memory retains at most eight queue pages', async () => {
  await setup(async (session) => {
    for (let page = 1; page <= 9; page++) await session.listApplications({ ...initialApplicationList, page });
    assert.equal(session.cachedApplications(initialApplicationList), null);
    assert.ok(session.cachedApplications({ ...initialApplicationList, page: 2 }));
    assert.ok(session.cachedApplications({ ...initialApplicationList, page: 9 }));
  });
});

test('review and privacy writes invalidate snapshots, including failed writes', async () => {
  for (const privacy of [false, true]) await setup(async (session) => {
    assert.ok(session.cachedApplications(initialApplicationList));
    const pending = privacy ? session.privacyRequest('process', { request_id: 'request' }) : session.request('review');
    assert.equal(session.cachedApplications(initialApplicationList), null);
    await assert.rejects(pending);
    assert.equal(session.cachedApplications(initialApplicationList), null);
  }, { bootstrap: { applications: [row], total: 1 }, reply: async () => Response.json({ error: 'VERSION_CONFLICT' }, { status: 409 }) });
});

test('a list response started before a decision cannot repopulate the cache afterwards', async () => {
  let finish!: (value: Response) => void;
  await setup(async (session) => {
    const pending = session.listApplications(initialApplicationList);
    await Promise.resolve();
    await session.request('review');
    finish(Response.json({ applications: [row], total: 1 }));
    await pending;
    assert.equal(session.cachedApplications(initialApplicationList), null);
  }, { reply: async (action) => action === 'list' ? new Promise((resolve) => { finish = resolve; }) : Response.json({ ok: true }) });
});

test('a late response cannot populate a signed-out or replacement session', async () => {
  let finish!: (value: Response) => void;
  await setup(async (session) => {
    const pending = session.listApplications(initialApplicationList);
    await Promise.resolve();
    session.signOut();
    finish(Response.json({ applications: [row], total: 1 }));
    await assert.rejects(pending, /sign in/i);
    await session.signIn('other@example.test', 'password');
    assert.equal(session.cachedApplications(initialApplicationList), null);
  }, { reply: async () => new Promise((resolve) => { finish = resolve; }) });
});

test('revoked administrator access clears all private summary snapshots immediately', async () => {
  await setup(async (session) => {
    assert.ok(session.cachedApplications(initialApplicationList));
    await assert.rejects(session.listApplications(initialApplicationList, true), /access is no longer available/);
    assert.equal(session.cachedApplications(initialApplicationList), null);
    await assert.rejects(session.request('detail'), /sign in/i);
  }, { bootstrap: { applications: [row], total: 1 }, reply: async () => Response.json({ error: { message: 'ADMIN_ACCESS_REQUIRED' } }, { status: 403 }) });
});
