"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, Save, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImportantActionConfirm } from "@/components/shared/important-action-confirm";
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_LABELS,
  ADMIN_ROLE_LABELS,
  ADMIN_ROLE_PERMISSIONS,
  type AdminPermission,
  type AdminTeamRoleValue,
} from "@/lib/admin-permissions";
import { formatDateTime } from "@/lib/format";

type TeamAdmin = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  adminTeamRole: string;
  adminAccountStatus: string;
  adminPermissions: AdminPermission[];
  usesRoleDefaults: boolean;
  adminAccessEnabled: boolean;
  adminLastLoginAt: string | null;
  adminPasswordChangedAt: string | null;
  adminSuspensionReason: string | null;
  createdAt: string;
};

export function AdminTeamClient({ currentAdminId, admins }: { currentAdminId: string; admins: TeamAdmin[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "SUPPORT" });

  const createAdmin = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, adminTeamRole: form.role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Création impossible.");
      toast.success("Administrateur ajouté. Transmettez son mot de passe temporaire par un canal sécurisé.");
      setForm({ name: "", email: "", phone: "", password: "", role: "SUPPORT" });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-[#CBD5E1] bg-white">
        <CardHeader className="border-b border-[#E2E8F0]">
          <CardTitle className="flex items-center gap-2 text-base"><UserPlus className="h-4 w-4 text-[#111B4D]" /> Ajouter un administrateur</CardTitle>
          <p className="text-sm leading-6 text-[#64748B]">Créez un accès nominatif. Le mot de passe est chiffré et n'est jamais affiché après l'enregistrement.</p>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Nom"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Téléphone"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
          <Field label="Mot de passe temporaire"><Input type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field>
          <Field label="Rôle">
            <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ADMIN_ROLE_LABELS).filter(([role]) => role !== "OWNER").map(([role, label]) => <SelectItem key={role} value={role}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
            <Button onClick={createAdmin} disabled={creating} className="min-h-11 bg-[#111B4D] text-white hover:bg-[#1E2A78]">
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Créer l'accès
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {admins.map((admin) => <AdminAccessEditor key={admin.id} admin={admin} currentAdminId={currentAdminId} />)}
      </div>
    </div>
  );
}

function AdminAccessEditor({ admin, currentAdminId }: { admin: TeamAdmin; currentAdminId: string }) {
  const router = useRouter();
  const owner = admin.adminTeamRole === "OWNER";
  const [role, setRole] = useState<AdminTeamRoleValue>(admin.adminTeamRole as AdminTeamRoleValue);
  const [status, setStatus] = useState(admin.adminAccountStatus);
  const [useRoleDefaults, setUseRoleDefaults] = useState(admin.usesRoleDefaults);
  const [permissions, setPermissions] = useState<AdminPermission[]>(admin.adminPermissions);
  const [reason, setReason] = useState(admin.adminSuspensionReason || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const chooseRole = (value: string) => {
    const nextRole = value as AdminTeamRoleValue;
    setRole(nextRole);
    if (useRoleDefaults) setPermissions([...ADMIN_ROLE_PERMISSIONS[nextRole]]);
  };
  const togglePermission = (permission: AdminPermission, checked: boolean) => {
    setUseRoleDefaults(false);
    setPermissions((current) => checked ? [...new Set([...current, permission])] : current.filter((item) => item !== permission));
  };
  const save = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/team/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminTeamRole: role, adminAccountStatus: status, adminAccessEnabled: status === "ACTIVE", adminPermissions: permissions, useRoleDefaults, adminSuspensionReason: reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Mise à jour impossible.");
      toast.success("Rôle et accès mis à jour.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Mise à jour impossible."); }
    finally { setLoading(false); }
  };
  const resetPassword = async () => {
    if (!password) return toast.error("Saisissez le nouveau mot de passe temporaire.");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/team/${admin.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset_password", password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Réinitialisation impossible.");
      setPassword("");
      toast.success("Mot de passe temporaire remplacé.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Réinitialisation impossible."); }
    finally { setLoading(false); }
  };
  const remove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/team/${admin.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Retrait impossible.");
      toast.success("Accès retiré et historique conservé.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Retrait impossible."); }
    finally { setLoading(false); }
  };

  return (
    <Card className="border-[#E2E8F0] bg-white">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-[#111827]">{admin.name}</h2>
              <Badge variant="outline" className="border-[#CBD5E1] bg-white text-[#111B4D]">{ADMIN_ROLE_LABELS[role]}</Badge>
              <Badge variant="outline" className={status === "ACTIVE" ? "border-blue-200 bg-white text-blue-800" : "border-red-200 bg-white text-red-700"}>{status}</Badge>
              {admin.id === currentAdminId && <Badge variant="outline">Votre compte</Badge>}
            </div>
            <p className="mt-1 text-sm text-[#64748B]">{admin.email}{admin.phone ? ` · ${admin.phone}` : ""}</p>
            <p className="mt-1 text-xs text-[#64748B]">Dernière connexion : {admin.adminLastLoginAt ? formatDateTime(admin.adminLastLoginAt) : "Jamais"} · Mot de passe modifié : {admin.adminPasswordChangedAt ? formatDateTime(admin.adminPasswordChangedAt) : "Non renseigné"}</p>
          </div>
          {!owner && admin.id !== currentAdminId && (
            <ImportantActionConfirm
              title="Retirer cet administrateur ?"
              description="Son accès sera bloqué immédiatement. Les actions déjà effectuées resteront dans le journal d'audit."
              badge="Contrôle d'accès"
              danger
              notices={["La suppression est logique afin de préserver la traçabilité.", "Le compte ne pourra plus se connecter."]}
              confirmLabel="Retirer l'accès"
              cancelLabel="Conserver"
              onConfirm={remove}
              trigger={<Button variant="outline" className="border-red-200 text-red-700"><Trash2 className="mr-2 h-4 w-4" /> Retirer</Button>}
            />
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Rôle">
            <Select value={role} onValueChange={chooseRole} disabled={owner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ADMIN_ROLE_LABELS).filter(([item]) => owner || item !== "OWNER").map(([item, label]) => <SelectItem key={item} value={item}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Statut">
            <Select value={status} onValueChange={setStatus} disabled={owner || admin.id === currentAdminId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ACTIVE">Actif</SelectItem><SelectItem value="SUSPENDED">Suspendu</SelectItem><SelectItem value="BLOCKED">Bloqué</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Motif si accès restreint"><Input value={reason} onChange={(event) => setReason(event.target.value)} disabled={owner || status === "ACTIVE"} /></Field>
        </div>

        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-[#E2E8F0] px-3 text-sm font-semibold text-[#111827]">
          <Checkbox checked={useRoleDefaults} onCheckedChange={(checked) => { const enabled = checked === true; setUseRoleDefaults(enabled); if (enabled) setPermissions([...ADMIN_ROLE_PERMISSIONS[role]]); }} disabled={owner} />
          Utiliser exactement les droits prédéfinis du rôle
        </label>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {ADMIN_PERMISSIONS.map((permission) => (
            <label key={permission} className="flex min-h-11 items-center gap-3 rounded-lg border border-[#E2E8F0] px-3 text-sm text-[#334155]">
              <Checkbox checked={permissions.includes(permission)} onCheckedChange={(checked) => togglePermission(permission, checked === true)} disabled={owner || useRoleDefaults} />
              {ADMIN_PERMISSION_LABELS[permission]}
            </label>
          ))}
        </div>

        <div className="grid gap-3 border-t border-[#E2E8F0] pt-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <Field label="Nouveau mot de passe temporaire"><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="10 caractères minimum" /></Field>
          <Button variant="outline" onClick={resetPassword} disabled={loading || !password}><KeyRound className="mr-2 h-4 w-4" /> Réinitialiser</Button>
          <Button onClick={save} disabled={loading || owner} className="bg-[#111B4D] text-white hover:bg-[#1E2A78]"><Save className="mr-2 h-4 w-4" /> Enregistrer les accès</Button>
        </div>
        {owner && <p className="flex items-center gap-2 text-xs font-semibold text-[#111B4D]"><ShieldCheck className="h-4 w-4" /> Le propriétaire conserve tous les droits et modifie son mot de passe depuis Mon compte.</p>}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
