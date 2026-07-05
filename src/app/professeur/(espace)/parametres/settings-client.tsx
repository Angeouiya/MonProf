"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentMethodLogo } from "@/components/shared/payment-method-logo";
import { activePaymentMethodOptions, paymentMethodLabel } from "@/lib/payment-methods";

function normalizePaymentPhone(value: string) {
  return value.replace(/[^\d+]/g, "").trim();
}

export function TeacherPasswordSettingsForm() {
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
      const res = await fetch("/api/professor/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "changePassword", oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Modification impossible.");

      toast.success("Mot de passe professeur modifié.");
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
    <form onSubmit={submit} className="mt-5 grid gap-4">
      <PasswordField id="teacher-old-password" label="Mot de passe actuel" value={oldPassword} onChange={setOldPassword} autoComplete="current-password" />
      <PasswordField id="teacher-new-password" label="Nouveau mot de passe" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
      <PasswordField id="teacher-confirm-password" label="Confirmer le nouveau mot de passe" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />

      <div className="grid gap-2 rounded-2xl border border-[#E3E8F2] bg-white p-3 text-xs font-semibold leading-5 text-[#64748B] sm:grid-cols-3">
        {rules.map((rule) => (
          <p key={rule.label} className={rule.ok ? "text-[#111B4D]" : ""}>
            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
            {rule.label}
          </p>
        ))}
      </div>

      <Button type="submit" disabled={!canSubmit} className="min-h-11 rounded-2xl bg-[#111B4D] text-white hover:bg-[#1E2A78] sm:w-fit">
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
  const [saving, setSaving] = useState(false);

  const normalizedPhone = normalizePaymentPhone(phone);
  const normalizedConfirm = normalizePaymentPhone(phoneConfirm);
  const phoneMismatch = normalizedPhone.length > 0 && normalizedConfirm.length > 0 && normalizedPhone !== normalizedConfirm;
  const phoneOk = normalizedPhone.length >= 8 && normalizedPhone.length <= 20 && normalizedPhone === normalizedConfirm;
  const instructionsTooLong = instructions.trim().length > 500;
  const canSubmit = Boolean(method) && phoneOk && !instructionsTooLong && !saving;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      toast.error("Vérifiez le moyen de paiement et les deux saisies du numéro.");
      return;
    }
    setSaving(true);
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible.");
      toast.success("Coordonnées de paiement enregistrées.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 grid gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <div className="space-y-1.5">
          <Label htmlFor="teacher-payout-method">Moyen de paiement préféré</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger id="teacher-payout-method" className="h-11 rounded-2xl border-[#DDE6F7] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {activePaymentMethodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <PaymentMethodLogo method={method} className="h-11 w-full rounded-2xl shadow-none" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="teacher-payout-phone">Numéro {paymentMethodLabel(method)}</Label>
          <Input
            id="teacher-payout-phone"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Ex : +225 07 00 00 00 00"
            className="h-11 rounded-2xl border-[#DDE6F7] bg-white"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="teacher-payout-phone-confirm">Confirmer le numéro</Label>
          <Input
            id="teacher-payout-phone-confirm"
            inputMode="tel"
            value={phoneConfirm}
            onChange={(event) => setPhoneConfirm(event.target.value)}
            placeholder="Retapez le même numéro"
            className="h-11 rounded-2xl border-[#DDE6F7] bg-white"
            required
          />
          {phoneMismatch && <p className="text-xs font-semibold text-red-700">Les deux numéros ne correspondent pas.</p>}
          {phoneOk && <p className="text-xs font-semibold text-[#111B4D]">Numéro confirmé pour les futures demandes.</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="teacher-payout-instructions">Consigne paiement pour l'administration</Label>
        <Textarea
          id="teacher-payout-instructions"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder="Ex : utiliser ce numéro uniquement pour mes paiements Wave."
          className="min-h-24 rounded-2xl border-[#DDE6F7] bg-white"
        />
        <p className={instructionsTooLong ? "text-xs font-semibold text-red-700" : "text-xs font-semibold text-[#64748B]"}>
          {instructions.trim().length}/500 caractères
        </p>
      </div>

      <Button type="submit" disabled={!canSubmit} className="min-h-11 rounded-2xl bg-[#111B4D] text-white hover:bg-[#1E2A78] sm:w-fit">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        Enregistrer mes coordonnées
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
        className="h-11 rounded-2xl border-[#DDE6F7] bg-white text-sm focus-visible:ring-[#9AAAD0]"
        required
      />
    </div>
  );
}
