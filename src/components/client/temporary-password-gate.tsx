import { KeyRound, ShieldCheck } from "lucide-react";
import { ClientPasswordSettingsForm } from "@/app/client/parametres/settings-client";
import { BrandLogo } from "@/components/shared/brand-logo";

export function ClientTemporaryPasswordGate({ clientName }: { clientName: string }) {
  return (
    <main className="min-h-screen bg-[#F5F7FB] px-4 py-8 text-[#111827]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col justify-center">
        <div className="mb-6 flex justify-center">
          <BrandLogo size="lg" priority />
        </div>
        <section className="rounded-xl border border-[#CAD7F2] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#111B4D] text-white">
              <KeyRound className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#64748B]">Accès temporaire sécurisé</p>
              <h1 className="mt-1 text-2xl font-semibold">Créez votre mot de passe personnel</h1>
              <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                Bonjour {clientName}. Le mot de passe transmis par le service client est temporaire. Saisissez-le comme mot de passe actuel, puis choisissez votre mot de passe personnel.
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-[#E3E8F2] bg-white p-4">
            <ClientPasswordSettingsForm />
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs font-semibold leading-5 text-[#64748B]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#111B4D]" />
            Votre espace, vos réservations et vos données restent bloqués jusqu'à ce remplacement. La session temporaire sera ensuite fermée.
          </p>
        </section>
      </div>
    </main>
  );
}
