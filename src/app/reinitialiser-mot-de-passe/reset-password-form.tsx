"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { PasswordInput } from "@/components/shared/password-input";
import { PasswordRuleList } from "@/components/shared/password-rule-list";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CLIENT_PASSWORD_MIN_LENGTH, isClientPasswordCompliant } from "@/lib/password-policy";

export function ResetPasswordForm({ loginHref = "/connexion" }: { loginHref?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const strongPassword = isClientPasswordCompliant(password);
  const valid = strongPassword && password === confirmPassword && Boolean(token);
  const passwordRules = [
    { label: `${CLIENT_PASSWORD_MIN_LENGTH} caractères minimum`, ok: password.length >= CLIENT_PASSWORD_MIN_LENGTH },
    { label: "Une lettre et un chiffre", ok: /[A-Za-z]/.test(password) && /\d/.test(password) },
    { label: "Confirmation identique", ok: Boolean(confirmPassword) && password === confirmPassword },
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!valid) {
      setFormError("Vérifiez le lien et les deux mots de passe.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const responseText = await res.text();
      let data: { error?: string; redirectTo?: string; email?: { sent?: boolean; queued?: boolean; message?: string } } = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText) as { error?: string; redirectTo?: string; email?: { sent?: boolean; queued?: boolean; message?: string } };
        } catch {
          // Une réponse d'infrastructure ne doit pas masquer le résultat utilisateur.
        }
      }
      if (!res.ok) throw new Error(data.error || "Réinitialisation impossible.");
      const target = new URL(data.redirectTo || loginHref, window.location.origin);
      target.searchParams.set("passwordChanged", "1");
      router.push(`${target.pathname}${target.search}${target.hash}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Réinitialisation impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      {!token && (
        <div className="rounded-lg border border-red-200 bg-white p-3 text-sm font-semibold text-red-700">
          Lien absent. Demandez un nouveau lien de réinitialisation.
        </div>
      )}
      <div>
        <Label htmlFor="new-password">Nouveau mot de passe</Label>
        <PasswordInput
          id="new-password"
          value={password}
          onChange={(event) => { setPassword(event.target.value); setFormError(""); }}
          autoComplete="new-password"
          wrapperClassName="mt-1.5"
          className="h-11 rounded-lg border-[#DDE6F7]"
          required
        />
      </div>
      <div>
        <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
        <PasswordInput
          id="confirm-password"
          value={confirmPassword}
          onChange={(event) => { setConfirmPassword(event.target.value); setFormError(""); }}
          autoComplete="new-password"
          wrapperClassName="mt-1.5"
          className="h-11 rounded-lg border-[#DDE6F7]"
          required
        />
      </div>
      <PasswordRuleList rules={passwordRules} data-reset-password-rules />
      {formError && (
        <div className="rounded-lg border border-red-200 bg-white p-3 text-sm font-semibold leading-6 text-red-700" role="alert">
          {formError}
        </div>
      )}
      <Button type="submit" disabled={!valid || loading} className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
        Modifier le mot de passe
      </Button>
    </form>
  );
}
