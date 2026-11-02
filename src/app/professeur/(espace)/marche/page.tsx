import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/teacher-auth";
import { marketplaceEnabled } from "@/lib/marketplace-core";

const money = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value)} F`;

export default async function MarcheProfesseurPage() {
  if (!marketplaceEnabled()) redirect("/professeur/missions");
  const { teacher } = await requireTeacher();
  const [offers, wallet] = await Promise.all([
    db.marketplaceOffer.findMany({
      where: { teacherId: teacher.id, status: { in: ["PENDING", "ACCEPTED"] } },
      orderBy: { offeredAt: "desc" },
      take: 30,
      include: { request: { select: {
        id: true, subjectName: true, levelName: true, journey: true, courseFormat: true,
        commune: true, quartier: true, scheduledDate: true, scheduledTime: true,
        durationMinutes: true, commissionAmount: true, status: true,
      } } },
    }),
    db.teacherWallet.findUnique({ where: { teacherId: teacher.id } }),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-7 bg-white px-4 py-6 text-[#12243A] sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#9A6A10]">Nouveau parcours</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Missions proposées</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[#526174]">Vous choisissez les missions qui correspondent à votre planning. La commission est réservée à l’acceptation puis prélevée au démarrage confirmé.</p></div>
        <Link href="/professeur/portefeuille" className="rounded-xl border border-[#DCE2E8] px-4 py-3 text-sm font-semibold text-[#092A55]">Portefeuille · {money(wallet?.available ?? 0)}</Link>
      </div>
      <div className="divide-y divide-[#E3E7EB] border-y border-[#E3E7EB]">
        {offers.length ? offers.map((offer) => (
          <Link href={`/professeur/marche/${offer.requestId}`} key={offer.id} className="flex flex-wrap items-center justify-between gap-4 py-5 transition hover:bg-[#F8FAFB]">
            <span><span className="text-xs font-semibold text-[#9A6A10]">{offer.status === "PENDING" ? "Nouvelle proposition" : "Mission acceptée"}</span><strong className="mt-1 block text-base">{offer.request.subjectName} · {offer.request.levelName}</strong><span className="mt-1 block text-xs text-[#526174]">{offer.request.scheduledDate.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long" })} à {offer.request.scheduledTime} · {offer.request.courseFormat === "ONLINE" ? "En ligne" : `${offer.request.quartier}, ${offer.request.commune}`}</span></span>
            <span className="text-right"><strong className="block text-sm">{money(offer.totalClientPrice)}</strong><span className="mt-1 block text-xs text-[#526174]">Commission : {money(offer.request.commissionAmount)}</span></span>
          </Link>
        )) : <div className="py-14 text-center text-sm text-[#526174]">Aucune proposition active pour le moment.</div>}
      </div>
    </div>
  );
}
