import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { ProfessorImage } from "@/components/shared/professor-image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import {
  LifeBuoy, Mail, Phone, AlertTriangle, ShieldCheck, CheckCircle2, FileText,
  ArrowRight, type LucideIcon,
} from "lucide-react";
import { DisputeForm } from "./dispute-form";

export const dynamic = "force-dynamic";

const DISPUTE_STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  OPEN: { label: "Ouvert", tone: "bg-white text-[#111B4D] border-[#DDE6F7]" },
  INVESTIGATING: { label: "En cours d'examen", tone: "bg-white text-[#111B4D] border-[#DDE6F7]" },
  RESOLVED: { label: "Résolu", tone: "bg-white text-[#111B4D] border-[#DDE6F7]" },
  REFUNDED: { label: "Remboursé", tone: "bg-white text-[#111B4D] border-[#DDE6F7]" },
  REJECTED: { label: "Rejeté", tone: "bg-white text-[#111827] border-[#DDE6F7]" },
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support et litiges"
        description="Contactez le support, ouvrez un litige sur une réservation éligible et suivez chaque décision."
      />

      <section className="rounded-[1.35rem] border border-[#E3E8F2] bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-2 min-[520px]:grid-cols-3">
          <SupportCompactMetric icon={ShieldCheck} label="Protégées" value={eligibleBookings.length} />
          <SupportCompactMetric icon={AlertTriangle} label="Ouverts" value={openDisputes.length} attention={openDisputes.length > 0} />
          <SupportCompactMetric icon={CheckCircle2} label="Clôturés" value={resolvedDisputes.length} />
        </div>
        <div className="mt-3 flex flex-col gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
          <p className="text-sm font-semibold leading-6 text-[#64748B]">
            {bookableForDispute.length > 0
              ? "Sélectionnez une réservation éligible pour ouvrir un dossier support."
              : "Aucun dossier éligible pour un nouveau litige actuellement."}
          </p>
          <Button asChild variant="outline" className="min-h-11 rounded-2xl">
            <Link href="/client/reservations">
              Mes réservations
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Coordonnées support */}
      <Card className="overflow-hidden rounded-[1.35rem] border-[#DDE6F7] bg-white">
        <CardContent className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111B4D] text-white shadow-sm">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-[#111827]">Besoin d'aide ?</p>
              <p className="text-xs leading-5 text-[#64748B]">Notre support vous répond sous 24-48h ouvrées.</p>
            </div>
          </div>
          <div className="grid gap-2 text-sm min-[520px]:grid-cols-2">
            <a href="tel:+22527220000" className="flex min-h-10 items-center gap-2 rounded-2xl border border-[#E3E8F2] bg-white px-3 font-semibold text-[#111827] hover:border-[#CBD7EA] hover:bg-white">
              <Phone className="h-4 w-4 text-[#111B4D]" />
              +225 27 22 00 00 00
            </a>
            <a href="mailto:support@monprof.ci" className="flex min-h-10 items-center gap-2 rounded-2xl border border-[#E3E8F2] bg-white px-3 font-semibold text-[#111827] hover:border-[#CBD7EA] hover:bg-white">
              <Mail className="h-4 w-4 text-[#111B4D]" />
              support@monprof.ci
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Ouvrir un litige */}
      <Card className="rounded-[1.35rem] border-[#E3E8F2] bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-black text-[#111827]">
                <AlertTriangle className="h-4 w-4 text-[#111B4D]" />
                Ouvrir un litige
              </CardTitle>
              <p className="mt-1 text-sm leading-6 text-[#64748B]">
                Sélectionnez la réservation concernée. Le paiement professeur reste suspendu pendant l'analyse.
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-[#DDE6F7] bg-white text-[#111B4D]">
              {formatCount(bookableForDispute.length, "éligible")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {bookableForDispute.length === 0 ? (
            <EmptyState
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
        </CardContent>
      </Card>

      {/* Mes litiges */}
      <Card className="rounded-[1.35rem] border-[#E3E8F2] bg-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base font-black text-[#111827]">Mes litiges ({myDisputes.length})</CardTitle>
            <Badge variant="outline" className="w-fit border-[#DDE6F7] bg-white text-[#111B4D]">
              Historique support
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {myDisputes.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Aucun litige ouvert"
              description="Votre historique support est calme. Les dossiers ouverts apparaîtront ici avec leur statut."
            />
          ) : (
            myDisputes.map((d) => {
              const st = DISPUTE_STATUS_LABELS[d.status] ?? DISPUTE_STATUS_LABELS.OPEN;
              const name = d.booking.teacher.professionalName || d.booking.teacher.fullName;
              return (
                <div key={d.id} className="rounded-[1.2rem] border border-[#E3E8F2] bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-[#111827]">{d.booking.reference}</p>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${st.tone}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-[#111827]">{d.booking.subjectName} • {d.booking.levelName}</p>
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
                    <Button asChild variant="outline" size="sm" className="w-full rounded-2xl sm:w-auto">
                      <Link href={`/client/reservations/${d.booking.id}`}>
                        Dossier <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-3 rounded-2xl border border-[#E3E8F2] bg-white p-3 text-xs shadow-sm">
                    <p><span className="font-bold text-[#111827]">Raison :</span> <span className="text-[#64748B]">{d.reason}</span></p>
                    <p className="mt-1"><span className="font-bold text-[#111827]">Description :</span> <span className="text-[#64748B]">{d.description}</span></p>
                    {d.resolution && (
                      <p className="mt-1"><span className="font-bold text-[#111827]">Résolution :</span> <span className="text-[#64748B]">{d.resolution}</span></p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SupportCompactMetric({
  icon: Icon,
  label,
  value,
  attention = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  attention?: boolean;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
        <p className={attention ? "mt-0.5 text-lg font-black text-[#111B4D]" : "mt-0.5 text-lg font-black text-[#111827]"}>{value}</p>
      </div>
      <Icon className="h-4 w-4 shrink-0 text-[#111B4D]" />
    </div>
  );
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}
