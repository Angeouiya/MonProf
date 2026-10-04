import Link from "next/link";
import { Prisma } from "@prisma/client";
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
const MISSION_PAGE_SIZE = 20;

export default async function ProfesseurMissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const { teacher } = await requireTeacher();
  const sp = await searchParams;
  const view = sp.view === "attention" ? "attention" : "all";
  const requestedPage = Number(sp.page ?? 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.min(10_000, Math.trunc(requestedPage))) : 1;
  const now = new Date();
  const teacherScope: Prisma.BookingWhereInput = {
    OR: [
      { teacherId: teacher.id },
      { sessions: { some: { teacherId: teacher.id } } },
    ],
    status: { notIn: ["CANCELLED", "REFUNDED"] },
  };
  const activeMissionScope: Prisma.TeacherMissionLinkWhereInput = {
    teacherId: teacher.id,
    status: { in: ["PENDING_CONFIRMATION", "RELAUNCHED"] },
    expiresAt: { gte: now },
  };
  const activeRescheduleScope: Prisma.BookingRescheduleRequestWhereInput = { teacherId: teacher.id, status: "AWAITING_TEACHER" };
  const actionScope: Prisma.BookingWhereInput = {
    OR: [
      { missionLinks: { some: activeMissionScope } },
      { rescheduleRequests: { some: activeRescheduleScope } },
    ],
  };
  const where = verifiedPayDunyaBookingWhere(view === "attention"
    ? { AND: [teacherScope, actionScope] }
    : teacherScope);
  const rows = await db.booking.findMany({
    where,
    select: {
      id: true,
      reference: true,
      subjectName: true,
      levelName: true,
      objective: true,
      needDescription: true,
      courseFormat: true,
      commune: true,
      quartier: true,
      addressHint: true,
      scheduledDate: true,
      scheduledTime: true,
      startDate: true,
      preferredTime: true,
      createdAt: true,
      status: true,
      teacherNetAmount: true,
      totalTeacherReceives: true,
      paymentStatus: true,
      paymentProvider: true,
      providerPaymentStatus: true,
      paymentVerifiedAt: true,
      paydunyaStatus: true,
      paydunyaVerifiedAt: true,
      totalClientPays: true,
      totalPrice: true,
      client: { select: { name: true, phone: true } },
      transactions: { where: { type: "CLIENT_PAYMENT" }, select: { type: true, status: true, amount: true } },
      missionLinks: { where: activeMissionScope, orderBy: { createdAt: "desc" }, take: 1, select: { token: true, status: true, expiresAt: true } },
      rescheduleRequests: { where: activeRescheduleScope, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, proposedDate: true, proposedTime: true, feeWindow: true, feeTeacherAmount: true } },
      teacherTasks: {
        where: {
          teacherId: teacher.id,
          status: { in: ["TODO", "SENT_TO_TEACHER", "SEEN_BY_TEACHER", "IN_PROGRESS", "LATE"] },
        },
        take: 3,
        select: { id: true, status: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * MISSION_PAGE_SIZE,
    take: MISSION_PAGE_SIZE + 1,
  });
  const hasNext = rows.length > MISSION_PAGE_SIZE;
  const verifiedBookings = rows.slice(0, MISSION_PAGE_SIZE).filter(hasVerifiedPayDunyaClientPayment);
  const pageHref = (nextPage: number) => `/professeur/missions${view === "attention" ? "?view=attention" : ""}${nextPage > 1 ? `${view === "attention" ? "&" : "?"}page=${nextPage}` : ""}`;

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title="Mes missions"
        description="Confirmez vos cours, consultez les détails et suivez les changements."
        rootTab
      />
      <nav aria-label="Vues des missions" className="grid grid-cols-2 gap-2 rounded-lg border border-[#DDE6F7] bg-white p-1.5 text-sm font-semibold">
        <Link prefetch={false} href="/professeur/missions" aria-current={view === "all" ? "page" : undefined} className={view === "all" ? "rounded-lg bg-[#111B4D] px-3 py-2.5 text-center text-white" : "rounded-lg px-3 py-2.5 text-center text-[#111B4D]"}>Toutes</Link>
        <Link prefetch={false} href="/professeur/missions?view=attention" aria-current={view === "attention" ? "page" : undefined} className={view === "attention" ? "rounded-lg bg-[#111B4D] px-3 py-2.5 text-center text-white" : "rounded-lg px-3 py-2.5 text-center text-[#111B4D]"}>À traiter</Link>
      </nav>

      {verifiedBookings.length === 0 ? (
        <EmptyProfessorState
          title={view === "attention" ? "Rien à traiter" : "Aucune mission sur cette page"}
          description={view === "attention" ? "Les nouvelles confirmations et demandes de changement apparaîtront ici." : "Dès qu'un paiement est confirmé par Jèko et qu'une commande vous est attribuée, elle apparaît ici."}
        />
      ) : (
        <div className="grid gap-4">
          {verifiedBookings.map((booking) => {
            const mission = booking.missionLinks[0];
            const pendingReschedule = booking.rescheduleRequests.find((request) => request.status === "AWAITING_TEACHER");
            const missionTiming = getTeacherMissionTiming(booking);
            const canRespond = Boolean(
              mission
              && ["PENDING_CONFIRMATION", "RELAUNCHED"].includes(mission.status)
              && mission.expiresAt >= now,
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
                          <Link prefetch={false} href={`/professeur/missions/${booking.id}`}>
                            Détail
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    )}
                    {canRespond && (
                      <Button asChild variant="ghost" className="mt-2 w-full rounded-lg bg-white text-[#111B4D]">
                        <Link prefetch={false} href={`/professeur/missions/${booking.id}`}>
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
      {(page > 1 || hasNext) && (
        <nav aria-label="Pages des missions" className="flex items-center justify-between gap-3 text-sm font-semibold">
          {page > 1 ? <Link prefetch={false} href={pageHref(page - 1)} className="rounded-lg border border-[#DDE6F7] bg-white px-4 py-3 text-[#111B4D]">Précédent</Link> : <span />}
          <span className="text-[#64748B]">Page {page}</span>
          {hasNext ? <Link prefetch={false} href={pageHref(page + 1)} className="rounded-lg border border-[#DDE6F7] bg-white px-4 py-3 text-[#111B4D]">Suivant</Link> : <span />}
        </nav>
      )}
    </div>
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
