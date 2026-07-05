import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, CalendarDays, MapPin, Phone, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatFCFA } from "@/lib/format";
import { requireTeacher } from "@/lib/teacher-auth";
import { courseFormatLabel } from "@/lib/platform-labels";
import { hasVerifiedPayDunyaClientPayment, verifiedPayDunyaBookingWhere } from "@/lib/payment-security";
import { Button } from "@/components/ui/button";
import { MissionResponseActions } from "@/components/professor/mission-response-actions";
import {
  EmptyProfessorState,
  InfoLine,
  PortalCard,
  ProfessorPageHeader,
  StatusPill,
} from "@/components/professor/professor-ui";

export const dynamic = "force-dynamic";

export default async function ProfesseurMissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { teacher } = await requireTeacher();
  const { id } = await params;

  const booking = await db.booking.findFirst({
    where: verifiedPayDunyaBookingWhere({ id, teacherId: teacher.id }),
    include: {
      client: { select: { name: true, phone: true, email: true, commune: true, quartier: true } },
      transactions: { where: { type: "CLIENT_PAYMENT" } },
      missionLinks: { orderBy: { createdAt: "desc" }, take: 5 },
      scheduleProposals: { orderBy: { createdAt: "desc" }, take: 5 },
      teacherTasks: { orderBy: [{ priority: "desc" }, { createdAt: "desc" }] },
      teacherPaymentAdjustments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!booking) notFound();
  if (!hasVerifiedPayDunyaClientPayment(booking)) notFound();

  const activeMission = booking.missionLinks.find((mission) => (
    ["PENDING_CONFIRMATION", "RELAUNCHED"].includes(mission.status) && mission.expiresAt >= new Date()
  ));

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title={`Mission ${booking.reference}`}
        description="Détail opérationnel de la réservation attribuée à votre fiche professeur."
        action={(
          <Button asChild variant="outline" className="rounded-lg bg-white">
            <Link href="/professeur/missions">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
        <div className="space-y-5">
          <PortalCard>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={booking.status} />
              {activeMission && <StatusPill status={activeMission.status} type="mission" />}
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-normal text-[#111827]">{booking.subjectName}</h2>
            <p className="mt-1 text-sm font-bold text-[#64748B]">{booking.levelName} · {courseFormatLabel(booking.courseFormat)}</p>
            {booking.needDescription && (
              <p className="mt-4 rounded-lg border border-[#E6EAF3] bg-white p-4 text-sm font-semibold leading-6 text-[#475569]">
                {booking.needDescription}
              </p>
            )}
          </PortalCard>

          <PortalCard>
            <h3 className="text-base font-semibold text-[#111827]">Planning et lieu</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailTile icon={<CalendarDays className="h-4 w-4" />} label="Date prévue" value={formatDate(booking.scheduledDate ?? booking.startDate ?? booking.createdAt)} />
              <DetailTile label="Heure" value={booking.scheduledTime || booking.preferredTime} />
              <DetailTile label="Nombre de séances" value={`${booking.sessionsCount} séance(s) de 2h`} />
              <DetailTile label="Participants" value={`${booking.participantsCount} participant(s)`} />
              <DetailTile icon={<MapPin className="h-4 w-4" />} label="Lieu" value={booking.courseFormat === "ONLINE" ? "En ligne" : [booking.commune, booking.quartier, booking.addressHint].filter(Boolean).join(" · ") || "Adresse à confirmer"} />
              <DetailTile label="Lien en ligne" value={booking.onlineLink || "À transmettre si cours en ligne"} />
            </div>
          </PortalCard>

          <PortalCard>
            <h3 className="text-base font-semibold text-[#111827]">Client et consignes</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailTile icon={<Phone className="h-4 w-4" />} label="Client" value={booking.client.name} />
              <DetailTile label="Contact client" value={booking.client.phone || "À confirmer par le service client"} />
              <DetailTile label="Commune client" value={[booking.client.commune, booking.client.quartier].filter(Boolean).join(" · ") || "Non renseignée"} />
              <DetailTile label="Objectif" value={booking.objective || "Objectif à préciser pendant le premier échange"} />
            </div>
            <div className="mt-4 rounded-lg border border-[#E6EAF3] bg-white p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" />
                <div>
                  <p className="text-sm font-semibold text-[#111827]">Matériel apprenant</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
                    L'apprenant doit avoir son matériel. Compétence ne gère pas les outils, équipements, supports physiques ou matériels professionnels nécessaires au cours.
                  </p>
                </div>
              </div>
            </div>
          </PortalCard>

          <PortalCard>
            <h3 className="text-base font-semibold text-[#111827]">Tâches liées</h3>
            {booking.teacherTasks.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-[#64748B]">Aucune tâche spécifique ajoutée par le service client.</p>
            ) : (
              <div className="mt-4 grid gap-3">
                {booking.teacherTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-[#E6EAF3] bg-white p-4">
                    <div className="flex flex-wrap gap-2">
                      <StatusPill status={task.priority} type="priority" />
                      <StatusPill status={task.status} type="task" />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#111827]">{task.title}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">{task.description}</p>
                    <p className="mt-2 text-xs font-bold text-[#64748B]">Créée le {formatDateTime(task.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </PortalCard>
        </div>

        <div className="space-y-5">
          <PortalCard>
            <h3 className="text-base font-semibold text-[#111827]">Réponse professeur</h3>
            <div className="mt-4">
              {activeMission ? (
                <MissionResponseActions token={activeMission.token} />
              ) : (
                <EmptyProfessorState
                  title="Aucune confirmation ouverte"
                  description="La mission est déjà traitée ou aucun lien de confirmation actif n'a été généré."
                />
              )}
            </div>
          </PortalCard>

          <PortalCard>
            <h3 className="text-base font-semibold text-[#111827]">Créneaux proposés</h3>
            {booking.scheduleProposals.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-[#64748B]">Aucun créneau alternatif proposé pour cette mission.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {booking.scheduleProposals.map((proposal) => (
                  <div key={proposal.id} className="rounded-lg border border-[#E6EAF3] bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-[#111B4D]" />
                      <span className="text-sm font-semibold text-[#111827]">
                        {formatDate(proposal.proposedDate)} · {proposal.proposedTime}
                      </span>
                      <span className="rounded-full border border-[#D7DEE9] bg-white px-2.5 py-1 text-xs font-bold text-[#111B4D]">
                        {proposalStatusLabel(proposal.status)}
                      </span>
                    </div>
                    {proposal.reason && <p className="mt-2 text-xs font-semibold leading-5 text-[#64748B]">{proposal.reason}</p>}
                    {proposal.clientResponse && (
                      <p className="mt-2 rounded-lg border border-[#E6EAF3] bg-white px-3 py-2 text-xs font-semibold leading-5 text-[#111B4D]">
                        Réponse client : {proposal.clientResponse}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </PortalCard>

          <PortalCard>
            <h3 className="text-base font-semibold text-[#111827]">Montants professeur</h3>
            <div className="mt-4">
              <InfoLine label="Net prévu" value={formatFCFA(booking.teacherNetAmount || booking.totalTeacherReceives)} />
              <InfoLine label="Déjà payé" value={formatFCFA(booking.teacherPaidAmount)} />
              <InfoLine label="Déplacement" value={formatFCFA(booking.transportFee)} />
              <InfoLine label="Statut paiement" value={<StatusPill status={booking.paymentStatus} />} />
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-[#64748B]">
              Les paiements restent enregistrés par le service client. Le professeur ne voit que son net opérationnel.
            </p>
          </PortalCard>

          <PortalCard>
            <h3 className="text-base font-semibold text-[#111827]">Historique mission</h3>
            {booking.missionLinks.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-[#64748B]">Aucun lien mission généré.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {booking.missionLinks.map((mission) => (
                  <div key={mission.id} className="rounded-lg border border-[#E6EAF3] bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={mission.status} type="mission" />
                      <span className="text-xs font-bold text-[#64748B]">Expire le {formatDateTime(mission.expiresAt)}</span>
                    </div>
                    {mission.response && <p className="mt-2 text-xs font-semibold leading-5 text-[#64748B]">{mission.response}</p>}
                  </div>
                ))}
              </div>
            )}
          </PortalCard>
        </div>
      </div>
    </div>
  );
}

function DetailTile({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E6EAF3] bg-white px-3 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-[#111827]">{value || "—"}</p>
    </div>
  );
}

function proposalStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Réponse client attendue",
    ACCEPTED: "Accepté par le client",
    REJECTED: "Refusé par le client",
    CANCELLED: "Remplacé",
  };
  return labels[status] ?? status;
}
