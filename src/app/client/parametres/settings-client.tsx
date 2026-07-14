"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_PASSWORD_MIN_LENGTH, STANDARD_PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

export function ClientPasswordSettingsForm({ ownerAdmin = false }: { ownerAdmin?: boolean }) {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [visibleFields, setVisibleFields] = useState<Record<PasswordFieldKey, boolean>>({
    current: false,
    next: false,
    confirm: false,
  });
  const strength = getPasswordStrength(newPassword);

  const minimumLength = ownerAdmin ? ADMIN_PASSWORD_MIN_LENGTH : STANDARD_PASSWORD_MIN_LENGTH;
  const rules = [
    { label: "Ancien mot de passe saisi", ok: oldPassword.trim().length > 0 },
    { label: `${minimumLength} caractères minimum`, ok: newPassword.length >= minimumLength },
    ...(ownerAdmin ? [{ label: "Une lettre et un chiffre", ok: /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword) }] : []),
    { label: "Différent de l'ancien", ok: newPassword.length > 0 && newPassword !== oldPassword },
    { label: "Confirmation identique", ok: confirmPassword.length > 0 && newPassword === confirmPassword },
  ];
  const canSubmit = rules.every((rule) => rule.ok) && !saving;

  function toggleVisibility(key: PasswordFieldKey) {
    setVisibleFields((current) => ({ ...current, [key]: !current[key] }));
  }

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
      let data: { error?: string } = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText) as { error?: string };
        } catch {
          // Une réponse d'infrastructure ne doit pas produire une erreur JSON technique.
        }
      }
      if (!res.ok) throw new Error(data.error || "Modification impossible.");

      toast.success(ownerAdmin ? "Mot de passe administrateur modifié." : "Mot de passe client modifié.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
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
        visible={visibleFields.current}
        onToggleVisible={() => toggleVisibility("current")}
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
        visible={visibleFields.next}
        onToggleVisible={() => toggleVisibility("next")}
      />
      <PasswordStrengthMeter score={strength.score} label={strength.label} />
      <PasswordField
        id="client-confirm-password"
        label="Confirmer le nouveau mot de passe"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
        visible={visibleFields.confirm}
        onToggleVisible={() => toggleVisibility("confirm")}
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

type PasswordFieldKey = "current" | "next" | "confirm";

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  visible,
  onToggleVisible,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <div data-client-password-field className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          className="h-11 rounded-lg border-[#DDE6F7] bg-white pr-14 text-sm focus-visible:ring-[#9AAAD0]"
          data-client-password-input={id}
          required
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-white hover:text-[#111B4D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111B4D]"
          aria-label={visible ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`}
          data-client-password-toggle={id}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
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
  if (value.length >= 6) score += 1;
  if (value.length >= 10) score += 1;
  if (/[A-Za-z]/.test(value) && /\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  const labels = ["À renforcer", "Basique", "Correct", "Solide", "Très solide"];
  return { score, label: labels[score] ?? "À renforcer" };
}
