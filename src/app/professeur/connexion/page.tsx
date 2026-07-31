"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Info, Loader2, Lock, Mail, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/layouts/public-layout";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEMPORARY_PASSWORD_TTL_HOURS } from "@/lib/temporary-password-policy";

function ProfesseurConnexionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/professeur";
  const denied = searchParams.get("error") === "access";
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    router.prefetch("/professeur");

    fetch("/api/auth/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.role === "TEACHER") router.replace("/professeur");
      })
      .catch(() => {});
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (!phone.trim() || !password.trim()) {
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

      if (!result || result.error) {
        setError("Téléphone ou mot de passe professeur incorrect.");
        setLoading(false);
        return;
      }

      const me = await fetch("/api/auth/me", { cache: "no-store" }).then((res) => (
        res.ok ? res.json() : null
      ));

      if (me?.user?.role !== "TEACHER") {
        await signOut({ redirect: false });
        setError("Cet accès n'est pas un accès professeur.");
        setLoading(false);
        return;
      }

      toast.success("Connexion professeur réussie.");
      const target = me?.user?.portalPasswordMustChange
        ? "/professeur/parametres?motDePasseTemporaire=1"
        : from.startsWith("/professeur") ? from : "/professeur";
      router.replace(target);
      router.refresh();
    } catch {
      setError("Connexion impossible. Vérifiez votre accès ou contactez le service client.");
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
      toast.success("Demande d'assistance prise en compte.");
    } catch {
      setAssistanceError("Le service est momentanément indisponible. Utilisez le contact email ci-dessous.");
    } finally {
      setAssistanceLoading(false);
    }
  }

  return (
    <PublicLayout>
      <section className="bg-white">
        <div className="mx-auto grid min-h-[calc(100vh-90px)] max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_430px] lg:items-center lg:py-16">
          <div className="hidden lg:block">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#DDE6F7] bg-white px-3 py-1 text-xs font-bold text-[#111B4D]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Plateforme professeur légère
              </span>
              <h1 className="mt-5 text-4xl font-semibold tracking-normal text-[#111827] text-balance">
                Gérez vos missions sans dashboard compliqué.
              </h1>
              <p className="mt-4 max-w-lg text-base leading-7 text-[#475569]">
                Consultez vos cours, confirmez vos disponibilités, suivez vos paiements et recevez les consignes du service client Compétence depuis une interface mobile-first.
              </p>
              <div className="mt-8 grid gap-3">
                {[
                  "Connexion directe par téléphone + mot de passe d'accès.",
                  "Aucune inscription publique professeur.",
                  "Les tarifs, sanctions et paiements restent contrôlés par le service client.",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-lg border border-[#E3E8F2] bg-white p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111B4D] text-sm font-semibold text-white">✓</span>
                    <p className="text-sm font-semibold text-[#111827]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 text-center">
              <Link href="/" className="inline-flex justify-center">
                <BrandLogo priority />
              </Link>
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
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-white px-3 py-2.5 text-sm font-semibold text-red-700">
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
                    <Input
                      id="teacher-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className="h-12 rounded-lg border-[#DDE6F7] bg-white pl-10 pr-14 text-sm focus-visible:ring-[#9AAAD0]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-[#64748B] transition hover:bg-white hover:text-[#111B4D]"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
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

              <div className="mt-5 rounded-lg border border-[#DDE6F7] bg-white p-3 text-xs leading-5 text-[#64748B]">
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
              </div>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export default function ProfesseurConnexionPage() {
  return (
    <Suspense fallback={null}>
      <ProfesseurConnexionContent />
    </Suspense>
  );
}
