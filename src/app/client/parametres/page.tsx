import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bell, CheckCircle2, Lock, Mail, ShieldCheck, UserCog } from "lucide-react";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { isOwnerAdminAccount } from "@/lib/owner-account";
import {
  CLIENT_COMMAND_CENTERS_ENABLED,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientProcessTracker,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { Button } from "@/components/ui/button";
import { ClientPasswordSettingsForm } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function ClientParametresPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/connexion?from=/client/parametres");
  const ownerAdmin = isOwnerAdminAccount({ role: sessionUser.role, email: sessionUser.email });
  if (sessionUser.role !== "CLIENT" && !ownerAdmin) redirect(sessionUser.role === "ADMIN" ? "/admin" : "/professeur");

  const profile = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      email: true,
      name: true,
      phone: true,
      commune: true,
      quartier: true,
      updatedAt: true,
    },
  });
  const unreadNotifications = await db.notification.count({
    where: ownerAdmin
      ? {
          recipientType: "ADMIN",
          read: false,
        }
      : {
          recipientType: "CLIENT",
          read: false,
          OR: [{ userId: sessionUser.id }, { clientId: sessionUser.id }],
        },
  });
  const activeBookings = await db.booking.count({
    where: ownerAdmin
      ? { id: "__owner_admin_no_client_booking__" }
      : {
          clientId: sessionUser.id,
          status: { in: ["PAID", "PENDING_ADMIN_VALIDATION", "CONFIRMED", "ASSIGNED", "IN_PROGRESS", "PENDING_CLIENT_VALIDATION"] },
        },
  });
  const accountName = profile?.name ?? sessionUser.name ?? (ownerAdmin ? "Propriétaire" : "Client");
  const hasEmail = Boolean(profile?.email ?? sessionUser.email);
  const hasPhone = Boolean(profile?.phone);
  const hasArea = Boolean(profile?.commune && profile?.quartier);
  const completedFields = [accountName, profile?.email ?? sessionUser.email, profile?.phone, profile?.commune, profile?.quartier].filter(Boolean).length;
  const profileCompletion = Math.round((completedFields / 5) * 100);
  const recoveryReady = hasEmail;
  const accountReady = ownerAdmin ? recoveryReady : recoveryReady && hasPhone && hasArea;

  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow={ownerAdmin ? "Compte propriétaire" : "Compte"}
        title="Paramètres"
        description={ownerAdmin
          ? "Modifiez le mot de passe du compte administrateur propriétaire depuis l'espace compte rattaché, sans OTP."
          : "Pilotez la sécurité de votre compte client, votre accès email et vos actions sensibles sans code OTP."
        }
      />

      <ClientMetricStrip
        metrics={[
          { icon: ShieldCheck, label: "Compte", value: ownerAdmin ? "Admin propriétaire" : accountReady ? "Prêt" : "À compléter", attention: !accountReady },
          { icon: Mail, label: "Récupération", value: recoveryReady ? "Email sécurisé" : "Email requis", attention: !recoveryReady },
          { icon: Bell, label: "Alertes", value: unreadNotifications, attention: unreadNotifications > 0 },
          { icon: Lock, label: "OTP", value: "Non utilisé" },
        ]}
      />

      {CLIENT_COMMAND_CENTERS_ENABLED && (
        <SettingsCommandCenter
          name={accountName}
          email={profile?.email ?? sessionUser.email ?? ""}
          phone={profile?.phone ?? ""}
          area={[profile?.commune, profile?.quartier].filter(Boolean).join(" · ")}
          profileCompletion={profileCompletion}
          recoveryReady={recoveryReady}
          accountReady={accountReady}
          unreadNotifications={unreadNotifications}
          activeBookings={activeBookings}
          ownerAdmin={ownerAdmin}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ClientSurface id="mot-de-passe" className="scroll-mt-24">
          <ClientSectionTitle
            eyebrow="Sécurité"
            title="Modifier mon mot de passe"
            description="Saisissez votre mot de passe actuel, puis choisissez un nouveau mot de passe."
          />
          <ClientPasswordSettingsForm ownerAdmin={ownerAdmin} />
        </ClientSurface>

        <ClientSurface compact>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              <UserCog className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[#111827]">{ownerAdmin ? "Accès propriétaire" : "Accès client"}</h2>
              <p className="mt-1 text-sm font-medium leading-6 text-[#64748B]">
                {ownerAdmin
                  ? "Seul le compte propriétaire autorisé peut changer ici le mot de passe administrateur. En cas d'oubli, le lien sécurisé arrive par email, sans OTP."
                  : "Le client peut changer son mot de passe ici. En cas d'oubli, il reçoit un lien sécurisé par email, sans code OTP."
                }
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

function SettingsCommandCenter({
  name,
  email,
  phone,
  area,
  profileCompletion,
  recoveryReady,
  accountReady,
  unreadNotifications,
  activeBookings,
  ownerAdmin,
}: {
  name: string;
  email: string;
  phone: string;
  area: string;
  profileCompletion: number;
  recoveryReady: boolean;
  accountReady: boolean;
  unreadNotifications: number;
  activeBookings: number;
  ownerAdmin: boolean;
}) {
  return (
    <ClientSurface compact className="overflow-hidden rounded-lg border border-[#DDE3EE] p-0" data-client-settings-command-center>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.8fr)]">
        <div className="space-y-4 p-4 min-[640px]:p-5">
          <div className="flex flex-col gap-4 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Centre de sécurité</p>
              <h2 className="mt-1 text-lg font-semibold leading-tight text-[#111827]">
                {accountReady ? "Votre compte est prêt pour les réservations" : "Quelques informations renforcent votre compte"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#64748B]">
                {ownerAdmin
                  ? "Ce compte est le point de contrôle sensible pour la sécurité administrateur. Le changement de mot de passe exige toujours l'ancien mot de passe."
                  : "Le service client utilise ces informations pour confirmer vos cours, suivre vos paiements et vous aider en cas de récupération du compte."
                }
              </p>
            </div>
            <span className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-[#111B4D] bg-white px-3 text-sm font-semibold text-[#111B4D]">
              <CheckCircle2 className="h-4 w-4" />
              {accountReady ? "Compte vérifiable" : `${profileCompletion}% complété`}
            </span>
          </div>

          <div className="grid gap-2 min-[520px]:grid-cols-2 xl:grid-cols-4">
            <ClientInfoPill label="Nom" value={name} strong />
            <ClientInfoPill label="Email" value={email || "À confirmer"} strong={Boolean(email)} />
            <ClientInfoPill label="Téléphone" value={phone || "À renseigner"} strong={Boolean(phone)} />
            <ClientInfoPill label="Zone" value={area || "À renseigner"} strong={Boolean(area)} />
          </div>

          <ClientProcessTracker
            steps={[
              {
                label: "Identité client",
                state: profileCompletion >= 40 ? "done" : "current",
                hint: name ? "Nom disponible pour vos dossiers." : "Nom requis pour les réservations.",
              },
              {
                label: "Contact opérationnel",
                state: phone ? "done" : profileCompletion >= 40 ? "current" : "pending",
                hint: phone ? "Téléphone disponible pour les confirmations." : "Ajoutez un téléphone dans le profil.",
              },
              {
                label: "Sécurité email",
                state: recoveryReady ? "done" : "current",
                hint: recoveryReady ? "Mot de passe oublié par lien email." : "Un email est nécessaire pour récupérer l'accès.",
              },
            ]}
          />
        </div>

        <aside className="border-t border-[#E6EAF3] bg-white p-4 min-[640px]:p-5 lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Action prioritaire</p>
              <h3 className="mt-1 text-base font-semibold leading-tight text-[#111827]">
                {!accountReady ? "Compléter vos coordonnées" : unreadNotifications > 0 ? "Consulter vos alertes" : "Changer le mot de passe si nécessaire"}
              </h3>
              <p className="mt-1 text-sm font-medium leading-6 text-[#64748B]">
                {activeBookings > 0
                  ? `${activeBookings} dossier(s) actif(s) dépendent d'informations de contact fiables.`
                  : ownerAdmin
                    ? "Votre accès propriétaire reste séparé des comptes clients ordinaires."
                    : "Votre compte reste prêt pour une prochaine réservation."}
              </p>
            </div>
            <div className="grid gap-2">
              {!accountReady ? (
                <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                  <Link href="/client/profil">
                    Compléter le profil
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                  <a href="#mot-de-passe">
                    Modifier le mot de passe
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                <Link href={unreadNotifications > 0 ? "/client/notifications" : "/mot-de-passe-oublie"}>
                  {unreadNotifications > 0 ? "Voir les notifications" : "Lien de récupération"}
                </Link>
              </Button>
            </div>
            <div className="mt-auto rounded-lg border border-[#E3E8F2] bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Règle de sécurité</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#111827]">
                Aucun OTP : la récupération client passe uniquement par un lien email sécurisé.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </ClientSurface>
  );
}
