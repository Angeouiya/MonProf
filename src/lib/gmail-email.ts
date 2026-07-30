import { createHash, randomUUID } from "crypto";
import {
  productionIntegrationsAreEnabled,
  type RuntimeEnvironment,
} from "./production-integration-policy";

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const TOKEN_EXPIRY_MARGIN_MS = 60_000;
const GMAIL_REQUEST_TIMEOUT_MS = 10_000;
const EXPECTED_GMAIL_SENDER_EMAIL = "diplomateimmobilier99@gmail.com";

type GmailConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  senderEmail: string;
};

type CachedAccessToken = {
  value: string;
  expiresAt: number;
};

type GmailOAuthFailureClassification = {
  retryable: boolean;
  ambiguous: false;
  statusCode: number | null;
};

class GmailOAuthTokenError extends Error {
  readonly classification: GmailOAuthFailureClassification;

  constructor(classification: GmailOAuthFailureClassification) {
    super("Gmail OAuth token exchange failed.");
    this.name = "GmailOAuthTokenError";
    this.classification = classification;
  }
}

export type GmailDeliveryResult = {
  ok: boolean;
  configured: boolean;
  message: string;
  externalId?: string | null;
  retryable: boolean;
  ambiguous: boolean;
  statusCode?: number | null;
};

let cachedAccessToken: CachedAccessToken | null = null;

export function isGmailConfigured() {
  return productionIntegrationsAreEnabled() && hasGmailEnvironmentConfiguration();
}

export function hasGmailEnvironmentConfiguration() {
  return Boolean(readGmailEnvironmentConfig());
}

export async function sendGmailEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
}): Promise<GmailDeliveryResult> {
  const config = readGmailConfig();
  if (!config) {
    return {
      ok: false,
      configured: false,
      message: "Gmail n'est pas encore configuré pour les emails Compétence.",
      externalId: null,
      retryable: true,
      ambiguous: false,
      statusCode: null,
    };
  }

  if (!isSafeEmailAddress(input.to)) {
    return {
      ok: false,
      configured: true,
      message: "L'adresse email du destinataire est invalide.",
      externalId: null,
      retryable: false,
      ambiguous: false,
      statusCode: null,
    };
  }

  const raw = buildMimeMessage({
    ...input,
    senderEmail: config.senderEmail,
    senderName: "Compétence",
  });

  let accessToken: string;
  try {
    accessToken = await getAccessToken(config);
  } catch (error) {
    console.error("[gmail] OAuth Gmail indisponible.", error instanceof Error ? error.message : error);
    const classification = oauthTokenFailureFromError(error);
    return {
      ok: false,
      configured: true,
      message: classification.retryable
        ? "L'autorisation Gmail est temporairement indisponible."
        : "L'autorisation Gmail doit être renouvelée.",
      externalId: null,
      ...classification,
    };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(GMAIL_SEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: toBase64Url(raw) }),
        signal: AbortSignal.timeout(GMAIL_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      console.error("[gmail] Résultat d'envoi Gmail incertain.", error instanceof Error ? error.message : error);
      return {
        ok: false,
        configured: true,
        message: "Gmail n'a pas confirmé l'envoi; le message sera réessayé.",
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
          configured: true,
          message: "Gmail a répondu sans identifiant de message; l'envoi sera réessayé.",
          externalId: null,
          retryable: true,
          ambiguous: true,
          statusCode: response.status,
        };
      }
      return {
        ok: true,
        configured: true,
        message: "Email envoyé par Gmail.",
        externalId: messageId,
        retryable: false,
        ambiguous: false,
        statusCode: response.status,
      };
    }

    if (response.status === 401 && attempt === 0) {
      cachedAccessToken = null;
      try {
        accessToken = await getAccessToken(config, true);
        continue;
      } catch (error) {
        console.error("[gmail] Renouvellement OAuth après 401 impossible.", error instanceof Error ? error.message : error);
        const classification = oauthTokenFailureFromError(error);
        return {
          ok: false,
          configured: true,
          message: classification.retryable
            ? "L'autorisation Gmail est temporairement indisponible."
            : "L'autorisation Gmail doit être renouvelée.",
          externalId: null,
          ...classification,
        };
      }
    }

    const classification = classifyGmailHttpFailure(response.status);
    console.error("[gmail] Envoi refusé par l'API Gmail.", {
      status: response.status,
      reason: googleErrorReason(data),
      ...classification,
    });
    return {
      ok: false,
      configured: true,
      message: classification.ambiguous
        ? "Gmail n'a pas confirmé l'envoi; le message sera réessayé."
        : "Gmail n'a pas pu envoyer le message Compétence.",
      externalId: null,
      ...classification,
      statusCode: response.status,
    };
  }

  return {
    ok: false,
    configured: true,
    message: "L'autorisation Gmail doit être renouvelée.",
    externalId: null,
    retryable: true,
    ambiguous: false,
    statusCode: 401,
  };
}

export function classifyGmailHttpFailure(status: number) {
  if (status === 408 || status >= 500) return { retryable: true, ambiguous: true };
  if (status === 401 || status === 403 || status === 429) return { retryable: true, ambiguous: false };
  return { retryable: false, ambiguous: false };
}

export function classifyGoogleOAuthTokenFailure(
  status: number | null,
  reason?: string | null,
): GmailOAuthFailureClassification {
  const normalizedReason = reason?.trim().toLowerCase() ?? "";
  if (["invalid_grant", "invalid_client", "unauthorized_client"].includes(normalizedReason)) {
    return { retryable: false, ambiguous: false, statusCode: status };
  }
  if (status === null || status === 408 || status === 429 || status >= 500) {
    return { retryable: true, ambiguous: false, statusCode: status };
  }
  if (status >= 400 && status < 500) {
    return { retryable: false, ambiguous: false, statusCode: status };
  }
  return { retryable: true, ambiguous: false, statusCode: status };
}

function readGmailConfig(): GmailConfig | null {
  if (!productionIntegrationsAreEnabled()) return null;
  return readGmailEnvironmentConfig();
}

function readGmailEnvironmentConfig(
  environment: RuntimeEnvironment = process.env,
): GmailConfig | null {
  const clientId = environment.GMAIL_CLIENT_ID?.trim();
  const clientSecret = environment.GMAIL_CLIENT_SECRET?.trim();
  const refreshToken = environment.GMAIL_REFRESH_TOKEN?.trim();
  const senderEmail = environment.GMAIL_SENDER_EMAIL?.trim().toLowerCase();

  if (
    !clientId
    || !clientSecret
    || !refreshToken
    || senderEmail !== EXPECTED_GMAIL_SENDER_EMAIL
    || !isSafeEmailAddress(senderEmail)
  ) {
    return null;
  }

  return { clientId, clientSecret, refreshToken, senderEmail };
}

async function getAccessToken(config: GmailConfig, forceRefresh = false) {
  if (!forceRefresh && cachedAccessToken && cachedAccessToken.expiresAt - TOKEN_EXPIRY_MARGIN_MS > Date.now()) {
    return cachedAccessToken.value;
  }

  if (forceRefresh) cachedAccessToken = null;

  let response: Response;
  try {
    response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(GMAIL_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("[gmail] Endpoint OAuth Gmail injoignable.", error instanceof Error ? error.message : error);
    throw new GmailOAuthTokenError(classifyGoogleOAuthTokenFailure(null));
  }
  const data = await safeJson(response);
  const accessToken = typeof data?.access_token === "string" ? data.access_token : "";

  if (!response.ok || !accessToken) {
    const reason = googleErrorReason(data);
    const classification = classifyGoogleOAuthTokenFailure(response.status, reason);
    console.error("[gmail] Impossible d'obtenir un jeton OAuth Gmail.", {
      status: response.status,
      reason,
      retryable: classification.retryable,
    });
    throw new GmailOAuthTokenError(classification);
  }

  const expiresInSeconds = Number(data?.expires_in);
  cachedAccessToken = {
    value: accessToken,
    expiresAt: Date.now() + (Number.isFinite(expiresInSeconds) ? expiresInSeconds : 3600) * 1000,
  };
  return accessToken;
}

function buildMimeMessage(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  senderEmail: string;
  senderName: string;
  idempotencyKey?: string;
}) {
  const boundary = `competence-${randomUUID()}`;
  const messageId = input.idempotencyKey
    ? `<${createHash("sha256").update(input.idempotencyKey).digest("hex")}@competence.ci>`
    : `<${randomUUID()}@competence.ci>`;
  const headers = [
    `From: ${encodeHeader(input.senderName)} <${input.senderEmail}>`,
    `To: ${input.to}`,
    `Subject: ${encodeHeader(input.subject)}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const parts = [
    mimePart(boundary, "text/plain", input.text),
    ...(input.html ? [mimePart(boundary, "text/html", input.html)] : []),
    `--${boundary}--`,
  ];

  return [...headers, "", ...parts, ""].join("\r\n");
}

function mimePart(boundary: string, contentType: "text/plain" | "text/html", value: string) {
  return [
    `--${boundary}`,
    `Content-Type: ${contentType}; charset="UTF-8"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(Buffer.from(value, "utf8").toString("base64")),
  ].join("\r\n");
}

function encodeHeader(value: string) {
  const sanitized = value.replace(/[\r\n]+/g, " ").trim();
  return `=?UTF-8?B?${Buffer.from(sanitized, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") ?? value;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function isSafeEmailAddress(value: string) {
  return !/[\r\n]/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function googleErrorReason(data: any) {
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.error?.status === "string") return data.error.status;
  return "unknown";
}

function oauthTokenFailureFromError(error: unknown): GmailOAuthFailureClassification {
  return error instanceof GmailOAuthTokenError
    ? error.classification
    : classifyGoogleOAuthTokenFailure(null);
}
