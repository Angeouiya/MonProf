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
import { ProfessorImage } from "@/components/shared/professor-image";
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
    title: "1. Recherchez un professeur",
    text: "Parcourez les profils vérifiés par notre équipe et choisissez selon la matière, le niveau, la commune et le format (domicile ou en ligne).",
  },
  {
    icon: CalendarCheck,
    title: "2. Réservez votre cours",
    text: "Indiquez vos préférences : jours, horaires, objectif pédagogique et nombre de séances. Choisissez un cours à la séance ou un pack.",
  },
  {
    icon: WalletCards,
    title: "3. Payez en sécurité",
    text: "Réglez par Wave, Orange Money, MTN Money ou Moov Money. Vos fonds sont bloqués jusqu'à la confirmation du cours.",
  },
  {
    icon: Wallet,
    title: "4. Confirmez après le cours",
    text: "Une fois le cours dispensé, confirmez sa réalisation. La plateforme clôture ensuite la réservation en toute sécurité.",
  },
];

export default async function HomePage() {
  const [featured, subjects, levels, communes] = await Promise.all([
    db.teacher.findMany({
      where: { status: "ACTIVE", featured: true, AND: [{ photoUrl: { not: null } }, { photoUrl: { not: "" } }] },
      take: 6,
      include: {
        subjects: { include: { subject: true } },
        _count: { select: { reviews: true } },
      },
      orderBy: [{ rating: "desc" }],
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
  const heroTeacher = featuredCards[0];

  return (
    <PublicLayout>
      {/* HERO */}
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto grid max-w-7xl gap-7 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:py-12">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-bold text-[#111B4D] shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              Côte d'Ivoire · professeurs vérifiés · paiement PayDunya
            </div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-[#111827] text-balance sm:text-5xl lg:text-6xl">
              Réservez un professeur vérifié, avec un suivi clair jusqu'au cours.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#475569] sm:text-lg">
              Choisissez la matière, le niveau, le lieu et l'horaire. Votre réservation reste suivie par MonProf CI, du paiement sécurisé à la confirmation du cours.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-bold text-[#111B4D]">
              <div className="rounded-2xl border border-[#E3E8F2] bg-white px-2 py-3">
                <p className="text-lg text-[#111827]">{featuredCards.length}+</p>
                <p>profils actifs</p>
              </div>
              <div className="rounded-2xl border border-[#E3E8F2] bg-white px-2 py-3">
                <p className="text-lg text-[#111827]">2h</p>
                <p>par séance</p>
              </div>
              <div className="rounded-2xl border border-[#E3E8F2] bg-white px-2 py-3">
                <p className="text-lg text-[#111827]">24h</p>
                <p>minimum</p>
              </div>
            </div>
            <div className="mt-6">
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

          <div className="rounded-[2rem] border border-[#E3E8F2] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#E3E8F2] pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Sélection MonProf CI</p>
                <p className="text-lg font-bold text-[#111827]">Professeur recommandé</p>
              </div>
              <span className="rounded-full bg-[#111B4D] px-3 py-1 text-xs font-bold text-white">Vérifié</span>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <ProfessorImage
                photoUrl={heroTeacher?.photoUrl}
                name={heroTeacher?.professionalName || heroTeacher?.fullName || "Professeur MonProf"}
                size="xl"
                shape="rounded"
                priority
                verified={heroTeacher?.badgeVerified}
              />
              <div className="min-w-0">
                <p className="truncate text-xl font-bold text-[#111827]">{heroTeacher?.professionalName || "M. Kouamé"}</p>
                <p className="mt-1 truncate text-sm font-semibold text-[#475569]">{heroTeacher?.primarySubject || "Mathématiques"} · {heroTeacher?.commune || "Abidjan"}</p>
                <p className="mt-2 text-sm font-bold text-[#111B4D]">Note {heroTeacher?.rating?.toFixed(1) || "4.9"}/5 · {heroTeacher?.experienceYears || 5} ans d'expérience</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 min-[430px]:grid-cols-3">
              <MiniProof icon={BadgeCheck} label="Identité contrôlée" />
              <MiniProof icon={CalendarCheck} label="Disponibilité suivie" />
              <MiniProof icon={WalletCards} label="PayDunya sécurisé" />
            </div>
            <Link
              href={heroTeacher ? `/professeurs/${heroTeacher.id}` : "/professeurs"}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#111B4D] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#1E2A78]"
            >
              Voir le profil
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <SectionHeader title="Réserver sans stress" text="Le parcours est court : choix du professeur, créneau, paiement PayDunya, puis suivi dans l'espace client." />
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div
                key={s.title}
                className="rounded-3xl border border-[#E3E8F2] bg-white p-4 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111B4D] text-white shadow-sm">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-[#111827]">
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
                <h2 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
                  Professeurs en vedette
                </h2>
                <p className="mt-2 text-sm text-[#64748B]">
                  Une sélection de professeurs vérifiés, recommandés par notre
                  équipe.
                </p>
              </div>
              <Link
                href="/professeurs"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#CAD7F2] bg-white px-4 text-sm font-bold text-[#111B4D] shadow-sm transition hover:border-[#111B4D] sm:justify-start"
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
                className="group flex items-center gap-3 rounded-2xl border border-[#E3E8F2] bg-white p-3 shadow-sm transition hover:border-[#111B4D]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#E3E8F2] bg-white text-[#111B4D] shadow-sm">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#111827]">{s.name}</p>
                  <p className="text-xs text-[#64748B]">{s.desc}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-[#64748B] transition group-hover:text-[#111B4D]" />
              </Link>
            ))}
          </div>
          <div className="mt-5 text-center">
            <Link href="/professeurs" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#CAD7F2] bg-white px-5 text-sm font-bold text-[#111B4D] shadow-sm hover:border-[#111B4D]">
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
              <h2 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
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
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-[#CAD7F2] bg-white px-5 text-sm font-bold text-[#111B4D] shadow-sm transition hover:border-[#111B4D]"
                >
                  Voir les tarifs détaillés
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-[#E3E8F2] bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-white text-left text-xs uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Niveau</th>
                    <th className="px-4 py-3 text-right font-medium">Prix / séance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {PRICING.map((p) => (
                    <tr key={p.level} className="border-t border-[#E3E8F2]">
                      <td className="px-4 py-3 font-bold text-[#111827]">
                        {p.level}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#111827] tabular-nums">
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
      <h2 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#64748B] sm:text-base">{text}</p>
    </div>
  );
}

function MiniProof({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-[#E3E8F2] bg-white px-3 text-xs font-bold text-[#111B4D]">
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </div>
  );
}
