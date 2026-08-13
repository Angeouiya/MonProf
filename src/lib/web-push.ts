import webPush from "web-push";
import { db } from "@/lib/db";

const MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 500;
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

export type WebPushFlushSummary = {
  configured: boolean;
  claimed: number;
  sent: number;
  partial: number;
  failed: number;
  noSubscription: number;
  deliveriesAccepted: number;
  deliveriesFailed: number;
  deliveriesRevoked: number;
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

export async function flushWebPushOutbox(limit = DEFAULT_BATCH_SIZE): Promise<WebPushFlushSummary> {
  const batchLimit = Math.max(1, Math.min(Math.trunc(limit || DEFAULT_BATCH_SIZE), MAX_BATCH_SIZE));
  const config = await getWebPushConfiguration();
  if (!config.configured) {
    return emptySummary(false);
  }

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const startedAt = Date.now();
  const claimed = await db.$queryRaw<OutboxRow[]>`
    WITH candidates AS (
      SELECT "id"
      FROM competence."WebPushOutbox"
      WHERE (
        ("status" IN ('PENDING', 'FAILED', 'PARTIAL') AND "nextAttemptAt" <= NOW())
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
      LIMIT ${batchLimit}
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

  const summary = emptySummary(true);
  summary.claimed = claimed.length;
  for (const item of claimed) {
    const result = await deliverOutboxItem(item);
    summary.sent += result.sent;
    summary.partial += result.partial;
    summary.failed += result.failed;
    summary.noSubscription += result.noSubscription;
    summary.deliveriesAccepted += result.deliveriesAccepted;
    summary.deliveriesFailed += result.deliveriesFailed;
    summary.deliveriesRevoked += result.deliveriesRevoked;
  }
  logWebPush("flush_done", { ...summary, ms: Date.now() - startedAt, batchLimit });
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
    return {
      sent: 0,
      partial: 0,
      failed: 0,
      noSubscription: 1,
      deliveriesAccepted: 0,
      deliveriesFailed: 0,
      deliveriesRevoked: 0,
    };
  }

  const payload = JSON.stringify({
    title: item.title,
    body: item.message.slice(0, 420),
    icon: "/images/brand/competence-notification-monogram-tile-512.png?v=9",
    badge: "/images/brand/competence-notification-monogram-badge-192.png?v=9",
    url: safeDestination(item.link, item.recipientType),
    tag: `competence-${item.id}`,
    priority: item.priority,
    outboxId: item.id,
    badgeCount: await getBadgeCount(item),
    silent: !["URGENT", "CRITICAL"].includes(item.priority),
    actions: [{ action: "open", title: item.priority === "CRITICAL" ? "Traiter" : "Ouvrir" }],
  });

  let sent = 0;
  let revoked = 0;
  const existingDeliveries = await db.webPushDelivery.findMany({
    where: {
      outboxId: item.id,
      subscriptionId: { in: subscriptions.map((subscription) => subscription.id) },
    },
    select: { subscriptionId: true, status: true },
  });
  const alreadyFinalBySubscription = new Map(existingDeliveries
    .filter((delivery) => delivery.status === "ACCEPTED" || delivery.status === "REVOKED")
    .map((delivery) => [delivery.subscriptionId, delivery.status]));
  const deliverableSubscriptions = subscriptions.filter((subscription) => !alreadyFinalBySubscription.has(subscription.id));
  const errors: string[] = [];
  const transientErrors: string[] = [];
  if (deliverableSubscriptions.length === 0 && alreadyFinalBySubscription.size > 0) {
    const finalAccepted = Array.from(alreadyFinalBySubscription.values()).filter((status) => status === "ACCEPTED").length;
    await db.webPushOutbox.update({
      where: { id: item.id },
      data: {
        status: finalAccepted > 0 ? "SENT" : "DEAD",
        processedAt: new Date(),
        lastError: finalAccepted > 0 ? null : "Tous les endpoints disponibles sont révoqués.",
      },
    });
    return {
      sent: finalAccepted > 0 ? 1 : 0,
      partial: 0,
      failed: finalAccepted > 0 ? 0 : 1,
      noSubscription: 0,
      deliveriesAccepted: 0,
      deliveriesFailed: 0,
      deliveriesRevoked: 0,
    };
  }

  for (const subscription of deliverableSubscriptions) {
    await db.webPushDelivery.upsert({
      where: { outboxId_subscriptionId: { outboxId: item.id, subscriptionId: subscription.id } },
      create: {
        outboxId: item.id,
        subscriptionId: subscription.id,
        status: "PROCESSING",
        attempt: item.attempts,
      },
      update: {
        status: "PROCESSING",
        attempt: item.attempts,
        lastError: null,
        providerStatusCode: null,
        failedAt: null,
      },
    });

    try {
      const providerResponse = await webPush.sendNotification(
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
      const now = new Date();
      await db.$transaction([
        db.webPushDelivery.update({
          where: { outboxId_subscriptionId: { outboxId: item.id, subscriptionId: subscription.id } },
          data: {
            status: "ACCEPTED",
            acceptedAt: now,
            failedAt: null,
            lastError: null,
            providerStatusCode: providerStatusCode(providerResponse),
            providerMessageId: providerMessageId(providerResponse),
          },
        }),
        db.webPushSubscription.update({
          where: { id: subscription.id },
          data: { failureCount: 0, lastSuccessAt: now, lastFailureAt: null, lastSeenAt: now },
        }),
      ]);
    } catch (error) {
      const statusCode = pushStatusCode(error);
      const message = pushErrorMessage(error);
      const isRevoked = statusCode === 404 || statusCode === 410;
      if (isRevoked) revoked += 1;
      if (!isRevoked) transientErrors.push(message);
      errors.push(message);
      const now = new Date();
      await db.$transaction([
        db.webPushDelivery.update({
          where: { outboxId_subscriptionId: { outboxId: item.id, subscriptionId: subscription.id } },
          data: {
            status: isRevoked ? "REVOKED" : "FAILED",
            providerStatusCode: statusCode,
            failedAt: now,
            lastError: message,
          },
        }),
        db.webPushSubscription.update({
          where: { id: subscription.id },
          data: {
            failureCount: { increment: 1 },
            lastFailureAt: now,
            ...(isRevoked
              ? { enabled: false, revokedAt: now }
              : {}),
          },
        }),
      ]);
    }
  }

  if (sent > 0) {
    const retryDelayMinutes = Math.min(60, 2 ** Math.max(0, item.attempts - 1));
    await db.webPushOutbox.update({
      where: { id: item.id },
      data: {
        status: transientErrors.length > 0 ? "PARTIAL" : "SENT",
        processedAt: transientErrors.length > 0 ? null : new Date(),
        nextAttemptAt: transientErrors.length > 0 ? new Date(Date.now() + retryDelayMinutes * 60_000) : undefined,
        lastError: errors.length > 0 ? errors.join(" | ").slice(0, 1800) : null,
      },
    });
    return {
      sent: errors.length > 0 ? 0 : 1,
      partial: transientErrors.length > 0 ? 1 : 0,
      failed: 0,
      noSubscription: 0,
      deliveriesAccepted: sent,
      deliveriesFailed: errors.length,
      deliveriesRevoked: revoked,
    };
  }

  const dead = item.attempts >= MAX_ATTEMPTS || transientErrors.length === 0;
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
  return {
    sent: 0,
    partial: 0,
    failed: 1,
    noSubscription: 0,
    deliveriesAccepted: 0,
    deliveriesFailed: errors.length,
    deliveriesRevoked: revoked,
  };
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
      : "/admin/communication";
  if (!link || !link.startsWith("/") || link.startsWith("//")) return fallback;
  return link;
}

function topicFor(item: OutboxRow) {
  return `${item.recipientType.toLowerCase()}-${item.priority.toLowerCase()}`.slice(0, 32);
}

async function getBadgeCount(item: OutboxRow) {
  if (item.recipientType === "TEACHER" && item.targetTeacherId) {
    return db.teacherNotification.count({
      where: {
        teacherId: item.targetTeacherId,
        status: { in: ["DRAFT", "PENDING", "SENT", "FAILED"] },
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }).catch(() => undefined);
  }

  if (item.recipientType === "CLIENT" && item.targetUserId) {
    return db.notification.count({
      where: {
        recipientType: "CLIENT",
        read: false,
        deletedAt: null,
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          { OR: [{ userId: item.targetUserId }, { clientId: item.targetUserId }] },
        ],
      },
    }).catch(() => undefined);
  }

  if (item.recipientType === "ADMIN") {
    return db.notification.count({
      where: {
        recipientType: "ADMIN",
        read: false,
        priority: { in: ["IMPORTANT", "URGENT", "CRITICAL"] },
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    }).catch(() => undefined);
  }

  return undefined;
}

function pushStatusCode(error: unknown) {
  if (typeof error === "object" && error && "statusCode" in error) {
    const value = Number((error as { statusCode?: unknown }).statusCode);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function providerStatusCode(response: unknown) {
  if (typeof response === "object" && response && "statusCode" in response) {
    const value = Number((response as { statusCode?: unknown }).statusCode);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function providerMessageId(response: unknown) {
  if (typeof response !== "object" || !response || !("headers" in response)) return null;
  const headers = (response as { headers?: Record<string, unknown> }).headers;
  const value = headers?.location || headers?.["x-request-id"] || headers?.["x-message-id"];
  return typeof value === "string" ? value.slice(0, 500) : null;
}

function pushErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  return "Erreur inconnue du provider Web Push.";
}

function emptySummary(configured: boolean): WebPushFlushSummary {
  return {
    configured,
    claimed: 0,
    sent: 0,
    partial: 0,
    failed: 0,
    noSubscription: 0,
    deliveriesAccepted: 0,
    deliveriesFailed: 0,
    deliveriesRevoked: 0,
  };
}

function logWebPush(message: string, extra: Record<string, unknown>) {
  console.log(JSON.stringify({
    level: "info",
    scope: "web-push",
    message,
    ...extra,
  }));
}
