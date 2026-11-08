import test from "node:test";
import assert from "node:assert/strict";
import { AdminSession, PortalError } from "./admin-api.ts";
import {
  parseSupportList,
  parseSupportRequest,
  supportUpdate,
} from "./admin-support.ts";
const config = {
  firebaseApiKey: "public",
  supabaseUrl: "https://project.supabase.co",
  supabaseAnonKey: "anon",
};
const row = {
  request_id: "11111111-1111-4111-8111-111111111111",
  reference: "KS-1234567890ABCDEF",
  account_type: "customer",
  category: "app",
  subject: "Help with app",
  status: "open",
  version: 1,
  created_at: "2026-11-08T01:00:00Z",
  updated_at: "2026-11-08T01:00:00Z",
  owner_uid: null,
  owner_email: null,
  requester_name: "Customer",
};
test("support receipt parser rejects malformed references, unknown statuses and duplicate rows", () => {
  assert.equal(parseSupportRequest(row).request_id, row.request_id);
  for (
    const invalid of [
      { ...row, reference: "fake" },
      { ...row, status: "paid" },
      { ...row, version: 0 },
    ]
  ) assert.throws(() => parseSupportRequest(invalid));
  assert.throws(() =>
    parseSupportList({ ok: true, requests: [row, row], has_more: false })
  );
  assert.throws(() => parseSupportRequest({ ...row, messages: [] }, true));
  const command = supportUpdate(
    parseSupportRequest(row),
    "in_progress",
    "me",
    "Hello",
  );
  assert.ok(Object.isFrozen(command));
  assert.equal(command.expected_version, 1);
});
test("support transport requires admin access and treats interrupted writes as unknown without replay", async (t) => {
  let operations = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string, init: RequestInit) => {
      if (String(input).includes("signInWithPassword")) {
        return Response.json({
          idToken: "token",
          refreshToken: "refresh",
          expiresIn: 3600,
        });
      }
      if (JSON.parse(String(init.body)).action === "session") {
        return Response.json({
          admin: { email: "admin@example.com", role: "admin" },
        });
      }
      assert.equal(
        String(input),
        "https://project.supabase.co/functions/v1/support-requests",
      );
      operations++;
      throw new TypeError("Interrupted after transaction");
    },
  );
  const session = new AdminSession(config);
  await assert.rejects(
    session.supportRequest("admin_list"),
    (e: unknown) => e instanceof PortalError && e.code === "SIGN_IN_REQUIRED",
  );
  await session.signIn("admin@example.com", "password");
  await assert.rejects(
    session.supportRequest("admin_update", { request_id: row.request_id }),
    (e: unknown) => e instanceof PortalError && e.outcomeUnknown,
  );
  assert.equal(operations, 1);
});
test("reviewers cannot access the private support queue", async (t) => {
  let operations = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string, init: RequestInit) => {
      if (String(input).includes("signInWithPassword")) {
        return Response.json({
          idToken: "token",
          refreshToken: "refresh",
          expiresIn: 3600,
        });
      }
      if (JSON.parse(String(init.body)).action === "session") {
        return Response.json({
          admin: { email: "reviewer@example.com", role: "reviewer" },
        });
      }
      operations++;
      return Response.json({ ok: true });
    },
  );
  const session = new AdminSession(config);
  await session.signIn("reviewer@example.com", "password");
  await assert.rejects(
    session.supportRequest("admin_list"),
    (e: unknown) =>
      e instanceof PortalError && e.code === "ADMIN_ROLE_REQUIRED",
  );
  assert.equal(operations, 0);
});
test("support results arriving after sign-out never enter another session", async (t) => {
  let finish!: (r: Response) => void;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string, init: RequestInit) => {
      if (String(input).includes("signInWithPassword")) {
        return Response.json({
          idToken: "token",
          refreshToken: "refresh",
          expiresIn: 3600,
        });
      }
      if (JSON.parse(String(init.body)).action === "session") {
        return Response.json({
          admin: { email: "admin@example.com", role: "admin" },
        });
      }
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    },
  );
  const session = new AdminSession(config);
  await session.signIn("admin@example.com", "password");
  const pending = session.supportRequest("admin_list");
  await Promise.resolve();
  session.signOut();
  finish(Response.json({ ok: true, requests: [row], has_more: false }));
  await assert.rejects(
    pending,
    (e: unknown) => e instanceof PortalError && e.code === "SESSION_CHANGED",
  );
});
