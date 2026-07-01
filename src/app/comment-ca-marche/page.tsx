import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  FileSearch,
  HandCoins,
  Headphones,
  Lock,
  MessageSquare,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserCheck,
  Wallet,
} from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";

const STEPS = [
  {
    n: 1,
    icon: Search,
    title: "Recherchez un professeur",
    text: "Filtrez par matière, niveau scolaire, commune et format (à domicile ou en ligne). Comparez les profils, notes et avis.",
  },
  {
    n: 2,
    icon: UserCheck,
    title: "Choisissez un professeur vérifié",
    text: "Tous nos professeurs sont vérifiés (identité, diplômes, expérience). Les badges « Vérifié », « Recommandé » et « Premium » vous guident dans votre choix.",
  },
  {
    n: 3,
    icon: CalendarCheck,
    title: "Réservez votre créneau",
    text: "Indiquez vos jours et horaires préférés, l'objectif du cours (préparation BAC, BEPC, soutien), le niveau et le format souhaité.",
  },
  {
    n: 4,
    icon: CreditCard,
    title: "Payez en ligne en toute sécurité",
    text: "Réglez par Wave, Orange Money, MTN Money, Moov Money ou carte bancaire. Les fonds sont immédiatement bloqués sur le compte de la plateforme.",
  },
  {
    n: 5,
    icon: FileSearch,
    title: "L'admin valide la réservation",
    text: "Notre équipe administrative vérifie la disponibilité du professeur et confirme la réservation (généralement sous 24h).",
  },
  {
    n: 6,
    icon: MessageSquare,
    title: "Le professeur est notifié",
    text: "Le professeur reçoit une notification (SMS, WhatsApp ou e-mail) avec les détails du cours et le créneau confirmé.",
  },
  {
    n: 7,
    icon: Sparkles,
    title: "Le cours a lieu",
    text: "Le professeur dispense le cours à domicile ou en ligne selon le format choisi. Les fonds restent bloqués pendant toute la durée du cours.",
  },
  {
    n: 8,
    icon: BadgeCheck,
    title: "Le client valide le cours",
    text: "Après le cours, le client confirme que le cours a bien eu lieu. Il peut laisser un avis et une note. Les fonds sont alors prêts à être libérés.",
  },
  {
    n: 9,
    icon: HandCoins,
    title: "Le professeur est payé",
    text: "L'administrateur libère le paiement au professeur, déduction faite de la commission de 20%. Le professeur reçoit son paiement par mobile money ou virement.",
  },
];

const PARENT_TIPS = [
  {
    icon: Search,
    title: "Sélectionnez avec soin",
    text: "Consultez les avis, la note et l'expérience. Privilégiez les professeurs recommandés ou premium pour les objectifs importants (BAC, concours).",
  },
  {
    icon: CalendarCheck,
    title: "Soyez précis sur l'objectif",
    text: "Indiquez clairement l'objectif (chapitre, type d'examen, difficultés). Le professeur pourra mieux préparer la séance.",
  },
  {
    icon: ShieldCheck,
    title: "Ne payez jamais en direct",
    text: "Tout paiement se fait via la plateforme. Un paiement en direct au professeur vous fait perdre la garantie de remboursement en cas de litige.",
  },
  {
    icon: MessageSquare,
    title: "Validez le cours après chaque séance",
    text: "La validation déclenche le paiement du professeur. Si un problème survient, ouvrez un litige avant de valider : notre support intervient sous 48h.",
  },
];

const TRUST = [
  {
    icon: BadgeCheck,
    title: "Professeurs vérifiés",
    text: "Identité, diplômes et expérience contrôlés avant publication.",
  },
  {
    icon: Lock,
    title: "Paiement sécurisé",
    text: "Vos fonds sont bloqués sur un compte tiers jusqu'à la fin du cours.",
  },
  {
    icon: Headphones,
    title: "Support dédié",
    text: "Une équipe administrative disponible par téléphone et e-mail, du lundi au samedi.",
  },
  {
    icon: Receipt,
    title: "Transparence totale",
    text: "Suivi du statut de chaque réservation en temps réel, historique disponible à tout moment.",
  },
];

export default function CommentCaMarchePage() {
  return (
    <PublicLayout>
      {/* HEADER */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <nav className="mb-3 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Accueil</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Comment ça marche</span>
          </nav>
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
              Comment ça marche
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              De la recherche du professeur au paiement final, découvrez le
              parcours complet en 9 étapes. Simple, transparent et sécurisé
              pour les parents comme pour les professeurs.
            </p>
          </div>
        </div>
      </section>

      {/* 9 ÉTAPES */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <ol className="relative space-y-4 sm:space-y-5">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="group relative rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/30 sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-base font-bold">
                      {s.n}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <s.icon className="h-5 w-5 text-primary" />
                      <h2 className="text-base font-semibold text-foreground sm:text-lg">
                        {s.title}
                      </h2>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {s.text}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* POUR LES PARENTS */}
      <section className="border-t border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              Conseils pratiques
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Pour les parents
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Quelques bonnes pratiques pour tirer le maximum de chaque cours
              réservé sur MonProf CI.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {PARENT_TIPS.map((t) => (
              <div
                key={t.title}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <t.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground sm:text-base">
                  {t.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POURQUOI NOUS FAIRE CONFIANCE */}
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Nos garanties
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Pourquoi nous faire confiance
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Notre rôle ne s'arrête pas à la mise en relation. Nous sécurisons
              chaque cours de bout en bout.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <div
                key={t.title}
                className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <t.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {t.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {t.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-t border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              { kpi: "9", label: "étapes claires du parcours client", icon: CalendarCheck },
              { kpi: "100%", label: "professeurs vérifiés avant publication", icon: BadgeCheck },
              { kpi: "48h", label: "délai de traitement des litiges", icon: Headphones },
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

      {/* CTA */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border bg-white p-8 text-center shadow-sm sm:p-12">
            <Star className="mx-auto h-7 w-7 text-amber-400" />
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Prêt à commencer ?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Trouvez le professeur idéal en quelques minutes. Paiement
              sécurisé, professeur vérifié, suivi administratif inclus.
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
                href="/tarifs"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-6 text-sm font-medium text-foreground transition hover:bg-muted sm:w-auto"
              >
                Voir les tarifs
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
