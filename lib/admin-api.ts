import {
  type AdminAuthStep,
  type EnrollmentSession,
  totpEnrollment,
  type TotpFactor,
  totpFactors,
  type TotpSetup,
} from './admin-mfa.ts';
export type { AdminAuthStep, TotpSetup } from './admin-mfa.ts';
import { retryAfterSeconds, uploadRetryMessage } from './retry-feedback.ts';
import publicConfig from '../server/kaylo-public-config.json' with { type: 'json' };
export type PortalConfig = { firebaseApiKey: string; supabaseUrl: string; supabaseAnonKey: string };
export type Admin = { email: string; role: 'admin' | 'reviewer' };
export type Status = 'submitted' | 'under_review' | 'changes_requested' | 'approved' | 'rejected';
export const statuses: Record<Status, string> = {
  submitted: 'Documents pending',
  under_review: 'Ready for review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  rejected: 'Rejected',
};
export { documentNames, requiredDocuments } from './partner-documents.ts';
export type Application = {
  application_id: string;
  reference: string;
  status: Status;
  version: number;
  submitted_at: string;
  reviewed_at?: string;
  review_note?: string;
  worker_id?: string;
  details: {
    role?: 'worker' | 'doctor' | 'caregiver';
    medical_council_number?: string;
    consultation_modes?: string[];
    consultation_fee?: number;
    clinic_address?: string;
    caregiver_training?: string;
    hourly_rate?: number;
    care_services?: string[];
    languages?: string[];
    payout_summary?: { method: 'upi' | 'bank' | 'unavailable'; account_last4?: string };
    full_name: string;
    email: string;
    phone: string;
    profession: string;
    district: string;
    experience_years: number;
    travel_radius_km: number;
    services?: string[];
    upi_id?: string;
    bank_account?: {
      account_holder?: string;
      bank_name?: string;
      account_number?: string;
      ifsc?: string;
    };
  };
};
export type ApplicationSummary =
  & Pick<Application, 'application_id' | 'reference' | 'status' | 'version' | 'submitted_at'>
  & { full_name: string; profession: string; district: string };
export type ApplicationDocument = {
  doc_type: string;
  content_type: string;
  submitted_at: string;
  byte_size: number;
  history?: { history_id: string; uploaded_at: string; storage_path: string }[];
  storage_path?: string;
};
export type Delivery = {
  mail_id: string;
  kind?: string;
  event_type?: string;
  status: string;
  is_current: boolean;
  attempts: number;
  last_error?: string;
  sent_at?: string;
  created_at?: string;
};
export type AuditEvent = {
  event_id?: string;
  action: string;
  actor_uid?: string;
  actor_email?: string;
  created_at: string;
  data?: Record<string, unknown>;
};
export type Certificate = {
  certificate_id: string;
  issued_at: string;
  reference?: string;
  storage_path?: string;
  snapshot?: Record<string, unknown>;
};
export type Detail = {
  application: Application;
  documents: ApplicationDocument[];
  audit: AuditEvent[];
  deliveries: Delivery[];
  certificate: Certificate | null;
};
export type Correction = {
  reference: string;
  status: Status;
  version: number;
  application_version?: number;
  expires_at?: string;
  completed?: boolean;
  requested_documents: { doc_type: string; note: string; received: boolean }[];
};

export class PortalError extends Error {
  status: number;
  code: string;
  outcomeUnknown: boolean;
  constructor(message: string, status = 0, code = '', outcomeUnknown = false) {
    super(message);
    this.name = 'PortalError';
    this.status = status;
    this.code = code;
    this.outcomeUnknown = outcomeUnknown;
  }
}
export type PortalTransportOptions = { timeoutMs?: number; signal?: AbortSignal; write?: boolean };
/** Bound both response headers and body. Aborting a write does not undo its server transaction. */
export async function portalReply(
  input: string,
  init: RequestInit = {},
  options: PortalTransportOptions = {},
) {
  const controller = new AbortController();
  const interrupted = () =>
    options.signal?.reason instanceof PortalError ? options.signal.reason : new PortalError(
      'The request was cancelled. Please retry.',
      0,
      'REQUEST_CANCELLED',
      !!options.write,
    );
  let abortListener: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    abortListener = () => {
      const error = interrupted();
      controller.abort(error);
      reject(error);
    };
    if (options.signal?.aborted) {
      abortListener();
      return;
    }
    options.signal?.addEventListener('abort', abortListener, { once: true });
    timer = setTimeout(() => {
      const error = new PortalError(
        options.write
          ? 'The response did not arrive. The change may already be saved; check its latest status before retrying.'
          : 'The connection took too long. Please retry.',
        0,
        'REQUEST_TIMEOUT',
        !!options.write,
      );
      controller.abort(error);
      reject(error);
    }, options.timeoutMs ?? 20_000);
  });
  try {
    return await Promise.race([
      deadline,
      (async () => {
        controller.signal.throwIfAborted();
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
        });
        const body = await response.json().catch(() => null);
        return { response, body };
      })(),
    ]);
  } catch (error) {
    if (error instanceof PortalError) throw error;
    if (controller.signal.reason instanceof PortalError) throw controller.signal.reason;
    throw new PortalError(
      options.write
        ? 'The connection was interrupted. The change may already be saved; check its latest status before retrying.'
        : 'Could not connect. Check your internet connection and retry.',
      0,
      'CONNECTION_FAILED',
      !!options.write,
    );
  } finally {
    clearTimeout(timer);
    if (abortListener) options.signal?.removeEventListener('abort', abortListener);
  }
}
const messages: Record<string, string> = {
  ADMIN_MFA_REQUIRED: 'Sign in again and enter your authenticator code to access Kaylo Admin.',
  ADMIN_EMAIL_VERIFICATION_REQUIRED:
    'Verify your administrator email before setting up an authenticator.',
  ADMIN_RECENT_SIGN_IN_REQUIRED: 'Please sign in again before setting up your authenticator.',
  ADMIN_MFA_CONFIGURATION_INVALID:
    'Administrator authentication is temporarily unavailable. Contact the project owner.',
  ADMIN_ONLY: 'This account does not have Kaylo administrator access.',
  FORBIDDEN: 'You do not have permission for this action.',
  INVALID_TOKEN: 'Your session has expired. Please sign in again.',
  UNAUTHORIZED: 'Please sign in again.',
  VERSION_CONFLICT:
    'This application changed while you were reviewing it. Refresh it and check the latest documents.',
  APPLICATION_VERSION_CONFLICT:
    'This application changed while you were reviewing it. Refresh it and check the latest documents.',
  ALL_DOCUMENTS_REQUIRED: 'All required documents must be received and reviewed before approval.',
  CORRECTION_NOT_ALLOWED:
    'This correction link has expired or the application has already been updated.',
  CORRECTION_LINK_EXPIRED:
    'This link has expired. Contact Kaylo to request a new document-update link.',
  CORRECTION_LINK_INVALID:
    'This link has been replaced by a newer request. Open the latest Kaylo email.',
  MISSING_DOCUMENT_MUST_BE_REQUESTED: 'Include every missing document in the change request.',
  INVALID_CORRECTION_TOKEN:
    'This correction link is invalid or has expired. Ask Kaylo for a new link.',
  FILE_TOO_LARGE: 'Choose a file smaller than 10 MB.',
  INVALID_FILE_TYPE: 'Use an original JPEG, PNG or PDF file.',
  PORTAL_NOT_CONFIGURED:
    'The review portal is awaiting its backend configuration. Please try again later.',
};
function readResponse(response: Response, body: unknown, write = false) {
  const value = body as
    | { ok?: boolean; error?: { message?: string } | string; code?: string }
    | null;
  if (!response.ok || value?.ok === false) {
    const code = typeof value?.error === 'object' && typeof value.error.message === 'string'
      ? value.error.message
      : typeof value?.code === 'string'
      ? value.code
      : typeof value?.error === 'string'
      ? value.error
      : '';
    throw new PortalError(
      uploadRetryMessage(code, retryAfterSeconds(response, body)) || messages[code] ||
        (response.status === 401
          ? 'Your session has expired. Please sign in again.'
          : response.status === 403
          ? 'This account does not have permission for this action.'
          : response.status === 409
          ? 'The application has changed. Refresh and review it again.'
          : 'We could not complete that request. Your saved application is safe. Please retry.'),
      response.status,
      code,
      write && response.status >= 500,
    );
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new PortalError(
      write
        ? 'The response could not be read. Check the latest status before retrying.'
        : 'The server returned an unreadable response. Please retry.',
      0,
      'UNREADABLE_RESPONSE',
      write,
    );
  }
  return body;
}
export async function loadPortalConfig(): Promise<PortalConfig> {
  const config: PortalConfig = {
    firebaseApiKey: publicConfig.firebaseApiKey,
    supabaseUrl: publicConfig.supabaseUrl,
    supabaseAnonKey: publicConfig.supabaseAnonKey,
  };
  if (!config.firebaseApiKey || !config.supabaseUrl || !config.supabaseAnonKey) {
    throw new PortalError(messages.PORTAL_NOT_CONFIGURED);
  }
  return config;
}
// Tokens stay in memory. Signing out or closing/reloading the tab clears them.
export class AdminSession {
  private token = '';
  private refresh = '';
  private expires = 0;
  private refreshing: Promise<void> | null = null;
  private generation = 0;
  private challenge: { credential: string; factors: TotpFactor[] } | null = null;
  private enrollment: EnrollmentSession | null = null;
  private enrollmentExpires = 0;
  private enrollmentChecking = false;
  private authenticationPending = false;
  private authorized = false;
  private reads = new Map<string, Promise<unknown>>();
  private config: PortalConfig;
  private operations = new Set<AbortController>();
  private timeoutMs: number;
  constructor(config: PortalConfig, options: { timeoutMs?: number } = {}) {
    this.config = config;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }
  private async reply(input: string, init: RequestInit, write = false) {
    const operation = new AbortController();
    this.operations.add(operation);
    try {
      return await portalReply(input, init, {
        timeoutMs: this.timeoutMs,
        signal: operation.signal,
        write,
      });
    } finally {
      this.operations.delete(operation);
    }
  }
  private assertGeneration(generation: number) {
    if (generation !== this.generation) {
      throw new PortalError('Please sign in again.', 401, 'SESSION_CHANGED');
    }
  }
  private setTokens(body: { idToken?: unknown; refreshToken?: unknown; expiresIn?: unknown }) {
    if (
      typeof body?.idToken !== 'string' || !body.idToken ||
      typeof body?.refreshToken !== 'string' || !body.refreshToken
    ) throw new PortalError('Unable to read the sign-in response. Please sign in again.');
    this.token = body.idToken;
    this.refresh = body.refreshToken;
    // MFA finalize has no expiresIn. A normal token refresh supplies it before
    // the first protected call; decoded browser JWT claims never authorize data.
    const seconds = Number(body.expiresIn);
    this.expires = Number.isFinite(seconds) && seconds > 0
      ? Date.now() + Math.min(seconds, 3600) * 1000
      : 0;
  }
  private async resolveSession(): Promise<Admin | AdminAuthStep> {
    const result = await this.request<
      { admin?: Admin; mfa?: { enrollment_required?: boolean; expires_at?: number } }
    >('session');
    if (
      result.mfa?.enrollment_required === true && typeof result.mfa.expires_at === 'number' &&
      result.mfa.expires_at > Date.now()
    ) {
      this.enrollmentExpires = result.mfa.expires_at;
      this.authorized = false;
      return { kind: 'enrollment', expiresAt: this.enrollmentExpires };
    }
    if (
      !result.admin || !['admin', 'reviewer'].includes(result.admin.role) ||
      typeof result.admin.email !== 'string'
    ) throw new PortalError('Unable to confirm administrator access. Please sign in again.');
    this.authorized = true;
    return result.admin;
  }
  async signIn(email: string, password: string): Promise<Admin | AdminAuthStep> {
    this.signOut();
    const generation = this.generation;
    try {
      const { response: r, body: b } = await this.reply(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${
          encodeURIComponent(this.config.firebaseApiKey)
        }`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, returnSecureToken: true }),
        },
      );
      this.assertGeneration(generation);
      if (!r.ok) {
        throw new PortalError(
          b?.error?.message === 'TOO_MANY_ATTEMPTS_TRY_LATER'
            ? 'Too many attempts. Please wait before trying again.'
            : 'Unable to sign in. Check your administrator email and password.',
        );
      }
      if (typeof b?.mfaPendingCredential === 'string' && b.mfaPendingCredential.length > 0) {
        const factors = totpFactors(b.mfaInfo);
        if (!factors.length) {
          throw new PortalError(
            'This account has no supported authenticator. Contact the project owner for recovery.',
          );
        }
        this.challenge = { credential: b.mfaPendingCredential, factors };
        return { kind: 'challenge', factors };
      }
      this.setTokens(b);
      return await this.resolveSession();
    } catch (error) {
      if (generation === this.generation) this.signOut();
      throw error;
    }
  }
  async verifyAuthenticator(factorId: string, code: string): Promise<Admin | AdminAuthStep> {
    const challenge = this.challenge;
    const generation = this.generation;
    if (!challenge || !challenge.factors.some((f) => f.id === factorId)) {
      throw new PortalError('Please sign in again.', 401, 'SESSION_CHANGED');
    }
    if (!/^(?:\d{6}|\d{8})$/.test(code)) {
      throw new PortalError('Enter the code shown in your authenticator.');
    }
    if (this.authenticationPending) {
      throw new PortalError('An authentication request is already in progress.');
    }
    this.authenticationPending = true;
    try {
      const { response, body } = await this.reply(
        `https://identitytoolkit.googleapis.com/v2/accounts/mfaSignIn:finalize?key=${
          encodeURIComponent(this.config.firebaseApiKey)
        }`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mfaPendingCredential: challenge.credential,
            mfaEnrollmentId: factorId,
            totpVerificationInfo: { verificationCode: code },
          }),
        },
      );
      this.assertGeneration(generation);
      if (!response.ok) {
        const error = body?.error?.message;
        if (['INVALID_MFA_PENDING_CREDENTIAL', 'MFA_ENROLLMENT_NOT_FOUND'].includes(error)) {
          this.signOut();
          throw new PortalError(
            'This sign-in has expired. Please sign in again.',
            401,
            'SESSION_CHANGED',
          );
        }
        throw new PortalError(
          error === 'TOO_MANY_ATTEMPTS_TRY_LATER'
            ? 'Too many attempts. Wait before trying again.'
            : 'That code could not be verified. Use the current code in your authenticator.',
        );
      }
      this.challenge = null;
      try {
        this.setTokens(body);
        return await this.resolveSession();
      } catch (error) {
        if (generation === this.generation) this.signOut();
        throw error;
      }
    } finally {
      if (generation === this.generation) this.authenticationPending = false;
    }
  }
  async beginAuthenticatorSetup(): Promise<TotpSetup> {
    const generation = this.generation;
    if (!this.enrollmentExpires || this.enrollmentExpires <= Date.now()) {
      this.signOut();
      throw new PortalError(
        'Please sign in again before setting up your authenticator.',
        401,
        'ADMIN_RECENT_SIGN_IN_REQUIRED',
      );
    }
    if (this.enrollmentChecking || this.authenticationPending) {
      throw new PortalError('An authentication request is already in progress.');
    }
    this.authenticationPending = true;
    try {
      const access = await this.resolveSession();
      this.assertGeneration(generation);
      if (!('kind' in access) || access.kind !== 'enrollment') {
        throw new PortalError('Sign in again to continue.', 401, 'SESSION_CHANGED');
      }
      if (this.enrollment && this.enrollment.expiresAt > Date.now()) return this.setupView();
      const token = await this.accessToken();
      this.assertGeneration(generation);
      const { response, body } = await this.reply(
        `https://identitytoolkit.googleapis.com/v2/accounts/mfaEnrollment:start?key=${
          encodeURIComponent(this.config.firebaseApiKey)
        }`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token, totpEnrollmentInfo: {} }),
        },
      );
      this.assertGeneration(generation);
      if (!response.ok) {
        throw new PortalError(
          body?.error?.message === 'UNVERIFIED_EMAIL'
            ? 'Verify your administrator email before continuing.'
            : 'Authenticator setup is unavailable. The project owner must enable TOTP in Firebase Identity Platform.',
        );
      }
      this.enrollment = totpEnrollment(body?.totpSessionInfo);
      if (!this.enrollment) {
        throw new PortalError('The setup response could not be read. Please retry.');
      }
      return this.setupView();
    } finally {
      if (generation === this.generation) this.authenticationPending = false;
    }
  }
  private setupView(): TotpSetup {
    const { sessionInfo: _, ...setup } = this.enrollment!;
    return setup;
  }
  async finishAuthenticatorSetup(code: string): Promise<void> {
    const enrollment = this.enrollment;
    const generation = this.generation;
    if (!enrollment || enrollment.expiresAt <= Date.now() || this.enrollmentExpires <= Date.now()) {
      this.signOut();
      throw new PortalError(
        'This setup expired. Sign in again to start a new setup.',
        401,
        'ADMIN_RECENT_SIGN_IN_REQUIRED',
      );
    }
    if (!new RegExp(`^\\d{${enrollment.digits}}$`).test(code)) {
      throw new PortalError(`Enter the ${enrollment.digits}-digit authenticator code.`);
    }
    if (this.enrollmentChecking || this.authenticationPending) {
      throw new PortalError('An authentication request is already in progress.');
    }
    this.authenticationPending = true;
    try {
      const token = await this.accessToken();
      this.assertGeneration(generation);
      let response: Response;
      let body: any;
      try {
        ({ response, body } = await this.reply(
          `https://identitytoolkit.googleapis.com/v2/accounts/mfaEnrollment:finalize?key=${
            encodeURIComponent(this.config.firebaseApiKey)
          }`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken: token,
              displayName: 'Kaylo Admin authenticator',
              totpVerificationInfo: { sessionInfo: enrollment.sessionInfo, verificationCode: code },
            }),
          },
          true,
        ));
        this.assertGeneration(generation);
        if (
          response.ok && typeof body?.idToken === 'string' && typeof body?.refreshToken === 'string'
        ) {
          this.signOut();
          return;
        }
        if (response.status < 500 && !response.ok) {
          if (
            [
              'INVALID_MFA_SESSION',
              'SESSION_EXPIRED',
              'CREDENTIAL_TOO_OLD_LOGIN_AGAIN',
              'TOKEN_EXPIRED',
            ].includes(body?.error?.message)
          ) {
            this.signOut();
            throw new PortalError(
              'This setup expired. Please sign in again.',
              401,
              'ADMIN_RECENT_SIGN_IN_REQUIRED',
            );
          }
          throw new PortalError(
            body?.error?.message === 'TOO_MANY_ATTEMPTS_TRY_LATER'
              ? 'Too many attempts. Wait before trying again.'
              : 'That code could not be verified. Use the current code in your authenticator.',
          );
        }
        throw new PortalError('The setup response did not arrive.', 0, 'ENROLLMENT_UNKNOWN', true);
      } catch (error) {
        this.assertGeneration(generation);
        if (!(error instanceof PortalError) || !error.outcomeUnknown) throw error;
        this.enrollmentChecking = true;
        this.enrollment = null;
        // Finalization can succeed after a response is lost. Read the account
        // once; never repeat the enrollment write or expose the secret again.
        let enrolled = false;
        try {
          const check = await this.reply(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${
              encodeURIComponent(this.config.firebaseApiKey)
            }`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken: token }),
            },
          );
          this.assertGeneration(generation);
          enrolled = check.response.ok && totpFactors(check.body?.users?.[0]?.mfaInfo).length > 0;
        } catch {
          this.assertGeneration(generation);
        }
        this.signOut();
        if (enrolled) return;
        throw new PortalError(
          'Setup may already be saved. Sign in again to check; do not add another authenticator yet.',
          401,
          'ENROLLMENT_UNKNOWN',
        );
      }
    } finally {
      if (generation === this.generation) this.authenticationPending = false;
    }
  }
  signOut() {
    this.generation++;
    this.token = '';
    this.refresh = '';
    this.expires = 0;
    this.refreshing = null;
    this.authorized = false;
    this.challenge = null;
    this.enrollment = null;
    this.enrollmentExpires = 0;
    this.enrollmentChecking = false;
    this.authenticationPending = false;
    this.reads.clear();
    for (const operation of this.operations) {
      operation.abort(new PortalError('Please sign in again.', 401, 'SESSION_CHANGED'));
    }
    this.operations.clear();
  }
  private async renewToken() {
    const generation = this.generation;
    const currentRefresh = this.refresh;
    const { response: r, body: b } = await this.reply(
      `https://securetoken.googleapis.com/v1/token?key=${
        encodeURIComponent(this.config.firebaseApiKey)
      }`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: currentRefresh }),
      },
    );
    if (generation !== this.generation) {
      throw new PortalError('Please sign in again.', 401, 'SESSION_CHANGED');
    }
    if (
      !r.ok || this.refresh !== currentRefresh || typeof b?.id_token !== 'string' ||
      typeof b?.refresh_token !== 'string' || !Number.isFinite(Number(b?.expires_in))
    ) {
      this.signOut();
      throw new PortalError('Please sign in again.', 401);
    }
    this.token = b.id_token;
    this.refresh = b.refresh_token;
    this.expires = Date.now() + Number(b.expires_in) * 1000;
  }
  private async accessToken() {
    if (!this.token) throw new PortalError('Please sign in again.', 401);
    if (this.expires - Date.now() < 60000) {
      if (!this.refreshing) {
        const pending = this.renewToken().finally(() => {
          if (this.refreshing === pending) this.refreshing = null;
        });
        this.refreshing = pending;
      }
      await this.refreshing;
    }
    return this.token;
  }
  request<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    if (action !== 'session' && !this.authorized) {
      return Promise.reject(
        new PortalError('Please sign in and complete authentication.', 401, 'SIGN_IN_REQUIRED'),
      );
    }
    // Share only identical reads already in flight. Every later request still
    // checks the live backend role/session; writes and signed document links
    // are never cached or coalesced.
    const key = ['session', 'list', 'detail'].includes(action)
      ? JSON.stringify({ action, ...params })
      : null;
    if (key) {
      const pending = this.reads.get(key);
      if (pending) return pending as Promise<T>;
    } else this.reads.clear();
    const pending = this.send<T>(action, params).finally(() => {
      if (key && this.reads.get(key) === pending) this.reads.delete(key);
    });
    if (key) this.reads.set(key, pending);
    return pending;
  }
  private async send<T>(action: string, params: Record<string, unknown>): Promise<T> {
    const generation = this.generation;
    const token = await this.accessToken();
    if (generation !== this.generation) {
      throw new PortalError('Please sign in again.', 401, 'SESSION_CHANGED');
    }
    const write = ['review', 'retry_delivery'].includes(action);
    try {
      const { response, body } = await this.reply(
        `${this.config.supabaseUrl}/functions/v1/admin-applications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.config.supabaseAnonKey,
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action, ...params }),
        },
        write,
      );
      if (generation !== this.generation) {
        throw new PortalError('Please sign in again.', 401, 'SESSION_CHANGED');
      }
      return readResponse(response, body, write) as T;
    } catch (error) {
      if (generation !== this.generation) {
        throw new PortalError('Please sign in again.', 401, 'SESSION_CHANGED');
      }
      // Never resend an uncertain decision. Read the authoritative revision once.
      if (
        action === 'review' && error instanceof PortalError && error.outcomeUnknown &&
        typeof params.application_id === 'string' && typeof params.expected_version === 'number'
      ) {
        try {
          const latest = await this.send<Detail>('detail', {
            application_id: params.application_id,
          });
          const expectedStatus = params.decision === 'approve'
            ? 'approved'
            : params.decision === 'reject'
            ? 'rejected'
            : params.decision === 'request_changes'
            ? 'changes_requested'
            : null;
          if (
            expectedStatus && latest.application.application_id === params.application_id &&
            latest.application.version > params.expected_version &&
            latest.application.status === expectedStatus
          ) {
            return { reconciled: true, status: expectedStatus } as T;
          }
        } catch {
          if (generation !== this.generation) {
            throw new PortalError('Please sign in again.', 401, 'SESSION_CHANGED');
          }
          // Preserve uncertainty; never turn a failed status read into a retry.
        }
      }
      throw error;
    }
  }
}
export async function correctionRequest(
  config: PortalConfig,
  body: FormData | { token: string },
  options: PortalTransportOptions = {},
): Promise<{ application: Correction }> {
  const form = body instanceof FormData;
  const reply = await portalReply(`${config.supabaseUrl}/functions/v1/application-corrections`, {
    method: 'POST',
    headers: {
      apikey: config.supabaseAnonKey,
      ...(!form ? { 'Content-Type': 'application/json' } : {}),
    },
    body: form ? body : JSON.stringify({ action: 'info', ...body }),
  }, { timeoutMs: form ? 60_000 : 20_000, ...options, write: form });
  return readResponse(reply.response, reply.body, form) as { application: Correction };
}
export function formatDate(value?: string) {
  return value
    ? new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(value))
    : 'Not yet';
}
