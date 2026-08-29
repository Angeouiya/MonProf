import { DuplicateMessageError, QueueClient, type VercelRegion } from "@vercel/queue";
import { flushWebPushOutbox, type WebPushFlushSummary } from "@/lib/web-push";

export const WEB_PUSH_QUEUE_TOPIC = "web-push-events";
const DEFAULT_QUEUE_FLUSH_LIMIT = 500;
const queueClient = new QueueClient({ region: getQueueRegion() });

export type WebPushQueueMessage = {
  kind: "FLUSH_OUTBOX";
  reason: "outbox_created" | "communication_campaign" | "cron_recovery" | "manual" | "health_retry";
  limit?: number;
  createdAt: string;
  idempotencyKey?: string;
};

export type WebPushQueuePublishResult =
  | { queued: true; messageId: string | null; duplicate?: boolean }
  | { queued: false; error: string };

export async function publishWebPushFlushEvent(
  reason: WebPushQueueMessage["reason"] = "outbox_created",
  options: { limit?: number; idempotencyKey?: string } = {},
): Promise<WebPushQueuePublishResult> {
  if (process.env.WEB_PUSH_QUEUE_DISABLED === "true") {
    return { queued: false, error: "WEB_PUSH_QUEUE_DISABLED=true" };
  }

  const limit = clampQueueLimit(options.limit ?? DEFAULT_QUEUE_FLUSH_LIMIT);
  const bucket = Math.floor(Date.now() / 5_000);
  const idempotencyKey = options.idempotencyKey ?? `web-push-${reason}-${bucket}`;
  const message: WebPushQueueMessage = {
    kind: "FLUSH_OUTBOX",
    reason,
    limit,
    createdAt: new Date().toISOString(),
    idempotencyKey,
  };

  try {
    if (isCloudflareRuntime()) {
      await sendCloudflareQueueMessage("WEB_PUSH_QUEUE", message);
      logQueue("published", { reason, limit, idempotencyKey, provider: "cloudflare" });
      return { queued: true, messageId: idempotencyKey };
    }

    const result = await queueClient.send(WEB_PUSH_QUEUE_TOPIC, message, {
      idempotencyKey,
      retentionSeconds: 60 * 60 * 24,
      headers: {
        "x-competence-topic": WEB_PUSH_QUEUE_TOPIC,
        "x-competence-reason": reason,
      },
    });
    logQueue("published", { reason, limit, idempotencyKey, messageId: result.messageId });
    return { queued: true, messageId: result.messageId };
  } catch (error) {
    if (error instanceof DuplicateMessageError) {
      logQueue("duplicate", { reason, limit, idempotencyKey });
      return { queued: true, messageId: null, duplicate: true };
    }

    const messageText = error instanceof Error ? error.message : "Queue Web Push indisponible.";
    console.warn(JSON.stringify({
      level: "warn",
      scope: "web-push-queue",
      message: "publish_failed",
      reason,
      error: messageText,
    }));
    return { queued: false, error: messageText };
  }
}

function isCloudflareRuntime() {
  return process.env.APP_DEPLOYMENT_PLATFORM === "cloudflare" || Boolean(process.env.CLOUDFLARE_ENV);
}

async function sendCloudflareQueueMessage(bindingName: "WEB_PUSH_QUEUE", message: WebPushQueueMessage) {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const context = getCloudflareContext();
  const queue = (context.env as unknown as Record<string, CloudflareQueueBinding | undefined>)[bindingName];
  if (!queue) throw new Error(`Binding Cloudflare ${bindingName} indisponible.`);
  await queue.send(message, { contentType: "json" });
}

type CloudflareQueueBinding = {
  send(body: unknown, options?: { contentType?: "json" | "text" | "bytes" | "v8" }): Promise<void>;
};

export async function processWebPushQueueMessage(message: WebPushQueueMessage): Promise<WebPushFlushSummary> {
  if (!message || message.kind !== "FLUSH_OUTBOX") {
    throw new Error("Message Web Push queue invalide.");
  }

  return flushWebPushOutbox(clampQueueLimit(message.limit ?? DEFAULT_QUEUE_FLUSH_LIMIT));
}

function clampQueueLimit(limit: number) {
  return Math.max(1, Math.min(Math.trunc(limit || DEFAULT_QUEUE_FLUSH_LIMIT), DEFAULT_QUEUE_FLUSH_LIMIT));
}

function logQueue(message: string, extra: Record<string, unknown>) {
  console.log(JSON.stringify({
    level: "info",
    scope: "web-push-queue",
    message,
    ...extra,
  }));
}

function getQueueRegion(): VercelRegion {
  return (process.env.VERCEL_QUEUE_REGION || process.env.VERCEL_REGION || "lhr1") as VercelRegion;
}
