"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Lock, Mail, Eye, EyeOff, ArrowRight, Info } from "lucide-react";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ConnexionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

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
        if (data?.user?.role === "ADMIN") router.replace("/admin");
        else if (data?.user?.role === "CLIENT") router.replace("/client");
      })
      .catch(() => {});
  }, [router]);

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
      if (from) {
        router.push(from);
      } else if (role === "ADMIN") {
        router.push("/admin");
      } else if (role === "CLIENT") {
        router.push("/client");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue. Réessayez.");
      setLoading(false);
    }
  }

  function fillDemo(type: "admin" | "client") {
    if (type === "admin") {
      setEmail("admin@monprof.ci");
      setPassword("admin123");
    } else {
      setEmail("client@demo.ci");
      setPassword("client123");
    }
    setError(null);
  }

  return (
    <PublicLayout>
      <section className="bg-background">
        <div className="mx-auto flex max-w-md flex-col px-4 py-12 sm:px-6 lg:py-20">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Connexion
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Accédez à votre espace client ou administrateur.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.ci"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
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

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Pas encore de compte ?{" "}
              <Link
                href="/inscription"
                className="font-medium text-primary hover:underline"
              >
                Créer un compte
              </Link>
            </p>
          </div>

          {/* Comptes démo */}
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Comptes de démonstration
            </p>
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => fillDemo("client")}
                className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2.5 text-left text-xs transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div>
                  <p className="font-semibold text-foreground">Compte client</p>
                  <p className="text-muted-foreground">client@demo.ci · client123</p>
                </div>
                <span className="text-primary">Utiliser →</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("admin")}
                className="flex items-center justify-between rounded-lg border border-border bg-white px-3 py-2.5 text-left text-xs transition hover:border-primary/40 hover:bg-primary/5"
              >
                <div>
                  <p className="font-semibold text-foreground">Compte admin</p>
                  <p className="text-muted-foreground">admin@monprof.ci · admin123</p>
                </div>
                <span className="text-primary">Utiliser →</span>
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Cliquez sur un compte pour pré-remplir le formulaire. Ces comptes
              servent uniquement à la démonstration.
            </p>
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
