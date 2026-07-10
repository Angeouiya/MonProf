import webPush from "web-push";
import { db } from "@/lib/db";

const MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 40;
const WEB_PUSH_SETTING_KEYS = {
  publicKey: "web_push_vapid_public_key",
  privateKey: "web_push_vapid_private_key",
  subject: "web_push_subject",
} as const;

let configurationCache: { expiresAt: number; value: WebPushConfiguration } | null = null;

type WebPushConfiguration = {
  configured: boolean;
  publicKey: string;
  privateKey: string;
  subject: string;
};

type OutboxRow = {
  id: string;
  recipientType: "CLIENT" | "TEACHER" | "ADMIN";
  targetUserId: string | null;
  targetTeacherId: string | null;
  title: string;
  message: string;
  link: string | null;
  priority: "NORMAL" | "IMPORTANT" | "URGENT" | "CRITICAL";
  attempts: number;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failureCount: number;
};

export async function getWebPushConfiguration(): Promise<WebPushConfiguration> {
  if (configurationCache && configurationCache.expiresAt > Date.now()) return configurationCache.value;

  const rows: Array<{ key: string; value: string }> = await db.setting.findMany({
    where: { key: { in: Object.values(WEB_PUSH_SETTING_KEYS) } },
    select: { key: true, value: true },
  }).catch(() => [] as Array<{ key: string; value: string }>);
  const settings = new Map<string, string>(rows.map((row) => [row.key, row.value.trim()] as const));
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim()
    || settings.get(WEB_PUSH_SETTING_KEYS.publicKey)
    || "";
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim()
    || settings.get(WEB_PUSH_SETTING_KEYS.privateKey)
    || "";
  const subject = process.env.WEB_PUSH_SUBJECT?.trim()
    || settings.get(WEB_PUSH_SETTING_KEYS.subject)
    || "mailto:contact@competence.ci";
  const value = {
    configured: Boolean(publicKey && privateKey && subject),
    publicKey,
    privateKey,
    subject,
  };
  configurationCache = { expiresAt: Date.now() + 60_000, value };
  return value;
}

export async function getWebPushPublicKey() {
  return (await getWebPushConfiguration()).publicKey;
}

export async function flushWebPushOutbox(limit = DEFAULT_BATCH_SIZE) {
  const config = await getWebPushConfiguration();
  if (!config.configured) {
    return { configured: false, claimed: 0, sent: 0, partial: 0, failed: 0, noSubscription: 0 };
  }

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const claimed = await db.$queryRaw<OutboxRow[]>`
    WITH candidates AS (
      SELECT "id"
      FROM competence."WebPushOutbox"
      WHERE (
        ("status" IN ('PENDING', 'FAILED') AND "nextAttemptAt" <= NOW())
        OR ("status" = 'PROCESSING' AND "updatedAt" < NOW() - INTERVAL '5 minutes')
      )
        AND "attempts" < ${MAX_ATTEMPTS}
      ORDER BY
        CASE "priority"
          WHEN 'CRITICAL' THEN 1
          WHEN 'URGENT' THEN 2
          WHEN 'IMPORTANT' THEN 3
          ELSE 4
        END,
        "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${Math.max(1, Math.min(limit, 100))}
    )
    UPDATE competence."WebPushOutbox" outbox
    SET "status" = 'PROCESSING',
        "attempts" = outbox."attempts" + 1,
        "updatedAt" = NOW()
    FROM candidates
    WHERE outbox."id" = candidates."id"
    RETURNING
      outbox."id",
      outbox."recipientType",
      outbox."targetUserId",
      outbox."targetTeacherId",
      outbox."title",
      outbox."message",
      outbox."link",
      outbox."priority",
      outbox."attempts"
  `;

  const summary = { configured: true, claimed: claimed.length, sent: 0, partial: 0, failed: 0, noSubscription: 0 };
  for (const item of claimed) {
    const result = await deliverOutboxItem(item);
    if (result === "sent") summary.sent += 1;
    if (result === "partial") summary.partial += 1;
    if (result === "failed") summary.failed += 1;
    if (result === "no-subscription") summary.noSubscription += 1;
  }
  return summary;
}

async function deliverOutboxItem(item: OutboxRow) {
  const subscriptions = await findSubscriptions(item);
  if (subscriptions.length === 0) {
    await db.webPushOutbox.update({
      where: { id: item.id },
      data: {
        status: "NO_SUBSCRIPTION",
        processedAt: new Date(),
        lastError: "Aucun navigateur n'a activé les notifications push pour ce destinataire.",
      },
    });
    return "no-subscription" as const;
  }

  const payload = JSON.stringify({
    title: item.title,
    body: item.message.slice(0, 420),
    icon: "/images/brand/competence-icon-512.png",
    badge: "/images/brand/competence-icon.png",
    url: safeDestination(item.link, item.recipientType),
    tag: `competence-${item.id}`,
    priority: item.priority,
    outboxId: item.id,
  });

  let sent = 0;
  const errors: string[] = [];
  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        {
          TTL: item.priority === "CRITICAL" ? 60 * 60 * 24 : 60 * 60 * 12,
          urgency: item.priority === "CRITICAL" || item.priority === "URGENT" ? "high" : "normal",
          topic: topicFor(item),
        },
      );
      sent += 1;
      await db.webPushSubscription.update({
        where: { id: subscription.id },
        data: { failureCount: 0, lastSuccessAt: new Date(), lastFailureAt: null },
      });
    } catch (error) {
      const statusCode = pushStatusCode(error);
      const message = pushErrorMessage(error);
      errors.push(message);
      await db.webPushSubscription.update({
        where: { id: subscription.id },
        data: {
          failureCount: { increment: 1 },
          lastFailureAt: new Date(),
          ...(statusCode === 404 || statusCode === 410
            ? { enabled: false, revokedAt: new Date() }
            : {}),
        },
      });
    }
  }

  if (sent > 0) {
    await db.webPushOutbox.update({
      where: { id: item.id },
      data: {
        status: errors.length > 0 ? "PARTIAL" : "SENT",
        processedAt: new Date(),
        lastError: errors.length > 0 ? errors.join(" | ").slice(0, 1800) : null,
      },
    });
    return errors.length > 0 ? "partial" as const : "sent" as const;
  }

  const dead = item.attempts >= MAX_ATTEMPTS;
  const retryDelayMinutes = Math.min(60, 2 ** Math.max(0, item.attempts - 1));
  await db.webPushOutbox.update({
    where: { id: item.id },
    data: {
      status: dead ? "DEAD" : "FAILED",
      nextAttemptAt: new Date(Date.now() + retryDelayMinutes * 60_000),
      processedAt: dead ? new Date() : null,
      lastError: errors.join(" | ").slice(0, 1800) || "Le provider push n'a retourné aucun succès.",
    },
  });
  return "failed" as const;
}

async function findSubscriptions(item: OutboxRow): Promise<PushSubscriptionRow[]> {
  const select = { id: true, endpoint: true, p256dh: true, auth: true, failureCount: true } as const;
  if (item.recipientType === "TEACHER") {
    if (!item.targetTeacherId) return [];
    return db.webPushSubscription.findMany({
      where: { teacherId: item.targetTeacherId, enabled: true, revokedAt: null },
      select,
    });
  }

  if (item.recipientType === "CLIENT") {
    if (!item.targetUserId) return [];
    return db.webPushSubscription.findMany({
      where: { userId: item.targetUserId, enabled: true, revokedAt: null },
      select,
    });
  }

  return db.webPushSubscription.findMany({
    where: {
      enabled: true,
      revokedAt: null,
      ...(item.targetUserId ? { userId: item.targetUserId } : {}),
      user: {
        is: {
          role: "ADMIN",
          adminAccessEnabled: true,
          adminDeletedAt: null,
          OR: [{ adminAccountStatus: "ACTIVE" }, { adminAccountStatus: null }],
        },
      },
    },
    select,
  });
}

function safeDestination(link: string | null, recipientType: OutboxRow["recipientType"]) {
  const fallback = recipientType === "CLIENT"
    ? "/client/notifications"
    : recipientType === "TEACHER"
      ? "/professeur/notifications"
      : "/admin/notifications";
  if (!link || !link.startsWith("/") || link.startsWith("//")) return fallback;
  return link;
}

function topicFor(item: OutboxRow) {
  return `${item.recipientType.toLowerCase()}-${item.priority.toLowerCase()}`.slice(0, 32);
}

function pushStatusCode(error: unknown) {
  if (typeof error === "object" && error && "statusCode" in error) {
    const value = Number((error as { statusCode?: unknown }).statusCode);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function pushErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Erreur inconnue du provider Web Push.";
}
