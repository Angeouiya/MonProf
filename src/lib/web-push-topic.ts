import { createHash } from "node:crypto";

/**
 * RFC 8030 replaces an undelivered push with the same Topic. Use the durable
 * outbox id rather than role/priority, so distinct lessons never collapse.
 * Retries of the same outbox item deliberately retain the same topic.
 */
export function webPushTopicForOutbox(outboxId: string) {
  return createHash("sha256").update(outboxId).digest("base64url").slice(0, 32);
}
