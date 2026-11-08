"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { AdminSession, formatDate, PortalError } from "@/lib/admin-api";
import {
  parseSupportList,
  parseSupportRequest,
  type SupportRequest,
  type SupportStatus,
  supportStatusLabels,
  type SupportUpdate,
  supportUpdate,
} from "@/lib/admin-support";

export function SupportPanel(
  { session, onError, onPendingChange }: {
    session: AdminSession;
    onError: (e: unknown) => void;
    onPendingChange: (pending: boolean) => void;
  },
) {
  const [rows, setRows] = useState<SupportRequest[]>([]),
    [offset, setOffset] = useState(0),
    [filter, setFilter] = useState<SupportStatus | "">("open");
  const [hasMore, setHasMore] = useState(false),
    [loading, setLoading] = useState(false),
    [writing, setWriting] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<SupportRequest>(),
    [status, setStatus] = useState<SupportStatus>("in_progress"),
    [assignment, setAssignment] = useState<SupportUpdate["assignment"]>("keep"),
    [reply, setReply] = useState("");
  const [pending, setPending] = useState<SupportUpdate>();
  const mounted = useRef(true),
    generation = useRef(0),
    submitting = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    onPendingChange(writing || !!pending);
    return () => onPendingChange(false);
  }, [writing, pending, onPendingChange]);
  const report = useCallback((e: unknown) => {
    if (
      e instanceof PortalError &&
      (e.status === 401 ||
        [
          "ADMIN_MFA_REQUIRED",
          "ADMIN_ACCESS_REQUIRED",
          "ADMIN_ROLE_REQUIRED",
          "ADMIN_EMAIL_VERIFICATION_REQUIRED",
        ].includes(e.code))
    ) onError(e);
    if (mounted.current) {
      setError(
        e instanceof Error
          ? e.message
          : "Support could not be loaded. Refresh and try again.",
      );
    }
  }, [onError]);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    // The prior page never masquerades as the selected status/page.
    setRows([]);
    try {
      const page = parseSupportList(
        await session.supportRequest("admin_list", { status: filter, offset }),
      );
      if (!mounted.current || current !== generation.current) return;
      setRows(page.requests);
      setHasMore(page.hasMore);
    } catch (e) {
      if (mounted.current && current === generation.current) report(e);
    } finally {
      if (mounted.current && current === generation.current) setLoading(false);
    }
  }, [filter, offset, report, session]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  async function open(id: string) {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await session.supportRequest<
        { ok: boolean; request: unknown }
      >("admin_detail", { request_id: id });
      const request = parseSupportRequest(response.request, true);
      if (!response.ok || request.request_id !== id) {
        throw new Error(
          "Support request could not be verified. Refresh and try again.",
        );
      }
      if (!mounted.current || current !== generation.current) return;
      setSelected(request);
      setStatus(request.status);
      setAssignment("keep");
      setReply("");
    } catch (e) {
      if (mounted.current && current === generation.current) report(e);
    } finally {
      if (mounted.current && current === generation.current) setLoading(false);
    }
  }
  async function save() {
    if (!selected || submitting.current) return;
    const command = pending ??
      supportUpdate(selected, status, assignment, reply);
    if (
      command.message.length > 4000 ||
      (["waiting_for_customer", "resolved"].includes(command.status) &&
        !command.message)
    ) return;
    submitting.current = true;
    setWriting(true);
    setError("");
    setNotice("");
    try {
      const response = await session.supportRequest<
        { ok: boolean; request: unknown }
      >("admin_update", { ...command });
      let result: SupportRequest;
      try {
        result = parseSupportRequest(response.request, true);
        if (
          response.ok !== true || result.request_id !== command.request_id ||
          !result.messages?.some((m) => m.operation_id === command.operation_id)
        ) throw new Error("Unconfirmed");
      } catch {
        throw new PortalError(
          "The update is unconfirmed. Retry the same update to check its saved result.",
          0,
          "SUPPORT_UNCONFIRMED",
          true,
        );
      }
      if (!mounted.current) return;
      setPending(undefined);
      setSelected(result);
      setStatus(result.status);
      setAssignment("keep");
      setReply("");
      setNotice(`Saved ${result.reference}.`);
      void refresh();
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof PortalError && e.outcomeUnknown) setPending(command);
      else setPending(undefined);
      report(e);
    } finally {
      submitting.current = false;
      if (mounted.current) setWriting(false);
    }
  }
  const locked = writing || !!pending;
  return (
    <section className="support-ops">
      <div className="ops-page-heading">
        <div>
          <h1>General support</h1>
          <p>
            Customer and partner questions. Booking disputes and refunds stay in
            Payments &amp; resolutions.
          </p>
        </div>
        <button
          className="ops-button"
          disabled={loading || locked}
          onClick={() =>
            void (selected ? open(selected.request_id) : refresh())}
        >
          <RefreshCw size={15} aria-hidden="true" />Refresh
        </button>
      </div>
      {error && <div className="ops-alert" role="alert">{error}</div>}
      {notice && <div className="ops-notice" role="status">{notice}</div>}
      {pending && (
        <p className="ops-alert" role="status">
          The update may already be saved. Its fields are locked. Retry the same
          update to confirm the result without creating another reply.
        </p>
      )}
      {selected
        ? (
          <div className="support-detail">
            <button
              className="ops-text-button"
              disabled={locked || loading}
              onClick={() => {
                setSelected(undefined);
                setReply("");
                setError("");
                void refresh();
              }}
            >
              ← Support queue
            </button>
            <h2>{selected.reference}: {selected.subject}</h2>
            <p>
              {selected.requester_name} · {selected.account_type === "partner"
                ? "Kaylo Partner"
                : "Kaylo Customer"} · {supportStatusLabels[selected.status]}
              {" "}
              · Owner: {selected.owner_email || "Unassigned"}
            </p>
            <ol className="support-history" aria-label="Request history">
              {selected.messages?.map((message) => (
                <li key={message.operation_id}>
                  <div>
                    <strong>
                      {message.actor_type === "admin"
                        ? "Kaylo support"
                        : "Requester"}
                    </strong>
                    <time dateTime={message.created_at}>
                      {formatDate(message.created_at)}
                    </time>
                    <span>{supportStatusLabels[message.status]}</span>
                  </div>
                  {message.message && <p>{message.message}</p>}
                </li>
              ))}
            </ol>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
              className="support-reply"
            >
              <div className="support-controls">
                <label>
                  Status<select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as SupportStatus)}
                    disabled={locked || loading}
                  >
                    {Object.entries(supportStatusLabels).map((
                      [value, label],
                    ) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>
                  Ownership<select
                    value={assignment}
                    onChange={(e) =>
                      setAssignment(
                        e.target.value as SupportUpdate["assignment"],
                      )}
                    disabled={locked || loading}
                  >
                    <option value="keep">Keep current owner</option>
                    <option value="me">Assign to me</option>
                    <option value="unassigned">Unassign</option>
                  </select>
                </label>
              </div>
              <label htmlFor="support-reply">Reply visible to requester</label>
              <textarea
                id="support-reply"
                rows={5}
                maxLength={4000}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                disabled={locked || loading}
                required={["waiting_for_customer", "resolved"].includes(status)}
              />
              <p className="ops-muted">
                A reply is required when requesting information or resolving a
                request. No email notification is sent; the requester reads
                replies in their app.
              </p>
              <button
                className="ops-button primary"
                disabled={writing || loading ||
                  (!pending &&
                    ["waiting_for_customer", "resolved"].includes(status) &&
                    !reply.trim())}
              >
                {writing
                  ? "Saving…"
                  : pending
                  ? "Retry same update"
                  : "Save update"}
              </button>
            </form>
          </div>
        )
        : (
          <>
            <div className="support-controls">
              <label>
                Status<select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value as SupportStatus | "");
                    setOffset(0);
                  }}
                  disabled={loading || locked}
                >
                  <option value="">All statuses</option>
                  {Object.entries(supportStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            {loading && <p role="status">Loading support requests…</p>}
            <div className="ops-table-wrap" aria-busy={loading}>
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Requester</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th>Updated</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.request_id}>
                      <td>
                        <strong>{row.reference}</strong>
                        <small>{row.subject}</small>
                      </td>
                      <td>
                        {row.requester_name}
                        <small>
                          {row.account_type === "partner"
                            ? "Partner"
                            : "Customer"}
                        </small>
                      </td>
                      <td>{supportStatusLabels[row.status]}</td>
                      <td>{row.owner_email || "Unassigned"}</td>
                      <td>{formatDate(row.updated_at)}</td>
                      <td>
                        <button
                          className="ops-button"
                          disabled={loading}
                          onClick={() => void open(row.request_id)}
                        >
                          Open request
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !error && !rows.length && (
                <p className="ops-empty">No requests match this status.</p>
              )}
            </div>
            <div className="ops-pagination">
              <span>Page {offset / 20 + 1}</span>
              <div>
                <button
                  className="ops-button"
                  disabled={loading || offset === 0}
                  onClick={() => setOffset((value) => Math.max(0, value - 20))}
                >
                  Previous
                </button>
                <button
                  className="ops-button"
                  disabled={loading || !hasMore}
                  onClick={() => setOffset((value) => value + 20)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
    </section>
  );
}
