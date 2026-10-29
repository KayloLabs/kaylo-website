# Kaylo Admin authenticator rollout

The source supports Firebase TOTP multi-factor authentication. This does **not** mean MFA is active in the live Firebase project or deployed admin function. Confirm the project configuration, function deployment, private flag, administrator enrollment and live sign-in separately.

## Prerequisites

- Firebase Authentication with Identity Platform, email/password sign-in, and TOTP enabled for the project. Firebase requires verified email for MFA. Review the project's actual plan and usage limits before upgrading it; this can affect the whole project's authentication limits.
- The administrator must remain in the active `admin_users` allowlist. Enrollment does not grant administrator access.
- The browser Firebase key must allow Identity Toolkit and Secure Token APIs from the deployed website origin. It identifies the project; it is not an administrator credential.
- Deploy the matching website and `admin-applications` function before enforcement. Existing application/document endpoints must not be exposed through another unguarded function.
- The operator needs an authenticator on their own device and a verified recovery process with the Google Cloud/Firebase project owner.

Official references:

- [Firebase web TOTP guide and project configuration](https://firebase.google.com/docs/auth/web/totp-mfa)
- [Identity Platform upgrade and usage limits](https://firebase.google.com/docs/auth#identity-platform)
- [TOTP enrollment start](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/accounts.mfaEnrollment/start)
- [TOTP enrollment finalize](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/accounts.mfaEnrollment/finalize)
- [TOTP sign-in finalize](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/accounts.mfaSignIn/finalize)
- [Firebase reserved ID-token claims](https://firebase.google.com/docs/reference/admin/node/firebase-admin.auth.decodedidtoken)

## Activation order

1. Deploy the compatible website and admin function while the private Supabase function environment variable `KAYLO_ADMIN_REQUIRE_MFA` is absent or exactly `false`. Existing password access continues; do not describe it as MFA-protected.
2. Verify the intended administrator's email ownership through Firebase's actual verification flow. Do not simply mark an unverified mailbox verified.
3. Enable TOTP in Firebase Identity Platform through an authorized project-owner operation. Do not place project-management credentials in the website.
4. Set the **private function environment variable** `KAYLO_ADMIN_REQUIRE_MFA=true` and verify the deployed function sees it. It must never be a `NEXT_PUBLIC_` variable. Unknown values such as an empty string, `TRUE` or `1` fail closed.
5. Sign in to Kaylo Admin. An allowlisted, email-verified administrator without an enrolled factor receives only setup eligibility after recent password authentication. This response contains no applications, documents, payout information or administrator record. Eligibility expires five minutes after password authentication.
6. Add the displayed setup key to the administrator's authenticator as a time-based account named **Kaylo Admin**. Confirm using its current code. The key and enrollment session stay in tab memory; no third-party QR endpoint is used.
7. Sign in again with password and authenticator code. Confirm list, document and review access. Verify password-only requests to list/detail/document/review/retry/payout actions are rejected. A valid signature alone is not sufficient.
8. Repeat for other active administrators. Do not share accounts or distribute setup secrets through chat, source, tickets or email.

Enforcement validates the Google-signed second-factor claim against a current TOTP enrollment. The existing project, signature, disabled-account, session-revocation and active-allowlist checks remain in force. Changing a browser flag cannot enable access.

## Interrupted setup

A lost enrollment response may mean Firebase enrolled the authenticator. The client reads the account once and never repeats the enrollment write automatically. It clears the secret and requires fresh sign-in. If the lookup cannot settle the result, sign in again before starting another setup. Keep the authenticator entry until the outcome is known.

Invalid codes can be corrected while setup remains valid. Expired password or setup sessions require a new sign-in. The portal does not accept password-reset completion or a frontend “MFA complete” flag as second-factor proof.

## Lost authenticator recovery

There is no public MFA bypass or password-only recovery button. A project owner must independently verify the administrator's identity, record who requested and authorized recovery, revoke existing refresh-token sessions, and remove only the affected MFA enrollment through Firebase's administrative controls. Preserve other valid factors. Record completion without recording secrets or OTPs.

The administrator then signs in and enrolls a new authenticator. Keep `KAYLO_ADMIN_REQUIRE_MFA=true`; do not disable it for routine recovery. If ownership is uncertain, deactivate the `admin_users` entry until resolved. [Firebase administrative factor management](https://firebase.google.com/docs/auth/admin/manage-mfa-users)

## Validation before claiming rollout complete

- Source tests: TOTP protocol, invalid factors/codes, cancellation, unknown enrollment result and memory clearing.
- Backend tests: missing MFA claims, removed factors, verified-email checks, recent enrollment eligibility and protected-action rejection.
- Live owner-assisted test: actual enrollment, second-factor sign-in, sign-out, fresh sign-in and recovery procedure review.
- Confirm live enforcement. Local and mocked tests cannot establish this.

## Review delivery

An admin decision commits its durable email-outbox entry before responding. SMTP work is nudged in the Edge runtime background with a bounded lifetime; the immediate response says delivery is pending. The delivery list remains the authoritative evidence that a message was sent. The same applies to the administrator's retry action. A mail delay must not invite repeated approval.
