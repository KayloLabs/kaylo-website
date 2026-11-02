import type { AdminSession, FinanceAction } from './admin-api';

export type FinanceSummary = {
  booking_id: string; policy_version: string; booking_stage: string;
  payment_mode: string; amount: number; currency: string; payment_state: string;
  can_pay: boolean; request_expires_at: string | null; payment_due_at: string | null;
  customer_id: string; worker_id: string;
  cancellation: { actor: string; reason: string; policy_version: string; cancelled_at: string } | null;
  refunds: { id: string; state: string; amount: number; currency: string; reference: string | null; processed_at: string | null }[];
  dispute: { id: string; state: string; reason: string; opened_at: string; resolution: string | null } | null;
};
export type FinanceDetail = FinanceSummary & {
  payments: { payment_id: string; amount: number; status: string; method: string; order_id: string | null; gateway_payment_id: string | null; paid_at: string | null; capture: Record<string, unknown> | null; recovery: { state?: string; reason?: string } | null }[];
  dispute_detail: { resolution_note?: string; resolved_at?: string; [key: string]: unknown } | null;
  earning: { gross_paise: number; fee_paise: number; net_paise: number; state: string; completed_at: string } | null;
  refund_details: { refund_request_id: string; payment_id: string; state: string; amount_paise?: number; gateway_refund_id?: string; last_error?: string; created_at?: string }[];
};
export type FinanceList = { items: FinanceSummary[]; next_after: string | null };
export type ReconciliationException = {
  kind: 'local' | 'payments' | 'refunds' | 'settlements'; provider_id: string;
  booking_id: string | null; amount_paise: number; reason: string;
  reviews: { review_id: string; note: string; operator_reference: string; created_at: string }[] | null;
};
export type ReconciliationReport = {
  run: { run_id: string; report_date: string; provider_mode: string; status: string; phase: string; last_error: string | null; completed_at: string | null };
  summary: { observed: number; matched: number; exceptions: number };
  exceptions: ReconciliationException[];
};
export type FinanceWriteAction = Extract<FinanceAction, 'refund' | 'resolve_dispute' | 'replay_refund' | 'review_exception' | 'retry_reconciliation'>;
export type FinanceCommand = {
  action: FinanceWriteAction; params: Record<string, unknown>; requestId: string;
  title: string; description: string; amount: number | null; currency: string;
  bookingId?: string; reportDate?: string; reportOffset?: number; note: string;
};
/** Backend money projections are rupees; only fields named *_paise are minor units. */
export function formatMoney(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}
export function financeWriteBody(command: FinanceCommand) {
  const note = command.note.trim();
  if (note.length < 5 || note.length > 500) throw new Error('Add a reason between 5 and 500 characters.');
  return { ...command.params, request_id: command.requestId, note };
}
export function readableState(value?: string | null) {
  if (!value) return 'Not available';
  return value.replaceAll('_', ' ').replace(/^\w/, letter => letter.toUpperCase());
}

export function reconciliationKindLabel(kind: ReconciliationException['kind']) {
  return kind === 'local' ? 'Local payment checks' : readableState(kind);
}

/** Read back the original target, even if the operator changes filters meanwhile. */
export async function readFinanceCommand(session: AdminSession, command: FinanceCommand) {
  if (command.bookingId) {
    const detail = await session.financeRequest<FinanceDetail>('detail', { booking_id: command.bookingId });
    if (detail.booking_id !== command.bookingId) throw new Error('The original booking could not be verified. Check again before retrying.');
    return { kind: 'booking' as const, detail };
  }
  const value = await session.financeRequest<{ result: ReconciliationReport | null }>('reconciliation', {
    ...(command.reportDate ? { report_date: command.reportDate } : {}), offset: command.reportOffset ?? 0,
  });
  if (!value.result || value.result.run.run_id !== command.params.run_id) throw new Error('The original reconciliation report could not be verified. Check again before retrying.');
  return { kind: 'report' as const, report: value.result };
}
