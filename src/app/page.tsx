import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarCheck,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { TeacherCard } from "@/components/shared/teacher-card";
import { db } from "@/lib/db";
import { formatFCFA } from "@/lib/format";
import { getCachedTeacherSearchCatalog } from "@/lib/catalog-cache";
import {
  OFFICIAL_ACADEMIC_PRICING,
  PROFESSIONAL_SESSION_PRICE,
  SERVICE_TRACKS,
} from "@/lib/service-offers";

export const dynamic = "force-dynamic";

const TRACK_ICONS = {
  ivoirien: GraduationCap,
  francais: BookOpenCheck,
  professionnel: BriefcaseBusiness,
};

const STEPS = [
  {
    number: "01",
    icon: BookOpenCheck,
    title: "Choisissez votre parcours",
    text: "Ivoirien, français ou professionnel.",
  },
  {
    number: "02",
    icon: BadgeCheck,
    title: "Sélectionnez un professeur",
    text: "Consultez uniquement des profils vérifiés.",
  },
  {
    number: "03",
    icon: CalendarCheck,
    title: "Réservez votre séance",
    text: "Indiquez la classe, le créneau et le lieu.",
  },
];

export default async function HomePage() {
  const catalog = await getCachedTeacherSearchCatalog();
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
    _count: { reviews: teacher._count.reviews },
  }));

  return (
    <PublicLayout>
      <section className="border-b border-[#E5E8F0] bg-[#F7F8FC]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#111B4D]">
              <ShieldCheck className="h-4 w-4" />
              Cours privés en Côte d’Ivoire
            </p>
            <h1 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.035em] text-[#111827] sm:text-5xl lg:text-6xl">
              Le bon professeur, sans complication.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#596579] sm:text-lg">
              Choisissez votre parcours, votre professeur et votre créneau. Le prix exact est calculé avant le paiement.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 min-[430px]:flex-row">
              <Link
                href="#parcours"
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#111B4D] px-6 text-sm font-semibold text-white transition hover:bg-[#1E2A78]"
              >
                Réserver un cours <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/tarifs"
                className="inline-flex min-h-13 items-center justify-center rounded-xl border border-[#CBD3E2] bg-white px-6 text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
              >
                Voir les tarifs
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="parcours" className="scroll-mt-24 border-b border-[#E5E8F0] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#111B4D]">Commencez ici</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#111827] sm:text-4xl">
              Quel accompagnement recherchez-vous ?
            </h2>
            <p className="mt-3 text-base leading-7 text-[#64748B]">Un seul choix suffit pour afficher les professeurs adaptés.</p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {SERVICE_TRACKS.map((track) => {
              const Icon = TRACK_ICONS[track.value];
              const prices = track.value === "professionnel" ? [] : OFFICIAL_ACADEMIC_PRICING[track.value];
              return (
                <article
                  key={track.value}
                  className="flex min-h-full flex-col rounded-2xl border border-[#DDE2EC] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#111B4D] sm:p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111B4D] text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#69758A]">{track.eyebrow}</span>
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-[#111827]">{track.title}</h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-[#64748B]">{track.description}</p>

                  {track.value === "professionnel" ? (
                    <div className="mt-5 rounded-xl bg-[#F7F8FC] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Une séance</p>
                      <p className="mt-1 text-2xl font-semibold text-[#111827]">{formatFCFA(PROFESSIONAL_SESSION_PRICE)}</p>
                    </div>
                  ) : (
                    <dl className="mt-5 divide-y divide-[#E5E8F0] rounded-xl bg-[#F7F8FC] px-4">
                      {prices.map((price) => (
                        <div key={price.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <dt className="font-medium text-[#596579]">{price.label}</dt>
                          <dd className="font-semibold tabular-nums text-[#111827]">{formatFCFA(price.amount)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <Link
                    href={`/professeurs?parcours=${track.value}`}
                    className="mt-5 inline-flex min-h-12 items-center justify-between rounded-xl border border-[#CBD3E2] px-4 text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
                  >
                    Choisir ce parcours <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {featuredCards.length > 0 && (
        <section className="border-b border-[#E5E8F0] bg-[#F7F8FC]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#111B4D]">Profils vérifiés</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">Quelques professeurs disponibles</h2>
              </div>
              <Link href="/professeurs" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#111B4D]">
                Voir tous les professeurs <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featuredCards.map((teacher) => (
                <TeacherCard key={teacher.id} teacher={teacher} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#111B4D]">Simple et sécurisé</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#111827]">Trois étapes. Rien de plus.</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="rounded-2xl border border-[#DDE2EC] p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <step.icon className="h-5 w-5 text-[#111B4D]" />
                  <span className="text-sm font-semibold text-[#A0A9B8]">{step.number}</span>
                </div>
                <h3 className="mt-5 text-base font-semibold text-[#111827]">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#64748B]">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-between gap-4 rounded-2xl bg-[#111B4D] p-6 text-center text-white sm:flex-row sm:text-left">
            <div>
              <p className="font-semibold">Paiement protégé et suivi du cours</p>
              <p className="mt-1 text-sm text-[#DDE3F2]">Le total est affiché avant paiement, transport compris.</p>
            </div>
            <Link href="/professeurs" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[#111B4D]">
              Trouver un professeur <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
