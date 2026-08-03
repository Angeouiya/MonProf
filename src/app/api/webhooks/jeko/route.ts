import { NextRequest, NextResponse } from "next/server";
import { getJekoServerConfig } from "@/lib/jeko-config";
import { reconcileJekoPayoutWebhook } from "@/lib/jeko-payout-reconciliation";
import { reconcileJekoWebhook } from "@/lib/jeko-reconciliation";
import {
  jekoPayloadSha256,
  parseJekoWebhookPayload,
  verifyJekoWebhookSignature,
} from "@/lib/jeko-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 256 * 1024;
// Jèko attend une réponse en moins de cinq secondes. Les flux navigateur
// conservent leur timeout normal, mais le webhook demande une nouvelle
// livraison plutôt que de bloquer huit secondes sur une confirmation distante.
const JEKO_WEBHOOK_API_TIMEOUT_MS = 1_500;

export function GET() {
  return NextResponse.json({
    ok: true,
    provider: "JEKO",
    endpoint: "webhook",
    message: "Webhook Jèko Compétence disponible. Les paiements sont validés uniquement par POST signé et confirmation serveur Jèko.",
  });
}

export async function POST(request: NextRequest) {
  const config = getJekoServerConfig();
  if (!config) {
    return NextResponse.json({ error: "Jèko n'est pas configuré sur le serveur." }, { status: 503 });
  }
  const webhookConfig = {
    ...config,
    timeoutMs: Math.min(config.timeoutMs, JEKO_WEBHOOK_API_TIMEOUT_MS),
  };

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Payload Jèko vide ou trop volumineux." }, { status: 413 });
  }
  const rawBody = await readRawBodyWithLimit(request, MAX_WEBHOOK_BYTES);
  if (!rawBody || rawBody.byteLength === 0) {
    return NextResponse.json({ error: "Payload Jèko vide ou trop volumineux." }, { status: 413 });
  }

  const signature = request.headers.get("jeko-signature");
  console.info("[jeko:webhook_received]", {
    requestId: request.headers.get("x-vercel-id") ?? null,
    payloadBytes: rawBody.byteLength,
    hasSignature: Boolean(signature),
  });
  if (!verifyJekoWebhookSignature(rawBody, signature, config.webhookSecret)) {
    console.warn("[jeko:webhook_invalid_signature]", {
      hasSignature: Boolean(signature),
      payloadBytes: rawBody.byteLength,
    });
    return NextResponse.json({ error: "Signature Jèko invalide." }, { status: 401 });
  }

  let webhook;
  try {
    webhook = parseJekoWebhookPayload(rawBody);
  } catch (error) {
    console.warn("[jeko:webhook_payload_rejected]", {
      requestId: request.headers.get("x-vercel-id") ?? null,
      payloadBytes: rawBody.byteLength,
      message: error instanceof Error ? error.message : "Payload invalide",
    });
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Payload webhook Jèko invalide.",
    }, { status: 400 });
  }

  try {
    const transactionType = webhook.transaction.transactionType
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, "");
    if (transactionType === "transfer") {
      const result = await reconcileJekoPayoutWebhook({
        webhook,
        payloadSha256: jekoPayloadSha256(rawBody),
        config: webhookConfig,
      });
      const httpStatus = ["not_found", "pending"].includes(result.action) ? 503 : 200;
      console.info("[jeko:payout_webhook_reconciled]", {
        providerEventId: webhook.transaction.id,
        payoutRecordId: result.payoutRecordId ?? null,
        action: result.action,
        verified: result.verified,
      });
      return NextResponse.json({
        received: true,
        providerFlow: "teacher_payout",
        verified: result.verified,
        action: result.action,
        status: result.status,
        payoutRecordId: result.payoutRecordId,
        reference: result.reference,
        message: result.message,
      }, { status: httpStatus });
    }

    // Le rapprochement historique des encaissements reste inchangé. Seuls les
    // événements transactionType=transfer sont délégués au ledger professeur.
    const result = await reconcileJekoWebhook({
      webhook,
      payloadSha256: jekoPayloadSha256(rawBody),
      config: webhookConfig,
    });
    const httpStatus = ["not_found", "pending"].includes(result.action) ? 503 : 200;

    console.info("[jeko:webhook_reconciled]", {
      providerEventId: webhook.transaction.id,
      action: result.action,
      verified: result.verified,
      attemptId: result.attemptId ?? null,
      bookingId: result.bookingId ?? null,
      rescheduleRequestId: result.rescheduleRequestId ?? null,
    });
    return NextResponse.json({
      received: true,
      verified: result.verified,
      action: result.action,
      status: result.status,
      attemptId: result.attemptId,
      bookingId: result.bookingId,
      rescheduleRequestId: result.rescheduleRequestId,
      providerFlow: result.rescheduleRequestId ? "reschedule_fee" : "booking_payment",
      message: result.message,
    }, { status: httpStatus });
  } catch (error) {
    console.error("[jeko:webhook_reconciliation_failed]", {
      providerEventId: webhook.transaction.id,
      message: error instanceof Error ? error.message : "Erreur inconnue",
    });
    // Un 5xx demande à Jèko de réessayer. Aucun paiement n'est validé
    // lorsque la confirmation serveur ou la transaction SQL échoue.
    return NextResponse.json({ error: "Rapprochement Jèko temporairement indisponible." }, { status: 503 });
  }
}

async function readRawBodyWithLimit(request: NextRequest, maxBytes: number) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel("Payload Jèko trop volumineux.");
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
