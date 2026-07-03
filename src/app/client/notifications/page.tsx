import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { ClientNotificationActions } from "./actions-client";
import { ClientNotificationCenter } from "./notification-center-client";
import { AlertTriangle, Bell, WalletCards, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ClientNotificationsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const notifications = await db.notification.findMany({
    where: {
      recipientType: "CLIENT",
      OR: [{ userId: user.id }, { clientId: user.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const bookingIds = Array.from(new Set(notifications.map((notification) => notification.bookingId).filter((id): id is string => Boolean(id))));
  const bookings = bookingIds.length
    ? await db.booking.findMany({
        where: { id: { in: bookingIds }, clientId: user.id },
        select: {
          id: true,
          reference: true,
          subjectName: true,
          levelName: true,
          startDate: true,
          scheduledDate: true,
          scheduledTime: true,
          preferredTime: true,
          paymentStatus: true,
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
        },
      })
    : [];
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const serializedNotifications = notifications.map((notification) => ({
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    channel: notification.channel,
    status: notification.status,
    priority: notification.priority,
    read: notification.read,
    link: notification.link,
    actionLabel: notification.actionLabel,
    bookingId: notification.bookingId,
    createdAt: notification.createdAt.toISOString(),
    sentAt: notification.sentAt?.toISOString() ?? null,
    readAt: notification.readAt?.toISOString() ?? null,
    confirmedAt: notification.confirmedAt?.toISOString() ?? null,
  }));
  const serializedBookings = bookings.map((booking) => ({
    ...booking,
    startDate: booking.startDate?.toISOString() ?? null,
    scheduledDate: booking.scheduledDate?.toISOString() ?? null,
  }));
  const urgentCount = notifications.filter((notification) => ["URGENT", "CRITICAL"].includes(notification.priority) && !notification.read).length;
  const paymentCount = notifications.filter((notification) => (
    ["PAYMENT_RECEIVED", "BLOCKED_FUNDS", "FUNDS_BLOCKED", "PAYMENT_TO_RELEASE", "REFUND"].includes(notification.type)
  )).length;
  const teacherCount = notifications.filter((notification) => (
    ["TEACHER_ASSIGNED", "TEACHER_REPLACED", "REPLACEMENT"].includes(notification.type)
  )).length;
  const bookingCount = notifications.filter((notification) => (
    Boolean(notification.bookingId) || ["NEW_BOOKING", "BOOKING_CONFIRMED", "REMINDER", "COURSE_CONFIRMATION"].includes(notification.type)
  )).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${formatCount(notifications.length, "notification")}, ${formatCount(unreadCount, "non lue")}.`}
      >
        <ClientNotificationActions mode="all" />
      </PageHeader>

      <section className="rounded-[1.35rem] border border-[#E3E8F2] bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-2 min-[520px]:grid-cols-2 lg:grid-cols-5">
          <NotificationMetric icon={Bell} label="Non lues" value={unreadCount} />
          <NotificationMetric icon={AlertTriangle} label="Urgentes" value={urgentCount} attention={urgentCount > 0} />
          <NotificationMetric icon={WalletCards} label="Paiements" value={paymentCount} />
          <NotificationMetric icon={UserRound} label="Professeurs" value={teacherCount} />
          <div className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 lg:col-span-1">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Suivi</p>
              <p className="mt-0.5 truncate text-sm font-black text-[#111827]">{bookingCount} dossier(s)</p>
            </div>
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#111B4D]" />
          </div>
        </div>
      </section>

      <ClientNotificationCenter notifications={serializedNotifications} bookings={serializedBookings} />
    </div>
  );
}

function NotificationMetric({
  icon: Icon,
  label,
  value,
  attention = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
        <p className={attention ? "mt-0.5 text-lg font-black leading-5 text-[#111B4D]" : "mt-0.5 text-lg font-black leading-5 text-[#111827]"}>{value}</p>
      </div>
      <Icon className="h-4 w-4 shrink-0 text-[#111B4D]" />
    </div>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
