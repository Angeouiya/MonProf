import { DuplicateMessageError, QueueClient, type VercelRegion } from "@vercel/queue";

export const COMMUNICATION_QUEUE_TOPIC = "communication-campaigns";

export type CommunicationCampaignDispatchPhase = "CLIENTS" | "TEACHERS";

export type CommunicationCampaignQueueMessage = {
  kind: "DISPATCH_CAMPAIGN";
  campaignId: string;
  phase: CommunicationCampaignDispatchPhase;
  cursor?: string | null;
  createdAt: string;
  idempotencyKey?: string;
};

export type CommunicationCampaignQueuePublishResult =
  | { queued: true; messageId: string | null; duplicate?: boolean }
  | { queued: false; error: string };

const queueClient = new QueueClient({ region: getQueueRegion() });

export async function publishCommunicationCampaignEvent(
  message: Omit<CommunicationCampaignQueueMessage, "kind" | "createdAt">,
  options: { idempotencyKey?: string } = {},
): Promise<CommunicationCampaignQueuePublishResult> {
  if (process.env.COMMUNICATION_QUEUE_DISABLED === "true") {
    return { queued: false, error: "COMMUNICATION_QUEUE_DISABLED=true" };
  }

  const payload: CommunicationCampaignQueueMessage = {
    kind: "DISPATCH_CAMPAIGN",
    campaignId: message.campaignId,
    phase: message.phase,
    cursor: message.cursor ?? null,
    createdAt: new Date().toISOString(),
  };
  const idempotencyKey = options.idempotencyKey
    ?? `communication-${payload.campaignId}-${payload.phase}-${payload.cursor || "start"}`;
  payload.idempotencyKey = idempotencyKey;

  try {
    if (isCloudflareRuntime()) {
      await sendCloudflareQueueMessage("COMMUNICATION_QUEUE", payload);
      logCommunicationQueue("published", {
        campaignId: payload.campaignId,
        phase: payload.phase,
        cursor: payload.cursor,
        messageId: idempotencyKey,
        provider: "cloudflare",
      });
      return { queued: true, messageId: idempotencyKey };
    }

    const result = await queueClient.send(COMMUNICATION_QUEUE_TOPIC, payload, {
      idempotencyKey,
      retentionSeconds: 60 * 60 * 24,
      headers: {
        "x-competence-topic": COMMUNICATION_QUEUE_TOPIC,
        "x-competence-campaign-id": payload.campaignId,
        "x-competence-phase": payload.phase,
      },
    });
    logCommunicationQueue("published", { campaignId: payload.campaignId, phase: payload.phase, cursor: payload.cursor, messageId: result.messageId });
    return { queued: true, messageId: result.messageId };
  } catch (error) {
    if (error instanceof DuplicateMessageError) {
      logCommunicationQueue("duplicate", { campaignId: payload.campaignId, phase: payload.phase, cursor: payload.cursor });
      return { queued: true, messageId: null, duplicate: true };
    }
    const messageText = error instanceof Error ? error.message : "Queue communication indisponible.";
    console.warn(JSON.stringify({
      level: "warn",
      scope: "communication-queue",
      message: "publish_failed",
      campaignId: payload.campaignId,
      phase: payload.phase,
      error: messageText,
    }));
    return { queued: false, error: messageText };
  }
}

function isCloudflareRuntime() {
  return process.env.APP_DEPLOYMENT_PLATFORM === "cloudflare" || Boolean(process.env.CLOUDFLARE_ENV);
}

async function sendCloudflareQueueMessage(
  bindingName: "COMMUNICATION_QUEUE",
  message: CommunicationCampaignQueueMessage,
) {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const context = getCloudflareContext();
  const queue = (context.env as unknown as Record<string, CloudflareQueueBinding | undefined>)[bindingName];
  if (!queue) throw new Error(`Binding Cloudflare ${bindingName} indisponible.`);
  await queue.send(message, { contentType: "json" });
}

type CloudflareQueueBinding = {
  send(body: unknown, options?: { contentType?: "json" | "text" | "bytes" | "v8" }): Promise<void>;
};

function getQueueRegion(): VercelRegion {
  return (process.env.VERCEL_QUEUE_REGION || process.env.VERCEL_REGION || "lhr1") as VercelRegion;
}

function logCommunicationQueue(message: string, extra: Record<string, unknown>) {
  console.log(JSON.stringify({
    level: "info",
    scope: "communication-queue",
    message,
    ...extra,
  }));
}
