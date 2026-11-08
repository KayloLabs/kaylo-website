import { parsePrivacyRequest, type PrivacyAccountType, type PrivacyRequest } from './account-privacy.ts';

export type AdminPrivacyRequest = PrivacyRequest & {
  request_id: string;
  account_type: PrivacyAccountType;
  email: string | null;
  blockers: string[];
  last_error: string | null;
};
export function parseAdminPrivacyRequest(value: unknown): AdminPrivacyRequest {
  const base = parsePrivacyRequest(value);
  const row = value as Record<string, unknown>;
  if (typeof row.request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.request_id) ||
    !['customer', 'partner'].includes(row.account_type as string) ||
    (row.email !== null && (typeof row.email !== 'string' || row.email.length > 254)) ||
    !Array.isArray(row.blockers) || row.blockers.length > 20 || row.blockers.some(item => typeof item !== 'string' || item.length > 160) ||
    (row.last_error !== null && (typeof row.last_error !== 'string' || row.last_error.length > 1000))) throw new Error('Privacy request details could not be read. Refresh before proceeding.');
  return {...base, request_id: row.request_id, account_type: row.account_type as PrivacyAccountType,
    email: row.email as string | null, blockers: row.blockers as string[], last_error: row.last_error as string | null};
}
export function parseAdminPrivacyList(value: unknown): AdminPrivacyRequest[] {
  const result = value as {ok?: unknown; requests?: unknown} | null;
  if (result?.ok !== true || !Array.isArray(result.requests) || result.requests.length > 50) throw new Error('Privacy requests could not be read. Please refresh.');
  const rows = result.requests.map(parseAdminPrivacyRequest);
  if (new Set(rows.map(row => row.request_id)).size !== rows.length) throw new Error('Privacy requests could not be read. Please refresh.');
  return rows;
}
const blockerDescriptions: Record<string, string> = {
  active_bookings: 'An active booking needs to finish or be cancelled.',
  unresolved_payments: 'A payment needs resolution.',
  unresolved_refunds: 'A refund needs resolution.',
  open_disputes: 'A dispute is still open.',
  unsettled_earnings: 'Partner earnings need reconciliation.',
  identity_verification: 'Account ownership needs another verification step. Contact the applicant through the approved support process.',
  cash_balance: 'A cash commission balance needs reconciliation.',
  credential_issuance_pending: 'Partner sign-in issuance is still in progress and must finish or be resolved.',
  delivery_in_progress: 'An email or document upload is still in progress. Refresh after it finishes.',
  open_dispute: 'A dispute is still open.',
  refund_pending: 'A refund needs resolution.',
  payment_review: 'A payment or captured charge needs reconciliation.',
  payout_review: 'Partner payout needs verified resolution before deletion can finish.',
  admin_account: 'An administrator account needs an owner-assisted review.',
};
export function privacyBlockerDescription(code: string): string {
  return blockerDescriptions[code.toLowerCase()] ?? 'An account obligation needs review before deletion can finish.';
}
