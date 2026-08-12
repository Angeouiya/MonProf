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
import { getPartnerPromotionWindow, PARTNER_REFERRAL_RATE_PERCENT } from "@/lib/partner-referrals";
import { PartnerInterestForm } from "@/app/partenariat/partner-interest-form";

export const dynamic = "force-dynamic";

export default function ClientPartenariatPage() {
  const { startsAt, endsAt } = getPartnerPromotionWindow();

  return (
    <div data-client-partnership-page className="space-y-5">
      <ClientPageHeader
        eyebrow="Partenariat"
        title={`Recommandez Compétence.CI. Gagnez ${PARTNER_REFERRAL_RATE_PERCENT} %.`}
        description="Créez votre lien apporteur, envoyez-le au client, puis laissez le serveur vérifier le paiement Jèko avant toute commission."
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
          { icon: TimerReset, label: "Validité", value: `${formatDate(startsAt)} → ${formatDate(endsAt)}` },
        ]}
      />

      <ClientFocusPanel
        eyebrow="Règle simple"
        title="La commission se calcule sur le montant du cours uniquement."
        description="Transport, frais de service Compétence.CI et frais techniques Jèko sont exclus. Exemple : sur un cours de 20 000 FCFA, la commission apporteur est de 2 000 FCFA."
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
              "Vous créez votre lien apporteur depuis cet onglet.",
              "Le client réserve avec ce lien ou vous déclare avant le paiement.",
              "Jèko confirme le paiement et l’équipe valide la réservation.",
              "L’administration contrôle l’identité puis verse la commission.",
            ].map((item, index) => (
              <div key={item} className="flex gap-3 rounded-lg border border-[#E3E8F2] bg-white p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-sm font-bold text-white">{index + 1}</span>
                <p className="text-sm font-semibold leading-6 text-[#111827]">{item}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-[#DDE6F7] bg-white p-4 text-sm font-medium leading-6 text-[#52627A]">
            Exemple visible : {formatFCFA(20_000)} de cours confirmé donne {formatFCFA(2_000)} de commission. Si le client ne paie pas ou si la réservation n’est pas confirmée, aucune commission n’est créée.
          </div>
        </ClientSurface>

        <div id="contact-partenaire-client" className="scroll-mt-24">
          <PartnerInterestForm />
        </div>
      </div>
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
