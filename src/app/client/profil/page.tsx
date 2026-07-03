"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Lock,
  Save,
  Loader2,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  CalendarCheck,
  LifeBuoy,
  Search,
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

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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
        await updateSession({ name });
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSavingInfo(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "changePassword", oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      toast.success("Mot de passe modifié");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loadingProfile) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mon profil" description="Préparation de votre espace client sécurisé." />
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
  const passwordRules = [
    { label: "6 caractères minimum", ok: newPassword.length >= 6 },
    { label: "Confirmation identique", ok: confirmPassword.length > 0 && newPassword === confirmPassword },
    { label: "Ancien mot de passe saisi", ok: oldPassword.length > 0 },
  ];
  const passwordScore = passwordRules.filter((rule) => rule.ok).length;
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const passwordCanSubmit = passwordScore === passwordRules.length && !savingPassword;
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
    <div className="space-y-6">
      <PageHeader
        title="Mon profil"
        description="Gérez vos informations personnelles et votre mot de passe."
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-[#DDE6F7] bg-white px-3 py-1 text-xs font-bold text-[#111B4D]">
          <ShieldCheck className="h-3.5 w-3.5" />
          Compte sécurisé
        </div>
      </PageHeader>

      <section className="rounded-[1.35rem] border border-[#E3E8F2] bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-2 min-[520px]:grid-cols-3">
          <ProfileCompactMetric icon={User} label="Profil" value={`${profileCompletion}%`} attention={profileCompletion < 75} />
          <ProfileCompactMetric icon={MapPin} label="Zone" value={commune || "À compléter"} />
          <ProfileCompactMetric icon={ShieldCheck} label="Sécurité" value="Active" />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Button asChild className="min-h-11 rounded-2xl">
            <Link href="/client/rechercher">
              <Search className="h-4 w-4" />
              Trouver un professeur
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 rounded-2xl">
            <Link href="/client/reservations">
              <CalendarCheck className="h-4 w-4" />
              Mes dossiers
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11 rounded-2xl">
            <Link href="/client/support">
              <LifeBuoy className="h-4 w-4" />
              Support
            </Link>
          </Button>
        </div>
        {missingProfileItems.length > 0 && (
          <p className="mt-3 text-sm font-semibold leading-6 text-[#64748B]">
            À compléter : {missingProfileItems.join(", ")}.
          </p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Card className="overflow-hidden rounded-[1.35rem]">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.35rem] bg-[#111B4D] text-xl font-black text-white shadow-sm">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="break-words text-base font-black leading-5 text-[#111827]">{name || "Client MonProf CI"}</p>
                  <p className="mt-1 break-words text-sm leading-5 text-[#64748B]">{profile?.email}</p>
                  <p className="mt-2 inline-flex rounded-full border border-[#DDE6F7] bg-white px-3 py-1 text-xs font-bold text-[#111B4D]">
                    Espace client
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <ProfileInfoLine icon={Mail} label="Email" value={profile?.email ?? "—"} />
                <ProfileInfoLine icon={Phone} label="Téléphone" value={phone || "À renseigner"} />
                <ProfileInfoLine icon={MapPin} label="Adresse" value={[commune, quartier].filter(Boolean).join(" · ") || "À renseigner"} />
              </div>
              <div className="mt-5 rounded-2xl border border-[#E3E8F2] bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Complétude</p>
                  <p className="text-xs font-black text-[#111B4D]">{profileCompletion}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
                  <div className="h-full rounded-full bg-[#111B4D]" style={{ width: `${profileCompletion}%` }} />
                </div>
                <p className="mt-2 text-xs leading-5 text-[#64748B]">
                  Un profil complet rend les confirmations plus rapides pour les cours à domicile et les suivis support.
                </p>
              </div>
              <div className="mt-3 rounded-2xl border border-[#DDE6F7] bg-white p-3">
                <p className="text-xs font-black uppercase tracking-wide text-[#64748B]">À compléter</p>
                {missingProfileItems.length === 0 ? (
                  <p className="mt-2 flex items-center gap-2 text-sm font-black text-[#111B4D]">
                    <CheckCircle2 className="h-4 w-4" />
                    Profil prêt pour les réservations
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {missingProfileItems.map((item) => (
                      <span key={item} className="rounded-full border border-[#E3E8F2] bg-white px-3 py-1 text-xs font-bold text-[#111B4D]">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="grid gap-6 lg:grid-cols-2">
        {/* Infos personnelles */}
        <Card className="overflow-hidden rounded-[1.35rem]">
          <CardHeader className="border-b border-[#E3E8F2] bg-white pb-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-base font-black text-[#111827]">
                <User className="h-4 w-4 text-[#111B4D]" />
                Informations personnelles
              </CardTitle>
              <p className="text-sm leading-6 text-[#64748B]">
                Ces informations aident l'administration à confirmer vos cours plus vite.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveInfo} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                <div className="sm:col-span-2 lg:col-span-1 2xl:col-span-2">
                <Label htmlFor="name">Nom complet *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11 rounded-2xl border-[#DDE6F7]" />
              </div>
                <div className="sm:col-span-2 lg:col-span-1 2xl:col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email ?? ""} disabled className="mt-1.5 h-11 rounded-2xl border-[#DDE6F7] bg-white" />
                <p className="mt-1 text-xs text-[#64748B]">L'email ne peut pas être modifié.</p>
              </div>
              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5 h-11 rounded-2xl border-[#DDE6F7]"
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
                  className="mt-1.5 h-11 w-full rounded-2xl border border-[#DDE6F7] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#9AAAD0] focus:ring-2 focus:ring-[#DDE6F7]"
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
                  className="mt-1.5 h-11 rounded-2xl border-[#DDE6F7]"
                  placeholder="Ex: Riviera Palmeraie"
                />
              </div>
              </div>
              <div className="rounded-2xl border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#64748B]">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                Ces informations restent privées et servent uniquement à organiser vos réservations.
              </div>
              <Button type="submit" disabled={savingInfo || !profileDirty || !name.trim()} className="min-h-11 w-full rounded-2xl sm:w-auto">
                {savingInfo ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                ) : !profileDirty ? (
                  <><CheckCircle2 className="mr-2 h-4 w-4" /> Informations à jour</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Enregistrer</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Mot de passe */}
        <Card className="overflow-hidden rounded-[1.35rem]">
          <CardHeader className="border-b border-[#E3E8F2] bg-white pb-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="flex items-center gap-2 text-base font-black text-[#111827]">
                <Lock className="h-4 w-4 text-[#111B4D]" />
                Changer le mot de passe
              </CardTitle>
              <p className="text-sm leading-6 text-[#64748B]">
                Mettez à jour votre accès en gardant un mot de passe simple à retenir et difficile à deviner.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-4">
              <div>
                <Label htmlFor="oldPassword">Ancien mot de passe *</Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="mt-1.5 h-11 rounded-2xl border-[#DDE6F7]"
                  autoComplete="current-password"
                />
              </div>
              <Separator />
              <div>
                <Label htmlFor="newPassword">Nouveau mot de passe *</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 h-11 rounded-2xl border-[#DDE6F7]"
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-[#64748B]">6 caractères minimum.</p>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5 h-11 rounded-2xl border-[#DDE6F7]"
                  autoComplete="new-password"
                />
              </div>
              <div className="rounded-2xl border border-[#E3E8F2] bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-wide text-[#64748B]">Sécurité du mot de passe</p>
                  <p className="text-xs font-black text-[#111B4D]">{passwordScore}/{passwordRules.length}</p>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {passwordRules.map((rule) => (
                    <div key={rule.label} className={`h-2 rounded-full ${rule.ok ? "bg-[#111B4D]" : "bg-[#E5E7EB]"}`} />
                  ))}
                </div>
                <div className="mt-3 space-y-1.5">
                  {passwordRules.map((rule) => (
                    <p key={rule.label} className={`flex items-center gap-2 text-xs font-semibold ${rule.ok ? "text-[#111B4D]" : "text-[#64748B]"}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {rule.label}
                    </p>
                  ))}
                  {passwordMismatch && (
                    <p className="text-xs font-bold text-[#111B4D]">La confirmation ne correspond pas au nouveau mot de passe.</p>
                  )}
                </div>
              </div>
              <Button type="submit" disabled={!passwordCanSubmit} className="min-h-11 w-full rounded-2xl sm:w-auto">
                {savingPassword ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Modification...</>
                ) : (
                  <><Lock className="mr-2 h-4 w-4" /> Modifier le mot de passe</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[1.75rem] border border-[#E3E8F2] bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
          <div className="rounded-[1.35rem] border border-[#E3E8F2] bg-white p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 animate-pulse rounded-[1.2rem] bg-[#E5E7EB]" />
              <div className="flex-1 space-y-3">
                <div className="h-3 w-36 animate-pulse rounded-full bg-[#E5E7EB]" />
                <div className="h-7 w-4/5 animate-pulse rounded-full bg-[#E5E7EB]" />
                <div className="h-4 w-full animate-pulse rounded-full bg-[#E5E7EB]" />
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-2xl border border-[#E3E8F2] bg-white" />
              ))}
            </div>
          </div>
          <div className="rounded-[1.35rem] border border-[#E3E8F2] bg-white p-5">
            <div className="h-3 w-28 animate-pulse rounded-full bg-[#E5E7EB]" />
            <div className="mt-3 h-6 w-3/4 animate-pulse rounded-full bg-[#E5E7EB]" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-[#E5E7EB]" />
            <div className="mt-5 grid gap-2 min-[460px]:grid-cols-2">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-11 animate-pulse rounded-2xl bg-white" />
              ))}
            </div>
          </div>
        </div>
      </section>
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-[1.35rem] border border-[#E3E8F2] bg-white" />
        ))}
      </div>
    </div>
  );
}

function ProfileCompactMetric({
  icon: Icon,
  label,
  value,
  attention = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
        <p className={attention ? "mt-0.5 break-words text-sm font-black leading-5 text-[#111B4D]" : "mt-0.5 break-words text-sm font-black leading-5 text-[#111827]"}>{value}</p>
      </div>
      <Icon className="h-4 w-4 shrink-0 text-[#111B4D]" />
    </div>
  );
}

function ProfileInfoLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#E3E8F2] bg-white px-3 py-2 shadow-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">{label}</p>
        <p className="break-words text-sm font-semibold leading-5 text-[#111827]">{value}</p>
      </div>
    </div>
  );
}
