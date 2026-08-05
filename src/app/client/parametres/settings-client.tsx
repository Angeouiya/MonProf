"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

export function ClientPasswordSettingsForm({ ownerAdmin = false }: { ownerAdmin?: boolean }) {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const strength = getPasswordStrength(newPassword);

  const rules = [
    { label: "Ancien mot de passe saisi", ok: oldPassword.trim().length > 0 },
    { label: `${PASSWORD_MIN_LENGTH} caractères minimum`, ok: newPassword.length >= PASSWORD_MIN_LENGTH },
    { label: "Une lettre et un chiffre", ok: /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword) },
    { label: "Différent de l'ancien", ok: newPassword.length > 0 && newPassword !== oldPassword },
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
    setFormError(null);
    try {
      const res = await fetch("/api/client/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "changePassword", oldPassword, newPassword, confirmPassword }),
      });
      const responseText = await res.text();
      let data: { error?: string; email?: { queued?: boolean; message?: string } } = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText) as { error?: string; email?: { queued?: boolean; message?: string } };
        } catch {
          // Une réponse d'infrastructure ne doit pas produire une erreur JSON technique.
        }
      }
      if (!res.ok) throw new Error(data.error || "Modification impossible.");

      toast.success(ownerAdmin ? "Mot de passe administrateur modifié." : "Mot de passe client modifié.");
      if (data.email?.queued) {
        toast.success("L'email personnel de confirmation est pris en charge automatiquement.");
      } else {
        toast.warning(data.email?.message || "Le mot de passe est modifié, mais l'email de confirmation est en attente.");
      }
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await signOut({ redirect: false });
      router.replace(ownerAdmin ? "/admin/connexion?passwordChanged=1" : "/connexion?passwordChanged=1");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Modification impossible.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} data-client-account-form className="client-account-form mt-4 grid gap-3">
      <PasswordField
        id="client-old-password"
        label="Mot de passe actuel"
        value={oldPassword}
        onChange={setOldPassword}
        autoComplete="current-password"
      />

      {formError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700">
          {formError}
        </p>
      )}
      <PasswordField
        id="client-new-password"
        label="Nouveau mot de passe"
        value={newPassword}
        onChange={setNewPassword}
        autoComplete="new-password"
      />
      <PasswordStrengthMeter score={strength.score} label={strength.label} />
      <PasswordField
        id="client-confirm-password"
        label="Confirmer le nouveau mot de passe"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />

      <div data-client-password-rules className="grid gap-2 rounded-lg border border-[#E3E8F2] bg-white p-2.5 text-xs font-semibold leading-5 text-[#64748B] min-[760px]:grid-cols-4">
        {rules.map((rule) => (
          <p key={rule.label} className={rule.ok ? "text-[#111B4D]" : ""} data-client-password-rule={rule.ok ? "ok" : "pending"}>
            <CheckCircle2 className={rule.ok ? "mr-1 inline h-3.5 w-3.5 text-[#111B4D]" : "mr-1 inline h-3.5 w-3.5 text-[#94A3B8]"} />
            {rule.label}
          </p>
        ))}
      </div>

      <Button type="submit" disabled={!canSubmit} className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78] min-[640px]:w-fit">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        {saving ? "Modification en cours..." : ownerAdmin ? "Modifier le mot de passe administrateur" : "Modifier le mot de passe"}
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
    <div data-client-password-field className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <PasswordInput
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="h-11 rounded-lg border-[#DDE6F7] bg-white pr-14 text-sm focus-visible:ring-[#9AAAD0]"
        data-client-password-input={id}
        required
      />
    </div>
  );
}

function PasswordStrengthMeter({ score, label }: { score: number; label: string }) {
  return (
    <div data-client-password-strength className="rounded-lg border border-[#E3E8F2] bg-white p-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Solidité</p>
        <p className="text-xs font-semibold text-[#111B4D]">{label}</p>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={level <= score ? "h-2 rounded-full bg-[#111B4D]" : "h-2 rounded-full bg-[#E5E7EB]"}
          />
        ))}
      </div>
    </div>
  );
}

function getPasswordStrength(value: string) {
  if (!value) return { score: 0, label: "À définir" };

  let score = 0;
  if (value.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (value.length >= PASSWORD_MIN_LENGTH + 2) score += 1;
  if (/[A-Za-z]/.test(value) && /\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  const labels = ["À renforcer", "Basique", "Correct", "Solide", "Très solide"];
  return { score, label: labels[score] ?? "À renforcer" };
}
