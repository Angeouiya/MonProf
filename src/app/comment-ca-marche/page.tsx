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
    text: "Réglez par Wave, Orange Money, MTN Money ou Moov Money. Les fonds sont immédiatement bloqués sur le compte de la plateforme.",
  },
  {
    n: 5,
    icon: FileSearch,
    title: "Le service client valide la réservation",
    text: "Notre service client vérifie la disponibilité du professeur et confirme la réservation (généralement sous 24h).",
  },
  {
    n: 6,
    icon: MessageSquare,
    title: "Le professeur est notifié",
    text: "Le professeur reçoit une notification (SMS, WhatsApp ou e-mail) avec les détails du cours et le créneau confirmé.",
  },
  {
    n: 7,
    icon: ShieldCheck,
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
    text: "Le service client clôture le cours et traite le paiement du professeur selon le processus interne de la plateforme.",
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
    text: "Un service client disponible par téléphone et e-mail, du lundi au samedi.",
  },
  {
    icon: Receipt,
    title: "Transparence totale",
    text: "Suivi du statut de chaque réservation en temps réel, historique disponible à tout moment.",
  },
];

const JOURNEY_SIGNALS = [
  {
    icon: Search,
    label: "Vous choisissez",
    title: "Un professeur précis",
    text: "Photo réelle, badges, matières, niveaux, disponibilités et avis.",
  },
  {
    icon: CalendarCheck,
    label: "Vous planifiez",
    title: "Date et créneau de 2h",
    text: "La réservation reste attachée au professeur sélectionné.",
  },
  {
    icon: Wallet,
    label: "Vous payez",
    title: "Total affiché avant validation",
    text: "Cours, déplacement éventuel et mode de paiement sont clairs.",
  },
  {
    icon: Headphones,
    label: "Nous suivons",
    title: "Service client, notifications et support",
    text: "Le professeur est confirmé, le client est protégé, l'historique reste traçable.",
  },
];

export default function CommentCaMarchePage() {
  return (
    <PublicLayout>
      {/* HEADER */}
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <nav className="mb-5 inline-flex min-h-11 items-center rounded-lg border border-[#E3E8F2] bg-white px-3 py-1 text-xs text-[#64748B]">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-lg px-1 hover:text-[#111B4D]">Accueil</Link>
            <span className="mx-1.5">/</span>
            <span className="text-[#111827]">Comment ça marche</span>
          </nav>
          <div className="max-w-3xl">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Réservation encadrée de bout en bout
            </span>
            <h1 className="mt-5 text-3xl font-semibold text-[#111827] sm:text-4xl text-balance">
              Comment ça marche
            </h1>
            <p className="mt-4 text-base text-[#64748B] sm:text-lg">
              De la recherche du professeur au paiement final, découvrez le
              parcours complet en 9 étapes. Simple, transparent et sécurisé
              pour les parents comme pour les professeurs.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/professeurs"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#111B4D] px-5 text-sm font-semibold text-white transition hover:bg-[#1E2A78]"
              >
                Trouver un professeur
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/tarifs"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#E3E8F2] bg-white px-5 text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D] hover:bg-white"
              >
                Comprendre les tarifs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* RÉSUMÉ OPÉRATIONNEL */}
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-[#E3E8F2] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Parcours client sécurisé</p>
                <h2 className="mt-1 text-xl font-semibold text-[#111827]">
                  Une réservation claire avant, pendant et après le cours.
                </h2>
              </div>
              <span className="text-xs font-semibold text-[#111B4D]">
                Sans paiement direct au professeur
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {JOURNEY_SIGNALS.map((item) => (
                <JourneySignal key={item.title} {...item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 9 ÉTAPES */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <ol className="relative space-y-4 sm:space-y-5">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="group relative rounded-lg border border-[#E3E8F2] bg-white p-5 transition hover:border-[#111B4D] sm:p-6"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-base font-semibold text-white">
                      {s.n}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <s.icon className="h-5 w-5 text-[#111B4D]" />
                      <h2 className="text-base font-semibold text-[#111827] sm:text-lg">
                        {s.title}
                      </h2>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#64748B] sm:text-base">
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
      <section className="border-t border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-medium text-[#64748B]">
              <UserCheck className="h-3.5 w-3.5 text-[#111B4D]" />
              Conseils pratiques
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-[#111827] sm:text-3xl">
              Pour les parents
            </h2>
            <p className="mt-3 text-sm text-[#64748B] sm:text-base">
              Quelques bonnes pratiques pour tirer le maximum de chaque cours
              réservé sur Compétence.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {PARENT_TIPS.map((t) => (
              <div
                key={t.title}
                className="rounded-lg border border-[#E3E8F2] bg-white p-5 transition hover:border-[#111B4D] sm:p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                  <t.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-[#111827] sm:text-base">
                  {t.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#64748B]">
                  {t.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POURQUOI NOUS FAIRE CONFIANCE */}
      <section className="border-t border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-medium text-[#64748B]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#111B4D]" />
              Nos garanties
            </span>
            <h2 className="mt-3 text-2xl font-semibold text-[#111827] sm:text-3xl">
              Pourquoi nous faire confiance
            </h2>
            <p className="mt-3 text-sm text-[#64748B] sm:text-base">
              Notre rôle ne s'arrête pas à la mise en relation. Nous sécurisons
              chaque cours de bout en bout.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <div
                key={t.title}
                className="rounded-lg border border-[#E3E8F2] bg-white p-5 text-center transition hover:border-[#111B4D]"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                  <t.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-[#111827]">
                  {t.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#64748B]">
                  {t.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-t border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              { kpi: "9", label: "étapes claires du parcours client", icon: CalendarCheck },
              { kpi: "100%", label: "professeurs vérifiés avant publication", icon: BadgeCheck },
              { kpi: "48h", label: "délai de traitement des litiges", icon: Headphones },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-[#E3E8F2] bg-white p-6 text-center"
              >
                <s.icon className="mx-auto h-6 w-6 text-[#111B4D]" />
                <div className="mt-3 text-3xl font-semibold text-[#111827]">
                  {s.kpi}
                </div>
                <p className="mt-1 text-sm text-[#64748B]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-[#E3E8F2] bg-white p-8 text-center sm:p-12">
            <BadgeCheck className="mx-auto h-7 w-7 text-[#111B4D]" />
            <h2 className="mt-4 text-2xl font-semibold text-[#111827] sm:text-3xl">
              Prêt à commencer ?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[#64748B] sm:text-base">
              Trouvez le professeur idéal en quelques minutes. Paiement
              sécurisé, professeur vérifié, suivi service client inclus.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/professeurs"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#111B4D] px-6 text-sm font-semibold text-white transition hover:bg-[#1E2A78] sm:w-auto"
              >
                Trouver un professeur
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/tarifs"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#E3E8F2] bg-white px-6 text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D] hover:bg-white sm:w-auto"
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

function JourneySignal({
  icon: Icon,
  label,
  title,
  text,
}: {
  icon: typeof Search;
  label: string;
  title: string;
  text: string;
}) {
  return (
    <article className="min-w-0 rounded-lg border border-[#E3E8F2] bg-white p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <h3 className="mt-1 text-base font-semibold text-[#111827]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#64748B]">{text}</p>
    </article>
  );
}
