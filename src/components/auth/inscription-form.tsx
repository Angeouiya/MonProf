"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Info, Mail, Phone, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { signIn } from "next-auth/react";
import { PublicLayout } from "@/components/layouts/public-layout";
import { PasswordInput } from "@/components/shared/password-input";
import { PasswordRuleList } from "@/components/shared/password-rule-list";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLIENT_PASSWORD_MIN_LENGTH, isClientPasswordCompliant } from "@/lib/password-policy";

const FIELD_CLASS = "h-12 rounded-lg border-[#DDE3EE] bg-white pl-10 text-sm focus-visible:border-[#111B4D] focus-visible:ring-[#111B4D]";
const PASSWORD_FIELD_CLASS = "h-12 rounded-lg border-[#DDE3EE] bg-white text-sm focus-visible:border-[#111B4D] focus-visible:ring-[#111B4D]";

export function InscriptionForm({ returnTo }: { returnTo?: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const normalizedEmail = form.email.toLowerCase().trim();
  const normalizedPhone = form.phone.trim();
  const passwordValid = isClientPasswordCompliant(form.password);
  const passwordsMatch = Boolean(form.confirmPassword) && form.password === form.confirmPassword;
  const passwordRules = [
    { label: `${CLIENT_PASSWORD_MIN_LENGTH} caractères, une lettre et un chiffre`, ok: passwordValid },
    { label: "Les deux mots de passe sont identiques", ok: passwordsMatch },
  ];

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError(null);
  }

  function validateIdentity() {
    if (form.name.trim().length < 2) {
      setError("Saisissez votre nom complet.");
      return false;
    }
    if (!normalizedEmail && !normalizedPhone) {
      setError("Saisissez un email ou un numéro de téléphone.");
      return false;
    }
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Vérifiez votre adresse email.");
      return false;
    }
    if (normalizedPhone && normalizedPhone.replace(/\D/g, "").length < 8) {
      setError("Vérifiez votre numéro de téléphone.");
      return false;
    }
    return true;
  }

  function continueToPassword() {
    setError(null);
    if (!validateIdentity()) return;
    setStep(2);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError(null);

    if (!validateIdentity()) {
      setStep(1);
      return;
    }
    if (!passwordValid) {
      setError(`Choisissez au moins ${CLIENT_PASSWORD_MIN_LENGTH} caractères avec une lettre et un chiffre.`);
      return;
    }
    if (!passwordsMatch) {
      setError("Les deux mots de passe doivent être identiques.");
      return;
    }
    if (!legalAccepted) {
      setError("Acceptez les conditions pour créer votre compte.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: normalizedEmail || undefined,
          phone: normalizedPhone || undefined,
          password: form.password,
          legalAccepted,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Inscription impossible");

      const signed = await signIn("credentials", {
        email: normalizedEmail || normalizedPhone,
        password: form.password,
        redirect: false,
      });
      if (!signed || signed.error) {
        toast.success("Compte créé. Connectez-vous pour continuer.");
        router.push(returnTo ? `/connexion?from=${encodeURIComponent(returnTo)}` : "/connexion");
        return;
      }

      toast.success("Votre compte est prêt.");
      router.push(returnTo ?? "/client");
      router.refresh();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  const loginHref = returnTo ? `/connexion?from=${encodeURIComponent(returnTo)}` : "/connexion";

  return (
    <PublicLayout>
      <section className="min-h-[calc(100svh-8rem)] bg-[#F7F9FC] sm:bg-white">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-5 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center lg:py-14">
          <aside className="hidden overflow-hidden rounded-3xl bg-[#0D1745] p-9 text-white shadow-[0_24px_70px_rgba(13,23,69,0.16)] lg:block">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Compte sécurisé
            </span>
            <h1 className="mt-7 text-4xl font-semibold leading-tight tracking-tight">
              Réservez.<br />On s’occupe du reste.
            </h1>
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
              Vos cours, paiements et confirmations restent réunis au même endroit.
            </p>
            <div className="mt-10 grid gap-3">
              {["Professeurs vérifiés", "Prix clair avant paiement", "Suivi de chaque cours"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-4 py-3 text-sm font-semibold">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D6AD48] text-[#0D1745]">
                    <Check className="h-4 w-4" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </aside>

          <div className="mx-auto w-full max-w-[430px]">
            <div className="rounded-2xl border border-[#E3E8F2] bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                    Étape {step} sur 2
                  </span>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">
                    {step === 1 ? "Créer votre compte" : "Choisir votre mot de passe"}
                  </h1>
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#111B4D]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2" aria-label={`Étape ${step} sur 2`}>
                <span className="h-1.5 rounded-full bg-[#111B4D]" />
                <span className={`h-1.5 rounded-full ${step === 2 ? "bg-[#111B4D]" : "bg-[#E3E8F2]"}`} />
              </div>

              {error && (
                <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5">
                {step === 1 ? (
                  <div className="space-y-4">
                    <Field label="Nom complet" htmlFor="name">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      <Input
                        id="name"
                        autoComplete="name"
                        required
                        value={form.name}
                        onChange={(event) => update("name", event.target.value)}
                        placeholder="Kouassi Aya"
                        className={FIELD_CLASS}
                      />
                    </Field>

                    <Field label="Email" hint="Recommandé" htmlFor="email">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={(event) => update("email", event.target.value)}
                        placeholder="vous@exemple.ci"
                        className={FIELD_CLASS}
                      />
                    </Field>

                    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
                      <span className="h-px flex-1 bg-[#E3E8F2]" />
                      ou
                      <span className="h-px flex-1 bg-[#E3E8F2]" />
                    </div>

                    <Field label="Téléphone" htmlFor="phone">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                      <Input
                        id="phone"
                        type="tel"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={(event) => update("phone", event.target.value)}
                        placeholder="+225 07 00 00 00 00"
                        className={FIELD_CLASS}
                      />
                    </Field>

                    <p className="text-xs leading-5 text-[#64748B]">
                      Avec un email, vous pourrez récupérer votre mot de passe par lien.
                    </p>

                    <Button type="button" onClick={continueToPassword} className="min-h-12 w-full rounded-xl bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                      Continuer
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input
                      type="text"
                      name="username"
                      autoComplete="username"
                      value={normalizedEmail || normalizedPhone}
                      readOnly
                      tabIndex={-1}
                      aria-label="Identifiant du compte"
                      className="sr-only"
                      data-client-registration-password-username
                    />
                    <Field label="Mot de passe" htmlFor="password">
                      <PasswordInput
                        id="password"
                        autoComplete="new-password"
                        required
                        value={form.password}
                        onChange={(event) => update("password", event.target.value)}
                        placeholder={`${CLIENT_PASSWORD_MIN_LENGTH} caractères minimum`}
                        className={PASSWORD_FIELD_CLASS}
                      />
                    </Field>

                    <Field label="Confirmer" htmlFor="confirmPassword">
                      <PasswordInput
                        id="confirmPassword"
                        autoComplete="new-password"
                        required
                        value={form.confirmPassword}
                        onChange={(event) => update("confirmPassword", event.target.value)}
                        placeholder="Répétez le mot de passe"
                        className={PASSWORD_FIELD_CLASS}
                      />
                    </Field>

                    <PasswordRuleList rules={passwordRules} data-client-registration-password-rules />

                    <label htmlFor="legalAccepted" className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-[#E3E8F2] p-3 text-sm leading-5 text-[#475569]">
                      <Checkbox
                        id="legalAccepted"
                        checked={legalAccepted}
                        onCheckedChange={(checked) => setLegalAccepted(checked === true)}
                        className="mt-0.5"
                      />
                      <span>
                        J’accepte les <Link href="/conditions-utilisation" target="_blank" className="font-semibold text-[#111B4D] underline underline-offset-2">conditions</Link> et la <Link href="/politique-confidentialite" target="_blank" className="font-semibold text-[#111B4D] underline underline-offset-2">confidentialité</Link>.
                      </span>
                    </label>

                    <div className="grid grid-cols-[auto_1fr] gap-2">
                      <Button type="button" variant="outline" onClick={() => { setError(null); setStep(1); }} className="min-h-12 rounded-xl px-4" aria-label="Revenir aux coordonnées">
                        <ArrowLeft className="h-4 w-4" />
                        Retour
                      </Button>
                      <Button type="submit" disabled={loading} className="min-h-12 rounded-xl bg-[#111B4D] text-white hover:bg-[#1E2A78]">
                        {loading ? "Création..." : "Créer mon compte"}
                        {!loading && <ArrowRight className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </form>

              <p className="mt-5 text-center text-sm text-[#64748B]">
                Déjà un compte ?{" "}
                <Link href={loginHref} className="font-semibold text-[#111B4D] underline-offset-4 hover:underline">
                  Se connecter
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="font-semibold text-[#111827]">
        {label}
        {hint && <span className="ml-2 text-xs font-medium text-[#64748B]">{hint}</span>}
      </Label>
      <div className="relative">{children}</div>
    </div>
  );
}
