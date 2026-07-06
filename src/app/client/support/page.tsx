import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  ClientAppRail,
  ClientEmptyState,
  ClientFocusPanel,
  ClientMetricStrip,
  ClientPageHeader,
  ClientRecordCard,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  LifeBuoy, Mail, Phone, AlertTriangle, ShieldCheck, CheckCircle2, FileText,
  ArrowRight,
} from "lucide-react";
import { DisputeForm } from "./dispute-form";

export const dynamic = "force-dynamic";

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouvert",
  INVESTIGATING: "En cours d'examen",
  RESOLVED: "Résolu",
  REFUNDED: "Remboursé",
  REJECTED: "Rejeté",
};

export default async function SupportPage() {
  const user = await getSessionUser();
  if (!user) return null;

  // Réservations sur lesquelles le client peut ouvrir un litige (pas déjà en litige)
  const eligibleBookings = await db.booking.findMany({
    where: {
      clientId: user.id,
      status: { in: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "COURSE_DONE", "PENDING_CLIENT_VALIDATION"] },
    },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
      disputes: true,
    },
  });
  const bookableForDispute = eligibleBookings.filter((b) => b.disputes.length === 0);

  // Mes litiges
  const myDisputes = await db.dispute.findMany({
    where: { openedById: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      booking: {
        select: {
          id: true, reference: true, subjectName: true, levelName: true,
          teacher: { select: { id: true, fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
        },
      },
    },
  });
  const openDisputes = myDisputes.filter((dispute) => ["OPEN", "INVESTIGATING"].includes(dispute.status));
  const resolvedDisputes = myDisputes.filter((dispute) => ["RESOLVED", "REFUNDED", "REJECTED"].includes(dispute.status));
  const focus = buildSupportFocus({
    eligibleCount: bookableForDispute.length,
    openCount: openDisputes.length,
  });

  return (
    <div className="space-y-6">
      <ClientPageHeader
        eyebrow="Assistance"
        title="Service client et litiges"
        description="Une aide claire pour suivre vos cours, protéger votre paiement et garder une trace de chaque décision."
      />

      <ClientMetricStrip
        metrics={[
          { icon: ShieldCheck, label: "Éligibles", value: eligibleBookings.length },
          { icon: AlertTriangle, label: "En cours", value: openDisputes.length, attention: openDisputes.length > 0 },
          { icon: CheckCircle2, label: "Clos", value: resolvedDisputes.length },
        ]}
      />

      <ClientFocusPanel
        eyebrow={focus.eyebrow}
        title={focus.title}
        description={focus.description}
        icon={LifeBuoy}
        action={
          <Button asChild variant="outline" className="min-h-11 w-full rounded-lg">
            <Link href="/client/reservations">
              Mes cours
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <ClientAppRail
        items={[
          { href: "tel:+22527220000", icon: Phone, label: "Appeler", value: "Service client direct", active: true },
          { href: "mailto:contact@competence.ci", icon: Mail, label: "Email", value: "Trace écrite" },
          { href: "/client/reservations", icon: FileText, label: "Dossiers", value: "Réservations" },
          { href: "/client/notifications", icon: ShieldCheck, label: "Suivi", value: "Notifications" },
        ]}
      />

      {/* Ouvrir un litige */}
      <ClientSurface className="space-y-4">
        <ClientSectionTitle
          title={
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[#111B4D]" />
              Signaler un cours
            </span>
          }
          description="Choisissez la réservation, décrivez le problème, le service client garde la trace."
          action={<p className="text-sm font-semibold text-[#111B4D]">{formatCount(bookableForDispute.length, "éligible")}</p>}
        />
          {bookableForDispute.length === 0 ? (
            <ClientEmptyState
              icon={FileText}
              title="Aucune réservation éligible"
              description="Vous pouvez ouvrir un litige uniquement sur une réservation en cours ou récemment terminée."
            />
          ) : (
            <DisputeForm bookings={bookableForDispute.map((b) => ({
              id: b.id,
              reference: b.reference,
              subjectName: b.subjectName,
              levelName: b.levelName,
              teacherName: b.teacher.professionalName || b.teacher.fullName,
              teacherPhotoUrl: b.teacher.photoUrl,
              teacherBadgeVerified: b.teacher.badgeVerified,
            }))} />
          )}
      </ClientSurface>

      {/* Mes litiges */}
      <ClientSurface className="space-y-4">
        <ClientSectionTitle title={`Historique (${myDisputes.length})`} description="Dossiers ouverts et décisions du service client." />
          {myDisputes.length === 0 ? (
            <ClientEmptyState
              icon={CheckCircle2}
              title="Aucun dossier"
              description="Les signalements apparaîtront ici avec leur statut."
            />
          ) : (
            myDisputes.map((d) => {
              const statusLabel = DISPUTE_STATUS_LABELS[d.status] ?? DISPUTE_STATUS_LABELS.OPEN;
              const name = d.booking.teacher.professionalName || d.booking.teacher.fullName;
              return (
                <ClientRecordCard key={d.id} data-client-support-dispute-card className="p-4">
                  <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-col gap-1 min-[460px]:flex-row min-[460px]:items-center min-[460px]:gap-3">
                        <p className="text-sm font-semibold text-[#111827]">{d.booking.reference}</p>
                        <p className="inline-flex w-fit rounded-lg border border-[#E3E8F2] bg-white px-2.5 py-1 text-xs font-semibold text-[#111B4D]">{statusLabel}</p>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-[#111827]">{d.booking.subjectName} • {d.booking.levelName}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-[#64748B]">
                        <ProfessorImage
                          photoUrl={d.booking.teacher.photoUrl}
                          name={name}
                          size={32}
                          shape="circle"
                          verified={d.booking.teacher.badgeVerified}
                        />
                        <span className="min-w-0 break-words">{name} • {formatDate(d.createdAt)}</span>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm" className="w-full rounded-lg min-[640px]:w-auto">
                      <Link href={`/client/reservations/${d.booking.id}`}>
                        Ouvrir <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-3 rounded-lg border border-[#E3E8F2] bg-white p-3 text-xs">
                    <p><span className="font-semibold text-[#111827]">Motif :</span> <span className="text-[#64748B]">{d.reason}</span></p>
                    <p className="mt-1"><span className="font-semibold text-[#111827]">Message :</span> <span className="text-[#64748B]">{d.description}</span></p>
                    {d.resolution && (
                      <p className="mt-1"><span className="font-semibold text-[#111827]">Décision :</span> <span className="text-[#64748B]">{d.resolution}</span></p>
                    )}
                  </div>
                </ClientRecordCard>
              );
            })
          )}
      </ClientSurface>
    </div>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildSupportFocus({
  eligibleCount,
  openCount,
}: {
  eligibleCount: number;
  openCount: number;
}) {
  if (openCount > 0) {
    return {
      eyebrow: "Dossier en cours",
      title: `${formatCount(openCount, "signalement")} suivi par l'équipe`,
      description: "Suivez l'avancement depuis l'historique ou ouvrez la réservation liée.",
    };
  }
  if (eligibleCount > 0) {
    return {
      eyebrow: "Cours protégé",
      title: "Un cours peut être signalé si nécessaire",
      description: "Le dossier reste rattaché au professeur, à la réservation et aux échanges.",
    };
  }
  return {
    eyebrow: "Tout est clair",
    title: "Aucun signalement à traiter",
    description: "Vos réservations restent accessibles si vous devez contacter le service client.",
  };
}
