import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/session";
import { marketplaceEnabled } from "@/lib/marketplace-core";

const STATUS: Record<string, string> = {
  SEARCHING: "Recherche en cours", OFFERED: "En attente du professeur",
  ACCEPTED: "Professeur confirmé", IN_PROGRESS: "Cours en cours",
  AWAITING_CLIENT: "Fin à confirmer", COMPLETED: "Cours terminé",
  CANCELLED: "Annulé", EXPIRED: "Aucun professeur disponible", DISPUTED: "Litige en cours",
};

export default async function ClientDemandesPage() {
  if (!marketplaceEnabled()) redirect("/client");
  const client = await requireClient();
  const requests = await db.marketplaceRequest.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, reference: true, subjectName: true, levelName: true,
      scheduledDate: true, scheduledTime: true, totalClientPrice: true, status: true,
      assignedTeacher: { select: { fullName: true, professionalName: true } },
    },
  });
  return (
    <main className="mx-auto max-w-4xl bg-white px-4 pb-12 pt-6 text-[#12243A] sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A6A10]">Compétence</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Mes demandes de cours</h1></div>
        <Link href="/client/trouver" className="rounded-xl bg-[#092A55] px-4 py-3 text-sm font-semibold text-white">Trouver un professeur</Link>
      </div>
      <div className="mt-8 divide-y divide-[#E3E7EB] border-y border-[#E3E7EB]">
        {requests.length ? requests.map((request) => (
          <Link key={request.id} href={`/client/demandes/${request.id}`} className="flex items-center justify-between gap-4 py-5 transition hover:bg-[#F8FAFB]">
            <span><strong className="block text-sm">{request.subjectName} · {request.levelName}</strong><span className="mt-1 block text-xs text-[#526174]">{request.scheduledDate.toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" })} à {request.scheduledTime} · {request.assignedTeacher?.professionalName || request.assignedTeacher?.fullName || "Professeur en recherche"}</span></span>
            <span className="shrink-0 text-right"><span className="block text-xs font-semibold text-[#092A55]">{STATUS[request.status]}</span><span className="mt-1 block text-xs text-[#526174]">{new Intl.NumberFormat("fr-FR").format(request.totalClientPrice)} F</span></span>
          </Link>
        )) : <div className="py-14 text-center text-sm text-[#526174]">Aucune demande pour le moment.</div>}
      </div>
    </main>
  );
}
