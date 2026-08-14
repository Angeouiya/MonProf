import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, TimerReset, WalletCards } from "lucide-react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatFCFA } from "@/lib/format";
import { getPartnerPromotionWindow, PARTNER_REFERRAL_RATE_PERCENT } from "@/lib/partner-referrals";
import { PartnerInterestForm } from "./partner-interest-form";

export default function PartenariatPage() {
  const { startsAt, endsAt } = getPartnerPromotionWindow();
  return (
    <PublicLayout>
      <section className="border-b border-[#E3E8F2] bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-semibold text-[#111B4D]">
              <ShieldCheck className="h-4 w-4" /> Programme lancement
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight text-[#111827] sm:text-5xl">
              Votre client gagne 10 %. Vous gagnez {PARTNER_REFERRAL_RATE_PERCENT} % pendant six mois.
            </h1>
            <p className="mt-4 max-w-xl text-base font-medium leading-7 text-[#64748B]">
              Un code permanent suffit. Après le premier paiement Jèko confirmé, chaque paiement éligible de ce client ajoute votre commission pendant six mois, sans réduire le professeur.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="min-h-12 rounded-2xl">
                <Link href="/professeurs">Trouver un professeur <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" className="min-h-12 rounded-2xl">
                <Link href="#contact-partenaire">Créer mon lien apporteur</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            <RuleCard icon={WalletCards} title="Deux avantages, une règle claire" text={`10 % sur le premier cours du client et ${PARTNER_REFERRAL_RATE_PERCENT} % pour vous sur chaque cours éligible. Transport et frais sont exclus.`} />
            <RuleCard icon={CheckCircle2} title="Paiement uniquement après confirmation" text="La commission devient payable seulement si Jèko confirme le paiement et si la réservation est validée." />
            <RuleCard icon={TimerReset} title="Six mois par client" text={`Codes créés pendant la campagne du ${formatDate(startsAt)} au ${formatDate(endsAt)}. L'attribution individuelle démarre au premier paiement confirmé.`} />
          </div>
        </div>
      </section>

      <section className="bg-[#F8FAFC]">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-[#111827]">Comment ça marche ?</h2>
            <div className="space-y-3">
              {[
                "Vous recommandez Compétence.CI à une personne.",
                "Vous créez votre code partenaire permanent sur mobile ou ordinateur.",
                "Le client vérifie le code avant de payer et reçoit immédiatement 10 % sur le cours.",
                "Le serveur Jèko confirme : votre période de six mois démarre.",
                "Chaque nouveau paiement éligible crée automatiquement votre commission de 10 %.",
                "Vous contactez Compétence.CI avec votre pièce et votre numéro de dépôt.",
                `L’administration verse ${formatFCFA(2_000)} sur un cours de ${formatFCFA(20_000)}.`,
              ].map((item, index) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-[#E3E8F2] bg-white p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111B4D] text-sm font-bold text-white">{index + 1}</span>
                  <p className="text-sm font-semibold leading-6 text-[#111827]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div id="contact-partenaire" className="scroll-mt-24">
            <PartnerInterestForm />
            <p className="mt-3 text-xs font-medium leading-5 text-[#64748B]">
              Le code seul ne crée aucune commission. La preuve principale reste le paiement Jèko confirmé côté serveur et rattaché au client.
            </p>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function RuleCard({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <Card className="border-[#DDE6F7] bg-white">
      <CardContent className="flex gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#111B4D] text-white">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
          <p className="mt-1 text-sm font-medium leading-6 text-[#64748B]">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}
