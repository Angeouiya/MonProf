import { Prisma, type NotificationChannel, type NotificationPriority, type NotificationRecipientType } from "@prisma/client";
import { db } from "@/lib/db";
import { publishWebPushFlushEvent } from "@/lib/web-push-queue";

type NotificationEventClient = Prisma.TransactionClient | typeof db;

export type EnqueueNotificationEventInput = {
  title: string;
  message: string;
  type: string;
  recipientType: NotificationRecipientType;
  recipientName?: string | null;
  channel?: NotificationChannel;
  priority?: NotificationPriority;
  link?: string | null;
  actionLabel?: string | null;
  actionType?: string | null;
  userId?: string | null;
  clientId?: string | null;
  teacherId?: string | null;
  bookingId?: string | null;
  adminId?: string | null;
  campaignId?: string | null;
};

export async function enqueueNotificationEvent(
  event: EnqueueNotificationEventInput,
  client: NotificationEventClient = db,
) {
  const priority = event.priority ?? "NORMAL";
  const channel = event.channel ?? "INTERNAL";
  const created = event.recipientType === "TEACHER" && event.teacherId
    ? await client.teacherNotification.create({
        data: {
          teacherId: event.teacherId,
          bookingId: event.bookingId || undefined,
          campaignId: event.campaignId || undefined,
          title: event.title,
          message: event.message,
          channel,
          sent: channel !== "INTERNAL",
          status: "SENT",
          sentById: event.adminId || undefined,
        },
      })
    : await client.notification.create({
        data: {
          userId: event.userId || undefined,
          title: event.title,
          message: event.message,
          type: event.type,
          recipientType: event.recipientType,
          recipientName: event.recipientName || undefined,
          channel,
          priority,
          link: event.link || undefined,
          actionLabel: event.actionLabel || undefined,
          actionType: event.actionType || undefined,
          bookingId: event.bookingId || undefined,
          teacherId: event.teacherId || undefined,
          clientId: event.clientId || undefined,
          adminId: event.adminId || undefined,
          campaignId: event.campaignId || undefined,
          status: "CREATED",
        },
      });

  if (client === db) {
    await publishWebPushFlushEvent("outbox_created");
  }

  return created;
}
