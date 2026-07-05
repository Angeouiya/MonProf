import Link from "next/link";
import { Bell } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title="Notifications"
        description="Messages opérationnels envoyés par l'administration : missions, rappels, paiements, avertissements ou consignes."
        action={<MarkTeacherNotificationsReadButton disabled={unreadCount === 0} />}
      />

      <PortalCard>
        {notifications.length === 0 ? (
          <EmptyProfessorState title="Aucune notification" description="Les notifications administratives reçues apparaîtront ici." />
        ) : (
          <div className="grid gap-3">
            {notifications.map((notification) => (
              <article key={notification.id} className="rounded-[1.15rem] border border-[#E6EAF3] bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                        <Bell className="h-4 w-4" />
                      </span>
                      <h2 className="text-base font-semibold text-[#111827]">{notification.title}</h2>
                    </div>
                    <p className="mt-3 whitespace-pre-line text-sm font-semibold leading-6 text-[#475569]">{notification.message}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">{notification.channel}</Badge>
                    <Badge variant="outline" className="border-[#D7DEE9] bg-white text-[#111B4D]">{notificationDeliveryStatusLabel(notification.status)}</Badge>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF2F7] pt-3 text-xs font-semibold text-[#64748B]">
                  <span className="inline-flex min-h-10 items-center">{formatDateTime(notification.createdAt)}</span>
                  {notification.bookingId && (
                    <Link
                      href={`/professeur/missions/${notification.bookingId}`}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#D7DEE9] bg-white px-3 font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
                    >
                      Voir la mission liée
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </PortalCard>
    </div>
  );
}
