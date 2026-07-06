import Link from "next/link";
import { CalendarCheck, LifeBuoy, Lock, Mail, ShieldCheck, User, UserCog } from "lucide-react";
import {
  ClientAppRail,
  ClientMetricStrip,
  ClientPageHeader,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { Button } from "@/components/ui/button";
import { ClientPasswordSettingsForm } from "./settings-client";

export const dynamic = "force-dynamic";

export default function ClientParametresPage() {
  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow="Compte"
        title="Paramètres"
        description="Gérez la sécurité de votre compte client et les accès importants sans OTP."
      />

      <ClientMetricStrip
        metrics={[
          { icon: ShieldCheck, label: "Sécurité", value: "Modifiable" },
          { icon: Mail, label: "Oubli", value: "Lien email" },
          { icon: Lock, label: "OTP", value: "Non utilisé" },
        ]}
      />

      <ClientAppRail
        items={[
          { href: "/client/profil", icon: User, label: "Profil", value: "Coordonnées" },
          { href: "/client/parametres", icon: UserCog, label: "Sécurité", value: "Mot de passe", active: true },
          { href: "/client/reservations", icon: CalendarCheck, label: "Dossiers", value: "Réservations" },
          { href: "/client/support", icon: LifeBuoy, label: "Service client", value: "Aide compte" },
        ]}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ClientSurface>
          <ClientSectionTitle
            eyebrow="Sécurité"
            title="Modifier mon mot de passe"
            description="Saisissez votre mot de passe actuel, puis choisissez un nouveau mot de passe."
          />
          <ClientPasswordSettingsForm />
        </ClientSurface>

        <ClientSurface compact>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              <UserCog className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#111827]">Accès client</h2>
              <p className="mt-1 text-sm font-medium leading-6 text-[#64748B]">
                Le client peut changer son mot de passe ici. En cas d'oubli, il reçoit un lien sécurisé par email, sans code OTP.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-2">
            <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
              <Link href="/mot-de-passe-oublie">Demander un lien email</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
              <Link href="/client/notifications">Voir mes notifications</Link>
            </Button>
          </div>
        </ClientSurface>
      </div>
    </div>
  );
}
