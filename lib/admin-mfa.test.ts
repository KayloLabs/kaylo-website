import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminSession, PortalError } from './admin-api.ts';
import { totpEnrollment, totpFactors } from './admin-mfa.ts';
const config = {
  firebaseApiKey: 'public',
  supabaseUrl: 'https://project.supabase.co',
  supabaseAnonKey: 'anon',
};
const admin = { email: 'admin@example.test', role: 'admin' };
const factors = [{
  mfaEnrollmentId: 'factor-1',
  displayName: 'Personal authenticator',
  totpInfo: {},
}];
const setup = () => ({
  sharedSecretKey: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  verificationCodeLength: 6,
  hashingAlgorithm: 'SHA1',
  periodSec: 30,
  sessionInfo: 'opaque-enrollment-session',
  finalizeEnrollmentTime: new Date(Date.now() + 240_000).toISOString(),
});
const tokens = () =>
  Response.json({ idToken: 'password-token', refreshToken: 'refresh', expiresIn: 3600 });
const eligible = () =>
  Response.json({ ok: true, mfa: { enrollment_required: true, expires_at: Date.now() + 300_000 } });
const data = (init?: RequestInit) => JSON.parse(String(init?.body));
async function mockFetch(fn: typeof fetch, run: () => Promise<void>) {
  const previous = globalThis.fetch;
  globalThis.fetch = fn;
  try {
    await run();
  } finally {
    globalThis.fetch = previous;
  }
}

test('TOTP challenge grants no portal requests until finalization and server session approval', async () => {
  const calls: string[] = [];
  await mockFetch(async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('signInWithPassword')) {
      return Response.json({ mfaPendingCredential: 'pending', mfaInfo: factors });
    }
    if (url.includes('mfaSignIn:finalize')) {
      assert.deepEqual(data(init), {
        mfaPendingCredential: 'pending',
        mfaEnrollmentId: 'factor-1',
        totpVerificationInfo: { verificationCode: '123456' },
      });
      return Response.json({
        idToken: 'second-factor-token',
        refreshToken: 'second-factor-refresh',
      });
    }
    if (url.includes('securetoken')) {
      return Response.json({
        id_token: 'refreshed-mfa-token',
        refresh_token: 'refreshed-mfa-refresh',
        expires_in: 3600,
      });
    }
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer refreshed-mfa-token');
    return Response.json({ admin });
  }, async () => {
    const session = new AdminSession(config);
    const result = await session.signIn('admin@example.test', 'password');
    assert.deepEqual(result, {
      kind: 'challenge',
      factors: [{ id: 'factor-1', name: 'Personal authenticator' }],
    });
    await assert.rejects(session.request('list'), /complete authentication/);
    assert.equal(calls.length, 1);
    assert.deepEqual(await session.verifyAuthenticator('factor-1', '123456'), admin);
    await session.request('list');
    assert.equal(calls.length, 5);
  });
});

test('invalid codes retain the challenge but unsupported factors and wrong factor IDs cannot authorize', async () => {
  let finalizations = 0;
  await mockFetch(async (input) => {
    if (String(input).includes('signInWithPassword')) {
      return Response.json({ mfaPendingCredential: 'pending', mfaInfo: factors });
    }
    finalizations++;
    return Response.json({ error: { message: 'INVALID_VERIFICATION_CODE' } }, { status: 400 });
  }, async () => {
    const session = new AdminSession(config);
    await session.signIn('admin@example.test', 'password');
    await assert.rejects(session.verifyAuthenticator('unknown', '123456'), /sign in/);
    assert.equal(finalizations, 0);
    await assert.rejects(session.verifyAuthenticator('factor-1', 'abcdef'), /code shown/);
    assert.equal(finalizations, 0);
    await assert.rejects(session.verifyAuthenticator('factor-1', '1234567'), /code shown/);
    assert.equal(finalizations, 0);
    await assert.rejects(
      session.verifyAuthenticator('factor-1', '123456'),
      /could not be verified/,
    );
    await assert.rejects(
      session.verifyAuthenticator('factor-1', '234567'),
      /could not be verified/,
    );
    assert.equal(finalizations, 2);
  });
  await mockFetch(
    async () =>
      Response.json({
        mfaPendingCredential: 'pending',
        mfaInfo: [{ mfaEnrollmentId: 'phone', phoneInfo: '+10000000000' }],
      }),
    async () => {
      await assert.rejects(
        new AdminSession(config).signIn('admin@example.test', 'password'),
        /no supported authenticator/,
      );
    },
  );
});

test('signout aborts a TOTP response and prevents late authentication', async () => {
  let finish!: (response: Response) => void;
  await mockFetch(
    async (input) =>
      String(input).includes('signInWithPassword')
        ? Response.json({ mfaPendingCredential: 'pending', mfaInfo: factors })
        : new Promise((resolve) => {
          finish = resolve;
        }),
    async () => {
      const session = new AdminSession(config);
      await session.signIn('admin@example.test', 'password');
      const verification = session.verifyAuthenticator('factor-1', '123456');
      session.signOut();
      finish(Response.json({ idToken: 'late', refreshToken: 'late' }));
      await assert.rejects(
        verification,
        (e: unknown) => e instanceof PortalError && e.code === 'SESSION_CHANGED',
      );
      await assert.rejects(session.request('detail'), /sign in/);
    },
  );
});

test('enrollment bootstrap has no data access and posts the documented Firebase TOTP protocol', async () => {
  let starts = 0, finalizes = 0;
  let responseSecret = setup();
  await mockFetch(async (input, init) => {
    const url = String(input);
    if (url.includes('signInWithPassword')) return tokens();
    if (url.includes('admin-applications')) {
      assert.equal(data(init).action, 'session');
      return eligible();
    }
    if (url.includes('mfaEnrollment:start')) {
      starts++;
      assert.deepEqual(data(init), { idToken: 'password-token', totpEnrollmentInfo: {} });
      return Response.json({ totpSessionInfo: responseSecret });
    }
    if (url.includes('mfaEnrollment:finalize')) {
      finalizes++;
      assert.deepEqual(data(init), {
        idToken: 'password-token',
        displayName: 'Kaylo Admin authenticator',
        totpVerificationInfo: {
          sessionInfo: 'opaque-enrollment-session',
          verificationCode: '123456',
        },
      });
      return Response.json({ idToken: 'enrolled', refreshToken: 'enrolled-refresh' });
    }
    throw new Error('unexpected request');
  }, async () => {
    const session = new AdminSession(config);
    const result = await session.signIn('admin@example.test', 'password');
    assert.equal('kind' in result && result.kind, 'enrollment');
    for (
      const action of ['list', 'detail', 'document', 'review', 'retry_delivery', 'reveal_payout']
    ) await assert.rejects(session.request(action), /complete authentication/);
    const first = await session.beginAuthenticatorSetup();
    assert.equal(first.secret, responseSecret.sharedSecretKey);
    assert.equal('sessionInfo' in first, false);
    assert.deepEqual(await session.beginAuthenticatorSetup(), first);
    assert.equal(starts, 1);
    await assert.rejects(session.finishAuthenticatorSetup('12345'), /6-digit/);
    assert.equal(finalizes, 0);
    await session.finishAuthenticatorSetup('123456');
    assert.equal(finalizes, 1);
    await assert.rejects(session.request('list'), /sign in/);
    await assert.rejects(session.finishAuthenticatorSetup('123456'), /expired/);
  });
});

test('uncertain enrollment reads current account once, never repeats enrollment, and requires fresh sign-in', async () => {
  const events: string[] = [];
  await mockFetch(async (input, init) => {
    const url = String(input);
    if (url.includes('signInWithPassword')) return tokens();
    if (url.includes('admin-applications')) return eligible();
    if (url.includes('mfaEnrollment:start')) return Response.json({ totpSessionInfo: setup() });
    if (url.includes('mfaEnrollment:finalize')) {
      events.push('finalize');
      throw new TypeError('response lost after save');
    }
    if (url.includes('accounts:lookup')) {
      events.push('lookup');
      assert.deepEqual(data(init), { idToken: 'password-token' });
      return Response.json({ users: [{ mfaInfo: factors }] });
    }
    throw new Error('unexpected request');
  }, async () => {
    const session = new AdminSession(config);
    await session.signIn('admin@example.test', 'password');
    await session.beginAuthenticatorSetup();
    await session.finishAuthenticatorSetup('123456');
    assert.deepEqual(events, ['finalize', 'lookup']);
    await assert.rejects(session.request('list'), /sign in/);
    await assert.rejects(session.beginAuthenticatorSetup(), /sign in/);
  });
});

test('inconclusive enrollment lookup clears secrets and never offers a duplicate finalization', async () => {
  let finalizes = 0;
  await mockFetch(async (input) => {
    const url = String(input);
    if (url.includes('signInWithPassword')) return tokens();
    if (url.includes('admin-applications')) return eligible();
    if (url.includes('mfaEnrollment:start')) return Response.json({ totpSessionInfo: setup() });
    if (url.includes('mfaEnrollment:finalize')) {
      finalizes++;
      return Response.json({ error: 'unavailable' }, { status: 503 });
    }
    return Response.json({ error: { message: 'TOKEN_EXPIRED' } }, { status: 401 });
  }, async () => {
    const session = new AdminSession(config);
    await session.signIn('admin@example.test', 'password');
    await session.beginAuthenticatorSetup();
    await assert.rejects(
      session.finishAuthenticatorSetup('123456'),
      (e: unknown) =>
        e instanceof PortalError && e.code === 'ENROLLMENT_UNKNOWN' && e.status === 401,
    );
    await assert.rejects(session.finishAuthenticatorSetup('123456'), /expired/);
    assert.equal(finalizes, 1);
  });
});

test('manual authenticator parameters reject malformed or expired server responses', () => {
  const valid = setup();
  assert.equal(totpEnrollment(valid)?.digits, 6);
  for (
    const changes of [
      { sharedSecretKey: '<script>' },
      { verificationCodeLength: 1 },
      { hashingAlgorithm: 'MD5' },
      { periodSec: 0 },
      { sessionInfo: '' },
      { finalizeEnrollmentTime: new Date(0).toISOString() },
    ]
  ) assert.equal(totpEnrollment({ ...valid, ...changes }), null);
  assert.deepEqual(totpFactors([null, {}, ...factors]), [{
    id: 'factor-1',
    name: 'Personal authenticator',
  }]);
});

test('expired enrollment is cleared and cannot finalize or access application data', async () => {
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  let writes = 0;
  try {
    await mockFetch(async (input) => {
      const url = String(input);
      if (url.includes('signInWithPassword')) return tokens();
      if (url.includes('admin-applications')) return eligible();
      if (url.includes('mfaEnrollment:start')) return Response.json({ totpSessionInfo: setup() });
      writes++;
      return Response.json({});
    }, async () => {
      const session = new AdminSession(config);
      await session.signIn('admin@example.test', 'password');
      await session.beginAuthenticatorSetup();
      now += 301_000;
      await assert.rejects(session.finishAuthenticatorSetup('123456'), /expired/);
      await assert.rejects(session.beginAuthenticatorSetup(), /sign in/);
      await assert.rejects(session.request('detail'), /sign in/);
      assert.equal(writes, 0);
    });
  } finally {
    Date.now = originalNow;
  }
});

test('a late enrollment lookup cannot clear a newer administrator sign-in', async () => {
  let lookups = 0;
  let oldFinish!: (response: Response) => void;
  let signIns = 0;
  await mockFetch(async (input) => {
    const url = String(input);
    if (url.includes('signInWithPassword')) {
      signIns++;
      return tokens();
    }
    if (url.includes('admin-applications')) {
      return signIns === 1 ? eligible() : Response.json({ admin });
    }
    if (url.includes('mfaEnrollment:start')) return Response.json({ totpSessionInfo: setup() });
    if (url.includes('mfaEnrollment:finalize')) throw new TypeError('lost');
    lookups++;
    return new Promise((resolve) => {
      oldFinish = resolve;
    });
  }, async () => {
    const session = new AdminSession(config);
    await session.signIn('admin@example.test', 'password');
    await session.beginAuthenticatorSetup();
    const finishing = session.finishAuthenticatorSetup('123456');
    const rejected = assert.rejects(finishing, /sign in/);
    // Wait for the bounded readback request, then simulate switching accounts.
    for (let i = 0; i < 20 && !lookups; i++) await Promise.resolve();
    assert.equal(lookups, 1);
    session.signOut();
    await session.signIn('admin@example.test', 'new-password');
    oldFinish(Response.json({ users: [{ mfaInfo: factors }] }));
    await rejected;
    assert.deepEqual(await session.request('session'), { admin });
  });
});
