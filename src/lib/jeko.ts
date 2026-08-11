import "server-only";

import { z } from "zod";
import { requireJekoServerConfig, type JekoServerConfig } from "./jeko-config";
import { getPublicAppOrigin } from "./public-url";
import {
  isAllowedJekoRedirectUrl,
  isJekoPaymentRequestId,
  resolveJekoCheckoutUrl,
} from "./jeko-checkout-url";
import {
  assertJekoCallbackUrl,
  JEKO_CURRENCY,
  JEKO_PAYMENT_METHODS,
  normalizeJekoPaymentStatus,
  xofToJekoAmountCents,
  type JekoPaymentMethod,
  type JekoPaymentStatus,
} from "./jeko-utils";

const jekoMoneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
}).passthrough();

const jekoTransactionSchema = z.object({
  id: z.string().trim().min(1),
  amount: jekoMoneySchema,
  fees: jekoMoneySchema,
  status: z.string().trim().min(1),
  counterpartLabel: z.string().nullable().optional(),
  counterpartIdentifier: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  executedAt: z.string().nullable().optional(),
}).passthrough();

const jekoPaymentRequestSchema = z.object({
  id: z.string().trim().min(1),
  storeId: z.string().trim().min(1),
  reference: z.string().trim().min(1),
  type: z.string().trim().min(1),
  // Certaines confirmations GET historiques Jèko omettent ce champ alors
  // que la méthode reste figée dans notre tentative locale. Le POST de
  // création continue de l'exiger par la comparaison stricte ci-dessous.
  paymentMethod: z.string().trim().min(1).nullable().optional(),
  status: z.string().trim().min(1),
  redirectUrl: z.string().trim().min(1).optional(),
  errorReason: z.string().nullable().optional(),
  transaction: jekoTransactionSchema.nullable().optional(),
}).passthrough();

const jekoPartnerTransactionSchema = z.object({
  id: z.string().trim().min(1).max(200),
  type: z.string().trim().min(1).max(40),
  status: z.string().trim().min(1).max(40),
  amount: jekoMoneySchema,
  fees: jekoMoneySchema,
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  paymentMethod: z.string().trim().min(1).max(40),
  reference: z.string().trim().min(1).max(200),
  createdAt: z.string().trim().min(1).max(100),
  transactionDetails: z.object({
    id: z.string().trim().min(1).max(200).optional(),
    reference: z.string().trim().min(1).max(200).optional(),
  }).passthrough().optional(),
  paymentRequestId: z.string().trim().min(1).max(200).optional(),
}).passthrough();

const jekoPartnerTransactionListSchema = z.object({
  total: z.number().int().nonnegative(),
  perPage: z.number().int().positive(),
  currentPage: z.number().int().positive(),
  data: z.array(jekoPartnerTransactionSchema),
}).passthrough();

export type CreateJekoPaymentRequestInput = {
  reference: string;
  amountXof: number;
  paymentMethod: JekoPaymentMethod;
  successUrl: string;
  errorUrl: string;
};

export type JekoPaymentRequestResult = {
  id: string;
  storeId: string;
  reference: string;
  paymentMethod: JekoPaymentMethod;
  status: JekoPaymentStatus;
  redirectUrl: string;
  amountXof: number;
  amountCents: number;
  raw: Record<string, unknown>;
};

export type JekoPaymentConfirmation = {
  id: string;
  storeId: string;
  reference: string;
  paymentMethod: JekoPaymentMethod | null;
  status: JekoPaymentStatus;
  errorReason: string | null;
  transaction: null | {
    id: string;
    amountCents: number;
    currency: string;
    feeCents: number;
    feeCurrency: string;
    status: JekoPaymentStatus;
    counterpartLabel: string | null;
    counterpartIdentifier: string | null;
    description: string | null;
    executedAt: string | null;
  };
  raw: Record<string, unknown>;
};

export type JekoPaymentRequestRecoveryResult = {
  confirmation: JekoPaymentConfirmation;
  redirectUrl: string;
  source: "provider_error" | "transaction_history";
};

type JekoRequestOptions = {
  config?: JekoServerConfig;
  fetchImpl?: typeof fetch;
};

export class JekoApiError extends Error {
  readonly httpStatus: number;
  readonly code: string | null;
  readonly details: Record<string, unknown> | null;

  constructor(
    message: string,
    httpStatus: number,
    code: string | null = null,
    details: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.name = "JekoApiError";
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
  }
}

export async function createJekoPaymentRequest(
  input: CreateJekoPaymentRequestInput,
  options: JekoRequestOptions = {},
): Promise<JekoPaymentRequestResult> {
  const config = options.config ?? requireJekoServerConfig();
  const reference = normalizeReference(input.reference);
  const amountCents = xofToJekoAmountCents(input.amountXof);
  const paymentMethod = normalizeRequestedMethod(input.paymentMethod);
  const appOrigin = getPublicAppOrigin();
  const successUrl = assertJekoCallbackUrl(input.successUrl, "successUrl", appOrigin);
  const errorUrl = assertJekoCallbackUrl(input.errorUrl, "errorUrl", appOrigin);
  const payload = {
    storeId: config.storeId,
    amountCents,
    currency: JEKO_CURRENCY,
    reference,
    paymentDetails: {
      type: "redirect",
      data: {
        paymentMethod,
        successUrl,
        errorUrl,
      },
    },
  };

  const raw = await jekoFetchJson(
    `${config.apiBaseUrl}/partner_api/payment_requests`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    config,
    options.fetchImpl,
  );
  const response = jekoPaymentRequestSchema.parse(raw);
  if (
    response.storeId !== config.storeId
    || response.reference !== reference
    || response.type.toLowerCase() !== "redirect"
    || response.paymentMethod?.toLowerCase() !== paymentMethod
  ) {
    throw new JekoApiError("Jèko a renvoyé un magasin ou une référence incohérente.", 502, "RESPONSE_MISMATCH");
  }
  if (!isJekoPaymentRequestId(response.id)) {
    throw new JekoApiError("Jèko a renvoyé un identifiant de demande invalide.", 502, "INVALID_PAYMENT_REQUEST_ID");
  }
  // En production Jèko peut renvoyer une URL courte (`/pr/...`) pour afficher
  // la page mobile de paiement. Elle est relayée uniquement si elle reste sur
  // le domaine officiel pay.jeko.africa ; sinon on retombe sur l'URL canonique.
  const redirectUrl = resolveJekoCheckoutUrl(response.id, response.redirectUrl);

  return {
    id: response.id,
    storeId: response.storeId,
    reference: response.reference,
    paymentMethod,
    status: normalizeJekoPaymentStatus(response.status),
    redirectUrl,
    amountXof: input.amountXof,
    amountCents,
    raw: raw as Record<string, unknown>,
  };
}

export async function confirmJekoPaymentRequest(
  paymentRequestId: string,
  options: JekoRequestOptions = {},
): Promise<JekoPaymentConfirmation> {
  const config = options.config ?? requireJekoServerConfig();
  const safeId = paymentRequestId.trim();
  if (!safeId || safeId.length > 160) throw new Error("Identifiant de demande Jèko invalide.");

  const raw = await jekoFetchJson(
    `${config.apiBaseUrl}/partner_api/payment_requests/${encodeURIComponent(safeId)}`,
    { method: "GET", cache: "no-store" },
    config,
    options.fetchImpl,
  );
  const response = jekoPaymentRequestSchema.parse(raw);
  if (response.id !== safeId || response.storeId !== config.storeId) {
    throw new JekoApiError("La confirmation Jèko ne correspond pas à la demande attendue.", 502, "RESPONSE_MISMATCH");
  }
  const method = JEKO_PAYMENT_METHODS.includes(response.paymentMethod as JekoPaymentMethod)
    ? response.paymentMethod as JekoPaymentMethod
    : null;

  return {
    id: response.id,
    storeId: response.storeId,
    reference: response.reference,
    paymentMethod: method,
    status: normalizeJekoPaymentStatus(response.status),
    errorReason: response.errorReason ?? null,
    transaction: response.transaction
      ? {
          id: response.transaction.id,
          amountCents: response.transaction.amount.amount,
          currency: response.transaction.amount.currency,
          feeCents: response.transaction.fees.amount,
          feeCurrency: response.transaction.fees.currency,
          status: normalizeJekoPaymentStatus(response.transaction.status),
          counterpartLabel: response.transaction.counterpartLabel ?? null,
          counterpartIdentifier: response.transaction.counterpartIdentifier ?? null,
          description: response.transaction.description ?? null,
          executedAt: response.transaction.executedAt ?? null,
        }
      : null,
    raw: raw as Record<string, unknown>,
  };
}

/**
 * Récupère une création dont le POST a eu une issue ambiguë sans jamais
 * réémettre ce POST. Jèko rend la référence unique mais son contrat 409
 * ne garantit pas l'ID de la demande : nous exploitons d'abord tout ID/URL
 * effectivement renvoyé, puis l'historique borné à 90 jours. Un candidat
 * n'est accepté qu'après confirmation GET stricte par ID.
 */
export async function recoverJekoPaymentRequestByReference(
  input: {
    reference: string;
    amountXof: number;
    paymentMethod: JekoPaymentMethod;
    referenceCreatedAt?: Date | string | null;
    providerErrorPayload?: Record<string, unknown> | null;
  },
  options: JekoRequestOptions = {},
): Promise<JekoPaymentRequestRecoveryResult | null> {
  const config = options.config ?? requireJekoServerConfig();
  const reference = normalizeReference(input.reference);
  const paymentMethod = normalizeRequestedMethod(input.paymentMethod);
  const amountCents = xofToJekoAmountCents(input.amountXof);
  const seen = new Set<string>();
  const confirmCandidates = async (
    ids: readonly string[],
    source: JekoPaymentRequestRecoveryResult["source"],
  ): Promise<JekoPaymentRequestRecoveryResult | null> => {
    for (const id of ids) {
      const candidate = { id, source };
      if (seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      let confirmation: JekoPaymentConfirmation;
      try {
        confirmation = await confirmJekoPaymentRequest(candidate.id, { ...options, config });
      } catch (error) {
        if (error instanceof JekoApiError && error.httpStatus === 404) continue;
        throw error;
      }
      assertRecoveredPaymentRequest(confirmation, {
        id: candidate.id,
        storeId: config.storeId,
        reference,
        amountCents,
        paymentMethod,
      });
      return {
        confirmation,
        redirectUrl: getJekoPaymentRedirectUrl(confirmation),
        source: candidate.source,
      };
    }
    return null;
  };

  const fromProviderError = await confirmCandidates(
    extractPaymentRequestIds(input.providerErrorPayload),
    "provider_error",
  );
  if (fromProviderError) return fromProviderError;

  const historyCandidates = await findPaymentRequestIdsInTransactionHistory({
    reference,
    amountCents,
    paymentMethod,
    referenceCreatedAt: input.referenceCreatedAt,
  }, { ...options, config });
  return confirmCandidates(historyCandidates, "transaction_history");
}

/** URL Jèko officielle persistable après une confirmation GET par ID. */
export function getJekoPaymentRedirectUrl(confirmation: JekoPaymentConfirmation) {
  const rawRedirectUrl = firstString(confirmation.raw.redirectUrl);
  if (!isJekoPaymentRequestId(confirmation.id)) {
    throw new JekoApiError("Identifiant de redirection Jèko invalide.", 502, "UNSAFE_REDIRECT");
  }
  return resolveJekoCheckoutUrl(confirmation.id, rawRedirectUrl);
}

async function jekoFetchJson(
  url: string,
  init: RequestInit,
  config: JekoServerConfig,
  fetchImpl: typeof fetch = fetch,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": config.apiKey,
        "X-API-KEY-ID": config.apiKeyId,
        ...init.headers,
      },
      signal: controller.signal,
    });
    const raw = await response.json().catch(() => null);
    if (!response.ok) {
      const apiError = isRecord(raw) ? raw : {};
      const code = firstString(apiError.id, apiError.code);
      const message = firstString(apiError.message, apiError.extras)
        ?? `Jèko a refusé la requête (HTTP ${response.status}).`;
      throw new JekoApiError(
        message,
        response.status,
        code,
        isRecord(raw) ? raw : null,
      );
    }
    if (!isRecord(raw)) throw new JekoApiError("Réponse JSON Jèko invalide.", 502, "INVALID_JSON");
    return raw;
  } catch (error) {
    if (error instanceof JekoApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new JekoApiError("Le délai de réponse Jèko est dépassé.", 504, "TIMEOUT");
    }
    throw new JekoApiError("Impossible de joindre Jèko.", 502, "NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeReference(value: string) {
  const reference = value.trim();
  if (!reference || reference.length > 100 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(reference)) {
    throw new Error("Référence de paiement Jèko invalide.");
  }
  return reference;
}

function normalizeRequestedMethod(value: JekoPaymentMethod) {
  if (!JEKO_PAYMENT_METHODS.includes(value)) throw new Error("Méthode de paiement Jèko non prise en charge.");
  return value;
}

async function findPaymentRequestIdsInTransactionHistory(
  expected: {
    reference: string;
    amountCents: number;
    paymentMethod: JekoPaymentMethod;
    referenceCreatedAt?: Date | string | null;
  },
  options: JekoRequestOptions & { config: JekoServerConfig },
) {
  const ids: string[] = [];
  const maxPages = 50;
  for (const window of buildJekoTransactionSearchWindows(expected.referenceCreatedAt)) {
    for (let page = 1; page <= maxPages; page += 1) {
      const query = new URLSearchParams({
        storeId: options.config.storeId,
        page: String(page),
        limit: "100",
        startDate: window.startDate,
        endDate: window.endDate,
      });
      const raw = await jekoFetchJson(
        `${options.config.apiBaseUrl}/partner_api/transactions?${query.toString()}`,
        { method: "GET", cache: "no-store" },
        options.config,
        options.fetchImpl,
      );
      const transactions = jekoPartnerTransactionListSchema.parse(raw);
      const matches = transactions.data.filter((transaction) => (
        transaction.type.trim().toLowerCase() === "payment"
        && transaction.reference === expected.reference
      ));
      for (const transaction of matches) {
        const method = JEKO_PAYMENT_METHODS.includes(transaction.paymentMethod as JekoPaymentMethod)
          ? transaction.paymentMethod as JekoPaymentMethod
          : null;
        if (
          transaction.amount.amount !== expected.amountCents
          || transaction.amount.currency !== JEKO_CURRENCY
          || transaction.currency !== JEKO_CURRENCY
          || method !== expected.paymentMethod
        ) {
          throw new JekoApiError(
            "La référence Jèko existe avec un montant, une devise ou une méthode différente.",
            409,
            "IDEMPOTENCY_MISMATCH",
            transaction as Record<string, unknown>,
          );
        }
        const id = firstString(
          transaction.transactionDetails?.id,
          transaction.paymentRequestId,
        );
        if (id && isPaymentRequestId(id)) ids.push(id);
      }
      if (transactions.currentPage * transactions.perPage >= transactions.total) break;
      if (page === maxPages) {
        throw new JekoApiError(
          "L'historique Jèko est trop volumineux pour confirmer automatiquement la référence.",
          503,
          "HISTORY_SCAN_INCOMPLETE",
        );
      }
    }
  }
  return ids;
}

function assertRecoveredPaymentRequest(
  confirmation: JekoPaymentConfirmation,
  expected: {
    id: string;
    storeId: string;
    reference: string;
    amountCents: number;
    paymentMethod: JekoPaymentMethod;
  },
) {
  const transactionMismatch = confirmation.transaction && (
    confirmation.transaction.amountCents !== expected.amountCents
    || confirmation.transaction.currency !== JEKO_CURRENCY
    || confirmation.transaction.feeCurrency !== JEKO_CURRENCY
  );
  if (
    confirmation.id !== expected.id
    || confirmation.storeId !== expected.storeId
    || confirmation.reference !== expected.reference
    || confirmation.paymentMethod !== expected.paymentMethod
    || transactionMismatch
  ) {
    throw new JekoApiError(
      "La demande Jèko retrouvée ne correspond pas à l'instantané local.",
      409,
      "IDEMPOTENCY_MISMATCH",
      confirmation.raw,
    );
  }
}

function extractPaymentRequestIds(value: unknown) {
  const ids = new Set<string>();
  const visit = (candidate: unknown, key = "", depth = 0) => {
    if (depth > 5 || candidate == null) return;
    if (typeof candidate === "string") {
      if (/redirecturl|checkouturl/i.test(key) && isAllowedJekoRedirectUrl(candidate)) {
        const pathname = new URL(candidate).pathname.replace(/\/$/, "");
        const id = decodeURIComponent(pathname.slice(pathname.lastIndexOf("/") + 1));
        if (isPaymentRequestId(id)) ids.add(id);
      } else if (/^(paymentrequestid|payment_request_id|providerorderid|requestid)$/i.test(key)) {
        if (isPaymentRequestId(candidate)) ids.add(candidate.trim());
      } else if (key.toLowerCase() === "id" && isPaymentRequestId(candidate)) {
        ids.add(candidate.trim());
      }
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => visit(item, key, depth + 1));
      return;
    }
    if (isRecord(candidate)) {
      Object.entries(candidate).forEach(([nestedKey, nested]) => visit(nested, nestedKey, depth + 1));
    }
  };
  visit(value);
  return [...ids];
}

function isPaymentRequestId(value: string) {
  return isJekoPaymentRequestId(value.trim());
}

function buildJekoTransactionSearchWindows(referenceCreatedAt?: Date | string | null) {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = startOfUtcDay(new Date());
  const parsed = referenceCreatedAt ? new Date(referenceCreatedAt) : null;
  const earliest = parsed && Number.isFinite(parsed.getTime())
    ? new Date(startOfUtcDay(parsed).getTime() - dayMs)
    : new Date(now.getTime() - 89 * dayMs);
  const windows: Array<{ startDate: string; endDate: string }> = [];
  let end = now;
  while (end.getTime() >= earliest.getTime() && windows.length < 50) {
    const start = new Date(Math.max(earliest.getTime(), end.getTime() - 89 * dayMs));
    windows.push({ startDate: formatUtcDay(start), endDate: formatUtcDay(end) });
    end = new Date(start.getTime() - dayMs);
  }
  return windows;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatUtcDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}
