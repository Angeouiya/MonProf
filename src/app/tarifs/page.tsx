import Link from "next/link";
import { managedCoursesEnabled } from "@/lib/managed-courses-core";
import { ManagedTariffs } from "@/components/managed/landing";
import { ArrowRight, Clock3, GraduationCap, MapPin, ShieldCheck, WalletCards } from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { JourneySwitcher } from "@/components/shared/journey-switcher";
import { formatFCFA } from "@/lib/format";
import { marketplaceEnabled } from "@/lib/marketplace-core";
import { formatMarketplaceDuration, marketplaceCourseAmount } from "@/lib/marketplace-pricing";
import { paymentServiceFeeDescription } from "@/lib/payment-service-fees";
import { TRANSPORT_FEES } from "@/lib/pricing";
import { parseTeacherJourney, type TeacherJourney } from "@/lib/teacher-journeys";
export const dynamic = "force-dynamic";

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
  if (managedCoursesEnabled()) return <ManagedTariffs />;
  const sp = await searchParams;
  const activeJourney = parseTeacherJourney(sp.journey) ?? "ivoirien";
  if (marketplaceEnabled()) return <MarketplaceTariffsPage activeJourney={activeJourney} />;
  const activeGrid = PRICE_GRIDS.find((grid) => grid.journey === activeJourney) ?? PRICE_GRIDS[0];
  const teacherHref = `/professeurs?journey=${activeJourney}`;

  return (
    <PublicLayout activeJourney={activeJourney} marketplaceMode={false}>
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

const MARKETPLACE_LEVELS: Record<TeacherJourney, ReadonlyArray<readonly [string, string]>> = {
  ivoirien: [
    ["CP1 à CM1", "CP1"],
    ["CM2 à 4e", "CM2"],
    ["3e à 1re", "3e"],
    ["Terminale", "Terminale"],
  ],
  francais: [
    ["CP à CM1", "CP"],
    ["CM2 à 4e", "CM2"],
    ["3e à 1re", "3e"],
    ["Terminale", "Terminale"],
  ],
  professionnel: [["Formation professionnelle", "Formation adulte"]],
};

function MarketplaceTariffsPage({ activeJourney }: { activeJourney: TeacherJourney }) {
  const rows = MARKETPLACE_LEVELS[activeJourney];
  const firstLevel = rows[0][1];

  return (
    <PublicLayout activeJourney={activeJourney} marketplaceMode>
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10 text-center sm:px-6 lg:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#966B24]">Tarif officiel · nouveau parcours</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#111827] sm:text-5xl">Une heure pour commencer.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#475569] sm:text-base">Choisissez la durée qui vous convient. Le prix du cours évolue par pas de 5 minutes et le total est affiché avant d’envoyer votre demande.</p>
        </div>
      </section>

      <section className="bg-[#F8FAFD] px-4 py-8 sm:px-6 lg:py-12">
        <div className="mx-auto max-w-5xl">
          <JourneySwitcher activeJourney={activeJourney} hrefs={TARIFF_JOURNEY_HREFS} label="Système" showLabel size="regular" />
          <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <article className="overflow-hidden rounded-2xl border border-[#DCE2E8] bg-white" data-tariff-active-grid={activeJourney}>
              <div className="border-b border-[#E8ECF3] p-5 sm:p-6">
                <h2 className="text-xl font-semibold text-[#111827]">{activeJourney === "ivoirien" ? "Système ivoirien" : activeJourney === "francais" ? "Système français" : "Professionnel"}</h2>
                <p className="mt-1 text-sm text-[#526174]">Prix par séance individuelle, pour un élève. Le déplacement éventuel s’ajoute uniquement à domicile.</p>
              </div>
              <div className="divide-y divide-[#E8ECF3]">
                {rows.map(([label, level]) => (
                  <div key={label} className="p-5 sm:px-6" data-marketplace-tariff-level={label}>
                    <h3 className="text-sm font-semibold text-[#12243A]">{label}</h3>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      {(["ONLINE", "HOME"] as const).flatMap((format) => ([60, 120] as const).map((minutes) => (
                        <div key={`${format}-${minutes}`} className="rounded-xl bg-[#F6F8FB] p-3">
                          <p className="text-xs text-[#526174]">{format === "ONLINE" ? "En ligne" : "À domicile"} · {minutes / 60} h</p>
                          <p className="mt-1 font-bold tabular-nums text-[#092A55]">{formatFCFA(marketplaceCourseAmount(activeJourney, level, format, minutes))}</p>
                        </div>
                      )))}
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <aside className="h-fit rounded-2xl border border-[#DCE2E8] bg-white p-5">
              <Clock3 className="h-6 w-6 text-[#092A55]" />
              <h2 className="mt-3 text-lg font-semibold text-[#12243A]">Plus de temps, prix ajusté</h2>
              <p className="mt-2 text-sm leading-6 text-[#526174]">Exemple à domicile pour {rows[0][0]} :</p>
              <div className="mt-4 space-y-2 text-sm">
                {[60, 75, 80, 95, 120, 150, 180].map((duration) => (
                  <TariffExample key={duration} label={formatMarketplaceDuration(duration)} amount={marketplaceCourseAmount(activeJourney, firstLevel, "HOME", duration)} />
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-[#526174]">En ligne : aucun déplacement. À domicile : déplacement éventuel indiqué après le choix du professeur. Le cours peut durer de 1 h à 6 h et se termine au plus tard à 22 h.</p>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-12 text-center sm:px-6">
        <h2 className="text-2xl font-semibold text-[#12243A]">Choisissez votre durée.</h2>
        <Link href={`/trouver?journey=${activeJourney}`} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#092A55] px-6 text-sm font-semibold text-white">Trouver un professeur <ArrowRight className="h-4 w-4" /></Link>
      </section>
    </PublicLayout>
  );
}

function TariffExample({ label, amount }: { label: string; amount: number }) {
  return <div className="flex items-center justify-between gap-4 border-b border-[#E8ECF3] py-2 last:border-0"><span>{label}</span><strong className="tabular-nums text-[#092A55]">{formatFCFA(amount)}</strong></div>;
}
