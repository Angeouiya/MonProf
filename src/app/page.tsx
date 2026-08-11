import Link from "next/link";
import { ArrowRight, Check, MapPin, ShieldCheck, WalletCards } from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { JourneySwitcher } from "@/components/shared/journey-switcher";
import { TeacherCard } from "@/components/shared/teacher-card";
import { db } from "@/lib/db";
import { formatFCFA } from "@/lib/format";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";

export const dynamic = "force-dynamic";

const HOME_JOURNEY_HREFS = {
  ivoirien: "/professeurs?journey=ivoirien",
  francais: "/professeurs?journey=francais",
  professionnel: "/professeurs?journey=professionnel",
} as const;

const IVORIAN_RATES = [
  ["CP1 à CM1", 15_000],
  ["CM2 à 4e", 20_000],
  ["3e à 1ère", 25_000],
  ["Terminale", 30_000],
] as const;

export default async function HomePage() {
  const catalog = await getCachedTeacherSearchCatalog().catch(() => ({
    teacherCount: 0,
    subjects: [],
    levels: [],
    communes: [],
  }));
  const featured = catalog.teacherCount > 0
    ? await db.teacher.findMany({
        where: { status: "ACTIVE", featured: true, AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] },
        take: 3,
        select: {
          id: true,
          fullName: true,
          professionalName: true,
          photoUrl: true,
          coverUrl: true,
          jobTitle: true,
          rating: true,
          ratingCount: true,
          experienceYears: true,
          adminRating: true,
          adminRatingPublic: true,
          offersHome: true,
          offersOnline: true,
          commune: true,
          badgeVerified: true,
          subjects: { select: { isPrimary: true, subject: { select: { name: true } } } },
          _count: { select: { reviews: true } },
        },
        orderBy: [{ rating: "desc" }],
      })
    : [];

  const featuredCards = featured.map((teacher) => ({
    ...teacher,
    primarySubject: teacher.subjects.find((subject) => subject.isPrimary)?.subject.name
      ?? teacher.subjects[0]?.subject.name,
  }));

  return (
    <PublicLayout>
      <section className="flex min-h-[calc(100dvh-var(--app-topbar-height)-7.25rem)] items-center border-b border-[#E3E8F2] bg-white sm:block sm:min-h-0">
        <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-5 text-center sm:px-6 sm:pb-16 sm:pt-10 lg:px-8 lg:pb-20">
          <nav
            id="parcours"
            aria-label="Choisir une mini-application"
            data-home-journey-tabs
            className="mx-auto max-w-5xl scroll-mt-20 text-left"
          >
            <JourneySwitcher
              activeJourney="ivoirien"
              hrefs={HOME_JOURNEY_HREFS}
              label="Système"
              showLabel
              showMeta
              size="hero"
            />
          </nav>
          <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-[#F1F4FF] px-3 py-2 text-xs font-semibold text-[#111B4D] sm:mt-9">
            <ShieldCheck className="h-4 w-4" />
            <span className="sm:hidden">Professeurs vérifiés</span>
            <span className="hidden sm:inline">Professeurs vérifiés en Côte d'Ivoire</span>
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-[2rem] font-semibold leading-[1.08] tracking-tight text-[#111827] sm:mt-6 sm:text-5xl lg:text-6xl">
            Trouvez votre professeur.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#64748B] sm:mt-5 sm:text-lg sm:leading-7">
            Choisissez un parcours. On calcule le reste.
          </p>
          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-[#F8FAFD] px-3 py-2 text-xs font-semibold text-[#475569] sm:hidden">
            <Check className="h-4 w-4 shrink-0 text-[#111B4D]" />
            <span>Prix clair · Paiement sécurisé</span>
          </div>
          <div className="mx-auto mt-6 hidden max-w-2xl flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-[#64748B] sm:flex">
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-[#111B4D]" /> Prix affiché avant paiement</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#111B4D]" /> Transport calculé automatiquement</span>
            <span className="inline-flex items-center gap-1.5"><WalletCards className="h-4 w-4 text-[#111B4D]" /> Paiement Jèko sécurisé</span>
          </div>
        </div>
      </section>

      <section className="hidden border-y border-[#E3E8F2] bg-white sm:block">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:px-8 lg:py-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Tarifs officiels</p>
            <h2 className="mt-3 text-3xl font-semibold text-[#111827]">Le niveau fixe le cours. Le trajet fixe le transport.</h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#64748B]">
              Le professeur ne change pas le prix. Le moteur ajoute uniquement le déplacement éventuel et les frais de service de 3 %, puis affiche le total avant Jèko.
            </p>
            <Link href="/tarifs" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#111B4D]">
              Voir toute la grille <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-3xl border border-[#DDE3EE] bg-white">
            {IVORIAN_RATES.map(([level, rate]) => (
              <div key={level} className="flex items-center justify-between gap-4 border-b border-[#E8ECF3] px-5 py-4 last:border-0 sm:px-6">
                <span className="text-sm font-semibold text-[#111827]">{level}</span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[#111B4D]">{formatFCFA(rate)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {featuredCards.length > 0 && (
        <section className="hidden bg-white sm:block">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Professeurs vérifiés</p>
                <h2 className="mt-3 text-2xl font-semibold text-[#111827] sm:text-3xl">Choisissez en confiance</h2>
              </div>
              <Link href="/professeurs" className="hidden min-h-11 items-center gap-2 text-sm font-semibold text-[#111B4D] sm:inline-flex">
                Tout voir <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredCards.map((teacher) => <TeacherCard key={teacher.id} teacher={teacher} />)}
            </div>
          </div>
        </section>
      )}

      <section className="hidden bg-[#111B4D] text-white sm:block">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold text-white">Prêt à commencer ?</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#DDE6F7]">Trois choix suffisent pour lancer votre recherche.</p>
          <Link href="#parcours" className="mt-7 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-white px-7 text-base font-semibold text-[#111B4D]">
            Trouver un professeur <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
