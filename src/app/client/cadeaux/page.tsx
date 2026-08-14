import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Gift, Route, ShieldCheck, TimerReset } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getClientLoyaltyOverview } from "@/lib/loyalty-program";
import { Button } from "@/components/ui/button";
import { GiftRoad } from "./gift-road";

export const dynamic = "force-dynamic";

export default async function ClientGiftsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== "CLIENT") redirect("/connexion");
  const clientId = (session.user as { id: string }).id;
  const overview = await getClientLoyaltyOverview(clientId);
  const nextGiftLabel = overview.programCompleted
    ? "Parcours terminé"
    : overview.paymentsUntilNextGift <= 1
      ? "Dans 1 paiement"
      : `Dans ${overview.paymentsUntilNextGift} paiements`;

  return (
    <main className="space-y-5" data-client-gifts-page>
      <header className="rounded-xl border border-[#DDE6F7] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#B47C00]">Cadeaux Compétence</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#111827] sm:text-4xl">Ramassez vos cadeaux sur une route infinie.</h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-[#64748B]">
              Chaque cadeau arrive après 1 à 3 paiements Jèko confirmés. La réduction s’applique automatiquement au cours suivant.
            </p>
          </div>
          <Button asChild className="min-h-12 rounded-xl px-5">
            <Link href="/client/rechercher">Continuer la route</Link>
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-1.5 sm:gap-2" data-gift-compact-metrics>
        <Metric icon={Route} label="Progression" value={`${overview.qualifiedPaymentCount} paiement${overview.qualifiedPaymentCount > 1 ? "s" : ""} validé${overview.qualifiedPaymentCount > 1 ? "s" : ""}`} />
        <Metric icon={Gift} label="Prochain cadeau" value={nextGiftLabel} />
        <Metric icon={TimerReset} label="Cadeau actif" value={overview.activeReward ? `-${overview.activeReward.discountRate} %` : "Aucun pour le moment"} />
      </section>

      {overview.activeReward && (
        <section className="rounded-xl border border-[#E8D7A0] bg-[#FFF9E8] p-4 text-[#6B4F00]" data-active-gift>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white"><Gift className="h-5 w-5" /></span>
            <div>
              <h2 className="text-base font-black">-{overview.activeReward.discountRate} % sur votre prochain cours</h2>
              <p className="mt-1 text-sm font-semibold leading-6">Utilisable automatiquement jusqu’au {formatDate(overview.activeReward.expiresAt)}. Les frais de transport, de service et Jèko restent séparés.</p>
            </div>
          </div>
        </section>
      )}

      <GiftRoad
        cycle={overview.cycle}
        cycleEnabled={overview.config.cycleEnabled}
        qualifiedPaymentCount={overview.qualifiedPaymentCount}
        steps={overview.config.steps}
      />

      <section className="flex items-start gap-3 rounded-xl border border-[#DDE6F7] bg-white p-4 text-sm font-semibold leading-6 text-[#475569]">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" />
        <p>Un seul cadeau est utilisé par paiement. Votre meilleur avantage disponible s’applique automatiquement au prochain cours éligible.</p>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gift; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#DDE6F7] bg-white px-2 py-2.5 sm:px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#111B4D] sm:h-4 sm:w-4" />
        <p className="min-w-0 truncate text-[9px] font-black uppercase tracking-[0.04em] text-[#64748B] sm:text-[10px]">{label}</p>
      </div>
      <p className="mt-1.5 text-[11px] font-black leading-tight text-[#111827] sm:text-sm">{value}</p>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}
