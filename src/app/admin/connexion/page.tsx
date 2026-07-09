"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { ArrowRight, Eye, EyeOff, Info, Lock, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PublicLayout } from "@/components/layouts/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELD_CLASS = "h-12 rounded-lg border-[#DDE6F7] bg-white pl-10 text-sm focus-visible:ring-[#9AAAD0]";
const PASSWORD_FIELD_CLASS = "h-12 rounded-lg border-[#DDE6F7] bg-white pl-10 pr-14 text-sm focus-visible:ring-[#9AAAD0]";

export default function AdminConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.user?.role === "ADMIN") router.replace("/admin");
      })
      .catch(() => {});
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (!email.trim() || !password) {
      setError("Veuillez saisir l'email administrateur et le mot de passe.");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError("Identifiants administrateur incorrects.");
        setLoading(false);
        return;
      }

      const me = await fetch("/api/auth/me", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : null,
      );

      if (me?.user?.role !== "ADMIN") {
        await signOut({ redirect: false });
        setError("Accès administrateur refusé. Utilisez un compte administrateur.");
        setLoading(false);
        return;
      }

      toast.success("Connexion administrateur réussie.");
      router.replace("/admin");
      window.location.assign("/admin");
    } catch (err: any) {
      setError(err?.message || "Connexion impossible. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <section className="bg-white">
        <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center lg:py-12">
          <div className="hidden lg:block">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Accès administrateur sécurisé
            </span>
            <h1 className="mt-4 max-w-2xl text-4xl font-semibold tracking-normal text-[#111827] text-balance">
              Console de contrôle Compétence.
            </h1>
            <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-[#64748B]">
              Gérez les professeurs, réservations, paiements PayDunya, remboursements, notifications, litiges et actions opérationnelles depuis un espace protégé.
            </p>
            <div className="mt-6 grid max-w-xl gap-3">
              {[
                "Accès réservé aux comptes administrateurs",
                "Aucune clé PayDunya n'est exposée côté client",
                "Réservations activées uniquement après preuve serveur",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-[#E3E8F2] bg-white p-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-semibold text-[#111827]">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#111B4D] text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-normal text-[#111827] sm:text-3xl">
                Connexion admin
              </h2>
              <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                Accédez au dashboard administrateur et au centre opérationnel.
              </p>
            </div>

            <div className="rounded-lg border border-[#E3E8F2] bg-white p-4 sm:p-5">
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-300 bg-white px-3 py-2.5 text-sm font-semibold text-red-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email">Email administrateur</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <Input
                      id="admin-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="admin@competence.ci"
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="admin-password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Mot de passe administrateur"
                      className={PASSWORD_FIELD_CLASS}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
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
                      Entrer dans l'admin
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="mt-4 rounded-lg border border-[#DDE6F7] bg-white px-3 py-2 text-xs font-medium leading-5 text-[#64748B]">
                Pour modifier ou récupérer un accès administrateur, utilisez uniquement un compte créé par le propriétaire de la plateforme.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
