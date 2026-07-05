import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatFCFA } from "@/lib/format";
import { requireTeacher } from "@/lib/teacher-auth";
import { courseFormatLabel } from "@/lib/platform-labels";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { Button } from "@/components/ui/button";
import { MissionResponseActions } from "@/components/professor/mission-response-actions";
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
      teacherId: teacher.id,
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    }),
    include: {
      client: { select: { name: true, phone: true } },
      transactions: { where: { type: "CLIENT_PAYMENT" } },
      missionLinks: { orderBy: { createdAt: "desc" }, take: 1 },
      teacherTasks: {
        where: { status: { in: ["TODO", "SENT_TO_TEACHER", "SEEN_BY_TEACHER", "IN_PROGRESS", "LATE"] } },
        take: 3,
      },
    },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "desc" }],
    take: 80,
  });
  const verifiedBookings = bookings.filter(hasVerifiedPayDunyaClientPayment);

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title="Mes missions"
        description="Toutes les réservations attribuées à votre fiche professeur. Les confirmations sont historisées côté service client."
      />

      {verifiedBookings.length === 0 ? (
        <EmptyProfessorState
          title="Aucune mission pour le moment"
          description="Quand le service client vous attribue une réservation, elle apparaît ici avec les détails nécessaires."
        />
      ) : (
        <div className="grid gap-4">
          {verifiedBookings.map((booking) => {
            const mission = booking.missionLinks[0];
            const canRespond = Boolean(
              mission
              && ["PENDING_CONFIRMATION", "RELAUNCHED"].includes(mission.status)
              && mission.expiresAt >= new Date(),
            );

            return (
              <PortalCard key={booking.id}>
                <div className="grid gap-4 xl:grid-cols-[1fr_360px] xl:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-[#111827]">{booking.reference}</p>
                      <StatusPill status={booking.status} />
                      {mission && <StatusPill status={mission.status} type="mission" />}
                    </div>
                    <p className="mt-2 text-base font-semibold text-[#111827]">{booking.subjectName} - {booking.levelName}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">{booking.objective || booking.needDescription || "Besoin client transmis par le service client."}</p>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <MissionInfo icon={<CalendarDays className="h-4 w-4" />} label="Date" value={formatDate(booking.scheduledDate ?? booking.startDate ?? booking.createdAt)} />
                      <MissionInfo label="Heure" value={booking.scheduledTime || booking.preferredTime} />
                      <MissionInfo label="Format" value={courseFormatLabel(booking.courseFormat)} />
                      <MissionInfo label="Net prévu" value={formatFCFA(booking.teacherNetAmount || booking.totalTeacherReceives)} />
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <MissionInfo icon={<Phone className="h-4 w-4" />} label="Client" value={`${booking.client.name}${booking.client.phone ? ` · ${booking.client.phone}` : ""}`} />
                      <MissionInfo icon={<MapPin className="h-4 w-4" />} label="Lieu" value={booking.courseFormat === "ONLINE" ? "En ligne" : [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(" · ") || "Adresse à confirmer"} />
                    </div>

                    {booking.teacherTasks.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {booking.teacherTasks.map((task) => (
                          <StatusPill key={task.id} status={task.status} type="task" />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-[#E6EAF3] bg-white p-3">
                    {canRespond && mission ? (
                      <MissionResponseActions token={mission.token} compact />
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-semibold leading-6 text-[#64748B]">
                          {mission ? "Aucune action immédiate demandée sur cette mission." : "Aucun lien de confirmation actif pour cette réservation."}
                        </p>
                        <Button asChild className="w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                          <Link href={`/professeur/missions/${booking.id}`}>
                            Ouvrir le détail
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    )}
                    {canRespond && (
                      <Button asChild variant="ghost" className="mt-2 w-full rounded-lg bg-white text-[#111B4D]">
                        <Link href={`/professeur/missions/${booking.id}`}>
                          Détail complet
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
