import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronDown, MapPin, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatFCFA } from "@/lib/format";
import { requireTeacher } from "@/lib/teacher-auth";
import { courseFormatLabel } from "@/lib/platform-labels";
import { rescheduleWindowLabel } from "@/lib/reschedule-policy";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { getTeacherMissionTiming } from "@/lib/teacher-mission-policy";
import { Button } from "@/components/ui/button";
import { MissionResponseActions } from "@/components/professor/mission-response-actions";
import { ProfessorRescheduleRequestActions } from "@/components/professor/reschedule-request-actions";
import {
  EmptyProfessorState,
  PortalCard,
  ProfessorPageHeader,
  StatusPill,
} from "@/components/professor/professor-ui";

export const dynamic = "force-dynamic";

export default async function ProfesseurMissionsPage() {
  const { teacher } = await requireTeacher();
  const bookings = await db.booking.findMany({
    where: verifiedPayDunyaBookingWhere({
      OR: [
        { teacherId: teacher.id },
        { sessions: { some: { teacherId: teacher.id } } },
      ],
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    }),
    include: {
      client: { select: { name: true, phone: true } },
      transactions: { where: { type: "CLIENT_PAYMENT" } },
      missionLinks: { where: { teacherId: teacher.id }, orderBy: { createdAt: "desc" }, take: 1 },
      rescheduleRequests: { where: { teacherId: teacher.id }, orderBy: { createdAt: "desc" }, take: 3 },
      teacherTasks: {
        where: {
          teacherId: teacher.id,
          status: { in: ["TODO", "SENT_TO_TEACHER", "SEEN_BY_TEACHER", "IN_PROGRESS", "LATE"] },
        },
        take: 3,
      },
    },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    take: 80,
  });
  const verifiedBookings = bookings.filter(hasVerifiedPayDunyaClientPayment);
  const missionSortNow = new Date();
  const orderedBookings = verifiedBookings.toSorted((left, right) => {
    const leftAction = missionNeedsAttention(left, missionSortNow);
    const rightAction = missionNeedsAttention(right, missionSortNow);
    if (leftAction !== rightAction) return leftAction ? -1 : 1;

    const leftDate = left.scheduledDate ?? left.startDate ?? left.createdAt;
    const rightDate = right.scheduledDate ?? right.startDate ?? right.createdAt;
    const leftUpcoming = leftDate >= missionSortNow;
    const rightUpcoming = rightDate >= missionSortNow;
    if (leftUpcoming !== rightUpcoming) return leftUpcoming ? -1 : 1;
    return leftUpcoming
      ? leftDate.getTime() - rightDate.getTime()
      : rightDate.getTime() - leftDate.getTime();
  });

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title="Mes missions"
        description="Confirmez vos cours, consultez les détails et suivez les changements."
        rootTab
      />

      {verifiedBookings.length === 0 ? (
        <EmptyProfessorState
          title="Aucune mission pour le moment"
          description="Dès qu'un paiement est confirmé par Jèko et qu'une commande vous est attribuée, elle apparaît ici avec les détails nécessaires."
        />
      ) : (
        <div className="grid gap-4">
          {orderedBookings.map((booking) => {
            const mission = booking.missionLinks[0];
            const pendingReschedule = booking.rescheduleRequests.find((request) => request.status === "AWAITING_TEACHER");
            const missionTiming = getTeacherMissionTiming(booking);
            const canRespond = Boolean(
              mission
              && ["PENDING_CONFIRMATION", "RELAUNCHED"].includes(mission.status)
              && mission.expiresAt >= new Date(),
            );
            const missionDate = booking.scheduledDate ?? booking.startDate ?? booking.createdAt;
            const missionTime = booking.scheduledTime || booking.preferredTime || "Heure à confirmer";
            const missionNet = booking.teacherNetAmount || booking.totalTeacherReceives;
            const decisionLabel = pendingReschedule ? "Nouveau créneau" : canRespond ? "Répondre" : "Suivi";
            const placeLabel = booking.courseFormat === "ONLINE"
              ? "En ligne"
              : booking.commune || "Adresse à confirmer";

            return (
              <PortalCard key={booking.id} data-professor-mission-card>
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2" data-professor-mission-decision>
                      <span className={pendingReschedule || canRespond ? "inline-flex min-h-9 items-center rounded-full bg-[#111B4D] px-3 text-sm font-semibold text-white" : "inline-flex min-h-9 items-center rounded-full border border-[#DDE6F7] bg-white px-3 text-sm font-semibold text-[#111B4D]"}>
                        {decisionLabel}
                      </span>
                      <span className="rounded-full bg-[#F6F8FC] px-3 py-1.5 text-xs font-bold text-[#64748B]">{booking.reference}</span>
                    </div>
                    <p className="mt-3 text-lg font-semibold leading-tight text-[#111827]">{booking.subjectName}</p>
                    <p className="mt-1 text-sm font-semibold text-[#64748B]">{booking.levelName}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 min-[720px]:grid-cols-4" data-professor-mission-snapshot>
                      <MissionInfo icon={<CalendarDays className="h-4 w-4" />} label="Quand" value={`${formatDate(missionDate)} · ${missionTime}`} />
                      <MissionInfo label="Format" value={courseFormatLabel(booking.courseFormat)} />
                      <MissionInfo icon={<MapPin className="h-4 w-4" />} label="Lieu" value={placeLabel} />
                      <MissionInfo label="Net" value={formatFCFA(missionNet)} />
                    </div>

                    <details className="group mt-3 overflow-hidden rounded-lg border border-[#E6EAF3] bg-white" data-professor-mission-secondary>
                      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-[#111B4D] marker:hidden">
                        Infos mission
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="space-y-3 border-t border-[#E6EAF3] p-3">
                        <div className="flex flex-wrap gap-2">
                          <StatusPill status={booking.status} />
                          {mission && <StatusPill status={mission.status} type="mission" />}
                          {pendingReschedule && <StatusPill status={pendingReschedule.status} />}
                        </div>
                        <p className="text-sm font-semibold leading-6 text-[#64748B]">
                          {booking.objective || booking.needDescription || "Besoin client transmis par le service client."}
                        </p>
                        <div className="grid gap-2 min-[680px]:grid-cols-2">
                          <MissionInfo icon={<Phone className="h-4 w-4" />} label="Client" value={`${booking.client.name}${booking.client.phone ? ` · ${booking.client.phone}` : ""}`} />
                          <MissionInfo icon={<MapPin className="h-4 w-4" />} label="Lieu" value={booking.courseFormat === "ONLINE" ? "En ligne" : [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(" · ") || "Adresse à confirmer"} />
                        </div>
                        {booking.teacherTasks.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {booking.teacherTasks.map((task) => (
                              <StatusPill key={task.id} status={task.status} type="task" />
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  </div>

                  <div className="rounded-lg border border-[#E6EAF3] bg-white p-3">
                    {pendingReschedule ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-[#D7DEE9] bg-white p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">Nouveau créneau demandé</p>
                          <p className="mt-1 text-sm font-semibold text-[#111827]">
                            {formatDate(pendingReschedule.proposedDate)} · {pendingReschedule.proposedTime}
                          </p>
                          <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
                            {rescheduleWindowLabel(pendingReschedule.feeWindow)} · part professeur {formatFCFA(pendingReschedule.feeTeacherAmount)}
                          </p>
                        </div>
                        <ProfessorRescheduleRequestActions requestId={pendingReschedule.id} />
                      </div>
                    ) : canRespond && mission ? (
                      <MissionResponseActions token={mission.token} compact within24Hours={missionTiming.within24Hours} courseStarted={missionTiming.courseStarted} />
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold leading-6 text-[#64748B]">
                          {mission ? "Mission suivie." : "Aucune confirmation ouverte."}
                        </p>
                        <Button asChild className="w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                          <Link href={`/professeur/missions/${booking.id}`}>
                            Détail
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    )}
                    {canRespond && (
                      <Button asChild variant="ghost" className="mt-2 w-full rounded-lg bg-white text-[#111B4D]">
                        <Link href={`/professeur/missions/${booking.id}`}>
                          Détail
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </PortalCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function missionNeedsAttention(booking: {
  missionLinks: Array<{ status: string; expiresAt: Date }>;
  rescheduleRequests: Array<{ status: string }>;
}, now: Date) {
  const mission = booking.missionLinks[0];
  return booking.rescheduleRequests.some((request) => request.status === "AWAITING_TEACHER")
    || Boolean(
      mission
      && ["PENDING_CONFIRMATION", "RELAUNCHED"].includes(mission.status)
      && mission.expiresAt >= now,
    );
}

function MissionInfo({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#111827]">{value || "—"}</p>
    </div>
  );
}
