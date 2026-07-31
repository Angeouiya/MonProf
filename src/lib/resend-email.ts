import {
  productionIntegrationsAreEnabled,
  type RuntimeEnvironment,
} from "./production-integration-policy";

const RESEND_SEND_URL = "https://api.resend.com/emails";
const RESEND_REQUEST_TIMEOUT_MS = 10_000;
const EXPECTED_RESEND_DOMAIN = "competence.ci";
const RESEND_USER_AGENT = "competence-password-email/1.0";
const RESEND_API_KEY_PATTERN = /^re_[A-Za-z0-9_-]{8,}$/;
const RESEND_IDEMPOTENCY_KEY_MAX_LENGTH = 256;

type ResendConfig = {
  apiKey: string;
  from: string;
};

export type ResendDeliveryResult = {
  ok: boolean;
  provider: "resend";
  configured: boolean;
  message: string;
  externalId: string | null;
  retryable: boolean;
  ambiguous: boolean;
  statusCode: number | null;
};

export function hasResendEnvironmentConfiguration(
  environment: RuntimeEnvironment = process.env,
) {
  return Boolean(readResendEnvironmentConfig(environment));
}

export function isResendConfigured(
  environment: RuntimeEnvironment = process.env,
) {
  return productionIntegrationsAreEnabled(environment)
    && hasResendEnvironmentConfiguration(environment);
}

export function getResendSenderIdentity(
  environment: RuntimeEnvironment = process.env,
) {
  if (!productionIntegrationsAreEnabled(environment)) return null;
  return readResendEnvironmentConfig(environment)?.from ?? null;
}

export function isValidResendSenderIdentity(value: string) {
  const senderEmail = extractSenderEmail(value);
  return Boolean(
    senderEmail
    && senderEmail.endsWith(`@${EXPECTED_RESEND_DOMAIN}`),
  );
}

export function classifyResendHttpFailure(
  status: number,
  errorName?: string | null,
) {
  const normalizedErrorName = errorName?.trim().toLowerCase() ?? "";
  if (status === 409 && normalizedErrorName === "concurrent_idempotent_requests") {
    return { retryable: true, ambiguous: true };
  }
  if (status === 408 || status >= 500) return { retryable: true, ambiguous: true };
  if (status === 429) return { retryable: true, ambiguous: false };
  return { retryable: false, ambiguous: false };
}

export async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
  senderIdentity?: string;
}): Promise<ResendDeliveryResult> {
  const config = readResendConfig(input.senderIdentity);
  if (!config) {
    return {
      ok: false,
      provider: "resend",
      configured: false,
      message: "Resend n'est pas configuré pour les emails Compétence.",
      externalId: null,
      retryable: true,
      ambiguous: false,
      statusCode: null,
    };
  }

  if (!isSafeEmailAddress(input.to)) {
    return {
      ok: false,
      provider: "resend",
      configured: true,
      message: "L'adresse email du destinataire est invalide.",
      externalId: null,
      retryable: false,
      ambiguous: false,
      statusCode: null,
    };
  }

  if (
    !isSafeHeaderValue(input.subject)
    || !input.subject.trim()
    || !input.text
    || (input.idempotencyKey !== undefined && !isSafeIdempotencyKey(input.idempotencyKey))
  ) {
    return {
      ok: false,
      provider: "resend",
      configured: true,
      message: "Le contenu de l'email Compétence est invalide.",
      externalId: null,
      retryable: false,
      ambiguous: false,
      statusCode: null,
    };
  }

  let response: Response;
  try {
    response = await fetch(RESEND_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": RESEND_USER_AGENT,
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: config.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
      signal: AbortSignal.timeout(RESEND_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[resend] Résultat d'envoi incertain.", error instanceof Error ? error.message : error);
    return {
      ok: false,
      provider: "resend",
      configured: true,
      message: "Resend n'a pas confirmé l'envoi; le message sera réessayé avec le même fournisseur.",
      externalId: null,
      retryable: true,
      ambiguous: true,
      statusCode: null,
    };
  }

  const data = await safeJson(response);
  if (response.ok) {
    const messageId = typeof data?.id === "string" ? data.id.trim() : "";
    if (!messageId) {
      return {
        ok: false,
        provider: "resend",
        configured: true,
        message: "Resend a répondu sans identifiant de message; l'envoi sera réessayé avec la même clé d'idempotence.",
        externalId: null,
        retryable: true,
        ambiguous: true,
        statusCode: response.status,
      };
    }
    return {
      ok: true,
      provider: "resend",
      configured: true,
      message: "Email envoyé par Resend.",
      externalId: messageId,
      retryable: false,
      ambiguous: false,
      statusCode: response.status,
    };
  }

  const errorName = resendErrorName(data);
  const classification = classifyResendHttpFailure(response.status, errorName);
  console.error("[resend] Envoi refusé par l'API Resend.", {
    status: response.status,
    errorName,
    ...classification,
  });
  return {
    ok: false,
    provider: "resend",
    configured: true,
    message: classification.ambiguous
      ? "Resend n'a pas confirmé l'envoi; le message sera réessayé avec le même fournisseur."
      : classification.retryable
        ? "Resend est temporairement indisponible; l'envoi sera réessayé."
        : "Resend n'a pas pu envoyer le message Compétence.",
    externalId: null,
    ...classification,
    statusCode: response.status,
  };
}

function readResendConfig(senderIdentity?: string): ResendConfig | null {
  if (!productionIntegrationsAreEnabled()) return null;
  const apiKey = readResendApiKey();
  const from = senderIdentity === undefined
    ? readResendEnvironmentConfig()?.from ?? ""
    : senderIdentity.trim();
  if (!apiKey || !isValidResendSenderIdentity(from)) return null;
  return { apiKey, from };
}

function readResendEnvironmentConfig(
  environment: RuntimeEnvironment = process.env,
): ResendConfig | null {
  const apiKey = readResendApiKey(environment);
  const from = environment.RESEND_FROM_EMAIL?.trim();
  if (
    !apiKey
    || !from
    || !isSafeHeaderValue(from)
    || !isValidResendSenderIdentity(from)
  ) {
    return null;
  }
  return { apiKey, from };
}

function readResendApiKey(
  environment: RuntimeEnvironment = process.env,
) {
  const apiKey = environment.RESEND_API_KEY?.trim();
  return apiKey && RESEND_API_KEY_PATTERN.test(apiKey) ? apiKey : null;
}

function extractSenderEmail(value: string) {
  const normalized = value.trim();
  if (!normalized || !isSafeHeaderValue(normalized)) return null;
  const bracketed = normalized.match(/^[^<>]{1,100}<([^<>\s]+)>$/)?.[1];
  const direct = /^[^<>\s]+$/.test(normalized) ? normalized : null;
  const email = (bracketed ?? direct ?? "").trim().toLowerCase();
  return isSafeEmailAddress(email) ? email : null;
}

function isSafeEmailAddress(value: string) {
  return !/[\r\n]/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isSafeHeaderValue(value: string) {
  return !/[\r\n]/.test(value);
}

function isSafeIdempotencyKey(value: string) {
  return Boolean(value)
    && value.length <= RESEND_IDEMPOTENCY_KEY_MAX_LENGTH
    && isSafeHeaderValue(value);
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function resendErrorName(data: any) {
  if (typeof data?.name === "string") return data.name;
  if (typeof data?.error === "string") return data.error;
  return "unknown";
}
