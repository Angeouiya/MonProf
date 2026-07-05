"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClientPasswordSettingsForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const rules = [
    { label: "Ancien mot de passe saisi", ok: oldPassword.trim().length > 0 },
    { label: "6 caractères minimum", ok: newPassword.length >= 6 },
    { label: "Confirmation identique", ok: confirmPassword.length > 0 && newPassword === confirmPassword },
  ];
  const canSubmit = rules.every((rule) => rule.ok) && !saving;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      toast.error("Vérifiez les trois champs avant de continuer.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "changePassword", oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Modification impossible.");

      toast.success("Mot de passe client modifié.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Modification impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="client-account-form mt-4 grid gap-3">
      <PasswordField id="client-old-password" label="Mot de passe actuel" value={oldPassword} onChange={setOldPassword} autoComplete="current-password" />
      <PasswordField id="client-new-password" label="Nouveau mot de passe" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
      <PasswordField id="client-confirm-password" label="Confirmer le nouveau mot de passe" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />

      <div className="grid gap-2 rounded-lg border border-[#E3E8F2] bg-white p-2.5 text-xs font-semibold leading-5 text-[#64748B] sm:grid-cols-3">
        {rules.map((rule) => (
          <p key={rule.label} className={rule.ok ? "text-[#111B4D]" : ""}>
            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
            {rule.label}
          </p>
        ))}
      </div>

      <Button type="submit" disabled={!canSubmit} className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78] sm:w-fit">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Modifier le mot de passe
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="h-11 rounded-lg border-[#DDE6F7] bg-white text-sm focus-visible:ring-[#9AAAD0]"
        required
      />
    </div>
  );
}
