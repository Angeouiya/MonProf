"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Lock, Save, Loader2 } from "lucide-react";

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
  const { data: session, update: updateSession } = useSession();
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
        body: JSON.stringify({ name, phone, commune, quartier }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erreur");
        return;
      }
      toast.success("Profil mis à jour");
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
        <PageHeader title="Mon profil" description="Gérez vos informations personnelles." />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon profil"
        description="Gérez vos informations personnelles et votre mot de passe."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Infos personnelles */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <User className="h-4 w-4 text-primary" />
              Informations personnelles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveInfo} className="space-y-4">
              <div>
                <Label htmlFor="name">Nom complet *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email ?? ""} disabled className="mt-1.5 bg-muted/50" />
                <p className="mt-1 text-xs text-muted-foreground">L'email ne peut pas être modifié.</p>
              </div>
              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1.5"
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
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
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
                  className="mt-1.5"
                  placeholder="Ex: Riviera Palmeraie"
                />
              </div>
              <Button type="submit" disabled={savingInfo} className="w-full sm:w-auto">
                {savingInfo ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" /> Enregistrer</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Mot de passe */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Lock className="h-4 w-4 text-primary" />
              Changer le mot de passe
            </CardTitle>
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
                  className="mt-1.5"
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
                  className="mt-1.5"
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-muted-foreground">6 caractères minimum.</p>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1.5"
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={savingPassword} variant="outline" className="w-full sm:w-auto">
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
  );
}
