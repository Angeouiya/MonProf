import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { PAYDUNYA_CI_CHANNELS } from "@/lib/payment-methods";

type PayDunyaCheckoutInput = {
  origin: string;
  booking: {
    id: string;
    reference: string;
    subjectName: string;
    levelName: string;
    sessionsCount: number;
    totalClientPays: number;
    courseAmount: number;
    transportFee: number;
    paymentServiceFeeAmount?: number | null;
    paymentServiceFeeLabel?: string | null;
  };
  client: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  teacher: {
    id: string;
    name: string;
  };
};

type PayDunyaCheckoutResult = {
  configured: boolean;
  checkoutUrl: string | null;
  token: string | null;
  responseText?: string;
  raw?: Record<string, unknown>;
};

export type PayDunyaInvoiceStatus = "completed" | "pending" | "cancelled" | "failed" | "unknown";

type PayDunyaConfirmedInvoice = {
  configured: boolean;
  ok: boolean;
  status: PayDunyaInvoiceStatus;
  token: string | null;
  totalAmount: number;
  receiptUrl: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customData: Record<string, unknown>;
  responseText?: string;
  failReason?: string;
  hashValid: boolean;
  hashProvided: boolean;
  raw: Record<string, any>;
};

type PayDunyaConfig = {
  masterKey: string;
  publicKey?: string;
  privateKey: string;
  token: string;
  mode: "sandbox" | "live";
  storeName: string;
  storeTagline: string;
  storePhone: string;
  storeLogoUrl: string;
};

const PAYDUNYA_SETTING_KEYS = {
  masterKey: "paydunya_master_key",
  publicKey: "paydunya_public_key",
  privateKey: "paydunya_private_key",
  token: "paydunya_token",
  mode: "paydunya_mode",
  storeName: "paydunya_store_name",
  storeTagline: "paydunya_store_tagline",
  storePhone: "paydunya_store_phone",
  storeLogoUrl: "paydunya_store_logo_url",
} as const;

let payDunyaConfigCache: { expiresAt: number; value: PayDunyaConfig | null } | null = null;
const PRODUCTION_PUBLIC_BASE_URL = "https://competence.ci";
const PAYDUNYA_MIN_CHECKOUT_AMOUNT = 200;

export function getPayDunyaPublicBaseUrl(req: NextRequest) {
  const fallbackRequestUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const safeRequestUrl = isLocalBaseUrl(fallbackRequestUrl) ? "" : fallbackRequestUrl;

  return firstPayDunyaCallbackBaseUrl(
    PRODUCTION_PUBLIC_BASE_URL,
    process.env.PAYDUNYA_CALLBACK_BASE_URL,
    process.env.PAYDUNYA_PUBLIC_BASE_URL,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    safeRequestUrl,
  );
}

export async function getPayDunyaConfig(): Promise<PayDunyaConfig | null> {
  if (payDunyaConfigCache && payDunyaConfigCache.expiresAt > Date.now()) {
    return payDunyaConfigCache.value;
  }

  const settings = await getPayDunyaSettings();
  const masterKey = configValue(settings, PAYDUNYA_SETTING_KEYS.masterKey, "PAYDUNYA_MASTER_KEY");
  const publicKey = configValue(settings, PAYDUNYA_SETTING_KEYS.publicKey, "PAYDUNYA_PUBLIC_KEY");
  const privateKey = configValue(settings, PAYDUNYA_SETTING_KEYS.privateKey, "PAYDUNYA_PRIVATE_KEY");
  const token = configValue(settings, PAYDUNYA_SETTING_KEYS.token, "PAYDUNYA_TOKEN");

  if (!masterKey || !privateKey || !token) {
    payDunyaConfigCache = { expiresAt: Date.now() + 30_000, value: null };
    return null;
  }

  const config: PayDunyaConfig = {
    masterKey,
    publicKey,
    privateKey,
    token,
    mode: configValue(settings, PAYDUNYA_SETTING_KEYS.mode, "PAYDUNYA_MODE") === "live" ? "live" : "sandbox",
    storeName: configValue(settings, PAYDUNYA_SETTING_KEYS.storeName, "PAYDUNYA_STORE_NAME") || "Compétence",
    storeTagline: configValue(settings, PAYDUNYA_SETTING_KEYS.storeTagline, "PAYDUNYA_STORE_TAGLINE") || "Cours à domicile et en ligne en Côte d'Ivoire",
    storePhone: configValue(settings, PAYDUNYA_SETTING_KEYS.storePhone, "PAYDUNYA_STORE_PHONE") || "",
    storeLogoUrl: configValue(settings, PAYDUNYA_SETTING_KEYS.storeLogoUrl, "PAYDUNYA_STORE_LOGO_URL") || "",
  };

  payDunyaConfigCache = { expiresAt: Date.now() + 60_000, value: config };
  return config;
}

export async function isPayDunyaConfigured() {
  return Boolean(await getPayDunyaConfig());
}

export async function createPayDunyaCheckoutInvoice(input: PayDunyaCheckoutInput): Promise<PayDunyaCheckoutResult> {
  const config = await getPayDunyaConfig();
  if (!config) {
    return { configured: false, checkoutUrl: null, token: null };
  }

  if (!Number.isFinite(input.booking.totalClientPays) || input.booking.totalClientPays < PAYDUNYA_MIN_CHECKOUT_AMOUNT) {
    throw new Error(`Montant PayDunya invalide: le total à payer doit être d'au moins ${PAYDUNYA_MIN_CHECKOUT_AMOUNT} FCFA.`);
  }

  const endpoint = config.mode === "live"
    ? "https://app.paydunya.com/api/v1/checkout-invoice/create"
    : "https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create";
  const returnUrl = `${input.origin}/client/reservations/${input.booking.id}?paydunya=return`;
  const callbackUrl = `${input.origin}/api/webhooks/paydunya`;

  const payload = {
    invoice: {
      items: {
        item_0: {
          name: `Cours ${input.booking.subjectName}`,
          quantity: input.booking.sessionsCount,
          unit_price: Math.max(0, Math.round(input.booking.courseAmount / Math.max(1, input.booking.sessionsCount))),
          total_price: input.booking.courseAmount,
          description: `${input.booking.levelName} avec ${input.teacher.name}`,
        },
        ...(input.booking.transportFee > 0
          ? {
              item_1: {
                name: "Frais de déplacement",
                quantity: 1,
                unit_price: input.booking.transportFee,
                total_price: input.booking.transportFee,
                description: "Déplacement professeur en Côte d'Ivoire",
              },
            }
          : {}),
        ...((input.booking.paymentServiceFeeAmount ?? 0) > 0
          ? {
              item_2: {
                name: input.booking.paymentServiceFeeLabel || "Frais de service paiement",
                quantity: 1,
                unit_price: input.booking.paymentServiceFeeAmount,
                total_price: input.booking.paymentServiceFeeAmount,
                description: "Frais lies au paiement mobile money / PayDunya",
              },
            }
          : {}),
      },
      customer: {
        name: input.client.name,
        email: input.client.email || "",
        phone: input.client.phone || "",
      },
      channels: PAYDUNYA_CI_CHANNELS,
      total_amount: input.booking.totalClientPays,
      description: `Réservation ${input.booking.reference} - Compétence`,
    },
    store: {
      name: config.storeName,
      tagline: config.storeTagline,
      phone: config.storePhone,
      logo_url: config.storeLogoUrl || `${input.origin}/images/brand/competence-icon.png`,
      website_url: input.origin,
    },
    custom_data: {
      booking_id: input.booking.id,
      booking_reference: input.booking.reference,
      client_id: input.client.id,
      teacher_id: input.teacher.id,
      provider: "PAYDUNYA",
      mode: config.mode,
      app_url: input.origin,
    },
    actions: {
      cancel_url: `${input.origin}/client/reservations/${input.booking.id}?paydunya=cancelled`,
      return_url: returnUrl,
      callback_url: callbackUrl,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": config.masterKey,
      "PAYDUNYA-PRIVATE-KEY": config.privateKey,
      "PAYDUNYA-TOKEN": config.token,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  const responseCode = firstNonEmptyString(data.response_code, data.data?.response_code);
  const checkoutUrl = extractPayDunyaCheckoutUrl(data);
  const token = extractPayDunyaCheckoutToken(data);

  if (!response.ok || responseCode !== "00") {
    console.error("[paydunya:create_failed]", {
      httpStatus: response.status,
      responseCode,
      description: data.description ?? null,
      responseText: typeof data.response_text === "string" ? data.response_text.slice(0, 180) : null,
      mode: config.mode,
    });
    throw new Error(data.response_text || data.description || "Impossible de créer la facture PayDunya.");
  }

  if (!checkoutUrl || !token) {
    console.error("[paydunya:create_incomplete]", {
      httpStatus: response.status,
      responseCode,
      hasCheckoutUrl: Boolean(checkoutUrl),
      hasToken: Boolean(token),
      mode: config.mode,
    });
    throw new Error("PayDunya a renvoyé une facture incomplète: URL de paiement ou token manquant.");
  }

  return {
    configured: true,
    checkoutUrl,
    token,
    responseText: data.description,
    raw: sanitizePayDunyaApiResponse(data),
  };
}

export async function verifyPayDunyaHash(hash?: string | null) {
  const config = await getPayDunyaConfig();
  if (!config || !hash) return false;
  return verifyPayDunyaHashWithMasterKey(config.masterKey, hash);
}

function verifyPayDunyaHashWithMasterKey(masterKey: string, hash?: string | null) {
  if (!hash) return false;
  const expected = createHash("sha512").update(masterKey).digest("hex");
  const received = hash.trim().toLowerCase();
  if (!/^[a-f0-9]{128}$/.test(received)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

export async function confirmPayDunyaInvoice(invoiceToken: string): Promise<PayDunyaConfirmedInvoice> {
  const config = await getPayDunyaConfig();
  if (!config) {
    return emptyPayDunyaConfirmation({
      configured: false,
      responseText: "PayDunya n'est pas configuré.",
    });
  }

  const safeToken = invoiceToken.trim();
  if (!safeToken) {
    return emptyPayDunyaConfirmation({
      configured: true,
      responseText: "Token PayDunya manquant.",
    });
  }

  const endpoint = config.mode === "live"
    ? `https://app.paydunya.com/api/v1/checkout-invoice/confirm/${encodeURIComponent(safeToken)}`
    : `https://app.paydunya.com/sandbox-api/v1/checkout-invoice/confirm/${encodeURIComponent(safeToken)}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "PAYDUNYA-MASTER-KEY": config.masterKey,
      "PAYDUNYA-PRIVATE-KEY": config.privateKey,
      "PAYDUNYA-TOKEN": config.token,
    },
    cache: "no-store",
  });
  const raw = await response.json().catch(() => ({}));
  const root = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
    ? raw.data
    : raw;
  const invoice = root.invoice && typeof root.invoice === "object" ? root.invoice : {};
  const customer = root.customer && typeof root.customer === "object" ? root.customer : {};
  const customData = root.custom_data && typeof root.custom_data === "object" ? root.custom_data : {};
  const status = normalizePayDunyaStatus(root.status);
  const confirmedToken = firstNonEmptyString(invoice.token, root.token, raw.token, safeToken);
  const totalAmount = parsePayDunyaAmount(invoice.total_amount);
  const responseHash = firstNonEmptyString(root.hash, raw.hash);

  return {
    configured: true,
    ok: response.ok && firstNonEmptyString(root.response_code, raw.response_code) === "00",
    status,
    token: confirmedToken,
    totalAmount,
    receiptUrl: firstNonEmptyString(root.receipt_url, root.receiptURL, root.receiptUrl, raw.receipt_url, raw.receiptURL, raw.receiptUrl),
    customerName: firstNonEmptyString(customer.name),
    customerEmail: firstNonEmptyString(customer.email),
    customerPhone: firstNonEmptyString(customer.phone),
    customData,
    responseText: firstNonEmptyString(root.response_text, root.description, raw.response_text, raw.description) ?? undefined,
    failReason: firstNonEmptyString(root.fail_reason, root.errors?.message, root.errors?.description, raw.fail_reason, raw.errors?.message, raw.errors?.description) ?? undefined,
    hashValid: responseHash ? verifyPayDunyaHashWithMasterKey(config.masterKey, responseHash) : false,
    hashProvided: Boolean(responseHash),
    raw,
  };
}

async function getPayDunyaSettings() {
  try {
    const rows = await db.setting.findMany({
      where: { key: { in: Object.values(PAYDUNYA_SETTING_KEYS) } },
      select: { key: true, value: true },
    });
    return new Map(rows.map((row) => [row.key, row.value.trim()]));
  } catch {
    return new Map<string, string>();
  }
}

function configValue(settings: Map<string, string>, settingKey: string, envKey: string) {
  return settings.get(settingKey) || process.env[envKey]?.trim() || "";
}

function emptyPayDunyaConfirmation(input: {
  configured: boolean;
  responseText?: string;
}): PayDunyaConfirmedInvoice {
  return {
    configured: input.configured,
    ok: false,
    status: "unknown",
    token: null,
    totalAmount: 0,
    receiptUrl: null,
    customerName: null,
    customerEmail: null,
    customerPhone: null,
    customData: {},
    responseText: input.responseText,
    hashValid: false,
    hashProvided: false,
    raw: {},
  };
}

export function normalizePayDunyaStatus(status: unknown): PayDunyaInvoiceStatus {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (normalized === "completed") return "completed";
  if (normalized === "pending") return "pending";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  if (normalized === "failed") return "failed";
  return "unknown";
}

function parsePayDunyaAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s/g, ""));
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }
  return 0;
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractPayDunyaCheckoutUrl(data: Record<string, any>) {
  const candidate = firstNonEmptyString(
    data.response_text,
    data.checkout_url,
    data.checkoutUrl,
    data.invoice_url,
    data.invoiceUrl,
    data.url,
    data.data?.response_text,
    data.data?.checkout_url,
    data.data?.checkoutUrl,
    data.data?.invoice_url,
    data.data?.invoiceUrl,
    data.data?.url,
  );
  if (!candidate) return null;

  const match = candidate.match(/https?:\/\/[^\s"']+/);
  const rawUrl = match?.[0] ?? candidate;
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function extractPayDunyaCheckoutToken(data: Record<string, any>) {
  return firstNonEmptyString(
    data.token,
    data.invoice_token,
    data.invoiceToken,
    data.data?.token,
    data.data?.invoice_token,
    data.data?.invoiceToken,
  );
}

function sanitizePayDunyaApiResponse(data: Record<string, any>) {
  return {
    response_code: data.response_code ?? data.data?.response_code ?? null,
    description: data.description ?? data.data?.description ?? null,
    response_text: typeof data.response_text === "string" ? data.response_text.slice(0, 240) : null,
    has_token: typeof data.token === "string" || typeof data.data?.token === "string",
  };
}

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function firstPayDunyaCallbackBaseUrl(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = normalizeBaseUrl(value);
    if (!normalized || isLocalBaseUrl(normalized)) continue;
    return normalized;
  }

  return PRODUCTION_PUBLIC_BASE_URL;
}

function isLocalBaseUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}
