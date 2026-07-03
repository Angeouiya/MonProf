import { NextRequest, NextResponse } from "next/server";
import { verifyPayDunyaHash } from "@/lib/paydunya";
import { reconcilePayDunyaBookingPayment } from "@/lib/paydunya-reconciliation";

type PayDunyaPayload = Record<string, any>;

export async function POST(req: NextRequest) {
  let payload: PayDunyaPayload;
  try {
    payload = await readPayDunyaPayload(req);
  } catch {
    return NextResponse.json({ error: "Payload PayDunya invalide." }, { status: 400 });
  }

  const data = asRecord(payload.data) ?? payload;
  const hash = firstString(data.hash);

  if (!verifyPayDunyaHash(hash)) {
    return NextResponse.json({ error: "Signature PayDunya invalide." }, { status: 401 });
  }

  const invoice = asRecord(data.invoice) ?? {};
  const customData = asRecord(data.custom_data) ?? {};
  const status = firstString(data.status)?.toLowerCase() ?? null;
  const invoiceToken = firstString(invoice.token, data.token);
  const bookingId = firstString(
    customData.booking_id,
    customData.bookingId,
    customData.booking,
    data.booking_id,
  );
  const bookingReference = firstString(
    customData.booking_reference,
    customData.bookingReference,
    data.booking_reference,
  );

  if (!bookingId && !bookingReference) {
    return NextResponse.json({ error: "Réservation PayDunya introuvable dans custom_data." }, { status: 400 });
  }

  const result = await reconcilePayDunyaBookingPayment({
    bookingId,
    bookingReference,
    token: invoiceToken,
    source: "webhook",
    incomingStatus: status,
    incomingPayload: data,
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
    try {
      return { data: JSON.parse(rawData) };
    } catch {
      return { data: rawData };
    }
  }

  const payload: PayDunyaPayload = {};
  for (const [key, value] of params.entries()) {
    setBracketPath(payload, key, value);
  }
  return payload;
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
