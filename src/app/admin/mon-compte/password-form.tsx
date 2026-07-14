"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

export function AdminPasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rules = [
    { label: "Mot de passe actuel saisi", ok: currentPassword.trim().length > 0 },
    { label: `${ADMIN_PASSWORD_MIN_LENGTH} caractères minimum`, ok: newPassword.length >= ADMIN_PASSWORD_MIN_LENGTH },
    { label: "Une lettre et un chiffre", ok: /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword) },
    { label: "Confirmation identique", ok: confirmPassword.length > 0 && newPassword === confirmPassword },
    { label: "Différent de l'actuel", ok: newPassword.length > 0 && newPassword !== currentPassword },
  ];
  const canSubmit = rules.every((rule) => rule.ok) && !loading;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      setFormError("Vérifiez les trois champs et les règles de sécurité.");
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const responseText = await res.text();
      let data: { error?: string } = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText) as { error?: string };
        } catch {
          // Conserver un message compréhensible même si l'infrastructure ne renvoie pas de JSON.
        }
      }
      if (!res.ok) throw new Error(data.error || "Modification impossible.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast.success("Mot de passe administrateur modifié et action historisée.");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Modification impossible.";
      setFormError(message);
      toast.error(message);
    }
    finally { setLoading(false); }
  };

  return (
    <Card className="max-w-3xl border-[#CBD5E1] bg-white">
      <CardHeader className="border-b border-[#E2E8F0]">
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-[#111B4D]" /> Modifier mon mot de passe</CardTitle>
        <p className="text-sm leading-6 text-[#64748B]">Votre mot de passe actuel est obligatoire. Le nouveau doit contenir au moins 10 caractères, une lettre et un chiffre.</p>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        <form onSubmit={submit} className="space-y-4">
        <Field label="Mot de passe actuel"><Input name="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nouveau mot de passe"><Input name="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></Field>
          <Field label="Confirmer le nouveau mot de passe"><Input name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></Field>
        </div>
        <div className="grid gap-2 text-xs font-semibold text-[#64748B] sm:grid-cols-2">
          {rules.map((rule) => <p key={rule.label} className={rule.ok ? "text-[#111B4D]" : ""}>{rule.label}</p>)}
        </div>
        {formError && <p role="alert" className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700">{formError}</p>}
        <div className="flex justify-end"><Button type="submit" disabled={!canSubmit} className="min-h-11 bg-[#111B4D] text-white hover:bg-[#1E2A78]">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} {loading ? "Modification..." : "Enregistrer"}</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
