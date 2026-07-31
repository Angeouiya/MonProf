"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CLIENT_IDENTITY_VERIFICATION_METHOD_OPTIONS,
  IDENTITY_VERIFICATION_REFERENCE_MAX_LENGTH,
  IDENTITY_VERIFICATION_REFERENCE_MIN_LENGTH,
  isSafeIdentityVerificationReference,
  normalizeIdentityVerificationReference,
} from "@/lib/client-identity-verification";
import { TEMPORARY_PASSWORD_TTL_HOURS } from "@/lib/temporary-password-policy";

export function ClientTemporaryPasswordForm({
  clientId,
  clientName,
  hasPendingRequest,
}: {
  clientId: string;
  clientName: string;
  hasPendingRequest: boolean;
}) {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState("");
  const [verificationReference, setVerificationReference] = useState("");
  const verificationReferenceIsSafe = isSafeIdentityVerificationReference(verificationReference);

  async function copyPassword() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    toast.success("Mot de passe temporaire copié. Transmettez-le uniquement au client vérifié.");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || issued) return;
    const conciseReference = normalizeIdentityVerificationReference(verificationReference);
    if (!identityVerified || !verificationMethod || !isSafeIdentityVerificationReference(conciseReference)) {
      toast.error("Confirmez l'identité, la méthode et une référence interne non sensible avant de continuer.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/temporary-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityVerified,
          verificationMethod,
          verificationReference: conciseReference,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Création impossible.");
      if (typeof data.temporaryPassword !== "string" || !data.temporaryPassword) {
        throw new Error("Le serveur n'a pas remis le mot de passe temporaire attendu.");
      }
      setPassword(data.temporaryPassword);
      setIssued(true);
      setVisible(true);
      toast.success("Accès temporaire créé. Le client devra remplacer ce mot de passe à la connexion.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#111827]">Accès temporaire de {clientName}</p>
          <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
            Vérifiez d'abord l'identité du client. Cette action révoque ses sessions et l'oblige à créer son mot de passe personnel.
          </p>
        </div>
        {hasPendingRequest && (
          <span className="inline-flex w-fit items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            Demande d'assistance en attente
          </span>
        )}
      </div>

      {issued ? (
        <div>
          <Label htmlFor="client-temporary-password">Mot de passe temporaire</Label>
          <div className="relative mt-1.5">
            <Input
              id="client-temporary-password"
              type={visible ? "text" : "password"}
              value={password}
              readOnly
              autoComplete="new-password"
              className="h-11 pr-12"
            />
            <button
              type="button"
              onClick={() => setVisible((current) => !current)}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-[#64748B]"
              aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold text-amber-800">
            Copiez-le maintenant : il ne sera plus affiché après le rechargement de cette page.
          </p>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-[#DCE5F2] bg-[#F8FAFC] p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#111B4D]" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-[#111827]">Preuve de vérification obligatoire</p>
              <p id="identity-verification-help" className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                Indiquez comment l'identité a été contrôlée. Ne saisissez jamais un numéro complet de pièce d'identité, un mot de passe ou un code secret.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-identity-verification-method">Méthode de vérification</Label>
            <select
              id="client-identity-verification-method"
              value={verificationMethod}
              onChange={(event) => setVerificationMethod(event.target.value)}
              disabled={saving}
              required
              aria-describedby="identity-verification-help"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-[#111827] shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Sélectionner une méthode</option>
              {CLIENT_IDENTITY_VERIFICATION_METHOD_OPTIONS.map((method) => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="client-identity-verification-reference">Référence de vérification</Label>
            <Input
              id="client-identity-verification-reference"
              value={verificationReference}
              onChange={(event) => setVerificationReference(event.target.value)}
              minLength={IDENTITY_VERIFICATION_REFERENCE_MIN_LENGTH}
              maxLength={IDENTITY_VERIFICATION_REFERENCE_MAX_LENGTH}
              required
              disabled={saving}
              autoComplete="off"
              aria-describedby="identity-verification-reference-help"
              placeholder="Ex. SUP-1842 ou RES/2026/2481"
              className="h-11"
            />
            <p id="identity-verification-reference-help" className="text-xs font-medium leading-5 text-[#64748B]">
              {IDENTITY_VERIFICATION_REFERENCE_MIN_LENGTH} à {IDENTITY_VERIFICATION_REFERENCE_MAX_LENGTH} caractères. Utilisez uniquement une référence interne ; jamais un email, un téléphone, un numéro de pièce ou un code secret.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#CBD7E8] bg-white p-3 text-sm font-semibold leading-5 text-[#111827]">
            <input
              type="checkbox"
              checked={identityVerified}
              onChange={(event) => setIdentityVerified(event.target.checked)}
              disabled={saving}
              required
              className="mt-0.5 h-4 w-4 rounded border-[#94A3B8] text-[#111B4D] focus:ring-[#111B4D]"
            />
            <span>Je confirme avoir vérifié l'identité de ce client avant la remise de l'accès temporaire.</span>
          </label>

          <p className="text-xs font-medium leading-5 text-[#64748B]">
            Après validation, le serveur générera un secret aléatoire valable {TEMPORARY_PASSWORD_TTL_HOURS} heures et pour une seule première connexion. Il ne sera ni envoyé automatiquement par email ni enregistré en clair.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          disabled={
            saving
            || issued
            || !identityVerified
            || !verificationMethod
            || !verificationReferenceIsSafe
          }
          className="min-h-11 bg-[#111B4D] text-white hover:bg-[#1E2A78]"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : issued ? <Check className="mr-2 h-4 w-4" /> : <KeyRound className="mr-2 h-4 w-4" />}
          {issued ? "Accès temporaire créé" : "Créer un accès temporaire sûr"}
        </Button>
        <Button type="button" variant="outline" disabled={!issued || !password} className="min-h-11" onClick={copyPassword}>
          <Copy className="mr-2 h-4 w-4" /> Copier pour transmission sécurisée
        </Button>
      </div>
    </form>
  );
}
