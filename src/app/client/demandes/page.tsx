import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { formatMarketplaceDuration } from "@/lib/marketplace-pricing";
import { marketplaceClientRequestWhere } from "@/lib/marketplace-client-history";

const STATUS: Record<string, string> = {
  SEARCHING: "Recherche en cours", OFFERED: "En attente du professeur",
  ACCEPTED: "Professeur confirmé", IN_PROGRESS: "Cours en cours",
  AWAITING_CLIENT: "Fin à confirmer", COMPLETED: "Cours terminé",
  CANCELLED: "Annulé", EXPIRED: "Aucun professeur disponible", DISPUTED: "Litige en cours",
};

const PAGE_SIZE = 20;

export default async function ClientDemandesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!marketplaceEnabled()) redirect("/client");
  const client = await requireClient();
  const params = await searchParams;
  const requestedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 10_000) : 1;
  const where = marketplaceClientRequestWhere(client.id, "active");
  const [total, requests] = await Promise.all([
    db.marketplaceRequest.count({ where }),
    db.marketplaceRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, reference: true, subjectName: true, levelName: true,
        scheduledDate: true, scheduledTime: true, durationMinutes: true, totalClientPrice: true, status: true,
        series: { select: { requests: { select: { totalClientPrice: true } } } },
        assignedTeacher: { select: { fullName: true, professionalName: true } },
      },
    }),
  ]);
  return (
    <main className="mx-auto max-w-4xl bg-white px-4 pb-12 pt-6 text-[#12243A] sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A6A10]">Compétence</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Mes demandes de cours</h1></div>
        <div className="flex flex-wrap gap-2">
          <Link href="/client/historique" className="inline-flex min-h-11 items-center rounded-xl border border-[#DCE2E8] bg-white px-4 text-sm font-semibold text-[#092A55]">Historique</Link>
          <Link href="/client/trouver" className="inline-flex min-h-11 items-center rounded-xl bg-[#092A55] px-4 text-sm font-semibold text-white">Trouver un professeur</Link>
        </div>
      </div>
      <div className="mt-8 divide-y divide-[#E3E7EB] border-y border-[#E3E7EB]">
        {requests.length ? requests.map((request) => (
          <Link key={request.id} href={`/client/demandes/${request.id}`} className="flex items-center justify-between gap-4 py-5 transition hover:bg-[#F8FAFB]">
            <span><strong className="block text-sm">{request.subjectName} · {request.levelName}{request.status === "OFFERED" && request.series && <> · Suivi de {request.series.requests.length} dates</>}</strong><span className="mt-1 block text-xs text-[#526174]">{request.scheduledDate.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })} à {request.scheduledTime} · {formatMarketplaceDuration(request.durationMinutes)} · {request.assignedTeacher?.professionalName || request.assignedTeacher?.fullName || "Professeur en recherche"}</span></span>
            <span className="shrink-0 text-right"><span className="block text-xs font-semibold text-[#092A55]">{STATUS[request.status]}</span><span className="mt-1 block text-xs text-[#526174]">{new Intl.NumberFormat("fr-FR").format(request.status === "OFFERED" && request.series ? request.series.requests.reduce((sum, session) => sum + session.totalClientPrice, 0) : request.totalClientPrice)} F</span></span>
          </Link>
        )) : <div className="py-14 text-center text-sm text-[#526174]">Aucune demande en cours. Vos cours terminés sont dans l’historique.</div>}
      </div>
      {total > PAGE_SIZE && <nav aria-label="Pages des demandes" className="mt-6 flex items-center justify-between gap-3 text-sm font-semibold text-[#092A55]">
        {page > 1 ? <Link href={`/client/demandes?page=${page - 1}`} className="rounded-xl border border-[#DCE2E8] px-4 py-3">Précédent</Link> : <span />}
        <span className="text-[#526174]">{Math.min(page, Math.ceil(total / PAGE_SIZE))} / {Math.ceil(total / PAGE_SIZE)}</span>
        {page * PAGE_SIZE < total ? <Link href={`/client/demandes?page=${page + 1}`} className="rounded-xl border border-[#DCE2E8] px-4 py-3">Suivant</Link> : <span />}
      </nav>}
    </main>
  );
}
