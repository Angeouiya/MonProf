import Link from "next/link";
import {
  ArrowRight,
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
    desc: "Pour un besoin ponctuel ou une révision ciblée.",
    priceNote: "Plein tarif",
    icon: WalletCards,
    useCases: ["Soutien ponctuel", "Révision chapitre", "Préparation contrôle"],
  },
  {
    name: "Pack 4 séances",
    desc: "Un mois de suivi pour progresser sur un thème précis.",
    priceNote: "Prix stable, suivi mensuel",
    icon: Package,
    useCases: ["Suivi mensuel", "Préparation BEPC", "Remise à niveau"],
  },
  {
    name: "Pack 8 séances",
    desc: "Deux mois de cours pour consolider les acquis.",
    priceNote: "Remise 5% intégrée",
    icon: Package,
    useCases: ["Préparation BAC", "Pré-rentrée", "Ciblage concours"],
  },
  {
    name: "Pack 12 séances",
    desc: "Un trimestre complet pour un objectif long terme.",
    priceNote: "Remise 7% intégrée",
    icon: Package,
    useCases: ["Trimestre complet", "Concours ENA/INFAS", "Préparation longue"],
  },
  {
    name: "Pack personnalisé",
    desc: "Pour groupe, entreprise ou planning particulier.",
    priceNote: "Sur devis",
    icon: Package,
    useCases: ["Entreprise", "Formation métier", "Planning complexe"],
  },
];

const PAYMENT_STEPS = [
  {
    icon: WalletCards,
    title: "PayDunya",
    text: "Le paiement se fait uniquement sur PayDunya.",
  },
  {
    icon: Lock,
    title: "Fonds sécurisés",
    text: "Le montant reste protégé pendant le suivi.",
  },
  {
    icon: CheckCircle2,
    title: "Cours confirmé",
    text: "Vous confirmez après le cours depuis l'espace client.",
  },
  {
    icon: ShieldCheck,
    title: "Support",
    text: "En cas de problème, le dossier reste traçable.",
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
    text: "Le client n'est pas pénalisé. Compétence propose un remplacement, un report ou un remboursement.",
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
          <nav className="mb-5 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-[#64748B]">
            <Link href="/" className="inline-flex min-h-11 items-center px-1 hover:text-[#111B4D]">Accueil</Link>
            <span className="mx-1.5">/</span>
            <span className="text-[#111827]">Tarifs</span>
          </nav>
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Fonds bloqués jusqu'à confirmation
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#111827] sm:text-5xl text-balance">
              Tarifs clairs, paiement sécurisé
            </h1>
            <p className="mt-4 text-base font-medium leading-7 text-[#64748B] sm:text-lg">
              Le client voit le total avant paiement. PayDunya gère le paiement, Compétence suit le dossier jusqu'à confirmation.
            </p>
          </div>
        </div>
      </section>

      {/* GRILLE TARIFAIRE OFFICIELLE */}
      <section className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <h2 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
            Grille tarifaire officielle
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[#64748B] sm:text-base">
            Le prix dépend du besoin, du niveau, du format et du déplacement. Le minimum 7 500 F reste réservé aux cas simples.
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

          <div className="mt-8 rounded-[1.15rem] border border-[#E3E8F2] bg-white p-3 shadow-sm sm:p-4">
            <div className="grid gap-3 lg:hidden">
              {TIERS.map((t) => (
                <article key={t.name} className="rounded-2xl border border-[#E3E8F2] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#111827]">{t.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[#64748B]">{t.usage}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-[#111B4D]">
                      {t.price === null ? "Sur devis" : formatFCFA(t.price)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm font-medium leading-6 text-[#64748B]">{t.rule}</p>
                </article>
              ))}
            </div>

            <div className="hidden lg:block">
              <table className="w-full table-fixed text-sm">
                <thead className="bg-white text-left text-xs uppercase tracking-wide text-[#64748B]">
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
                        <td className="px-4 py-3 font-semibold text-[#111827]">
                          {t.name}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#111827]">
                          {t.price === null ? "Sur devis" : formatFCFA(t.price)}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#64748B]">
                          {t.usage}
                        </td>
                        <td className="px-4 py-3 font-medium leading-6 text-[#64748B]">
                          {t.rule}
                        </td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#E3E8F2] bg-white px-4 py-3 text-xs font-medium leading-5 text-[#64748B]">
              Chaque séance dure 2h. Les frais de déplacement sont séparés et
              affichés avant paiement lorsque le cours est à domicile.
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.values(TRANSPORT_FEES).map((fee) => (
              <div key={fee.key} className="rounded-[1.15rem] border border-[#E3E8F2] bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-[#111827]">{fee.label}</p>
                <p className="mt-2 text-lg font-semibold text-[#111B4D]">
                  {fee.amount === null ? "Sur devis" : formatFCFA(fee.amount)}
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                  Frais affichés avant paiement, sans frais cachés côté client.
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-[1.15rem] border border-[#E3E8F2] bg-white p-4">
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-sm font-semibold text-[#111B4D]">Calcul Grand Abidjan automatique</p>
                <p className="mt-2 text-sm leading-relaxed text-[#394568]">
                  À domicile, la plateforme compare la zone du professeur et celle du client : même zone, proche, éloignée ou devis admin.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs font-semibold text-[#111B4D]">
                  {GRAND_ABIDJAN_AREAS.slice(0, 10).map((area) => (
                    <span key={area}>{area}</span>
                  ))}
                  <span>+{GRAND_ABIDJAN_AREAS.length - 10}</span>
                </div>
              </div>
              <div className="rounded-[1.15rem] border border-[#E3E8F2] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#56617F]">Exemples de routes proches</p>
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
            <h2 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Packs de cours
            </h2>
            <p className="mt-3 text-sm font-medium text-[#64748B] sm:text-base">
              Une séance pour tester, un pack pour progresser régulièrement.
            </p>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {PACKS.map((p) => (
              <div
                key={p.name}
                className="flex flex-col rounded-[1.15rem] border border-[#E3E8F2] bg-white p-5 shadow-sm transition hover:border-[#111B4D]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-[#111827]">
                  {p.name}
                </h3>
                <p className="mt-2 text-sm font-medium leading-relaxed text-[#64748B]">
                  {p.desc}
                </p>
                <p className="mt-3 text-xs font-medium text-[#111B4D]">
                  {p.priceNote}
                </p>
                <ul className="mt-3 space-y-1.5 border-t border-[#E3E8F2] pt-3">
                  {p.useCases.map((u) => (
                    <li
                      key={u}
                      className="flex items-start gap-1.5 text-xs font-medium text-[#64748B]"
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
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#111B4D]" />
              Paiement sécurisé
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Paiement sécurisé PayDunya
            </h2>
            <p className="mt-3 text-sm font-medium text-[#64748B] sm:text-base">
              Aucun numéro ni moyen de paiement n'est saisi sur Compétence.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENT_STEPS.map((s, i) => (
              <div
                key={s.title}
                className="relative rounded-[1.15rem] border border-[#E3E8F2] bg-white p-5 shadow-sm transition hover:border-[#111B4D]"
              >
                <div className="absolute right-4 top-4 text-3xl font-semibold tabular-nums text-[#E3E8F2]">
                  {i + 1}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-[#111827]">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-xs font-medium leading-relaxed text-[#64748B]">
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
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
                <RefreshCw className="h-3.5 w-3.5 text-[#111B4D]" />
                Annulation encadrée
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
                Règles d'annulation de réservation
              </h2>
              <p className="mt-3 text-sm font-medium leading-relaxed text-[#64748B] sm:text-base">
                Les frais dépendent du délai avant le cours. Le client voit la règle avant confirmation.
              </p>
              <div className="mt-5 rounded-[1.15rem] border border-[#E3E8F2] bg-white p-4 text-sm shadow-sm">
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" />
                  <p className="font-medium leading-6 text-[#64748B]">
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
                    <div key={rule.title} className={`rounded-[1.15rem] border p-5 shadow-sm ${rule.tone}`}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold">{rule.title}</h3>
                        <span className="text-xs font-semibold text-[#111B4D]">{rule.fee}</span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed">{rule.text}</p>
                      <div className="mt-4 grid gap-2 rounded-2xl border border-[#E3E8F2] bg-white p-3 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-[#56617F]">Exemple sur {formatFCFA(CANCELLATION_EXAMPLE_AMOUNT)}</span>
                          <span className="font-semibold">
                            {rule.manualReview ? "À arbitrer" : `${formatFCFA(refundAmount)} remboursables`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-[#56617F]">Frais estimés</span>
                          <span className="font-semibold">
                            {rule.manualReview ? `jusqu'à ${formatFCFA(feeAmount)}` : formatFCFA(feeAmount)}
                          </span>
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
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
              <HelpCircle className="h-3.5 w-3.5 text-[#111B4D]" />
              FAQ
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Questions fréquentes
            </h2>
          </div>
          <Accordion type="single" collapsible className="mt-8 space-y-3">
            {FAQ.slice(0, 4).map((item, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="rounded-2xl border border-[#E3E8F2] bg-white px-4 shadow-sm"
              >
                <AccordionTrigger className="rounded-2xl bg-white px-1 text-left text-sm font-medium hover:bg-white hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm font-medium leading-relaxed text-[#64748B]">
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
          <div className="rounded-[1.15rem] border border-[#E3E8F2] bg-white p-8 text-center shadow-sm sm:p-12">
            <h2 className="text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
              Une question sur les tarifs ?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-[#64748B] sm:text-base">
              Notre équipe répond sur les tarifs, les packs et le paiement sécurisé.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/professeurs"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#111B4D] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E2A78] sm:w-auto"
              >
                Voir les professeurs
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#CAD7F2] bg-white px-6 text-sm font-semibold text-[#111B4D] shadow-sm transition hover:border-[#111B4D] sm:w-auto"
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
    <div className="rounded-[1.15rem] border border-[#E3E8F2] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#56617F]">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-[#111B4D]">{value}</p>
      <p className="mt-1 text-sm font-medium leading-5 text-[#64748B]">{text}</p>
    </div>
  );
}
