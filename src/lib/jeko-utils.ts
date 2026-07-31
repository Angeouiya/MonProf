import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export { isAllowedJekoRedirectUrl } from "./jeko-checkout-url";

export const JEKO_CURRENCY = "XOF" as const;
export const JEKO_MINOR_UNITS_PER_XOF = 100;
export const JEKO_MAX_PROVIDER_INT = 2_147_483_647;

export const JEKO_PAYMENT_METHODS = ["wave", "orange", "mtn", "moov", "djamo"] as const;
export type JekoPaymentMethod = (typeof JEKO_PAYMENT_METHODS)[number];
export type JekoPaymentStatus = "pending" | "success" | "error";

const jekoMoneySchema = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
}).passthrough();

const jekoTransactionDetailsSchema = z.object({
  id: z.string().trim().min(1).optional(),
  reference: z.string().trim().min(1).optional(),
  paymentLinkId: z.string().trim().min(1).optional(),
}).passthrough();

const jekoWebhookTransactionSchema = z.object({
  id: z.string().trim().min(1),
  amount: jekoMoneySchema,
  fees: jekoMoneySchema,
  status: z.string().trim().min(1),
  counterpartLabel: z.string().optional(),
  counterpartIdentifier: z.string().optional(),
  paymentMethod: z.string().trim().min(1),
  transactionType: z.string().trim().min(1),
  businessName: z.string().optional(),
  storeName: z.string().optional(),
  description: z.string().optional(),
  executedAt: z.string().optional(),
  transactionDetails: jekoTransactionDetailsSchema.optional(),
}).passthrough();

export type JekoWebhookTransaction = z.infer<typeof jekoWebhookTransactionSchema>;

export type ParsedJekoWebhook = {
  eventType: string;
  transaction: JekoWebhookTransaction;
  payload: Record<string, unknown>;
  dedupeKey: string;
};

/**
 * Jèko nomme le champ `amountCents` et documente 100 unités mineures pour
 * 1 XOF. La plateforme, elle, conserve ses prix en FCFA entiers. Toute
 * conversion vers l'API passe obligatoirement par cette fonction.
 */
export function xofToJekoAmountCents(amountXof: number) {
  if (!Number.isSafeInteger(amountXof) || amountXof <= 0) {
    throw new Error("Le montant Jèko doit être un nombre entier de FCFA strictement positif.");
  }

  const amountCents = amountXof * JEKO_MINOR_UNITS_PER_XOF;
  if (!Number.isSafeInteger(amountCents) || amountCents > JEKO_MAX_PROVIDER_INT) {
    throw new Error("Le montant Jèko dépasse la limite technique autorisée.");
  }
  return amountCents;
}

/** Convertit un montant mineur Jèko en FCFA sans tolérer de perte. */
export function jekoAmountCentsToXof(amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new Error("Le montant mineur Jèko est invalide.");
  }
  if (amountCents % JEKO_MINOR_UNITS_PER_XOF !== 0) {
    throw new Error("Le montant Jèko ne correspond pas à un nombre entier de FCFA.");
  }
  return amountCents / JEKO_MINOR_UNITS_PER_XOF;
}

/**
 * Les frais restent archivés exactement en unités mineures. Cette valeur
 * entière en FCFA sert uniquement aux agrégats historiques et est arrondie au
 * FCFA supérieur pour que Compétence ne sous-estime jamais ses propres frais.
 */
export function jekoFeeCentsToCoveredXof(amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new Error("Le montant de frais Jèko est invalide.");
  }
  return Math.ceil(amountCents / JEKO_MINOR_UNITS_PER_XOF);
}

export function calculateJekoWebhookSignature(rawBody: string | Uint8Array, secret: string) {
  const normalizedSecret = secret.trim();
  if (!normalizedSecret) throw new Error("Secret webhook Jèko manquant.");
  return createHmac("sha256", normalizedSecret).update(rawBody).digest("hex");
}

export function verifyJekoWebhookSignature(
  rawBody: string | Uint8Array,
  signature: string | null | undefined,
  secret: string,
) {
  const receivedHex = normalizeJekoSignature(signature);
  if (!receivedHex || !secret.trim()) return false;

  const expectedHex = calculateJekoWebhookSignature(rawBody, secret);
  const expected = Buffer.from(expectedHex, "hex");
  const received = Buffer.from(receivedHex, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function assertJekoCallbackUrl(
  value: string,
  label: "successUrl" | "errorUrl",
  expectedOrigin?: string,
) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    if (expectedOrigin && url.origin !== new URL(expectedOrigin).origin) throw new Error();
    return url.toString();
  } catch {
    throw new Error(`${label} doit être une URL HTTPS absolue, sécurisée et appartenant à Compétence.`);
  }
}

export function parseJekoWebhookPayload(rawBody: string | Uint8Array): ParsedJekoWebhook {
  const rawText = typeof rawBody === "string" ? rawBody : Buffer.from(rawBody).toString("utf8");
  let value: unknown;
  try {
    value = JSON.parse(rawText);
  } catch {
    throw new Error("Payload webhook Jèko non JSON.");
  }

  if (!isRecord(value)) throw new Error("Payload webhook Jèko invalide.");
  const candidate = isRecord(value.data) ? value.data : value;
  const transaction = jekoWebhookTransactionSchema.parse(candidate);
  const eventType = typeof value.event === "string" && value.event.trim()
    ? value.event.trim()
    : "transaction.completed";
  const normalizedStatus = normalizeJekoPaymentStatus(transaction.status);

  return {
    eventType,
    transaction,
    payload: value,
    dedupeKey: `JEKO:${transaction.id}:${normalizedStatus}`,
  };
}

export function normalizeJekoPaymentStatus(value: unknown): JekoPaymentStatus {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["success", "successful", "completed", "paid"].includes(normalized)) return "success";
  if (["error", "failed", "failure", "cancelled", "canceled"].includes(normalized)) return "error";
  return "pending";
}

export function isJekoIncomingPaymentType(value: unknown) {
  const normalized = typeof value === "string"
    ? value.trim().toLowerCase().replace(/[\s_-]/g, "")
    : "";
  return normalized === "payment" || normalized === "paymentrequest";
}

export function normalizeJekoPaymentMethod(value: unknown): JekoPaymentMethod | null {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (JEKO_PAYMENT_METHODS as readonly string[]).includes(normalized)
    ? normalized as JekoPaymentMethod
    : null;
}

export function jekoPayloadSha256(rawBody: string | Uint8Array) {
  return createHash("sha256").update(rawBody).digest("hex");
}

function normalizeJekoSignature(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim().replace(/^sha256=/i, "").toLowerCase();
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
