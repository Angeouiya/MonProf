import Link from "next/link";
import { ArrowRight, GraduationCap, MapPin, ShieldCheck, WalletCards } from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { JourneySwitcher } from "@/components/shared/journey-switcher";
import { formatFCFA } from "@/lib/format";
import { paymentServiceFeeDescription } from "@/lib/payment-service-fees";
import { TRANSPORT_FEES } from "@/lib/pricing";
import { parseTeacherJourney, type TeacherJourney } from "@/lib/teacher-journeys";

const PRICE_GRIDS: Array<{
  journey: TeacherJourney;
  id: string;
  title: string;
  shortLabel: string;
  summaryPrice: string;
  subtitle: string;
  rates: ReadonlyArray<readonly [string, number]>;
}> = [
  {
    journey: "ivoirien",
    id: "tarif-ivoirien",
    title: "Système ivoirien",
    shortLabel: "Ivoirien",
    summaryPrice: "Dès 15 000 F",
    subtitle: "Tarif par séance de 2h",
    rates: [
      ["CP1 à CM1", 15_000],
      ["CM2 à 4e", 20_000],
      ["3e à 1ère", 25_000],
      ["Terminale", 30_000],
    ],
  },
  {
    journey: "francais",
    id: "tarif-francais",
    title: "Système français",
    shortLabel: "Français",
    summaryPrice: "Dès 37 500 F",
    subtitle: "Tarif par séance de 2h",
    rates: [
      ["CP1 à CM1", 37_500],
      ["CM2 à 4e", 50_000],
      ["3e à 1ère", 62_500],
      ["Terminale", 75_000],
    ],
  },
  {
    journey: "professionnel",
    id: "tarif-professionnel",
    title: "Professionnel",
    shortLabel: "Pro",
    summaryPrice: "40 000 F",
    subtitle: "Tarif unique par séance de 2h",
    rates: [
      ["Formation ou apprentissage métier", 40_000],
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

const TARIFF_JOURNEY_HREFS = {
  ivoirien: "/tarifs?journey=ivoirien",
  francais: "/tarifs?journey=francais",
  professionnel: "/tarifs?journey=professionnel",
} as const;

export default async function TarifsPage({
  searchParams,
}: {
  searchParams: Promise<{ journey?: string }>;
}) {
  const sp = await searchParams;
  const activeJourney = parseTeacherJourney(sp.journey) ?? "ivoirien";
  const activeGrid = PRICE_GRIDS.find((grid) => grid.journey === activeJourney) ?? PRICE_GRIDS[0];
  const teacherHref = `/professeurs?journey=${activeJourney}`;

  return (
    <PublicLayout activeJourney={activeJourney}>
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10 text-center sm:px-6 lg:px-8 lg:py-16">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#F1F4FF] px-3 py-2 text-xs font-semibold text-[#111B4D]">
            <ShieldCheck className="h-4 w-4" /> Tarif officiel
          </p>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#111827] sm:text-5xl">Prix simples.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#64748B] sm:text-base sm:leading-7">
            Choisissez un système. Compétence calcule le cours, le déplacement et le total avant Jèko.
          </p>
        </div>
      </section>

      <section className="bg-[#F8FAFD]">
        <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8 lg:py-12">
          <nav className="mx-auto mb-8 max-w-4xl" aria-label="Choisir une grille tarifaire">
            <JourneySwitcher
              activeJourney={activeJourney}
              hrefs={TARIFF_JOURNEY_HREFS}
              label="Système"
              showLabel
              size="regular"
            />
          </nav>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <article
              id={activeGrid.id}
              key={activeGrid.id}
              className="scroll-mt-24 overflow-hidden rounded-lg border border-[#CAD7F2] bg-white shadow-sm"
              data-tariff-active-grid={activeGrid.journey}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[#E8ECF3] p-5 sm:p-6">
                <div>
                  <GraduationCap className="h-6 w-6 text-[#111B4D]" />
                  <h2 className="mt-4 text-xl font-semibold text-[#111827]">{activeGrid.title}</h2>
                  <p className="mt-1 text-sm font-medium text-[#475569]">{activeGrid.subtitle}</p>
                </div>
                <p className="shrink-0 rounded-lg bg-[#F1F4FF] px-3 py-2 text-sm font-bold tabular-nums text-[#111B4D]">
                  {activeGrid.summaryPrice}
                </p>
              </div>
              {activeGrid.rates.map(([level, amount]) => (
                <div key={level} className="flex items-center justify-between gap-4 border-b border-[#E8ECF3] px-5 py-4 last:border-0 sm:px-6">
                  <span className="text-sm font-semibold text-[#111827]">{level}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-[#111B4D]">{formatFCFA(amount)}</span>
                </div>
              ))}
            </article>

            <aside className="rounded-lg border border-[#E3E8F2] bg-white p-5" data-tariff-total-card>
              <WalletCards className="h-6 w-6 text-[#111B4D]" />
              <h2 className="mt-4 text-lg font-semibold text-[#111827]">Total avant paiement</h2>
              <div className="mt-4 grid gap-2">
                {[
                  ["Cours", activeGrid.summaryPrice],
                  ["Transport", "0 F si en ligne ou même quartier"],
                  ["Service", paymentServiceFeeDescription()],
                  ["Jèko", "Montant exact envoyé"],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-lg bg-[#F6F8FC] px-3 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{title}</p>
                    <p className="mt-1 text-sm font-semibold text-[#111827]">{text}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-y border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-9 sm:px-6 lg:px-8 lg:py-14">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Déplacement</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#111827] sm:text-3xl">Le quartier compte.</h2>
            <p className="mt-3 text-sm leading-6 text-[#64748B]">
              Mermoz et Cocody Mermoz désignent le même quartier : le transport est donc à 0 F. Deux quartiers différents dans Cocody appliquent le forfait de la même commune.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(TRANSPORT_FEES).map((fee) => (
              <div key={fee.key} className="rounded-lg border border-[#DDE3EE] bg-white p-4">
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

      <section className="bg-white">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-[#111827] sm:text-3xl">Choisissez votre professeur</h2>
          <Link href={teacherHref} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#111B4D] px-6 text-sm font-semibold text-white sm:min-h-14 sm:px-7 sm:text-base">
            Trouver un professeur <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
