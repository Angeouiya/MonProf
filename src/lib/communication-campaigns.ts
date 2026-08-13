import { db } from "@/lib/db";
import type { CommunicationAudience, CommunicationCampaignStatus, NotificationChannel, NotificationPriority } from "@prisma/client";
import {
  publishCommunicationCampaignEvent,
  type CommunicationCampaignDispatchPhase,
  type CommunicationCampaignQueueMessage,
} from "@/lib/communication-queue";
import { publishWebPushFlushEvent } from "@/lib/web-push-queue";

export const COMMUNICATION_RETENTION_DAYS = 90;
export const COMMUNICATION_CAMPAIGN_BATCH_SIZE = 500;

type CommunicationCampaignDispatchRecord = {
  id: string;
  title: string;
  message: string;
  audience: CommunicationAudience;
  targetUserId: string | null;
  targetTeacherId: string | null;
  channel: NotificationChannel;
  priority: NotificationPriority;
  status: CommunicationCampaignStatus;
  recipientCount: number;
  link: string | null;
  actionLabel: string | null;
  expiresAt: Date | null;
  deletedAt: Date | null;
};

export function defaultCommunicationExpiresAt(from = new Date()) {
  return new Date(from.getTime() + COMMUNICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function processCommunicationCampaignBatch(message: CommunicationCampaignQueueMessage) {
  if (!message || message.kind !== "DISPATCH_CAMPAIGN" || !message.campaignId) {
    throw new Error("Message communication invalide.");
  }

  const campaign = await db.communicationCampaign.findUnique({
    where: { id: message.campaignId },
    select: {
      id: true,
      title: true,
      message: true,
      audience: true,
      targetUserId: true,
      targetTeacherId: true,
      channel: true,
      priority: true,
      status: true,
      recipientCount: true,
      link: true,
      actionLabel: true,
      expiresAt: true,
      deletedAt: true,
    },
  });

  if (!campaign || campaign.deletedAt || ["CANCELLED", "FAILED", "SENT", "PARTIAL"].includes(campaign.status)) {
    return { ok: true, skipped: true, reason: "campaign_closed_or_missing", campaignId: message.campaignId };
  }

  const phase = message.phase || "CLIENTS";
  const cursor = message.cursor ?? null;

  if (phase === "CLIENTS" && includesClients(campaign.audience)) {
    const result = await processClientBatch(campaign, cursor);
    if (result.hasMore) {
      await scheduleNextBatch(campaign.id, "CLIENTS", result.nextCursor);
      return { ok: true, campaignId: campaign.id, phase, ...result };
    }
  }

  if (includesTeachers(campaign.audience)) {
    const teacherCursor = phase === "TEACHERS" ? cursor : null;
    const result = await processTeacherBatch(campaign, teacherCursor);
    if (result.hasMore) {
      await scheduleNextBatch(campaign.id, "TEACHERS", result.nextCursor);
      return { ok: true, campaignId: campaign.id, phase: "TEACHERS", ...result };
    }
  }

  return finalizeCampaign(campaign.id, campaign.recipientCount);
}

export async function recoverOpenCommunicationCampaigns(limit = 10) {
  const campaigns = await db.communicationCampaign.findMany({
    where: {
      status: "SENDING",
      deletedAt: null,
      OR: [
        { lastDispatchAt: null },
        { lastDispatchAt: { lt: new Date(Date.now() - 60_000) } },
      ],
    },
    select: { id: true, dispatchPhase: true, dispatchCursor: true },
    orderBy: [{ lastDispatchAt: "asc" }, { createdAt: "asc" }],
    take: Math.max(1, Math.min(Math.trunc(limit || 10), 25)),
  });

  const results: unknown[] = [];
  for (const campaign of campaigns) {
    results.push(await processCommunicationCampaignBatch({
      kind: "DISPATCH_CAMPAIGN",
      campaignId: campaign.id,
      phase: normalizePhase(campaign.dispatchPhase),
      cursor: campaign.dispatchCursor,
      createdAt: new Date().toISOString(),
    }));
  }
  return { ok: true, scanned: campaigns.length, results };
}

async function processClientBatch(
  campaign: CommunicationCampaignDispatchRecord,
  cursor: string | null,
) {
  const one = campaign.audience === "ONE_CLIENT";
  const clients = await db.user.findMany({
    where: one
      ? { id: campaign.targetUserId || "__missing__", role: "CLIENT" }
      : { role: "CLIENT" },
    select: { id: true, name: true },
    orderBy: { id: "asc" },
    take: COMMUNICATION_CAMPAIGN_BATCH_SIZE,
    ...(cursor && !one ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const expiresAt = campaign.expiresAt ?? defaultCommunicationExpiresAt();
  const now = new Date();
  const clientIds = clients.map((client) => client.id);
  const created = await db.$transaction(async (tx) => {
    const inserted = clients.length
      ? await tx.notification.createMany({
          data: clients.map((client) => ({
            userId: client.id,
            title: campaign.title,
            message: campaign.message,
            type: "PLATFORM_COMMUNICATION",
            recipientType: "CLIENT" as const,
            recipientName: client.name,
            channel: campaign.channel,
            status: "SENT" as const,
            priority: campaign.priority,
            clientId: client.id,
            campaignId: campaign.id,
            sentAt: now,
            expiresAt,
            link: campaign.link || "/client/notifications",
            actionLabel: campaign.actionLabel || "Voir l'information",
          })),
          skipDuplicates: true,
      })
      : { count: 0 };
    const notificationRows = clientIds.length
      ? await tx.notification.findMany({
          where: {
            campaignId: campaign.id,
            recipientType: "CLIENT",
            userId: { in: clientIds },
            deletedAt: null,
          },
          select: { id: true, userId: true, title: true, message: true, link: true, priority: true },
        })
      : [];
    if (notificationRows.length > 0) {
      await tx.webPushOutbox.createMany({
        data: notificationRows
          .filter((notification) => Boolean(notification.userId))
          .map((notification) => ({
            notificationId: notification.id,
            recipientType: "CLIENT" as const,
            targetUserId: notification.userId,
            title: notification.title,
            message: notification.message,
            link: notification.link,
            priority: notification.priority,
            status: "PENDING" as const,
            nextAttemptAt: now,
          })),
        skipDuplicates: true,
      });
    }
    await tx.communicationCampaign.update({
      where: { id: campaign.id },
      data: {
        deliveredCount: { increment: inserted.count },
        dispatchPhase: "CLIENTS",
        dispatchCursor: clients.at(-1)?.id ?? cursor,
        lastDispatchAt: new Date(),
      },
    });
    return inserted.count;
  });
  if (created > 0) {
    await publishWebPushFlushEvent("communication_campaign", {
      limit: COMMUNICATION_CAMPAIGN_BATCH_SIZE,
      idempotencyKey: `web-push-communication-${campaign.id}-clients-${cursor || "start"}`,
    });
  }

  const hasMore = !one && clients.length === COMMUNICATION_CAMPAIGN_BATCH_SIZE;
  return {
    processed: clients.length,
    created,
    hasMore,
    nextCursor: hasMore ? clients.at(-1)?.id ?? null : null,
  };
}

async function processTeacherBatch(
  campaign: CommunicationCampaignDispatchRecord,
  cursor: string | null,
) {
  const one = campaign.audience === "ONE_TEACHER";
  const teachers = await db.teacher.findMany({
    where: one
      ? { id: campaign.targetTeacherId || "__missing__" }
      : { status: { notIn: ["BLACKLISTED", "PERMANENTLY_SUSPENDED"] } },
    select: { id: true },
    orderBy: { id: "asc" },
    take: COMMUNICATION_CAMPAIGN_BATCH_SIZE,
    ...(cursor && !one ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const expiresAt = campaign.expiresAt ?? defaultCommunicationExpiresAt();
  const now = new Date();
  const teacherIds = teachers.map((teacher) => teacher.id);
  const created = await db.$transaction(async (tx) => {
    const inserted = teachers.length
      ? await tx.teacherNotification.createMany({
          data: teachers.map((teacher) => ({
            teacherId: teacher.id,
            campaignId: campaign.id,
            title: campaign.title,
            message: campaign.message,
            channel: campaign.channel,
            sent: true,
            status: "SENT" as const,
            expiresAt,
          })),
          skipDuplicates: true,
      })
      : { count: 0 };
    const notificationRows = teacherIds.length
      ? await tx.teacherNotification.findMany({
          where: {
            campaignId: campaign.id,
            teacherId: { in: teacherIds },
            deletedAt: null,
          },
          select: { id: true, teacherId: true, title: true, message: true },
        })
      : [];
    if (notificationRows.length > 0) {
      await tx.webPushOutbox.createMany({
        data: notificationRows.map((notification) => ({
          teacherNotificationId: notification.id,
          recipientType: "TEACHER" as const,
          targetTeacherId: notification.teacherId,
          title: notification.title,
          message: notification.message,
          link: "/professeur/notifications",
          priority: campaign.priority,
          status: "PENDING" as const,
          nextAttemptAt: now,
        })),
        skipDuplicates: true,
      });
    }
    await tx.communicationCampaign.update({
      where: { id: campaign.id },
      data: {
        deliveredCount: { increment: inserted.count },
        dispatchPhase: "TEACHERS",
        dispatchCursor: teachers.at(-1)?.id ?? cursor,
        lastDispatchAt: new Date(),
      },
    });
    return inserted.count;
  });
  if (created > 0) {
    await publishWebPushFlushEvent("communication_campaign", {
      limit: COMMUNICATION_CAMPAIGN_BATCH_SIZE,
      idempotencyKey: `web-push-communication-${campaign.id}-teachers-${cursor || "start"}`,
    });
  }

  const hasMore = !one && teachers.length === COMMUNICATION_CAMPAIGN_BATCH_SIZE;
  return {
    processed: teachers.length,
    created,
    hasMore,
    nextCursor: hasMore ? teachers.at(-1)?.id ?? null : null,
  };
}

async function scheduleNextBatch(campaignId: string, phase: CommunicationCampaignDispatchPhase, cursor: string | null) {
  const queued = await publishCommunicationCampaignEvent(
    { campaignId, phase, cursor },
    { idempotencyKey: `communication-${campaignId}-${phase}-${cursor || "start"}` },
  );
  if (!queued.queued) {
    console.warn(JSON.stringify({
      level: "warn",
      scope: "communication-campaigns",
      message: "next_batch_queue_failed",
      campaignId,
      phase,
      cursor,
      error: queued.error,
    }));
  }
}

async function finalizeCampaign(campaignId: string, recipientCount: number) {
  const [clientCount, teacherCount] = await Promise.all([
    db.notification.count({ where: { campaignId, deletedAt: null } }),
    db.teacherNotification.count({ where: { campaignId, deletedAt: null } }),
  ]);
  const deliveredCount = clientCount + teacherCount;
  const failedCount = Math.max(0, recipientCount - deliveredCount);
  const status = deliveredCount === 0
    ? "FAILED"
    : failedCount > 0
      ? "PARTIAL"
      : "SENT";

  const campaign = await db.communicationCampaign.update({
    where: { id: campaignId },
    data: {
      status,
      deliveredCount,
      failedCount,
      sentAt: new Date(),
      dispatchPhase: null,
      dispatchCursor: null,
      lastDispatchAt: new Date(),
    },
  });

  return { ok: status !== "FAILED", campaignId, status, deliveredCount, failedCount, campaign };
}

function includesClients(audience: string) {
  return audience === "ONE_CLIENT" || audience === "ALL_CLIENTS" || audience === "ALL_USERS";
}

function includesTeachers(audience: string) {
  return audience === "ONE_TEACHER" || audience === "ALL_TEACHERS" || audience === "ALL_USERS";
}

function normalizePhase(value: string | null): CommunicationCampaignDispatchPhase {
  return value === "TEACHERS" ? "TEACHERS" : "CLIENTS";
}
