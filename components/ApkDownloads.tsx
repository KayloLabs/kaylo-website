'use client';
import {useEffect, useRef, useState} from 'react';
import {Check, Download, Eye, EyeOff, LoaderCircle, LockKeyhole, Smartphone} from 'lucide-react';
import {LogoMark} from './Logo';
import {apkRequest, DownloadError, fetchApk, fileSize, type AppKind, type DownloadGrant, type Manifest} from '../lib/apk-download';

export function ApkDownloads() {
  const [manifest, setManifest] = useState<Manifest>({});
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [session, setSession] = useState<{token: string; expiresAt: string} | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<AppKind | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState<Partial<Record<AppKind, string>>>({});
  const [loading, setLoading] = useState(true);
  const controller = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    apkRequest<Manifest>('manifest').then(m => {if (mounted.current) setManifest(m);})
      .catch(e => {if (mounted.current) setError(e.message);})
      .finally(() => {if (mounted.current) setLoading(false);});
    return () => {mounted.current = false; controller.current?.abort(); urls.current.forEach(URL.revokeObjectURL); urls.current = [];};
  }, []);
  async function unlock(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unlocking) return;
    setUnlocking(true); setError('');
    try {
      const result = await apkRequest<{token: string; expiresAt: string}>('unlock', {password});
      if (mounted.current) {setSession(result); setPassword(''); setVisible(false);}
    } catch (e) {if (mounted.current) setError(e instanceof Error ? e.message : 'Please try again.');}
    finally {if (mounted.current) setUnlocking(false);}
  }
  async function download(app: AppKind) {
    if (!session || busy) return;
    if (Date.parse(session.expiresAt) <= Date.now()) {setSession(null); setError('Your download session has expired. Please enter the password again.'); return;}
    const abort = new AbortController(); controller.current = abort;
    setBusy(app); setProgress(0); setError('');
    try {
      const grant = await apkRequest<DownloadGrant>('download', {app, token: session.token});
      abort.signal.throwIfAborted();
      const blob = await fetchApk(grant, app, n => {if (mounted.current) setProgress(n);}, abort.signal);
      abort.signal.throwIfAborted();
      if (!mounted.current) return;
      const url = URL.createObjectURL(blob); urls.current.push(url);
      setReady(previous => ({...previous, [app]: url}));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = grant.file;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
    } catch (e) {
      if (mounted.current && !abort.signal.aborted) {
        if (e instanceof DownloadError && e.status === 401) setSession(null);
        setError(e instanceof DownloadError ? e.message : 'The download was interrupted. Please try again.');
      }
    } finally {if (mounted.current) setBusy(null); controller.current = null;}
  }
  function lock() {
    controller.current?.abort(); setSession(null); setReady({}); setError('');
    urls.current.forEach(URL.revokeObjectURL); urls.current = [];
  }
  return <div className="apk-downloads">
    <div className="apk-access">
      {session ? <div className="apk-unlocked"><span><Check size={20} aria-hidden="true"/> Downloads unlocked</span><button type="button" onClick={lock} disabled={!!busy}>Lock downloads</button></div>
        : <form onSubmit={unlock} className="apk-password-form">
          <label htmlFor="download-password"><LockKeyhole size={18} aria-hidden="true"/> Download password</label>
          <div className="apk-password-row"><div className="apk-password-input"><input id="download-password" type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" autoCapitalize="none" spellCheck={false} maxLength={256} required aria-describedby={error ? 'apk-error' : undefined}/><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div><button className="button" disabled={unlocking || !password}>{unlocking ? <><LoaderCircle className="apk-spinner" size={17}/> Unlocking…</> : 'Unlock downloads'}</button></div>
        </form>}
      {error && <p role="alert" id="apk-error" className="apk-error">{error}</p>}
    </div>
    <div className="apk-apps">
      {(['customer', 'partner'] as const).map(app => {
        const release = manifest[app]; const available = release?.flavor === 'live'; const active = busy === app;
        return <article key={app} className={`apk-app apk-${app}`}>
          <div className="apk-app-brand"><LogoMark/><span>{app === 'customer' ? 'Kaylo' : 'Kaylo Partner'}</span></div>
          <p className="apk-app-description">{app === 'customer' ? 'Find and book local help for your home, farm and loved ones.' : 'Manage your jobs, connect with customers and keep your work moving.'}</p>
          <div className="apk-app-meta"><Smartphone size={16} aria-hidden="true"/><span>Android · ARM64</span><span>{release ? `v${release.version.split('+')[0]} · ${fileSize(release.bytes)}` : loading ? 'Checking latest version…' : 'Coming shortly'}</span></div>
          {ready[app] ? <a className="button apk-download-button" href={ready[app]} download={`kaylo-${app}.apk`}><Download size={18}/> Save APK again</a>
            : <button className="button apk-download-button" disabled={!session || !!busy || !available} onClick={() => void download(app)}>{active ? <><LoaderCircle size={18} className="apk-spinner"/> {progress >= 99 ? 'Verifying…' : `Downloading ${progress}%`}</> : <><Download size={18}/> Download {app === 'customer' ? 'Kaylo' : 'Partner'}</>}</button>}
          {active && <><progress value={progress} max={100} aria-label={`Downloading ${app === 'customer' ? 'Kaylo' : 'Partner'}`}/><button className="apk-cancel" onClick={() => controller.current?.abort()}>Cancel download</button></>}
          <p className="apk-app-status" aria-live="polite">{ready[app] ? 'Your APK is ready. If the download did not start, tap Save APK again.' : !session ? 'Unlock above to download.' : active ? 'Keep this page open while the APK downloads.' : 'Ready to download.'}</p>
        </article>;
      })}
    </div>
    <div className="apk-install"><h2>Install in a few taps.</h2><ol><li>Download the app you need on your Android phone.</li><li>Open the APK from your Downloads folder.</li><li>If Android asks, allow installation from your browser, then tap Install.</li></ol><p>These downloads are for Android phones. APK files cannot be installed on an iPhone.</p></div>
  </div>;
}
