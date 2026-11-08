'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, Mail } from 'lucide-react';
import { sitePath } from '@/lib/site-path';
import {
  PrivacyRequestError, privacyEmailPattern, privacyStatusDescriptions, privacyStatusLabels,
  requestPrivacyCode, submitPrivacyRequest, type PrivacyAccountType, type PrivacyRequest,
} from '@/lib/account-privacy';

export function AccountDeletionForm() {
  const [email, setEmail] = useState('');
  const [accountType, setAccountType] = useState<PrivacyAccountType>('customer');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState<'email' | 'verify' | 'received'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);
  const [request, setRequest] = useState<PrivacyRequest>();
  const requestId = useRef<string | undefined>(undefined);
  const active = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true);
  const codeInput = useRef<HTMLInputElement>(null);
  const statusHeading = useRef<HTMLHeadingElement>(null);
  const retrySeconds = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const emailValid = email.trim().length <= 254 && privacyEmailPattern.test(email.trim());

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; active.current?.abort(); }; }, []);
  useEffect(() => {
    if (!retryAt) return;
    const tick = () => setNow(Date.now());
    tick(); const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);
  useEffect(() => {
    if (stage === 'verify') codeInput.current?.focus();
    if (stage === 'received') statusHeading.current?.focus();
  }, [stage]);

  function fail(error: unknown) {
    setError(error instanceof PrivacyRequestError ? error.message : 'Please try again, or contact kayloapp@gmail.com.');
    if (error instanceof PrivacyRequestError && error.retryAfterSeconds) {
      setNow(Date.now()); setRetryAt(Date.now() + error.retryAfterSeconds * 1000);
    }
  }
  async function sendCode() {
    if (busy || retrySeconds > 0 || !emailValid) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setNotice('');
    try {
      const sent = await requestPrivacyCode(email, accountType, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      setNow(Date.now()); setRetryAt(Date.now() + sent.retryAfterSeconds * 1000);
      setCode(''); setStage('verify');
      setNotice(`If this email can receive a verification code, check its inbox and spam folder. The code is valid for ${Math.ceil(sent.expiresInSeconds / 60)} minutes. Sending it has not requested deletion.`);
    } catch (error) { if (mounted.current && !controller.signal.aborted) fail(error); }
    finally { if (mounted.current && !controller.signal.aborted) setBusy(false); }
  }
  async function submit() {
    if (busy || !consent || confirmation !== 'DELETE' || !/^\d{6}$/.test(code)) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setNotice('');
    try {
      // Preserve the same ID after an interrupted response; never create a new
      // request merely because the browser did not receive the acknowledgement.
      requestId.current ??= crypto.randomUUID();
      const result = await submitPrivacyRequest({email, accountType, code, confirmation, requestId: requestId.current}, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      setRequest(result); setStage('received'); setCode(''); setConfirmation('');
    } catch (error) { if (mounted.current && !controller.signal.aborted) fail(error); }
    finally { if (mounted.current && !controller.signal.aborted) setBusy(false); }
  }
  function changeEmail() {
    if (busy) return;
    setStage('email'); setCode(''); setConfirmation(''); setConsent(false); setError(''); setNotice('');
    requestId.current = undefined;
  }

  return <section className="deletion-form" aria-labelledby="deletion-form-title" aria-busy={busy}>
    {stage === 'received' && request ? <>
      <div className="deletion-success-icon"><Check size={24} aria-hidden="true"/></div>
      <h2 ref={statusHeading} tabIndex={-1} id="deletion-form-title">{privacyStatusLabels[request.status]}</h2>
      <p role="status">{privacyStatusDescriptions[request.status]}</p>
      <div className="deletion-reference"><span>Your request reference</span><strong>{request.reference}</strong><span>Submitted {new Intl.DateTimeFormat('en-IN', {dateStyle:'medium'}).format(new Date(request.requested_at))}</span></div>
      <p>For an update, email <a href={`mailto:kayloapp@gmail.com?subject=${encodeURIComponent(`Kaylo deletion request ${request.reference}`)}`}>kayloapp@gmail.com</a> and include this reference. Do not send your verification code.</p>
      <a className="privacy-inline-link" href={sitePath('/privacy/#retention')}>Read what may be retained</a>
    </> : <>
      <div className="deletion-step"><span>1</span>Verify email <ArrowRight size={13} aria-hidden="true"/><span>2</span>Submit your request</div>
      <h2 id="deletion-form-title">{stage === 'email' ? 'Start your request' : 'Confirm account deletion'}</h2>
      <p>{stage === 'email' ? 'Use the email associated with your Kaylo account. You do not need either app installed.' : <>Enter the code sent to <span className="deletion-email">{email.trim()}</span>, then confirm your request.</>}</p>
      <form onSubmit={event => {event.preventDefault(); void (stage === 'email' ? sendCode() : submit());}}>
        {stage === 'email' ? <>
          <label htmlFor="privacy-account-type">Which app do you use?</label>
          <select id="privacy-account-type" value={accountType} onChange={event => setAccountType(event.target.value as PrivacyAccountType)} disabled={busy}>
            <option value="customer">Kaylo · Customer</option><option value="partner">Kaylo Partner · Professional</option>
          </select>
          <label htmlFor="privacy-email">Account email</label>
          <input id="privacy-email" type="email" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} required aria-describedby="privacy-email-hint"/>
          <span className="deletion-field-hint" id="privacy-email-hint">We use this email to verify account control and handle your request.</span>
          <button className="button" type="submit" disabled={busy || !emailValid || retrySeconds > 0}>{busy ? <><LoaderCircle className="deletion-spinner" size={18} aria-hidden="true"/>Sending…</> : <><Mail size={18} aria-hidden="true"/>{retrySeconds > 0 ? `Try again in ${retrySeconds}s` : 'Send verification code'}</>}</button>
        </> : <>
          <label htmlFor="privacy-code">Six-digit verification code</label>
          <input ref={codeInput} id="privacy-code" className="deletion-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={event => setCode(event.target.value.replace(/\D/g,''))} disabled={busy} required/>
          <label htmlFor="privacy-confirmation">Type DELETE to confirm</label>
          <input id="privacy-confirmation" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={6} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} required/>
          <label className="deletion-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} required/><span>I request deletion of my Kaylo account and eligible associated data. I understand this includes linked Customer and Partner access, and necessary booking, payment or dispute obligations may need review.</span></label>
          <button type="submit" className="button deletion-danger" disabled={busy || !consent || confirmation !== 'DELETE' || !/^\d{6}$/.test(code)}>{busy ? <><LoaderCircle className="deletion-spinner" size={18} aria-hidden="true"/>Submitting…</> : 'Submit deletion request'}</button>
          <div className="deletion-action-row"><button className="deletion-text-button" type="button" onClick={changeEmail} disabled={busy}>Change email or app</button><button className="deletion-text-button" type="button" onClick={()=>void sendCode()} disabled={busy || retrySeconds > 0}>{retrySeconds > 0 ? `Resend in ${retrySeconds}s` : 'Resend code'}</button></div>
        </>}
      </form>
      {error && <div className="deletion-alert" role="alert">{error}</div>}
      {notice && <p className="deletion-notice" role="status">{notice}</p>}
      <a className="privacy-inline-link" href={sitePath('/privacy/')}>Privacy policy</a>
    </>}
  </section>;
}
