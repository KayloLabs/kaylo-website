'use client';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Logo } from '../Logo';
import {
  type Admin,
  type AdminAuthStep,
  AdminSession,
  PortalError,
  type TotpSetup,
} from '../../lib/admin-api';

type Props = {
  session: AdminSession | null;
  ready: boolean;
  connectionError: string;
  retry: () => void;
  onSignedIn: (admin: Admin) => void;
};
export default function AdminSignIn({ session, ready, connectionError, retry, onSignedIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<AdminAuthStep | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [factor, setFactor] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (step) section.current?.querySelector<HTMLInputElement>('input[data-mfa-focus]')?.focus();
  }, [step?.kind, setup]);
  useEffect(() => {
    if (!step || !session) return;
    const expires = step.kind === 'enrollment'
      ? Math.min(step.expiresAt, setup?.expiresAt ?? Infinity)
      : Date.now() + 5 * 60_000;
    const timer = setTimeout(() => {
      session.signOut();
      setStep(null);
      setSetup(null);
      setCode('');
      setPassword('');
      setError('This sign-in expired. Please sign in again.');
    }, Math.max(0, expires - Date.now()));
    return () => clearTimeout(timer);
  }, [session, step, setup]);
  function reset() {
    session?.signOut();
    setStep(null);
    setSetup(null);
    setPassword('');
    setShow(false);
    setCode('');
    setError('');
    setNotice('');
  }
  function accept(result: Admin | AdminAuthStep) {
    setPassword('');
    setShow(false);
    setCode('');
    if ('kind' in result) {
      setStep(result);
      if (result.kind === 'challenge') setFactor(result.factors[0].id);
    } else onSignedIn(result);
  }
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      if (alive.current) {
        if (e instanceof PortalError && e.status === 401) {
          setStep(null);
          setSetup(null);
          setPassword('');
          setCode('');
        }
        setError(e instanceof Error ? e.message : 'Unable to continue. Please retry.');
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    void run(async () => {
      if (step?.kind === 'challenge') {
        const result = await session.verifyAuthenticator(factor, code);
        if (alive.current) accept(result);
      } else if (step?.kind === 'enrollment' && setup) {
        await session.finishAuthenticatorSetup(code);
        if (alive.current) {
          setStep(null);
          setSetup(null);
          setCode('');
          setNotice(
            'Authenticator added. Sign in again with your password and authenticator code.',
          );
        }
      } else {
        const result = await session.signIn(email, password);
        if (alive.current) accept(result);
      }
    });
  }
  const errorMessage = error || connectionError;
  return (
    <main id='main' tabIndex={-1} className='ops-login'>
      <section ref={section} className='ops-login-form'>
        <span className='ops-k-mark'>
          <Logo />
        </span>
        <h1>
          {step?.kind === 'challenge'
            ? 'Check your authenticator'
            : step?.kind === 'enrollment'
            ? 'Secure your admin account'
            : 'Admin sign in'}
        </h1>
        <p>
          {step?.kind === 'challenge'
            ? 'Enter the current code from your authenticator app.'
            : step?.kind === 'enrollment'
            ? 'An authenticator is required before you can open partner applications.'
            : 'Manage partner applications.'}
        </p>
        {notice && <p role='status' className='ops-notice'>{notice}</p>}
        {step?.kind === 'enrollment' && !setup
          ? (
            <div className='ops-mfa-setup'>
              <p>
                Add Kaylo Admin to an authenticator app on your own device. Keep access to that
                device for future sign-ins.
              </p>
              <button
                className='ops-button primary'
                disabled={busy}
                onClick={() => {
                  if (session) {
                    void run(async () => {
                      const value = await session.beginAuthenticatorSetup();
                      if (alive.current) setSetup(value);
                    });
                  }
                }}
              >
                {busy ? 'Preparing…' : 'Set up authenticator'}
              </button>
            </div>
          )
          : (
            <form onSubmit={submit} aria-busy={busy}>
              {!step
                ? (
                  <>
                    <label>
                      Email<input
                        data-admin-autofocus
                        type='email'
                        autoComplete='username'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={busy}
                      />
                    </label>
                    <div className='ops-password-field'>
                      <label htmlFor='ops-login-password'>Password</label>
                      <div className='ops-password-input'>
                        <input
                          id='ops-login-password'
                          type={show ? 'text' : 'password'}
                          autoComplete='current-password'
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={busy}
                        />
                        <button
                          type='button'
                          className='ops-password-toggle'
                          aria-label={show ? 'Hide password' : 'Show password'}
                          aria-controls='ops-login-password'
                          disabled={busy}
                          onClick={() => setShow((v) => !v)}
                        >
                          {show
                            ? <EyeOff size={18} aria-hidden='true' />
                            : <Eye size={18} aria-hidden='true' />}
                        </button>
                      </div>
                    </div>
                  </>
                )
                : (
                  <>
                    {step.kind === 'challenge' && step.factors.length > 1 && (
                      <label>
                        Authenticator<select
                          value={factor}
                          onChange={(e) => {
                            setFactor(e.target.value);
                            setCode('');
                          }}
                          disabled={busy}
                        >
                          {step.factors.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      </label>
                    )}
                    {setup && (
                      <div className='ops-mfa-setup'>
                        <p>
                          In your authenticator, choose{' '}
                          <strong>Enter a setup key</strong>. Name the account{' '}
                          <strong>Kaylo Admin</strong>, choose <strong>time based</strong>{' '}
                          and enter this key:
                        </p>
                        <code className='ops-mfa-key' aria-label='Authenticator setup key'>
                          {setup.secret}
                        </code>
                        <p className='ops-mfa-detail'>
                          {setup.digits} digits · {setup.period}-second interval ·{' '}
                          {setup.algorithm}. Keep this key private.
                        </p>
                      </div>
                    )}
                    <label htmlFor='ops-mfa-code'>
                      Authenticator code<input
                        id='ops-mfa-code'
                        data-mfa-focus
                        inputMode='numeric'
                        autoComplete='one-time-code'
                        pattern={setup ? `[0-9]{${setup.digits}}` : '(?:[0-9]{6}|[0-9]{8})'}
                        maxLength={setup?.digits ?? 8}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                        required
                        disabled={busy}
                        aria-describedby={errorMessage ? 'ops-auth-error' : undefined}
                      />
                    </label>
                  </>
                )}
              <button className='ops-button primary' disabled={busy || !ready}>
                {busy
                  ? (
                    <span className='ops-loading'>
                      <LoaderCircle size={18} aria-hidden='true' /> Working…
                    </span>
                  )
                  : (
                    <>
                      {setup ? 'Confirm authenticator' : step ? 'Verify & sign in' : 'Sign in'}
                      <ArrowRight size={18} aria-hidden='true' />
                    </>
                  )}
              </button>
            </form>
          )}
        {errorMessage && (
          <div id='ops-auth-error' role='alert' className='ops-alert'>{errorMessage}</div>
        )}
        {step && (
          <button type='button' className='ops-text-button' disabled={busy} onClick={reset}>
            Back to sign in
          </button>
        )}
        {!ready && !busy && (
          <button type='button' className='ops-text-button' onClick={retry}>
            Retry connection
          </button>
        )}
        <p className='ops-login-note'>
          <a href='mailto:kayloapp@gmail.com'>Need help?</a>
        </p>
      </section>
    </main>
  );
}
