import Link from "next/link";
import { BookingStatus, type Prisma } from "@prisma/client";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Search } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getSessionUser } from "@/lib/session";
import { ClientEmptyState, ClientPageHeader, ClientSurface } from "@/components/shared/client-page-primitives";
import { Button } from "@/components/ui/button";
import { DisputeForm } from "../support/dispute-form";
import { SupportHistoryClient, type ClientSupportDisputeItem } from "../support/support-history-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const ELIGIBLE_STATUSES: BookingStatus[] = [
  "PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS",
  "COURSE_DONE", "PENDING_CLIENT_VALIDATION",
];

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Ouvert",
  INVESTIGATING: "En cours d'examen",
  RESOLVED: "Résolu",
  REFUNDED: "Remboursé",
  REJECTED: "Rejeté",
};

type SearchParams = Promise<{ vue?: string; page?: string; q?: string }>;

export default async function ServiceClientPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser();
  if (!user) return null;

  const params = await searchParams;
  if (params.vue === "signaler") return <SignalCourse clientId={user.id} query={params.q} />;
  if (params.vue === "historique") return <SupportHistory clientId={user.id} page={params.page} />;

  // L'accueil ne charge ni tous les cours ni toutes les descriptions de litiges.
  const [latestDispute, openCount, eligibleCount] = await db.$transaction([
    db.dispute.findFirst({
      where: { openedById: user.id },
      orderBy: { createdAt: "desc" },
      select: { status: true, reason: true, createdAt: true, booking: { select: { id: true, reference: true } } },
    }),
    db.dispute.count({ where: { openedById: user.id, status: { in: ["OPEN", "INVESTIGATING"] } } }),
    db.booking.count({ where: eligibleBookingWhere(user.id) }),
  ]);
  const primaryHref = openCount > 0 || (latestDispute && eligibleCount === 0)
    ? "/client/service-client?vue=historique"
    : eligibleCount > 0 ? "/client/service-client?vue=signaler" : "/client/reservations";
  const primaryLabel = openCount > 0 ? "Suivre mes dossiers" : eligibleCount > 0 ? "Signaler un cours" : latestDispute ? "Mes dossiers" : "Voir mes cours";
  const secondaryHref = eligibleCount > 0 && openCount > 0
    ? "/client/service-client?vue=signaler"
    : eligibleCount > 0 && latestDispute ? "/client/service-client?vue=historique" : null;
  const secondaryLabel = openCount > 0 ? "Signaler un cours" : "Mes dossiers";

  return (
    <div className="space-y-5">
      <ClientPageHeader eyebrow="Assistance" title="Aide" description="Une question sur un cours ? Nous sommes là." showBack={false} />
      <ClientSurface compact className="space-y-5 p-5" data-client-support-mobile-priority>
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#111B4D] text-white">
            {openCount ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#111827]">{openCount ? `${openCount} dossier${openCount > 1 ? "s" : ""} en cours` : "Comment pouvons-nous vous aider ?"}</h2>
            <p className="mt-1 text-sm leading-6 text-[#52627A]">
              {eligibleCount ? "Signalez le cours concerné en quelques étapes." : "Vos cours et vos demandes restent accessibles à tout moment."}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
            <Link href={primaryHref}>{primaryLabel} <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          {secondaryHref && (
            <Button asChild variant="outline" className="min-h-11 rounded-lg">
              <Link href={secondaryHref}>{secondaryLabel}</Link>
            </Button>
          )}
        </div>
      </ClientSurface>
      {latestDispute && (
        <ClientSurface compact className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Dernier dossier · {formatDate(latestDispute.createdAt)}</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[#111827]">{latestDispute.booking.reference} · {DISPUTE_STATUS_LABELS[latestDispute.status]}</p>
              <p className="text-sm text-[#52627A]">{latestDispute.reason}</p>
            </div>
            <Link href={`/client/reservations/${latestDispute.booking.id}`} className="text-sm font-semibold text-[#111B4D] underline-offset-4 hover:underline">Voir le cours</Link>
          </div>
        </ClientSurface>
      )}
    </div>
  );
}

function eligibleBookingWhere(clientId: string): Prisma.BookingWhereInput {
  return {
    clientId,
    status: { in: ELIGIBLE_STATUSES },
    disputes: { none: {} },
  };
}

async function SignalCourse({ clientId, query }: { clientId: string; query?: string }) {
  const search = (query ?? "").trim().slice(0, 80);
  const where = {
    ...eligibleBookingWhere(clientId),
    ...(search ? { reference: { contains: search, mode: "insensitive" as const } } : {}),
  };
  const [bookings, total] = await db.$transaction([
    db.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: {
        id: true, reference: true, subjectName: true, levelName: true,
        teacher: { select: { fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
      },
    }),
    db.booking.count({ where }),
  ]);

  return (
    <div className="space-y-5">
      <BackToHelp />
      <ClientPageHeader eyebrow="Assistance" title="Signaler un cours" description="Choisissez le cours, expliquez le problème et envoyez." showBack={false} />
      <ClientSurface className="space-y-4">
        {total > PAGE_SIZE && <p className="text-sm text-[#52627A]">Les {PAGE_SIZE} cours les plus récents sont affichés. Pour un autre cours, recherchez sa référence.</p>}
        <form action="/client/service-client" method="get" className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="vue" value="signaler" />
          <label className="sr-only" htmlFor="support-booking-search">Référence du cours</label>
          <input id="support-booking-search" name="q" type="search" defaultValue={search} maxLength={80} placeholder="Référence du cours" className="min-h-11 w-full rounded-lg border border-[#CAD7F2] bg-white px-3 text-sm text-[#111827] sm:max-w-sm" />
          <Button type="submit" variant="outline" className="min-h-11 rounded-lg"><Search className="mr-2 h-4 w-4" />Rechercher</Button>
        </form>
        {bookings.length ? (
          <DisputeForm bookings={bookings.map((booking) => ({
            id: booking.id,
            reference: booking.reference,
            subjectName: booking.subjectName,
            levelName: booking.levelName,
            teacherName: booking.teacher.professionalName || booking.teacher.fullName,
            teacherPhotoUrl: booking.teacher.photoUrl,
            teacherBadgeVerified: booking.teacher.badgeVerified,
          }))} />
        ) : (
          <ClientEmptyState icon={Search} title="Aucun cours trouvé" description={search ? "Vérifiez la référence du cours." : "Aucun cours éligible pour le moment."} />
        )}
      </ClientSurface>
    </div>
  );
}

async function SupportHistory({ clientId, page }: { clientId: string; page?: string }) {
  const pageNumber = Math.max(1, Math.min(10000, Number.parseInt(page ?? "1", 10) || 1));
  const [disputes, total] = await db.$transaction([
    db.dispute.findMany({
      where: { openedById: clientId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (pageNumber - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, status: true, reason: true, description: true, resolution: true, createdAt: true,
        booking: { select: {
          id: true, reference: true, subjectName: true, levelName: true,
          teacher: { select: { fullName: true, professionalName: true, photoUrl: true, badgeVerified: true } },
        } },
      },
    }),
    db.dispute.count({ where: { openedById: clientId } }),
  ]);
  const items: ClientSupportDisputeItem[] = disputes.map((dispute) => {
    const teacherName = dispute.booking.teacher.professionalName || dispute.booking.teacher.fullName;
    const createdAtLabel = formatDate(dispute.createdAt);
    const statusLabel = DISPUTE_STATUS_LABELS[dispute.status] ?? "Ouvert";
    return {
      id: dispute.id,
      status: dispute.status,
      statusLabel,
      statusKind: dispute.status === "REFUNDED" ? "refunded" : dispute.status === "REJECTED" ? "rejected" : dispute.status === "RESOLVED" ? "closed" : "open",
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
      searchText: normalizeSearch([statusLabel, dispute.reason, dispute.description, dispute.resolution ?? "", createdAtLabel, dispute.booking.reference, dispute.booking.subjectName, dispute.booking.levelName, teacherName].join(" ")),
    };
  });

  return (
    <div className="space-y-5">
      <BackToHelp />
      <ClientPageHeader eyebrow="Assistance" title="Mes dossiers" description={`${total} dossier${total > 1 ? "s" : ""} au total.`} showBack={false} />
      {items.length ? <SupportHistoryClient disputes={items} /> : <ClientEmptyState icon={CheckCircle2} title="Aucun dossier" description="Vos demandes apparaîtront ici." />}
      {total > PAGE_SIZE && (
        <nav className="flex items-center justify-between gap-3" aria-label="Pages des dossiers">
          {pageNumber > 1 ? <Link href={`/client/service-client?vue=historique&page=${pageNumber - 1}`} className="text-sm font-semibold text-[#111B4D]">Précédent</Link> : <span />}
          <span className="text-sm text-[#52627A]">Page {pageNumber} sur {Math.ceil(total / PAGE_SIZE)}</span>
          {pageNumber * PAGE_SIZE < total ? <Link href={`/client/service-client?vue=historique&page=${pageNumber + 1}`} className="text-sm font-semibold text-[#111B4D]">Suivant</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

function BackToHelp() {
  return <Link href="/client/service-client" className="inline-flex items-center gap-2 text-sm font-semibold text-[#111B4D]"><ArrowLeft className="h-4 w-4" />Retour à l’aide</Link>;
}

function normalizeSearch(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}
