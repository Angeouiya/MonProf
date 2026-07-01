import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  HelpCircle,
  Info,
  Lock,
  Package,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PublicLayout } from "@/components/layouts/public-layout";
import { Money } from "@/components/shared/money";
import { formatFCFA } from "@/lib/format";

const TIERS = [
  { level: "Primaire", price: 7500, pack4: 28000, pack8: 54000 },
  { level: "Collège", price: 10000, pack4: 38000, pack8: 72000 },
  { level: "Lycée", price: 12500, pack4: 47000, pack8: 90000 },
  { level: "Terminale", price: 15000, pack4: 57000, pack8: 108000 },
  { level: "Université", price: 20000, pack4: 76000, pack8: 144000 },
];

const PACKS = [
  {
    name: "1 séance",
    desc: "Pour un besoin ponctuel : révision d'un chapitre, préparation d'un contrôle, dépannage avant examen.",
    priceNote: "Plein tarif",
    icon: CreditCard,
    useCases: ["Soutien ponctuel", "Révision chapitre", "Préparation contrôle"],
  },
  {
    name: "Pack 4 séances",
    desc: "Idéal pour un suivi hebdomadaire sur un mois. Parfait pour combler des lacunes sur un thème précis.",
    priceNote: "Économie ≈ 5% par séance",
    icon: Package,
    useCases: ["Suivi mensuel", "Préparation BEPC", "Remise à niveau"],
  },
  {
    name: "Pack 8 séances",
    desc: "Suivi régulier sur deux mois pour progresser durablement. Recommandé pour la préparation des examens.",
    priceNote: "Économie ≈ 10% par séance",
    icon: Package,
    useCases: ["Préparation BAC", "Pré-rentrée", "Ciblage concours"],
  },
  {
    name: "Pack 12 séances",
    desc: "Pour un trimestre complet de suivi intensif. Le meilleur rapport qualité-prix pour un objectif long terme.",
    priceNote: "Économie ≈ 15% par séance",
    icon: Package,
    useCases: ["Trimestre complet", "Concours ENA/INFAS", "Préparation longue"],
  },
];

const PAYMENT_STEPS = [
  {
    icon: CreditCard,
    title: "Le client paie en ligne",
    text: "Paiement par Wave, Orange Money, MTN Money, Moov Money ou carte bancaire lors de la réservation.",
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
    icon: Receipt,
    title: "Libération du paiement",
    text: "L'administrateur libère les fonds au professeur, déduction faite de la commission de 20%.",
  },
  {
    icon: Wallet,
    title: "Paiement au professeur",
    text: "Le professeur reçoit son paiement net par mobile money ou virement bancaire sous 48 à 72h.",
  },
  {
    icon: ShieldCheck,
    title: "Garantie litige",
    text: "En cas de problème, le client peut ouvrir un litige. Le paiement est suspendu et notre support arbitre sous 48h.",
  },
];

const FAQ = [
  {
    q: "Pourquoi une commission de 20% ?",
    a: "La commission de 20% finance la vérification des professeurs, le support administratif, la sécurisation des paiements (fonds bloqués), le traitement des litiges et la maintenance de la plateforme. Elle est incluse dans le prix affiché sur chaque profil de professeur.",
  },
  {
    q: "Le prix affiché est-il le prix final ?",
    a: "Oui. Le prix indiqué sur le profil du professeur (séance, pack 4, pack 8) est le montant total que vous payez. Il n'y a aucun frais caché, ni frais de service, ni frais de paiement additionnels.",
  },
  {
    q: "Quand le professeur est-il payé ?",
    a: "Le professeur est payé seulement après la validation du cours par le client et la libération par notre équipe administrative. Les fonds restent bloqués pendant toute la durée du cours. Le délai de versement au professeur est de 48 à 72h après validation.",
  },
  {
    q: "Puis-je me faire rembourser si le cours n'a pas lieu ?",
    a: "Oui. Si le professeur annule ou ne se présente pas, vous êtes intégralement remboursé. Si le cours n'a pas eu lieu pour quelque raison que ce soit, les fonds bloqués vous sont restitués. Vous pouvez ouvrir un litige depuis votre espace client.",
  },
  {
    q: "Que se passe-t-il en cas de litige ?",
    a: "Vous pouvez ouvrir un litige depuis votre espace client avant de valider le cours. Notre support examine la situation sous 48h et arbitre. En cas de problème avéré, vous êtes remboursé et le professeur n'est pas payé.",
  },
  {
    q: "Les packs sont-ils remboursables ?",
    a: "Les séances déjà réalisées dans un pack ne sont pas remboursables. Les séances non réalisées (en cas d'annulation, de problème, etc.) peuvent faire l'objet d'un remboursement au prorata ou d'un report, après ouverture d'un litige ou contact avec le support.",
  },
  {
    q: "Puis-je payer directement le professeur ?",
    a: "Non. Tout paiement doit transiter par la plateforme. Un paiement direct au professeur vous fait perdre la garantie de remboursement et la protection litige. C'est aussi une violation de nos conditions d'utilisation.",
  },
  {
    q: "Quels moyens de paiement acceptez-vous ?",
    a: "Wave, Orange Money, MTN Money, Moov Money et carte bancaire (Visa, Mastercard). Tous les paiements sont sécurisés et les fonds bloqués jusqu'à la fin du cours.",
  },
];

export default function TarifsPage() {
  return (
    <PublicLayout>
      {/* HEADER */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <nav className="mb-3 text-xs text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Accueil</Link>
            <span className="mx-1.5">/</span>
            <span className="text-foreground">Tarifs</span>
          </nav>
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl text-balance">
              Tarifs clairs, paiement sécurisé
            </h1>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Pas de frais cachés. Le prix affiché est le prix payé. La
              commission de 20% de la plateforme est incluse et finance la
              vérification des professeurs, la sécurisation des paiements et le
              support administratif.
            </p>
          </div>
        </div>
      </section>

      {/* GRILLE TARIFAIRE PAR NIVEAU */}
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Grille tarifaire par niveau
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Prix indicatifs par séance. Le prix exact est défini sur chaque
            profil de professeur et peut varier selon l'expérience et la
            spécialité.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Niveau</th>
                    <th className="px-4 py-3 text-right font-medium">Prix / séance</th>
                    <th className="px-4 py-3 text-right font-medium">Commission (20%)</th>
                    <th className="px-4 py-3 text-right font-medium">Net professeur</th>
                    <th className="px-4 py-3 text-right font-medium">Pack 4</th>
                    <th className="px-4 py-3 text-right font-medium">Pack 8</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {TIERS.map((t) => {
                    const commission = Math.round(t.price * 0.2);
                    const net = t.price - commission;
                    return (
                      <tr key={t.level} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground">
                          {t.level}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                          {formatFCFA(t.price)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatFCFA(commission)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-primary font-medium">
                          {formatFCFA(net)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatFCFA(t.pack4)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatFCFA(t.pack8)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              Les packs sont valables 3 mois (pack 4) ou 6 mois (pack 8) à
              compter de la première séance.
            </div>
          </div>
        </div>
      </section>

      {/* PACKS DE COURS */}
      <section className="border-t border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Packs de cours
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Choisissez le format adapté à votre objectif. Plus le pack est
              long, plus le prix par séance est avantageux.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PACKS.map((p) => (
              <div
                key={p.name}
                className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  {p.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.desc}
                </p>
                <p className="mt-3 text-xs font-medium text-primary">
                  {p.priceNote}
                </p>
                <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {p.useCases.map((u) => (
                    <li
                      key={u}
                      className="flex items-start gap-1.5 text-xs text-muted-foreground"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      {u}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PAIEMENT SÉCURISÉ — 8 ÉTAPES */}
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Paiement sécurisé
            </span>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Comment fonctionne le paiement sécurisé
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Le paiement est bloqué sur la plateforme jusqu'à la confirmation
              du cours. Voici le parcours en 8 étapes.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENT_STEPS.map((s, i) => (
              <div
                key={s.title}
                className="relative rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="absolute right-4 top-4 text-3xl font-bold tabular-nums text-muted-foreground/15">
                  {i + 1}
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
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

      {/* EXEMPLE CHIFFRÉ */}
      <section className="border-t border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <Info className="h-3.5 w-3.5 text-primary" />
                Exemple chiffré
              </span>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Cours de Terminale — 1 séance
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                Prenons un cours de Mathématiques niveau Terminale réservé
                auprès d'un professeur vérifié.
              </p>
              <ul className="mt-6 space-y-3">
                <li className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Prix payé par le client</span>
                  <span className="font-bold tabular-nums text-foreground">
                    <Money amount={15000} />
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Commission plateforme (20%)</span>
                  <span className="font-medium tabular-nums text-accent">
                    − <Money amount={3000} />
                  </span>
                </li>
                <li className="flex items-center justify-between rounded-lg border-2 border-primary bg-primary/5 px-4 py-3 text-sm">
                  <span className="font-medium text-foreground">Net reversé au professeur</span>
                  <span className="font-bold tabular-nums text-primary">
                    <Money amount={12000} />
                  </span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Le client paie 15 000 FCFA. Le professeur reçoit 12 000 FCFA
                net après confirmation du cours. La commission de 3 000 FCFA
                finance la plateforme.
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-background p-6 shadow-sm sm:p-8">
              <h3 className="text-sm font-semibold text-foreground">
                Le parcours du paiement
              </h3>
              <ol className="mt-4 space-y-3">
                {[
                  { t: "Réservation", d: "Le client réserve et paie 15 000 FCFA.", v: 15000 },
                  { t: "Blocage", d: "Les 15 000 FCFA sont bloqués sur la plateforme.", v: 15000 },
                  { t: "Cours", d: "Le professeur dispense le cours.", v: null },
                  { t: "Validation client", d: "Le client confirme la bonne réalisation.", v: null },
                  { t: "Libération", d: "L'admin libère le paiement au professeur.", v: null },
                  { t: "Paiement professeur", d: "Le professeur reçoit 12 000 FCFA net.", v: 12000 },
                  { t: "Plateforme", d: "MonProf CI conserve 3 000 FCFA (commission).", v: 3000 },
                ].map((step, i) => (
                  <li key={step.t} className="flex items-start gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </div>
                    <div className="flex flex-1 items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {step.t}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {step.d}
                        </p>
                      </div>
                      {step.v != null && (
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                          {formatFCFA(step.v)}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ TARIFS */}
      <section className="border-t border-border bg-background">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
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
                className="rounded-xl border border-border bg-card px-4 shadow-sm"
              >
                <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
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
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-border bg-primary/5 p-8 text-center sm:p-12">
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
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 sm:w-auto"
              >
                Voir les professeurs
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-6 text-sm font-medium text-foreground transition hover:bg-muted sm:w-auto"
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
