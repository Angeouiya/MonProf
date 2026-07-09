import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  CLIENT_COMMAND_CENTERS_ENABLED,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientProcessTracker,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { Button } from "@/components/ui/button";
import { ClientNotificationActions } from "./actions-client";
import { ClientNotificationCenter } from "./notification-center-client";
import { formatDateTime, timeAgo } from "@/lib/format";
import { notificationChannelLabel, notificationTypeLabel, priorityLabel } from "@/lib/platform-labels";
import { AlertTriangle, ArrowRight, Bell, CalendarCheck, CheckCircle2, Clock3, LifeBuoy, WalletCards, ShieldCheck } from "lucide-react";

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
  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));
  const priorityNotification =
    notifications.find((notification) => !notification.read && ["CRITICAL", "URGENT"].includes(notification.priority)) ??
    notifications.find((notification) => !notification.read && ["PAYMENT_PENDING", "REFUND", "DISPUTE", "DISPUTE_OPENED"].includes(notification.type)) ??
    notifications.find((notification) => !notification.read) ??
    notifications[0] ??
    null;
  const priorityBooking = priorityNotification?.bookingId ? bookingsById.get(priorityNotification.bookingId) ?? null : null;

  return (
    <div className="space-y-6">
      <ClientPageHeader
        eyebrow="Messages"
        title="Notifications"
        description={`${formatCount(notifications.length, "notification")}, ${formatCount(unreadCount, "non lue")}.`}
        showBack={false}
      >
        <ClientNotificationActions mode="all" />
      </ClientPageHeader>

      <NotificationMobilePriorityCard
        notification={priorityNotification}
        booking={priorityBooking}
        unreadCount={unreadCount}
        urgentCount={urgentCount}
        paymentCount={paymentCount}
        bookingCount={bookingCount}
      />

      <ClientMetricStrip
        className="max-md:hidden"
        metrics={[
          { icon: Bell, label: "Non lues", value: unreadCount },
          { icon: AlertTriangle, label: "Urgentes", value: urgentCount, attention: urgentCount > 0 },
          { icon: WalletCards, label: "Paiements", value: paymentCount },
          { icon: ShieldCheck, label: "Suivi", value: formatCount(bookingCount, "dossier") },
        ]}
      />

      {CLIENT_COMMAND_CENTERS_ENABLED && (
      <div className="max-md:hidden">
        <NotificationCommandCenter
          notification={priorityNotification}
          booking={priorityBooking}
          totalCount={notifications.length}
          unreadCount={unreadCount}
          urgentCount={urgentCount}
          paymentCount={paymentCount}
        />
      </div>
      )}

      <ClientNotificationCenter notifications={serializedNotifications} bookings={serializedBookings} />
    </div>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

type NotificationCommandCenterProps = {
  notification: {
    id: string;
    title: string;
    message: string;
    type: string;
    channel: string;
    status: string;
    priority: string;
    read: boolean;
    link: string | null;
    actionLabel: string | null;
    bookingId: string | null;
    createdAt: Date;
  } | null;
  booking: {
    id: string;
    reference: string;
    subjectName: string;
    levelName: string;
    scheduledDate: Date | null;
    startDate: Date | null;
    scheduledTime: string | null;
    preferredTime: string | null;
    teacher: {
      fullName: string;
      professionalName: string | null;
    };
  } | null;
  totalCount: number;
  unreadCount: number;
  urgentCount: number;
  paymentCount: number;
};

function NotificationMobilePriorityCard({
  notification,
  booking,
  unreadCount,
  urgentCount,
  paymentCount,
  bookingCount,
}: {
  notification: NotificationCommandCenterProps["notification"];
  booking: NotificationCommandCenterProps["booking"];
  unreadCount: number;
  urgentCount: number;
  paymentCount: number;
  bookingCount: number;
}) {
  const hasUrgent = urgentCount > 0;
  const hasUnread = unreadCount > 0;
  const teacherName = booking?.teacher.professionalName || booking?.teacher.fullName || null;
  const href = getClientNotificationHref(notification, booking?.id);
  const actionLabel = notification
    ? notification.actionLabel || (booking ? "Ouvrir" : "Lire")
    : "Réserver";
  const title = booking?.reference || notification?.title || "Aucune notification active";
  const hint = booking
    ? `${teacherName || "Professeur Compétence"} · ${booking.subjectName} · ${booking.levelName}`
    : notification?.message || "Vos confirmations, paiements et messages importants apparaîtront ici.";

  return (
    <ClientSurface compact className="space-y-3 rounded-lg border border-[#D8DEE9] p-3 md:hidden" data-client-notification-mobile-priority>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          {hasUrgent ? <AlertTriangle className="h-4 w-4" /> : hasUnread ? <Bell className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#111B4D]">Priorité notifications</p>
          <h2 className="mt-0.5 break-words text-base font-semibold leading-5 text-[#111827]">{title}</h2>
          <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[#52627A]">{hint}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <ClientInfoPill label="Non lues" value={unreadCount} strong={unreadCount > 0} />
        <ClientInfoPill label="Urgentes" value={urgentCount} strong={urgentCount > 0} />
        <ClientInfoPill label="Paiements" value={paymentCount} strong={paymentCount > 0} />
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#D8DEE9] bg-white px-3 py-2.5">
        <p className="min-w-0 text-xs font-semibold leading-5 text-[#52627A]">
          {bookingCount > 0 ? formatCount(bookingCount, "dossier") : notification ? priorityLabel(notification.priority) : "Centre à jour"}
        </p>
        <Button asChild size="sm" className="min-h-10 shrink-0 rounded-lg bg-[#111B4D] px-3 text-white hover:bg-[#1E2A78]">
          <Link href={href}>
            {actionLabel}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </ClientSurface>
  );
}

function NotificationCommandCenter({
  notification,
  booking,
  totalCount,
  unreadCount,
  urgentCount,
  paymentCount,
}: NotificationCommandCenterProps) {
  const hasPriority = Boolean(notification);
  const hasUrgent = urgentCount > 0;
  const hasUnread = unreadCount > 0;
  const teacherName = booking?.teacher.professionalName || booking?.teacher.fullName || null;
  const href = getClientNotificationHref(notification, booking?.id);
  const actionLabel = notification
    ? notification.actionLabel || (booking ? "Ouvrir le dossier" : "Traiter maintenant")
    : "Trouver un professeur";
  const notificationType = notification ? notificationTypeLabel(notification.type) : "Aucun message actif";
  const channel = notification ? notificationChannelLabel(notification.channel) : "Dashboard";
  const priority = notification ? priorityLabel(notification.priority) : "Stable";
  const lastActivity = notification ? `${formatDateTime(notification.createdAt)} · ${timeAgo(notification.createdAt)}` : "Aucune action en attente";
  const bookingDate = booking?.scheduledDate
    ? formatDateTime(booking.scheduledDate)
    : booking?.startDate
      ? `${formatDateTime(booking.startDate)} souhaitée`
      : null;

  return (
    <ClientSurface compact className="overflow-hidden rounded-lg border border-[#DDE3EE] p-0" data-client-notification-command-center>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="min-w-0 space-y-4 p-4 min-[640px]:p-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              {hasUrgent ? <AlertTriangle className="h-5 w-5" /> : hasUnread ? <Bell className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">Centre de priorité</p>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-[#111827]">
                {hasUrgent
                  ? "Une alerte demande votre attention."
                  : hasUnread
                    ? "Des messages récents sont à lire."
                    : "Votre centre de notifications est à jour."}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
                {notification
                  ? "Les confirmations, paiements, remboursements et changements de cours restent reliés à chaque dossier pour éviter toute confusion."
                  : "Les prochains messages liés à vos cours, paiements ou échanges avec le service client apparaîtront ici."}
              </p>
            </div>
          </div>

          <div className="grid gap-2 min-[520px]:grid-cols-2 xl:grid-cols-4">
            <ClientInfoPill label="Non lues" value={unreadCount} strong={unreadCount > 0} />
            <ClientInfoPill label="Urgence" value={hasUrgent ? `${urgentCount} à traiter` : "Aucune"} strong={hasUrgent} />
            <ClientInfoPill label="Paiements" value={formatCount(paymentCount, "alerte")} strong={paymentCount > 0} />
            <ClientInfoPill label="Dernier signal" value={notificationType} strong={hasPriority} />
          </div>

          <ClientProcessTracker
            steps={[
              {
                label: "Message reçu",
                hint: `${totalCount} notification(s) dans votre centre.`,
                state: totalCount > 0 ? "done" : "current",
              },
              {
                label: "Lecture client",
                hint: hasUnread ? `${unreadCount} message(s) à lire.` : "Tout est lu.",
                state: hasUnread ? "current" : totalCount > 0 ? "done" : "pending",
              },
              {
                label: booking ? "Dossier à ouvrir" : "Suivi centralisé",
                hint: booking ? `${booking.reference} · ${booking.subjectName}` : "Service client, paiement ou réservation.",
                state: notification ? "current" : "pending",
              },
            ]}
          />
        </div>

        <aside className="border-t border-[#DDE3EE] bg-white p-4 min-[640px]:p-5 lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                  <Clock3 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#111827]">À faire maintenant</p>
                  <p className="text-xs font-medium leading-5 text-[#64748B]">{lastActivity}</p>
                </div>
              </div>

              <div className="rounded-lg border border-[#D8DEE9] bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                  {booking ? "Dossier lié" : "Message prioritaire"}
                </p>
                <p className="mt-1 text-base font-semibold leading-6 text-[#111827]">
                  {booking ? booking.reference : notification?.title || "Aucun message à traiter"}
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                  {booking
                    ? `${teacherName || "Professeur Compétence"} · ${booking.subjectName} · ${booking.levelName}${bookingDate ? ` · ${bookingDate}` : ""}${booking.scheduledTime || booking.preferredTime ? ` · ${booking.scheduledTime || booking.preferredTime}` : ""}`
                    : notification?.message || "Continuez tranquillement : aucun point urgent n'est visible."}
                </p>
              </div>

              <div className="grid gap-2 min-[420px]:grid-cols-2 lg:grid-cols-1">
                <ClientInfoPill label="Priorité" value={priority} strong={hasUrgent} />
                <ClientInfoPill label="Canal" value={channel} />
              </div>
            </div>

            <Button asChild className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
              <Link href={href}>
                {actionLabel}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </aside>
      </div>
    </ClientSurface>
  );
}

function getClientNotificationHref(notification: NotificationCommandCenterProps["notification"], bookingId?: string) {
  if (notification?.link?.startsWith("/client/")) return notification.link;
  if (bookingId) return `/client/reservations/${bookingId}`;
  if (notification?.type === "PAYMENT_PENDING") return "/client/paiements";
  if (notification?.type === "REFUND") return "/client/paiements";
  if (notification?.type === "DISPUTE" || notification?.type === "DISPUTE_OPENED") return "/client/service-client";
  if (notification) return "/client/notifications";
  return "/client/rechercher";
}
