import Link from "next/link";
import { Lock, Mail, Phone, ShieldCheck, WalletCards } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requireTeacher } from "@/lib/teacher-auth";
import { Button } from "@/components/ui/button";
import { InfoLine, PortalCard, ProfessorPageHeader } from "@/components/professor/professor-ui";
import { TeacherPasswordSettingsForm, TeacherPaymentProfileSettingsForm } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function ProfesseurParametresPage() {
  const { teacher } = await requireTeacher();
  const profile = await db.teacher.findUnique({
    where: { id: teacher.id },
    select: {
      fullName: true,
      professionalName: true,
      phone: true,
      email: true,
      portalPhone: true,
      portalAccessEnabled: true,
      portalLastLoginAt: true,
      defaultPayoutMethod: true,
      defaultPayoutPhone: true,
      payoutInstructions: true,
    },
  });

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <ProfessorPageHeader
        title="Paramètres"
        description="Sécurité de votre accès professeur léger. Aucun OTP n'est demandé : le changement se fait depuis la session connectée."
        action={
          <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
            <Link href="/professeur/profil">Voir mon profil</Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
        <PortalCard>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">Modifier mon mot de passe</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
                Ce mot de passe donne accès uniquement à votre espace professeur Compétence.
              </p>
            </div>
          </div>
          <TeacherPasswordSettingsForm />
        </PortalCard>

        <PortalCard>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              <WalletCards className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">Coordonnées de paiement</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
                Ces informations préremplissent vos demandes de paiement. L'administration garde la validation finale avant tout versement.
              </p>
            </div>
          </div>
          <TeacherPaymentProfileSettingsForm
            defaultMethod={profile.defaultPayoutMethod}
            defaultPhone={profile.defaultPayoutPhone}
            payoutInstructions={profile.payoutInstructions}
            fallbackPhone={profile.phone}
          />
        </PortalCard>
        </div>

        <PortalCard>
          <h2 className="text-base font-semibold text-[#111827]">Accès professeur</h2>
          <div className="mt-4">
            <InfoLine label="Nom" value={profile.professionalName || profile.fullName} />
            <InfoLine label="Téléphone fiche" value={profile.phone} />
            <InfoLine label="Téléphone connexion" value={profile.portalPhone || profile.phone} />
            <InfoLine label="Email" value={profile.email || "Non renseigné"} />
            <InfoLine label="Accès portail" value={profile.portalAccessEnabled ? "Activé" : "Désactivé"} />
            <InfoLine label="Dernière connexion" value={formatDateTime(profile.portalLastLoginAt)} />
          </div>
          <div className="mt-4 grid gap-2 rounded-lg border border-[#E3E8F2] bg-white p-3 text-xs font-semibold leading-5 text-[#64748B]">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
              L'administration garde la main sur vos réservations, paiements et notifications.
            </p>
            <p className="flex items-start gap-2">
              <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
              Le numéro de connexion est celui validé par l'administration.
            </p>
            <p className="flex items-start gap-2">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
              Les échanges sensibles restent historisés dans Messages et Notifications.
            </p>
          </div>
        </PortalCard>
      </div>
    </div>
  );
}
