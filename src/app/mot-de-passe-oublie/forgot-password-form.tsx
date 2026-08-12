"use client";

import Link from "next/link";
import { useState } from "react";
import { Headphones, Loader2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setFormError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "email" ? { email } : { phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Demande impossible.");
      setSent(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Demande impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#DDE6F7] bg-white p-1.5" role="tablist" aria-label="Mode de récupération">
          <Button
            type="button"
            variant={mode === "email" ? "default" : "ghost"}
            className={mode === "email" ? "min-h-11 bg-[#111B4D] text-white hover:bg-[#1E2A78]" : "min-h-11 text-[#111B4D]"}
            onClick={() => { setMode("email"); setSent(false); setFormError(""); }}
            role="tab"
            aria-selected={mode === "email"}
          >
            <Mail className="mr-2 h-4 w-4" /> Par email
          </Button>
          <Button
            type="button"
            variant={mode === "phone" ? "default" : "ghost"}
            className={mode === "phone" ? "min-h-11 bg-[#111B4D] text-white hover:bg-[#1E2A78]" : "min-h-11 text-[#111B4D]"}
            onClick={() => { setMode("phone"); setSent(false); setFormError(""); }}
            role="tab"
            aria-selected={mode === "phone"}
          >
            <Phone className="mr-2 h-4 w-4" /> Par téléphone
          </Button>
        </div>

        {mode === "email" ? (
          <div>
            <Label htmlFor="forgot-email">Email utilisé pour créer le compte</Label>
            <Input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setSent(false); setFormError(""); }}
              placeholder="client@email.com"
              autoComplete="email"
              className="mt-1.5 h-11 rounded-lg border-[#DDE6F7]"
              required
            />
          </div>
        ) : (
          <div>
            <Label htmlFor="forgot-phone">Téléphone utilisé sur le compte</Label>
            <Input
              id="forgot-phone"
              type="tel"
              value={phone}
              onChange={(event) => { setPhone(event.target.value); setSent(false); setFormError(""); }}
              placeholder="+225 07 00 00 00 00"
              autoComplete="tel"
              className="mt-1.5 h-11 rounded-lg border-[#DDE6F7]"
              required
            />
            <p className="mt-2 text-xs font-medium leading-5 text-[#64748B]">
              Cette option ouvre une demande d'assistance. Le service client vérifiera votre identité avant de créer un mot de passe temporaire.
            </p>
          </div>
        )}

        {sent && (
          <div className="rounded-lg border border-[#DDE6F7] bg-white p-3 text-sm font-semibold leading-6 text-[#111B4D]" data-forgot-password-inline-state>
            {mode === "email"
              ? "Si un compte client correspond à cette adresse, vous recevrez un lien personnel valable une heure. Pensez à vérifier les courriers indésirables."
              : "Si un compte client correspond à ce numéro, le service client recevra une demande d'assistance et vous indiquera la procédure après vérification."}
          </div>
        )}

        {formError && (
          <div className="rounded-lg border border-red-200 bg-white p-3 text-sm font-semibold leading-6 text-red-700" role="alert">
            {formError}
          </div>
        )}

        <Button type="submit" disabled={loading} className="min-h-11 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : mode === "email" ? <Mail className="mr-2 h-4 w-4" /> : <Headphones className="mr-2 h-4 w-4" />}
          {mode === "email" ? "Envoyer le lien email" : "Demander l'assistance"}
        </Button>
      </form>
      <Link href="/connexion" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#111B4D]">
        Retour à la connexion
      </Link>
    </>
  );
}
