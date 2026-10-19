export type AppKind = 'customer' | 'partner';
export type Release = { app: AppKind; version: string; bytes: number; builtAt: string; flavor: string };
export type Manifest = Partial<Record<AppKind, Release>>;
export type DownloadGrant = { file: string; bytes: number; sha256: string; parts: {url: string; bytes: number; sha256: string}[] };
export const APK_API = process.env.NEXT_PUBLIC_APK_API_URL ?? 'https://jeiwfvnkxubykrzjzktm.supabase.co/functions/v1/apk-download';

export class DownloadError extends Error {
  status: number;
  constructor(message: string, status = 0) { super(message); this.status = status; }
}
export async function apkRequest<T>(route: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${APK_API}/${route}`, {method: body ? 'POST' : 'GET',
      headers: body ? {'Content-Type': 'application/json'} : {},
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(20_000), referrerPolicy: 'no-referrer'});
  } catch { throw new DownloadError('Could not connect. Check your internet connection and try again.'); }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = response.status === 401 ? 'That password is incorrect, or your download session has expired.'
      : response.status === 429 ? 'Too many attempts. Please wait ten minutes before trying again.'
      : response.status === 404 ? 'The apps are being prepared. Please try again shortly.'
      : 'Downloads are temporarily unavailable. Please try again.';
    throw new DownloadError(message, response.status);
  }
  if (!result) throw new DownloadError('Could not read the download details. Please retry.');
  return result as T;
}
export function validateGrant(grant: DownloadGrant, app: AppKind, api = APK_API): boolean {
  if (!grant || grant.file !== `kaylo-${app}.apk` || !/^[a-f0-9]{64}$/.test(grant.sha256) ||
    !Number.isSafeInteger(grant.bytes) || grant.bytes <= 0 || grant.bytes > 256 * 1024 * 1024 ||
    !Array.isArray(grant.parts) || grant.parts.length < 1 || grant.parts.length > 8) return false;
  let bytes = 0;
  for (const part of grant.parts) {
    if (!Number.isSafeInteger(part.bytes) || part.bytes <= 0 || part.bytes > 32 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(part.sha256)) return false;
    try {
      const url = new URL(part.url);
      if (url.protocol !== 'https:' || url.origin !== new URL(api).origin ||
        !url.pathname.startsWith('/storage/v1/object/sign/apks/') || url.username || url.password) return false;
    } catch { return false; }
    bytes += part.bytes;
  }
  return bytes === grant.bytes;
}
async function digest(data: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), b => b.toString(16).padStart(2, '0')).join('');
}
/** Never offer an incomplete or corrupted APK for installation. */
export async function fetchApk(grant: DownloadGrant, app: AppKind, onProgress: (progress: number) => void, signal: AbortSignal): Promise<Blob> {
  if (!validateGrant(grant, app)) throw new DownloadError('The download details are invalid. Please retry.');
  const buffers: ArrayBuffer[] = [];
  let total = 0;
  for (const part of grant.parts) {
    const response = await fetch(part.url, {signal, cache: 'no-store', referrerPolicy: 'no-referrer'});
    if (!response.ok || !response.body) throw new DownloadError('The download was interrupted. Please try again.');
    const reader = response.body.getReader();
    const bytes = new Uint8Array(part.bytes);
    let offset = 0;
    try {
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        if (offset + value.length > bytes.length) throw new DownloadError('The download size is invalid. Please retry.');
        bytes.set(value, offset); offset += value.length; total += value.length;
        onProgress(Math.min(99, Math.floor(total / grant.bytes * 100)));
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    if (offset !== part.bytes || await digest(bytes.buffer) !== part.sha256) throw new DownloadError('The download could not be verified. Please retry.');
    buffers.push(bytes.buffer);
  }
  signal.throwIfAborted();
  const apk = new Blob(buffers, {type: 'application/vnd.android.package-archive'});
  if (apk.size !== grant.bytes || await digest(await apk.arrayBuffer()) !== grant.sha256) throw new DownloadError('The APK could not be verified. Please retry.');
  onProgress(100);
  return apk;
}
export function fileSize(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
