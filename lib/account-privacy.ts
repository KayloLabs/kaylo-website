export type PrivacyAccountType = 'customer' | 'partner';
export type PrivacyStatus = 'requested' | 'review_required' | 'processing' | 'completed';
export type PrivacyRequest = {
  reference: string;
  status: PrivacyStatus;
  requested_at: string;
  completed_at?: string;
};
export type CodeDelivery = { expiresInSeconds: number; retryAfterSeconds: number };
export const PRIVACY_API = process.env.NEXT_PUBLIC_PRIVACY_API_URL ?? 'https://jeiwfvnkxubykrzjzktm.supabase.co/functions/v1/account-privacy';
export const privacyEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const statuses = new Set<PrivacyStatus>(['requested', 'review_required', 'processing', 'completed']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PrivacyRequestError extends Error {
  retryAfterSeconds?: number;
  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = 'PrivacyRequestError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function boundedSeconds(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 3600 ? value : fallback;
}
function requestIdentity(email: string, accountType: PrivacyAccountType) {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !privacyEmailPattern.test(normalized) || !['customer', 'partner'].includes(accountType)) {
    throw new PrivacyRequestError('Enter the email address used for your Kaylo account.');
  }
  return { email: normalized, account_type: accountType };
}

async function privacyRequest(body: unknown, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
  signal?.addEventListener('abort', cancel, {once: true});
  const timeout = setTimeout(cancel, 15_000);
  try {
    const response = await fetch(PRIVACY_API, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
      cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal,
    });
    const result: unknown = await response.json().catch(() => null);
    const data = result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : null;
    if (!response.ok) {
      const headerDelay = Number(response.headers.get('Retry-After'));
      const delay = boundedSeconds(data?.retry_after_seconds ?? (headerDelay || undefined), 60);
      if (response.status === 429) throw new PrivacyRequestError(`Please wait ${delay} seconds before trying again.`, delay);
      if ([400, 401, 403, 409, 410, 422].includes(response.status)) {
        throw new PrivacyRequestError('The code could not be verified. Check the email address and latest code, or request a new code.');
      }
      throw new PrivacyRequestError('We could not confirm the request. Please retry; use the same details to avoid a duplicate request.');
    }
    if (data?.ok !== true) throw new PrivacyRequestError('We could not confirm the response. Please retry with the same details.');
    return data;
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (error instanceof PrivacyRequestError) throw error;
    throw new PrivacyRequestError('The connection was interrupted. Please retry with the same details, or contact kayloapp@gmail.com.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

export async function requestPrivacyCode(email: string, accountType: PrivacyAccountType, signal?: AbortSignal): Promise<CodeDelivery> {
  const data = await privacyRequest({action: 'request_code', ...requestIdentity(email, accountType)}, signal);
  return {
    expiresInSeconds: boundedSeconds(data.expires_in_seconds, 600),
    retryAfterSeconds: boundedSeconds(data.retry_after_seconds, 60),
  };
}

export function parsePrivacyRequest(value: unknown): PrivacyRequest {
  if (!value || typeof value !== 'object') throw new PrivacyRequestError('The request could not be confirmed. Please retry with the same details.');
  const row = value as Record<string, unknown>;
  if (typeof row.reference !== 'string' || !/^KD-[A-Z0-9-]{6,64}$/.test(row.reference) ||
    !statuses.has(row.status as PrivacyStatus) || typeof row.requested_at !== 'string' || !Number.isFinite(Date.parse(row.requested_at)) ||
    (row.completed_at != null && (typeof row.completed_at !== 'string' || !Number.isFinite(Date.parse(row.completed_at)))) ||
    (row.status === 'completed' && !row.completed_at)) {
    throw new PrivacyRequestError('The request could not be confirmed. Please retry with the same details.');
  }
  return {reference: row.reference, status: row.status as PrivacyStatus, requested_at: row.requested_at,
    ...(typeof row.completed_at === 'string' ? {completed_at: row.completed_at} : {})};
}

export async function submitPrivacyRequest(input: {
  email: string; accountType: PrivacyAccountType; code: string; requestId: string; confirmation: string;
}, signal?: AbortSignal): Promise<PrivacyRequest> {
  if (!/^\d{6}$/.test(input.code) || !uuidPattern.test(input.requestId) || input.confirmation !== 'DELETE') {
    throw new PrivacyRequestError('Enter the six-digit code and type DELETE to confirm your request.');
  }
  const data = await privacyRequest({action: 'verify_request', ...requestIdentity(input.email, input.accountType),
    code: input.code, request_id: input.requestId, confirmation: 'DELETE'}, signal);
  return parsePrivacyRequest(data.request);
}

export const privacyStatusLabels: Record<PrivacyStatus, string> = {
  requested: 'Request received', review_required: 'Review needed', processing: 'Deletion in progress', completed: 'Deletion completed',
};
export const privacyStatusDescriptions: Record<PrivacyStatus, string> = {
  requested: 'Your verified request is saved for the Kaylo team. Your account has not yet been deleted. Keep the reference below for any follow-up.',
  review_required: 'Your request is saved. Kaylo needs to review an account, booking or payment obligation before completing deletion. Contact support with this reference for the next step.',
  processing: 'Your request is being processed. This is not yet confirmation that all eligible records have been removed. Keep your reference for any follow-up.',
  completed: 'Deletion of eligible Kaylo account data is complete. Any necessary retained records, device-local prescriptions and previously shared copies are subject to the limits described on this page.',
};
