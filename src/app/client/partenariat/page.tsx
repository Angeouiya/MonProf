import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, TimerReset, WalletCards } from "lucide-react";
import {
  ClientFocusPanel,
  ClientMetricStrip,
  ClientPageHeader,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { Button } from "@/components/ui/button";
import { formatFCFA } from "@/lib/format";
import { PARTNER_REFERRAL_RATE_PERCENT } from "@/lib/partner-referrals";
import { PartnerInterestForm } from "@/app/partenariat/partner-interest-form";

export const dynamic = "force-dynamic";

export default function ClientPartenariatPage() {
  return (
    <div data-client-partnership-page className="space-y-5">
      <ClientPageHeader
        eyebrow="Partenariat"
        title={`Recommandez Compétence.CI. Gagnez ${PARTNER_REFERRAL_RATE_PERCENT} %.`}
        description="Votre client reçoit 10 % sur son premier cours. Vous recevez 10 % sur chacun de ses paiements éligibles pendant six mois."
        backHref="/client"
      >
        <Button asChild className="min-h-11 rounded-lg">
          <Link href="#contact-partenaire-client">
            Créer mon lien <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </ClientPageHeader>

      <ClientMetricStrip
        metrics={[
          { icon: WalletCards, label: "Commission", value: `${PARTNER_REFERRAL_RATE_PERCENT} % du cours`, attention: true },
          { icon: CheckCircle2, label: "Paiement", value: "Après Jèko confirmé" },
          { icon: TimerReset, label: "Attribution", value: "6 mois par client" },
        ]}
      />

      <ClientFocusPanel
        eyebrow="Règle simple"
        title="La commission se calcule sur le montant du cours uniquement."
        description="Transport, frais de service Compétence.CI et frais techniques Jèko sont exclus. Le professeur garde son montant exact. Exemple : sur un cours éligible de 20 000 FCFA, votre commission est de 2 000 FCFA."
        icon={ShieldCheck}
        action={(
          <Button asChild variant="outline" className="min-h-11 w-full rounded-lg">
            <Link href="/conditions-utilisation">Lire les règles</Link>
          </Button>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <ClientSurface>
          <ClientSectionTitle
            title="Comment ça marche ?"
            description="Un parcours court, visible et contrôlé côté serveur."
          />
          <div className="mt-4 space-y-2">
            {[
              "Vous recommandez Compétence.CI à une personne.",
              "Vous créez une fois votre code partenaire permanent.",
              "Le client le vérifie avant son premier paiement et reçoit -10 %.",
              "Jèko confirme le paiement : l’attribution de six mois démarre.",
              "Chaque paiement éligible ajoute automatiquement 10 % à votre lot.",
              "L’administration regroupe toutes vos commissions par numéro.",
            ].map((item, index) => (
              <div key={item} className="flex gap-3 rounded-lg border border-[#E3E8F2] bg-white p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-sm font-bold text-white">{index + 1}</span>
                <p className="text-sm font-semibold leading-6 text-[#111827]">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-[#DDE6F7] bg-white p-4 text-sm font-medium leading-6 text-[#52627A]">
            Exemple visible : {formatFCFA(20_000)} de cours confirmé donne {formatFCFA(2_000)} de commission à chaque achat pendant six mois. Un faux paiement ou un paiement abandonné ne génère rien.
          </div>
        </ClientSurface>

        <div id="contact-partenaire-client" className="scroll-mt-24">
          <PartnerInterestForm />
        </div>
      </div>
    </div>
  );
}
