import Link from "next/link";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import {
  ClientEmptyState,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientProcessTracker,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  AlertTriangle, ShieldCheck, CheckCircle2, FileText,
  ArrowRight, Clock3,
} from "lucide-react";
import { DisputeForm } from "../support/dispute-form";
import { SupportHistoryClient, type ClientSupportDisputeItem } from "../support/support-history-client";

export const dynamic = "force-dynamic";

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouvert",
  INVESTIGATING: "En cours d'examen",
  RESOLVED: "Résolu",
  REFUNDED: "Remboursé",
  REJECTED: "Rejeté",
};

export default async function ServiceClientPage() {
  const user = await getSessionUser();
  if (!user) return null;

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
  const bookableForDispute = eligibleBookings.filter((b) => b.disputes.length === 0);
  const openDisputes = myDisputes.filter((dispute) => ["OPEN", "INVESTIGATING"].includes(dispute.status));
  const resolvedDisputes = myDisputes.filter((dispute) => ["RESOLVED", "REFUNDED", "REJECTED"].includes(dispute.status));
  const focus = buildSupportFocus({
    eligibleCount: bookableForDispute.length,
    openCount: openDisputes.length,
  });
  const disputeItems: ClientSupportDisputeItem[] = myDisputes.map((dispute) => {
    const statusLabel = DISPUTE_STATUS_LABELS[dispute.status] ?? DISPUTE_STATUS_LABELS.OPEN;
    const teacherName = dispute.booking.teacher.professionalName || dispute.booking.teacher.fullName;
    const createdAtLabel = formatDate(dispute.createdAt);
    const statusKind = getDisputeStatusKind(dispute.status);
    const searchText = normalizeSupportSearch([
      statusLabel,
      dispute.reason,
      dispute.description,
      dispute.resolution ?? "",
      createdAtLabel,
      dispute.booking.reference,
      dispute.booking.subjectName,
      dispute.booking.levelName,
      teacherName,
    ].join(" "));

    return {
      id: dispute.id,
      status: dispute.status,
      statusLabel,
      statusKind,
      reason: dispute.reason,
      description: dispute.description,
      resolution: dispute.resolution,
      createdAtLabel,
      booking: {
        id: dispute.booking.id,
        reference: dispute.booking.reference,
        subjectName: dispute.booking.subjectName,
        levelName: dispute.booking.levelName,
        teacherName,
        teacherPhotoUrl: dispute.booking.teacher.photoUrl,
        teacherBadgeVerified: dispute.booking.teacher.badgeVerified,
      },
      searchText,
    };
  });

  return (
    <div className="space-y-6">
      <ClientPageHeader
        eyebrow="Assistance"
        title="Service client et litiges"
        description="Une aide claire pour suivre vos cours, protéger votre paiement et garder une trace de chaque décision."
      />

      <ClientMetricStrip
        className="max-md:hidden"
        metrics={[
          { icon: ShieldCheck, label: "Éligibles", value: eligibleBookings.length },
          { icon: AlertTriangle, label: "En cours", value: openDisputes.length, attention: openDisputes.length > 0 },
          { icon: CheckCircle2, label: "Clos", value: resolvedDisputes.length },
        ]}
      />

      <SupportMobilePriorityCard
        focus={focus}
        eligibleCount={bookableForDispute.length}
        openCount={openDisputes.length}
        resolvedCount={resolvedDisputes.length}
        latestDispute={disputeItems[0] ?? null}
        priorityBooking={bookableForDispute[0]
          ? {
              id: bookableForDispute[0].id,
              reference: bookableForDispute[0].reference,
              subjectName: bookableForDispute[0].subjectName,
              levelName: bookableForDispute[0].levelName,
              teacherName: bookableForDispute[0].teacher.professionalName || bookableForDispute[0].teacher.fullName,
            }
          : null}
      />

      <div className="max-md:hidden">
        <SupportCommandCenter
          focus={focus}
          eligibleCount={bookableForDispute.length}
          openCount={openDisputes.length}
          resolvedCount={resolvedDisputes.length}
          latestDispute={disputeItems[0] ?? null}
          priorityBooking={bookableForDispute[0]
            ? {
                id: bookableForDispute[0].id,
                reference: bookableForDispute[0].reference,
                subjectName: bookableForDispute[0].subjectName,
                levelName: bookableForDispute[0].levelName,
                teacherName: bookableForDispute[0].teacher.professionalName || bookableForDispute[0].teacher.fullName,
              }
            : null}
        />
      </div>

      {/* Ouvrir un litige */}
      <ClientSurface id="signaler-cours" className="scroll-mt-24 space-y-4">
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

      <SupportHistoryClient disputes={disputeItems} />
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
      description: "Ouvrez le dossier lié et suivez la décision du service client sans perdre la trace.",
    };
  }
  if (eligibleCount > 0) {
    return {
      eyebrow: "Cours protégé",
      title: "Un cours peut être signalé si nécessaire",
      description: "Choisissez la réservation concernée, ajoutez le contexte, puis envoyez un signalement précis.",
    };
  }
  return {
    eyebrow: "Tout est clair",
    title: "Aucun signalement à traiter",
    description: "Vos réservations restent accessibles si vous devez contacter le service client.",
  };
}

type SupportFocus = ReturnType<typeof buildSupportFocus>;

function SupportMobilePriorityCard({
  focus,
  eligibleCount,
  openCount,
  resolvedCount,
  latestDispute,
  priorityBooking,
}: {
  focus: SupportFocus;
  eligibleCount: number;
  openCount: number;
  resolvedCount: number;
  latestDispute: ClientSupportDisputeItem | null;
  priorityBooking: {
    id: string;
    reference: string;
    subjectName: string;
    levelName: string;
    teacherName: string;
  } | null;
}) {
  const hasOpen = openCount > 0;
  const canSignal = eligibleCount > 0;
  const actionHref = hasOpen && latestDispute
    ? `/client/reservations/${latestDispute.booking.id}`
    : canSignal
      ? "#signaler-cours"
      : "/client/reservations";
  const actionLabel = hasOpen ? "Suivre" : canSignal ? "Signaler" : "Dossiers";
  const title = latestDispute?.booking.reference || priorityBooking?.reference || focus.title;
  const hint = latestDispute
    ? `${latestDispute.reason} · ${latestDispute.booking.teacherName}`
    : priorityBooking
      ? `${priorityBooking.subjectName} · ${priorityBooking.levelName}`
      : focus.description;

  return (
    <ClientSurface compact className="rounded-lg border border-[#DDE3EE] p-3 md:hidden" data-client-support-mobile-priority>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
          {hasOpen ? <AlertTriangle className="h-5 w-5" /> : canSignal ? <ShieldCheck className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">{focus.eyebrow}</p>
          <h2 className="mt-0.5 line-clamp-3 text-sm font-semibold leading-5 text-[#111827]">{title}</h2>
          <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-5 text-[#64748B]">{hint}</p>
        </div>
        <Button asChild size="sm" className="min-h-10 shrink-0 rounded-lg bg-[#111B4D] px-3 text-white hover:bg-[#1E2A78]">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <ClientInfoPill label="Éligibles" value={eligibleCount} strong={eligibleCount > 0} />
        <ClientInfoPill label="En cours" value={openCount} strong={openCount > 0} />
        <ClientInfoPill label="Clos" value={resolvedCount} strong={resolvedCount > 0} />
      </div>

      <div className="mt-3 flex min-w-0 gap-2 overflow-x-auto pb-0.5" data-client-support-action-rail aria-label="Actions service client">
        <Button asChild variant="outline" size="sm" className="min-h-10 shrink-0 rounded-lg border-[#CAD7F2] bg-white px-3 text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
          <Link href="/client/reservations">Réservations</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="min-h-10 shrink-0 rounded-lg border-[#CAD7F2] bg-white px-3 text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
          <Link href="/client/paiements">Paiements</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="min-h-10 shrink-0 rounded-lg border-[#CAD7F2] bg-white px-3 text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
          <Link href="mailto:contact@competence.ci">Email</Link>
        </Button>
      </div>
    </ClientSurface>
  );
}

function SupportCommandCenter({
  focus,
  eligibleCount,
  openCount,
  resolvedCount,
  latestDispute,
  priorityBooking,
}: {
  focus: SupportFocus;
  eligibleCount: number;
  openCount: number;
  resolvedCount: number;
  latestDispute: ClientSupportDisputeItem | null;
  priorityBooking: {
    id: string;
    reference: string;
    subjectName: string;
    levelName: string;
    teacherName: string;
  } | null;
}) {
  const hasOpen = openCount > 0;
  const canSignal = eligibleCount > 0;
  const actionHref = hasOpen && latestDispute
    ? `/client/reservations/${latestDispute.booking.id}`
    : canSignal
      ? "#signaler-cours"
      : "/client/reservations";
  const actionLabel = hasOpen
    ? "Ouvrir le dossier"
    : canSignal
      ? "Signaler un cours"
      : "Voir mes cours";
  const latestLabel = latestDispute
    ? `${latestDispute.booking.reference} · ${latestDispute.statusLabel}`
    : priorityBooking
      ? `${priorityBooking.reference} · éligible`
      : "Aucun dossier actif";

  return (
    <ClientSurface compact className="overflow-hidden rounded-lg border border-[#DDE3EE] p-0" data-client-support-command-center>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="min-w-0 space-y-4 p-4 min-[640px]:p-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              {hasOpen ? <AlertTriangle className="h-5 w-5" /> : canSignal ? <ShieldCheck className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">{focus.eyebrow}</p>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-[#111827]">{focus.title}</h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">{focus.description}</p>
            </div>
          </div>

          <div className="grid gap-2 min-[520px]:grid-cols-2 xl:grid-cols-4">
            <ClientInfoPill label="À signaler" value={eligibleCount} strong={eligibleCount > 0} />
            <ClientInfoPill label="En cours" value={openCount} strong={openCount > 0} />
            <ClientInfoPill label="Clos" value={resolvedCount} strong={resolvedCount > 0} />
            <ClientInfoPill label="Dernier suivi" value={latestLabel} strong={Boolean(latestDispute)} />
          </div>

          <ClientProcessTracker
            steps={[
              {
                label: "Cours identifié",
                hint: canSignal || hasOpen ? "Réservation reliée au dossier." : "Aucun cours à signaler.",
                state: hasOpen || canSignal ? "done" : "current",
              },
              {
                label: "Signalement clair",
                hint: "Motif, contexte et professeur restent traçables.",
                state: hasOpen ? "done" : canSignal ? "current" : "pending",
              },
              {
                label: "Décision suivie",
                hint: "Historique, remboursement ou clôture si nécessaire.",
                state: resolvedCount > 0 ? "done" : hasOpen ? "current" : "pending",
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
                  <p className="text-sm font-semibold text-[#111827]">Action prioritaire</p>
                  <p className="text-xs font-medium leading-5 text-[#64748B]">
                    {hasOpen ? "Suivre le dossier en cours" : canSignal ? "Préparer un signalement précis" : "Consulter vos réservations"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-[#D8DEE9] bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                  {hasOpen ? "Signalement ouvert" : canSignal ? "Réservation éligible" : "Centre calme"}
                </p>
                <p className="mt-1 text-base font-semibold leading-6 text-[#111827]">
                  {latestDispute?.booking.reference || priorityBooking?.reference || "Aucun dossier actif"}
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                  {latestDispute
                    ? `${latestDispute.reason} · ${latestDispute.booking.teacherName}`
                    : priorityBooking
                      ? `${priorityBooking.subjectName} · ${priorityBooking.levelName} · ${priorityBooking.teacherName}`
                      : "Vos prochains échanges avec le service client apparaîtront ici."}
                </p>
              </div>
            </div>

            <Button asChild className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
              <Link href={actionHref}>
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

function getDisputeStatusKind(status: string): ClientSupportDisputeItem["statusKind"] {
  if (status === "REFUNDED") return "refunded";
  if (status === "REJECTED") return "rejected";
  if (["RESOLVED", "REFUNDED", "REJECTED"].includes(status)) return "closed";
  return "open";
}

function normalizeSupportSearch(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
