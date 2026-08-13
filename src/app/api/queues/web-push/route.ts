import { QueueClient, type VercelRegion } from "@vercel/queue";
import { processWebPushQueueMessage, type WebPushQueueMessage } from "@/lib/web-push-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_DELIVERY_COUNT = 6;
const queueClient = new QueueClient({ region: (process.env.VERCEL_QUEUE_REGION || process.env.VERCEL_REGION || "lhr1") as VercelRegion });

export const POST = queueClient.handleCallback<WebPushQueueMessage>(
  async (message, metadata) => {
    const startedAt = Date.now();
    console.log(JSON.stringify({
      level: "info",
      scope: "web-push-queue-worker",
      message: "start",
      queueMessageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      topicName: metadata.topicName,
      reason: message?.reason,
    }));

    const result = await processWebPushQueueMessage(message);

    console.log(JSON.stringify({
      level: "info",
      scope: "web-push-queue-worker",
      message: "done",
      queueMessageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      ms: Date.now() - startedAt,
      ...result,
    }));

    if (
      result.configured
      && result.claimed > 0
      && result.failed > 0
      && result.sent === 0
      && result.partial === 0
      && result.noSubscription === 0
      && metadata.deliveryCount < MAX_DELIVERY_COUNT
    ) {
      throw new Error("Toutes les notifications Web Push du lot ont échoué temporairement.");
    }
  },
  {
    visibilityTimeoutSeconds: 600,
    retry: (error, metadata) => {
      const message = error instanceof Error ? error.message : "Erreur Web Push queue.";
      console.warn(JSON.stringify({
        level: "warn",
        scope: "web-push-queue-worker",
        message: "retry",
        queueMessageId: metadata.messageId,
        deliveryCount: metadata.deliveryCount,
        error: message,
      }));

      if (metadata.deliveryCount >= MAX_DELIVERY_COUNT) return { acknowledge: true };
      return { afterSeconds: Math.min(300, 2 ** metadata.deliveryCount * 5) };
    },
  },
);
