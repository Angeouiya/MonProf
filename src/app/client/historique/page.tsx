import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatFCFA } from "@/lib/format";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { MARKETPLACE_ARCHIVED_STATUSES, marketplaceClientRequestWhere } from "@/lib/marketplace-client-history";
import { formatMarketplaceDuration } from "@/lib/marketplace-pricing";
import { requireClient } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const statusLabels: Record<(typeof MARKETPLACE_ARCHIVED_STATUSES)[number], string> = {
  COMPLETED: "Cours terminé",
  CANCELLED: "Demande annulée",
  EXPIRED: "Recherche terminée sans professeur",
};

export default async function ClientHistoriquePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!marketplaceEnabled()) redirect("/client/cours");
  const client = await requireClient();
  const params = await searchParams;
  const parsedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10_000) : 1;
  const where = marketplaceClientRequestWhere(client.id, "archived");
  const [total, requests] = await Promise.all([
    db.marketplaceRequest.count({ where }),
    db.marketplaceRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        status: true,
        subjectName: true,
        levelName: true,
        scheduledDate: true,
        scheduledTime: true,
        durationMinutes: true,
        courseFormat: true,
        totalClientPrice: true,
        assignedTeacher: { select: { fullName: true, professionalName: true } },
      },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl bg-white px-4 pb-12 pt-6 text-[#12243A] sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A6A10]">Compétence</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Historique</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#526174]">Vos cours terminés et demandes clôturées. Les missions en cours restent dans « Mes demandes ».</p>
        </div>
        <Link href="/client/demandes" className="inline-flex min-h-11 items-center rounded-xl border border-[#DCE2E8] bg-white px-4 text-sm font-semibold text-[#092A55]">Mes demandes</Link>
      </div>

      <div className="mt-7 space-y-2" aria-label="Historique des missions">
        {requests.length ? requests.map((request) => (
          <Link key={request.id} href={`/client/demandes/${request.id}`} className="block rounded-xl border border-[#E2E7EA] bg-white p-4 transition hover:border-[#98AEC3] hover:bg-[#F8FAFB] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#526174]">{request.reference}</p>
                <h2 className="mt-1 text-base font-semibold text-[#12243A]">{request.subjectName} · {request.levelName}</h2>
                <p className="mt-2 text-sm text-[#526174]">
                  {request.scheduledDate.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })}
                  {" à "}{request.scheduledTime}{" · "}{formatMarketplaceDuration(request.durationMinutes)}
                  {" · "}{request.courseFormat === "HOME" ? "À domicile" : "En ligne"}
                </p>
                {request.assignedTeacher && <p className="mt-1 text-sm text-[#526174]">{request.assignedTeacher.professionalName || request.assignedTeacher.fullName}</p>}
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <span className="block text-xs font-semibold text-[#092A55]">{statusLabels[request.status as keyof typeof statusLabels]}</span>
                <span className="mt-1 block text-xs text-[#526174]">Montant annoncé : {formatFCFA(request.totalClientPrice)}</span>
              </div>
            </div>
          </Link>
        )) : <div className="rounded-xl border border-[#E2E7EA] bg-[#F8FAFB] px-5 py-12 text-center text-sm text-[#526174]">Aucune mission clôturée pour le moment.</div>}
      </div>

      {total > PAGE_SIZE && <nav aria-label="Pages de l’historique" className="mt-6 flex items-center justify-between gap-3 text-sm font-semibold text-[#092A55]">
        {page > 1 ? <Link href={`/client/historique?page=${page - 1}`} className="rounded-xl border border-[#DCE2E8] px-4 py-3">Précédent</Link> : <span />}
        <span className="text-[#526174]">{Math.min(page, pageCount)} / {pageCount}</span>
        {page < pageCount ? <Link href={`/client/historique?page=${page + 1}`} className="rounded-xl border border-[#DCE2E8] px-4 py-3">Suivant</Link> : <span />}
      </nav>}

      <div className="mt-9 border-t border-[#E2E7EA] pt-6">
        <p className="text-sm font-semibold text-[#12243A]">Vos anciens cours</p>
        <p className="mt-1 text-sm text-[#526174]">Les réservations de la version précédente restent accessibles séparément.</p>
        <Link href="/client/cours" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-[#DCE2E8] bg-white px-4 text-sm font-semibold text-[#092A55]">Voir les anciens cours</Link>
      </div>
    </main>
  );
}
