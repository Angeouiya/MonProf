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
    href: "/professeurs",
  },
  {
    title: "Système français",
    detail: "CP à Terminale",
    price: "Dès 37 500 F",
    icon: GraduationCap,
    href: "/professeurs",
  },
  {
    title: "Professionnel",
    detail: "Une compétence précise",
    price: "40 000 F / séance",
    icon: BriefcaseBusiness,
    href: "/professeurs",
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
        include: {
          subjects: { include: { subject: true } },
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
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-[#F1F4FF] px-3 py-2 text-xs font-semibold text-[#111B4D]">
            <ShieldCheck className="h-4 w-4" /> Professeurs vérifiés en Côte d'Ivoire
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-[#111827] sm:text-5xl lg:text-6xl">
            Trouvez le bon professeur. Simplement.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#64748B] sm:text-lg">
            Choisissez votre parcours, votre classe et votre créneau. Compétence calcule le reste.
          </p>
          <Link
            href="/professeurs"
            className="mx-auto mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#111B4D] px-7 text-base font-semibold text-white transition hover:bg-[#1E2A78]"
          >
            Réserver une séance <ArrowRight className="h-5 w-5" />
          </Link>
          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-[#64748B]">
            <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-[#111B4D]" /> Prix affiché avant paiement</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-[#111B4D]" /> Transport calculé automatiquement</span>
            <span className="inline-flex items-center gap-1.5"><WalletCards className="h-4 w-4 text-[#111B4D]" /> Paiement Jèko sécurisé</span>
          </div>
        </div>
      </section>

      <section className="bg-[#F8FAFD]">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">Une seule question pour commencer</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#111827] sm:text-3xl">Quel parcours cherchez-vous ?</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {JOURNEYS.map(({ title, detail, price, icon: Icon, href }) => (
              <Link
                key={title}
                href={href}
                className="group rounded-3xl border border-[#DDE3EE] bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#111B4D] hover:shadow-sm"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F4FF] text-[#111B4D]">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-[#111827]">{title}</h3>
                <p className="mt-1 text-sm text-[#64748B]">{detail}</p>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#111B4D]">{price}</span>
                  <ArrowRight className="h-5 w-5 text-[#111B4D] transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#E3E8F2] bg-white">
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
        <section className="bg-white">
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

      <section className="bg-[#111B4D] text-white">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold">Prêt à commencer ?</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#DDE6F7]">Trois choix suffisent pour lancer votre recherche.</p>
          <Link href="/professeurs" className="mt-7 inline-flex min-h-14 items-center gap-2 rounded-2xl bg-white px-7 text-base font-semibold text-[#111B4D]">
            Trouver un professeur <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
