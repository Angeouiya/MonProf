"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ClientMetricStrip,
  ClientPageHeader,
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

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Le nom est requis");
      return;
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
        return;
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
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSavingInfo(false);
    }
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
  const initials = (name || profile?.email || "Client")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "C";

  return (
    <div className="space-y-5">
      <section className="client-page-header client-screen-header rounded-lg border border-[#DDE3EE] bg-white p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-xl font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Compte client</p>
              <h1 className="mt-1 break-words text-[1.7rem] font-semibold leading-tight text-[#0F172A] sm:text-4xl">
                {name || "Client Compétence"}
              </h1>
              <p className="mt-1 break-words text-sm font-medium leading-6 text-[#52627A]">{profile?.email}</p>
            </div>
          </div>
          <div className="grid gap-2">
            <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#DDE6F7] bg-white px-3 text-sm font-semibold text-[#111B4D]">
              <ShieldCheck className="h-4 w-4" />
              Compte sécurisé
            </div>
            <Button asChild className="min-h-11 rounded-lg">
              <Link href="/client/rechercher">
                Trouver un professeur
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <ClientMetricStrip
        metrics={[
          { icon: User, label: "Profil", value: `${profileCompletion}%`, attention: profileCompletion < 75 },
          { icon: MapPin, label: "Zone", value: commune || "À compléter" },
          { icon: ShieldCheck, label: "Sécurité", value: "Active" },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <ClientSurface compact>
              <ClientSectionTitle
                eyebrow="Identité"
                title="Informations clés"
                description="Données utilisées pour les réservations et le support."
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
                  Un profil complet rend les confirmations plus rapides pour les cours à domicile et les suivis support.
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
            <form onSubmit={saveInfo} className="client-account-form space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                <div className="sm:col-span-2 lg:col-span-1 2xl:col-span-2">
                <Label htmlFor="name">Nom complet *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11 rounded-xl border-[#DDE6F7]" />
              </div>
                <div className="sm:col-span-2 lg:col-span-1 2xl:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email ?? ""} disabled className="mt-1.5 h-11 rounded-xl border-[#DDE6F7] bg-white" />
                <p className="mt-1 text-xs text-[#64748B]">L'email ne peut pas être modifié.</p>
              </div>
              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 h-11 rounded-xl border-[#DDE6F7]"
                  placeholder="+225 07 00 00 00 00"
                  inputMode="tel"
                />
              </div>
              <div>
                <Label htmlFor="commune">Commune</Label>
                <select
                  id="commune"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-[#DDE6F7] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#9AAAD0] focus:ring-2 focus:ring-[#DDE6F7]"
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
                  className="mt-1.5 h-11 rounded-xl border-[#DDE6F7]"
                  placeholder="Ex: Riviera Palmeraie"
                />
              </div>
              </div>
              <div className="rounded-xl border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#64748B]">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                Ces informations restent privées et servent uniquement à organiser vos réservations.
              </div>
              <Button type="submit" disabled={savingInfo || !profileDirty || !name.trim()} className="min-h-11 w-full rounded-xl sm:w-auto">
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
                  Pour une adresse, un numéro ou une réservation sensible, le support garde une trace claire de vos demandes.
                </p>
              </div>
              <Button asChild variant="outline" className="min-h-11 rounded-lg border-[#CAD7F2] bg-white text-[#111B4D] hover:border-[#111B4D] hover:bg-white">
                <Link href="/client/support">Contacter le support</Link>
              </Button>
            </div>
          </ClientSurface>
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-[#E3E8F2] bg-white p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
          <div className="rounded-xl border border-[#E3E8F2] bg-white p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-xl bg-[#E5E7EB]" />
              <div className="flex-1 space-y-3">
                <div className="h-3 w-36 animate-pulse rounded-full bg-[#E5E7EB]" />
                <div className="h-7 w-4/5 animate-pulse rounded-full bg-[#E5E7EB]" />
                <div className="h-4 w-full animate-pulse rounded-full bg-[#E5E7EB]" />
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-lg border border-[#E3E8F2] bg-white" />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[#E3E8F2] bg-white p-5">
            <div className="h-3 w-28 animate-pulse rounded-full bg-[#E5E7EB]" />
            <div className="mt-3 h-6 w-3/4 animate-pulse rounded-full bg-[#E5E7EB]" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-[#E5E7EB]" />
            <div className="mt-5 grid gap-2 min-[460px]:grid-cols-2">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-11 animate-pulse rounded-lg bg-white" />
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl border border-[#E3E8F2] bg-white" />
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
