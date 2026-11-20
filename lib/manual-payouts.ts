import type { AdminSession } from './admin-api.ts';

export type PayoutState = 'prepared' | 'approved' | 'submitted' | 'paid' | 'review_required' | 'cancelled' | 'rejected' | 'reversed';
export type PayoutRead = 'payout_workers' | 'payout_candidates' | 'payout_list' | 'payout_detail';
export type PayoutWrite = 'payout_transfer_details' | 'payout_beneficiary' | 'payout_verify_beneficiary' | 'payout_prepare' | 'payout_approve' | 'payout_record_transfer' | 'payout_reconcile' | 'payout_cancel' | 'payout_reject' | 'payout_request_reversal' | 'payout_confirm_reversal';
export type PayoutAction = PayoutRead | PayoutWrite;
export type Batch = {
  batch_id: string; worker_id: string; partner_id: string; name: string;
  mode: 'test' | 'live'; state: PayoutState; amount_paise: number; currency: 'INR';
  account_last4: string; created_by: string; approved_by: string | null;
  transfer_by: string | null; reconciled_by: string | null; reversal_by: string | null;
  created_at: string; approved_at: string | null; submitted_at: string | null;
  paid_at: string | null; reversed_at: string | null;
  bank_reference: string | null; reversal_reference: string | null;
  beneficiary_verification_id: string; eligible_now: boolean; requires_review: boolean;
};
export type BatchDetail = {
  batch: Batch; items: { earning_id: string; booking_id: string; payment_id: string; net_paise: number }[];
  audit: { action: string; actor_uid: string; note: string; created_at: string }[];
  evidence: { beneficiary_reference: string; verified_by: string; verified_at: string; fingerprint: string; bank_current: boolean; transfer_reference: string | null; reconcile_reference: string | null; reversal_reference: string | null; reversal_confirmation_reference: string | null };
  can_approve: boolean; can_reconcile: boolean; can_confirm_reversal: boolean; eligible_now: boolean;
};
export type PayoutWorker = { worker_id: string; partner_id: string; name: string; eligible_paise: number; eligible_count: number; beneficiary_verified: boolean; account_last4: string | null };
export type Candidate = { earning_id: string; booking_id: string; net_paise: number; completed_at: string };
export type PayoutPage<T> = { items: T[]; next_offset: number | null; mode: 'test' | 'live' };
export type Beneficiary = { worker_id: string; fingerprint: string; bank_account: { account_holder: string; bank_name: string; account_number: string; ifsc: string } };
export type TransferDetails = { batch: Batch; fingerprint: string; bank_account: Beneficiary['bank_account'] };
export type BeneficiaryVerification = { verification_id: string; worker_id: string; fingerprint: string; account_last4: string };
export type PayoutCommand = Readonly<{ action: PayoutWrite; requestId: string; body: Readonly<Record<string, unknown>> }>;

export const payoutActions: Record<PayoutWrite, { title: string; explanation: string; evidence?: boolean; bankReference?: boolean; acknowledgment?: string }> = {
  payout_transfer_details: { title: 'View approved bank instruction', explanation: 'View the immutable beneficiary approved for this batch. This access is audited. Recheck eligibility immediately before making the transfer in your bank.' },
  payout_beneficiary: { title: 'View bank details', explanation: 'This access is recorded. Use these details only to verify the professional’s payout account.' },
  payout_verify_beneficiary: { title: 'Verify bank account', explanation: 'Confirm the account holder, account number and IFSC against the evidence you reviewed.', evidence: true, acknowledgment: 'I checked the account details against independent evidence.' },
  payout_prepare: { title: 'Prepare payout', explanation: 'Reserve the selected eligible earnings. The server calculates the final amount. A different administrator must approve it.' },
  payout_approve: { title: 'Approve payout', explanation: 'Review the amount and verified beneficiary before authorising the manual bank transfer.', acknowledgment: 'I reviewed the earnings and the verified beneficiary.' },
  payout_record_transfer: { title: 'Record bank transfer', explanation: 'Record a transfer already made in your bank. This action does not send money or mark the professional paid.', evidence: true, bankReference: true, acknowledgment: 'The bank transfer has actually been made and this reference belongs to it.' },
  payout_reconcile: { title: 'Confirm bank settlement', explanation: 'Independently check the bank evidence. Only a successfully reconciled transfer becomes paid.', evidence: true, acknowledgment: 'I independently confirmed the full amount and beneficiary against bank evidence.' },
  payout_cancel: { title: 'Cancel payout preparation', explanation: 'Release reserved earnings before a transfer is recorded. This cannot cancel a bank transaction.' },
  payout_reject: { title: 'Reject payout', explanation: 'Decline this preparation and release its reserved earnings. Record the reason for the preparer.' },
  payout_request_reversal: { title: 'Record returned funds', explanation: 'Record an actual full return identified in the bank statement. Another administrator must confirm it. This does not request a bank reversal.', evidence: true, bankReference: true, acknowledgment: 'The full payout amount has actually returned to Kaylo’s bank account.' },
  payout_confirm_reversal: { title: 'Confirm returned funds', explanation: 'Independently verify the full return against bank evidence before releasing the reservation.', evidence: true, acknowledgment: 'I independently verified the complete return of funds.' },
};
const fields: Record<PayoutWrite, readonly string[]> = {
  payout_transfer_details: ['batch_id'], payout_beneficiary: ['worker_id'], payout_verify_beneficiary: ['worker_id', 'fingerprint', 'evidence_reference'],
  payout_prepare: ['worker_id', 'beneficiary_verification_id', 'earning_ids'],
  payout_approve: ['batch_id'], payout_record_transfer: ['batch_id', 'bank_reference', 'evidence_reference'],
  payout_reconcile: ['batch_id', 'evidence_reference'], payout_cancel: ['batch_id'], payout_reject: ['batch_id'],
  payout_request_reversal: ['batch_id', 'bank_reference', 'evidence_reference'], payout_confirm_reversal: ['batch_id', 'evidence_reference'],
};
export function payoutCommand(action: PayoutWrite, requestId: string, params: Record<string, unknown>, note: string): PayoutCommand {
  const reason = note.trim();
  if (reason.length < 5 || reason.length > 500) throw new Error('Add an audit note between 5 and 500 characters.');
  const body: Record<string, unknown> = { request_id: requestId, note: reason };
  for (const key of fields[action]) {
    const value = params[key];
    if (key === 'earning_ids') {
      if (!Array.isArray(value) || value.length < 1 || value.length > 100 || new Set(value).size !== value.length || value.some(id => typeof id !== 'string')) throw new Error('Choose between 1 and 100 distinct earnings.');
      body[key] = Object.freeze([...value]);
    } else {
      if (typeof value !== 'string' || !value.trim()) throw new Error('Complete all required fields.');
      const text = value.trim();
      if (key === 'evidence_reference' && (text.length < 3 || text.length > 180)) throw new Error('Use an evidence reference between 3 and 180 characters.');
      if (key === 'bank_reference' && !/^[a-zA-Z0-9/-]{6,80}$/.test(text)) throw new Error('Use the bank reference, 6–80 letters, digits, hyphens or slashes.');
      body[key] = text;
    }
  }
  return Object.freeze({ action, requestId, body: Object.freeze(body) });
}
export function availablePayoutActions(detail: BatchDetail): PayoutWrite[] {
  const { batch, eligible_now } = detail;
  const result: PayoutWrite[] = [];
  if (batch.state === 'prepared') {
    if (detail.can_approve && eligible_now) result.push('payout_approve');
    result.push('payout_reject', 'payout_cancel');
  }
  if (batch.state === 'approved') {
    if (eligible_now) result.push('payout_transfer_details');
    result.push('payout_record_transfer', 'payout_cancel');
  }
  if (['submitted', 'review_required'].includes(batch.state) && batch.bank_reference && !batch.reversal_reference && detail.can_reconcile && eligible_now) result.push('payout_reconcile');
  if (['submitted', 'paid', 'review_required'].includes(batch.state) && batch.bank_reference && !batch.reversal_reference) result.push('payout_request_reversal');
  if (batch.state === 'review_required' && batch.reversal_reference && detail.can_confirm_reversal) result.push('payout_confirm_reversal');
  return result;
}
/** Never automatically resend a money decision. Caller retains this exact command on failure. */
export async function executePayout<T>(session: AdminSession, command: PayoutCommand): Promise<T> {
  const reply = await session.financeRequest<{ ok: true; result: T }>(command.action, { ...command.body });
  if (reply.ok !== true || reply.result == null) throw new Error('The operation returned an incomplete result. Check the payout before repeating it.');
  return reply.result;
}
