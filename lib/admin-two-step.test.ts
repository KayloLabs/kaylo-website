import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminSession, PortalError } from './admin-api.ts';

const config = {
  firebaseApiKey: 'public',
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
};
const admin = { email: 'admin@example.test', role: 'admin' };
const tokens = () =>
  Response.json({ idToken: 'password-token', refreshToken: 'refresh', expiresIn: 3600 });
const body = (init?: RequestInit) => JSON.parse(String(init?.body));

async function mockFetch(fn: typeof fetch, run: () => Promise<void>) {
  const previous = globalThis.fetch;
  globalThis.fetch = fn;
  try {
    await run();
  } finally {
    globalThis.fetch = previous;
  }
}

test('the session reports authenticator and email status, and older servers stay unknown', async () => {
  let reply: Record<string, unknown> = { admin, mfa: { verified: false, email_verified: true } };
  await mockFetch(async (input) => {
    if (String(input).includes('signInWithPassword')) return tokens();
    return Response.json(reply);
  }, async () => {
    const session = new AdminSession(config);
    assert.deepEqual(await session.signIn('admin@example.test', 'pw'), {
      ...admin,
      mfa: false,
      emailVerified: true,
    });
    assert.equal(session.signedIn, true);
    reply = { admin };
    assert.deepEqual(await session.signIn('admin@example.test', 'pw'), admin);
  });
});

test('a setup sign-in asks the server for authenticator setup; a normal one never does', async () => {
  const sessions: Record<string, unknown>[] = [];
  await mockFetch(async (input, init) => {
    if (String(input).includes('signInWithPassword')) return tokens();
    sessions.push(body(init));
    return Response.json({ ok: true, mfa: { enrollment_required: true, expires_at: Date.now() + 300_000 } });
  }, async () => {
    const session = new AdminSession(config);
    const step = await session.signIn('admin@example.test', 'pw', { setupAuthenticator: true });
    assert.equal('kind' in step && step.kind, 'enrollment');
    await session.signIn('admin@example.test', 'pw');
  });
  assert.equal(sessions[0].enroll_mfa, true);
  assert.equal(sessions[0].action, 'session');
  assert.equal('enroll_mfa' in sessions[1], false);
});

test('a protected area asking for an authenticator keeps the session open', async () => {
  for (const code of ['ADMIN_MFA_REQUIRED', 'ADMIN_EMAIL_VERIFICATION_REQUIRED']) {
    let applicationReads = 0;
    await mockFetch(async (input) => {
      const url = String(input);
      if (url.includes('signInWithPassword')) return tokens();
      if (url.includes('finance-operations')) {
        return Response.json({ error: { code: 'admin-mfa', message: code } }, { status: 403 });
      }
      applicationReads++;
      return Response.json({ admin, mfa: { verified: false, email_verified: true }, applications: [], total: 0 });
    }, async () => {
      const session = new AdminSession(config);
      await session.signIn('admin@example.test', 'pw');
      await assert.rejects(session.financeRequest('list', {}), (error: unknown) => {
        assert.ok(error instanceof PortalError);
        assert.equal(error.code, code);
        assert.match(error.message, /two-step verification/);
        return true;
      });
      assert.equal(session.signedIn, true);
      await session.request('list');
      assert.equal(applicationReads, 2);
    });
  }
});

test('the core admin function refusing an authenticator still ends the session', async () => {
  let reads = 0;
  await mockFetch(async (input) => {
    if (String(input).includes('signInWithPassword')) return tokens();
    reads++;
    if (reads === 1) return Response.json({ admin, mfa: { verified: false, email_verified: true } });
    return Response.json({ error: { message: 'ADMIN_MFA_REQUIRED' } }, { status: 403 });
  }, async () => {
    const session = new AdminSession(config);
    await session.signIn('admin@example.test', 'pw');
    await assert.rejects(session.request('list'), PortalError);
    assert.equal(session.signedIn, false);
  });
});

test('an expired session from a protected area still signs out', async () => {
  await mockFetch(async (input) => {
    const url = String(input);
    if (url.includes('signInWithPassword')) return tokens();
    if (url.includes('privacy-operations')) {
      return Response.json({ error: { message: 'SIGN_IN_REQUIRED' } }, { status: 401 });
    }
    return Response.json({ admin });
  }, async () => {
    const session = new AdminSession(config);
    await session.signIn('admin@example.test', 'pw');
    await assert.rejects(session.privacyRequest('list', {}), PortalError);
    assert.equal(session.signedIn, false);
  });
});

test('the verification email is Firebase VERIFY_EMAIL for the signed-in token only', async () => {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  await mockFetch(async (input, init) => {
    const url = String(input);
    if (url.includes('signInWithPassword')) return tokens();
    if (url.includes('sendOobCode')) {
      sent.push({ url, body: body(init) });
      return sent.length === 1
        ? Response.json({ email: admin.email })
        : Response.json({ error: { message: 'TOO_MANY_ATTEMPTS_TRY_LATER' } }, { status: 400 });
    }
    return Response.json({ admin, mfa: { verified: false, email_verified: false } });
  }, async () => {
    const session = new AdminSession(config);
    await assert.rejects(session.sendEmailVerification(), /sign in/i);
    await session.signIn('admin@example.test', 'pw');
    await session.sendEmailVerification();
    await assert.rejects(session.sendEmailVerification(), /Wait a few minutes/);
  });
  assert.equal(sent.length, 2);
  assert.match(sent[0].url, /accounts:sendOobCode\?key=public$/);
  assert.deepEqual(sent[0].body, { requestType: 'VERIFY_EMAIL', idToken: 'password-token' });
});
