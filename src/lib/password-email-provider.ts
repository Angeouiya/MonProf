import type { RuntimeEnvironment } from "./production-integration-policy";

export type PasswordEmailProvider = "gmail" | "resend";

export type PasswordEmailDispatchSnapshot = Readonly<{
  provider: PasswordEmailProvider;
  senderIdentity: string;
  subject: string;
  text: string;
  html: string | null;
}>;

export function readPasswordEmailProvider(
  environment: RuntimeEnvironment = process.env,
): PasswordEmailProvider | null {
  const value = environment.PASSWORD_EMAIL_PROVIDER?.trim().toLowerCase();
  return value === "gmail" || value === "resend" ? value : null;
}

/**
 * New jobs must have an explicit provider. This prevents a typo or a missing
 * Production variable from silently routing security email through another
 * account.
 */
export function getPasswordEmailProviderForNewJob(
  environment: RuntimeEnvironment = process.env,
): PasswordEmailProvider | null {
  return readPasswordEmailProvider(environment);
}

/**
 * Encrypted v1 jobs predate provider affinity and were always sent through
 * Gmail. V2 jobs persist only their provider. V3 jobs persist the complete
 * dispatch snapshot inside the authenticated ciphertext.
 */
export function getPasswordEmailProviderForPayload(
  payload: {
    version?: unknown;
    provider?: unknown;
    emailSnapshot?: unknown;
  },
): PasswordEmailProvider | null {
  if (payload.version === 1) return "gmail";
  if (payload.version === 2) {
    return payload.provider === "gmail" || payload.provider === "resend"
      ? payload.provider
      : null;
  }
  if (payload.version === 3) {
    return readPasswordEmailDispatchSnapshot(payload.emailSnapshot)?.provider ?? null;
  }
  return null;
}

export function readPasswordEmailDispatchSnapshot(
  value: unknown,
): PasswordEmailDispatchSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snapshot = value as Partial<PasswordEmailDispatchSnapshot>;
  if (
    (snapshot.provider !== "gmail" && snapshot.provider !== "resend")
    || typeof snapshot.senderIdentity !== "string"
    || !snapshot.senderIdentity.trim()
    || /[\r\n]/.test(snapshot.senderIdentity)
    || typeof snapshot.subject !== "string"
    || !snapshot.subject.trim()
    || /[\r\n]/.test(snapshot.subject)
    || typeof snapshot.text !== "string"
    || !snapshot.text
    || (snapshot.html !== null && typeof snapshot.html !== "string")
  ) {
    return null;
  }
  return snapshot as PasswordEmailDispatchSnapshot;
}
