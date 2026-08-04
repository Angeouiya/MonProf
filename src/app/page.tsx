import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Check, GraduationCap, MapPin, ShieldCheck, WalletCards } from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { TeacherCard } from "@/components/shared/teacher-card";
import { db } from "@/lib/db";
import { formatFCFA } from "@/lib/format";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";

export const dynamic = "force-dynamic";

const JOURNEYS = [
  {
    title: "Système ivoirien",
    detail: "CP1 à Terminale",
    price: "Dès 15 000 F",
    icon: GraduationCap,
    href: "/professeurs?journey=ivoirien",
  },
  {
    title: "Système français",
    detail: "CP1 à Terminale",
    price: "Dès 37 500 F",
    icon: GraduationCap,
    href: "/professeurs?journey=francais",
  },
  {
    title: "Professionnel",
    detail: "Une compétence précise",
    price: "40 000 F / séance",
    icon: BriefcaseBusiness,
    href: "/professeurs?journey=professionnel",
  },
] as const;

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
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#F1F4FF] px-3 py-2 text-xs font-semibold text-[#111B4D]">
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

      <section id="parcours" className="scroll-mt-20 bg-[#F8FAFD]">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
          <div className="text-center">
            <p className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B] sm:block">Une seule question pour commencer</p>
            <h2 className="text-xl font-semibold text-[#111827] sm:mt-3 sm:text-3xl">Votre parcours</h2>
          </div>
          <div className="mt-4 grid gap-2 sm:mt-8 sm:gap-4 md:grid-cols-3">
            {JOURNEYS.map(({ title, detail, price, icon: Icon, href }) => (
              <Link
                key={title}
                href={href}
                className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#DDE3EE] bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-[#111B4D] hover:shadow-sm md:block md:rounded-3xl md:p-6"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F1F4FF] text-[#111B4D] md:h-12 md:w-12 md:rounded-2xl">
                  <Icon className="h-5 w-5 md:h-6 md:w-6" />
                </span>
                <div className="min-w-0 md:mt-5">
                  <h3 className="text-base font-semibold text-[#111827] md:text-lg">{title}</h3>
                  <p className="mt-0.5 text-xs text-[#64748B] md:mt-1 md:text-sm">{detail}</p>
                  <p className="mt-1.5 text-sm font-semibold text-[#111B4D] md:hidden">{price}</p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-[#111B4D] transition group-hover:translate-x-1 md:hidden" />
                <div className="mt-6 hidden items-center justify-between gap-3 md:flex">
                  <span className="text-sm font-semibold text-[#111B4D]">{price}</span>
                  <ArrowRight className="h-5 w-5 text-[#111B4D] transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
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
          <h2 className="text-3xl font-semibold">Prêt à commencer ?</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#DDE6F7]">Trois choix suffisent pour lancer votre recherche.</p>
          <Link href="#parcours" className="mt-7 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-white px-7 text-base font-semibold text-[#111B4D]">
            Trouver un professeur <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
