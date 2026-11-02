import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { hasAdminPermission } from "@/lib/admin-permissions";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { AdminMarketplaceDisputeActions } from "@/components/marketplace/admin-marketplace-dispute-actions";
import { AdminMarketplaceReviewAction } from "@/components/marketplace/admin-marketplace-review-action";

export const dynamic = "force-dynamic";
const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
const statusLabels: Record<string, string> = {
  SEARCHING: "Recherche", OFFERED: "Proposition envoyée", ACCEPTED: "Acceptée",
  IN_PROGRESS: "En cours", AWAITING_CLIENT: "À confirmer", COMPLETED: "Terminée",
  CANCELLED: "Annulée", EXPIRED: "Sans professeur", DISPUTED: "En litige",
};
const offerLabels: Record<string, string> = {
  QUEUED: "En attente", PENDING: "Proposée", ACCEPTED: "Acceptée",
  DECLINED: "Refusée", EXPIRED: "Expirée", REVOKED: "Retirée",
};
type Context = { params: Promise<{ id: string }> };

export default async function AdminMarketplaceMissionPage({ params }: Context) {
  const admin = await requireAdmin("FINANCE_VIEW");
  if (!marketplaceEnabled()) redirect("/admin/paiements");
  const { id } = await params;
  const mission = await db.marketplaceRequest.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, email: true, phone: true } },
      assignedTeacher: { select: { fullName: true, professionalName: true, phone: true } },
      offers: { orderBy: { rank: "asc" }, include: { teacher: { select: { fullName: true, professionalName: true } } } },
      review: { select: { id: true, rating: true, comment: true, published: true } },
    },
  });
  if (!mission) notFound();
  return <main className="mx-auto max-w-4xl space-y-6 bg-white px-4 py-6 text-[#12243A] sm:px-7">
    <Link href="/admin/marketplace" className="text-sm font-semibold text-[#092A55]">← Toutes les missions</Link>
    <header><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9A6A10]">Mission {mission.reference}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{mission.subjectName} · {mission.levelName}</h1><p className="mt-2 text-sm text-[#526174]">{mission.journey} · {statusLabels[mission.status] || mission.status} · {mission.scheduledDate.toLocaleDateString("fr-FR", { timeZone: "UTC" })} à {mission.scheduledTime} · {mission.durationMinutes} min</p></header>
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Montants de la mission">
      {[["Cours", mission.courseAmount], ["Transport prévu", mission.transportFee], ["Commission Compétence", mission.commissionAmount]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#DCE2E8] p-5"><p className="text-xs font-semibold uppercase tracking-wider text-[#526174]">{label}</p><strong className="mt-2 block text-xl text-[#092A55]">{money(Number(value))}</strong></div>)}
    </section>
    <section className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[#DCE2E8] p-5"><h2 className="font-semibold">Client</h2><p className="mt-3 text-sm">{mission.client.name}</p><p className="text-sm text-[#526174]">{mission.client.email || mission.client.phone || "Contact absent"}</p><p className="mt-3 text-sm text-[#526174]">{mission.commune || "En ligne"}{mission.quartier ? ` · ${mission.quartier}` : ""}</p></div><div className="rounded-2xl border border-[#DCE2E8] p-5"><h2 className="font-semibold">Professeur attribué</h2><p className="mt-3 text-sm">{mission.assignedTeacher?.professionalName || mission.assignedTeacher?.fullName || "En recherche"}</p><p className="text-sm text-[#526174]">{mission.assignedTeacher?.phone || "Contact non disponible"}</p><p className="mt-3 text-sm text-[#526174]">{mission.courseFormat === "ONLINE" ? "En ligne" : "À domicile"}</p></div></section>
    <section className="rounded-2xl border border-[#DCE2E8] p-5"><h2 className="font-semibold">Propositions aux professeurs</h2><ol className="mt-3 space-y-2 text-sm">{mission.offers.map((offer) => <li key={offer.id} className="flex justify-between gap-3 border-t border-[#E3E7EB] pt-2"><span>{offer.rank + 1}. {offer.teacher.professionalName || offer.teacher.fullName}</span><span className="font-semibold text-[#526174]">{offerLabels[offer.status] || offer.status}</span></li>)}</ol></section>
    {mission.disputeReason && <section className="rounded-2xl border border-[#F0C8C8] bg-[#FFF8F8] p-5"><h2 className="font-semibold text-[#8B2727]">Litige signalé</h2><p className="mt-2 text-sm leading-6">{mission.disputeReason}</p>{mission.disputeResolution && <p className="mt-3 text-sm">Décision : {mission.disputeResolution}</p>}{mission.status === "DISPUTED" && hasAdminPermission(admin.adminPermissions, "DISPUTES_MANAGE") && <div className="mt-4"><AdminMarketplaceDisputeActions requestId={mission.id} /></div>}</section>}
    {mission.review && <section className="rounded-2xl border border-[#DCE2E8] p-5"><h2 className="font-semibold">Avis client · {mission.review.rating}/5</h2><p className="mt-2 text-sm text-[#526174]">{mission.review.comment || "Sans commentaire"} · {mission.review.published ? "Public" : "Masqué"}</p>{hasAdminPermission(admin.adminPermissions, "REVIEWS_MANAGE") && <div className="mt-4"><AdminMarketplaceReviewAction reviewId={mission.review.id} published={mission.review.published} /></div>}</section>}
    <p className="text-xs leading-5 text-[#526174]">Le règlement privé du cours n’est pas encaissé ni vérifié par Compétence. La recharge du portefeuille et la commission sont suivies séparément.</p>
  </main>;
}
