import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { AdminMarketplaceDisputeActions } from "@/components/marketplace/admin-marketplace-dispute-actions";
import { AdminMarketplaceReviewAction } from "@/components/marketplace/admin-marketplace-review-action";

export const dynamic = "force-dynamic";
const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
const statusLabels: Record<string, string> = {
  OFFERED: "Recherche", ACCEPTED: "Accepté", IN_PROGRESS: "En cours", AWAITING_CLIENT: "À confirmer",
  COMPLETED: "Terminé", DISPUTED: "Litige", EXPIRED: "Sans professeur", CANCELLED: "Annulé",
};

export default async function AdminMarketplacePage() {
  const admin = await requireAdmin("FINANCE_VIEW");
  if (!marketplaceEnabled()) redirect("/admin/paiements");
  const [requests, walletTotals, topUps] = await Promise.all([
    db.marketplaceRequest.findMany({
      orderBy: { createdAt: "desc" }, take: 50,
      include: { client: { select: { name: true } }, assignedTeacher: { select: { fullName: true, professionalName: true } }, review: { select: { id: true, rating: true, comment: true, published: true } } },
    }),
    db.teacherWallet.aggregate({ _sum: { balance: true, reserved: true, available: true } }),
    db.teacherWalletTopUp.aggregate({ where: { status: "VERIFIED" }, _sum: { amount: true } }),
  ]);
  const openDisputes = requests.filter((item) => item.status === "DISPUTED").length;
  return <main className="mx-auto max-w-6xl space-y-7 bg-white px-4 py-6 text-[#12243A] sm:px-7">
    <header><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9A6A10]">Suivi · nouveau parcours</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Missions & portefeuilles</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#526174]">Suivi des offres, cours et recharges Jèko. Les paiements de cours sont convenus directement entre client et professeur : ils ne sont pas encaissés ni vérifiés par Compétence.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[["Solde professeurs", walletTotals._sum.balance ?? 0], ["Disponible", walletTotals._sum.available ?? 0], ["Réservé", walletTotals._sum.reserved ?? 0], ["Recharges confirmées", topUps._sum.amount ?? 0]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#DCE2E8] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#526174]">{label}</p><strong className="mt-2 block text-xl text-[#092A55]">{money(Number(value))}</strong></div>)}
    </div>
    {openDisputes > 0 && <p role="status" className="rounded-xl border border-[#E8DBB7] bg-[#FFFBF2] p-4 text-sm font-semibold text-[#6E4A13]">{openDisputes} litige(s) parmi les 50 dernières missions. Vérifiez les faits et contactez les deux parties avant toute décision comptable.</p>}
    <section>
      <h2 className="text-xl font-semibold">Dernières missions</h2>
      <div className="mt-4 divide-y divide-[#E3E7EB] border-y border-[#E3E7EB]">
        {requests.length ? requests.map((request) => <div key={request.id} className="grid gap-2 py-4 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center">
          <div><Link href={`/admin/marketplace/${request.id}`} className="block font-semibold text-[#092A55] underline-offset-2 hover:underline">{request.reference} · {request.subjectName}</Link><span className="text-[#526174]">{request.client.name} · {request.levelName}</span></div>
          <div><span className="block">{request.assignedTeacher?.professionalName || request.assignedTeacher?.fullName || "Attribution en cours"}</span><span className="text-xs text-[#526174]">{request.scheduledDate.toLocaleDateString("fr-FR", { timeZone: "UTC" })} à {request.scheduledTime}</span></div>
          <div className="sm:text-right"><strong className={request.status === "DISPUTED" ? "text-[#8B2727]" : "text-[#092A55]"}>{statusLabels[request.status] || request.status}</strong><span className="block text-xs text-[#526174]">Commission {money(request.commissionAmount)}</span></div>
          {request.disputeReason && <p className="rounded-xl border border-[#F0C8C8] bg-[#FFF8F8] p-3 text-xs text-[#8B2727] sm:col-span-3">Signalement : {request.disputeReason}</p>}
          {request.review && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#DCE2E8] bg-[#F8FAFB] p-3 text-xs text-[#12243A] sm:col-span-3"><p>Avis client : {request.review.rating}/5{request.review.comment ? ` · ${request.review.comment}` : ""} {request.review.published ? "" : "· Masqué"}</p>{hasAdminPermission(admin.adminPermissions, "REVIEWS_MANAGE") && <AdminMarketplaceReviewAction reviewId={request.review.id} published={request.review.published} />}</div>}
          {request.status === "DISPUTED" && hasAdminPermission(admin.adminPermissions, "DISPUTES_MANAGE") && <AdminMarketplaceDisputeActions requestId={request.id} />}
        </div>) : <p className="py-10 text-center text-sm text-[#526174]">Aucune mission dans le nouveau parcours.</p>}
      </div>
    </section>
    <p className="text-xs text-[#526174]">Les anciennes réservations et leur comptabilité restent accessibles dans <Link href="/admin/paiements" className="font-semibold text-[#092A55] underline">Finances</Link>.</p>
  </main>;
}
