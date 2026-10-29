/** Firebase REST DTO validation. These values guide UI only; the backend authorizes access. */
export type TotpFactor = { id: string; name: string };
export type TotpSetup = {
  secret: string;
  digits: number;
  algorithm: string;
  period: number;
  expiresAt: number;
};
export type EnrollmentSession = TotpSetup & { sessionInfo: string };
export type AdminAuthStep = { kind: 'challenge'; factors: TotpFactor[] } | {
  kind: 'enrollment';
  expiresAt: number;
};
export function totpFactors(value: unknown): TotpFactor[] {
  if (!Array.isArray(value)) return [];
  return value.filter((f): f is Record<string, unknown> =>
    !!f && typeof f === 'object' && !Array.isArray(f)
  )
    .filter((f) =>
      typeof f.mfaEnrollmentId === 'string' && f.mfaEnrollmentId.length > 0 &&
      f.mfaEnrollmentId.length <= 256 && !!f.totpInfo && typeof f.totpInfo === 'object'
    )
    .slice(0, 5).map((f, i) => ({
      id: f.mfaEnrollmentId as string,
      name: typeof f.displayName === 'string'
        ? f.displayName.slice(0, 80)
        : `Authenticator ${i + 1}`,
    }));
}
export function totpEnrollment(value: unknown, now = Date.now()): EnrollmentSession | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const expiresAt = typeof v.finalizeEnrollmentTime === 'string'
    ? Date.parse(v.finalizeEnrollmentTime)
    : NaN;
  if (
    typeof v.sharedSecretKey !== 'string' || !/^[A-Z2-7]{16,256}$/.test(v.sharedSecretKey) ||
    typeof v.sessionInfo !== 'string' || v.sessionInfo.length < 1 || v.sessionInfo.length > 8192 ||
    ![6, 8].includes(Number(v.verificationCodeLength)) || typeof v.hashingAlgorithm !== 'string' ||
    !['SHA1', 'SHA256', 'SHA512'].includes(v.hashingAlgorithm) ||
    !Number.isInteger(v.periodSec) || Number(v.periodSec) < 15 || Number(v.periodSec) > 120 ||
    !Number.isFinite(expiresAt) || expiresAt <= now
  ) return null;
  return {
    secret: v.sharedSecretKey,
    digits: Number(v.verificationCodeLength),
    algorithm: v.hashingAlgorithm,
    period: Number(v.periodSec),
    sessionInfo: v.sessionInfo,
    expiresAt,
  };
}
