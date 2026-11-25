"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, CheckCircle2, Info, Loader2, Lock, Mail, Phone, ShieldCheck } from "lucide-react";
import { PrivateAccessShell } from "@/components/managed/private-access-shell";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEMPORARY_PASSWORD_TTL_HOURS } from "@/lib/temporary-password-policy";
import { AUTH_FAILURE, loginDestination, loginErrorMessage, loginResultError, readLoginSession } from "@/lib/auth-feedback";

function ProfesseurConnexionContent() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/professeur";
  const denied = searchParams.get("error") === "access";
  const passwordChanged = searchParams.get("passwordChanged") === "1";
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [assistanceOpen, setAssistanceOpen] = useState(false);
  const [assistancePhone, setAssistancePhone] = useState("");
  const [assistanceLoading, setAssistanceLoading] = useState(false);
  const [assistanceSent, setAssistanceSent] = useState(false);
  const [assistanceMessage, setAssistanceMessage] = useState<string | null>(null);
  const [assistanceError, setAssistanceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    denied ? "Accès professeur désactivé ou suspendu. Contactez le service client." : null,
  );

  useEffect(() => {
    let active = true;
    readLoginSession("TEACHER")
      .then((user) => { if (active) window.location.replace(loginDestination("TEACHER", from, user.portalPasswordMustChange)); })
      .catch(() => {});
    return () => { active = false; };
  }, [from]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (!phone.trim() || !password) {
      setError("Saisissez votre numéro de téléphone et votre mot de passe d'accès.");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("teacher-phone", {
        phone,
        password,
        redirect: false,
      });

      const failure = loginResultError(result, "TEACHER");
      if (failure) {
        setError(failure);
        if (result?.error === AUTH_FAILURE.temporaryExpired) openPasswordAssistance();
        return;
      }
      const user = await readLoginSession("TEACHER");
      window.location.replace(loginDestination("TEACHER", from, user.portalPasswordMustChange));
    } catch (err: unknown) {
      setError(loginErrorMessage(err instanceof Error ? err.message : undefined, "TEACHER"));
    } finally {
      setLoading(false);
    }
  }

  function openPasswordAssistance() {
    setAssistanceOpen(true);
    setAssistanceError(null);
    if (!assistancePhone.trim() && phone.trim()) setAssistancePhone(phone);
  }

  async function handlePasswordAssistance(event: React.FormEvent) {
    event.preventDefault();
    if (assistanceLoading) return;
    setAssistanceError(null);
    setAssistanceMessage(null);

    if (!assistancePhone.trim()) {
      setAssistanceError("Saisissez le numéro utilisé pour votre connexion professeur.");
      return;
    }

    setAssistanceLoading(true);
    try {
      const response = await fetch("/api/professor/password-assistance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ phone: assistancePhone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAssistanceError(data.error || "Demande impossible. Vérifiez le numéro saisi.");
        return;
      }

      setAssistanceSent(true);
      setAssistanceMessage(data.message || "Votre demande a été prise en compte.");
    } catch {
      setAssistanceError("Le service est momentanément indisponible. Utilisez le contact email ci-dessous.");
    } finally {
      setAssistanceLoading(false);
    }
  }

  return (
    <PrivateAccessShell>
      <section className="bg-white">
        <div data-private-login-layout>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 text-center">
              <div className="mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                <Phone className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-normal text-[#111827] sm:text-3xl">
                Connexion professeur
              </h1>
              <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                Utilisez le numéro de téléphone et le mot de passe transmis par le service client.
              </p>
            </div>

            <div className="rounded-lg border border-[#E3E8F2] bg-white p-6">
              {passwordChanged && (
                <div
                  data-password-changed-login-state
                  className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm font-semibold leading-6 text-emerald-800"
                  role="status"
                  aria-live="polite"
                >
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>Mot de passe professeur modifié. Reconnectez-vous avec le nouveau mot de passe.</span>
                </div>
              )}
              {error && (
                <div role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-white px-3 py-2.5 text-sm font-semibold text-red-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="teacher-phone">Téléphone</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <Input
                      id="teacher-phone"
                      name="username"
                      type="tel"
                      autoComplete="tel"
                      required
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+225 07 00 00 00 00"
                      className="h-12 rounded-lg border-[#DDE6F7] bg-white pl-10 text-sm focus-visible:ring-[#9AAAD0]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="teacher-password">Mot de passe d'accès</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <PasswordInput
                      id="teacher-password"
                      name="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className="h-12 rounded-lg border-[#DDE6F7] bg-white pl-10 pr-14 text-sm focus-visible:ring-[#9AAAD0]"
                    />
                  </div>
                </div>

                <Button type="submit" size="lg" className="min-h-12 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]" disabled={loading}>
                  {loading ? "Connexion..." : "Entrer dans l'espace professeur"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
                <button
                  type="button"
                  onClick={openPasswordAssistance}
                  className="inline-flex min-h-10 items-center text-left text-sm font-semibold text-[#111B4D] hover:underline"
                >
                  Mot de passe oublié ? Demander une assistance sécurisée
                </button>
              </form>

              {assistanceOpen && (
                <section className="mt-5 rounded-lg border border-[#CAD7F2] bg-[#F8FAFF] p-4" aria-labelledby="teacher-password-assistance-title">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 id="teacher-password-assistance-title" className="text-sm font-semibold text-[#111827]">
                        Récupération de l'accès professeur
                      </h2>
                      <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">
                        Saisissez votre numéro de connexion. Si un accès correspond, une alerte urgente sera transmise au service client, qui vérifiera votre identité avant de créer un mot de passe temporaire.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAssistanceOpen(false)}
                      className="shrink-0 text-xs font-semibold text-[#64748B] hover:text-[#111B4D] hover:underline"
                    >
                      Fermer
                    </button>
                  </div>

                  {assistanceSent ? (
                    <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-white p-3" aria-live="polite">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                      <p className="text-sm font-medium leading-6 text-emerald-900">{assistanceMessage}</p>
                    </div>
                  ) : (
                    <form onSubmit={handlePasswordAssistance} className="mt-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="teacher-assistance-phone">Numéro de connexion professeur</Label>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                          <Input
                            id="teacher-assistance-phone"
                            type="tel"
                            autoComplete="tel"
                            required
                            value={assistancePhone}
                            onChange={(event) => setAssistancePhone(event.target.value)}
                            placeholder="+225 07 00 00 00 00"
                            className="h-11 rounded-lg border-[#DDE6F7] bg-white pl-10 text-sm focus-visible:ring-[#9AAAD0]"
                          />
                        </div>
                      </div>
                      {assistanceError && (
                        <p className="text-sm font-semibold text-red-700" role="alert">{assistanceError}</p>
                      )}
                      <Button type="submit" variant="outline" className="min-h-11 w-full border-[#CAD7F2] bg-white text-[#111B4D]" disabled={assistanceLoading}>
                        {assistanceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        {assistanceLoading ? "Transmission..." : "Transmettre la demande au service client"}
                      </Button>
                    </form>
                  )}

                  <a
                    href="mailto:diplomateimmobilier99@gmail.com?subject=Mot%20de%20passe%20temporaire%20professeur%20Comp%C3%A9tence"
                    className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#111B4D] hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    Écrire à diplomateimmobilier99@gmail.com
                  </a>
                </section>
              )}

              <details className="mt-5 rounded-lg border border-[#DDE6F7] bg-white p-3 text-xs leading-5 text-[#64748B]">
                <summary className="cursor-pointer font-semibold">Accès et mot de passe temporaire</summary>
                <p className="font-semibold uppercase tracking-wide text-[#111B4D]">Important</p>
                <p className="mt-1">
                  Ce portail ne permet pas de créer un compte professeur. Aucun code SMS n'est envoyé : le numéro sert uniquement d'identifiant et l'accès est activé ou désactivé par le service client.
                </p>
                <p className="mt-2">
                  En cas d'oubli, le service client vous remet un mot de passe temporaire valable {TEMPORARY_PASSWORD_TTL_HOURS} heures et pour une seule première connexion. Vous devrez alors le remplacer immédiatement.
                </p>
                <p className="mt-2">
                  Avant l'activation des identifiants, le professeur doit lire et accepter le cadre Compétence présenté par le service client :{" "}
                  <Link href="/conditions-utilisation" className="font-semibold text-[#111B4D] hover:underline">
                    conditions d'utilisation
                  </Link>{" "}
                  et{" "}
                  <Link href="/politique-confidentialite" className="font-semibold text-[#111B4D] hover:underline">
                    politique de confidentialité
                  </Link>
                  .
                </p>
              </details>
            </div>
          </div>
        </div>
      </section>
    </PrivateAccessShell>
  );
}

export default function ProfesseurConnexionPage() {
  return (
    <Suspense fallback={null}>
      <ProfesseurConnexionContent />
    </Suspense>
  );
}
