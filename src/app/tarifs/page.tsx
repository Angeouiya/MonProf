import Link from "next/link";
import { ArrowRight, GraduationCap, MapPin, ShieldCheck, WalletCards } from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { formatFCFA } from "@/lib/format";
import { paymentServiceFeeDescription } from "@/lib/payment-service-fees";
import { TRANSPORT_FEES } from "@/lib/pricing";

const PRICE_GRIDS: Array<{
  title: string;
  subtitle: string;
  rates: ReadonlyArray<readonly [string, number]>;
}> = [
  {
    title: "Système ivoirien",
    subtitle: "Tarif par séance de 2h",
    rates: [
      ["CP1 à CM1", 15_000],
      ["CM2 à 4e", 20_000],
      ["3e à 1ère", 25_000],
      ["Terminale", 30_000],
    ],
  },
  {
    title: "Système français",
    subtitle: "Tarif par séance de 2h",
    rates: [
      ["CP1 à CM1", 37_500],
      ["CM2 à 4e", 50_000],
      ["3e à 1ère", 62_500],
      ["Terminale", 75_000],
    ],
  },
];

const TRANSPORT_EXPLANATIONS: Record<string, string> = {
  online: "Cours en ligne : aucun trajet.",
  same_neighborhood: "Professeur et client dans le même quartier exact.",
  same_area: "Même commune, mais quartiers différents.",
  near_commune: "Deux communes proches dans le Grand Abidjan.",
  far_commune: "Deux communes éloignées dans le Grand Abidjan.",
  outside_grand_abidjan: "Ville intérieure ou zone étendue.",
};

export default function TarifsPage() {
  return (
    <PublicLayout>
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-20">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#F1F4FF] px-3 py-2 text-xs font-semibold text-[#111B4D]">
            <ShieldCheck className="h-4 w-4" /> Une grille unique pour tout le monde
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-[#111827] sm:text-5xl">Des prix simples. Aucun prix caché.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#64748B]">
            La classe fixe le prix du cours. Le lieu fixe le transport. Les frais de service sont ajoutés à la fin. Vous voyez tout avant de payer.
          </p>
        </div>
      </section>

      <section className="bg-[#F8FAFD]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid gap-5 lg:grid-cols-2">
            {PRICE_GRIDS.map((grid) => (
              <article key={grid.title} className="overflow-hidden rounded-3xl border border-[#DDE3EE] bg-white">
                <div className="border-b border-[#E8ECF3] p-6">
                  <GraduationCap className="h-6 w-6 text-[#111B4D]" />
                  <h2 className="mt-4 text-xl font-semibold text-[#111827]">{grid.title}</h2>
                  <p className="mt-1 text-sm text-[#64748B]">{grid.subtitle}</p>
                </div>
                {grid.rates.map(([level, amount]) => (
                  <div key={level} className="flex items-center justify-between gap-4 border-b border-[#E8ECF3] px-6 py-4 last:border-0">
                    <span className="text-sm font-semibold text-[#111827]">{level}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[#111B4D]">{formatFCFA(amount)}</span>
                  </div>
                ))}
              </article>
            ))}
          </div>

          <article className="mt-5 rounded-3xl bg-[#111B4D] p-6 text-white sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C8D4F1]">Professionnel</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Une compétence, un tarif</h2>
                <p className="mt-2 text-sm text-[#DDE6F7]">Formation professionnelle ou apprentissage métier.</p>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{formatFCFA(40_000)} <span className="text-sm font-medium text-[#DDE6F7]">/ séance</span></p>
            </div>
          </article>
        </div>
      </section>

      <section className="border-y border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Déplacement</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#111827]">Le quartier compte, pas seulement la commune.</h2>
            <p className="mt-4 text-sm leading-6 text-[#64748B]">
              Mermoz et Cocody Mermoz désignent le même quartier : le transport est donc à 0 F. Deux quartiers différents dans Cocody appliquent le forfait de la même commune.
            </p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(TRANSPORT_FEES).map((fee) => (
              <div key={fee.key} className="rounded-2xl border border-[#DDE3EE] bg-white p-5">
                <MapPin className="h-5 w-5 text-[#111B4D]" />
                <div className="mt-4 flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[#111827]">{fee.label}</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-[#111B4D]">{formatFCFA(fee.amount)}</p>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#64748B]">{TRANSPORT_EXPLANATIONS[fee.key]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#F8FAFD]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="rounded-3xl border border-[#DDE3EE] bg-white p-6 sm:p-8">
            <WalletCards className="h-7 w-7 text-[#111B4D]" />
            <h2 className="mt-5 text-2xl font-semibold text-[#111827]">Le total en quatre lignes</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["1. Cours", "Tarif officiel de la classe ou du parcours"],
                ["2. Transport", "0 F en ligne ou dans le même quartier"],
                ["3. Service", paymentServiceFeeDescription()],
                ["4. Total", "Montant exact envoyé à Jèko"],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl bg-[#F6F8FC] p-4">
                  <p className="text-sm font-semibold text-[#111827]">{title}</p>
                  <p className="mt-2 text-xs leading-5 text-[#64748B]">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold text-[#111827]">Choisissez maintenant votre professeur</h2>
          <Link href="/professeurs" className="mt-7 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-[#111B4D] px-7 text-base font-semibold text-white">
            Trouver un professeur <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
