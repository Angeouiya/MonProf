import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  BookOpen,
  Languages,
  Atom,
  Leaf,
  Brain,
  Laptop,
  Coins,
  TrendingUp,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Code2,
  Camera,
  Megaphone,
  Music,
  Palette,
  ShieldCheck,
  Wallet,
  WalletCards,
  Wrench,
} from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { HomeSearchBar } from "@/components/home/home-search-bar";
import { TeacherCard } from "@/components/shared/teacher-card";
import { db } from "@/lib/db";
import { formatFCFA } from "@/lib/format";
import { getLevelCategory, getSubjectCategory } from "@/lib/catalog-taxonomy";

const PRICING = [
  { level: "Primaire", price: 7500 },
  { level: "Collège", price: 10000 },
  { level: "Lycée", price: 12500 },
  { level: "Terminale", price: 15000 },
  { level: "Université", price: 20000 },
];

const POPULAR_SUBJECTS = [
  { name: "Mathématiques", slug: "mathematiques", desc: "Primaire à université", icon: Calculator },
  { name: "Français", slug: "francais", desc: "BEPC, BAC, expression", icon: BookOpen },
  { name: "Anglais", slug: "anglais", desc: "Scolaire et professionnel", icon: Languages },
  { name: "Physique-Chimie", slug: "physique-chimie", desc: "BAC C, D, E", icon: Atom },
  { name: "SVT", slug: "svt", desc: "BEPC, BAC D", icon: Leaf },
  { name: "Philosophie", slug: "philosophie", desc: "Terminale, BAC", icon: Brain },
  { name: "Programmation", slug: "programmation", desc: "Web, bases, data", icon: Code2 },
  { name: "Bureautique", slug: "bureautique", desc: "Adultes, pro", icon: Laptop },
  { name: "Comptabilité", slug: "comptabilite", desc: "BAC D2, BTS", icon: Coins },
  { name: "Économie", slug: "economie", desc: "Lycée, université", icon: TrendingUp },
  { name: "Préparation concours", slug: "preparation-concours", desc: "ENA, INFAS, écoles", icon: BadgeCheck },
  { name: "Culture générale", slug: "culture-generale", desc: "Concours, oral", icon: Brain },
  { name: "Marketing digital", slug: "marketing-digital", desc: "Entrepreneurs, adultes", icon: Megaphone },
  { name: "Gestion de projet", slug: "gestion-de-projet", desc: "Pro, BTS, licence", icon: ClipboardList },
  { name: "Arts plastiques", slug: "arts-plastiques", desc: "Dessin, créativité", icon: Palette },
  { name: "Musique", slug: "piano", desc: "Piano, guitare, chant", icon: Music },
  { name: "Photographie", slug: "photographie", desc: "Image, montage", icon: Camera },
  { name: "Technique", slug: "mecanique", desc: "Mécanique, dessin", icon: Wrench },
  { name: "Professionnel", slug: "entrepreneuriat", desc: "Business, gestion", icon: BriefcaseBusiness },
];

const STEPS = [
  {
    icon: BadgeCheck,
    title: "Choisir",
    text: "Profils vérifiés, matière, niveau, commune et format.",
  },
  {
    icon: CalendarCheck,
    title: "Planifier",
    text: "Date, créneau de 2h, objectif et formule.",
  },
  {
    icon: WalletCards,
    title: "Payer",
    text: "PayDunya sécurise le paiement jusqu'au cours.",
  },
  {
    icon: Wallet,
    title: "Confirmer",
    text: "Vous validez le cours avant la clôture.",
  },
];

export default async function HomePage() {
  const [featured, activeTeacherCount, subjects, levels, communes] = await Promise.all([
    db.teacher.findMany({
      where: { status: "ACTIVE", featured: true, AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] },
      take: 6,
      include: {
        subjects: { include: { subject: true } },
        _count: { select: { reviews: true } },
      },
      orderBy: [{ rating: "desc" }],
    }),
    db.teacher.count({
      where: { status: "ACTIVE", AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] },
    }),
    db.subject.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true, icon: true } }),
    db.level.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true, order: true } }),
    db.commune.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  const featuredCards = featured.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    professionalName: t.professionalName,
    photoUrl: t.photoUrl,
    jobTitle: t.jobTitle,
    rating: t.rating,
    ratingCount: t.ratingCount,
    experienceYears: t.experienceYears,
    careerSummary: t.careerSummary,
    skills: t.skills,
    workHistory: t.workHistory,
    certifications: t.certifications,
    teachingAchievements: t.teachingAchievements,
    learnersCoached: t.learnersCoached,
    pricePerSession: t.pricePerSession,
    pricePack4: t.pricePack4,
    pricePack8: t.pricePack8,
    offersHome: t.offersHome,
    offersOnline: t.offersOnline,
    commune: t.commune,
    badgeVerified: t.badgeVerified,
    badgeRecommended: t.badgeRecommended,
    badgeNew: t.badgeNew,
    badgePopular: t.badgePopular,
    badgePremium: t.badgePremium,
    primarySubject: t.subjects.find((s) => s.isPrimary)?.subject.name ?? t.subjects[0]?.subject.name,
    _count: { reviews: t._count.reviews },
  }));

  return (
    <PublicLayout>
      {/* HERO */}
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <div className="mx-auto max-w-5xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Côte d'Ivoire · professeurs vérifiés · paiement PayDunya
            </div>
            <h1 className="mx-auto max-w-4xl text-3xl font-semibold text-[#111827] text-balance sm:text-4xl lg:text-4xl">
              Réservez un professeur vérifié, avec un suivi clair jusqu'au cours.
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#475569] sm:text-lg">
              Un professeur, un créneau, un paiement PayDunya et un espace client pour suivre le dossier.
            </p>
            <div className="mx-auto mt-5 hidden max-w-2xl grid-cols-3 gap-2 text-center text-xs font-semibold text-[#111B4D] min-[430px]:grid">
              <div className="rounded-lg border border-[#E3E8F2] bg-white px-2 py-3">
                <p className="text-lg text-[#111827]">{activeTeacherCount}+</p>
                <p>profils actifs</p>
              </div>
              <div className="rounded-lg border border-[#E3E8F2] bg-white px-2 py-3">
                <p className="text-lg text-[#111827]">2h</p>
                <p>par séance</p>
              </div>
              <div className="rounded-lg border border-[#E3E8F2] bg-white px-2 py-3">
                <p className="text-lg text-[#111827]">24h</p>
                <p>minimum</p>
              </div>
            </div>
            <div className="mx-auto mt-6 max-w-5xl text-left">
              <HomeSearchBar
                subjects={subjects.map((subject) => ({
                  slug: subject.slug,
                  name: subject.name,
                  category: getSubjectCategory(subject.name, subject.icon),
                }))}
                levels={levels.map((level) => ({
                  slug: level.slug,
                  name: level.name,
                  category: getLevelCategory(level.name, level.order),
                }))}
                communes={communes.map((c) => ({ slug: c.name, name: c.name }))}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <SectionHeader title="Réserver sans stress" text="Un parcours court, lisible et suivi dans votre espace client." />
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div
                key={s.title}
                className="rounded-lg border border-[#E3E8F2] bg-white p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[#111827]">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-[#64748B]">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROFESSEURS EN VEDETTE */}
      {featuredCards.length > 0 && (
        <section className="border-b border-[#E3E8F2] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-[#111827] sm:text-3xl">
                  Professeurs en vedette
                </h2>
                <p className="mt-2 text-sm text-[#64748B]">
                  Une sélection de professeurs vérifiés, recommandés par notre
                  équipe.
                </p>
              </div>
              <Link
                href="/professeurs"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#CAD7F2] bg-white px-4 text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D] sm:justify-start"
              >
                Voir tous les professeurs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid min-w-0 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
              {featuredCards.map((t, index) => (
                <TeacherCard key={`${t.id}-${index}`} teacher={t as any} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MATIÈRES POPULAIRES */}
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <SectionHeader title="Un catalogue ouvert" text="Scolaire, université, concours, adultes, métiers, technique et arts." />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {POPULAR_SUBJECTS.slice(0, 12).map((s) => (
              <Link
                key={s.slug}
                href={`/professeurs?subject=${s.slug}`}
                className="group flex items-center gap-3 rounded-lg border border-[#E3E8F2] bg-white p-3 transition hover:border-[#111B4D]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E3E8F2] bg-white text-[#111B4D]">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#111827]">{s.name}</p>
                  <p className="text-xs text-[#64748B]">{s.desc}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-[#64748B] transition group-hover:text-[#111B4D]" />
              </Link>
            ))}
          </div>
          <div className="mt-5 text-center">
            <Link href="/professeurs" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#CAD7F2] bg-white px-5 text-sm font-semibold text-[#111B4D] hover:border-[#111B4D]">
              Explorer toutes les matières
            </Link>
          </div>
        </div>
      </section>

      {/* GRILLE TARIFAIRE RAPIDE */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold text-[#111827] sm:text-3xl">
                Des tarifs clairs par niveau
              </h2>
              <p className="mt-3 text-sm text-[#64748B] sm:text-base">
                Pas de frais cachés. Choisissez un cours à la séance ou un pack
                de 4, 8 ou 12 séances. Le prix affiché reste le prix payé.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Prix affiché = prix payé",
                  "Fonds bloqués jusqu'à la fin du cours",
                  "Remboursement possible en cas de litige",
                  "Packs avantageux pour un suivi régulier",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-[#111827]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Link
                  href="/tarifs"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[#CAD7F2] bg-white px-5 text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D]"
                >
                  Voir les tarifs détaillés
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-[#E3E8F2] bg-white">
              <table className="w-full text-sm">
                <thead className="bg-white text-left text-xs uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Niveau</th>
                    <th className="px-4 py-3 text-right font-medium">Prix / séance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8F2]">
                  {PRICING.map((p) => (
                    <tr key={p.level} className="border-t border-[#E3E8F2]">
                      <td className="px-4 py-3 font-semibold text-[#111827]">
                        {p.level}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#111827] tabular-nums">
                        {formatFCFA(p.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-[#E3E8F2] bg-white px-4 py-3 text-xs text-[#64748B]">
                Tarifs indicatifs. Prix final affiché sur chaque profil de
                professeur.
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function SectionHeader({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-2xl font-semibold text-[#111827] sm:text-3xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#64748B] sm:text-base">{text}</p>
    </div>
  );
}
