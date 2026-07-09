"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Lock, Mail, Eye, EyeOff, ArrowRight, Info, ShieldCheck, WalletCards, CalendarCheck, Users, ClipboardCheck, Bell } from "lucide-react";
import { toast } from "sonner";
import { signIn, signOut } from "next-auth/react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ACCOUNT_BENEFITS = [
  { icon: CalendarCheck, title: "Réservations suivies", text: "Dates, créneaux, professeur choisi et statut restent centralisés." },
  { icon: WalletCards, title: "Paiements protégés", text: "Vos fonds restent sécurisés jusqu'à confirmation du cours." },
  { icon: ShieldCheck, title: "Service client traçable", text: "Avis, litiges et messages sont reliés à votre historique client." },
];

const ADMIN_BENEFITS = [
  { icon: ClipboardCheck, title: "Pilotage opérationnel", text: "Réservations, remplacements, urgences et tâches professeurs sont centralisés." },
  { icon: Users, title: "Contrôle professeurs", text: "Fiches internes, statuts, sanctions, paiements et historiques restent suivis par le service client." },
  { icon: Bell, title: "Notifications critiques", text: "Alertes, relances PayDunya, litiges et actions à traiter sont visibles dès l'entrée." },
];

const FIELD_CLASS = "h-12 rounded-lg border-[#DDE6F7] bg-white pl-10 text-sm focus-visible:ring-[#9AAAD0]";
const PASSWORD_FIELD_CLASS = "h-12 rounded-lg border-[#DDE6F7] bg-white pl-10 pr-14 text-sm focus-visible:ring-[#9AAAD0]";

function ConnexionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const isAdminAuth = from?.startsWith("/admin") ?? false;
  const isClientAuth = from?.startsWith("/client") ?? false;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si déjà connecté, rediriger selon le rôle
  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const role = data?.user?.role;
        if (!role) return;

        if (isAdminAuth) {
          if (role === "ADMIN") router.replace("/admin");
          return;
        }

        if (isClientAuth) {
          if (role === "CLIENT") router.replace("/client");
          return;
        }

        if (role === "ADMIN") router.replace("/admin");
        else if (role === "TEACHER") router.replace("/professeur");
        else if (role === "CLIENT") router.replace("/client");
      })
      .catch(() => {});
  }, [isAdminAuth, isClientAuth, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    if (!email || !password) {
      setError("Veuillez saisir votre email et votre mot de passe.");
      return;
    }

    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        setError("Email ou mot de passe incorrect.");
        setLoading(false);
        return;
      }

      // Récupérer le rôle pour rediriger
      const me = await fetch("/api/auth/me", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      );

      toast.success("Connexion réussie. Redirection...");
      const role = me?.user?.role;
      if (isAdminAuth && role !== "ADMIN") {
        await signOut({ redirect: false });
        setError("Accès administrateur refusé. Utilisez un compte administrateur.");
        setLoading(false);
        return;
      }

      const target = from
        ? from
        : role === "ADMIN"
          ? "/admin"
          : role === "CLIENT"
            ? "/client"
            : role === "TEACHER"
              ? "/professeur"
              : "/";
      router.replace(target);
      window.location.assign(target);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue. Réessayez.");
      setLoading(false);
    }
  }

  const benefits = isAdminAuth ? ADMIN_BENEFITS : ACCOUNT_BENEFITS;
  const heroBadge = isAdminAuth ? "Accès administrateur sécurisé" : "Espace sécurisé Compétence";
  const heroTitle = isAdminAuth
    ? "Connectez-vous à la console administrateur."
    : "Reprenez votre suivi de cours en toute confiance.";
  const heroDescription = isAdminAuth
    ? "Supervisez les professeurs, réservations, notifications, paiements bloqués, litiges et actions critiques depuis un espace de contrôle protégé."
    : "Réservations, confirmations, paiements bloqués et suivi service client restent centralisés dans un espace clair et protégé.";
  const formTitle = isAdminAuth ? "Connexion administrateur" : "Connexion client";
  const formDescription = isAdminAuth
    ? "Accédez au dashboard admin, au centre opérationnel et à la comptabilité interne."
    : "Accédez à vos réservations, paiements, cours et notifications.";

  return (
    <PublicLayout>
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-7 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_440px] lg:items-center lg:py-12">
          <div className="hidden lg:block">
            <div className="max-w-xl">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
                <ShieldCheck className="h-3.5 w-3.5" />
                {heroBadge}
              </span>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-[#111827] text-balance xl:text-4xl">
                {heroTitle}
              </h1>
              <p className="mt-3 max-w-lg text-[0.95rem] font-medium leading-7 text-[#64748B]">
                {heroDescription}
              </p>
              <div className="mt-6 grid gap-2.5">
                {benefits.map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-lg border border-[#E3E8F2] bg-white p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#111B4D] text-white ring-1 ring-[#111B4D]">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-[#64748B]">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#1E2A78] text-white">
                {isAdminAuth ? <ShieldCheck className="h-6 w-6" /> : <GraduationCap className="h-6 w-6" />}
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-normal text-[#111827] sm:text-3xl">
                {formTitle}
              </h1>
              <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                {formDescription}
              </p>
            </div>

          <div className="rounded-lg border border-[#E3E8F2] bg-white p-4 sm:p-5">
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-white px-3 py-2.5 text-sm text-red-700">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.ci"
                    className={FIELD_CLASS}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Mot de passe</Label>
                  {!isAdminAuth && (
                    <Link href="/mot-de-passe-oublie" className="inline-flex min-h-11 items-center text-xs font-semibold text-[#111B4D] underline-offset-4 hover:underline">
                      Mot de passe oublié ?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={PASSWORD_FIELD_CLASS}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748B] transition hover:bg-white hover:text-[#111B4D]"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="min-h-12 w-full rounded-lg bg-[#111B4D] text-white hover:bg-[#1E2A78]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#CAD7F2] border-t-white" />
                    Connexion...
                  </>
                ) : (
                  <>
                    Se connecter
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {!isAdminAuth && (
              <p className="mt-5 flex flex-col items-center justify-center gap-2 text-center text-sm font-medium text-[#64748B] min-[420px]:flex-row">
                <span>Pas encore de compte ?</span>
                <Link
                  href="/inscription"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#DDE6F7] bg-white px-4 font-semibold text-[#111B4D] transition hover:bg-white"
                >
                  Créer un compte
                </Link>
              </p>
            )}
            <div className="mt-5 grid gap-2 rounded-lg border border-[#DDE6F7] bg-white p-3 text-xs leading-5 text-[#64748B] max-sm:hidden">
              <p className="font-semibold uppercase tracking-wide text-[#111B4D]">Après connexion</p>
              <p>
                {isAdminAuth
                  ? "Vous arrivez directement sur le dashboard administrateur avec le contrôle des professeurs, paiements, litiges et notifications."
                  : "Vous retrouvez vos réservations, cours, paiements, notifications et demandes au service client dans un seul espace."}
              </p>
            </div>
          </div>

          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense fallback={null}>
      <ConnexionContent />
    </Suspense>
  );
}
