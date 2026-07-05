import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-8 text-[#111827]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" />
        </div>
        <section className="rounded-lg border border-[#E3E8F2] bg-white p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Compte client</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-[#111827]">Mot de passe oublié</h1>
          <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
            Saisissez votre email client. Nous envoyons un lien sécurisé de réinitialisation. Aucun OTP n'est demandé.
          </p>
          <ForgotPasswordForm />
          <Link href="/connexion" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#111B4D]">
            Retour à la connexion
          </Link>
        </section>
      </div>
    </main>
  );
}
