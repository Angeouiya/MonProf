import { QueueClient, type VercelRegion } from "@vercel/queue";
import { processCommunicationCampaignBatch } from "@/lib/communication-campaigns";
import { type CommunicationCampaignQueueMessage } from "@/lib/communication-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_DELIVERY_COUNT = 6;
const queueClient = new QueueClient({ region: (process.env.VERCEL_QUEUE_REGION || process.env.VERCEL_REGION || "lhr1") as VercelRegion });

const handleQueueCallback = queueClient.handleCallback<CommunicationCampaignQueueMessage>(
  async (message, metadata) => {
    const startedAt = Date.now();
    console.log(JSON.stringify({
      level: "info",
      scope: "communication-queue-worker",
      message: "start",
      queueMessageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      topicName: metadata.topicName,
      campaignId: message?.campaignId,
      phase: message?.phase,
    }));

    const result = await processCommunicationCampaignBatch(message);

    console.log(JSON.stringify({
      level: "info",
      scope: "communication-queue-worker",
      message: "done",
      queueMessageId: metadata.messageId,
      deliveryCount: metadata.deliveryCount,
      ms: Date.now() - startedAt,
      result,
    }));

    if (!result?.ok && metadata.deliveryCount < MAX_DELIVERY_COUNT) {
      throw new Error("Dispatch campagne communication incomplet.");
    }
  },
  {
    visibilityTimeoutSeconds: 600,
    retry: (error, metadata) => {
      const message = error instanceof Error ? error.message : "Erreur queue communication.";
      console.warn(JSON.stringify({
        level: "warn",
        scope: "communication-queue-worker",
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

export async function POST(request: Request) {
  return handleQueueCallback(request);
}
