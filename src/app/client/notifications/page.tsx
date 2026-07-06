import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { ClientAppRail, ClientMetricStrip, ClientPageHeader } from "@/components/shared/client-page-primitives";
import { ClientNotificationActions } from "./actions-client";
import { ClientNotificationCenter } from "./notification-center-client";
import { AlertTriangle, Bell, CalendarCheck, LifeBuoy, WalletCards, ShieldCheck } from "lucide-react";

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
    ["PAYMENT_PENDING", "PAYMENT_RECEIVED", "BLOCKED_FUNDS", "FUNDS_BLOCKED", "PAYMENT_TO_RELEASE", "REFUND"].includes(notification.type)
  )).length;
  const bookingCount = notifications.filter((notification) => (
    Boolean(notification.bookingId) || ["NEW_BOOKING", "BOOKING_CONFIRMED", "REMINDER", "COURSE_CONFIRMATION"].includes(notification.type)
  )).length;

  return (
    <div className="space-y-6">
      <ClientPageHeader
        eyebrow="Messages"
        title="Notifications"
        description={`${formatCount(notifications.length, "notification")}, ${formatCount(unreadCount, "non lue")}.`}
      >
        <ClientNotificationActions mode="all" />
      </ClientPageHeader>

      <ClientMetricStrip
        metrics={[
          { icon: Bell, label: "Non lues", value: unreadCount },
          { icon: AlertTriangle, label: "Urgentes", value: urgentCount, attention: urgentCount > 0 },
          { icon: WalletCards, label: "Paiements", value: paymentCount },
          { icon: ShieldCheck, label: "Suivi", value: formatCount(bookingCount, "dossier") },
        ]}
      />

      <ClientAppRail
        items={[
          { href: "/client/notifications", icon: Bell, label: "Centre", value: "Tous les messages", active: true },
          { href: "/client/reservations", icon: CalendarCheck, label: "Dossiers", value: formatCount(bookingCount, "suivi") },
          { href: "/client/paiements", icon: WalletCards, label: "Paiements", value: formatCount(paymentCount, "alerte") },
          { href: "/client/support", icon: LifeBuoy, label: "Service client", value: "Aide et litige" },
        ]}
      />

      <ClientNotificationCenter notifications={serializedNotifications} bookings={serializedBookings} />
    </div>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
