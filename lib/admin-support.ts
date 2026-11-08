export const supportStatusLabels = {
  open: "Received",
  in_progress: "In progress",
  waiting_for_customer: "Awaiting requester",
  resolved: "Resolved",
} as const;
export type SupportStatus = keyof typeof supportStatusLabels;
export type SupportMessage = {
  operation_id: string;
  actor_type: "admin" | "customer" | "partner";
  message: string;
  status: SupportStatus;
  created_at: string;
};
export type SupportRequest = {
  request_id: string;
  reference: string;
  account_type: "customer" | "partner";
  category: string;
  subject: string;
  status: SupportStatus;
  version: number;
  created_at: string;
  updated_at: string;
  owner_uid: string | null;
  owner_email: string | null;
  requester_name: string;
  messages?: SupportMessage[];
};
export type SupportUpdate = Readonly<
  {
    request_id: string;
    operation_id: string;
    expected_version: number;
    status: SupportStatus;
    assignment: "keep" | "me" | "unassigned";
    message: string;
  }
>;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Support data could not be read. Refresh and try again.");
  }
  return value as Record<string, unknown>;
}
function date(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
export function parseSupportRequest(
  value: unknown,
  detail = false,
): SupportRequest {
  const r = record(value);
  if (
    typeof r.request_id !== "string" || !uuid.test(r.request_id) ||
    typeof r.reference !== "string" || !/^KS-[A-F0-9]{16}$/.test(r.reference) ||
    !["customer", "partner"].includes(String(r.account_type)) ||
    !["account", "app", "service", "other"].includes(String(r.category)) ||
    typeof r.subject !== "string" || typeof r.status !== "string" ||
    !Object.hasOwn(supportStatusLabels, r.status) ||
    !Number.isInteger(r.version) || Number(r.version) < 1 ||
    !date(r.created_at) || !date(r.updated_at) ||
    (r.owner_uid !== null && typeof r.owner_uid !== "string") ||
    (r.owner_email !== null && typeof r.owner_email !== "string") ||
    typeof r.requester_name !== "string"
  ) throw new Error("Support data could not be read. Refresh and try again.");
  if (detail) {
    if (
      !Array.isArray(r.messages) || !r.messages.length ||
      r.messages.length > 100
    ) throw new Error("Support history could not be read.");
    const ids = new Set<string>();
    for (const raw of r.messages) {
      const m = record(raw);
      if (
        typeof m.operation_id !== "string" || !uuid.test(m.operation_id) ||
        ids.has(m.operation_id) ||
        !["customer", "partner", "admin"].includes(String(m.actor_type)) ||
        typeof m.message !== "string" ||
        !Object.hasOwn(supportStatusLabels, String(m.status)) ||
        !date(m.created_at)
      ) throw new Error("Support history could not be read.");
      ids.add(m.operation_id);
    }
  }
  return r as unknown as SupportRequest;
}
export function parseSupportList(value: unknown) {
  const body = record(value);
  if (
    body.ok !== true || !Array.isArray(body.requests) ||
    body.requests.length > 20 || typeof body.has_more !== "boolean"
  ) throw new Error("Support queue could not be read.");
  const requests = body.requests.map((r) => parseSupportRequest(r));
  if (new Set(requests.map((r) => r.request_id)).size !== requests.length) {
    throw new Error("Support queue could not be read.");
  }
  return { requests, hasMore: body.has_more };
}
export function supportUpdate(
  request: SupportRequest,
  status: SupportStatus,
  assignment: SupportUpdate["assignment"],
  message: string,
): SupportUpdate {
  return Object.freeze({
    request_id: request.request_id,
    operation_id: crypto.randomUUID(),
    expected_version: request.version,
    status,
    assignment,
    message: message.trim(),
  });
}
