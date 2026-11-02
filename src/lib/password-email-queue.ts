import { flushPasswordEmailOutbox } from "@/lib/password-email-outbox";

export type PasswordEmailQueueMessage = {
  kind: "FLUSH_PASSWORD_EMAIL_JOB";
  jobId: string;
  createdAt: string;
};

export type PasswordEmailQueuePublishResult =
  | { queued: true }
  | { queued: false; error: string };

/**
 * Publie le job après sa transaction SQL. L'attente porte uniquement sur
 * l'écriture rapide dans Cloudflare Queues, jamais sur l'appel à Resend.
 */
export async function publishPasswordEmailJob(
  jobId: string,
): Promise<PasswordEmailQueuePublishResult> {
  if (!jobId.trim()) return { queued: false, error: "Identifiant de job absent." };
  if (!isCloudflareRuntime()) {
    return { queued: false, error: "File Cloudflare indisponible hors Workers." };
  }

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = getCloudflareContext();
    const queue = (context.env as unknown as {
      PASSWORD_EMAIL_QUEUE?: CloudflareQueueBinding;
    }).PASSWORD_EMAIL_QUEUE;
    if (!queue) throw new Error("Binding PASSWORD_EMAIL_QUEUE indisponible.");

    await queue.send({
      kind: "FLUSH_PASSWORD_EMAIL_JOB",
      jobId,
      createdAt: new Date().toISOString(),
    } satisfies PasswordEmailQueueMessage, { contentType: "json" });

    console.log(JSON.stringify({
      level: "info",
      scope: "password-email-queue",
      message: "published",
      jobId,
    }));
    return { queued: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "File indisponible.";
    console.error(JSON.stringify({
      level: "error",
      scope: "password-email-queue",
      message: "publish_failed",
      jobId,
      error: message,
    }));
    return { queued: false, error: message };
  }
}

export async function processPasswordEmailQueueMessage(
  message: PasswordEmailQueueMessage,
) {
  if (
    !message
    || message.kind !== "FLUSH_PASSWORD_EMAIL_JOB"
    || typeof message.jobId !== "string"
    || !message.jobId.trim()
  ) {
    throw new Error("Message de file email invalide.");
  }

  return flushPasswordEmailOutbox({ jobIds: [message.jobId], limit: 1 });
}

function isCloudflareRuntime() {
  return process.env.APP_DEPLOYMENT_PLATFORM === "cloudflare"
    || Boolean(process.env.CLOUDFLARE_ENV);
}

type CloudflareQueueBinding = {
  send(body: unknown, options?: { contentType?: "json" | "text" | "bytes" | "v8" }): Promise<void>;
};
