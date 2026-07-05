"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  Lock,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  User,
  GraduationCap,
  CheckCircle2,
  ShieldCheck,
  CalendarCheck,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Commune = { id: string; name: string };

const ACCOUNT_BENEFITS = [
  {
    icon: CalendarCheck,
    title: "Réservation suivie",
    text: "Date, professeur, matière et statut restent centralisés dans votre espace.",
  },
  {
    icon: WalletCards,
    title: "Paiement protégé",
    text: "Le montant payé reste relié à la réservation et consultable à tout moment.",
  },
  {
    icon: MessageSquareText,
    title: "Support traçable",
    text: "Notifications, confirmations, avis et litiges gardent un historique clair.",
  },
];

const TRUST_POINTS = [
  "Professeurs vérifiés par l'administration",
  "Paiement bloqué jusqu'à confirmation",
  "Historique complet des cours et avis",
];

const FIELD_CLASS = "h-12 rounded-2xl border-[#E3E8F2] bg-white pl-10 text-sm focus-visible:border-[#111B4D] focus-visible:ring-[#111B4D]";
const PASSWORD_FIELD_CLASS = "h-12 rounded-2xl border-[#E3E8F2] bg-white pl-10 pr-14 text-sm focus-visible:border-[#111B4D] focus-visible:ring-[#111B4D]";
const SELECT_CLASS = "!h-12 min-h-12 w-full rounded-2xl border-[#E3E8F2] bg-white focus:border-[#111B4D] focus:ring-[#111B4D]";

export function InscriptionForm({ communes }: { communes: Commune[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwdConfirm, setShowPwdConfirm] = useState(false);
  const [commune, setCommune] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    quartier: "",
    password: "",
    confirmPassword: "",
  });

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);

    // Basic validations
    if (form.name.trim().length < 2) {
      setError("Le nom doit comporter au moins 2 caractères.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Adresse email invalide.");
      return;
    }
    if (form.phone && form.phone.replace(/\s/g, "").length < 8) {
      setError("Numéro de téléphone invalide.");
      return;
    }
    if (form.password.length < 6) {
      setError("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.toLowerCase().trim(),
          phone: form.phone.trim() || undefined,
          password: form.password,
          commune: commune || undefined,
          quartier: form.quartier.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Inscription impossible");
      }

      const signed = await signIn("credentials", {
        email: form.email.toLowerCase().trim(),
        password: form.password,
        redirect: false,
      });
      if (!signed || signed.error) {
        toast.success("Compte créé ! Connectez-vous pour continuer.");
        router.push("/connexion");
        return;
      }

      toast.success("Bienvenue sur Compétence ! Votre compte a été créé.");
      router.push("/client");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout>
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(320px,430px)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:py-14">
          <aside className="overflow-hidden rounded-[1.8rem] border border-[#E3E8F2] bg-white p-4 sm:p-6 lg:sticky lg:top-24">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Nouveau compte client
            </span>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-[#111827] text-balance sm:text-4xl">
              Créez votre espace et réservez sans perdre le fil.
            </h1>
            <p className="mt-3 text-sm font-medium leading-7 text-[#475569]">
              Votre compte client garde vos réservations, confirmations, paiements et avis dans un espace simple, lisible et sécurisé.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <Signal value="2h" label="par séance" />
              <Signal value="CI" label="local" />
              <Signal value="24/7" label="suivi" />
            </div>

            <div className="mt-6 space-y-3">
              {TRUST_POINTS.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-[#E3E8F2] bg-white p-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#111B4D] text-white">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-[#111827]">{item}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.15rem] border border-[#E3E8F2] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Après création</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#111827]">
                Vous arrivez directement dans votre dashboard client pour retrouver vos réservations, cours, paiements et notifications.
              </p>
            </div>
          </aside>

          <div className="w-full">
            <div className="mb-5 rounded-[1.6rem] border border-[#E3E8F2] bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#111B4D]">
                    <GraduationCap className="h-3.5 w-3.5" />
                    Inscription gratuite
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
                    Créer un compte client
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                    Renseignez vos informations de contact pour réserver plus vite et garder un suivi propre.
                  </p>
                </div>
                <Link href="/connexion" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#E3E8F2] bg-white px-4 text-sm font-semibold text-[#111B4D] transition hover:border-[#111B4D] hover:bg-white">
                  Déjà inscrit
                </Link>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-[#E3E8F2] bg-white p-4 sm:p-6">
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-2xl border border-[#991B1B] bg-white px-3 py-2.5 text-sm font-semibold text-[#991B1B]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="font-semibold text-[#111827]">
                  Nom complet <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <Input
                    id="name"
                    required
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Ex. Kouassi Aya"
                    className={FIELD_CLASS}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="font-semibold text-[#111827]">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                      placeholder="vous@exemple.ci"
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="font-semibold text-[#111827]">Téléphone</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                      placeholder="+225 07 00 00 00 00"
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="commune" className="font-semibold text-[#111827]">Commune</Label>
                  <Select value={commune} onValueChange={setCommune}>
                    <SelectTrigger id="commune" className={SELECT_CLASS}>
                      <SelectValue placeholder="Choisir une commune" />
                    </SelectTrigger>
                    <SelectContent>
                      {communes.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quartier" className="font-semibold text-[#111827]">Quartier</Label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                    <Input
                      id="quartier"
                      value={form.quartier}
                      onChange={(e) => update("quartier", e.target.value)}
                      placeholder="Ex. Riviera Palmeraie"
                      className={FIELD_CLASS}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="font-semibold text-[#111827]">
                  Mot de passe <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    placeholder="Minimum 6 caractères"
                    className={PASSWORD_FIELD_CLASS}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-white hover:text-[#111B4D]"
                    aria-label="Afficher/masquer"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="font-semibold text-[#111827]">
                  Confirmer le mot de passe <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                  <Input
                    id="confirmPassword"
                    type={showPwdConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={form.confirmPassword}
                    onChange={(e) => update("confirmPassword", e.target.value)}
                    placeholder="Ressaisissez votre mot de passe"
                    className={PASSWORD_FIELD_CLASS}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwdConfirm((v) => !v)}
                    className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-[#64748B] transition hover:bg-white hover:text-[#111B4D]"
                    aria-label="Afficher/masquer"
                  >
                    {showPwdConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="min-h-12 w-full rounded-2xl bg-[#111B4D] text-white hover:bg-[#1E2A78]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-[#64748B]" />
                    Création du compte...
                  </>
                ) : (
                  <>
                    Créer mon compte
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="grid gap-2 md:grid-cols-3">
                {ACCOUNT_BENEFITS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-2xl border border-[#E3E8F2] bg-white p-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#111B4D] text-white">
                        <Icon className="h-4 w-4" />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#111827]">{item.title}</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-[#64748B]">{item.text}</p>
                    </div>
                  );
                })}
              </div>

              <ul className="space-y-1.5 rounded-2xl border border-[#E3E8F2] bg-white px-3.5 py-3 text-xs font-semibold text-[#111B4D]">
                {TRUST_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#111B4D]" />
                    {point}
                  </li>
                ))}
              </ul>
            </form>

            <p className="mt-5 flex flex-col items-center justify-center gap-2 text-center text-sm font-medium text-[#64748B] min-[420px]:flex-row">
              <span>Vous avez déjà un compte ?</span>
              <Link
                href="/connexion"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#E3E8F2] bg-white px-4 font-semibold text-[#111B4D] transition hover:border-[#111B4D] hover:bg-white"
              >
                Connectez-vous
              </Link>
            </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function Signal({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[#E3E8F2] bg-white px-3 py-3 text-center">
      <p className="text-lg font-semibold leading-none text-[#111B4D]">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
    </div>
  );
}
