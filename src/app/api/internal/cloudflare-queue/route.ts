import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processCommunicationCampaignBatch } from "@/lib/communication-campaigns";
import {
  type CommunicationCampaignQueueMessage,
} from "@/lib/communication-queue";
import {
  processWebPushQueueMessage,
  type WebPushQueueMessage,
} from "@/lib/web-push-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type CloudflareQueueEnvelope =
  | { queue: "web-push"; message: WebPushQueueMessage; attempts?: number }
  | { queue: "communication"; message: CommunicationCampaignQueueMessage; attempts?: number };

export async function POST(request: Request) {
  if (!hasValidInternalAuthorization(request)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  let envelope: CloudflareQueueEnvelope;
  try {
    envelope = await request.json() as CloudflareQueueEnvelope;
  } catch {
    return NextResponse.json({ ok: false, error: "Message invalide." }, { status: 400 });
  }

  try {
    if (envelope.queue === "web-push") {
      const result = await processWebPushQueueMessage(envelope.message);
      return NextResponse.json({ ok: true, result });
    }

    if (envelope.queue === "communication") {
      const result = await processCommunicationCampaignBatch(envelope.message);
      if (!result?.ok) throw new Error("Dispatch campagne communication incomplet.");
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ ok: false, error: "File inconnue." }, { status: 400 });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      scope: "cloudflare-queue-internal",
      queue: envelope.queue,
      attempts: envelope.attempts ?? 1,
      error: error instanceof Error ? error.message : "Traitement impossible.",
    }));
    return NextResponse.json({ ok: false, error: "Traitement temporairement impossible." }, { status: 503 });
  }
}

function hasValidInternalAuthorization(request: Request) {
  const expected = process.env.CLOUDFLARE_INTERNAL_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!expected || !provided) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}
