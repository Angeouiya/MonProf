"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const strongPassword = password.length >= ADMIN_PASSWORD_MIN_LENGTH && /[A-Za-z]/.test(password) && /\d/.test(password);
  const valid = strongPassword && password === confirmPassword && Boolean(token);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) {
      toast.error("Vérifiez le lien et les deux mots de passe.");
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
      let data: { error?: string; email?: { sent?: boolean; message?: string } } = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText) as { error?: string; email?: { sent?: boolean; message?: string } };
        } catch {
          // Une réponse d'infrastructure ne doit pas masquer le résultat utilisateur.
        }
      }
      if (!res.ok) throw new Error(data.error || "Réinitialisation impossible.");
      toast.success(data.email?.sent
        ? "Mot de passe modifié. Un email personnel de confirmation vient de vous être envoyé."
        : "Mot de passe modifié. Vous pouvez vous connecter.");
      if (!data.email?.sent && data.email?.message) toast.warning(data.email.message);
      router.push("/connexion");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Réinitialisation impossible.");
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
        <Input
          id="new-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          className="mt-1.5 h-11 rounded-lg border-[#DDE6F7]"
          required
        />
      </div>
      <div>
        <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          className="mt-1.5 h-11 rounded-lg border-[#DDE6F7]"
          required
        />
      </div>
      <div className="rounded-lg border border-[#E3E8F2] bg-white p-3 text-xs font-semibold leading-5 text-[#64748B]">
        <p className={password.length >= ADMIN_PASSWORD_MIN_LENGTH ? "text-[#111B4D]" : ""}>
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
          {ADMIN_PASSWORD_MIN_LENGTH} caractères minimum
        </p>
        <p className={/[A-Za-z]/.test(password) && /\d/.test(password) ? "text-[#111B4D]" : ""}>
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
          Au moins une lettre et un chiffre
        </p>
        <p className={confirmPassword && password === confirmPassword ? "text-[#111B4D]" : ""}>
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
          Confirmation identique
        </p>
      </div>
      <Button type="submit" disabled={!valid || loading} className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
        Modifier le mot de passe
      </Button>
    </form>
  );
}
