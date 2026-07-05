"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { ArrowRight, Eye, EyeOff, Info, Lock, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/layouts/public-layout";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ProfesseurConnexionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/professeur";
  const denied = searchParams.get("error") === "access";
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    denied ? "Accès professeur désactivé ou suspendu. Contactez l'administration." : null,
  );

  useEffect(() => {
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
      router.push(from.startsWith("/professeur") ? from : "/professeur");
      router.refresh();
    } catch {
      setError("Connexion impossible. Vérifiez votre accès ou contactez l'administration.");
      setLoading(false);
    }
  }

  function fillDemo() {
    setPhone("+225 07 01 02 03 04");
    setPassword("prof123");
    setError(null);
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
                Consultez vos cours, confirmez vos disponibilités, suivez vos paiements et recevez les consignes de l'administration Compétence depuis une interface mobile-first.
              </p>
              <div className="mt-8 grid gap-3">
                {[
                  "Connexion directe par téléphone + mot de passe d'accès.",
                  "Aucune inscription publique professeur.",
                  "Les tarifs, sanctions et paiements restent contrôlés par l'administration.",
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
                Utilisez le numéro de téléphone et le mot de passe transmis par l'administration.
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
              </form>

              <div className="mt-5 rounded-lg border border-[#DDE6F7] bg-white p-3 text-xs leading-5 text-[#64748B]">
                <p className="font-semibold uppercase tracking-wide text-[#111B4D]">Important</p>
                <p className="mt-1">
                  Ce portail ne permet pas de créer un compte professeur. Aucun code SMS n'est envoyé : le numéro sert uniquement d'identifiant et l'accès est activé ou désactivé par l'administration.
                </p>
                <p className="mt-2">
                  Avant l'activation des identifiants, le professeur doit lire et accepter le cadre Compétence présenté par l'administration :{" "}
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

            <div className="mt-5 rounded-lg border border-dashed border-[#DDE6F7] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Démonstration professeur</p>
              <button
                type="button"
                onClick={fillDemo}
                className="mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[#E3E8F2] bg-white px-3 py-2.5 text-left text-xs transition hover:border-[#111B4D] hover:bg-white"
              >
                <div>
                  <p className="font-semibold text-[#111827]">M. Kouamé</p>
                  <p className="text-[#64748B]">+225 07 01 02 03 04 · prof123</p>
                </div>
                <span className="inline-flex items-center gap-1 font-semibold text-[#111B4D]">
                  Utiliser <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
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
