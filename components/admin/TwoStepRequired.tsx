'use client';
import { useState } from 'react';
import { CheckCircle2, KeyRound, LoaderCircle, MailCheck, ShieldCheck } from 'lucide-react';

type Props = {
  area: string;
  email: string;
  emailVerified: boolean;
  onSetup: () => void;
  onSendVerification: () => Promise<void>;
};

/**
 * Shown instead of payments, account deletion and support until this sign-in
 * used an authenticator code. Those areas move money and erase personal data,
 * so the server always asks for a second factor there; the rest of the portal
 * keeps working with a password.
 */
export function TwoStepRequired({ area, email, emailVerified, onSetup, onSendVerification }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function sendLink() {
    if (sending) return;
    setSending(true);
    setError('');
    try {
      await onSendVerification();
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The verification email could not be sent. Please retry.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className='ops-panel ops-two-step' aria-labelledby='ops-two-step-title'>
      <span className='ops-two-step-mark' aria-hidden='true'><ShieldCheck size={22} /></span>
      <p className='ops-eyebrow'>{area}</p>
      <h2 id='ops-two-step-title'>Two-step verification needed</h2>
      <p className='ops-muted'>
        This area moves money or erases personal data, so Kaylo asks for a code from an
        authenticator app as well as your password. Applications stay open without it.
      </p>
      <ol className='ops-two-step-steps'>
        <li className={emailVerified ? 'done' : 'current'}>
          {emailVerified ? <CheckCircle2 size={18} aria-hidden='true' /> : <MailCheck size={18} aria-hidden='true' />}
          <div>
            <strong>Verify your email</strong>
            {emailVerified
              ? <span>{email} is verified.</span>
              : sent
              ? <span role='status'>Link sent to {email}. Open it, then sign in again here.</span>
              : <span>Firebase needs a verified address before an authenticator can be added.</span>}
            {!emailVerified && !sent && (
              <button type='button' className='ops-button' onClick={sendLink} disabled={sending}>
                {sending
                  ? <span className='ops-loading'><LoaderCircle size={16} aria-hidden='true' /> Sending…</span>
                  : 'Email me a verification link'}
              </button>
            )}
          </div>
        </li>
        <li className={emailVerified ? 'current' : 'later'}>
          <KeyRound size={18} aria-hidden='true' />
          <div>
            <strong>Add an authenticator</strong>
            <span>
              Sign in with your password, add <em>Kaylo Admin</em> to an authenticator app on your
              phone, then sign in again with its code. It takes about two minutes.
            </span>
            {emailVerified && (
              <button type='button' className='ops-button primary' onClick={onSetup}>
                Set up two-step verification
              </button>
            )}
          </div>
        </li>
      </ol>
      {error && <div role='alert' className='ops-alert'>{error}</div>}
    </section>
  );
}
