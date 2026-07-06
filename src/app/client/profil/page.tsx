"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ClientAppRail,
  ClientInfoPill,
  ClientMetricStrip,
  ClientPageHeader,
  ClientProcessTracker,
  ClientSectionTitle,
  ClientSurface,
} from "@/components/shared/client-page-primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Save,
  Loader2,
  ShieldCheck,
  Settings,
  CalendarCheck,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  ArrowRight,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";

type Profile = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  commune: string | null;
  quartier: string | null;
};

const COMMUNES = [
  "Cocody", "Angré", "Riviera", "Deux Plateaux", "Bingerville",
  "Yopougon", "Abobo", "Marcory", "Koumassi", "Treichville",
  "Plateau", "Port-Bouët", "Adjamé", "Attécoubé", "Songon",
];

export default function ProfilPage() {
  const { update: updateSession } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [commune, setCommune] = useState("");
  const [quartier, setQuartier] = useState("");
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => {
    fetch("/api/client/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.user) {
          setProfile(data.user);
          setName(data.user.name ?? "");
          setPhone(data.user.phone ?? "");
          setCommune(data.user.commune ?? "");
          setQuartier(data.user.quartier ?? "");
        }
      })
      .catch(() => toast.error("Erreur de chargement du profil"))
      .finally(() => setLoadingProfile(false));
  }, []);

  async function persistInfo() {
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return false;
    }
    setSavingInfo(true);
    try {
      const res = await fetch("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          commune: commune.trim(),
          quartier: quartier.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return false;
      }
      toast.success("Profil mis à jour");
      if (data.user) {
        setProfile(data.user);
        setName(data.user.name ?? "");
        setPhone(data.user.phone ?? "");
        setCommune(data.user.commune ?? "");
        setQuartier(data.user.quartier ?? "");
      }
      if (updateSession) {
        await updateSession({ name: name.trim() });
      }
      return true;
    } catch {
      toast.error("Erreur réseau");
      return false;
    } finally {
      setSavingInfo(false);
    }
  }

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    await persistInfo();
  }

  function resetInfo() {
    if (!profile) return;
    setName(profile.name ?? "");
    setPhone(profile.phone ?? "");
    setCommune(profile.commune ?? "");
    setQuartier(profile.quartier ?? "");
  }

  if (loadingProfile) {
    return (
      <div className="space-y-6">
        <ClientPageHeader eyebrow="Compte" title="Mon profil" description="Préparation de votre espace client sécurisé." />
        <ProfileSkeleton />
      </div>
    );
  }

  const completedFields = [name, phone, commune, quartier].filter((value) => value.trim().length > 0).length;
  const profileCompletion = Math.round((completedFields / 4) * 100);
  const missingProfileItems = [
    !name.trim() ? "Nom complet" : "",
    !phone.trim() ? "Téléphone" : "",
    !commune.trim() ? "Commune" : "",
    !quartier.trim() ? "Quartier" : "",
  ].filter(Boolean);
  const profileDirty = Boolean(
    profile && (
      name !== (profile.name ?? "") ||
      phone !== (profile.phone ?? "") ||
      commune !== (profile.commune ?? "") ||
      quartier !== (profile.quartier ?? "")
    ),
  );

  return (
    <div className="space-y-5">
      <ClientPageHeader
        eyebrow="Compte client"
        title={name || "Client Compétence"}
        description={profile?.email}
      >
        <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold text-[#111B4D]">
          <ShieldCheck className="h-4 w-4" />
          Compte sécurisé
        </div>
        <Button asChild className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
          <Link href="/client/rechercher">
            Trouver un professeur
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </ClientPageHeader>

      <ClientMetricStrip
        metrics={[
          { icon: User, label: "Profil", value: `${profileCompletion}%`, attention: profileCompletion < 75 },
          { icon: MapPin, label: "Zone", value: commune || "À compléter" },
          { icon: ShieldCheck, label: "Sécurité", value: "Active" },
        ]}
      />

      <ClientAppRail
        items={[
          { href: "/client/profil", icon: User, label: "Profil", value: "Coordonnées", active: true },
          { href: "/client/parametres", icon: Settings, label: "Sécurité", value: "Mot de passe" },
          { href: "/client/reservations", icon: CalendarCheck, label: "Dossiers", value: "Réservations" },
          { href: "/client/service-client", icon: LifeBuoy, label: "Service client", value: "Aide compte" },
        ]}
      />

      <ProfileCommandCenter
        name={name}
        email={profile?.email ?? ""}
        phone={phone}
        commune={commune}
        quartier={quartier}
        completion={profileCompletion}
        missingItems={missingProfileItems}
        dirty={profileDirty}
        saving={savingInfo}
        onSave={() => void persistInfo()}
        onReset={resetInfo}
      />

      {profileDirty && (
        <div
          data-client-profile-unsaved
          className="sticky top-16 z-30 rounded-lg border border-[#111B4D] bg-white p-3 shadow-[0_16px_40px_rgba(17,27,77,0.10)]"
        >
          <div className="flex flex-col gap-3 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111827]">Modifications en attente</p>
              <p className="mt-0.5 text-xs font-medium leading-5 text-[#64748B]">
                Enregistrez vos coordonnées pour que les prochaines réservations utilisent les bonnes informations.
              </p>
            </div>
            <div className="grid gap-2 min-[420px]:grid-cols-2 min-[640px]:flex min-[640px]:shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={resetInfo}
                disabled={savingInfo}
                className="min-h-11 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={() => void persistInfo()}
                disabled={savingInfo || !name.trim()}
                className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]"
                data-client-profile-sticky-save
              >
                {savingInfo ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Enregistrer</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <ClientSurface compact id="coordonnees">
              <ClientSectionTitle
                eyebrow="Identité"
                title="Informations clés"
                description="Données utilisées pour les réservations et le service client."
              />
              <div className="mt-5 space-y-2">
                <ProfileInfoLine icon={Mail} label="Email" value={profile?.email ?? "—"} />
                <ProfileInfoLine icon={Phone} label="Téléphone" value={phone || "À renseigner"} />
                <ProfileInfoLine icon={MapPin} label="Adresse" value={[commune, quartier].filter(Boolean).join(" · ") || "À renseigner"} />
              </div>

              <div className="mt-5 rounded-lg border border-[#E3E8F2] bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Complétude</p>
                  <p className="text-xs font-semibold text-[#111B4D]">{profileCompletion}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div className="h-full rounded-full bg-[#111B4D]" style={{ width: `${profileCompletion}%` }} />
                </div>
                <p className="mt-2 text-xs leading-5 text-[#64748B]">
                  Un profil complet rend les confirmations plus rapides pour les cours à domicile et les suivis du service client.
                </p>
              </div>

              <div className="mt-3 rounded-lg border border-[#DDE6F7] bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">À compléter</p>
                {missingProfileItems.length === 0 ? (
                  <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#111B4D]">
                    <CheckCircle2 className="h-4 w-4" />
                    Profil prêt pour les réservations
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {missingProfileItems.map((item) => (
                      <span key={item} className="rounded-lg border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-semibold text-[#111B4D]">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
          </ClientSurface>
        </aside>

        <div className="grid gap-5">
          <ClientSurface compact>
            <ClientSectionTitle
              title={
                <span className="inline-flex items-center gap-2">
                  <User className="h-4 w-4 text-[#111B4D]" />
                  Coordonnées
                </span>
              }
              description="Nom, téléphone et zone de cours."
            />
            <form onSubmit={saveInfo} className="client-account-form space-y-3" data-client-profile-form>
              <div className="grid gap-3 min-[640px]:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                <div className="sm:col-span-2 lg:col-span-1 2xl:col-span-2">
                <Label htmlFor="name">Nom complet *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11 rounded-lg border-[#DDE6F7]" data-client-profile-name />
              </div>
                <div className="sm:col-span-2 lg:col-span-1 2xl:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email ?? ""} disabled className="mt-1.5 h-11 rounded-lg border-[#DDE6F7] bg-white" />
                <p className="mt-1 text-xs text-[#64748B]">L'email ne peut pas être modifié.</p>
              </div>
              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 h-11 rounded-lg border-[#DDE6F7]"
                  placeholder="+225 07 00 00 00 00"
                  inputMode="tel"
                  data-client-profile-phone
                />
              </div>
              <div>
                <Label htmlFor="commune">Commune</Label>
                <select
                  id="commune"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-[#DDE6F7] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#9AAAD0] focus:ring-2 focus:ring-[#DDE6F7]"
                  data-client-profile-commune
                >
                  <option value="">— Aucune —</option>
                  {COMMUNES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="quartier">Quartier</Label>
                <Input
                  id="quartier"
                  value={quartier}
                  onChange={(e) => setQuartier(e.target.value)}
                  className="mt-1.5 h-11 rounded-lg border-[#DDE6F7]"
                  placeholder="Ex: Riviera Palmeraie"
                  data-client-profile-quartier
                />
              </div>
              </div>
              <div className="rounded-lg border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#64748B]">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                Ces informations restent privées et servent uniquement à organiser vos réservations.
              </div>
              <Button type="submit" disabled={savingInfo || !profileDirty || !name.trim()} className="min-h-11 w-full rounded-lg min-[640px]:w-auto" data-client-profile-save>
                {savingInfo ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                ) : !profileDirty ? (
                  <><CheckCircle2 className="mr-2 h-4 w-4" /> Informations à jour</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Enregistrer</>
                )}
              </Button>
            </form>
          </ClientSurface>

          <ClientSurface compact>
            <div className="flex flex-col gap-3 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
              <div className="min-w-0">
                <p className="inline-flex items-center gap-2 text-base font-semibold text-[#111827]">
                  <LifeBuoy className="h-4 w-4 text-[#111B4D]" />
                  Besoin d'aide sur votre compte ?
                </p>
                <p className="mt-1 text-sm font-medium leading-6 text-[#64748B]">
                  Pour une adresse, un numéro ou une réservation sensible, le service client garde une trace claire de vos demandes.
                </p>
              </div>
              <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                <Link href="/client/service-client">Contacter le service client</Link>
              </Button>
            </div>
          </ClientSurface>
        </div>
      </div>
    </div>
  );
}

function ProfileCommandCenter({
  name,
  email,
  phone,
  commune,
  quartier,
  completion,
  missingItems,
  dirty,
  saving,
  onSave,
  onReset,
}: {
  name: string;
  email: string;
  phone: string;
  commune: string;
  quartier: string;
  completion: number;
  missingItems: string[];
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  const isReady = completion >= 100;
  const areaLabel = [commune, quartier].filter(Boolean).join(" · ") || "Adresse à compléter";

  return (
    <ClientSurface compact className="overflow-hidden rounded-lg border border-[#DDE3EE] p-0" data-client-profile-command-center>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
        <div className="min-w-0 space-y-4 p-4 min-[640px]:p-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white">
              {dirty ? <Save className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#111B4D]">Centre compte</p>
              <h2 className="mt-1 text-xl font-semibold leading-tight text-[#111827]">
                {dirty ? "Des coordonnées attendent validation." : isReady ? "Votre profil est prêt." : "Complétez les informations utiles."}
              </h2>
              <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-[#52627A]">
                {dirty
                  ? "Enregistrez pour que les prochaines réservations, confirmations et suivis utilisent les bonnes informations."
                  : "Ces données restent privées et servent à confirmer rapidement les cours à domicile, en ligne et les échanges avec le service client."}
              </p>
            </div>
          </div>

          <div className="grid gap-2 min-[520px]:grid-cols-2 xl:grid-cols-4">
            <ClientInfoPill label="Complétude" value={`${completion}%`} strong={completion >= 75} />
            <ClientInfoPill label="Téléphone" value={phone || "À renseigner"} strong={Boolean(phone)} />
            <ClientInfoPill label="Zone" value={areaLabel} strong={Boolean(commune && quartier)} />
            <ClientInfoPill label="Email" value={email || "Compte client"} strong={Boolean(email)} />
          </div>

          <ClientProcessTracker
            steps={[
              { label: "Identité", hint: name ? "Nom renseigné." : "Nom complet requis.", state: name ? "done" : "current" },
              { label: "Contact", hint: phone ? "Téléphone prêt pour le suivi." : "Ajoutez un numéro joignable.", state: phone ? "done" : name ? "current" : "pending" },
              { label: "Zone", hint: commune && quartier ? "Adresse exploitable pour les cours." : "Commune et quartier accélèrent les confirmations.", state: commune && quartier ? "done" : phone ? "current" : "pending" },
            ]}
          />
        </div>

        <aside className="border-t border-[#DDE3EE] bg-white p-4 min-[640px]:p-5 lg:border-l lg:border-t-0">
          <div className="flex h-full flex-col justify-between gap-4">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Action prioritaire</p>
              <div className="rounded-lg border border-[#D8DEE9] bg-white p-3">
                <p className="text-base font-semibold leading-6 text-[#111827]">
                  {dirty ? "Enregistrer les changements" : missingItems.length > 0 ? "Profil à compléter" : "Profil opérationnel"}
                </p>
                {missingItems.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {missingItems.map((item) => (
                      <span key={item} className="rounded-lg border border-[#E3E8F2] bg-white px-2.5 py-1 text-xs font-semibold text-[#111B4D]">
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">Vos coordonnées sont prêtes pour les réservations.</p>
                )}
              </div>
            </div>

            {dirty ? (
              <div className="grid gap-2">
                <Button
                  type="button"
                  onClick={onSave}
                  disabled={saving || !name.trim()}
                  className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]"
                >
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</> : <><Save className="mr-2 h-4 w-4" /> Enregistrer</>}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onReset}
                  disabled={saving}
                  className="min-h-11 w-full rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white"
                >
                  Annuler
                </Button>
              </div>
            ) : (
              <Button asChild className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                <Link href={missingItems.length > 0 ? "/client/profil#coordonnees" : "/client/rechercher"}>
                  {missingItems.length > 0 ? "Compléter le profil" : "Trouver un professeur"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </aside>
      </div>
    </ClientSurface>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-[#E3E8F2] bg-white p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
          <div className="rounded-lg border border-[#E3E8F2] bg-white p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-lg bg-[#E5E7EB]" />
              <div className="flex-1 space-y-3">
                <div className="h-3 w-36 animate-pulse rounded-full bg-[#E5E7EB]" />
                <div className="h-7 w-4/5 animate-pulse rounded-full bg-[#E5E7EB]" />
                <div className="h-4 w-full animate-pulse rounded-full bg-[#E5E7EB]" />
              </div>
            </div>
            <div className="mt-5 grid gap-2 min-[760px]:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-lg border border-[#E3E8F2] bg-[#E5E7EB]" />
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-[#E3E8F2] bg-white p-5">
            <div className="h-3 w-28 animate-pulse rounded-full bg-[#E5E7EB]" />
            <div className="mt-3 h-6 w-3/4 animate-pulse rounded-full bg-[#E5E7EB]" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-[#E5E7EB]" />
            <div className="mt-5 grid gap-2 min-[460px]:grid-cols-2">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-11 animate-pulse rounded-lg bg-[#E5E7EB]" />
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-lg border border-[#E3E8F2] bg-[#E5E7EB]" />
        ))}
      </div>
    </div>
  );
}

function ProfileInfoLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
        <p className="break-words text-sm font-semibold leading-5 text-[#111827]">{value}</p>
      </div>
    </div>
  );
}
