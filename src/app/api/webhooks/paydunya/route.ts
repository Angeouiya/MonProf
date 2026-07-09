import { NextRequest, NextResponse } from "next/server";
import { verifyPayDunyaHash } from "@/lib/paydunya";
import { reconcilePayDunyaBookingPayment } from "@/lib/paydunya-reconciliation";

type PayDunyaPayload = Record<string, any>;

export function GET() {
  return NextResponse.json({
    ok: true,
    provider: "PAYDUNYA",
    endpoint: "ipn",
    message: "Webhook PayDunya Compétence disponible. Les paiements sont validés uniquement par POST PayDunya.",
  });
}

export async function POST(req: NextRequest) {
  let payload: PayDunyaPayload;
  try {
    payload = await readPayDunyaPayload(req);
  } catch {
    return NextResponse.json({ error: "Payload PayDunya invalide." }, { status: 400 });
  }

  const data = normalizePayDunyaData(payload);
  const invoice = asRecord(data.invoice) ?? {};
  const customData = asRecord(data.custom_data) ?? asRecord(invoice.custom_data) ?? {};
  const status = firstString(data.status)?.toLowerCase() ?? null;
  const hash = firstString(data.hash);
  const hashVerified = await verifyPayDunyaHash(hash);
  const invoiceToken = firstString(
    invoice.token,
    data.token,
    data.invoice_token,
    data.invoiceToken,
    data.paydunya_token,
    data.paydunyaToken,
  );
  const bookingId = firstString(
    customData.booking_id,
    customData.bookingId,
    customData.booking,
    data.booking_id,
    invoice.booking_id,
  );
  const bookingReference = firstString(
    customData.booking_reference,
    customData.bookingReference,
    data.booking_reference,
    invoice.booking_reference,
  );

  if (!bookingId && !bookingReference && !invoiceToken) {
    return NextResponse.json({ error: "Réservation PayDunya introuvable dans custom_data ou token." }, { status: 400 });
  }

  const result = await reconcilePayDunyaBookingPayment({
    bookingId,
    bookingReference,
    token: invoiceToken,
    source: "webhook",
    incomingStatus: status,
    incomingPayload: data,
    incomingHashVerified: hashVerified,
  });

  const httpStatus = result.action === "not_found"
    ? 404
    : result.action === "rejected"
      ? 409
      : result.action === "not_configured"
        ? 503
        : 200;

  return NextResponse.json({
    received: true,
    verified: result.verified,
    action: result.action,
    status: result.status,
    bookingId: result.bookingId,
    message: result.message,
  }, { status: httpStatus });
}

async function readPayDunyaPayload(req: NextRequest): Promise<PayDunyaPayload> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return req.json();
  }

  const text = await req.text();
  const params = new URLSearchParams(text);
  const rawData = params.get("data");
  if (rawData) {
    return { data: parsePayDunyaDataValue(rawData) };
  }

  const payload: PayDunyaPayload = {};
  for (const [key, value] of params.entries()) {
    setBracketPath(payload, key, value);
  }
  return payload;
}

function normalizePayDunyaData(payload: PayDunyaPayload): PayDunyaPayload {
  const data = parsePayDunyaDataValue(payload.data);
  return asRecord(data) ?? payload;
}

function parsePayDunyaDataValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    // PayDunya posts callbacks as x-www-form-urlencoded. Some gateways wrap
    // the "data" node as a query-string-like string, so keep supporting it.
  }

  if (trimmed.includes("=")) {
    const nested: PayDunyaPayload = {};
    const nestedParams = new URLSearchParams(trimmed);
    for (const [key, nestedValue] of nestedParams.entries()) {
      setBracketPath(nested, key, nestedValue);
    }
    return Object.keys(nested).length > 0 ? nested : value;
  }

  return value;
}

function setBracketPath(target: PayDunyaPayload, key: string, value: string) {
  const parts = key.replace(/\]/g, "").split("[");
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function asRecord(value: unknown): PayDunyaPayload | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as PayDunyaPayload
    : null;
}
