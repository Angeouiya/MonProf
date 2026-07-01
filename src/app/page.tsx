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
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Home,
  ShieldCheck,
  Sparkles,
  Star,
  Video,
  Wallet,
} from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { HomeSearchBar } from "@/components/home/home-search-bar";
import { TeacherCard } from "@/components/shared/teacher-card";
import { Money } from "@/components/shared/money";
import { db } from "@/lib/db";
import { formatFCFA } from "@/lib/format";

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
  { name: "Informatique", slug: "informatique", desc: "Code, bureautique", icon: Laptop },
  { name: "Comptabilité", slug: "comptabilite", desc: "BAC D2, BTS", icon: Coins },
  { name: "Économie", slug: "economie", desc: "Lycée, université", icon: TrendingUp },
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
    icon: CreditCard,
    title: "3. Payez en sécurité",
    text: "Réglez par Wave, Orange Money, MTN Money, Moov Money ou carte bancaire. Vos fonds sont bloqués jusqu'à la confirmation du cours.",
  },
  {
    icon: Wallet,
    title: "4. Confirmez après le cours",
    text: "Une fois le cours dispensé, confirmez sa réalisation. Le professeur est alors payé après déduction de la commission de 20%.",
  },
];

const ADVANTAGES = [
  {
    icon: ShieldCheck,
    title: "Paiement sécurisé",
    text: "Vos fonds sont bloqués jusqu'à la confirmation du cours. Aucun risque de payer pour un cours non dispensé.",
  },
  {
    icon: BadgeCheck,
    title: "Professeurs vérifiés",
    text: "Diplômes, identité et expérience contrôlés par notre équipe avant publication du profil.",
  },
  {
    icon: CalendarCheck,
    title: "Suivi administratif",
    text: "Statut de la réservation, notifications, validation du cours et historique à jour en temps réel.",
  },
  {
    icon: Home,
    title: "Domicile ou en ligne",
    text: "Choisissez le format qui vous convient : cours à domicile partout à Abidjan ou en ligne via visio.",
  },
];

export default async function HomePage() {
  const [featured, subjects, levels, communes] = await Promise.all([
    db.teacher.findMany({
      where: { status: "ACTIVE", featured: true },
      take: 6,
      include: {
        subjects: { include: { subject: true } },
        _count: { select: { reviews: true } },
      },
      orderBy: [{ rating: "desc" }],
    }),
    db.subject.findMany({ orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    db.level.findMany({ orderBy: { order: "asc" }, select: { slug: true, name: true } }),
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

  return (
    <PublicLayout>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border bg-white">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Plateforme ivoirienne · Professeurs vérifiés · Paiement sécurisé
          </div>
          <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-foreground text-balance sm:text-5xl">
            Réservez un professeur vérifié pour des cours à domicile ou en ligne.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Trouvez le professeur idéal, payez en ligne en toute sécurité. Le
            professeur est payé seulement après la confirmation du cours.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/professeurs"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 sm:w-auto"
            >
              Trouver un professeur
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/comment-ca-marche"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-6 text-sm font-medium text-foreground transition hover:bg-muted sm:w-auto"
            >
              Comment ça marche
            </Link>
          </div>

          {/* Barre de recherche rapide */}
          <div className="mt-10 px-0 sm:mt-12">
            <HomeSearchBar
              subjects={subjects}
              levels={levels}
              communes={communes.map((c) => ({ slug: c.name, name: c.name }))}
            />
          </div>
        </div>
      </section>

      {/* 3 ÉTAPES */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Simple, sécurisé, transparent
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Quatre étapes simples entre vous et le professeur de vos enfants.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROFESSEURS EN VEDETTE */}
      {featuredCards.length > 0 && (
        <section className="border-b border-border bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Professeurs en vedette
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Une sélection de professeurs vérifiés, recommandés par notre
                  équipe.
                </p>
              </div>
              <Link
                href="/professeurs"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                Voir tous les professeurs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
              {featuredCards.map((t) => (
                <TeacherCard key={t.id} teacher={t as any} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AVANTAGES */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Pourquoi choisir MonProf CI ?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Une plateforme conçue pour la sérénité des parents et l'efficacité
              des cours.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ADVANTAGES.map((a) => (
              <div
                key={a.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <a.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {a.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {a.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MATIÈRES POPULAIRES */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Toutes les matières sont couvertes
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Du primaire à l'université, trouvez un professeur vérifié pour chaque matière.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
            {POPULAR_SUBJECTS.map((s) => (
              <Link
                key={s.slug}
                href={`/professeurs?subject=${s.slug}`}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* GRILLE TARIFAIRE RAPIDE */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Des tarifs clairs par niveau
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Pas de frais cachés. Choisissez un cours à la séance ou un pack
                de 4, 8 ou 12 séances. La commission de la plateforme est de
                20%.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Prix affiché = prix payé",
                  "Fonds bloqués jusqu'à la fin du cours",
                  "Remboursement possible en cas de litige",
                  "Packs avantageux pour un suivi régulier",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Link
                  href="/tarifs"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted"
                >
                  Voir les tarifs détaillés
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Niveau</th>
                    <th className="px-4 py-3 text-right font-medium">Prix / séance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {PRICING.map((p) => (
                    <tr key={p.level} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {p.level}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                        {formatFCFA(p.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                Tarifs indicatifs. Prix final affiché sur chaque profil de
                professeur.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AVIS / PREUVE SOCIALE */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                kpi: "4.8/5",
                label: "Note moyenne des professeurs",
                icon: Star,
              },
              {
                kpi: "20%",
                label: "Commission plateforme tout inclus",
                icon: ShieldCheck,
              },
              {
                kpi: "100%",
                label: "Professeurs vérifiés avant publication",
                icon: BadgeCheck,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm"
              >
                <s.icon className="mx-auto h-6 w-6 text-primary" />
                <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                  {s.kpi}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION CONFIANCE */}
      <section className="border-b border-border bg-primary/5">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Tous les professeurs sont enregistrés, vérifiés et suivis par notre administration.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Chaque professeur est sélectionné, contrôlé et noté par notre équipe. Nous vérifions les diplômes, l'identité et l'expérience avant toute publication. Le paiement n'est libéré qu'après votre confirmation du cours.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-foreground">
            <span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /> Identité vérifiée</span>
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Paiement sécurisé</span>
            <span className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-primary" /> Suivi administratif</span>
            <span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Remboursement en cas de litige</span>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="rounded-3xl border border-border bg-primary/5 p-8 text-center sm:p-12">
            <h2 className="mx-auto max-w-2xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Prêt à réserver votre premier cours ?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Créez votre compte en moins d'une minute et accédez à des
              professeurs vérifiés partout à Abidjan.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/inscription"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 sm:w-auto"
              >
                Créer un compte gratuit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/professeurs"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-6 text-sm font-medium text-foreground transition hover:bg-muted sm:w-auto"
              >
                Parcourir les professeurs
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              À partir de <Money amount={7500} muted /> la séance.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
