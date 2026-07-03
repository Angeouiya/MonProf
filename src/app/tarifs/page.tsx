import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lock,
  Package,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PublicLayout } from "@/components/layouts/public-layout";
import { formatFCFA } from "@/lib/format";
import { GRAND_ABIDJAN_AREAS, GRAND_ABIDJAN_NEAR_ROUTES, PRICE_TIERS, TRANSPORT_FEES } from "@/lib/pricing";

const TIERS = [
  {
    name: PRICE_TIERS.BASIC_7500.label,
    price: PRICE_TIERS.BASIC_7500.amount,
    usage: "Prix d'appel limité",
    rule: "En ligne, primaire simple, aide aux devoirs ou professeur très proche.",
  },
  {
    name: PRICE_TIERS.STANDARD_10000.label,
    price: PRICE_TIERS.STANDARD_10000.amount,
    usage: "Minimum réel à domicile",
    rule: "Cours à domicile normal, CM, CEPE, collège 6e/5e/4e.",
  },
  {
    name: PRICE_TIERS.RENFORCEMENT_12500.label,
    price: PRICE_TIERS.RENFORCEMENT_12500.amount,
    usage: "Renforcement",
    rule: "3e/BEPC, lycée début, primaire français, bureautique, anglais.",
  },
  {
    name: PRICE_TIERS.AVANCE_15000.label,
    price: PRICE_TIERS.AVANCE_15000.amount,
    usage: "Avancé",
    rule: "Lycée, BAC, BTS, licence, comptabilité, marketing, anglais professionnel.",
  },
  {
    name: PRICE_TIERS.PREMIUM_20000.label,
    price: PRICE_TIERS.PREMIUM_20000.amount,
    usage: "Premium",
    rule: "Terminale, lycée français, Grand oral, data, développement, BTP, experts.",
  },
  {
    name: PRICE_TIERS.SUR_DEVIS.label,
    price: null,
    usage: "Cas spécial",
    rule: "Entreprise, pack personnalisé, formation spéciale ou hors Grand Abidjan.",
  },
];

const PACKS = [
  {
    name: "1 séance",
    desc: "Pour un besoin ponctuel : révision d'un chapitre, préparation d'un contrôle, dépannage avant examen.",
    priceNote: "Plein tarif",
    icon: WalletCards,
    useCases: ["Soutien ponctuel", "Révision chapitre", "Préparation contrôle"],
  },
  {
    name: "Pack 4 séances",
    desc: "Idéal pour un suivi hebdomadaire sur un mois. Parfait pour combler des lacunes sur un thème précis.",
    priceNote: "Prix stable, suivi mensuel",
    icon: Package,
    useCases: ["Suivi mensuel", "Préparation BEPC", "Remise à niveau"],
  },
  {
    name: "Pack 8 séances",
    desc: "Suivi régulier sur deux mois pour progresser durablement. Recommandé pour la préparation des examens.",
    priceNote: "Remise 5% intégrée",
    icon: Package,
    useCases: ["Préparation BAC", "Pré-rentrée", "Ciblage concours"],
  },
  {
    name: "Pack 12 séances",
    desc: "Pour un trimestre complet de suivi intensif. Le meilleur rapport qualité-prix pour un objectif long terme.",
    priceNote: "Remise 7% intégrée",
    icon: Package,
    useCases: ["Trimestre complet", "Concours ENA/INFAS", "Préparation longue"],
  },
  {
    name: "Pack personnalisé",
    desc: "Pour une demande spéciale, un groupe structuré, une entreprise ou un planning complexe.",
    priceNote: "Sur devis",
    icon: Package,
    useCases: ["Entreprise", "Formation métier", "Planning complexe"],
  },
];

const PAYMENT_STEPS = [
  {
    icon: WalletCards,
    title: "Le client paie en ligne",
    text: "Paiement par Wave, Orange Money, MTN Money ou Moov Money lors de la réservation.",
  },
  {
    icon: Lock,
    title: "Fonds bloqués sur la plateforme",
    text: "Le montant est immédiatement sécurisé sur le compte de MonProf CI. Le professeur n'est pas encore payé.",
  },
  {
    icon: BadgeCheck,
    title: "Validation administrative",
    text: "L'administrateur vérifie la disponibilité du professeur et confirme la réservation sous 24h.",
  },
  {
    icon: CheckCircle2,
    title: "Le cours a lieu",
    text: "Le professeur dispense le cours à domicile ou en ligne selon le créneau convenu.",
  },
  {
    icon: BadgeCheck,
    title: "Validation par le client",
    text: "Le client confirme la bonne réalisation du cours dans son espace. Il peut laisser un avis.",
  },
  {
    icon: ShieldCheck,
    title: "Suivi jusqu'à clôture",
    text: "La réservation reste suivie par l'administration jusqu'à la fin du cours.",
  },
  {
    icon: ShieldCheck,
    title: "Garantie litige",
    text: "En cas de problème, le client peut ouvrir un litige. Le paiement est suspendu et notre support arbitre sous 48h.",
  },
];

const CANCELLATION_RULES = [
  {
    title: "Plus de 24h avant le cours",
    fee: "0%",
    feeRate: 0,
    manualReview: false,
    text: "Annulation gratuite. Le montant payé est remboursable intégralement.",
    clientAction: "Le client peut annuler sereinement depuis son espace.",
    adminAction: "Remboursement complet ou report selon le choix du client.",
    tone: "border-[#E3E8F2] bg-white text-[#111B4D]",
  },
  {
    title: "Entre 24h et 6h avant le cours",
    fee: "25%",
    feeRate: 25,
    manualReview: false,
    text: "Annulation proche du cours. Des frais de préparation et de mobilisation peuvent être retenus.",
    clientAction: "Le client voit le montant estimé avant confirmation de l'annulation.",
    adminAction: "Historique conservé, remboursement partiel à traiter.",
    tone: "border-[#E3E8F2] bg-white text-[#111B4D]",
  },
  {
    title: "Moins de 6h avant le cours",
    fee: "50%",
    feeRate: 50,
    manualReview: false,
    text: "Annulation tardive. Le remboursement est partiel, sauf cas exceptionnel validé par l'administration.",
    clientAction: "Le client peut ajouter une explication pour l'administration.",
    adminAction: "Contrôle manuel possible en cas de force majeure.",
    tone: "border-[#E3E8F2] bg-white text-[#111B4D]",
  },
  {
    title: "Cours commencé ou heure dépassée",
    fee: "Dossier admin",
    feeRate: 100,
    manualReview: true,
    text: "L'annulation n'est plus automatique. L'administration examine les preuves, la présence du client et la situation du professeur.",
    clientAction: "Le client doit expliquer la situation et ouvrir un suivi si nécessaire.",
    adminAction: "Décision manuelle : maintien, remboursement partiel, report ou litige.",
    tone: "border-[#E3E8F2] bg-white text-[#111B4D]",
  },
  {
    title: "Professeur absent ou indisponible",
    fee: "0%",
    feeRate: 0,
    manualReview: false,
    text: "Le client n'est pas pénalisé. MonProf CI propose un remplacement, un report ou un remboursement.",
    clientAction: "Le client conserve sa protection paiement.",
    adminAction: "Remplacement, report ou remboursement complet selon le dossier.",
    tone: "border-[#E3E8F2] bg-white text-[#111B4D]",
  },
];

const CANCELLATION_EXAMPLE_AMOUNT = 20000;

const FAQ = [
  {
    q: "Le prix affiché est-il le prix final ?",
    a: "Oui pour les réservations à tarif fixe. Le prix est calculé automatiquement par la plateforme selon le besoin, le niveau, le système scolaire, le format, le pack et le déplacement. Pour les cas spéciaux, l'administration envoie un devis avant paiement.",
  },
  {
    q: "Quand le paiement est-il finalisé ?",
    a: "Le paiement reste sécurisé pendant le suivi du cours. Une fois le cours confirmé, l'administration clôture la réservation selon le processus interne de la plateforme.",
  },
  {
    q: "Puis-je me faire rembourser si le cours n'a pas lieu ?",
    a: "Oui. Si le professeur annule ou ne se présente pas, vous êtes intégralement remboursé. Si le client annule, les règles dépendent du délai avant le cours : gratuit avant 24h, frais de 25% entre 24h et 6h, frais de 50% à moins de 6h. Les cas exceptionnels sont examinés par l'administration.",
  },
  {
    q: "Que se passe-t-il en cas de litige ?",
    a: "Vous pouvez ouvrir un litige depuis votre espace client avant de valider le cours. Notre support examine la situation sous 48h et arbitre. En cas de problème avéré, vous êtes remboursé et le professeur n'est pas payé.",
  },
  {
    q: "Les packs sont-ils remboursables ?",
    a: "Les séances déjà réalisées dans un pack ne sont pas remboursables. Les séances non réalisées peuvent faire l'objet d'un remboursement au prorata ou d'un report, après ouverture d'un litige ou contact avec le support. Les remises pack sont déjà intégrées au prix payé.",
  },
  {
    q: "Puis-je payer directement le professeur ?",
    a: "Non. Tout paiement doit transiter par la plateforme. Un paiement direct au professeur vous fait perdre la garantie de remboursement et la protection litige. C'est aussi une violation de nos conditions d'utilisation.",
  },
  {
    q: "Quels moyens de paiement acceptez-vous ?",
    a: "Wave, Orange Money, MTN Money et Moov Money. Tous les paiements sont sécurisés et les fonds bloqués jusqu'à la fin du cours.",
  },
];

export default function TarifsPage() {
  return (
    <PublicLayout>
      {/* HEADER */}
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <nav className="mb-5 inline-flex min-h-11 items-center rounded-full border border-[#E3E8F2] bg-white px-3 py-1 text-xs text-muted-foreground shadow-sm">
            <Link href="/" className="inline-flex min-h-11 items-center rounded-full bg-white px-2 hover:text-foreground">Accueil</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Tarifs</span>
          </nav>
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#DDE6F7] bg-white px-3 py-1 text-xs font-bold text-[#111B4D] shadow-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              Fonds bloqués jusqu'à confirmation
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-foreground sm:text-5xl text-balance">
              Tarifs clairs, paiement sécurisé
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Pas de frais cachés. Le prix affiché est le prix payé. La
              réservation reste suivie par l'administration jusqu'à la confirmation du cours.
            </p>
          </div>
        </div>
      </section>

      {/* GRILLE TARIFAIRE OFFICIELLE */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Grille tarifaire officielle
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Le prix est proposé automatiquement selon la catégorie, le niveau,
            le système scolaire, la matière, le format et les frais de déplacement.
            Le tarif 7 500 F est seulement un prix d'appel limité.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <TariffSignal
              label="Prix minimum"
              value={formatFCFA(7500)}
              text="Réservé aux besoins simples ou très proches."
            />
            <TariffSignal
              label="Durée"
              value="2h"
              text="Chaque séance est calculée sur un créneau de deux heures."
            />
            <TariffSignal
              label="Avant paiement"
              value="Total clair"
              text="Le client voit le cours, le déplacement éventuel et le total."
            />
          </div>

          <div className="mt-8 rounded-3xl border border-[#E3E8F2] bg-white p-3 shadow-sm sm:p-4">
            <div className="grid gap-3 lg:hidden">
              {TIERS.map((t) => (
                <article key={t.name} className="rounded-2xl border border-[#E3E8F2] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-[#111827]">{t.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[#64748B]">{t.usage}</p>
                    </div>
                    <p className="shrink-0 rounded-full border border-[#D6DEED] bg-white px-3 py-1 text-sm font-black tabular-nums text-[#111B4D]">
                      {t.price === null ? "Sur devis" : formatFCFA(t.price)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.rule}</p>
                </article>
              ))}
            </div>

            <div className="hidden lg:block">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-white text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-[22%] px-4 py-3 font-medium">Palier</th>
                    <th className="w-[18%] px-4 py-3 text-right font-medium">Prix séance</th>
                    <th className="w-[25%] px-4 py-3 font-medium">Usage</th>
                    <th className="w-[35%] px-4 py-3 font-medium">Règle d'application</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E8F2]">
                  {TIERS.map((t) => (
                      <tr key={t.name} className="transition hover:bg-white">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {t.name}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                          {t.price === null ? "Sur devis" : formatFCFA(t.price)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {t.usage}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {t.rule}
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#E3E8F2] bg-white px-4 py-3 text-xs text-muted-foreground">
              Chaque séance dure 2h. Les frais de déplacement sont séparés et
              affichés avant paiement lorsque le cours est à domicile.
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.values(TRANSPORT_FEES).map((fee) => (
              <div key={fee.key} className="rounded-3xl border border-[#E3E8F2] bg-white p-4 shadow-sm">
                <p className="text-sm font-black text-foreground">{fee.label}</p>
                <p className="mt-2 text-lg font-black text-[#111B4D]">
                  {fee.amount === null ? "Sur devis" : formatFCFA(fee.amount)}
                </p>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Frais affichés avant paiement, sans frais cachés côté client.
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-3xl border border-[#E3E8F2] bg-white p-4">
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-sm font-black text-[#111B4D]">Calcul Grand Abidjan automatique</p>
                <p className="mt-2 text-sm leading-relaxed text-[#394568]">
                  Pour un cours à domicile, la plateforme compare la commune du professeur et la commune du client. Même zone : aucun supplément. Commune proche : déplacement modéré. Commune éloignée : déplacement plus important. Hors matrice : devis admin avant paiement.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {GRAND_ABIDJAN_AREAS.slice(0, 10).map((area) => (
                    <span key={area} className="rounded-full border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-bold text-[#111B4D]">{area}</span>
                  ))}
                  <span className="rounded-full border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-bold text-[#111B4D]">+{GRAND_ABIDJAN_AREAS.length - 10}</span>
                </div>
              </div>
              <div className="rounded-3xl border border-[#E3E8F2] bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#56617F]">Exemples de routes proches</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {GRAND_ABIDJAN_NEAR_ROUTES.slice(0, 8).map(([from, to]) => (
                    <p key={`${from}-${to}`} className="rounded-2xl border border-[#D6DEED] bg-white px-3 py-2 text-xs font-semibold text-[#111B4D]">
                      {from} {"->"} {to}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PACKS DE COURS */}
      <section className="border-t border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Packs de cours
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Choisissez le format adapté à votre objectif. Plus le pack est
              long, plus le prix par séance est avantageux.
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PACKS.map((p) => (
              <div
                key={p.name}
                className="flex flex-col rounded-3xl border border-[#E3E8F2] bg-white p-5 shadow-sm transition hover:border-[#111B4D]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {p.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>
                <p className="mt-3 text-xs font-medium text-[#111B4D]">
                  {p.priceNote}
                </p>
                <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {p.useCases.map((u) => (
                    <li
                      key={u}
                      className="flex items-start gap-1.5 text-xs text-muted-foreground"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
                      {u}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PAIEMENT SÉCURISÉ — 7 ÉTAPES */}
      <section className="border-t border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-[#111B4D]" />
              Paiement sécurisé
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Comment fonctionne le paiement sécurisé
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Le paiement est bloqué sur la plateforme jusqu'à la confirmation
              du cours. Voici le parcours en 7 étapes.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENT_STEPS.map((s, i) => (
              <div
                key={s.title}
                className="relative rounded-3xl border border-[#E3E8F2] bg-white p-5 shadow-sm transition hover:border-[#111B4D]"
              >
                <div className="absolute right-4 top-4 text-3xl font-bold tabular-nums text-[#E3E8F2]">
                  {i + 1}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {s.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RÈGLES D'ANNULATION */}
      <section className="border-t border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
                <RefreshCw className="h-3.5 w-3.5 text-[#111B4D]" />
                Annulation encadrée
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Règles d'annulation de réservation
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Le client peut annuler depuis son espace. La plateforme calcule
                automatiquement les frais selon le délai avant le cours, puis
                conserve l'historique pour l'administration.
              </p>
              <div className="mt-5 rounded-3xl border border-[#E3E8F2] bg-white p-4 text-sm shadow-sm">
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" />
                  <p className="text-muted-foreground">
                    Si le cours n'est pas encore planifié avec une date et une heure définitives,
                    l'annulation client reste gratuite.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {CANCELLATION_RULES.map((rule) => {
                  const feeAmount = Math.round((CANCELLATION_EXAMPLE_AMOUNT * rule.feeRate) / 100);
                  const refundAmount = Math.max(0, CANCELLATION_EXAMPLE_AMOUNT - feeAmount);

                  return (
                    <div key={rule.title} className={`rounded-3xl border p-5 shadow-sm ${rule.tone}`}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-bold">{rule.title}</h3>
                        <span className="rounded-full border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-black shadow-sm">{rule.fee}</span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed">{rule.text}</p>
                      <div className="mt-4 grid gap-2 rounded-2xl border border-[#E3E8F2] bg-white p-3 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-[#56617F]">Exemple sur {formatFCFA(CANCELLATION_EXAMPLE_AMOUNT)}</span>
                          <span className="font-black">
                            {rule.manualReview ? "À arbitrer" : `${formatFCFA(refundAmount)} remboursables`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-[#56617F]">Frais estimés</span>
                          <span className="font-black">
                            {rule.manualReview ? `jusqu'à ${formatFCFA(feeAmount)}` : formatFCFA(feeAmount)}
                          </span>
                        </div>
                        <div className="border-t border-[#E3E8F2] pt-2">
                          <p className="font-bold text-[#111B4D]">Client</p>
                          <p className="mt-1 leading-relaxed text-[#56617F]">{rule.clientAction}</p>
                          <p className="mt-2 font-bold text-[#111B4D]">Administration</p>
                          <p className="mt-1 leading-relaxed text-[#56617F]">{rule.adminAction}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ TARIFS */}
      <section className="border-t border-[#E3E8F2] bg-white">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5 text-[#111B4D]" />
              FAQ
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Questions fréquentes
            </h2>
          </div>
          <Accordion type="single" collapsible className="mt-8 space-y-3">
            {FAQ.map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="rounded-2xl border border-[#E3E8F2] bg-white px-4 shadow-sm"
              >
                <AccordionTrigger className="rounded-2xl bg-white px-1 text-left text-sm font-medium hover:bg-white hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-[#E3E8F2] bg-white p-8 text-center shadow-sm sm:p-12">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Une question sur les tarifs ?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Notre équipe répond à toutes vos questions sur la tarification,
              les packs et le paiement sécurisé.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/professeurs"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#111B4D] px-6 text-sm font-bold text-white shadow-sm transition hover:bg-[#1E2A78] sm:w-auto"
              >
                Voir les professeurs
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#CAD7F2] bg-white px-6 text-sm font-bold text-[#111B4D] shadow-sm transition hover:border-[#111B4D] sm:w-auto"
              >
                Nous contacter
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function TariffSignal({
  label,
  value,
  text,
}: {
  label: string;
  value: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-[#E3E8F2] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-[#56617F]">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight text-[#111B4D]">{value}</p>
      <p className="mt-1 text-sm leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
