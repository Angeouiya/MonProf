"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { PasswordInput } from "@/components/shared/password-input";
import { PasswordRuleList } from "@/components/shared/password-rule-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PayoutMethodPicker } from "@/components/professor/payout-method-picker";
import { paymentMethodLabel } from "@/lib/payment-methods";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

function normalizePaymentPhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

export function TeacherPasswordSettingsForm() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rules = [
    { label: "Ancien mot de passe saisi", ok: oldPassword.trim().length > 0 },
    { label: `${PASSWORD_MIN_LENGTH} caractères minimum`, ok: newPassword.length >= PASSWORD_MIN_LENGTH },
    { label: "Une lettre et un chiffre", ok: /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword) },
    { label: "Confirmation identique", ok: confirmPassword.length > 0 && newPassword === confirmPassword },
  ];
  const canSubmit = rules.every((rule) => rule.ok) && !saving;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      setFormError("Vérifiez les trois champs avant de continuer.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/professor/profile", {
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
          // Préserver un message lisible si l'infrastructure ne renvoie pas de JSON.
        }
      }
      if (!res.ok) throw new Error(data.error || "Modification impossible.");

      void data.email;
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await signOut({ redirect: false });
      router.replace("/professeur/connexion?passwordChanged=1");
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Modification impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-4">
      <PasswordField
        id="teacher-old-password"
        label="Mot de passe actuel"
        value={oldPassword}
        onChange={(value) => {
          setOldPassword(value);
          setFormError(null);
        }}
        autoComplete="current-password"
      />
      {formError && (
        <p role="alert" data-password-settings-inline-error className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700">
          {formError}
        </p>
      )}
      <PasswordField
        id="teacher-new-password"
        label="Nouveau mot de passe"
        value={newPassword}
        onChange={(value) => {
          setNewPassword(value);
          setFormError(null);
        }}
        autoComplete="new-password"
      />
      <PasswordField
        id="teacher-confirm-password"
        label="Confirmer le nouveau mot de passe"
        value={confirmPassword}
        onChange={(value) => {
          setConfirmPassword(value);
          setFormError(null);
        }}
        autoComplete="new-password"
      />

      <PasswordRuleList rules={rules} columnsClassName="min-[760px]:grid-cols-4" data-teacher-password-rules />

      <Button type="submit" disabled={!canSubmit} className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78] min-[640px]:w-fit">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Modifier le mot de passe
      </Button>
    </form>
  );
}

export function TeacherPaymentProfileSettingsForm({
  defaultMethod,
  defaultPhone,
  payoutInstructions,
  fallbackPhone,
}: {
  defaultMethod?: string | null;
  defaultPhone?: string | null;
  payoutInstructions?: string | null;
  fallbackPhone?: string | null;
}) {
  const [method, setMethod] = useState(defaultMethod || "WAVE");
  const [phone, setPhone] = useState(defaultPhone || fallbackPhone || "");
  const [phoneConfirm, setPhoneConfirm] = useState(defaultPhone || fallbackPhone || "");
  const [instructions, setInstructions] = useState(payoutInstructions ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [payoutSavedMessage, setPayoutSavedMessage] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  const normalizedPhone = normalizePaymentPhone(phone);
  const normalizedConfirm = normalizePaymentPhone(phoneConfirm);
  const phoneMismatch = normalizedPhone.length > 0 && normalizedConfirm.length > 0 && normalizedPhone !== normalizedConfirm;
  const phoneOk = normalizedPhone.length >= 8 && normalizedPhone.length <= 20 && normalizedPhone === normalizedConfirm;
  const instructionsTooLong = instructions.trim().length > 500;
  const canSubmit = Boolean(method) && phoneOk && currentPassword.length > 0 && !instructionsTooLong && !saving;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      setPayoutError("Vérifiez le moyen de paiement et les deux saisies du numéro.");
      return;
    }
    setSaving(true);
    setPayoutSavedMessage(null);
    setPayoutError(null);
    try {
      const res = await fetch("/api/professor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePaymentProfile",
          defaultPayoutMethod: method,
          defaultPayoutPhone: normalizedPhone,
          defaultPayoutPhoneConfirm: normalizedConfirm,
          payoutInstructions: instructions,
          currentPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible.");
      setCurrentPassword("");
      setPayoutSavedMessage(`Coordonnées ${paymentMethodLabel(method)} enregistrées. Les prochains retraits Jèko utiliseront ce numéro confirmé.`);
    } catch (error) {
      setPayoutError(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-4">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[#111827]">Moyen de paiement préféré</p>
        <PayoutMethodPicker value={method} onChange={(value) => {
          setMethod(value);
          setPayoutSavedMessage(null);
          setPayoutError(null);
        }} disabled={saving} />
        <p className="text-xs font-semibold leading-5 text-[#64748B]">
          Orange Money, MTN Money, Moov Money ou Wave. Le moyen sélectionné préremplit chaque nouvelle demande.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="teacher-payout-phone">Numéro {paymentMethodLabel(method)}</Label>
          <Input
            id="teacher-payout-phone"
            inputMode="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              setPayoutSavedMessage(null);
              setPayoutError(null);
            }}
            placeholder="Ex : +225 07 00 00 00 00"
            className="h-11 rounded-lg border-[#DDE6F7] bg-white"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="teacher-payout-phone-confirm">Confirmer le numéro</Label>
          <Input
            id="teacher-payout-phone-confirm"
            inputMode="tel"
            value={phoneConfirm}
            onChange={(event) => {
              setPhoneConfirm(event.target.value);
              setPayoutSavedMessage(null);
              setPayoutError(null);
            }}
            placeholder="Retapez le même numéro"
            className="h-11 rounded-lg border-[#DDE6F7] bg-white"
            required
          />
          {phoneMismatch && <p className="text-xs font-semibold text-red-700">Les deux numéros ne correspondent pas.</p>}
          {phoneOk && <p className="text-xs font-semibold text-[#111B4D]">Numéro confirmé pour les futures demandes.</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="teacher-payout-instructions">Consigne paiement pour le service client</Label>
        <Textarea
          id="teacher-payout-instructions"
          value={instructions}
          onChange={(event) => {
            setInstructions(event.target.value);
            setPayoutSavedMessage(null);
            setPayoutError(null);
          }}
          placeholder="Ex : utiliser ce numéro uniquement pour mes paiements Wave."
          className="min-h-24 rounded-lg border-[#DDE6F7] bg-white"
        />
        <p className={instructionsTooLong ? "text-xs font-semibold text-red-700" : "text-xs font-semibold text-[#64748B]"}>
          {instructions.trim().length}/500 caractères
        </p>
      </div>

      <div className="space-y-1.5 rounded-lg border border-[#DDE6F7] bg-[#F8FAFF] p-3">
        <Label htmlFor="teacher-payout-profile-current-password" className="inline-flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#111B4D]" aria-hidden />
          Mot de passe actuel
        </Label>
        <PasswordInput
          id="teacher-payout-profile-current-password"
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
            setPayoutSavedMessage(null);
            setPayoutError(null);
          }}
          autoComplete="current-password"
          placeholder="Confirmez avant de changer le numéro de retrait"
          className="h-11 rounded-lg border-[#DDE6F7] bg-white"
          required
        />
        <p className="text-xs font-semibold leading-5 text-[#64748B]">
          Cette vérification protège votre portefeuille si une session reste ouverte sur un autre appareil.
        </p>
      </div>

      {payoutError && (
        <div
          data-professor-payout-profile-inline-error
          className="rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold leading-6 text-red-700"
          role="alert"
        >
          {payoutError}
        </div>
      )}
      <Button type="submit" disabled={!canSubmit} className="min-h-11 rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78] min-[640px]:w-fit">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Enregistrer mes coordonnées
      </Button>
      {payoutSavedMessage && (
        <div
          data-professor-payout-profile-saved
          className="rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm font-semibold leading-6 text-emerald-800"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="mr-1 inline h-4 w-4" aria-hidden />
          {payoutSavedMessage}
        </div>
      )}
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
      <PasswordInput
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="h-11 rounded-lg border-[#DDE6F7] bg-white text-sm focus-visible:ring-[#9AAAD0]"
        required
      />
    </div>
  );
}
