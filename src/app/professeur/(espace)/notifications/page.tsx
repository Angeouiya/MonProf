import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { notificationDeliveryStatusLabel } from "@/lib/platform-labels";
import { requireTeacher } from "@/lib/teacher-auth";
import { Badge } from "@/components/ui/badge";
import { EmptyProfessorState, PortalCard, ProfessorPageHeader } from "@/components/professor/professor-ui";
import { MarkTeacherNotificationsReadButton } from "@/components/professor/mark-teacher-notifications-read";

export const dynamic = "force-dynamic";

export default async function ProfesseurNotificationsPage() {
  const { teacher } = await requireTeacher();
  const notifications = await db.teacherNotification.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unreadCount = notifications.filter((notification) => ["DRAFT", "PENDING", "SENT", "FAILED"].includes(notification.status)).length;
  const priorityNotification = notifications.find((notification) => ["DRAFT", "PENDING", "SENT", "FAILED"].includes(notification.status))
    ?? notifications[0]
    ?? null;
  const historyNotifications = priorityNotification
    ? notifications.filter((notification) => notification.id !== priorityNotification.id)
    : notifications;

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title="Notifications"
        description="Missions, rappels, paiements et consignes."
        rootTab
        action={<MarkTeacherNotificationsReadButton disabled={unreadCount === 0} />}
      />

      <PortalCard data-professor-notification-priority>
        {notifications.length === 0 ? (
          <EmptyProfessorState title="Aucune notification" description="Les notifications du service client reçues apparaîtront ici." />
        ) : (
          priorityNotification && (
            <article className="rounded-xl border border-[#DDE6F7] bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                  <Bell className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black uppercase tracking-wide text-[#64748B]">
                      {unreadCount > 0 ? "À lire" : "Dernière info"}
                    </p>
                    {unreadCount > 0 && (
                      <Badge variant="outline" className="border-[#111B4D] bg-white text-[#111B4D]">
                        {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <h2 className="mt-1 text-lg font-semibold leading-snug text-[#111827]">
                    {priorityNotification.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm font-semibold leading-6 text-[#475569]">
                    {priorityNotification.message}
                  </p>
                </div>
              </div>

              <details className="group mt-3 rounded-lg border border-[#E6EAF3] bg-white" data-professor-notification-message-details>
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-[#111B4D] marker:hidden [&::-webkit-details-marker]:hidden">
                  Lire le message complet
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                </summary>
                <p className="whitespace-pre-line border-t border-[#EEF2F7] px-3 py-3 text-sm font-medium leading-6 text-[#111827]">
                  {priorityNotification.message}
                </p>
              </details>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#64748B]">
                <span className="inline-flex min-h-10 items-center">{formatDateTime(priorityNotification.createdAt)}</span>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">{priorityNotification.channel}</Badge>
                  <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">{notificationDeliveryStatusLabel(priorityNotification.status)}</Badge>
                  {priorityNotification.bookingId && (
                    <Link
                      href={`/professeur/missions/${priorityNotification.bookingId}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#D7DEE9] bg-white px-3 font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
                    >
                      Voir la mission
                    </Link>
                  )}
                </div>
              </div>
            </article>
          )
        )}
      </PortalCard>

      {historyNotifications.length > 0 && (
        <details data-professor-notification-history className="group overflow-hidden rounded-lg border border-[#E3E8F2] bg-white">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#111B4D] [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#111827]">Historique</span>
              <span className="mt-0.5 block text-xs font-semibold text-[#64748B]">
                {historyNotifications.length} ancienne{historyNotifications.length > 1 ? "s" : ""} notification{historyNotifications.length > 1 ? "s" : ""}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 text-[#111B4D]">
              <span className="text-xs font-semibold tabular-nums">{historyNotifications.length}</span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className="grid gap-3 border-t border-[#EEF2F7] p-3 min-[640px]:p-4">
            {historyNotifications.map((notification) => (
              <article key={notification.id} className="rounded-lg border border-[#E6EAF3] bg-white p-3">
                <div className="flex flex-col gap-2 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">{notification.channel}</Badge>
                      <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">{notificationDeliveryStatusLabel(notification.status)}</Badge>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold leading-5 text-[#111827]">{notification.title}</h3>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[#64748B]">{formatDateTime(notification.createdAt)}</span>
                </div>
                <details className="group mt-2 rounded-lg border border-[#E6EAF3] bg-white" data-professor-notification-message-details>
                  <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold text-[#111B4D] marker:hidden [&::-webkit-details-marker]:hidden">
                    Lire
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-[#EEF2F7] px-3 py-3">
                    <p className="whitespace-pre-line text-sm font-medium leading-6 text-[#111827]">{notification.message}</p>
                    {notification.bookingId && (
                      <Link
                        href={`/professeur/missions/${notification.bookingId}`}
                        className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg border border-[#D7DEE9] bg-white px-3 text-xs font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
                      >
                        Voir la mission liée
                      </Link>
                    )}
                  </div>
                </details>
              </article>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
